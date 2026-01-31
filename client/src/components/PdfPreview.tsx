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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Use a more reliable worker source
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Global styles are imported in main.tsx

interface PdfPreviewProps {
    fileBase64: string;
    className?: string;
    selectedSources?: any[];
    notes?: string;
    webResearch?: boolean;
    modelProvider?: string;
}

export function PdfPreview({
    fileBase64,
    className,
    selectedSources = [],
    notes = "",
    webResearch = false,
    modelProvider = 'gemini'
}: PdfPreviewProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [rotation, setRotation] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isDocumentLoading, setIsDocumentLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const { toast } = useToast();
    const [isEyeSpinning, setIsEyeSpinning] = useState(false);
    const [isCompiling, setIsCompiling] = useState(false);
    const [proposals, setProposals] = useState<any[]>([]);
    const [cacheKey, setCacheKey] = useState<string | null>(null);

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

    const applyProposalsToDom = (propsList: any[]) => {
        if (!propsList || propsList.length === 0) return;

        console.log(`[PdfPreview] Applying ${propsList.length} proposals to DOM for page ${pageNumber}...`);

        let fillCount = 0;
        propsList.forEach((p: any) => {
            const elements = document.getElementsByName(p.name);

            if (elements && elements.length > 0) {
                try {
                    const el = elements[0] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

                    if (el.type === 'checkbox') {
                        const shouldBeChecked = p.value === true || String(p.value).toLowerCase() === 'true' || p.value === '1';
                        if ((el as HTMLInputElement).checked !== shouldBeChecked) {
                            (el as HTMLInputElement).checked = shouldBeChecked;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    } else if (el.type === 'radio') {
                        const radioGroup = document.getElementsByName(p.name);
                        for (let i = 0; i < radioGroup.length; i++) {
                            const radio = radioGroup[i] as HTMLInputElement;
                            if (radio.value === String(p.value)) {
                                radio.checked = true;
                                radio.dispatchEvent(new Event('change', { bubbles: true }));
                                break;
                            }
                        }
                    } else {
                        if (el.value !== String(p.value)) {
                            el.value = String(p.value);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    fillCount++;
                } catch (e) {
                    console.warn(`[PdfPreview] Error filling field ${p.name}:`, e);
                }
            }
        });

        console.log(`[PdfPreview] Local Page Fill: Success for ${fillCount} fields.`);
    };

    const handleEyeClick = async () => {
        if (isCompiling || !fileBase64) return;

        setIsCompiling(true);

        try {
            console.log("[PdfPreview] Starting discovery...");
            // 1. Discover Fields
            const discoverRes = await apiRequest('POST', '/api/pdf/discover-fields', {
                masterSource: {
                    base64: fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64,
                    type: 'application/pdf',
                    name: 'Master.pdf'
                }
            });
            const { fields, cacheKey: newCacheKey } = await discoverRes.json();
            setCacheKey(newCacheKey);

            if (!fields || fields.length === 0) {
                toast({
                    title: "Nessun campo rilevato",
                    description: "Il PDF non sembra contenere campi compilabili (AcroForms).",
                    variant: "destructive"
                });
                return;
            }

            console.log(`[PdfPreview] Fields discovered: ${fields.length}. Requesting proposals...`);

            // 2. Propose Values
            const proposeRes = await apiRequest('POST', '/api/pdf/propose-values', {
                fields,
                cacheKey: newCacheKey,
                sources: selectedSources,
                notes,
                webResearch,
                modelProvider
            });
            const { proposals: newProposals } = await proposeRes.json();

            console.log(`[PdfPreview] Proposals received: ${newProposals?.length}`);
            setProposals(newProposals || []);

            // Immediate apply for the current page
            applyProposalsToDom(newProposals || []);

            toast({
                title: "Compilazione completata",
                description: `Gromit ha generato ${newProposals?.length || 0} proposte. Naviga tra le pagine per vederle applicate.`,
            });

        } catch (err: any) {
            console.error("Gromit Assist Error:", err);
            toast({
                title: "Errore Gromit",
                description: err.message || "Impossibile completare la compilazione automatica.",
                variant: "destructive"
            });
        } finally {
            setIsCompiling(false);
        }
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

    const handleDownload = async () => {
        if (!fileBase64) return;

        setIsLoading(true);
        try {
            // 1. Collect all current form values from the DOM
            const fields: Record<string, string | boolean> = {};
            const annotationLayer = document.querySelector('.annotationLayer');
            if (annotationLayer) {
                const inputs = annotationLayer.querySelectorAll('input, textarea, select');
                inputs.forEach((el: any) => {
                    if (el.name) {
                        if (el.type === 'checkbox') {
                            fields[el.name] = el.checked;
                        } else if (el.type === 'radio') {
                            if (el.checked) fields[el.name] = el.value;
                        } else {
                            fields[el.name] = el.value;
                        }
                    }
                });
            }

            // 2. Finalize on server
            const base64Clean = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
            const res = await apiRequest('POST', '/api/pdf/finalize', {
                masterSource: {
                    base64: base64Clean,
                    type: 'application/pdf',
                    name: 'documento.pdf'
                },
                values: fields
            });
            const { base64: filledBase64, name } = await res.json();

            // 3. Trigger download
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${filledBase64}`;
            link.download = name || "documento_compilato.pdf";
            link.click();

            toast({
                title: "Download completato",
                description: "Il PDF compilato è pronto.",
            });
        } catch (err: any) {
            console.error("Download Error:", err);
            toast({
                title: "Errore Download",
                description: err.message || "Impossibile generare il PDF compilato.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
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

                    <div className="h-4 w-[1px] bg-border mx-1" />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 flex items-center justify-center group/eye"
                        onClick={handleEyeClick}
                        disabled={isCompiling}
                        title="Gromit Assist"
                    >
                        <div className="relative flex items-center justify-center">
                            <Asterisk
                                className={`text-blue-500 transition-transform ${isCompiling ? 'animate-spin' : isEyeSpinning ? 'rotate-[720deg] duration-[2000ms] ease-in-out' : ''}`}
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
                                onRenderSuccess={() => {
                                    console.log(`[PdfPreview] Page ${pageNumber} rendered. Applying proposals...`);
                                    applyProposalsToDom(proposals);
                                    setIsLoading(false);
                                }}
                                className={`shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                                loading={null}
                            />
                        </Document>
                    )}
                </div>
            </div>
        </Card>
    );
}
