/// <reference types="chrome"/>
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// import { GlobalWorkerOptions } from 'pdfjs-dist'; // Avoid direct import if possible to prevent worker issues
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Gromit Bridge Background Script v4.0.0 (Unified Sanctuary)
// Supports: OLLAMA_FETCH, OLLAMA_PII_TURBO, EXTRACT_AND_ANALYZE, GET_VERSION

const BRIDGE_VERSION = '4.0.0';

// 64k token context ≈ 150k chars (leaving room for prompt/response)
const MAX_CHUNK_CHARS = 150000;
const PARALLEL_SLOTS = 4;

// CONFIGURATION: Set worker to null to force main thread (simplest for extension environment)
// or point to a local worker file if needed. For now, let's try standard main thread.
// For now, we will try running without worker or reliable local worker.
// Actually, pdfjs-dist often includes a worker. Let's try standard import.
// FIX: Explicitly disable worker for extension environment to avoid "No workerSrc specified" error
// FIX: Use local bundled worker to avoid "import() is disallowed" error in Service Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {

    // --- GET_VERSION: Returns bridge version ---
    if (request.type === 'GET_VERSION') {
        sendResponse({ version: BRIDGE_VERSION });
        return true;
    }

    // --- EXTRACT_AND_ANALYZE: The new "Sanctuary" logic ---
    if (request.type === 'EXTRACT_AND_ANALYZE') {
        const { fileBase64, fileName, fileType } = request;

        (async () => {
            try {
                console.log(`[GromitBridge] Extracting text for ${fileName} (${fileType})...`);
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
                console.log(`[GromitBridge] Extraction complete. Length: ${text.length}`);

                // Return result
                sendResponse({ success: true, text });
            } catch (error: any) {
                console.error('[GromitBridge] Extraction Error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();

        return true; // Keep channel open
    }

    // --- OLLAMA_FETCH: Simple fetch proxy ---
    if (request.type === 'OLLAMA_FETCH') {
        const { url, options } = request;

        console.log('[GromitBridge] Eseguo fetch (Background):', url);

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
                const data = await response.json().catch(() => ({}));
                sendResponse({ success: true, ok, status, data });
            })
            .catch(error => {
                console.error('[GromitBridge] Errore Fetch:', error);
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }

    // --- OLLAMA_PII_TURBO: Full PII extraction with smart chunking ---
    if (request.type === 'OLLAMA_PII_TURBO') {
        const { text, url, model, systemPrompt } = request;

        console.log(`[GromitBridge] TURBO PII v3.5: Analyzing ${text.length} chars...`);

        // Smart chunking: split if exceeds limit
        const chunks = [];
        if (text.length <= MAX_CHUNK_CHARS) {
            chunks.push(text);
        } else {
            // Split into chunks with overlap
            const OVERLAP = 2000;
            for (let i = 0; i < text.length; i += (MAX_CHUNK_CHARS - OVERLAP)) {
                chunks.push(text.substring(i, i + MAX_CHUNK_CHARS));
                if (i + MAX_CHUNK_CHARS >= text.length) break;
            }
            console.log(`[GromitBridge] Document split into ${chunks.length} chunks (${MAX_CHUNK_CHARS} chars each)`);
        }

        // Process chunks in parallel (max PARALLEL_SLOTS at a time)
        const processChunk = async (chunk: string, chunkIndex: number) => {
            const payload = {
                model: model || 'gemma3:1b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `<INPUT_DATA>\n${chunk}\n</INPUT_DATA>` }
                ],
                stream: false,
                options: {
                    temperature: 0.1,
                    num_ctx: 65536,  // 64k token context
                    num_predict: 4096,
                }
            };

            try {
                const response = await fetch(`${url}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    mode: 'cors',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer'
                });

                if (!response.ok) {
                    throw new Error(`Ollama error: ${response.status}`);
                }

                const data = await response.json();
                const rawResponse = data.message?.content || '';

                console.log(`[GromitBridge] Chunk ${chunkIndex + 1}/${chunks.length} response (first 300 chars):`, rawResponse.substring(0, 300));

                // Parse [LABEL] value format
                const findings: any[] = [];
                const lines = rawResponse.split('\n');

                for (const line of lines) {
                    const match = line.trim().match(/^\[([A-Z_]+)\]\s*(.*)$/i);
                    if (match) {
                        const category = match[1].toUpperCase();
                        const value = match[2].trim();

                        // Filter out placeholders
                        const isPlaceholder = /\[.*\]|example|not specified|information not|synthetic|NOME_PERSONA_\d+/i.test(value);

                        if (value && value.length > 2 && !isPlaceholder) {
                            findings.push({ value, category });
                        }
                    }
                }

                console.log(`[GromitBridge] Chunk ${chunkIndex + 1}: Found ${findings.length} items`);
                return findings;
            } catch (error) {
                console.error(`[GromitBridge] Chunk ${chunkIndex + 1} Error:`, error);
                return [];
            }
        };

        // Process in batches of PARALLEL_SLOTS
        (async () => {
            const allFindings: any[] = [];
            const seenValues = new Set();

            for (let i = 0; i < chunks.length; i += PARALLEL_SLOTS) {
                const batch = chunks.slice(i, i + PARALLEL_SLOTS);
                console.log(`[GromitBridge] Processing batch ${Math.floor(i / PARALLEL_SLOTS) + 1}/${Math.ceil(chunks.length / PARALLEL_SLOTS)} (${batch.length} chunks in parallel)`);

                const batchResults = await Promise.all(
                    batch.map((chunk, idx) => processChunk(chunk, i + idx))
                );

                // Deduplicate findings
                for (const findings of batchResults) {
                    for (const f of findings) {
                        const key = `${f.value.toLowerCase()}|${f.category}`;
                        if (!seenValues.has(key)) {
                            allFindings.push(f);
                            seenValues.add(key);
                        }
                    }
                }
            }

            console.log(`[GromitBridge] TURBO PII Complete: Found ${allFindings.length} unique items`);
            sendResponse({ findings: allFindings });
        })();

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
    // 1. Standard text extraction (PDF.js)
    // NOTE: In extension background, we rely on main thread execution or implicit worker
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        useWorkerFetch: false,
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

        // 1b. Annotation Extraction (PDF.js)
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
            console.warn(`[GromitBridge] Error extracting annotations on page ${i}:`, annError);
        }
    }

    // 2. Form Fields Extraction (pdf-lib) - "AcroForms"
    let formText = "";
    try {
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        console.log(`[GromitBridge] Found ${fields.length} AcroForm fields.`);

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
                    console.warn(`[GromitBridge] Error reading field:`, fieldError);
                }
            });
            formText += "--- FINE DATI MODULO ---\n";
        }
    } catch (e) {
        console.warn("[GromitBridge] Errore estrazione AcroForm:", e);
    }
    return fullText + formText;
}

async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

async function extractXlsxText(arrayBuffer: ArrayBuffer): Promise<string> {
    // XLSX read might need Uint8Array or similar
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
