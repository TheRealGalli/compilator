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

    // SAFETY: If data is null or empty, return transparent
    if (!data || data.length === 0) {
        console.warn("[GromitOffscreen] convertToRGBA: Data is null or empty.");
        return rgba;
    }

    // CASE 1: Already RGBA (4 channels)
    if (data.length === totalPixels * 4) {
        return data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
    }

    // CASE 2: RGB (3 channels)
    if (data.length === totalPixels * 3) {
        console.log(`[GromitOffscreen] Converting RGB (${width}x${height}) to RGBA...`);
        for (let i = 0; i < totalPixels; i++) {
            rgba[i * 4] = data[i * 3];     // R
            rgba[i * 4 + 1] = data[i * 3 + 1]; // G
            rgba[i * 4 + 2] = data[i * 3 + 2]; // B
            rgba[i * 4 + 3] = 255;             // A
        }
        return rgba;
    }

    // CASE 3: Grayscale (1 channel)
    if (data.length === totalPixels) {
        console.log(`[GromitOffscreen] Converting Grayscale (${width}x${height}) to RGBA...`);
        for (let i = 0; i < totalPixels; i++) {
            const val = data[i];
            rgba[i * 4] = val; // R
            rgba[i * 4 + 1] = val; // G
            rgba[i * 4 + 2] = val; // B
            rgba[i * 4 + 3] = 255; // A
        }
        return rgba;
    }

    console.warn(`[GromitOffscreen] Unknown image format (length: ${data.length}, pixels: ${totalPixels}). Attempting raw copy.`);
    // Fallback: Just copy what we can
    for (let i = 0; i < Math.min(data.length, rgba.length); i++) {
        rgba[i] = data[i];
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
 * Native OCR using the Shape Detection API (TextDetector)
 * v5.7.2: Zero-Render Policy. Relying only on direct image extraction.
 */
async function performNativeOCR(doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
    const detector = new (window as any).TextDetector();
    let fullOcrText = "";

    console.log(`[GromitOffscreen] Starting Deep OCR (v5.7.2) for ${doc.numPages} pages...`);

    for (let i = 1; i <= doc.numPages; i++) {
        try {
            console.log(`[GromitOffscreen] Page ${i}: Scanning for images (Deep Look)...`);

            const pageTextSnippet = await Promise.race([
                (async () => {
                    const start = performance.now();
                    const page = await doc.getPage(i);
                    let pageAccText = "";

                    try {
                        const ops = await page.getOperatorList();

                        // DEEP & ORDERED LOOK: Search in both standard and common objects, tracking Y position
                        const imageIds: { id: string, y: number, source: 'objs' | 'common' }[] = [];
                        let currentCTM = [1, 0, 0, 1, 0, 0]; // [a, b, c, d, e, f] -> f is Y translate
                        const transformStack: any[] = [];

                        for (let j = 0; j < ops.fnArray.length; j++) {
                            const fn = ops.fnArray[j];
                            const args = ops.argsArray[j];

                            if (fn === (pdfjsLib as any).OPS.transform) {
                                // Update current transformation matrix (simplified for Y-tracking in tiling)
                                currentCTM = args;
                            } else if (fn === (pdfjsLib as any).OPS.save) {
                                transformStack.push([...currentCTM]);
                            } else if (fn === (pdfjsLib as any).OPS.restore) {
                                const restored = transformStack.pop();
                                if (restored) currentCTM = restored;
                            } else if (fn === (pdfjsLib as any).OPS.paintImageXObject ||
                                fn === (pdfjsLib as any).OPS.paintJpegXObject) {
                                const id = args[0];
                                imageIds.push({ id, y: currentCTM[5], source: 'objs' });
                            } else if (fn === (pdfjsLib as any).OPS.paintImageMaskXObject) {
                                const id = args[0];
                                imageIds.push({ id, y: currentCTM[5], source: 'common' });
                            }
                        }

                        if (imageIds.length > 0) {
                            // HEURISTIC: Sort by Y coordinate descending (Top to Bottom)
                            // In PDF space, higher Y is closer to the top of the page.
                            imageIds.sort((a, b) => b.y - a.y);

                            console.log(`[GromitOffscreen] Page ${i}: Found ${imageIds.length} candidate resources. Sorted Top-Down.`);

                            // Process images in spatial order (Tiling Support)
                            for (const { id, source, y } of imageIds) {
                                try {
                                    const img = await new Promise<any>((resolve) => {
                                        if (source === 'objs') {
                                            page.objs.get(id, resolve);
                                        } else {
                                            page.commonObjs.get(id, resolve);
                                        }
                                    });

                                    if (img) {
                                        const area = (img.width || 0) * (img.height || 0);
                                        // Capture anything larger than a small icon (e.g., > 40,000 pixels or 200x200)
                                        if (area > 40000) {
                                            console.log(`[GromitOffscreen] Page ${i}: Image ${id} at Y=${y.toFixed(0)} (${img.width}x${img.height}). Source: ${source}`);

                                            let imageSource: any = null;
                                            if (img.bitmap) {
                                                imageSource = img.bitmap;
                                            } else if (img.data) {
                                                const rgbaData = convertToRGBA(img.data, img.width, img.height);
                                                // Optimized compatibility: Draw to canvas first
                                                const canvas = document.createElement('canvas');
                                                canvas.width = img.width;
                                                canvas.height = img.height;
                                                const ctx = canvas.getContext('2d')!;
                                                const imageData = new ImageData(rgbaData as any, img.width, img.height);
                                                ctx.putImageData(imageData, 0, 0);
                                                imageSource = canvas; // TextDetector often prefers Canvas/Bitmap over raw ImageData
                                            }

                                            if (imageSource) {
                                                const results = await detector.detect(imageSource);
                                                if (results.length > 0) {
                                                    const text = results.map((r: any) => r.rawValue).filter((v: string) => v.trim().length > 0).join(' ');
                                                    pageAccText += text + " ";
                                                    console.debug(`[GromitOffscreen] Page ${i}: Image ${id} extracted ${results.length} blocks.`);
                                                } else {
                                                    console.log(`[GromitOffscreen] Page ${i}: Image ${id} - TextDetector returned 0 results.`);
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.debug(`[GromitOffscreen] Page ${i}: Could not resolve image ${id} from ${source}`);
                                }
                            }
                        }

                        if (pageAccText.trim().length > 0) {
                            const end = performance.now();
                            console.log(`[GromitOffscreen] Page ${i} DONE: Extraction success in ${(end - start).toFixed(0)}ms`);
                            return pageAccText;
                        }

                        console.log(`[GromitOffscreen] Page ${i}: No text extracted from images.`);
                        return "";
                    } catch (err) {
                        console.error(`[GromitOffscreen] Page ${i}: Fatal Lifecycle Error:`, err);
                        return "";
                    }
                })(),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error("OCR_PAGE_TIMEOUT")), 45000)) // Slight extension for deep look
            ]);

            fullOcrText += pageTextSnippet;
            await new Promise(r => setTimeout(r, 50));

        } catch (err) {
            fullOcrText += " ";
            continue;
        }
    }

    // Final Fallback: If still nothing, return the scan marker
    if (fullOcrText.trim().length === 0) {
        console.log("[GromitOffscreen] OCR completed but no text was found. Marking as SCAN.");
        return "[[GROMIT_SCAN_DETECTED]]";
    }

    return fullOcrText.trim();
}

/**
 * Direct Image OCR (PNG, JPG, weBP)
 * v5.7.2: Pure Zero-Manipulation. Pass Blob directly to detector.
 */
async function extractImageText(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
        const detector = new (window as any).TextDetector();
        const blob = new Blob([arrayBuffer]);

        console.log(`[GromitOffscreen] Direct Image OCR starting (Size: ${arrayBuffer.byteLength} bytes)...`);

        // DIRECT PASS (v5.5.9): Passing the original blob is the most faithful way
        const results = await detector.detect(blob);
        console.log(`[GromitOffscreen] Direct Image: Found ${results.length} text blocks.`);

        const text = results
            .map((r: any) => r.rawValue)
            .filter((v: string) => v.trim().length > 0)
            .join(' ');

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
