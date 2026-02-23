import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Source {
    id: string;
    name: string;
    selected: boolean;
    type: string;
    size: number;
    url?: string;
    base64?: string;
    isMemory?: boolean;
    isMaster?: boolean; // Master source for formatting (Blue Check)
    isFillable?: boolean; // Native PDF Form Fields detected
    isAlreadyFilled?: boolean; // Threshold of filled fields detected
    isXfa?: boolean; // XFA (Adobe LiveCycle) technology detected
    isBypass?: boolean; // Bypass automated intelligence (Native PDF filling)
    driveId?: string; // Original Google Drive ID
}

interface SourcesContextType {
    sources: Source[];
    addSource: (file: File, options?: { isMemory?: boolean; driveId?: string }) => Promise<'success' | 'limit_reached' | 'duplicate' | 'file_too_large' | 'invalid_format' | 'error'>;
    removeSource: (id: string) => void;
    toggleSource: (id: string) => void;
    toggleMaster: (id: string) => void;
    toggleBypass: (id: string) => void;
    updateSource: (id: string, updates: Partial<Source>) => void;
    selectedSources: Source[];
    masterSource: Source | undefined; // New: Master Source Reference
    maxSources: number;
}

const SourcesContext = createContext<SourcesContextType | undefined>(undefined);

const MAX_SOURCES = 10;
const MAX_FILE_SIZE_MB = 30;

const ALLOWED_EXTENSIONS = [
    'pdf', 'docx', 'doc', 'txt', 'csv', 'rtf', 'md', 'json', 'jsonl', 'xml', 'html',
    'xlsx', 'xls',
    'jpg', 'jpeg', 'png', 'webp', 'heic',
    'mp3', 'wav', 'm4a'
];

