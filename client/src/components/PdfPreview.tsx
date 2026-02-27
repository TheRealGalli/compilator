import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    AlertCircle,
    MessageSquare
} from "lucide-react";
import { MentionButton } from "./MentionButton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, X } from "lucide-react";

// Use a more reliable worker source
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Global styles are imported in main.tsx

interface PdfPreviewProps {
    fileBase64: string;
    fileName?: string;
    className?: string;
    selectedSources?: any[];
    notes?: string;
    webResearch?: boolean;
    modelProvider?: string;
    onCompile?: (content: string, metadata?: { extractedFields?: any[], manualAnnotations?: any[], fetchedCompilerContext?: string }) => void;
    onMention?: (text: string, source: 'template' | 'copilot' | 'anteprema', start?: number, end?: number) => void;
    refinerProposals?: string | null;
    onAccept?: () => void;
    onReject?: () => void;
}

export function PdfPreview({
    fileBase64,
    fileName,
    className,
    selectedSources = [],
    notes = "",
    webResearch = false,
    modelProvider = 'gemini',
    onCompile,
    onMention,
    refinerProposals,
    onAccept,
    onReject
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
    const [isXfaAdobe, setIsXfaAdobe] = useState(false);
    const [hasRefinerProposals, setHasRefinerProposals] = useState(false);
    const [rollbackValues, setRollbackValues] = useState<Record<string, string | boolean>>({});
    const [hasCompiledOnce, setHasCompiledOnce] = useState(false);
    const [mentionPosition, setMentionPosition] = useState<{ x: number, y: number } | null>(null);
    const [pendingMentionText, setPendingMentionText] = useState<string>('');
    const viewportRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const documentOptions = useMemo(() => ({
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
        enableXfa: true,
    }), []);

    // Listen for new proposals coming from the Refiner Chat
    useEffect(() => {
        if (refinerProposals && !isCompiling) {
            try {
                const parsed = JSON.parse(refinerProposals);
                const propsList = parsed.proposals || [];
                if (propsList.length > 0) {
                    setProposals(propsList);
                    const currentVals = captureCurrentFormValues();
                    setRollbackValues(currentVals);
                    applyProposalsToDom(propsList);
                    setHasRefinerProposals(true);
                    toast({
                        title: "Modifiche Applicate",
                        description: "Verifica e conferma le modifiche dal menu in alto a destra.",
                    });
                }
            } catch (e) {
                console.error("Failed to parse refinerProposals:", e);
            }
        }
    }, [refinerProposals]);

    useEffect(() => {
        if (!fileBase64) return;
        setIsLoading(true);
        setIsDocumentLoading(true); // Reset document loading state to avoid error flashes
        setError(null);
        setIsCompiling(false);
        setProposals([]);
        setCacheKey(null);
        setHasRefinerProposals(false);
        setRollbackValues({});
        setHasCompiledOnce(false);

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

            // Also check for XFA technology here to show the tag
            import('pdf-lib').then(async ({ PDFDocument, PDFName, PDFDict, PDFBool, PDFNumber, PDFTextField }) => {
                try {
                    const pdfDoc = await PDFDocument.load(byteNumbers);

                    // CHECK 1: NeedsRendering flag (Dynamic XFA indicator)
                    const needsRef = pdfDoc.catalog.get(PDFName.of('NeedsRendering'));
                    const needsVal = needsRef ? pdfDoc.context.lookup(needsRef) : null;
                    const isDynamic = needsVal instanceof PDFBool && needsVal.asBoolean() === true;

                    // CHECK 2: XFA key and Signatures in AcroForm
                    const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
                    let hasXfaKey = false;
                    let isSigned = false;
                    if (acroFormRef) {
                        const acroFormNode = pdfDoc.context.lookup(acroFormRef);
                        if (acroFormNode instanceof PDFDict) {
                            if (acroFormNode.has(PDFName.of('XFA'))) {
                                hasXfaKey = true;
                            }
                            // CHECK 3: Signatures (SigFlags)
                            const sigFlags = acroFormNode.get(PDFName.of('SigFlags'));
                            if (sigFlags instanceof PDFNumber) {
                                if ((sigFlags.asNumber() & 1) !== 0) {
                                    isSigned = true;
                                }
                            }
                        }
                    }

                    // CHECK 4: Metadata fingerprints
                    const creator = pdfDoc.getCreator() || '';
                    const producer = pdfDoc.getProducer() || '';
                    const isAdobeDesigner = creator.includes('Designer') ||
                        producer.includes('Designer') ||
                        producer.includes('LiveCycle');

                    // CHECK 5: Deep Signature & Read-Only Check
                    const form = pdfDoc.getForm();
                    const allFields = form.getFields();
                    const hasSignatureValue = allFields.some(f => {
                        try {
                            const acroField = (f as any).acroField;
                            return acroField.get(PDFName.of('FT')) === PDFName.of('Sig') && acroField.has(PDFName.of('V'));
                        } catch { return false; }
                    });

                    const fillableFields = allFields.filter(f => {
                        try { return (f as any).acroField.getWidgets()?.length > 0; } catch { return true; }
                    });

                    const textFields = fillableFields.filter(f => f instanceof PDFTextField);
                    const editableTextFieldsCount = textFields.filter(f => {
                        try { return !f.isReadOnly(); } catch { return true; }
                    }).length;

                    const editableFieldsCount = fillableFields.filter(f => {
                        try { return !f.isReadOnly(); } catch { return true; }
                    }).length;

                    // --- CALIBRATION LOGIC 3.0 ---
                    // RED (isXfaAdobe = true): Dynamic, Encrypted, Signed, or Locked Text Fields (False Orange resolution)
                    const allTextLocked = textFields.length > 0 && editableTextFieldsCount === 0;

                    if (isDynamic || pdfDoc.isEncrypted || isSigned || hasSignatureValue || allTextLocked || (fillableFields.length > 0 && editableFieldsCount === 0)) {
                        setIsXfaAdobe(true);
                    } else {
                        setIsXfaAdobe(false);
                    }
                } catch (err) {
                }
            });

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
                }
            }
        });


    };

    const captureCurrentFormValues = (): Record<string, string | boolean> => {
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
        return fields;
    };

    const handleAcceptProposals = () => {
        onAccept?.();
        setHasRefinerProposals(false);
        setRollbackValues({});
        setHasCompiledOnce(true);
        toast({
            title: "Modifiche Accettate",
            description: "I campi sono stati compilati correttamente."
        });
    };

    const handleRejectProposals = () => {
        onReject?.();
        if (Object.keys(rollbackValues).length > 0) {
            const annotationLayer = document.querySelector('.annotationLayer');
            if (annotationLayer) {
                const inputs = annotationLayer.querySelectorAll('input, textarea, select');
                inputs.forEach((el: any) => {
                    if (el.name && rollbackValues[el.name] !== undefined) {
                        const val = rollbackValues[el.name];
                        if (el.type === 'checkbox') {
                            if (el.checked !== val) {
                                el.checked = val as boolean;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        } else if (el.type === 'radio') {
                            if (el.value === String(val)) {
                                el.checked = true;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        } else {
                            if (el.value !== String(val)) {
                                el.value = String(val);
                                el.dispatchEvent(new Event('input', { bubbles: true }));
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }
                    }
                });
            }
        }
        setHasRefinerProposals(false);
        setRollbackValues({});
        setProposals([]);
        toast({
            title: "Modifiche Annullate",
            description: "Il modulo è stato riportato allo stato precedente."
        });
    };

    const updateSelectionPosition = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const viewportRect = viewport.getBoundingClientRect();
        const sel = window.getSelection();
        const selectedText = sel?.toString().trim();

        if (selectedText && selectedText.length > 0) {
            const range = sel?.getRangeAt(0);
            const rects = range?.getClientRects();

            if (rects && rects.length > 0) {
                const firstRect = rects[0];

                // Visibility check: is the selection within viewport bounds?
                // Add a small buffer (5px) for smoother hiding
                const isVisible = (
                    firstRect.top >= viewportRect.top - 5 &&
                    firstRect.bottom <= viewportRect.bottom + 5 &&
                    firstRect.left >= viewportRect.left - 5 &&
                    firstRect.right <= viewportRect.right + 5
                );

                if (isVisible) {
                    setPendingMentionText(selectedText);
                    setMentionPosition({
                        x: firstRect.left + (firstRect.width / 2),
                        y: firstRect.top - 12
                    });
                    return;
                }
            }
        }

        // Check if selection is inside an input/textarea
        const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            if (start !== null && end !== null && start !== end) {
                const text = activeEl.value.substring(start, end).trim();
                if (text) {
                    const rect = activeEl.getBoundingClientRect();

                    // Visibility check for input field
                    const isVisible = (
                        rect.top >= viewportRect.top - 5 &&
                        rect.bottom <= viewportRect.bottom + 5
                    );

                    if (isVisible) {
                        setPendingMentionText(text);
                        setMentionPosition({
                            x: rect.left + (rect.width / 2),
                            y: rect.top - 10
                        });
                        return;
                    }
                }
            }
        }

        setMentionPosition(null);
    }, []);

    const handleTextSelection = useCallback(() => {
        // Wait a tick for DOM selection to finalize
        requestAnimationFrame(updateSelectionPosition);
    }, [updateSelectionPosition]);

    // Track scroll and global selection events
    useEffect(() => {
        const viewport = viewportRef.current;
        const handleGlobalMouseUp = () => {
            requestAnimationFrame(updateSelectionPosition);
        };

        if (viewport) {
            viewport.addEventListener('scroll', updateSelectionPosition, { passive: true });
            window.addEventListener('resize', updateSelectionPosition);
            window.addEventListener('mouseup', handleGlobalMouseUp);

            return () => {
                viewport.removeEventListener('scroll', updateSelectionPosition);
                window.removeEventListener('resize', updateSelectionPosition);
                window.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [updateSelectionPosition]);

    const setupFieldMentionListeners = () => {
        const annotationLayer = document.querySelector('.annotationLayer');
        if (!annotationLayer) return;

        const inputs = annotationLayer.querySelectorAll('input, textarea');
        inputs.forEach((el: any) => {
            // Aggressive autofill prevention
            el.setAttribute('autocomplete', 'new-password'); // Trick to disable modern browser autofill
            el.setAttribute('autocorrect', 'off');
            el.setAttribute('autocapitalize', 'off');
            el.setAttribute('spellcheck', 'false');
            el.setAttribute('data-form-type', 'other');
            el.setAttribute('aria-autocomplete', 'none');

            // Listen for selection inside the field
            el.removeEventListener('select', updateSelectionPosition);
            el.addEventListener('select', updateSelectionPosition);
        });
    };

    const handleMentionClick = () => {
        if (onMention && pendingMentionText) {
            onMention(pendingMentionText, 'anteprema');
            setMentionPosition(null);
            window.getSelection()?.removeAllRanges();
            toast({
                title: "Menzione Aggiunta",
                description: `"${pendingMentionText.substring(0, 30)}..." aggiunta alla chat.`,
            });
        }
    };

    const handleEyeClick = async () => {
        if (isCompiling || !fileBase64 || hasRefinerProposals) return;

        if (isXfaAdobe) {
            setIsEyeSpinning(true);
            setTimeout(() => {
                setIsEyeSpinning(false);
                setIsCompiling(false);
                toast({
                    title: "Documento Letto a Sola Lettura o Cifrato",
                    description: "Compilazione automatizzata non permessa.",
                    variant: "destructive"
                });
            }, 1000);
            return;
        }

        if (hasCompiledOnce) {
            setIsEyeSpinning(true);
            setTimeout(() => {
                setIsEyeSpinning(false);
                toast({
                    title: "Compilazione già effettuata",
                    description: "Per ulteriori modifiche, utilizza la Chat Refine.",
                });
            }, 1000);
            return;
        }

        // Start compilation immediately, ignoring pre-filled status
        // so the user can always use AI assist if they want.
        setIsCompiling(true);

        try {

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


            setProposals(newProposals || []);

            // Capture the state immediately before apply so we can jump back
            const currentVals = captureCurrentFormValues();
            setRollbackValues(currentVals);

            // Immediate apply for the current page
            applyProposalsToDom(newProposals || []);
            setHasRefinerProposals(true);

            toast({
                title: "Compilazione completata",
                description: `Gromit ha generato ${newProposals?.length || 0} proposte. Naviga tra le pagine per vederle applicate.`,
            });

            if (onCompile) {
                onCompile(JSON.stringify(newProposals), {
                    extractedFields: fields,
                    fetchedCompilerContext: newCacheKey
                });
            }

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
        // The setIsLoading(false) will be handled by onRenderSuccess
        // to ensure the page is actually visible before hiding the loader.
        // We keep a longer fallback here just in case.
        setTimeout(() => setIsLoading(false), 1500);
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
            <div className="flex items-center justify-between px-4 py-1 bg-muted/30 border-b select-none z-10 shadow-sm h-10">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium truncate max-w-[200px] flex items-center gap-2">
                        Documento PDF
                    </span>
                    <div className="h-4 w-[1px] bg-border hidden sm:block" />
                    {isXfaAdobe && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 leading-none">
                            XFA
                        </span>
                    )}
                </div>

                {hasRefinerProposals ? (
                    <div className="flex items-center gap-2 absolute right-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors rounded-full"
                            onClick={handleRejectProposals}
                        >
                            <X className="h-4 w-4 mr-1.5" />
                            Rifiuta
                        </Button>
                        <Button
                            size="sm"
                            className="h-8 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-all shadow-sm"
                            onClick={handleAcceptProposals}
                        >
                            <Check className="h-4 w-4 mr-1.5" />
                            Accetta
                        </Button>
                    </div>
                ) : (
                    <>
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
                                        className={`text-blue-500 transition-transform ${isCompiling || isEyeSpinning ? 'animate-spin' : ''}`}
                                        size={26}
                                        strokeWidth={3}
                                    />
                                </div>
                            </Button>
                        </div>
                    </>
                )}
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
            <div
                ref={viewportRef}
                className="flex-1 overflow-auto bg-slate-100 flex justify-center p-4 scrollbar-thin group relative"
            >
                <div ref={containerRef} className="h-fit relative min-w-[300px] min-h-[400px] flex items-center justify-center">
                    {(isDocumentLoading || isLoading) && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500/20" />
                        </div>
                    )}

                    {error && !isDocumentLoading && (
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
                            options={documentOptions}
                            loading={null}
                        >
                            <div onMouseUp={handleTextSelection}>
                                <Page
                                    key={`${pageNumber}-${scale}-${rotation}`}
                                    pageNumber={pageNumber}
                                    scale={scale}
                                    rotate={rotation}
                                    renderAnnotationLayer={true}
                                    renderForms={true}
                                    renderTextLayer={true}
                                    onRenderSuccess={() => {
                                        applyProposalsToDom(proposals);
                                        setupFieldMentionListeners();
                                        // Small delay to ensure browser layout is stable
                                        setTimeout(() => setIsLoading(false), 50);
                                    }}
                                    className={`shadow-2xl transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'} ${isXfaAdobe ? 'xfa-lockout' : ''}`}
                                    loading={null}
                                />
                            </div>
                        </Document>
                    )}

                    {/* Mention Button Overlay - fixed to viewport via Portal */}
                    {mentionPosition && createPortal(
                        <div
                            className="fixed z-[99999] pointer-events-auto"
                            style={{
                                left: mentionPosition.x,
                                top: mentionPosition.y,
                                transform: 'translate(-50%, -100%)'
                            }}
                        >
                            <MentionButton onClick={handleMentionClick} />
                        </div>,
                        document.body
                    )}
                </div>
            </div>
        </Card>
    );
}
