import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Wand2, X, Check, Sparkles, Star, Asterisk } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useMotionValue, useTransform } from "framer-motion";


// Setup pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

// Helper
const TooltipWrapper = ({ children, text }: { children: React.ReactNode, text: string }) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                {children}
            </TooltipTrigger>
            <TooltipContent>
                <p>{text}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

export interface DiscoveredField {
    name: string;
    fieldType?: 'text' | 'checkbox';
    boundingPoly: {
        vertices: { x: number; y: number }[];
        normalizedVertices?: { x: number; y: number }[];
    };
    pageIndex: number;
    value?: string;
    // Local state for interactive positioning
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    width?: number; // Dynamic width in percentage (0-100)
}

// ... (rest of the file hooks)

interface DocumentStudioProps {
    pdfBase64: string;
    fileName: string;
    onDownload: (filledFields: DiscoveredField[]) => void;
    onCompile: (currentFields: DiscoveredField[]) => void;
    isProcessing?: boolean;
    externalValues?: Record<string, string>;
    onFieldsDiscovered?: (fieldNames: string[]) => void;
    onFieldsChange?: (fields: DiscoveredField[]) => void;
    studioMode?: 'settings' | 'chat';
    onStudioModeChange?: (mode: 'settings' | 'chat') => void;
}

export function DocumentStudio({
    pdfBase64,
    fileName,
    onDownload,
    onCompile,
    isProcessing = false,
    externalValues,
    onFieldsDiscovered,
    onFieldsChange,
    studioMode = 'settings',
    onStudioModeChange
}: DocumentStudioProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [fields, setFields] = useState<DiscoveredField[]>([]);
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
    const [isAddingField, setIsAddingField] = useState(false); // Mode for Star 1
    const { toast } = useToast();
    const pdfContainerRef = useRef<HTMLDivElement>(null);

    // Sync to parent
    useEffect(() => {
        if (onFieldsChange) onFieldsChange(fields);
    }, [fields, onFieldsChange]);

    // Star animations state
    const [star1Rotation, setStar1Rotation] = useState(false);
    const [star2Spinning, setStar2Spinning] = useState(false);
    const [star3Spinning, setStar3Spinning] = useState(false);

    // Initial sequential animation (Logo style)
    useEffect(() => {
        // Star 1
        setTimeout(() => setStar1Rotation(true), 100);
        setTimeout(() => setStar1Rotation(false), 1100);

        // Star 2
        setTimeout(() => setStar2Spinning(true), 300);
        setTimeout(() => setStar2Spinning(false), 1300);

        // Star 3
        setTimeout(() => setStar3Spinning(true), 500);
        setTimeout(() => setStar3Spinning(false), 1500);
    }, []);

    // Auto-detection on PDF load
    useEffect(() => {
        if (pdfBase64 && fields.length === 0 && !isLoadingFields) {
            console.log("Triggering auto-discovery...");
            discoverLayout(false);
        }
    }, [pdfBase64]);

    // Keyboard handlers removed
    useEffect(() => { }, []);

    const deleteField = (index: number) => {
        // Disabled manually
    };


    // Unified layout discovery (used both for auto-load and manual Star 1 click)
    const discoverLayout = async (isManual = false) => {
        if (isLoadingFields || !pdfBase64) return;
        setIsLoadingFields(true);
        console.log(`[DocumentStudio] Starting layout discovery (manual: ${isManual})...`);

        try {
            const { apiRequest } = await import("@/lib/queryClient");
            const response = await apiRequest('POST', '/api/compile', {
                pinnedSource: {
                    name: fileName,
                    type: 'application/pdf',
                    base64: pdfBase64
                },
                fillingMode: 'studio',
                onlyAnalyze: true
            });

            const data = await response.json();
            if (data.fields && data.fields.length > 0) {
                // Convert to DiscoveredField
                const discovered = data.fields.map((f: any) => ({
                    ...f,
                    fieldType: f.fieldType || 'text',
                    value: f.value || '',
                    offsetX: 0,
                    offsetY: 0,
                    rotation: 0
                }));
                console.log('[DocumentStudio] Fields discovered and set to state:', discovered.length);
                setFields(discovered);
                if (onFieldsDiscovered) {
                    onFieldsDiscovered(discovered.map((f: any) => f.name));
                }
                toast({ title: "Layout Analizzato", description: `Trovati ${discovered.length} campi (Form).` });
            } else {
                console.warn('[DocumentStudio] No fields returned from server, trying Client-Side Heuristic...');

                // FALLBACK: Client-side extraction
                const clientFields = await extractTextPositionsClientSide();

                if (clientFields.length > 0) {
                    setFields(clientFields);
                    if (onFieldsDiscovered) {
                        onFieldsDiscovered(clientFields.map(f => f.name));
                    }
                    toast({ title: "Analisi Visiva", description: `Trovati ${clientFields.length} potenziali campi dal testo.` });
                } else {
                    if (isManual) {
                        toast({ title: "Nessun campo trovato", description: "Prova ad aggiungere i campi manualmente." });
                    }
                }
            }
        } catch (e) {
            console.error('Discover layout failed', e);
            if (isManual) {
                toast({ variant: "destructive", title: "Errore Analisi", description: "Riprova tra poco." });
            }
        } finally {
            setIsLoadingFields(false);
        }
    };

    // Auto-discover fields on PDF load
    // Auto-discover fields on PDF load - DISABLED by user request
    useEffect(() => {
        /*
        if (pdfBase64 && fields.length === 0 && !isLoadingFields) {
            discoverLayout(false);
        }
        */
    }, [pdfBase64]);

    // Watch for external values to trigger "typing" effect
    useEffect(() => {
        if (externalValues && Object.keys(externalValues).length > 0) {
            // Stop Star 2 spinning when values arrive
            setStar2Spinning(false);

            console.log('[DocumentStudio] Received externalValues:', externalValues);
            const keys = Object.keys(externalValues);
            const newFields = [...fields];

            const applyTyping = async () => {
                for (const key of keys) {
                    const index = newFields.findIndex(f =>
                        f.name.toLowerCase().includes(key.toLowerCase()) ||
                        key.toLowerCase().includes(f.name.toLowerCase())
                    );
                    if (index !== -1) {
                        const val = externalValues[key];
                        const safeVal = typeof val === 'object' ? JSON.stringify(val) : String(val || "");
                        newFields[index] = { ...newFields[index], value: safeVal };
                        setFields([...newFields]);
                        await new Promise(r => setTimeout(r, 60));
                    }
                }
            };
            applyTyping();
        }
    }, [externalValues]);

    // Sync fields with external values (compilation results)
    useEffect(() => {
        if (externalValues && Object.keys(externalValues).length > 0) {
            console.log('[DocumentStudio] Syncing with external values:', Object.keys(externalValues).length);
            setFields(prev => prev.map(f => {
                if (externalValues[f.name] !== undefined) {
                    return { ...f, value: externalValues[f.name] };
                }
                return f;
            }));
        }
    }, [externalValues]);

    // Sync spinning state with parent processing state
    useEffect(() => {
        if (!isProcessing) {
            setStar2Spinning(false);
            setStar3Spinning(false);
        }
    }, [isProcessing]);

    // Client-side PDF text extraction using pdfjs (INSTANT + PRECISE)
    const extractTextPositionsClientSide = async (): Promise<DiscoveredField[]> => {
        try {
            console.log("[DocumentStudio] Starting client-side PDF extraction...");
            const startTime = Date.now();

            // Decode base64 and load PDF
            const binaryString = atob(pdfBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const pdf = await pdfjs.getDocument({ data: bytes }).promise;
            const fields: DiscoveredField[] = [];

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.0 });
                const textContent = await page.getTextContent();

                // Group by approximate Y position (same line)
                const lines = new Map<number, any[]>();

                for (const item of textContent.items as any[]) {
                    if (!item.str) continue;

                    const [a, b, c, d, tx, ty] = item.transform;
                    const fontSize = Math.sqrt(a * a + b * b);
                    const yKey = Math.round((viewport.height - ty) / 10) * 10;

                    if (!lines.has(yKey)) lines.set(yKey, []);
                    lines.get(yKey)!.push({
                        text: item.str,
                        x: tx,
                        y: viewport.height - ty,
                        width: item.width || (item.str.length * fontSize * 0.6),
                        height: fontSize * 1.2,
                        pageWidth: viewport.width,
                        pageHeight: viewport.height
                    });
                }

                // Analyze lines for field patterns
                for (const [yKey, lineItems] of Array.from(lines.entries())) {
                    lineItems.sort((a, b) => a.x - b.x);

                    for (let i = 0; i < lineItems.length; i++) {
                        const item = lineItems[i];
                        const text = item.text.trim();

                        // Skip empty or underscore-only items
                        const isEmptyField = /^[_\-\.]{3,}$/.test(text) || text === '';
                        if (isEmptyField) continue;

                        // Check if next item is empty field indicator
                        const nextItem = lineItems[i + 1];
                        const nextIsEmpty = nextItem && /^[_\-\.]{3,}$/.test(nextItem.text.trim());

                        // Check if text ends with : or next is empty
                        if (text.endsWith(':') || nextIsEmpty) {
                            const fieldX = nextIsEmpty ? nextItem.x : item.x + item.width + 5;
                            const fieldWidth = nextIsEmpty ? nextItem.width : 150;

                            fields.push({
                                name: text.replace(/:$/, '').trim(),
                                boundingPoly: {
                                    vertices: [],
                                    normalizedVertices: [
                                        { x: fieldX / item.pageWidth, y: item.y / item.pageHeight },
                                        { x: (fieldX + fieldWidth) / item.pageWidth, y: item.y / item.pageHeight },
                                        { x: (fieldX + fieldWidth) / item.pageWidth, y: (item.y + item.height) / item.pageHeight },
                                        { x: fieldX / item.pageWidth, y: (item.y + item.height) / item.pageHeight }
                                    ]
                                },
                                pageIndex: pageNum - 1,
                                value: "",
                                offsetX: 0,
                                offsetY: 0,
                                rotation: 0
                            });
                        }
                    }
                }
            }

            console.log(`[DocumentStudio] Client extraction complete: ${fields.length} fields in ${Date.now() - startTime}ms`);
            return fields;

        } catch (error) {
            console.error("[DocumentStudio] Client-side extraction failed:", error);
            return [];
        }
    };

    const updateFieldProperty = (index: number, updates: Partial<DiscoveredField>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        setFields(newFields);
    };

    const handlePdfClick = (e: React.MouseEvent) => {
        if (!isAddingField || !pdfContainerRef.current) return;

        const rect = pdfContainerRef.current.getBoundingClientRect();
        // Calculate relative position 0-100%
        // Note: This is approximate as it's relative to the container, not the specific page.
        // For simplicity in this interaction mode, we'll assume Page 1 or visible area logic if possible.
        // Better approach: User clicks on a Page. The onClick handler should be on the Page overlay logic.
    };

    const handlePageClick = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
        // Manual tagging disabled
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="flex-shrink-0 px-0 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-3 mr-2 select-none">
                            <Asterisk
                                className={`w-8 h-8 text-blue-600 transition-transform duration-1000 ease-in-out ${star1Rotation ? 'rotate-[360deg]' : 'rotate-0'}`}
                                strokeWidth={3}
                            />
                            <Asterisk
                                className={`w-8 h-8 text-blue-600 transition-transform duration-1000 ease-in-out ${star2Spinning ? 'rotate-[360deg]' : 'rotate-0'}`}
                                strokeWidth={3}
                            />
                            <Asterisk
                                className={`w-8 h-8 text-blue-600 transition-transform duration-1000 ease-in-out ${star3Spinning ? 'rotate-[360deg]' : 'rotate-0'}`}
                                strokeWidth={3}
                            />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Document Studio</CardTitle>
                            <p className="text-xs text-muted-foreground">{fileName}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <div className="flex-1 grid grid-cols-1 gap-6 min-h-0">
                {/* Full-width PDF Workspace */}
                <div id="pdf-workspace" className={`bg-muted/30 rounded-xl overflow-hidden relative flex justify-center p-4 border shadow-inner ${isAddingField ? 'cursor-crosshair' : ''}`}>
                    {/* Loading Overlay for Layout Analysis */}
                    {isLoadingFields && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-[100] flex flex-col items-center justify-center pointer-events-none">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                            <p className="text-blue-900 font-medium animate-pulse">Analisi Layout in corso...</p>
                        </div>
                    )}

                    <ScrollArea className="h-full w-full">
                        <div className="flex flex-col items-center gap-4 relative py-8" ref={pdfContainerRef}>
                            <Document
                                file={`data:application/pdf;base64,${pdfBase64}`}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="space-y-4">
                                        <Skeleton className="w-[800px] h-[1000px]" />
                                    </div>
                                }
                            >
                                {Array.from(new Array(numPages), (el, pageIndex) => (
                                    <Page
                                        key={`page_${pageIndex + 1}`}
                                        pageNumber={pageIndex + 1}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                        className="mb-4 shadow-sm"
                                        width={800} // Assuming a fixed width for now, adjust as needed
                                    // onLoadSuccess={handlePageLoadSuccess} // If you have a page-specific load success handler
                                    />
                                ))}
                            </Document>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </Card >
    );
}
