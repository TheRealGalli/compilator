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
 * applyMedianFilter (v5.8.4)
 * Despeckle filter to remove "salt and pepper" noise from faxes.
 * Operates on a 3x3 window.
 */
function applyMedianFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = new Uint8ClampedArray(data.length);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const vals = [];
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    vals.push(data[idx]); // Use Red channel as proxy for grayscale
                }
            }
            vals.sort((a, b) => a - b);
            const median = vals[4];
            const dstIdx = (y * width + x) * 4;
            output[dstIdx] = output[dstIdx + 1] = output[dstIdx + 2] = median;
            output[dstIdx + 3] = 255;
        }
    }
    ctx.putImageData(new ImageData(output, width, height), 0, 0);
}

/**
 * applyDilation (v5.8.4)
 * Morphological Dilation to "fatten" characters and repair broken lines.
 * Essential for faint fax scans.
 */
function applyDilation(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = new Uint8ClampedArray(data.length);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let minVal = 255; // White
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = ((y + ky) * width + (x + kx)) * 4;
                    if (data[idx] < minVal) minVal = data[idx];
                }
            }
            const dstIdx = (y * width + x) * 4;
            output[dstIdx] = output[dstIdx + 1] = output[dstIdx + 2] = minVal;
            output[dstIdx + 3] = 255;
        }
    }
    ctx.putImageData(new ImageData(output, width, height), 0, 0);
}

/**
 * applySharpen (v5.8.3)
 * Convolution filter to reinforce edges.
 */
function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const side = 3;
    const halfSide = Math.floor(side / 2);
    // Sharpening Kernel
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];
    const output = new Uint8ClampedArray(data.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dstOff = (y * width + x) * 4;
            let r = 0, g = 0, b = 0;
            for (let cy = 0; cy < side; cy++) {
                for (let cx = 0; cx < side; cx++) {
                    const scy = Math.min(height - 1, Math.max(0, y + cy - halfSide));
                    const scx = Math.min(width - 1, Math.max(0, x + cx - halfSide));
                    const srcOff = (scy * width + scx) * 4;
                    const wt = kernel[cy * side + cx];
                    r += data[srcOff] * wt;
                    g += data[srcOff + 1] * wt;
                    b += data[srcOff + 2] * wt;
                }
            }
            output[dstOff] = r;
            output[dstOff + 1] = g;
            output[dstOff + 2] = b;
            output[dstOff + 3] = 255;
        }
    }
    ctx.putImageData(new ImageData(output, width, height), 0, 0);
}

/**
 * applyAdaptiveThreshold (v5.8.3)
 * Bradley-Roth local thresholding algorithm.
 * Best for documents with uneven lighting/shadows.
 */
function applyAdaptiveThreshold(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const s = Math.floor(width / 8); // Neighborhood size
    const t = 15; // Adjustment constant (%)

    // 1. Convert to grayscale and create integral image
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = (data[i] + data[i + 1] + data[i + 2]) / 3;
    }

    const integral = new Uint32Array(width * height);
    for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = 0; y < height; y++) {
            sum += gray[y * width + x];
            if (x === 0) {
                integral[y * width + x] = sum;
            } else {
                integral[y * width + x] = integral[y * width + (x - 1)] + sum;
            }
        }
    }

    // 2. Perform thresholding
    const halfS = Math.floor(s / 2);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x1 = Math.max(0, x - halfS);
            const x2 = Math.min(width - 1, x + halfS);
            const y1 = Math.max(0, y - halfS);
            const y2 = Math.min(height - 1, y + halfS);
            const count = (x2 - x1) * (y2 - y1);

            let sum = integral[y2 * width + x2];
            if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
            if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
            if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];

            const idx = (y * width + x) * 4;
            const res = (gray[y * width + x] * count) < (sum * (100 - t) / 100) ? 0 : 255;
            data[idx] = data[idx + 1] = data[idx + 2] = res;
        }
    }
    ctx.putImageData(imageData, 0, 0);
}

