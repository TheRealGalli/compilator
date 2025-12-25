import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Type, X, Plus, ChevronDown } from 'lucide-react';
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
    const [isWritingMode, setIsWritingMode] = useState(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [fontSize, setFontSize] = useState<number>(14);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Notify parent of changes
    useEffect(() => {
        onAnnotationsChange?.(annotations);
    }, [annotations, onAnnotationsChange]);

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isWritingMode) return;

        // Don't add if clicking an existing input
        if ((e.target as HTMLElement).closest('input')) return;

        const rect = e.currentTarget.getBoundingClientRect();
        // Since we are using native toolbar, we don't have scale state easily.
        // We'll assume 1:1 for now or use a fixed width container.
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);

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

    const base64ToBlob = (base64: string, mimeType: string) => {
        try {
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        } catch (e) {
            console.error("Base64 decode failed", e);
            return new Blob([], { type: mimeType });
        }
    };

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        const blob = base64ToBlob(base64, 'application/pdf');
        const url = URL.createObjectURL(blob);
        // USE NATIVE TOOLBAR AS REQUESTED (#toolbar=1)
        setPdfUrl(url + '#toolbar=1&navpanes=0&scrollbar=1');
        return () => {
            URL.revokeObjectURL(url);
            setPdfUrl(null);
        };
    }, [base64]);

    return (
        <Card className="flex flex-col h-full overflow-hidden bg-background border-border shadow-2xl relative">
            {/* Native-Style Header Bar (Matches Photo 1) */}
            <div className="h-10 bg-[#1e1e1e] flex items-center justify-between px-4 z-20">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white/90">Studio Preview</span>

                    {/* Minimalist Annotation Toggle */}
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsWritingMode(!isWritingMode)}
                        className={`h-7 px-2 gap-2 text-[10px] hover:bg-white/10 ${isWritingMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'text-white/60'}`}
                    >
                        <Type className="w-3.5 h-3.5" />
                        {isWritingMode ? 'MODALITÀ SCRITTURA' : 'SCRIVI SU PDF'}
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <p className="text-[11px] text-white/40 truncate max-w-[300px]">{fileName}</p>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/10 gap-1 h-7 px-2 px-1">
                                <ChevronDown className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                            <DropdownMenuLabel>Impostazioni</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-foreground">Font Size (TXT/CSV)</span>
                                        <span className="text-xs text-muted-foreground">{fontSize}px</span>
                                    </div>
                                    <Slider
                                        value={[fontSize]}
                                        onValueChange={(v) => setFontSize(v[0])}
                                        min={8}
                                        max={32}
                                        step={1}
                                    />
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Writing Mode Overlay Notification */}
            {isWritingMode && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Plus className="w-3 h-3" />
                    MODALITÀ SCRITTURA ATTIVA: Clicca sul PDF per aggiungere testo
                </div>
            )}

            {/* PDF Content Area */}
            <div className="flex-1 bg-[#525659] relative overflow-hidden">
                <div
                    ref={containerRef}
                    onClick={handleCanvasClick}
                    className={`h-full w-full relative ${isWritingMode ? 'cursor-text' : 'cursor-default'}`}
                >
                    {/* Transparent interaction layer for clicks (only when writing) */}
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
                            className={`w-full h-full border-0 ${isWritingMode ? 'pointer-events-none' : 'pointer-events-auto'}`}
                            title={fileName}
                        />
                    )}
                </div>
            </div>
        </Card>
    );
}
