import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Wand2, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, useMotionValue, useTransform } from "framer-motion";


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
    // Local state for interactive positioning
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
}

interface DocumentStudioProps {
    pdfBase64: string;
    fileName: string;
    onDownload: (filledFields: DiscoveredField[]) => void;
    isProcessing?: boolean;
    externalValues?: Record<string, string>; // New: values from parent
    onFieldsDiscovered?: (fieldNames: string[]) => void; // New: notify parent of found fields
}

export function DocumentStudio({
    pdfBase64,
    fileName,
    onDownload,
    isProcessing = false,
    externalValues,
    onFieldsDiscovered
}: DocumentStudioProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [fields, setFields] = useState<DiscoveredField[]>([]);
    const [isLoadingFields, setIsLoadingFields] = useState(false);
    const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
    const { toast } = useToast();
    const pdfContainerRef = useRef<HTMLDivElement>(null);

    // Load fields from backend when PDF changes
    useEffect(() => {
        if (pdfBase64) {
            analyzeLayout();
        }
    }, [pdfBase64]);

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
                        // Ensure we strictly cast to string to prevent React Error #31
                        const val = externalValues[key];
                        const safeVal = typeof val === 'object' ? JSON.stringify(val) : String(val || "");
                        newFields[index] = {
                            ...newFields[index],
                            value: safeVal
                            // Preserving manual offsets/rotation (removed explicit reset to 0)
                        };
                        setFields([...newFields]);
                        await new Promise(r => setTimeout(r, 60)); // Faster visual spacing
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
                    console.log("[DEBUG DocumentStudio] Notifying parent of fields:", data.fields.map((f: any) => f.name));
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

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="flex-shrink-0 px-0 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center">
                            <span className="text-4xl font-bold text-blue-600 p-0 m-0 leading-none" style={{ letterSpacing: '2px' }}>***</span>
                        </div>
                        <div>
                            <CardTitle className="text-lg">Document Studio</CardTitle>
                            <p className="text-xs text-muted-foreground">{fileName}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Download button removed as requested */}
                        {fields.length === 0 && !isLoadingFields && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => analyzeLayout()}
                                className="gap-2"
                            >
                                <Wand2 className="w-4 h-4" />
                                Riprova Analisi
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <div className="flex-1 grid grid-cols-1 gap-6 min-h-0">
                {/* Full-width PDF Workspace */}
                <div className="bg-muted/30 rounded-xl overflow-hidden relative flex justify-center p-4 border shadow-inner">
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
                                    <div key={`page_${index + 1}`} className="relative shadow-2xl mb-8 bg-white overflow-hidden select-none">
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
                                                    // If width is tiny, default to auto/min-width to be usable
                                                    if (w > 2) width = `${w}%`;
                                                }

                                                return (
                                                    <motion.div
                                                        key={`overlay_${globalIdx}`}
                                                        drag
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
                                                        className={`absolute cursor-move group z-10`}
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
                                                            maxWidth: '400px' // Prevent huge boxes
                                                        }}
                                                    >
                                                        <div className={`
                                                            relative px-1 rounded border transition-colors flex items-center
                                                            ${isSelected ? 'border-blue-500 bg-blue-50/90 shadow-lg' : 'border-transparent hover:border-blue-300 hover:bg-blue-50/50'}
                                                        `}>
                                                            {/* Editable Input */}
                                                            <input
                                                                type="text"
                                                                value={(field.value === null || field.value === undefined || field.value === "null") ? "" : String(field.value)}
                                                                placeholder={field.name}
                                                                className="bg-transparent border-none outline-none w-full p-0 m-0 text-[12px] text-blue-900 font-medium placeholder:text-blue-300/50 min-w-[30px]"
                                                                onChange={(e) => updateFieldProperty(globalIdx, { value: e.target.value })}
                                                                onPointerDown={(e) => e.stopPropagation()} // Allow interaction without dragging
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
