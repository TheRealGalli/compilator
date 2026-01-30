import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card } from "@/components/ui/card";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Set worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewProps {
    fileBase64: string;
    className?: string;
}

export function PdfPreview({ fileBase64, className }: PdfPreviewProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <Card className={`relative flex flex-col h-full bg-muted/20 border-none overflow-hidden ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-background/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                        disabled={pageNumber <= 1}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-medium px-2">
                        Pagina {pageNumber} di {numPages || '--'}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || prev))}
                        disabled={numPages === null || pageNumber >= numPages}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setScale(prev => Math.max(prev - 0.2, 0.5))}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-[10px] font-bold w-12 text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setScale(prev => Math.min(prev + 0.2, 3.0))}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Document View */}
            <div className="flex-1 overflow-auto p-4 flex justify-center items-start scrollbar-hide bg-slate-100 dark:bg-slate-900/50">
                <Document
                    file={`data:application/pdf;base64,${fileBase64}`}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                        <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Caricamento PDF...</span>
                        </div>
                    }
                    error={
                        <div className="p-4 text-center text-red-500">
                            Errore nel caricamento del PDF.
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        className="shadow-2xl border border-border/50"
                    />
                </Document>
            </div>
        </Card>
    );
}
