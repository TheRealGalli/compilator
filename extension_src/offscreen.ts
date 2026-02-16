/// <reference types="chrome"/>
import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib';
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
                    text = await extractPdfText(arrayBuffer);
                } else if (fileType.startsWith('image/') || fileName.match(/\.(png|jpe?g|webp|bmp)$/i)) {
                    // NEW (v5.5.1): Direct OCR for images
                    text = await extractImageText(arrayBuffer);
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

/**
 * Robust OCR Helper (v5.5.7): Guarantees RGBA data for TextDetector.
 * PDF.js images are often RGB (3) or Gray (1), but ImageData needs RGBA (4).
 */
function convertToRGBA(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8ClampedArray {
    const totalPixels = width * height;
    const rgba = new Uint8ClampedArray(totalPixels * 4);

    if (!data || data.length === 0) return rgba;

    // CASE 1: RGBA (4 channels)
    if (data.length === totalPixels * 4) {
        return data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
    }

    // CASE 2: RGB (3 channels)
    if (data.length === totalPixels * 3) {
        for (let i = 0; i < totalPixels; i++) {
            rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = 255;
        }
        return rgba;
    }

    // CASE 3: Grayscale (1 channel)
    if (data.length === totalPixels) {
        for (let i = 0; i < totalPixels; i++) {
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i]; rgba[i * 4 + 3] = 255;
        }
        return rgba;
    }

    // CASE 4: 1-bit (B&W / ImageMask) - 8 pixels per byte
    if (data.length >= Math.floor(totalPixels / 8) && data.length < totalPixels) {
        console.log(`[GromitOffscreen] Decompressing 1-bit mask (${width}x${height}). Bytes: ${data.length}...`);
        for (let i = 0; i < totalPixels; i++) {
            const byte = data[Math.floor(i / 8)];
            const bit = 7 - (i % 8);
            // In PDF ImageMasks: 1 is usually foreground (black), 0 is background (white)
            const val = ((byte >> bit) & 1) ? 0 : 255;
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = val; rgba[i * 4 + 3] = 255;
        }
        return rgba;
    }

    console.warn(`[GromitOffscreen] Unknown image format (length: ${data.length}, pixels: ${totalPixels}, ratio: ${(data.length / totalPixels).toFixed(2)}).`);
    // Fallback: Gray copy
    for (let i = 0; i < Math.min(data.length, totalPixels); i++) {
        rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i]; rgba[i * 4 + 3] = 255;
    }
    return rgba;
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
        useSystemFonts: false,          // SURGICAL: Prevent system font conflicts in offscreen
        disableFontFace: true,          // SURGICAL: Prevent hanging on font injection
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
                bodyText += pageText + " ";
            }
        }
    } catch (err) {
        console.error("[GromitOffscreen] pdf.js extraction failed:", err);
    }

    // 3. OCR Detection (Native TextDetector)
    // Check clean length. If < 50 chars, we assume it's a scan (or just empty).
    if (bodyText.replace(/\s/g, '').length < 50 && doc.numPages > 0) {
        console.log("[GromitOffscreen] Testo insufficiente. Tentativo OCR Nativo (Shape Detection API)...");

        // Check if TextDetector is available
        if (typeof (window as any).TextDetector !== 'undefined') {
            try {
                const ocrResult = await performNativeOCR(doc);
                if (ocrResult && ocrResult.trim().length > 10) {
                    bodyText = ocrResult;
                } else {
                    bodyText = "[[GROMIT_SCAN_DETECTED]]";
                }
            } catch (err) {
                console.debug("[GromitOffscreen] Native OCR silent fallback (Empty/Scan):", err);
                bodyText = "[[GROMIT_SCAN_DETECTED]]";
            }
        } else {
            console.log("[GromitOffscreen] TextDetector non disponibile. Usa fallback manuale.");
            bodyText = "[[GROMIT_SCAN_DETECTED]]";
        }
    }

    // Combined Result: Header (Forms) + Body (Text/OCR)
    const finalResult = (formHeader + bodyText).trim();

    // SECURITY: Clear text variables before return (Hint for GC)
    formHeader = "";
    bodyText = "";

    return finalResult;
}

/**
 * detectTextWithTiling (v5.8.8) - "True Apple Style"
 * Native Tiling Scan on 144 DPI renders (Scale 2.0x).
 */
