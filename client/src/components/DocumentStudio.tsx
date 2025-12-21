import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Wand2, X, Check, Sparkles } from "lucide-react";
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
    const [star2Rotation, setStar2Rotation] = useState(0);
    const [star3Spinning, setStar3Spinning] = useState(false);

    // Load fields from backend when PDF changes
    useEffect(() => {
        if (pdfBase64) {
            analyzeLayout();
        }
    }, [pdfBase64]);

    // Keyboard delete handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldIndex !== null) {
                // Don't delete if focus is on an input
                if (document.activeElement?.tagName === 'INPUT') return;
                deleteField(selectedFieldIndex);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedFieldIndex]);

    const deleteField = (index: number) => {
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
        setSelectedFieldIndex(null);
        toast({ title: "Campo eliminato" });
    };

    // Watch for external values to trigger "typing" effect
    useEffect(() => {
        if (externalValues && Object.keys(externalValues).length > 0) {
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
                        newFields[index] = {
                            ...newFields[index],
                            value: safeVal
                        };
                        setFields([...newFields]);
                        await new Promise(r => setTimeout(r, 60));
                    }
                }
            };

            applyTyping();
        }
    }, [externalValues]);

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
                console.log("[DEBUG DocumentStudio] Fields discovered:", data.fields.length);
                setFields(data.fields.map((f: any) => ({ ...f, value: "", offsetX: 0, offsetY: 0, rotation: 0 })));
                if (onFieldsDiscovered) {
                    onFieldsDiscovered(data.fields.map((f: any) => f.name));
                }
            }
        } catch (error) {
            console.error("Layout analysis failed:", error);
        } finally {
            setIsLoadingFields(false);
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
                                    className={`cursor-pointer p-0 m-0 leading-none flex items-center justify-center w-6 h-8 ${isAddingField ? 'scale-125' : 'hover:scale-110'}`}
                                >
                                    <span className="text-4xl font-bold text-blue-600 pb-2">*</span>
                                </motion.div>
                            </TooltipWrapper>

                            {/* Star 2: Compile */}
                            <TooltipWrapper text="Compila con AI">
                                <motion.div
                                    animate={{ rotateY: star2Rotation }}
                                    onClick={() => {
                                        setStar2Rotation(prev => prev + 360);
                                        onCompile(fields);
                                    }}
                                    className="cursor-pointer p-0 m-0 leading-none flex items-center justify-center w-6 h-8 hover:scale-110"
                                >
                                    <span className="text-4xl font-bold text-blue-600 pb-2">*</span>
                                </motion.div>
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
                                    className="cursor-pointer p-0 m-0 leading-none flex items-center justify-center w-6 h-8 hover:scale-110"
                                >
                                    <span className="text-4xl font-bold text-blue-600 pb-2">*</span>
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

                                                // Calculate generic width based on bounding box if available, else auto
                                                let width = 'auto';
                                                if (isNormalized && v.length === 4) {
                                                    const w = (v[1].x - v[0].x) * 100;
                                                    if (w > 2) width = `${w}%`;
                                                }

                                                const isValueEmpty = !field.value || field.value === "null";

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
                                                            transform: 'translateY(-100%)', // Text anchor
                                                            width: width === 'auto' ? 'auto' : width,
                                                            maxWidth: '400px'
                                                        }}
                                                    >
                                                        <div className={`
                                                            relative px-1 rounded border transition-colors flex items-center
                                                            ${isSelected ? 'border-blue-500 bg-blue-50/90 shadow-lg' : 'border-transparent hover:border-blue-300 hover:bg-blue-50/50'}
                                                            ${isValueEmpty ? 'border-dashed border-blue-300/50' : ''} 
                                                        `}>
                                                            {/* Editable Input */}
                                                            {/* If value is empty, we edit NAME (Label). If value exists, we edit VALUE. */}
                                                            <input
                                                                type="text"
                                                                value={isValueEmpty ? field.name : String(field.value)}
                                                                placeholder={isValueEmpty ? "Etichetta..." : field.name}
                                                                className={`bg-transparent border-none outline-none w-full p-0 m-0 text-[12px] font-medium min-w-[30px]
                                                                    ${isValueEmpty ? 'text-blue-400 italic' : 'text-blue-900'}
                                                                `}
                                                                onChange={(e) => {
                                                                    if (isValueEmpty) {
                                                                        updateFieldProperty(globalIdx, { name: e.target.value });
                                                                    } else {
                                                                        updateFieldProperty(globalIdx, { value: e.target.value });
                                                                    }
                                                                }}
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                            />

                                                            {isSelected && (
                                                                <>

                                                                    {/* Rotation Control */}
                                                                    {[
                                                                        { top: -3, left: -3, cursor: 'nw-resize' },
                                                                        { top: -3, right: -3, cursor: 'ne-resize' },
                                                                        { bottom: -3, left: -3, cursor: 'sw-resize' },
                                                                        { bottom: -3, right: -3, cursor: 'se-resize' }
                                                                    ].map((pos, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="absolute w-2 h-2 bg-blue-600 rounded-full shadow-sm hover:scale-150 transition-transform z-50"
                                                                            style={{ ...pos, cursor: 'crosshair' }}
                                                                            onMouseDown={(e) => {
                                                                                e.stopPropagation();
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
                                                                                };

                                                                                window.addEventListener('mousemove', handleMouseMove);
                                                                                window.addEventListener('mouseup', handleMouseUp);
                                                                            }}
                                                                        />
                                                                    ))}
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
