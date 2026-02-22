/// <reference types="chrome"/>
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFRef } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// import { GlobalWorkerOptions } from 'pdfjs-dist'; // Avoid direct import triggers
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Configure PDF Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');
// (pdfjsLib as any).verbosity = 1; // Removed: Immutable export in namespace

const EXTENSION_ID = chrome.runtime.id;
let extractionLock: Promise<void> | null = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_FROM_OFFSCREEN') {
        const { fileBase64, fileName, fileType } = request;

        (async () => {
            // WAIT for previous extraction to finish (Safety Lock)
            if (extractionLock) {
                console.log(`[GromitOffscreen] Waiting for previous extraction to finish before starting ${fileName}...`);
                await extractionLock;
            }

            let resolveLock: () => void;
            extractionLock = new Promise((resolve) => { resolveLock = resolve; });

            try {
                console.log(`[GromitOffscreen] Extracting text for ${fileName} (${fileType})...`);
                const arrayBuffer = base64ToArrayBuffer(fileBase64);
                let text = "";

                if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                    text = await extractPdfText(arrayBuffer, fileName, fileBase64);
                } else if (fileType.startsWith('image/') || fileName.match(/\.(png|jpe?g|webp|bmp)$/i)) {
                    // NEW (v5.8.11): Swift Native OCR for high-quality images
                    text = await extractImageText(arrayBuffer, fileName, fileBase64);
                } else if (
                    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    fileName.endsWith('.docx')
                ) {
                    text = await extractDocxText(arrayBuffer);
                } else if (
                    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    fileType === 'application/vnd.ms-excel' ||
                    fileName.endsWith('.xlsx') ||
                    fileName.endsWith('.xls')
                ) {
                    text = await extractXlsxText(arrayBuffer);
                } else {
                    // Plain text fallback
                    text = new TextDecoder("utf-8").decode(arrayBuffer);
                }

                text = cleanText(text);
                console.log(`[GromitOffscreen] Extraction complete. Length: ${text.length}`);
                sendResponse({ success: true, text });
            } catch (error: any) {
                console.error('[GromitOffscreen] Extraction Error:', error);
                sendResponse({ success: false, error: error.message });
            } finally {
                extractionLock = null;
                if (resolveLock!) resolveLock();
            }
        })();

        return true; // Keep channel open
    }

    // --- NEW: OLLAMA_FETCH_OFFSCREEN ---
    // Executed in DOM context (Offscreen), immune to Service Worker termination
    if (request.type === 'OLLAMA_FETCH_OFFSCREEN') {
        const { url, options } = request;
        console.log(`[GromitOffscreen] Fetching: ${url} (${options.method || 'GET'})`);

        const fetchOptions: any = {
            method: options.method || 'GET',
            headers: {
                ...(options.headers || {})
            },
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        };

        // Only add body if it's not a GET/HEAD request
        if (options.body && fetchOptions.method !== 'GET' && fetchOptions.method !== 'HEAD') {
            fetchOptions.body = options.body;
            // Ensure Content-Type if not set
            if (!fetchOptions.headers['Content-Type']) {
                fetchOptions.headers['Content-Type'] = 'application/json';
            }
        }

        fetch(url, fetchOptions)
            .then(async response => {
                const ok = response.ok;
                const status = response.status;
                const text = await response.text().catch(() => "");
                let data = {};
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (e) {
                    data = { raw: text };
                }

                console.log(`[GromitOffscreen] Fetch Success. Status: ${status}`);
                sendResponse({ success: true, ok, status, data });
            })
            .catch(error => {
                // SILENT CONNECTIVITY: Downgrade to debug for network errors
                if (!error.status || error.status === 0) {
                    console.debug('[GromitOffscreen] Fetch failed (System Offline):', url);
                } else {
                    console.error('[GromitOffscreen] Fetch Fatal Error:', error);
                }
                sendResponse({
                    success: false,
                    error: error.message || "Network Error",
                    status: 0 // Distinguish from server errors
                });
            });

        return true;
    }
});


// --- HELPER FUNCTIONS ---

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+\n/g, '\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// --- EXTRACTORS ---

