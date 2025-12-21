import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Wand2, X, Check, Sparkles, Star } from "lucide-react";
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
    onCompile: (currentFields: DiscoveredField[]) => void; // New prop
    isProcessing?: boolean;
    externalValues?: Record<string, string>;
    onFieldsDiscovered?: (fieldNames: string[]) => void;
}

export function DocumentStudio({
    pdfBase64,
    fileName,
    onDownload,
    onCompile,
    isProcessing = false,
    externalValues,
    onFieldsDiscovered
}: DocumentStudioProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [fields, setFields] = useState<DiscoveredField[]>([]);
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
    const [isAddingField, setIsAddingField] = useState(false); // Mode for Star 1
    const { toast } = useToast();
    const pdfContainerRef = useRef<HTMLDivElement>(null);

    // Star animations state
    const [star1Rotation, setStar1Rotation] = useState(0);
    const [star2Spinning, setStar2Spinning] = useState(false);
    const [star3Spinning, setStar3Spinning] = useState(false);

    // REMOVED: Auto-detection on PDF load - now user must click star to compile
    // The PDF is shown without pre-detected fields

    // Keyboard delete handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldIndex !== null) {
                // Don't delete if focus is on an input or editable element
                const activeEl = document.activeElement;
                if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || (activeEl as HTMLElement)?.isContentEditable) {
                    return;
                }
                e.preventDefault();
                deleteField(selectedFieldIndex);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedFieldIndex, fields]);

    const deleteField = (index: number) => {
        console.log('[DocumentStudio] Deleting field at index:', index);
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
        setSelectedFieldIndex(null);
        toast({ title: "Campo eliminato" });
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
                toast({ title: "Layout Analizzato", description: `Trovati ${discovered.length} campi.` });
            } else {
                console.warn('[DocumentStudio] No fields returned from server');
                if (isManual) {
                    toast({ title: "Nessun campo trovato", description: "Prova ad aggiungere i campi manualmente." });
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
    useEffect(() => {
        if (pdfBase64 && fields.length === 0 && !isLoadingFields) {
            discoverLayout(false);
        }
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
        if (!isAddingField) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to normalized coordinates (0-1) or absolute if backend prefers.
        // Assuming 800px width as rendered.
        // We'll use normalized for consistency with analyzeLayout.
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;

        const newField: DiscoveredField = {
            name: "Nuovo Campo",
            pageIndex: pageIndex,
            boundingPoly: {
                vertices: [], // Not strictly needed for UI logic if normalized exists
                normalizedVertices: [
                    { x: normalizedX, y: normalizedY },
                    { x: normalizedX + 0.2, y: normalizedY }, // Default width
                    { x: normalizedX + 0.2, y: normalizedY + 0.03 }, // Default height
                    { x: normalizedX, y: normalizedY + 0.03 }
                ]
            },
            value: "",
            offsetX: 0,
            offsetY: 0,
            rotation: 0
        };

        setFields([...fields, newField]);
        setIsAddingField(false); // Auto-exit add mode? Or keep it? keeping it allows multiple adds.
        // Let's keep it but maybe show a toast or cursor change.
        toast({ title: "Campo Aggiunto", description: "Modifica il nome in azzurro." });
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="flex-shrink-0 px-0 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 mr-4 select-none">
                            {/* Star 1: Add Field Mode */}
                            <TooltipWrapper text="Aggiungi Campi">
                                <motion.div
                                    animate={{ rotate: star1Rotation }}
                                    onClick={() => {
                                        setStar1Rotation(prev => prev + 360);
                                        setIsAddingField(!isAddingField);
                                        toast({
                                            title: isAddingField ? "Modalità Visualizzazione" : "Modalità Aggiunta",
                                            description: isAddingField ? "Modifiche terminate" : "Clicca sul documento per aggiungere campi"
                                        });
                                    }}
                                    className={`cursor-pointer p-0 m-0 flex items-center justify-center w-8 h-8 origin-center ${isAddingField ? 'scale-125' : 'hover:scale-110'}`}
                                >
                                    <Star className="w-6 h-6 fill-blue-600 text-blue-600 pointer-events-none" />
                                </motion.div>
                            </TooltipWrapper>

                            {/* Star 2: Compile */}
                            <TooltipWrapper text="Compila con AI">
                                <div
                                    onClick={() => {
                                        setStar2Spinning(true);
                                        onCompile(fields);
                                    }}
                                    className={`cursor-pointer p-0 m-0 flex items-center justify-center w-8 h-8 origin-center hover:scale-110 ${star2Spinning ? 'animate-turbo-spin' : ''}`}
                                >
                                    <Star className="w-6 h-6 fill-blue-600 text-blue-600 pointer-events-none" />
                                </div>
                            </TooltipWrapper>

                            {/* Star 3: Download */}
                            <TooltipWrapper text="Scarica PDF">
                                <motion.div
                                    animate={star3Spinning ? { rotate: 360 } : {}}
                                    transition={star3Spinning ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
                                    onClick={() => {
                                        setStar3Spinning(true);
                                        onDownload(fields);
                                        setTimeout(() => setStar3Spinning(false), 3000);
                                    }}
                                    className="cursor-pointer p-0 m-0 flex items-center justify-center w-8 h-8 origin-center hover:scale-110"
                                >
                                    <Star className="w-6 h-6 fill-blue-600 text-blue-600 pointer-events-none" />
                                </motion.div>
                            </TooltipWrapper>
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
                <div className={`bg-muted/30 rounded-xl overflow-hidden relative flex justify-center p-4 border shadow-inner ${isAddingField ? 'cursor-crosshair' : ''}`}>
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
                                {Array.from(new Array(numPages), (el, index) => (
                                    <div
                                        key={`page_${index + 1}`}
                                        className="relative shadow-2xl mb-8 bg-white overflow-hidden select-none"
                                        onClick={(e) => handlePageClick(index, e)}
                                    >
                                        <Page
                                            pageNumber={index + 1}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            width={800}
                                        />
                                        {/* Overlay Layer */}
                                        <div className="absolute inset-0">
                                            {fields.filter(f => f.pageIndex === index).map((field, fIdx) => {
                                                const v = field.boundingPoly.normalizedVertices || field.boundingPoly.vertices;
                                                if (!v || v.length < 1) return null;

                                                const globalIdx = fields.indexOf(field);
                                                const isSelected = selectedFieldIndex === globalIdx;

                                                // Determine position (assuming 0-1 scale for normalized)
                                                const isNormalized = !!field.boundingPoly.normalizedVertices;
                                                const left = isNormalized ? v[0].x * 100 : (v[0].x / 1000) * 100;
                                                const top = isNormalized ? v[0].y * 100 : (v[0].y / 1000) * 100;

                                                // Calculate width: use field.width if set, otherwise from bounding box
                                                let width = 'auto';
                                                if (field.width) {
                                                    width = `${field.width}px`;
                                                } else if (isNormalized && v.length === 4) {
                                                    const w = (v[1].x - v[0].x) * 100;
                                                    if (w > 2) width = `${w}%`;
                                                }

                                                const isValueEmpty = !field.value || field.value === "null" || field.value === "";
                                                const isCheckbox = field.fieldType === 'checkbox';

                                                return (
                                                    <motion.div
                                                        key={`overlay_${globalIdx}`}
                                                        drag={!isAddingField} // Disable drag when adding
                                                        dragMomentum={false}
                                                        onDragEnd={(e, info) => {
                                                            updateFieldProperty(globalIdx, {
                                                                offsetX: (field.offsetX || 0) + info.offset.x,
                                                                offsetY: (field.offsetY || 0) + info.offset.y,
                                                            });
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isCheckbox) {
                                                                // Toggle checkbox value on click
                                                                const newVal = (field.value === 'X' || field.value === 'true') ? '' : 'X';
                                                                updateFieldProperty(globalIdx, { value: newVal });
                                                            }
                                                            setSelectedFieldIndex(isSelected ? null : globalIdx);
                                                        }}
                                                        className={`absolute ${isAddingField ? '' : 'cursor-move'} group z-10`}
                                                        animate={{
                                                            x: field.offsetX || 0,
                                                            y: field.offsetY || 0,
                                                            rotate: field.rotation || 0
                                                        }}
                                                        style={{
                                                            left: `${left}%`,
                                                            top: `${top}%`,
                                                            transform: isCheckbox ? 'translate(-50%, -50%)' : 'translateY(-100%)', // Center for checkbox, baseline for text
                                                            width: isCheckbox ? '20px' : (width === 'auto' ? 'auto' : width),
                                                            height: isCheckbox ? '20px' : 'auto',
                                                            maxWidth: '400px'
                                                        }}
                                                    >
                                                        <div className={`
                                                            relative px-1 rounded border transition-colors flex items-center justify-center
                                                            ${isSelected ? 'border-blue-500 bg-blue-50/90 shadow-lg scale-105' : 'border-blue-400/30 bg-blue-50/20 hover:border-blue-400 hover:bg-blue-50/50'}
                                                            ${isCheckbox ? 'rounded-sm aspect-square' : ''}
                                                            ${isValueEmpty && !isCheckbox ? 'border-dashed' : ''} 
                                                        `}>
                                                            {/* Editable Input for Text, or X for Checkbox */}
                                                            {isCheckbox ? (
                                                                <span className="text-blue-900 font-bold text-sm select-none">
                                                                    {field.value === 'X' || field.value === 'true' ? 'X' : ''}
                                                                </span>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={isValueEmpty ? "" : String(field.value)}
                                                                    placeholder={isValueEmpty ? field.name : ""}
                                                                    className={`bg-transparent border-none outline-none w-full p-0 m-0 text-[12px] font-medium min-w-[30px]
                                                                        ${isValueEmpty ? 'text-blue-400/70 italic' : 'text-blue-900'}
                                                                    `}
                                                                    onChange={(e) => {
                                                                        updateFieldProperty(globalIdx, { value: e.target.value });
                                                                    }}
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                    onKeyDown={(e) => e.stopPropagation()}
                                                                />
                                                            )}

                                                            {isSelected && (
                                                                <button
                                                                    className="absolute -right-3 -top-3 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors z-[100]"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        deleteField(globalIdx);
                                                                    }}
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}

                                                            {isSelected && (
                                                                <>
                                                                    {/* Left Edge Resize Handle */}
                                                                    <div
                                                                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-8 bg-blue-500 rounded-full cursor-ew-resize hover:bg-blue-600 hover:w-2 transition-all z-50 shadow-md"
                                                                        title="Trascina per ridimensionare"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const parentEl = e.currentTarget.parentElement?.parentElement;
                                                                            const startWidth = parentEl?.offsetWidth || field.width || 100;

                                                                            const handleMouseMove = (mv: MouseEvent) => {
                                                                                const delta = startX - mv.clientX;
                                                                                const newWidth = Math.max(40, startWidth + delta);
                                                                                updateFieldProperty(globalIdx, { width: newWidth });
                                                                            };

                                                                            const handleMouseUp = () => {
                                                                                window.removeEventListener('mousemove', handleMouseMove);
                                                                                window.removeEventListener('mouseup', handleMouseUp);
                                                                                document.body.style.cursor = '';
                                                                            };

                                                                            document.body.style.cursor = 'ew-resize';
                                                                            window.addEventListener('mousemove', handleMouseMove);
                                                                            window.addEventListener('mouseup', handleMouseUp);
                                                                        }}
                                                                    />

                                                                    {/* Right Edge Resize Handle */}
                                                                    <div
                                                                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-8 bg-blue-500 rounded-full cursor-ew-resize hover:bg-blue-600 hover:w-2 transition-all z-50 shadow-md"
                                                                        title="Trascina per ridimensionare"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const startX = e.clientX;
                                                                            const parentEl = e.currentTarget.parentElement?.parentElement;
                                                                            const startWidth = parentEl?.offsetWidth || field.width || 100;

                                                                            const handleMouseMove = (mv: MouseEvent) => {
                                                                                const delta = mv.clientX - startX;
                                                                                const newWidth = Math.max(40, startWidth + delta);
                                                                                updateFieldProperty(globalIdx, { width: newWidth });
                                                                            };

                                                                            const handleMouseUp = () => {
                                                                                window.removeEventListener('mousemove', handleMouseMove);
                                                                                window.removeEventListener('mouseup', handleMouseUp);
                                                                                document.body.style.cursor = '';
                                                                            };

                                                                            document.body.style.cursor = 'ew-resize';
                                                                            window.addEventListener('mousemove', handleMouseMove);
                                                                            window.addEventListener('mouseup', handleMouseUp);
                                                                        }}
                                                                    />

                                                                    {/* Rotation Handle - Above center */}
                                                                    <div
                                                                        className="absolute left-1/2 -top-6 -translate-x-1/2 w-5 h-5 bg-blue-600 rounded-full cursor-grab hover:bg-blue-700 hover:scale-110 transition-all z-50 shadow-md flex items-center justify-center"
                                                                        title="Trascina per ruotare"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            e.preventDefault();
                                                                            const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                                                                            const centerX = rect.left + rect.width / 2;
                                                                            const centerY = rect.top + rect.height / 2;
                                                                            const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                                                                            const initialFieldRotation = field.rotation || 0;

                                                                            const handleMouseMove = (mv: MouseEvent) => {
                                                                                const currentAngle = Math.atan2(mv.clientY - centerY, mv.clientX - centerX) * (180 / Math.PI);
                                                                                const delta = currentAngle - startAngle;
                                                                                updateFieldProperty(globalIdx, { rotation: initialFieldRotation + delta });
                                                                            };

                                                                            const handleMouseUp = () => {
                                                                                window.removeEventListener('mousemove', handleMouseMove);
                                                                                window.removeEventListener('mouseup', handleMouseUp);
                                                                                document.body.style.cursor = '';
                                                                            };

                                                                            document.body.style.cursor = 'grabbing';
                                                                            window.addEventListener('mousemove', handleMouseMove);
                                                                            window.addEventListener('mouseup', handleMouseUp);
                                                                        }}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                                            <path d="M3 3v5h5" />
                                                                        </svg>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </Document>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </Card >
    );
}
