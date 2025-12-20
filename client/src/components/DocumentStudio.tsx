import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Download, Wand2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

// Setup pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DiscoveredField {
    name: string;
    boundingPoly: {
        vertices: { x: number; y: number }[];
        normalizedVertices?: { x: number; y: number }[];
    };
    pageIndex: number;
    value?: string;
}

interface DocumentStudioProps {
    pdfBase64: string;
    fileName: string;
    onDownload: (filledFields: DiscoveredField[]) => void;
    isProcessing?: boolean;
}

export function DocumentStudio({ pdfBase64, fileName, onDownload, isProcessing = false }: DocumentStudioProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [fields, setFields] = useState<DiscoveredField[]>([]);
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const { toast } = useToast();
    const pdfContainerRef = useRef<HTMLDivElement>(null);

    // Load fields from backend when PDF changes
    useEffect(() => {
        if (pdfBase64) {
            analyzeLayout();
        }
    }, [pdfBase64]);

    const analyzeLayout = async () => {
        setIsLoadingFields(true);
        try {
            const { getApiUrl } = await import("@/lib/api-config");
            const response = await fetch(getApiUrl('/api/analyze-layout'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64: pdfBase64 })
            });

            const data = await response.json();
            if (data.fields) {
                setFields(data.fields.map((f: any) => ({ ...f, value: "" })));
            }
        } catch (error) {
            console.error("Layout analysis failed:", error);
        } finally {
            setIsLoadingFields(false);
        }
    };

    const handleFieldChange = (index: number, value: string) => {
        const newFields = [...fields];
        newFields[index].value = value;
        setFields(newFields);
    };

    const handleAiFill = async () => {
        if (isFilling) return;
        setIsFilling(true);
        try {
            const { apiRequest } = await import("@/lib/queryClient");
            const response = await apiRequest('POST', '/api/compile', {
                fillingMode: 'studio',
                fields: fields.map(f => f.name),
                pdfBase64: pdfBase64
            });

            const data = await response.json();
            if (data.values) {
                // "Type" effect
                const keys = Object.keys(data.values);
                for (const key of keys) {
                    const index = fields.findIndex(f => f.name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(f.name.toLowerCase()));
                    if (index !== -1) {
                        handleFieldChange(index, data.values[key]);
                        await new Promise(r => setTimeout(r, 100)); // Visual spacing
                    }
                }
            }
        } catch (error) {
            console.error("AI filling failed:", error);
        } finally {
            setIsFilling(false);
        }
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="flex-shrink-0 px-0 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <Sparkles className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Document Studio</CardTitle>
                            <p className="text-xs text-muted-foreground">{fileName}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAiFill}
                            disabled={isLoadingFields || isFilling || fields.length === 0}
                            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                            <Wand2 className={`w-4 h-4 ${isFilling ? 'animate-pulse' : ''}`} />
                            Compila con AI
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => onDownload(fields)}
                            disabled={fields.length === 0}
                            className="gap-2 bg-blue-600 hover:bg-blue-700"
                        >
                            <Download className="w-4 h-4" />
                            Scarica PDF
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Left Pane: PDF Viewer with Overlay */}
                <div className="lg:col-span-8 bg-muted/30 rounded-xl overflow-hidden relative flex justify-center p-4 border shadow-inner">
                    <ScrollArea className="h-full w-full">
                        <div className="flex flex-col items-center gap-4 relative" ref={pdfContainerRef}>
                            <Document
                                file={`data:application/pdf;base64,${pdfBase64}`}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={<Skeleton className="w-[600px] h-[800px]" />}
                            >
                                {Array.from(new Array(numPages), (el, index) => (
                                    <div key={`page_${index + 1}`} className="relative shadow-2xl mb-8 bg-white overflow-hidden">
                                        <Page
                                            pageNumber={index + 1}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            width={600}
                                        />
                                        {/* Overlay Layer */}
                                        <div className="absolute inset-0 pointer-events-none">
                                            {fields.filter(f => f.pageIndex === index).map((field, fIdx) => {
                                                const v = field.boundingPoly.normalizedVertices || field.boundingPoly.vertices;
                                                if (!v || v.length < 1) return null;

                                                // Determine position (assuming 0-1 scale for normalized)
                                                const isNormalized = !!field.boundingPoly.normalizedVertices;
                                                const left = isNormalized ? v[0].x * 100 : (v[0].x / 1000) * 100;
                                                const top = isNormalized ? v[0].y * 100 : (v[0].y / 1000) * 100;

                                                return (
                                                    <div
                                                        key={`overlay_${fIdx}`}
                                                        className="absolute text-[10px] text-blue-900 font-medium whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-500"
                                                        style={{
                                                            left: `${left}%`,
                                                            top: `${top}%`,
                                                            transform: 'translateY(-100%)' // Move text above the coordinate
                                                        }}
                                                    >
                                                        {field.value}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </Document>
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Pane: Field List */}
                <div className="lg:col-span-4 flex flex-col min-h-0 bg-white rounded-xl border p-4 shadow-sm">
                    <div className="text-sm font-semibold mb-3 border-b pb-2 flex items-center justify-between">
                        Campi Identificati
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-normal">
                            {fields.length} trovati
                        </span>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="space-y-4 pr-3">
                            {isLoadingFields ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full" />
                                ))
                            ) : fields.length > 0 ? (
                                fields.map((field, idx) => (
                                    <div key={idx} className="space-y-1 group">
                                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                                            {field.name}
                                        </label>
                                        <div className="relative">
                                            <Input
                                                value={field.value}
                                                onChange={(e) => handleFieldChange(idx, e.target.value)}
                                                className="h-9 text-sm focus:ring-blue-500/20"
                                                placeholder={`Inserisci ${field.name.toLowerCase()}...`}
                                            />
                                            {field.value && (
                                                <Check className="w-3 h-3 text-green-500 absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                                    <div className="p-3 bg-muted/50 rounded-full">
                                        <X className="w-6 h-6 opacity-20" />
                                    </div>
                                    <p className="text-xs">Nessun campo rilevabile.<br />Usa Documenti standard o PDF carichi.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </Card>
    );
}