async function extractPdfText(arrayBuffer: ArrayBuffer, fileName: string, fileBase64: string): Promise<string> {
    interface PageItem {
        type: 'text' | 'field';
        str: string;
        x: number;
        y: number;
        w: number;
        h: number;
    }

    const allPageItems: PageItem[][] = [];

    // 1. AcroForm Extraction (Position-Aware)
    const fieldMap = new Map<number, PageItem[]>();
    try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        fields.forEach(field => {
            try {
                const name = field.getName();
                let value: string = "";

                if (field instanceof PDFTextField) {
                    value = field.getText() || "";
                } else if (field instanceof PDFCheckBox) {
                    value = field.isChecked() ? "Sì" : "No";
                } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
                    const selected = field.getSelected();
                    value = selected ? selected.join(', ') : "";
                } else if (field instanceof PDFRadioGroup) {
                    value = field.getSelected() || "";
                }

                if (value && value.trim().length > 0 && value !== "Off") {
                    const widgets = field.acroField.getWidgets();
                    widgets.forEach(widget => {
                        const pages = pdfDoc.getPages();
                        // Find which page this widget belongs to (this is a bit slow but necessary)
                        // Actually, widget.P (Parent page) is often available or we can find it
                        const pageRef = widget.P();
                        let pageIndex = -1;
                        if (pageRef) {
                            pageIndex = pages.findIndex(p => p.ref === pageRef);
                        }

                        // Fallback: search all pages if pageRef is missing
                        if (pageIndex === -1) {
                            // Safer fallback: iterate through pages and check annotations (widgets)
                            pageIndex = pages.findIndex(p => {
                                const annots = p.node.Annots();
                                if (!annots) return false;
                                // In pdf-lib, widget doesn't expose 'ref' directly easily, 
                                // but we can check if the widget fruit is the same.
                                return annots.asArray().some(a => {
                                    if (!(a instanceof PDFRef)) return false;
                                    const lookup = pdfDoc.context.lookup(a);
                                    return lookup === widget.dict;
                                });
                            });
                        }

                        if (pageIndex !== -1) {
                            const rect = widget.getRectangle();
                            if (!fieldMap.has(pageIndex)) fieldMap.set(pageIndex, []);
                            fieldMap.get(pageIndex)!.push({
                                type: 'field',
                                str: value,
                                x: rect.x,
                                y: rect.y,
                                w: rect.width,
                                h: rect.height
                            });
                        }
                    });
                }
            } catch (err) { /* Ignore specific field error */ }
        });
    } catch (e) {
        console.warn("[GromitOffscreen] AcroForm extraction failed:", e);
    }

    // 2. Standard Text Extraction (pdf.js) with spatial awareness
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useSystemFonts: false,
        disableFontFace: true,
        enableXfa: true,
    });

    const doc = await loadingTask.promise;
    let fullText = "";

    try {
        for (let i = 1; i <= doc.numPages; i++) {
            const pageIndex = i - 1;
            const page = await doc.getPage(i);
            const content = await page.getTextContent();

            const items: PageItem[] = content.items.map((item: any) => ({
                type: 'text',
                str: item.str,
                x: item.transform[4],
                y: item.transform[5],
                w: item.width || 0,
                h: item.height || 0
            }));

            // Add fields for this page
            if (fieldMap.has(pageIndex)) {
                items.push(...fieldMap.get(pageIndex)!);
            }

            // 3. SPATIAL INTERLEAVING
            // Sort by Y descending (top to bottom), then X ascending (left to right)
            const Y_THRESHOLD = 5; // Points tolerance for same line
            items.sort((a, b) => {
                if (Math.abs(a.y - b.y) > Y_THRESHOLD) {
                    return b.y - a.y;
                }
                return a.x - b.x;
            });

            // Group into lines to handle spacing
            let pageText = "";
            let currentLineY = items.length > 0 ? items[0].y : 0;

            items.forEach((item, idx) => {
                const isNewText = item.type === 'text';
                const prefix = (Math.abs(item.y - currentLineY) > Y_THRESHOLD) ? "\n" : " ";

                if (item.type === 'field') {
                    // Inject value. If it follows a text item closely, use a colon or just space.
                    // We'll just use a space to let the LLM see "Label Value"
                    pageText += ` ${item.str}`;
                } else {
                    pageText += (idx === 0 ? "" : prefix) + item.str;
                }

                currentLineY = item.y;
            });

            if (pageText.trim().length > 10) {
                fullText += pageText + "\n\n";
            }
        }
    } catch (err) {
        console.error("[GromitOffscreen] pdf.js extraction failed:", err);
    }

    // 4. OCR Detection (Fallback)
    if (fullText.replace(/\s/g, '').length < 50 && doc.numPages > 0) {
        console.log("[GromitOffscreen] Testo insufficiente. Richiesta Swift Native OCR Bridge...");
        try {
            const nativeResponse = await Promise.race([
                chrome.runtime.sendMessage({
                    type: 'NATIVE_OCR',
                    fileBase64: fileBase64,
                    fileName: fileName
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("NATIVE_OCR_TIMEOUT")), 20000))
            ]);

            if (nativeResponse && nativeResponse.success && nativeResponse.text?.trim()) {
                return nativeResponse.text.trim();
            }
            return "[[GROMIT_SCAN_DETECTED]]";
        } catch (err) {
            console.warn("[GromitOffscreen] Native OCR skipped:", err);
            return "[[GROMIT_SCAN_DETECTED]]";
        }
    }

    return fullText.trim();
}

/**
 * Direct Image OCR (PNG, JPG, weBP)
 * EXCLUSIVELY Swift Native Bridge (v5.8.12)
 */
async function extractImageText(arrayBuffer: ArrayBuffer, fileName: string, fileBase64: string): Promise<string> {
    try {
        console.log(`[GromitOffscreen] Image OCR: Calling Swift Native Bridge for ${fileName}...`);
        const nativeResponse = await Promise.race([
            chrome.runtime.sendMessage({
                type: 'NATIVE_OCR',
                fileBase64: fileBase64,
                fileName: fileName
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("NATIVE_OCR_TIMEOUT")), 20000))
        ]);

        if (nativeResponse && nativeResponse.success && nativeResponse.text?.trim()) {
            return nativeResponse.text.trim();
        }

        return "[[GROMIT_SCAN_DETECTED]]";
    } catch (err) {
        console.error("[GromitOffscreen] Direct Image OCR failed:", err);
        return "[[GROMIT_SCAN_DETECTED]]";
    }
}

async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

async function extractXlsxText(arrayBuffer: ArrayBuffer): Promise<string> {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = "";
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(sheet);
        if (sheetText.trim()) {
            fullText += `[FOGLIO: ${sheetName}]\n${sheetText}\n\n`;
        }
    });
    return fullText;
}
