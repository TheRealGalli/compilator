import html2canvas from 'html2canvas';
import * as pdfjs from 'pdfjs-dist';

// Configure pdf.js worker
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
    z-index: -1000;
    background: ${backgroundColor};
    padding: 0;
  `;

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
    position: relative;
    background: white;
    display: block;
    overflow: hidden;
  `;

    // Render PDF using pdf.js
    const pdfCanvas = document.createElement('canvas');
    const pdfContext = pdfCanvas.getContext('2d');

    let pdfWidth = width || 800;
    let pdfHeight = height || 1100;

    try {
        console.log('[screenshot] Starting PDF rendering...');
        // base64 to Uint8Array
        const pdfData = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
        const loadingTask = pdfjs.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Render first page

        const viewport = page.getViewport({ scale: 2 }); // Render at 2x scale for quality
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;

        pdfWidth = viewport.width / 2; // Real width in px (at 1x)
        pdfHeight = viewport.height / 2;

        await page.render({
            canvasContext: pdfContext!,
            viewport: viewport
        }).promise;
        console.log('[screenshot] PDF rendered successfully');

    } catch (err) {
        console.error('[screenshot] Error rendering PDF with pdf.js:', err);
        pdfCanvas.width = pdfWidth * 2;
        pdfCanvas.height = pdfHeight * 2;
        if (pdfContext) {
            pdfContext.fillStyle = backgroundColor;
            pdfContext.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        }
    }

    // Force explicit dimensions
    contentDiv.style.width = `${pdfWidth}px`;
    contentDiv.style.height = `${pdfHeight}px`;
    pdfCanvas.style.cssText = `width: ${pdfWidth}px; height: ${pdfHeight}px; display: block;`;

    // Add SVG overlay
    const svgDiv = document.createElement('div');
    // REMOVE XML declaration as it breaks innerHTML for SVG
    const cleanSvg = svgOverlay.replace(/<\?xml.*?\?>/g, '').trim();
    svgDiv.innerHTML = cleanSvg;
    svgDiv.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background: transparent !important;
  `;

    // Ensure the SVG element itself inside the div is responsive
    const svgElement = svgDiv.querySelector('svg');
    if (svgElement) {
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';
        svgElement.style.display = 'block';
    }

    contentDiv.appendChild(pdfCanvas);
    contentDiv.appendChild(svgDiv);
    tempContainer.appendChild(contentDiv);
    document.body.appendChild(tempContainer);

    // Give browser more time to paint the SVG
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    try {
        console.log('[screenshot] Capturing canvas with html2canvas...');
        const canvas = await html2canvas(contentDiv, {
            backgroundColor,
            scale,
            useCORS: true,
            allowTaint: true,
            logging: true,
            width: pdfWidth,
            height: pdfHeight
        });

        console.log('[screenshot] Conversion to blob...');
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
                console.log('[screenshot] PNG Download triggered');
            } else {
                console.error('[screenshot] Blob creation failed');
            }
            document.body.removeChild(tempContainer);
        }, `image/${format}`, quality);

    } catch (err) {
        console.error('[screenshot] Capture failed:', err);
        if (tempContainer.parentNode) {
            document.body.removeChild(tempContainer);
        }
    }
}