export function SourcesProvider({ children }: { children: ReactNode }) {
    const [sources, setSources] = useState<Source[]>([]);

    const pendingUploads = React.useRef(0);

    const addSource = useCallback(async (file: File, options?: { isMemory?: boolean; driveId?: string }): Promise<'success' | 'limit_reached' | 'duplicate' | 'file_too_large' | 'invalid_format' | 'error'> => {
        // Increment pending uploads immediately
        pendingUploads.current += 1;

        try {
            // Synchronous check against limit using current state + pending count
            // We subtract 1 because we just incremented it, but we want to know if adding THIS file exceeds limit
            const currentTotal = sources.length + (pendingUploads.current - 1);

            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                console.warn(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
                return 'file_too_large';
            }

            const extension = file.name.split('.').pop()?.toLowerCase();
            if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
                console.warn(`Invalid file format: ${file.name}`);
                return 'invalid_format';
            }

            // Check limit synchronously
            if (!options?.isMemory) {
                // Check if existing + pending (excluding self) >= MAX
                if (currentTotal >= MAX_SOURCES) {
                    return 'limit_reached';
                }
            }

            // Check duplicates synchronously against current state
            if (sources.some(s => s.name === file.name)) {
                return 'duplicate';
            }

            // 0. Mime-type fallback based on extension (fix for mobile/WhatsApp uploads)
            let mimeType = file.type;
            if (!mimeType || mimeType === 'application/octet-stream') {
                if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
                else if (extension === 'png') mimeType = 'image/png';
                else if (extension === 'webp') mimeType = 'image/webp';
                else if (extension === 'pdf') mimeType = 'application/pdf';
            }

            let isFillable = false;
            let isAlreadyFilled = false;
            let isXfa = false;
            let isSigned = false;
            if (extension === 'pdf') {
                try {
                    const { PDFDocument, PDFName, PDFTextField } = await import('pdf-lib');
                    const arrayBuffer = await file.arrayBuffer();
                    const pdfDoc = await PDFDocument.load(arrayBuffer);

                    // 1. Surgical XFA detection (Adobe LiveCycle) - Improved Calibration
                    try {
                        const { PDFDict, PDFBool, PDFNumber } = await import('pdf-lib');

                        // CHECK 1: XFA key in AcroForm
                        const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));
                        let hasXfaKey = false;
                        if (acroFormRef) {
                            const acroFormNode = pdfDoc.context.lookup(acroFormRef);
                            if (acroFormNode instanceof PDFDict) {
                                if (acroFormNode.has(PDFName.of('XFA'))) {
                                    hasXfaKey = true;
                                }
                                // CHECK 2: Signatures (SigFlags)
                                const sigFlags = acroFormNode.get(PDFName.of('SigFlags'));
                                if (sigFlags instanceof PDFNumber) {
                                    // Bit 0 (value 1) indicates signatures exist
                                    if ((sigFlags.asNumber() & 1) !== 0) {
                                        isSigned = true;
                                    }
                                }
                            }
                        }

                        // CHECK 3: NeedsRendering flag (Dynamic XFA indicator - THE GOLD STANDARD)
                        const needsRef = pdfDoc.catalog.get(PDFName.of('NeedsRendering'));
                        const needsVal = needsRef ? pdfDoc.context.lookup(needsRef) : null;
                        const isDynamic = needsVal instanceof PDFBool && needsVal.asBoolean() === true;

                        // CHECK 4: Metadata Fingerprints (Used only as warning or secondary check)
                        const creator = pdfDoc.getCreator() || '';
                        const producer = pdfDoc.getProducer() || '';
                        const isAdobeDesigner = creator.includes('Designer') ||
                            producer.includes('Designer') ||
                            producer.includes('LiveCycle');

                        // --- CALIBRATION LOGIC ---
                        if (isDynamic || pdfDoc.isEncrypted || isSigned) {
                            isXfa = true;
                        }
                    } catch (e) {
                        console.warn('[SourcesContext] Adobe DNA check failed:', e);
                    }

                    const form = pdfDoc.getForm();
                    const allFields = form.getFields();

                    // 2. Deep Signature & Read-Only Check
                    const hasSignatureValue = allFields.some(f => {
                        try {
                            const acroField = (f as any).acroField;
                            return acroField.get(PDFName.of('FT')) === PDFName.of('Sig') && acroField.has(PDFName.of('V'));
                        } catch { return false; }
                    });

                    const fillableFields = allFields.filter(f => {
                        try {
                            return (f as any).acroField.getWidgets()?.length > 0;
                        } catch (e) {
                            return true;
                        }
                    });

                    const textFields = fillableFields.filter(f => f instanceof PDFTextField);
                    const editableTextFieldsCount = textFields.filter(f => {
                        try { return !f.isReadOnly(); } catch { return true; }
                    }).length;

                    const editableFieldsCount = fillableFields.filter(f => {
                        try { return !f.isReadOnly(); } catch { return true; }
                    }).length;

                    // --- CALIBRATION LOGIC 3.0 ---
                    const allTextLocked = textFields.length > 0 && editableTextFieldsCount === 0;

                    if (isSigned || hasSignatureValue || allTextLocked || (fillableFields.length > 0 && editableFieldsCount === 0)) {
                        isXfa = true;
                    }

                    isFillable = editableFieldsCount > 0;

                    if (isFillable) {
                        let filledCount = 0;
                        fillableFields.forEach(field => {
                            try {
                                let hasValue = false;
                                const f = field as any;
                                if (typeof f.getText === 'function') {
                                    if (f.getText()?.trim().length > 0) hasValue = true;
                                } else if (typeof f.isChecked === 'function') {
                                    if (f.isChecked()) hasValue = true;
                                } else if (typeof f.getSelected === 'function') {
                                    const selected = f.getSelected();
                                    if (selected && (!Array.isArray(selected) || selected.length > 0)) hasValue = true;
                                }
                                if (hasValue) filledCount++;
                            } catch (e) { }
                        });

                        if (filledCount > 0) {
                            isAlreadyFilled = true;
                        }
                    }
                } catch (error) {
                    console.warn('[SourcesContext] Error checking PDF XFA/fields:', error);
                }
            }

            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64Content = result.split(',')[1];
                    resolve(base64Content);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Functional state update to handle parallel uploads correctly
            let limitReached = false;
            let duplicateFound = false;

            setSources(prev => {
                if (!options?.isMemory) {
                    // Double check in state update just in case
                    const userSources = prev.filter(s => !s.isMemory);
                    if (userSources.length >= MAX_SOURCES) {
                        limitReached = true;
                        return prev;
                    }
                }

                if (prev.some(s => s.name === file.name)) {
                    duplicateFound = true;
                    return prev;
                }

                const newSource: Source = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    selected: true,
                    type: mimeType || file.type,
                    size: file.size,
                    base64: base64,
                    isMemory: options?.isMemory,
                    isFillable: isFillable,
                    isAlreadyFilled: isAlreadyFilled,
                    isXfa: isXfa,
                    driveId: options?.driveId
                };

                return [...prev, newSource];
            });

            if (limitReached) return 'limit_reached';
            if (duplicateFound) return 'duplicate';

            return 'success';
        } catch (error) {
            console.error('Error reading file:', error);
            return 'error';
        } finally {
            // Decrement pending uploads when done or if error occurred
            pendingUploads.current = Math.max(0, pendingUploads.current - 1);
        }
    }, [sources]);

    const removeSource = useCallback((id: string) => {
        setSources(prev => prev.filter(s => s.id !== id));
    }, []);

    const toggleSource = useCallback((id: string) => {
        setSources(prev =>
            prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s))
        );
    }, []);

    const toggleMaster = useCallback((id: string) => {
        setSources(prev => prev.map(s => {
            if (s.id === id) {
                const isNowMaster = !s.isMaster;
                return {
                    ...s,
                    isMaster: isNowMaster,
                    selected: isNowMaster ? true : s.selected // Auto-select when pinning
                };
            }
            return { ...s, isMaster: false }; // Ensure only one master source at a time
        }));
    }, []);

    const toggleBypass = useCallback((id: string) => {
        setSources(prev => prev.map(s => (s.id === id ? { ...s, isBypass: !s.isBypass } : s)));
    }, []);

    const updateSource = useCallback((id: string, updates: Partial<Source>) => {
        setSources(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
    }, []);

    const selectedSources = sources.filter(s => !s.isMemory && s.selected);
    const masterSource = sources.find(s => s.isMaster);

    return (
        <SourcesContext.Provider
            value={{
                sources,
                addSource,
                removeSource,
                toggleSource,
                toggleMaster,
                toggleBypass,
                updateSource,
                selectedSources,
                masterSource,
                maxSources: MAX_SOURCES
            }}
        >
            {children}
        </SourcesContext.Provider>
    );
}

export function useSources() {
    const context = useContext(SourcesContext);
    if (!context) {
        throw new Error('useSources must be used within a SourcesProvider');
    }
    return context;
}
