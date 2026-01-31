import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Download,
    Printer,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    RotateCw,
    MoreVertical,
    Loader2,
    Asterisk,
    AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Use a more reliable worker source
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Global styles are imported in main.tsx

interface PdfPreviewProps {
    fileBase64: string;
    className?: string;
}

export function PdfPreview({ fileBase64, className }: PdfPreviewProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [rotation, setRotation] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isDocumentLoading, setIsDocumentLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isEyeSpinning, setIsEyeSpinning] = useState(false);

    useEffect(() => {
        if (!fileBase64) return;
        setIsLoading(true);
        setError(null);

        try {
            const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([byteNumbers], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        } catch (e) {
            console.error("Error creating PDF blob:", e);
            setError("Errore nella decodifica del PDF.");
            setIsLoading(false);
        }
    }, [fileBase64]);

    const handleEyeClick = () => {
        setIsEyeSpinning(true);
        setTimeout(() => setIsEyeSpinning(false), 1000);
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
        setIsDocumentLoading(false);
        // Fallback for Page rendering
        setTimeout(() => setIsLoading(false), 1000);
    }

    function onDocumentLoadError(err: Error) {
        console.error("Error loading PDF document:", err);
        setError("Impossibile caricare il PDF. Il file potrebbe essere corrotto o non supportato.");
        setIsLoading(false);
    }

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages));
    };

    const handleDownload = () => {
        if (blobUrl) {
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = "document.pdf";
            link.click();
        } else if (fileBase64) {
            const link = document.createElement('a');
            link.href = fileBase64.startsWith('data:') ? fileBase64 : `data:application/pdf;base64,${fileBase64}`;
            link.download = "document.pdf";
            link.click();
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const printSrc = blobUrl || (fileBase64.startsWith('data:') ? fileBase64 : `data:application/pdf;base64,${fileBase64}`);
            if (printSrc) {
                printWindow.document.write(`
                    <html>
                        <body style="margin:0;">
                            <embed width="100%" height="100%" src="${printSrc}" type="application/pdf" />
                        </body>
                    </html>
                `);
                printWindow.document.close();
                setTimeout(() => printWindow.print(), 500);
            }
        }
    };

    return (
        <Card className={`relative flex flex-col h-full overflow-hidden border-none shadow-none bg-slate-900/5 ${className}`}>
            {/* Custom Toolbar - Matching ModeSettings style */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30 border-b select-none z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium truncate max-w-[200px]">
                        Documento PDF
                    </span>
                    <div className="h-4 w-[1px] bg-border hidden sm:block" />
                    <div className="flex items-center gap-1 bg-background/50 rounded px-2">
                        <Input
                            value={pageNumber}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 1 && val <= numPages) setPageNumber(val);
                            }}
                            className="w-10 h-7 bg-transparent border-none text-center p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <span className="text-[10px] opacity-60">/ {numPages}</span>
                    </div>
                    <span className="text-[9px] opacity-30 px-1 border rounded border-border hidden lg:block select-none">v3.5-resurrection-fix</span>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 hidden md:flex">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[10px] font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.min(3, s + 0.1))}>
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 hidden sm:flex" onClick={() => setRotation(r => (r + 90) % 360)}>
                        <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                    <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
                        <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrint}>
                        <Printer className="h-3.5 w-3.5" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setScale(1.0)}>
                                Adatta alla pagina
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setRotation(r => (r + 180) % 360)}>
                                Capovolgi
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="h-4 w-[1px] bg-border mx-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 flex items-center justify-center group/eye"
                        onClick={handleEyeClick}
                        title="Gromit Assist"
                    >
                        <div className="relative flex items-center justify-center">
                            <Asterisk
                                className={`text-blue-500 transition-transform duration-1000 ${isEyeSpinning ? 'rotate-[360deg]' : ''}`}
                                size={26}
                                strokeWidth={3}
                            />
                        </div>
                    </Button>
                </div>
            </div>

            {/* Pagination Controls Floating */}
            {!error && !isLoading && numPages > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur rounded-full px-3 py-1 shadow-lg z-20 border opacity-90 hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
                        <ChevronLeft className="h-4 h-4" />
                    </Button>
                    <span className="text-[10px] font-medium px-2 min-w-[60px] text-center">
                        {pageNumber} / {numPages}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => changePage(1)} disabled={pageNumber >= numPages}>
                        <ChevronRight className="h-4 h-4" />
                    </Button>
                </div>
            )}

            {/* PDF Viewport */}
            <div className="flex-1 overflow-auto bg-slate-100 flex justify-center p-4 scrollbar-thin group relative">
                <div className="h-fit">
                    {(isDocumentLoading || !blobUrl) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                            <p className="text-xs text-muted-foreground">Inizializzazione PDF...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10 p-6 text-center">
                            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
                            <p className="text-sm font-medium mb-1">{error}</p>
                            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                                Ricarica Pagina
                            </Button>
                        </div>
                    )}

                    {blobUrl && (
                        <Document
                            file={blobUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            options={{
                                cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                cMapPacked: true,
                                standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
                                enableXfa: false,
                            }}
                            loading={null}
                        >
                            <Page
                                key={`${pageNumber}-${scale}-${rotation}`}
                                pageNumber={pageNumber}
                                scale={scale}
                                rotate={rotation}
                                renderAnnotationLayer={true}
                                renderForms={true}
                                renderTextLayer={false}
                                onRenderSuccess={() => setIsLoading(false)}
                                className="shadow-2xl"
                                loading={null}
                            />
                        </Document>
                    )}
                </div>
            </div>

        </Card>
    );
}
