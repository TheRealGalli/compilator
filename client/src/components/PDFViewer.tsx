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
    fontFamily: string;
    fontSize: number;
    color: string;
    isBold: boolean;
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
    const [isWritingMode, setIsWritingMode] = useState(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);

    // Editor Settings
    const [currentFont, setCurrentFont] = useState("Inter");
    const [currentSize, setCurrentSize] = useState(14);
    const [currentColor, setCurrentColor] = useState("#1e3a8a"); // Default blue-900
    const [isBold, setIsBold] = useState(true);

    // Paperclip UX & Drag States
    const [mousePos, setMousePos] = useState<{ x: number, y: number, pageNum: number } | null>(null);
    const [lockedAnnotationId, setLockedAnnotationId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [hasDragged, setHasDragged] = useState(false);

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

    // Global Mouse Up to handle drag stop
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setDraggingId(null);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

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
        if (!isWritingMode) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        // Handle Dragging
        if (draggingId) {
            setHasDragged(true);
            setAnnotations(prev => prev.map(a =>
                a.id === draggingId ? { ...a, x, y, pageNumber: pageNum } : a
            ));
            return;
        }

        // Handle Paperclip Tracking (only if not locked)
        if (!lockedAnnotationId) {
            setMousePos({ x, y, pageNum });
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
        if (!isWritingMode) return;

        // If we just finished a drag, don't create a new annotation
        if (hasDragged) {
            setHasDragged(false);
            return;
        }

        // If something is already locked, unlock it
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
            text: "",
            fontFamily: currentFont,
            fontSize: currentSize,
            color: currentColor,
            isBold: isBold
        };

        setAnnotations([...annotations, newAnnotation]);
        setLockedAnnotationId(newId);
    };

    const handleAnnotationMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!isWritingMode) return;
        setDraggingId(id);
        setHasDragged(false);
    };

    const handleAnnotationClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!isWritingMode || hasDragged) return;
        setLockedAnnotationId(id);
    };

    const updateAnnotation = (id: string, text: string) => {
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
    };

    const removeAnnotation = (id: string) => {
        setAnnotations(prev => prev.filter(a => a.id !== id));
        if (lockedAnnotationId === id) setLockedAnnotationId(null);
        if (draggingId === id) setDraggingId(null);
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
                    <span className="text-[11px] font-bold text-white/50 tracking-widest uppercase">Studio Editor</span>
                </div>
                <div className="flex items-center gap-4">
                    <p className="text-[11px] text-white/40 truncate max-w-[300px] font-medium">{fileName}</p>
                </div>
            </div>

            {/* Professional Editor Toolbar */}
            <div className="h-14 bg-[#323639] flex items-center px-4 shrink-0 text-white shadow-xl z-30 border-b border-black/20 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 shrink-0 mr-4 border-r border-white/10 pr-4">
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
                        className={`h-9 w-9 rounded-md transition-all ${isWritingMode ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/70 hover:bg-white/10'}`}
                        title="Strumento Testo"
                    >
                        <Type className="w-5 h-5" />
                    </Button>
                </div>

                {isWritingMode && (
                    <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                        {/* Font Family */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-tight">Fonte</span>
                            <select
                                value={currentFont}
                                onChange={(e) => setCurrentFont(e.target.value)}
                                className="bg-[#1e1e1e] text-white text-[11px] h-8 px-2 outline-none border-none rounded shadow-inner min-w-[100px]"
                            >
                                <option value="Inter">Inter</option>
                                <option value="Roboto">Roboto</option>
                                <option value="Courier">Courier</option>
                            </select>
                        </div>

                        {/* Font Size */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/40 font-bold uppercase tracking-tight">Dim.</span>
                            <input
                                type="number"
                                value={currentSize}
                                onChange={(e) => setCurrentSize(Number(e.target.value))}
                                className="bg-[#1e1e1e] text-white text-[11px] h-8 w-12 text-center outline-none border-none rounded shadow-inner"
                            />
                        </div>

                        {/* Color Pickers */}
                        <div className="flex items-center gap-2 px-2 border-l border-white/10">
                            {['#1e3a8a', '#dc2626', '#16a34a', '#000000'].map(color => (
                                <button
                                    key={color}
                                    onClick={() => setCurrentColor(color)}
                                    className={`w-5 h-5 rounded-full border-2 transition-all ${currentColor === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>

                        {/* Bold Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsBold(!isBold)}
                            className={`h-8 w-8 rounded transition-all ${isBold ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10'}`}
                        >
                            <span className="font-bold">B</span>
                        </Button>
                    </div>
                )}

                <div className="flex-1" />

                <div className="flex items-center gap-1 shrink-0 border-l border-white/10 pl-4">
                    <div className="flex items-center gap-1.5 px-3 mr-2">
                        <span className="text-[11px] text-white/40 font-medium">Pagina {pageNumber} / {numPages || 1}</span>
                    </div>
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
                                    transformOrigin: 'top center'
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
                                    fontFamily: 'monospace',
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
                const isDragging = draggingId === anno.id;

                return (
                    <div
                        key={anno.id}
                        style={{
                            position: 'absolute',
                            left: `${anno.x}px`,
                            top: `${anno.y}px`,
                            zIndex: isDragging ? 100 : 30,
                            transform: 'translate(0, -20px)',
                            cursor: !isWritingMode ? 'default' : (isDragging ? 'grabbing' : 'grab')
                        }}
                        className={`group transition-transform active:scale-105 ${isDragging ? 'opacity-70' : ''}`}
                        onMouseDown={(e) => handleAnnotationMouseDown(e, anno.id)}
                        onClick={(e) => handleAnnotationClick(e, anno.id)}
                    >
                        <div className="relative flex items-center">
                            {/* Hidden span to measure text width and drive the container size */}
                            <span
                                className="invisible whitespace-pre px-0 min-h-[1.75rem] min-w-[4px]"
                                style={{
                                    fontFamily: anno.fontFamily,
                                    fontSize: `${anno.fontSize}px`,
                                    fontWeight: anno.isBold ? 'bold' : 'normal'
                                }}
                            >
                                {anno.text}
                            </span>

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
                                className={`absolute inset-0 w-full bg-transparent border-b-2 ${isLocked && anno.text.length > 0 ? 'border-blue-600' : 'border-transparent'} outline-none px-0 transition-all pointer-events-none select-none`}
                                style={{
                                    pointerEvents: isLocked ? 'auto' : 'none',
                                    userSelect: isLocked ? 'auto' : 'none',
                                    fontFamily: anno.fontFamily,
                                    fontSize: `${anno.fontSize}px`,
                                    color: anno.color,
                                    fontWeight: anno.isBold ? 'bold' : 'normal'
                                }}
                                placeholder={isLocked ? "Scrivi..." : ""}
                                readOnly={!isLocked}
                            />

                            {/* Delete button always visible and follows text progression */}
                            <Button
                                variant="destructive"
                                size="icon"
                                className="h-4 w-4 rounded-full absolute -right-6 top-1/2 -translate-y-1/2 transition-all bg-red-500 hover:bg-black border-none shadow-md pointer-events-auto opacity-100"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeAnnotation(anno.id);
                                }}
                            >
                                <X className="w-2.5 h-2.5 text-white" />
                            </Button>
                        </div>
                    </div>
                );
            });
    }
}
