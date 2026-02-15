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
 * Native OCR using the Shape Detection API (TextDetector)
 * v5.7.3: Zero-Render Policy. Forced White Background for Contrast.
 */
async function performNativeOCR(doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
    const detector = new (window as any).TextDetector();
    let fullOcrText = "";

    console.log(`[GromitOffscreen] Starting Deep OCR (v5.7.3) for ${doc.numPages} pages...`);

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
                                // transformStack.push([...currentCTM]); // Not used in new logic
                            } else if (fn === (pdfjsLib as any).OPS.restore) {
                                // const restored = transformStack.pop(); // Not used in new logic
                                // if (restored) currentCTM = restored;
                            } else if (fn === (pdfjsLib as any).OPS.paintImageXObject ||
                                fn === (pdfjsLib as any).OPS.paintJpegXObject ||
                                fn === (pdfjsLib as any).OPS.paintImageMaskXObject) {
                                const id = args[0];
                                // For simplicity and "flattening", treat all these as 'objs' for retrieval
                                imageIds.push({ id, y: currentCTM[5], source: 'objs' });
                            } else if (fn === (pdfjsLib as any).OPS.paintInlineImageXObject) {
                                // INLINE IMAGE SUPPORT (v5.7.5)
                                const imgData = args[0];
                                imageIds.push({ data: imgData, y: currentCTM[5], source: 'inline' });
                            }
                        }

                        if (imageIds.length > 0) {
                            console.log(`[GromitOffscreen] Page ${i}: Found ${imageIds.length} candidate levels. Searching...`);

                            // HEURISTIC: Sort by Y coordinate descending (Top to Bottom)
                            // In PDF space, higher Y is closer to the top of the page.
                            imageIds.sort((a, b) => b.y - a.y);

                            // Process images in spatial order (Tiling Support)
                            for (const item of imageIds) {
                                try {
                                    let img = item.data;
                                    if (!img && item.id) {
                                        img = await new Promise<any>((resolve) => {
                                            if (item.source === 'objs') {
                                                // This covers XObjects and ImageMaskXObjects (which are also XObjects)
                                                page.objs.get(item.id!, resolve);
                                            } else {
                                                // Fallback for commonObjs if needed, though 'objs' should cover most
                                                page.commonObjs.get(item.id!, resolve);
                                            }
                                        });
                                    }

                                    if (img) {
                                        const area = (img.width || 0) * (img.height || 0);
                                        // More aggressive area threshold for levels (e.g., > 20,000 pixels or ~140x140)
                                        if (area > 20000) {
                                            console.log(`[GromitOffscreen] Page ${i}: Processing ${item.id || 'inline'} (${img.width}x${img.height}, bpc: ${img.bpc || 'N/A'}) from ${item.source}`);

                                            // HIGH-CONTRAST NEUTRALIZATION (v5.7.5)
                                            // Force white background to solve transparency/contrast issues in TextDetector
                                            const canvas = document.createElement('canvas');
                                            canvas.width = img.width;
                                            canvas.height = img.height;
                                            const ctx = canvas.getContext('2d')!;

                                            // 1. Fill with Opaque White
                                            ctx.fillStyle = 'white';
                                            ctx.fillRect(0, 0, canvas.width, canvas.height);

                                            // 2. Composite original image
                                            if (img.bitmap) {
                                                ctx.drawImage(img.bitmap, 0, 0);
                                            } else if (img.data) {
                                                const rgbaData = convertToRGBA(img.data, img.width, img.height);
                                                const imageData = new ImageData(rgbaData as any, img.width, img.height);

                                                // Create intermediate to handle potential transparency blending
                                                const tempCanvas = document.createElement('canvas');
                                                tempCanvas.width = img.width;
                                                tempCanvas.height = img.height;
                                                tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

                                                ctx.drawImage(tempCanvas, 0, 0);
                                            }

                                            // Final High-Contrast Opaque Source
                                            let results = await detector.detect(canvas);

                                            // INVERSION FALLBACK (v5.7.5): Try inverted if 0 results (Typical for some masks/negative images)
                                            if (results.length === 0) {
                                                ctx.globalCompositeOperation = 'difference'; // Inverts colors
                                                ctx.fillStyle = 'white'; // Apply white to invert
                                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                ctx.globalCompositeOperation = 'source-over'; // Reset blend mode
                                                results = await detector.detect(canvas);
                                                if (results.length > 0) console.log(`[GromitOffscreen] Image ${item.id || 'inline'} - Inversion Fallback SUCCESS.`);
                                            }

                                            if (results.length > 0) {
                                                const text = results.map((r: any) => r.rawValue).filter((v: string) => v.trim().length > 0).join(' ');
                                                pageAccText += text + " ";
                                                console.debug(`[GromitOffscreen] Page ${i}: Extracted ${results.length} blocks.`);
                                            } else {
                                                console.log(`[GromitOffscreen] Page ${i}: Image ${item.id || 'inline'} - TextDetector returned 0 results.`);
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.debug(`[GromitOffscreen] Page ${i}: Resource error for ${item.id || 'inline'} from ${item.source}:`, e);
                                }
                            }
                        }

                        if (pageAccText.trim().length > 0) {
                            const end = performance.now();
                            console.log(`[GromitOffscreen] Page ${i} SUCCESS in ${(end - start).toFixed(0)}ms`);
                            return pageAccText;
                        }

                        console.log(`[GromitOffscreen] Page ${i}: No text found in any level.`);
                        return "";
                    } catch (err) {
                        console.error(`[GromitOffscreen] Page ${i} Fatal:`, err);
                        return "";
                    }
                })(),
                new Promise<string>((_, reject) => setTimeout(() => reject(new Error("OCR_PAGE_TIMEOUT")), 45000)) // Slight extension for deep look
            ]);

            fullOcrText += pageTextSnippet;
            // await new Promise(r => setTimeout(r, 50)); // Removed for faster processing, if needed can be re-added

        } catch (err) {
            console.error(`[GromitOffscreen] Page ${i} skipped due to timeout or error:`, err);
            fullOcrText += " "; // Add a space to separate potential text from other pages
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
 * v5.7.5: Pure Zero-Manipulation. Pass Blob directly to detector.
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
