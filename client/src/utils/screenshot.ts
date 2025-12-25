import html2canvas from 'html2canvas';
import * as pdfjs from 'pdfjs-dist';

// Configure pdf.js worker
// Use a local worker or CDN. For now, we'll try to load it from the package
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

/**
 * Screenshot configuration interface for future AI function calling
 */
export interface ScreenshotConfig {
    backgroundColor?: string;
    scale?: number; // 1 = normal, 2 = 2x quality, etc.
    format?: 'png' | 'jpeg';
    quality?: number; // 0-1 for JPEG quality
    width?: number;
    height?: number;
}

/**
 * Generate PNG screenshot from PDF base64 + SVG overlay
 * Configurable parameters allow AI to adjust screenshot settings in future
 * 
 * @param pdfBase64 - Base64 encoded PDF
 * @param svgOverlay - SVG string to overlay on PDF
 * @param filename - Output filename
 * @param config - Screenshot configuration (AI-adjustable)
 */
export async function generatePDFScreenshot(
    pdfBase64: string,
    svgOverlay: string,
    filename: string,
    config: ScreenshotConfig = {}
): Promise<void> {
    const {
        backgroundColor = '#ffffff',
        scale = 2,
        format = 'png',
        quality = 0.95,
        width,
        height
    } = config;

    // Create temporary rendering container
    const tempContainer = document.createElement('div');
    tempContainer.style.cssText = `
    position: fixed;
    top: -10000px;
    left: -10000px;
    width: ${width || 800}px;
    background: ${backgroundColor};
    padding: 0;
  `;

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
    position: relative;
    width: 100%;
    background: white;
  `;

    // Render PDF using pdf.js
    const pdfCanvas = document.createElement('canvas');
    const pdfContext = pdfCanvas.getContext('2d');

    try {
        // base64 to Uint8Array
        const pdfData = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
        const loadingTask = pdfjs.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Render first page

        const viewport = page.getViewport({ scale: 2 }); // Render at 2x scale for quality
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;

        await page.render({
            canvasContext: pdfContext!,
            viewport: viewport
        }).promise;

    } catch (err) {
        console.error('Error rendering PDF with pdf.js:', err);
        // Fallback: draw white background if PDF fails
        pdfCanvas.width = width || 800;
        pdfCanvas.height = height || 1100;
        if (pdfContext) {
            pdfContext.fillStyle = backgroundColor;
            pdfContext.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        }
    }

    pdfCanvas.style.cssText = 'width: 100%; display: block;';

    // Add SVG overlay
    const svgDiv = document.createElement('div');
    svgDiv.innerHTML = svgOverlay;
    svgDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  `;

    contentDiv.appendChild(pdfCanvas);
    contentDiv.appendChild(svgDiv);
    tempContainer.appendChild(contentDiv);
    document.body.appendChild(tempContainer);

    // Give browser a moment to paint
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    // Capture screenshot
    const canvas = await html2canvas(contentDiv, {
        backgroundColor,
        scale,
        useCORS: true,
        logging: false,
        width: width || contentDiv.scrollWidth,
        height: height || contentDiv.scrollHeight
    });

    // Convert and download
    canvas.toBlob((blob) => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Cleanup rendering container
        document.body.removeChild(tempContainer);
    }, `image/${format}`, quality);
}
