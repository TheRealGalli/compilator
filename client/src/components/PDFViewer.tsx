import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Download, Menu, Type, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

interface PDFViewerProps {
    base64: string;
    fileName: string;
}

export function PDFViewer({ base64, fileName }: PDFViewerProps) {
    const [scale, setScale] = useState<number>(100);
    const [fontSize, setFontSize] = useState<number>(14);

    const zoomIn = () => {
        setScale((prev) => Math.min(prev + 10, 200));
    };

    const zoomOut = () => {
        setScale((prev) => Math.max(prev - 10, 50));
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
        // Hide native toolbar to remove ID, build our own
        setPdfUrl(url + '#toolbar=0&navpanes=0&scrollbar=0');
        return () => {
            URL.revokeObjectURL(url);
            setPdfUrl(null);
        };
    }, [base64]);

    return (
        <Card className="flex flex-col h-full overflow-hidden bg-background border-border shadow-2xl">
            {/* Custom Pro Toolbar */}
            <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4 flex-shrink-0 z-10">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                    <Menu className="w-4 h-4" />
                </Button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Font Settings - Replacing ID area */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800 gap-2 h-8 px-2 font-normal">
                            <Type className="w-4 h-4" />
                            <span className="text-xs">Impostazioni Caratteri</span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <DropdownMenuLabel>Personalizza Anteprima</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">Dimensione Caratteri</span>
                                    <span className="text-xs text-muted-foreground">{fontSize}px</span>
                                </div>
                                <Slider
                                    value={[fontSize]}
                                    onValueChange={(v) => setFontSize(v[0])}
                                    min={8}
                                    max={24}
                                    step={1}
                                />
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex-1 overflow-hidden">
                    <p className="text-xs text-slate-400 truncate text-center font-medium">{fileName}</p>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 50} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-[10px] text-slate-500 font-mono w-10 text-center">{scale}%</span>
                    <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 200} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <div className="h-4 w-px bg-slate-800 mx-1" />
                    <Button variant="ghost" size="icon" onClick={handleDownload} className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* PDF Canvas area */}
            <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 relative">
                <div
                    style={{
                        transform: `scale(${scale / 100})`,
                        transformOrigin: 'top center',
                        height: '100%',
                        width: '100%'
                    }}
                >
                    {pdfUrl && (
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full border-0 select-none pointer-events-auto"
                            title={fileName}
                            style={{ minHeight: '100%' }}
                        />
                    )}
                </div>
            </div>
        </Card>
    );
}

