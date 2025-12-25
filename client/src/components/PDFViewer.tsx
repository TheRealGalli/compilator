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
    Maximize2,
    Paperclip
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

    // Paperclip UX States
    const [mousePos, setMousePos] = useState<{ x: number, y: number, pageNum: number } | null>(null);
    const [lockedAnnotationId, setLockedAnnotationId] = useState<string | null>(null);

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

    // Simple "Virtual Paging" for text
    const textPages = useMemo(() => {
        if (fileType !== 'text') return [];
        const lines = textContent.split('\n');
        const linesPerPage = 45;
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

    // Scroll Observer
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

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
        if (!isWritingMode || lockedAnnotationId) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        setMousePos({ x, y, pageNum });
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
        if (!isWritingMode) return;

        // If something is already locked, unlock it and reset paperclip tracking
        if (lockedAnnotationId) {
            setLockedAnnotationId(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        const newId = Math.random().toString(36).substr(2, 9);
        const newAnnotation: Annotation = {
            id: newId,
            pageNumber: pageNum,
            x,
            y,
            text: ""
        };

        setAnnotations([...annotations, newAnnotation]);
        setLockedAnnotationId(newId);
    };

    const updateAnnotation = (id: string, text: string) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
    };

    const removeAnnotation = (id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        if (lockedAnnotationId === id) setLockedAnnotationId(null);
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
                printWindow.document.write(`<html><head><title>Print PDF</title></head><body style="margin:0;"><embed width="100%" height="100%" src="data:application/pdf;base64,${base64}" type="application/pdf"></body></html>`);
            } else {
                printWindow.document.write(`<html><head><title>Print Text</title></head><body style="margin:0;"><pre style="white-space: pre-wrap; padding: 40px;">${textContent}</pre></body></html>`);
            }
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 500);
        }
    };

    const fitToWidth = () => {
        if (containerRef.current) {
            const containerWidth = containerRef.current.clientWidth - 100;
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
                            <input type="text" value={pageNumber} readOnly className="bg-[#1e1e1e] text-white text-xs w-8 h-7 text-center outline-none border-none rounded shadow-inner" />
                            <span className="text-xs text-white/60 font-medium">/ {numPages || 1}</span>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-3" />
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full"><Minus className="w-4 h-4" /></Button>
                            <div className="bg-[#1e1e1e] rounded h-7 w-16 flex items-center justify-center shadow-inner"><span className="text-[11px] font-bold text-white/90">{Math.round(scale * 100)}%</span></div>
                            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(5, s + 0.1))} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full"><Plus className="w-4 h-4" /></Button>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-3" />
                        <Button variant="ghost" size="icon" onClick={fitToWidth} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full"><Maximize2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setRotation(r => (r + 90) % 360)} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full"><RotateCw className="w-4 h-4" /></Button>
                        <div className="w-px h-6 bg-white/10 mx-3" />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setIsWritingMode(!isWritingMode);
                                if (isWritingMode) {
                                    setLockedAnnotationId(null);
                                    setMousePos(null);
                                }
                            }}
                            className={`h-8 w-8 rounded-full transition-all duration-300 ${isWritingMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/90 hover:bg-white/10'}`}
                            title="Scrivi sulla preview"
                        >
                            <Type className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-1 min-w-[240px] justify-end">
                    <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full"><Download className="w-5 h-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={handlePrint} className="h-8 w-8 text-white/90 hover:bg-white/10 rounded-full"><Printer className="w-5 h-5" /></Button>
                </div>
            </div>

            {/* Content Area */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-auto p-12 flex flex-col items-center bg-[#525659] scroll-smooth ${isWritingMode ? 'cursor-text' : 'cursor-default'}`}
                style={{ scrollbarColor: '#323639 #525659', scrollbarWidth: 'thin' }}
            >
                {fileType === 'pdf' ? (
                    <Document
                        file={`data:application/pdf;base64,${base64}`}
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="flex flex-col gap-12"
                    >
                        {Array.from(new Array(numPages), (el, index) => (
                            <div
                                key={`page_container_${index + 1}`}
                                ref={el => pageRefs.current[index] = el}
                                className="relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white transform-gpu"
                                style={{
                                    scale: scale,
                                    transformOrigin: 'top center',
                                    transform: `rotate(${rotation}deg)`
                                }}
                                onMouseMove={(e) => handleMouseMove(e, index + 1)}
                                onClick={(e) => handleCanvasClick(e, index + 1)}
                            >
                                <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} className="bg-white" />
                                {renderAnnotations(index + 1)}
                            </div>
                        ))}
                    </Document>
                ) : (
                    <div className="flex flex-col gap-12">
                        {textPages.map((pageContent, index) => (
                            <div
                                key={`text_page_container_${index + 1}`}
                                ref={el => pageRefs.current[index] = el}
                                className="relative shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-white transform-gpu"
                                style={{
                                    width: '600px',
                                    minHeight: '840px',
                                    padding: '60px',
                                    scale: scale,
                                    transformOrigin: 'top center',
                                    transform: `rotate(${rotation}deg)`,
                                    fontFamily: 'monospace',
                                    fontSize: `${fontSize}px`,
                                }}
                                onMouseMove={(e) => handleMouseMove(e, index + 1)}
                                onClick={(e) => handleCanvasClick(e, index + 1)}
                            >
                                <pre className="whitespace-pre-wrap text-slate-800 leading-relaxed">{pageContent.join('\n')}</pre>
                                {renderAnnotations(index + 1)}
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
            .map((anno) => {
                const isLocked = lockedAnnotationId === anno.id;
                return (
                    <div
                        key={anno.id}
                        style={{
                            position: 'absolute',
                            left: `${anno.x}px`,
                            top: `${anno.y}px`,
                            zIndex: 30,
                            transform: 'translate(0, -100%)' // Aligns text baseline with click point
                        }}
                        className="group"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative">
                            <input
                                autoFocus={isLocked}
                                value={anno.text}
                                onChange={(e) => updateAnnotation(anno.id, e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setLockedAnnotationId(null);
                                        (e.target as HTMLElement).blur();
                                    }
                                }}
                                className={`h-7 min-w-[120px] bg-transparent border-b-2 ${isLocked ? 'border-blue-600' : 'border-transparent'} text-blue-900 font-bold text-sm outline-none px-0 transition-all`}
                                placeholder={isLocked ? "Scrivi qui..." : ""}
                                readOnly={!isLocked}
                            />
                            {isLocked && (
                                <div className="absolute -top-4 left-0 text-[8px] font-black text-blue-600 bg-white/40 px-1 rounded">MANUAL OVERRIDE</div>
                            )}

                            {!isLocked && (
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-4 w-4 rounded-full absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-red-500 hover:bg-black border-none shadow-md"
                                    onClick={() => removeAnnotation(anno.id)}
                                >
                                    <X className="w-2.5 h-2.5 text-white" />
                                </Button>
                            )}
                        </div>
                    </div>
                );
            });
    }
}
