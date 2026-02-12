/// <reference types="chrome"/>
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
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
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useSystemFonts: true,
        // In offscreen DOM, we can potentially use font loading if needed
    });

    const doc = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + "\n";

        // Annotation Extraction
        try {
            const annotations = await page.getAnnotations();
            if (annotations && annotations.length > 0) {
                const formFields = annotations.filter((ann: any) => ann.subtype === 'Widget');
                if (formFields.length > 0) {
                    fullText += `\n--- PAGE ${i} FORM DATA (ANNOTATIONS) ---\n`;
                    formFields.forEach((ann: any) => {
                        const name = ann.fieldName || ann.alternativeText || ann.id;
                        const value = ann.fieldValue || ann.buttonValue || ann.textContent || "";
                        if (value && String(value).trim() !== "") {
                            fullText += `${name}: ${value}\n`;
                        }
                    });
                    fullText += `--- END PAGE ${i} FORM DATA ---\n`;
                }
            }
        } catch (annError) {
            console.warn(`[GromitOffscreen] Error extracting annotations on page ${i}:`, annError);
        }
    }

    // AcroForm Extraction
    let formText = "";
    try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        if (fields.length > 0) {
            formText += "\n\n--- DATI MODULO (ACROFORM) ---\n";
            fields.forEach(field => {
                try {
                    const name = field.getName();
                    let value: string | boolean = "";

                    if (field instanceof PDFTextField) {
                        value = field.getText() || "";
                    } else if (field instanceof PDFCheckBox) {
                        value = field.isChecked() ? "Sì" : "No";
                    } else if (field instanceof PDFDropdown) {
                        const selected = field.getSelected();
                        value = selected ? selected.join(', ') : "";
                    } else if (field instanceof PDFOptionList) {
                        const selected = field.getSelected();
                        value = selected ? selected.join(', ') : "";
                    } else if (field instanceof PDFRadioGroup) {
                        value = field.getSelected() || "";
                    }

                    if (value !== null && value !== undefined && String(value).trim() !== "") {
                        formText += `${name}: ${value}\n`;
                    }
                } catch (fieldError) {
                    console.warn(`[GromitOffscreen] Error reading field:`, fieldError);
                }
            });
            formText += "--- FINE DATI MODULO ---\n";
        }
    } catch (e) {
        console.warn("[GromitOffscreen] Errore estrazione AcroForm:", e);
    }
    return fullText + formText;
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
