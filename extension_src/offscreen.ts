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

                // HEURISTIC: Clean up the field name to make it look like a "Question"
                // 1. Remove XFA path noise (topmostSubform[0]...)
                let cleanName = name.split('.').pop() || name;
                // 2. Remove array indices [0]
                cleanName = cleanName.replace(/\[\d+\]/g, '');
                // 3. Split camelCase or snake_case into words
                cleanName = cleanName.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

                // STRICT CHECK: Only include if value is non-empty and non-trivial
                if (value && value.trim().length > 0) {
                    // Format: "QUESTION: ANSWER"
                    // We treat the cleaned field name as the "Question" context for the LLM
                    tempHeader += `${cleanName}: ${value}\n`;
                    validFieldsCount++;
                }
            } catch (err) { /* Ignore specific field error */ }
        });

        if (validFieldsCount > 0) {
            formHeader += "--- [GROMIT INSIGHT] DATI MODULO (Contesto) ---\n";
            formHeader += tempHeader;
            formHeader += "--- FINE CONTESTO MODULO ---\n\n";
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

            if (pageText.trim().length > 0) {
                bodyText += `--- PAGINA ${i} ---\n${pageText}\n\n`;
            } else {
                // Potential Scanned Page -> Trigger OCR?
                // For now, we mark it. Tesseract implementation will follow if this is empty.
                bodyText += `--- PAGINA ${i} (Possibile Scansione) ---\n`;
            }
        }
    } catch (err) {
        console.error("[GromitOffscreen] pdf.js extraction failed:", err);
    }

    // 3. OCR Fallback (Tesseract.js)
    // If bodyText is too short (< 50 chars) and we have pages, it's likely a scan.
    if (bodyText.replace(/\s/g, '').length < 50 && doc.numPages > 0) {
        console.log("[GromitOffscreen] Testo insufficiente. Attivazione OCR Tesseract...");
        try {
            // @ts-ignore
            const { createWorker } = Tesseract;

            // Configure worker to use local files
            const worker = await createWorker('eng', 1, {
                workerPath: chrome.runtime.getURL('worker.min.js'),
                corePath: chrome.runtime.getURL('tesseract-core.wasm.js'),
                logger: m => console.log(m)
            });

            formHeader += "\n[GROMIT VISION] OCR Attivato (Modalità Locale).\n";

            // Convert page 1 to image for OCR (Proof of Concept)
            // Ideally: Iterate all pages -> Render Canvas -> OCR
            const page = await doc.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');

            if (context) {
                await page.render({ canvasContext: context, viewport }).promise;
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

                if (blob) {
                    // OCR Magic using Local Worker
                    const { data: { text } } = await worker.recognize(blob);
                    bodyText += `\n--- PAGINA 1 (OCR) ---\n${text}\n\n`;
                } else {
                    formHeader += "\n[ERRORE] Impossibile convertire canvas in blob.\n";
                }

                await worker.terminate();
            } else {
                formHeader += "\n[ERRORE] Impossibile creare contesto canvas per OCR.\n";
            }

        } catch (ocrErr: any) {
            console.error("[GromitOffscreen] OCR Failed:", ocrErr);
            formHeader += `\n[ERRORE OCR] ${ocrErr.message}\n`;
        }
    }

    // Combined Result: Header (Forms) + Body (Text/OCR)
    return formHeader + bodyText;
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
