/// <reference types="chrome"/>
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import Tesseract from 'tesseract.js';
// import { GlobalWorkerOptions } from 'pdfjs-dist'; // Avoid direct import triggers
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Configure PDF Worker
// In offscreen document, we can use the bundled worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.js');

console.log('[GromitOffscreen] Initialized.');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'EXTRACT_FROM_OFFSCREEN') {
        const { fileBase64, fileName, fileType } = request;

        (async () => {
            try {
                console.log(`[GromitOffscreen] Extracting text for ${fileName} (${fileType})...`);
                const arrayBuffer = base64ToArrayBuffer(fileBase64);
                let text = "";

                if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                    text = await extractPdfText(arrayBuffer);
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
            }
        })();

        return true; // Keep channel open
    }

    // --- NEW: OLLAMA_FETCH_OFFSCREEN ---
    // Executed in DOM context (Offscreen), immune to Service Worker termination
    if (request.type === 'OLLAMA_FETCH_OFFSCREEN') {
        const { url, options } = request;
        console.log(`[GromitOffscreen] Executing fetch for: ${url}`);

        const fetchOptions: any = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            body: options.body,
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        };

        fetch(url, fetchOptions)
            .then(async response => {
                const ok = response.ok;
                const status = response.status;
                // If it's a 204 No Content, text() might be empty. 
                // We use text() then try parse to avoid errors on empty bodies.
                const text = await response.text().catch(() => "");
                let data = {};
                try {
                    data = text ? JSON.parse(text) : {};
                } catch (e) {
                    // console.warn("Response was not JSON", text);
                    data = { raw: text };
                }

                sendResponse({ success: true, ok, status, data });
            })
            .catch(error => {
                console.error('[GromitOffscreen] Fetch Error:', error);
                sendResponse({ success: false, error: error.message });
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

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
    // 1. AcroForm Extraction (Form-First Strategy)
    let formHeader = "";
    try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        // Count valid fields first
        let validFieldsCount = 0;
        let tempHeader = "";

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

                // HEURISTIC: Clean up the field name to make it look like a "Question" or Label
                // 1. Remove XFA path noise (topmostSubform[0]...)
                let cleanName = name.split('.').pop() || name;
                // 2. Remove array indices [0]
                cleanName = cleanName.replace(/\[\d+\]/g, '');
                // 3. Remove prefixes like "f1_" or "c1_" if present (common in IRS forms)
                cleanName = cleanName.replace(/^[fc]\d+_/, '');
                // 4. Split camelCase or snake_case into words, but keep it tight
                cleanName = cleanName.replace(/_/g, ' ').trim();

                // STRICT CHECK: Only include if value is non-empty and meaningful
                if (value && value.trim().length > 0 && value !== "Off") {
                    // Format: "LABEL: VALUE" (Simple and Direct)
                    tempHeader += `${cleanName}: ${value}\n`;
                    validFieldsCount++;
                }
            } catch (err) { /* Ignore specific field error */ }
        });

        if (validFieldsCount > 0) {
            // Use a very simple header that looks like document text
            formHeader += "--- [GROMIT INSIGHT] DATI ESTRATTI DAL MODULO ---\n";
            formHeader += tempHeader;
            formHeader += "--- FINE DATI MODULO ---\n\n";
        }
    } catch (e) {
        console.warn("[GromitOffscreen] AcroForm extraction failed:", e);
    }

    // 2. Standard Text Extraction (pdf.js)
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useSystemFonts: true,
    });

    const doc = await loadingTask.promise;
    let bodyText = "";

    try {
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();

            // Basic text stitching
            const pageText = content.items.map((item: any) => item.str).join(' ');

            // Only add to bodyText if there is actual content
            if (pageText.trim().length > 10) {
                bodyText += `--- PAGINA ${i} ---\n${pageText}\n\n`;
            }
        }
    } catch (err) {
        console.error("[GromitOffscreen] pdf.js extraction failed:", err);
    }

    // 3. OCR Fallback (Tesseract.js)
    // Check clean length. If < 50 chars, we assume it's a scan (or just empty).
    if (bodyText.replace(/\s/g, '').length < 50 && doc.numPages > 0) {
        console.log("[GromitOffscreen] Testo insufficiente. Attivazione OCR Tesseract Multipage...");
        try {
            // @ts-ignore
            Tesseract.setLogging(true);
            const wPath = chrome.runtime.getURL('worker.min.js');
            const cPath = chrome.runtime.getURL(''); // Base root for auto-selection of core variants

            console.log(`[GromitOffscreen] OCR Config: workerPath=${wPath}, corePath=${cPath}`);

            const worker = await Tesseract.createWorker('eng', 1, {
                workerPath: wPath,
                corePath: cPath,
                workerBlobURL: false, // Forcing direct load to bypass blob origin restrictions
                logger: m => console.log("[TESSERACT]", m)
            });

            formHeader += "\n[GROMIT VISION] OCR Attivato (Modalità Locale - Scansione).\n";

            // OCR Configuration: Limit pages and adjust scale for performance
            const MAX_PAGES_OCR = Math.min(doc.numPages, 3);
            let ocrFullText = "";
            const startTime = Date.now();

            for (let i = 1; i <= MAX_PAGES_OCR; i++) {
                console.log(`[GromitOffscreen] OCR Processing Page ${i}/${MAX_PAGES_OCR}...`);
                const page = await doc.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 }); // Balanced scale for speed/accuracy
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const context = canvas.getContext('2d');

                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

                    if (blob) {
                        const { data: { text } } = await worker.recognize(blob);
                        // Clean each page's text immediately to save memory
                        // We want "Flowing Text" essentially
                        const pageClean = text
                            .replace(/[\r\n]+/g, ' ') // Flatten lines
                            .replace(/\s+/g, ' ')      // Collapse spaces
                            .trim();

                        ocrFullText += pageClean + "\n\n";
                    }
                }
            }

            await worker.terminate();
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[GromitOffscreen] OCR Complete in ${duration}s. Chars: ${ocrFullText.length}`);

            // Final Cleanup & Truncation (Max 4500 chars for LLM safety)
            const TRUNCATION_LIMIT = 4500;
            if (ocrFullText.length > TRUNCATION_LIMIT) {
                ocrFullText = ocrFullText.substring(0, TRUNCATION_LIMIT) + "\n...[TESTO TRONCATO PER LIMITI MEMORIA]";
            }

            bodyText = ocrFullText; // Replace the empty bodyText with OCR result

            // SECURITY: Clear intermediate variables
            ocrFullText = "";

        } catch (ocrErr: any) {
            console.error("[GromitOffscreen] OCR Failed:", ocrErr);
            const errDetail = ocrErr.message || (typeof ocrErr === 'string' ? ocrErr : JSON.stringify(ocrErr));
            formHeader += `\n[ERRORE OCR] ${errDetail}\n`;
        }
    }

    // Combined Result: Header (Forms) + Body (Text/OCR)
    const finalResult = formHeader + bodyText;

    // SECURITY: Clear text variables before return (Hint for GC)
    formHeader = "";
    bodyText = "";

    return finalResult;
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
