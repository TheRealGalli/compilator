import { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Menu,
    Minus,
    Plus,
    RotateCw,
    Download,
    Printer,
    MoreVertical,
    Type,
    X,
    Undo2,
    Redo2,
    Maximize2
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

// Set up the worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Annotation {
    id: string;
    pageNumber: number;
    x: number;
    y: number;
    text: string;
}

interface PDFViewerProps {
    base64: string;
    fileName: string;
    fileType?: 'pdf' | 'text';
    onAnnotationsChange?: (annotations: Annotation[]) => void;
}

export function PDFViewer({ base64, fileName, fileType = 'pdf', onAnnotationsChange }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);
    const [rotation, setRotation] = useState<number>(0);
    const [isWritingMode, setIsWritingMode] = useState(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [fontSize, setFontSize] = useState<number>(14);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Decoded text content for non-PDF files
    const textContent = useMemo(() => {
        if (fileType === 'text') {
            try {
                return atob(base64);
            } catch (e) {
                console.error("Text decoding failed", e);
                return "Errore nel caricamento del testo.";
            }
        }
        return '';
    }, [base64, fileType]);

    // Simple "Virtual Paging" for text: split by lines or characters
    const textPages = useMemo(() => {
        if (fileType !== 'text') return [];
        const lines = textContent.split('\n');
        const linesPerPage = 45; // Roughly an A4 page
        const pages: string[][] = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }
        return pages;
    }, [textContent, fileType]);

    useEffect(() => {
        if (fileType === 'text') {
            setNumPages(textPages.length);
        }
    }, [textPages, fileType]);

    // Notify parent of changes
    useEffect(() => {
        onAnnotationsChange?.(annotations);
    }, [annotations, onAnnotationsChange]);

    // Scroll Observer to track page numbers
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = pageRefs.current.indexOf(entry.target as HTMLDivElement);
                        if (index !== -1) {
                            setPageNumber(index + 1);
                        }
                    }
                });
            },
            { threshold: 0.5, root: containerRef.current }
        );

        pageRefs.current.forEach((ref) => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, [numPages, fileType]);

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
        if (!isWritingMode) return;
        if ((e.target as HTMLElement).closest('input')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        // Adjust for scale
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const newAnnotation: Annotation = {
            id: Math.random().toString(36).substr(2, 9),
            pageNumber: pageNum,
            x,
            y,
            text: ""
        };

        setAnnotations([...annotations, newAnnotation]);
    };

    const updateAnnotation = (id: string, text: string) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
    };

    const removeAnnotation = (id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = `data:application/${fileType === 'pdf' ? 'pdf' : 'text/plain'};base64,${base64}`;
        link.download = fileName;
        link.click();
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            if (fileType === 'pdf') {
                printWindow.document.write(`
                    <html>
                        <head><title>Stampa PDF</title></head>
                        <body style="margin:0;padding:0;">
                            <embed width="100%" height="100%" src="data:application/pdf;base64,${base64}" type="application/pdf">
                        </body>
                    </html>
                `);
            } else {
                printWindow.document.write(`
                    <html>
                        <head><title>Stampa Testo</title></head>
                        <body style="margin:0;padding:0; font-family: monospace;">
                            <pre style="white-space: pre-wrap; padding: 40px;">${textContent}</pre>
                        </body>
                    </html>
                `);
            }
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };

    const fitToWidth = () => {
        if (containerRef.current) {
            const containerWidth = containerRef.current.clientWidth - 100;
            // Standard A4 width reference
            setScale(containerWidth / 600);
        }
    };

    return (
        <Card className="flex flex-col h-full overflow-hidden bg-[#525659] border-none shadow-none rounded-none relative">
            {/* Top Minimal Studio Header */}
            <div className="h-10 bg-[#1e1e1e] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-white/50 tracking-widest uppercase">Studio Preview</span>
                </div>
                <div className="flex items-center gap-4">
                    <p className="text-[11px] text-white/40 truncate max-w-[300px] font-medium">{fileName}</p>
                </div>
            </div>

            {/* Chromium Replica Toolbar */}
            <div className="h-12 bg-[#323639] flex items-center px-4 shrink-0 text-white shadow-xl z-30 border-b border-black/20">
                <div className="flex items-center gap-4 min-w-[240px]">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                        <Menu className="w-5 h-5" />
                    </Button>
                    <span className="text-sm font-normal truncate opacity-90 max-w-[180px]">{fileName}</span>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1.5 px-3">
                            <input
                                type="text"
                                value={pageNumber}
                                readOnly
                                className="bg-[#1e1e1e] text-white text-xs w-8 h-7 text-center outline-none border-none rounded shadow-inner"
                            />
                            <span className="text-xs text-white/60 font-medium">/ {numPages || 1}</span>
                        </div>

                        <div className="w-px h-6 bg-white/10 mx-3" />

                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                                <Minus className="w-4 h-4" />
                            </Button>
                            <div className="bg-[#1e1e1e] rounded h-7 w-16 flex items-center justify-center shadow-inner">
                                <span className="text-[11px] font-bold text-white/90">{Math.round(scale * 100)}%</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(5, s + 0.1))} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="w-px h-6 bg-white/10 mx-3" />

                        <Button variant="ghost" size="icon" onClick={fitToWidth} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                            <RotateCw className="w-4 h-4" />
                        </Button>

                        <div className="w-px h-6 bg-white/10 mx-3" />

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsWritingMode(!isWritingMode)}
                            className={`h-8 w-8 rounded-full transition-all duration-300 ${isWritingMode ? 'bg-[#4285f4] text-white shadow-lg' : 'text-white/90 hover:bg-white/10'}`}
                            title="Scrivi sulla preview"
                        >
                            <Type className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-1 min-w-[240px] justify-end">
                    <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                        <Download className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handlePrint} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                        <Printer className="w-5 h-5" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 bg-[#323639] border border-white/5 text-white shadow-2xl p-2 rounded-lg">
                            <DropdownMenuLabel className="text-white/30 text-[9px] uppercase font-black px-3 py-1 tracking-widest">Opzioni Anteprima</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <div className="p-3 space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-white/60">FONT SIZE (TEXT/CSV)</span>
                                        <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-blue-400">{fontSize}px</span>
                                    </div>
                                    <Slider
                                        value={[fontSize]}
                                        onValueChange={(v) => setFontSize(v[0])}
                                        min={8}
                                        max={32}
                                        step={1}
                                        className="py-1"
                                    />
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Document Content */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto p-12 flex flex-col items-center bg-[#525659] scroll-smooth"
                style={{ scrollbarColor: '#323639 #525659', scrollbarWidth: 'thin' }}
            >
                {fileType === 'pdf' ? (
                    <Document
                        file={`data:application/pdf;base64,${base64}`}
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="flex flex-col gap-12"
                        loading={
                            <div className="flex flex-col items-center gap-6 mt-32">
                                <div className="w-16 h-16 border-[6px] border-white/5 border-t-white/60 rounded-full animate-spin shadow-2xl" />
                                <span className="text-white/60 text-[10px] font-black tracking-[0.2em] uppercase">Loading PDF Shattering...</span>
                            </div>
                        }
                    >
                        {Array.from(new Array(numPages), (el, index) => (
                            <div
                                key={`page_container_${index + 1}`}
                                ref={el => pageRefs.current[index] = el}
                                className="relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 transform-gpu"
                                style={{
                                    scale: scale,
                                    transformOrigin: 'top center',
                                    transform: `rotate(${rotation}deg)`
                                }}
                            >
                                <div className={`relative ${isWritingMode ? 'cursor-text' : 'cursor-default'}`} onClick={(e) => handleCanvasClick(e, index + 1)}>
                                    <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} className="bg-white" />
                                    {renderAnnotations(index + 1)}
                                </div>
                            </div>
                        ))}
                    </Document>
                ) : (
                    <div className="flex flex-col gap-12">
                        {textPages.map((pageContent, index) => (
                            <div
                                key={`text_page_container_${index + 1}`}
                                ref={el => pageRefs.current[index] = el}
                                className="relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 transform-gpu bg-white"
                                style={{
                                    width: '600px', // A4-ish ratio
                                    minHeight: '840px',
                                    padding: '60px',
                                    scale: scale,
                                    transformOrigin: 'top center',
                                    transform: `rotate(${rotation}deg)`,
                                    fontFamily: 'monospace',
                                    fontSize: `${fontSize}px`,
                                    lineHeight: '1.5'
                                }}
                            >
                                <div className={`relative h-full ${isWritingMode ? 'cursor-text' : 'cursor-default'}`} onClick={(e) => handleCanvasClick(e, index + 1)}>
                                    <pre className="whitespace-pre-wrap text-slate-800">{pageContent.join('\n')}</pre>
                                    {renderAnnotations(index + 1)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );

    function renderAnnotations(pageNum: number) {
        return annotations
            .filter(a => a.pageNumber === pageNum)
            .map((anno) => (
                <div
                    key={anno.id}
                    style={{
                        position: 'absolute',
                        left: `${anno.x}px`,
                        top: `${anno.y}px`,
                        zIndex: 30,
                        transformOrigin: 'left center'
                    }}
                    className="group flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="relative group/field">
                        <input
                            autoFocus
                            value={anno.text}
                            onChange={(e) => updateAnnotation(anno.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
                            className="h-8 min-w-[140px] bg-white/95 backdrop-blur-sm border-b-2 border-blue-500/50 text-blue-900 font-bold shadow-xl text-xs focus:border-blue-500 outline-none px-2 transition-all"
                            placeholder="SCRIVI QUI..."
                        />
                        <div className="absolute -top-4 -left-1 text-[8px] font-black text-blue-500 opacity-0 group-hover/field:opacity-100 transition-opacity">MANUAL OVERRIDE</div>
                    </div>
                    <Button
                        variant="destructive"
                        size="icon"
                        className="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-all bg-red-500 hover:bg-black border-none shadow-lg -translate-x-2 group-hover:translate-x-0"
                        onClick={() => removeAnnotation(anno.id)}
                    >
                        <X className="w-3 h-3 text-white" />
                    </Button>
                </div>
            ));
    }
}
