import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';

interface PDFViewerProps {
    base64: string;
    fileName: string;
}

export function PDFViewer({ base64, fileName }: PDFViewerProps) {
    const [scale, setScale] = useState<number>(100);

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

    // Convert base64 to blob
    const base64ToBlob = (base64: string, mimeType: string) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    };

    // Create data URL for iframe
    const pdfDataUrl = `data:application/pdf;base64,${base64}`;

    return (
        <Card className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-4 py-3 bg-muted/30 flex items-center justify-between flex-shrink-0">
                <h3 className="text-sm font-semibold">Studio Preview</h3>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{fileName}</p>
            </div>

            {/* PDF Display with iframe */}
            <div className="flex-1 overflow-hidden bg-muted/10" style={{ transform: `scale(${scale / 100})`, transformOrigin: 'top center' }}>
                <iframe
                    src={pdfDataUrl}
                    className="w-full h-full border-0"
                    title={fileName}
                    style={{ minHeight: '100%' }}
                />
            </div>

            {/* Controls */}
            <div className="border-t px-4 py-3 bg-muted/20 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Zoom: {scale}%</span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={zoomOut}
                        disabled={scale <= 50}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={zoomIn}
                        disabled={scale >= 200}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownload}
                    >
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
