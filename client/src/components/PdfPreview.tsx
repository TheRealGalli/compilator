import { useState, useEffect, useMemo } from 'react';
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
    Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Set up worker for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// Necessary styles for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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

    const fileData = useMemo(() => {
        if (!fileBase64) return null;
        try {
            const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            return new Uint8Array(byteNumbers);
        } catch (e) {
            console.error("Error decoding base64 PDF:", e);
            return null;
        }
    }, [fileBase64]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setIsLoading(false);
    }

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages));
    };

    const handleDownload = () => {
        if (!fileBase64) return;
        const link = document.createElement('a');
        link.href = fileBase64.startsWith('data:') ? fileBase64 : `data:application/pdf;base64,${fileBase64}`;
        link.download = "document.pdf";
        link.click();
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && fileBase64) {
            const base64Data = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
            printWindow.document.write(`
                <html>
                    <body style="margin:0;">
                        <embed width="100%" height="100%" src="data:application/pdf;base64,${base64Data}" type="application/pdf" />
                    </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        }
    };

    return (
        <Card className={`relative flex flex-col h-full overflow-hidden border-none shadow-none bg-slate-900/5 ${className}`}>
            {/* Custom Chrome-style Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-100 border-b border-slate-700 select-none z-10 shadow-md">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium opacity-90 truncate max-w-[200px]">
                        Documento PDF
                    </span>
                    <div className="h-4 w-[1px] bg-slate-600 hidden sm:block" />
                    <div className="flex items-center gap-1 bg-slate-900/50 rounded px-2">
                        <Input
                            value={pageNumber}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 1 && val <= numPages) setPageNumber(val);
                            }}
                            className="w-10 h-7 bg-transparent border-none text-center p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <span className="text-xs opacity-60">/ {numPages}</span>
                    </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 hidden md:flex">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-100 hover:bg-slate-700" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-100 hover:bg-slate-700" onClick={() => setScale(s => Math.min(3, s + 0.1))}>
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-100 hover:bg-slate-700 sm:flex hidden" onClick={() => setRotation(r => (r + 90) % 360)}>
                        <RotateCw className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-[1px] bg-slate-600 mx-1 hidden sm:block" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-100 hover:bg-slate-700" onClick={handleDownload}>
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-100 hover:bg-slate-700" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-100 hover:bg-slate-700">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700 text-slate-100">
                            <DropdownMenuItem className="focus:bg-slate-700 cursor-pointer" onClick={() => setScale(1.0)}>
                                Adatta alla pagina
                            </DropdownMenuItem>
                            <DropdownMenuItem className="focus:bg-slate-700 cursor-pointer" onClick={() => setRotation(r => (r + 180) % 360)}>
                                Capovolgi
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="h-4 w-[1px] bg-slate-600 mx-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:bg-blue-400/10 hover:text-blue-300 transition-colors"
                        title="Gromit Assist"
                    >
                        <Eye className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Pagination Controls Floating */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800/90 backdrop-blur text-slate-100 rounded-full px-3 py-1.5 shadow-2xl z-20 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-700" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-xs font-medium px-2 min-w-[60px] text-center">
                    Pagina {pageNumber} di {numPages}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-700" onClick={() => changePage(1)} disabled={pageNumber >= numPages}>
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            {/* PDF Viewport */}
            <div className="flex-1 overflow-auto bg-slate-900/50 flex justify-center p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent group">
                <div className="shadow-2xl h-fit ring-1 ring-slate-700/50">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm z-10">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        </div>
                    )}
                    {fileData && (
                        <Document
                            file={{ data: fileData }}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={null}
                            className="max-w-full"
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={scale}
                                rotate={rotation}
                                renderAnnotationLayer={true}
                                renderTextLayer={true}
                                className="transition-transform duration-200"
                                loading={
                                    <div className="flex items-center justify-center min-w-[300px] min-h-[400px]">
                                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                                    </div>
                                }
                            />
                        </Document>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .react-pdf__Page__canvas {
                    margin: 0 auto;
                    max-width: 100%;
                    height: auto !important;
                }
                .react-pdf__Page__annotations.annotationLayer {
                    padding: 0;
                }
                /* Custom scrollbar for premium feel */
                ::-webkit-scrollbar {
                    width: 8px;
                    height: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            ` }} />
        </Card>
    );
}
