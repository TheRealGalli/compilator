import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Download, Menu, Type, ChevronDown, Printer, RotateCw, X, Plus } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";

interface Annotation {
    id: string;
    x: number;
    y: number;
    text: string;
}

interface PDFViewerProps {
    base64: string;
    fileName: string;
    onAnnotationsChange?: (annotations: Annotation[]) => void;
}

export function PDFViewer({ base64, fileName, onAnnotationsChange }: PDFViewerProps) {
    const [scale, setScale] = useState<number>(100);
    const [fontSize, setFontSize] = useState<number>(14);
    const [rotation, setRotation] = useState<number>(0);
    const [isWritingMode, setIsWritingMode] = useState(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Notify parent of changes
    useEffect(() => {
        onAnnotationsChange?.(annotations);
    }, [annotations, onAnnotationsChange]);

    const zoomIn = () => {
        setScale((prev) => Math.min(prev + 10, 200));
    };

    const zoomOut = () => {
        setScale((prev) => Math.max(prev - 10, 50));
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isWritingMode) return;

        // Don't add if clicking an existing input
        if ((e.target as HTMLElement).closest('input')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / (scale / 100));
        const y = ((e.clientY - rect.top) / (scale / 100));

        const newAnnotation: Annotation = {
            id: Math.random().toString(36).substr(2, 9),
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

    const handlePrint = () => {
        try {
            if (iframeRef.current) {
                iframeRef.current.contentWindow?.focus();
                iframeRef.current.contentWindow?.print();
            }
        } catch (error) {
            console.error('Print failed:', error);
            if (pdfUrl) {
                const printWindow = window.open(pdfUrl);
                printWindow?.addEventListener('load', () => {
                    printWindow.print();
                });
            }
        }
    };

    const handleDownload = () => {
        try {
            const blob = base64ToBlob(base64, 'application/pdf');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const base64ToBlob = (base64: string, mimeType: string) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    };

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        const blob = base64ToBlob(base64, 'application/pdf');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url + '#toolbar=0&navpanes=0&scrollbar=0');
        return () => {
            URL.revokeObjectURL(url);
            setPdfUrl(null);
        };
    }, [base64]);

    return (
        <Card className="flex flex-col h-full overflow-hidden bg-background border-border shadow-2xl relative">
            {/* Custom Pro Toolbar */}
            <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4 flex-shrink-0 z-20">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                    <Menu className="w-4 h-4" />
                </Button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Annotation Toggle (Writing Mode) */}
                <Button
                    variant={isWritingMode ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setIsWritingMode(!isWritingMode)}
                    className={`gap-2 h-8 px-3 transition-all ${isWritingMode ? 'bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-500' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
                >
                    <Type className="w-4 h-4" />
                    <span className="text-xs">{isWritingMode ? 'Smetti di scrivere' : 'Scrivi sul PDF'}</span>
                </Button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800 gap-2 h-8 px-2 font-normal">
                            <span className="text-xs">Impostazioni</span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <DropdownMenuLabel>Personalizza Anteprima</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-foreground">Dimensione (Solo Testo)</span>
                                    <span className="text-xs text-muted-foreground">{fontSize}px</span>
                                </div>
                                <Slider
                                    value={[fontSize]}
                                    onValueChange={(v) => setFontSize(v[0])}
                                    min={8}
                                    max={32}
                                    step={1}
                                />
                                <p className="text-[10px] text-muted-foreground italic">Nota: Le impostazioni font si applicano alle fonti .txt e .csv</p>
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex-1 overflow-hidden">
                    <p className="text-xs text-slate-400 truncate text-center font-medium">{fileName}</p>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={handleRotate} title="Ruota Documento" className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <RotateCw className="w-4 h-4" />
                    </Button>
                    <div className="h-4 w-px bg-slate-800 mx-1" />

                    <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 50} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-[10px] text-slate-500 font-mono w-10 text-center">{scale}%</span>
                    <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 200} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <ZoomIn className="w-4 h-4" />
                    </Button>

                    <div className="h-4 w-px bg-slate-800 mx-1" />

                    <Button variant="ghost" size="icon" onClick={handlePrint} title="Stampa" className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <Printer className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDownload} title="Scarica" className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Writing Mode Overlay Notification */}
            {isWritingMode && (
                <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Plus className="w-3 h-3" />
                    MODALITÀ SCRITTURA ATTIVA: Clicca sul PDF per aggiungere testo
                </div>
            )}

            {/* PDF Canvas area */}
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-800 relative scrollbar-thin">
                <div
                    ref={containerRef}
                    onClick={handleCanvasClick}
                    className={`relative mx-auto my-4 shadow-xl transition-all duration-300 transform-gpu ${isWritingMode ? 'cursor-text' : 'cursor-default'}`}
                    style={{
                        transform: `scale(${scale / 100}) rotate(${rotation}deg)`,
                        transformOrigin: 'top center',
                        width: '800px', // Standard PDF width approximation
                        minHeight: '1100px',
                        backgroundColor: 'white'
                    }}
                >
                    {/* Interaction layer for clicks */}
                    {isWritingMode && (
                        <div className="absolute inset-0 z-10 bg-indigo-500/5" />
                    )}

                    {/* Render Annotations */}
                    {annotations.map((anno) => (
                        <div
                            key={anno.id}
                            style={{
                                position: 'absolute',
                                left: `${anno.x}px`,
                                top: `${anno.y}px`,
                                zIndex: 30,
                                transform: 'translate(-5px, -50%)'
                            }}
                            className="group flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Input
                                autoFocus
                                value={anno.text}
                                onChange={(e) => updateAnnotation(anno.id, e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
                                className="h-7 min-w-[120px] bg-white border-indigo-400 text-indigo-900 font-semibold shadow-sm text-xs focus-visible:ring-indigo-500 p-1 rounded-sm"
                                placeholder="Scrivi qui..."
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeAnnotation(anno.id)}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    ))}

                    {pdfUrl && (
                        <iframe
                            ref={iframeRef}
                            src={pdfUrl}
                            className={`w-full h-full border-0 absolute inset-0 ${isWritingMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
                            title={fileName}
                            style={{ minHeight: '100%' }}
                        />
                    )}
                </div>
            </div>
        </Card>
    );
}