/**
 * detectTextWithTiling (v5.8.4)
 * Multi-Pass Attack:
 * 1. Native Tiling
 * 2. Downsampling (0.5x)
 * 3. Vision Optimizer (Sharpen + Adaptive Threshold)
 * 4. Sanctuary Final (Dilation + Median + Upscale Tiling 2x)
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

        console.log(`[GromitOffscreen] OCR Scanning buffer ${sWidth}x${sHeight} (TileScale: ${tileScale})...`);

        for (let y = 0; y < sHeight; y += (TILE_SIZE - OVERLAP)) {
            for (let x = 0; x < sWidth; x += (TILE_SIZE - OVERLAP)) {
                const tw = Math.min(TILE_SIZE, sWidth - x);
                const th = Math.min(TILE_SIZE, sHeight - y);
                if (tw <= 0 || th <= 0) break;

                try {
                    const tileBitmap = await createImageBitmap(bitmap, x, y, tw, th);

                    let detectionTarget: ImageBitmap | HTMLCanvasElement = tileBitmap;
                    if (tileScale !== 1.0) {
                        const tCanvas = document.createElement('canvas');
                        tCanvas.width = tw * tileScale;
                        tCanvas.height = th * tileScale;
                        const tCtx = tCanvas.getContext('2d')!;
                        // Bilinear scaling for smoother text shapes
                        tCtx.imageSmoothingEnabled = true;
                        tCtx.imageSmoothingQuality = 'high';
                        tCtx.drawImage(tileBitmap, 0, 0, tCanvas.width, tCanvas.height);
                        detectionTarget = tCanvas;
                    }

                    const results = await detector.detect(detectionTarget);
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

    console.log(`[GromitOffscreen] Tiling Scan starting (v5.8.4) for ${width}x${height}...`);

    // PASS 1: Native Resolution
    let text = await performScan(canvas);

    // PASS 2: Downsampling Fallback (v5.8.1 legacy)
    if (text.trim().length < 50 && (width > 2000 || height > 2000)) {
        console.log(`[GromitOffscreen] PASS 2: Trying Downsampling (0.5x)...`);
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = width * 0.5;
        scaledCanvas.height = height * 0.5;
        const sCtx = scaledCanvas.getContext('2d')!;
        sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        const scaledText = await performScan(scaledCanvas);
        if (scaledText.trim().length > text.trim().length) {
            text = scaledText;
        }
    }

    // PASS 3: Vision Optimizer Attack (v5.8.3)
    if (text.trim().length < 50) {
        console.log(`[GromitOffscreen] PASS 3: Applying Vision Optimizer (Bradley & Sharpen)...`);
        const optimizedCanvas = document.createElement('canvas');
        optimizedCanvas.width = width;
        optimizedCanvas.height = height;
        const oCtx = optimizedCanvas.getContext('2d')!;
        oCtx.drawImage(canvas, 0, 0);

        applySharpen(oCtx, width, height);
        applyAdaptiveThreshold(oCtx, width, height);

        const optText = await performScan(optimizedCanvas);
        if (optText.trim().length > text.trim().length) {
            console.log(`[GromitOffscreen] Vision Optimizer SUCCESS (${optText.length} chars).`);
            text = optText;
        }
    }

    // PASS 4: Sanctuary Final Attack (v5.8.4)
    if (text.trim().length < 50) {
        console.log(`[GromitOffscreen] PASS 4: Applying Sanctuary Final (Dilation + Median + Upscale Tiling)...`);
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const fCtx = finalCanvas.getContext('2d')!;
        fCtx.drawImage(canvas, 0, 0);

        applyMedianFilter(fCtx, width, height); // Despeckle first
        applyDilation(fCtx, width, height);     // Then thicken text
        applyAdaptiveThreshold(fCtx, width, height); // Re-threshold for pure shapes

        const finalText = await performScan(finalCanvas, 2.0); // 2x Upscale individual tiles
        if (finalText.trim().length > text.trim().length) {
            console.log(`[GromitOffscreen] Sanctuary Final SUCCESS (${finalText.length} chars).`);
            text = finalText;
        }
    }

    return text;
}

/**
 * Native OCR using the Shape Detection API (TextDetector)
 * v5.8.4: "Sanctuary Final" - Morphological & Tile Upscale.
 */
