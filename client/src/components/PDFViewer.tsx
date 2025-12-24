import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFViewerProps {
    base64: string;
    fileName: string;
}

export function PDFViewer({ base64, fileName }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.0);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

    const goToPrevPage = () => {
        setPageNumber((prev) => Math.max(prev - 1, 1));
    };

    const goToNextPage = () => {
        setPageNumber((prev) => Math.min(prev + 1, numPages));
    };

    const zoomIn = () => {
        setScale((prev) => Math.min(prev + 0.2, 2.0));
    };

    const zoomOut = () => {
        setScale((prev) => Math.max(prev - 0.2, 0.5));
    };

    // Convert base64 to data URL
    const pdfDataUrl = `data:application/pdf;base64,${base64}`;

    return (
        <Card className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-4 py-3 bg-muted/30 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-semibold">Studio Preview</h3>
                <p className="text-xs text-muted-foreground">{fileName}</p>
            </div>

            {/* PDF Display */}
            <div className="flex-1 overflow-auto bg-muted/10 flex items-center justify-center p-4">
                <Document
                    file={pdfDataUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                        <div className="flex items-center justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    }
                    error={
                        <div className="text-center p-8">
                            <p className="text-sm text-destructive">Errore nel caricamento del PDF</p>
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-lg"
                    />
                </Document>
            </div>

            {/* Controls */}
            <div className="border-t px-4 py-3 bg-muted/20 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">
                        Pagina {pageNumber} di {numPages}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={goToNextPage}
                        disabled={pageNumber >= numPages}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">{Math.round(scale * 100)}%</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={zoomIn}
                        disabled={scale >= 2.0}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