async function detectTextWithTiling(canvas: HTMLCanvasElement): Promise<string> {
    const detector = new (window as any).TextDetector();
    const TILE_SIZE = 1024;
    const OVERLAP = 256;
    const width = canvas.width;
    const height = canvas.height;

    const performScan = async (sourceCanvas: HTMLCanvasElement | ImageBitmap, tileScale: number = 1.0): Promise<string> => {
        const sWidth = sourceCanvas.width;
        const sHeight = sourceCanvas.height;
        const bitmap = sourceCanvas instanceof ImageBitmap ? sourceCanvas : await createImageBitmap(sourceCanvas);
        const resultsAcc: string[] = [];

        console.log(`[GromitOffscreen] OCR Tiling Loop Starting for ${sWidth}x${sHeight}...`);

        for (let y = 0; y < sHeight; y += (TILE_SIZE - OVERLAP)) {
            for (let x = 0; x < sWidth; x += (TILE_SIZE - OVERLAP)) {
                const tw = Math.min(TILE_SIZE, sWidth - x);
                const th = Math.min(TILE_SIZE, sHeight - y);
                if (tw <= 0 || th <= 0) break;

                try {
                    const tileBitmap = await createImageBitmap(bitmap, x, y, tw, th);
                    const results = await detector.detect(tileBitmap);
                    if (results.length > 0) {
                        const tileText = results.map((r: any) => r.rawValue).filter((v: string) => v.trim().length > 0).join(' ');
                        resultsAcc.push(tileText);
                    }
                } catch (e) {
                    console.debug("[GromitOffscreen] Tile skip:", e);
                }
                if (x + tw >= sWidth) break;
            }
            if (y + Math.min(TILE_SIZE, sHeight - y) >= sHeight) break;
        }
        return resultsAcc.join(' ');
    };

    console.log(`[GromitOffscreen] Tiling Scan starting (v5.8.8) for ${width}x${height}...`);

    // PASS 1: Native Resolution Scan
    return await performScan(canvas);
}

/**
 * Native OCR using the Shape Detection API (TextDetector)
 * v5.8.8: "Instant Snapshot" - High-res Full Page Rendering, Fast Canvas.
 */
async function performNativeOCR(doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
    let fullOcrText = "";

    console.log(`[GromitOffscreen] Starting Instant-Snapshot OCR (v5.8.8) for ${doc.numPages} pages...`);

    for (let i = 1; i <= doc.numPages; i++) {
        try {
            const pageTextSnippet = await Promise.race([
                (async () => {
                    const page = await doc.getPage(i);
                    const start = performance.now();

                    // Render page at scale 2.0 (approx 144 DPI)
                    // Balanced for speed (300 DPI was hitting timeouts)
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    // Optimization: alpha false and willReadFrequently for faster pixel access
                    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    // Fill white background for scan look
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    console.log(`[GromitOffscreen] Page ${i}: Rendering Snapshot (${canvas.width}x${canvas.height})...`);

                    const renderContext = {
                        canvasContext: ctx,
                        viewport: viewport
                    };

                    await page.render(renderContext).promise;

                    console.log(`[GromitOffscreen] Page ${i}: Snapshot Ready. Starting Tiling Scan...`);

                    // Perform Multi-Pass OCR on the full snapshot
                    let text = await detectTextWithTiling(canvas);

                    // Optional: Inversion fallback on full page if still empty
                    if (!text.trim()) {
                        console.log(`[GromitOffscreen] Page ${i}: No text found. Trying Inversion...`);
                        ctx.globalCompositeOperation = 'difference';
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.globalCompositeOperation = 'source-over';
                        text = await detectTextWithTiling(canvas);
                    }

                    const end = performance.now();
                    if (text.trim()) {
                        console.log(`[GromitOffscreen] Page ${i} SUCCESS in ${(end - start).toFixed(0)}ms (${text.length} chars)`);
                        return text + " ";
                    } else {
                        console.log(`[GromitOffscreen] Page ${i}: No text found.`);
                        return "";
                    }
                })(),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error("OCR_PAGE_TIMEOUT")), 60000))
            ]);

            fullOcrText += pageTextSnippet;

        } catch (err) {
            console.error(`[GromitOffscreen] Page ${i} failed or timed out:`, err);
            fullOcrText += " ";
            continue;
        }
    }

    if (fullOcrText.trim().length === 0) {
        console.log("[GromitOffscreen] OCR completed but no text was found. Marking as SCAN.");
        return "[[GROMIT_SCAN_DETECTED]]";
    }

    return fullOcrText.trim();
}

/**
 * Direct Image OCR (PNG, JPG, weBP)
 * v5.8.1: "Ghost Hunter" - Using Tiling detector for large photos.
 */
async function extractImageText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
        const blob = new Blob([arrayBuffer]);
        const bitmap = await createImageBitmap(blob);

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);

        console.log(`[GromitOffscreen] Direct Image OCR (Tiling) for ${bitmap.width}x${bitmap.height}...`);
        const text = await detectTextWithTiling(canvas);

        return text.trim() ? text : "[[GROMIT_SCAN_DETECTED]]";
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