async function performNativeOCR(doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
    let fullOcrText = "";

    console.log(`[GromitOffscreen] Starting Deep OCR (v5.8.4) for ${doc.numPages} pages...`);

    for (let i = 1; i <= doc.numPages; i++) {
        try {
            console.log(`[GromitOffscreen] Page ${i}: Looking for "The Photo" in all levels...`);

            const pageTextSnippet = await Promise.race([
                (async () => {
                    const page = await doc.getPage(i);
                    const start = performance.now();
                    let pageAccText = "";

                    try {
                        const ops = await page.getOperatorList();
                        const imageIds: { id?: string, data?: any, y: number, source: 'objs' | 'common' | 'inline' }[] = [];
                        let currentCTM = [1, 0, 0, 1, 0, 0];

                        // HELPER: Recursive Operator Scanner for Form XObjects
                        const scanOperators = (fnArray: any[], argsArray: any[], ctm: number[]) => {
                            for (let j = 0; j < fnArray.length; j++) {
                                const fn = fnArray[j];
                                const args = argsArray[j];

                                if (fn === (pdfjsLib as any).OPS.transform) {
                                    ctm = args;
                                } else if (fn === (pdfjsLib as any).OPS.paintImageXObject ||
                                    fn === (pdfjsLib as any).OPS.paintJpegXObject ||
                                    fn === (pdfjsLib as any).OPS.paintImageMaskXObject) {
                                    imageIds.push({ id: args[0], y: ctm[5], source: 'objs' });
                                } else if (fn === (pdfjsLib as any).OPS.paintInlineImageXObject) {
                                    imageIds.push({ data: args[0], y: ctm[5], source: 'inline' });
                                } else if (fn === (pdfjsLib as any).OPS.paintFormXObject) {
                                    // FORM XOBJECT: This is a container. 
                                    // We don't fully recurse the ops here to avoid complexity, but we register it.
                                    imageIds.push({ id: args[0], y: ctm[5], source: 'objs' });
                                }
                            }
                        };

                        scanOperators(ops.fnArray, ops.argsArray, currentCTM);

                        if (imageIds.length > 0) {
                            console.log(`[GromitOffscreen] Page ${i}: Found ${imageIds.length} candidate levels. Searching...`);
                            imageIds.sort((a, b) => b.y - a.y);

                            for (const item of imageIds) {
                                try {
                                    let img = item.data;
                                    if (!img && item.id) {
                                        img = await new Promise<any>((resolve) => {
                                            page.objs.get(item.id!, (obj: any) => {
                                                if (obj) resolve(obj);
                                                else page.commonObjs.get(item.id!, resolve);
                                            });
                                        });
                                    }

                                    if (img) {
                                        // If it's a Form, it might not have width/height directly in this context 
                                        // But if it's an image, it will.
                                        const area = (img.width || 0) * (img.height || 0);
                                        if (area > 20000 || (!img.width && img.fnArray)) {
                                            console.log(`[GromitOffscreen] Page ${i}: Processing ${item.id || 'inline'} (${img.width || 'Form'}x${img.height || ''})`);

                                            const canvas = document.createElement('canvas');
                                            const width = img.width || 1000; // Fallback for forms
                                            const height = img.height || 1000;
                                            canvas.width = width;
                                            canvas.height = height;
                                            const ctx = canvas.getContext('2d')!;
                                            ctx.fillStyle = 'white';
                                            ctx.fillRect(0, 0, width, height);

                                            if (img.bitmap) {
                                                ctx.drawImage(img.bitmap, 0, 0);
                                            } else if (img.data) {
                                                const rgbaData = convertToRGBA(img.data, img.width, img.height);
                                                const imageData = new ImageData(rgbaData as any, img.width, img.height);
                                                const tempCanvas = document.createElement('canvas');
                                                tempCanvas.width = img.width;
                                                tempCanvas.height = img.height;
                                                tempCanvas.getContext('2d')!.putImageData(imageData, 0, 0);
                                                ctx.drawImage(tempCanvas, 0, 0);
                                            }

                                            // TILING SCAN (v5.8.1)
                                            let text = await detectTextWithTiling(canvas);

                                            // INVERSION FALLBACK
                                            if (!text.trim()) {
                                                ctx.globalCompositeOperation = 'difference';
                                                ctx.fillStyle = 'white';
                                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                ctx.globalCompositeOperation = 'source-over';
                                                text = await detectTextWithTiling(canvas);
                                            }

                                            if (text.trim()) {
                                                pageAccText += text + " ";
                                                console.debug(`[GromitOffscreen] Page ${i}: Extracted text from level.`);
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
