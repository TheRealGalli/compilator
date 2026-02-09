import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFDocument, PDFName, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';

// Initialize PDF.js worker
const PDFJS_VERSION = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;

export interface ExtractedDocument {
    name: string;
    text: string;
    type: string;
}

/**
 * Extracts raw text from a File object entirely within the browser.
 */
export async function extractTextLocally(file: File): Promise<string> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            return await extractPdfText(file);
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileName.endsWith('.docx')
        ) {
            return await extractDocxText(file);
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            fileType === 'application/vnd.ms-excel' ||
            fileName.endsWith('.xlsx') ||
            fileName.endsWith('.xls')
        ) {
            return await extractXlsxText(file);
        } else if (
            fileType.startsWith('text/') ||
            fileName.endsWith('.txt') ||
            fileName.endsWith('.md') ||
            fileName.endsWith('.csv') ||
            fileName.endsWith('.json') ||
            fileName.endsWith('.xml') ||
            fileName.endsWith('.html')
        ) {
            return await extractPlainText(file);
        } else {
            console.warn(`[LocalExtractor] Unsupported file type for local text extraction: ${fileType}`);
            return `[ERRORE: Tipo file non supportato per estrazione locale: ${fileName}]`;
        }
    } catch (error) {
        console.error(`[LocalExtractor] Error extracting text from ${fileName}:`, error);
        return `[ERRORE: Impossibile leggere il file ${fileName}. Dettagli: ${error}]`;
    }
}

async function extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();

    // 1. Standard text extraction (PDF.js)
    const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer.slice(0), // Clone buffer as it might be detached
        useWorkerFetch: true,
        isEvalSupported: false,
        useSystemFonts: true
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
    }

    // 2. Form Fields Extraction (pdf-lib) - "AcroForms"
    let formText = "";
    try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        if (fields.length > 0) {
            formText += "\n\n--- DATI MODULO (ACROFORM) ---\n";
            fields.forEach(field => {
                const name = field.getName();
                let value = "";

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

                if (value && value.trim() !== "") {
                    formText += `${name}: ${value}\n`;
                }
            });
            formText += "--- FINE DATI MODULO ---\n";
        }
    } catch (e) {
        console.warn("[LocalExtractor] Errore estrazione AcroForm:", e);
        // Don't fail the whole extraction if forms fail
    }

    // 3. Fallback: Se il testo è troppo breve (< 50 chars), potrebbe essere una scansione (immagine)
    if (fullText.length < 50 && formText.length < 50) {
        console.warn("[LocalExtractor] PDF sembra essere una scansione (poco testo trovato). OCR richiesto.");
        return fullText + formText + "\n\n[AVVISO: Il documento sembra essere una scansione. L'OCR locale non è ancora attivo. Il testo potrebbe non essere stato estratto correttamente.]";
        // TODO: Integrare Tesseract.js qui per OCR locale
    }

    return cleanText(fullText + formText);
}

async function extractDocxText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return cleanText(result.value);
}

async function extractXlsxText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = "";

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(sheet); // Simple text dump
        if (sheetText.trim()) {
            fullText += `[FOGLIO: ${sheetName}]\n${sheetText}\n\n`;
        }
    });

    return cleanText(fullText);
}

/**
 * Cleans extracted text to remove noise and normalize whitespace.
 * Helps regex/LLM processing by ensuring consistent formatting.
 */
function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')           // Normalize newlines
        .replace(/\u00A0/g, ' ')          // Replace non-breaking spaces
        .replace(/[ \t]+/g, ' ')          // Collapse multiple spaces/tabs
        .replace(/\n\s+\n/g, '\n\n')      // Collapse spaces in empty lines
        .replace(/\n{3,}/g, '\n\n')       // Max 2 newlines
        .trim();
}

// --- HYBRID PII EXTRACTION REMOVED ---
// Redirected to ollama.ts for Full Context Strategy



// Helper for local plaintext extraction
async function extractPlainText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(cleanText(reader.result as string));
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

