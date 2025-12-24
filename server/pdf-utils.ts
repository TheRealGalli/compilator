import { PDFDocument } from 'pdf-lib';

/**
 * Flatten PDF - removes interactive form fields
 * Converts fields to static text/graphics so Document AI can detect them visually
 */
export async function flattenPDF(pdfBuffer: Buffer): Promise<Buffer> {
    try {
        console.log('[flattenPDF] Loading PDF...');
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const form = pdfDoc.getForm();

        const fieldCount = form.getFields().length;
        console.log(`[flattenPDF] Found ${fieldCount} form fields`);

        if (fieldCount === 0) {
            console.log('[flattenPDF] No form fields to flatten, returning original');
            return pdfBuffer;
        }

        // Flatten form (convert interactive fields to static content)
        form.flatten();
        console.log('[flattenPDF] Form fields flattened');

        // Save flattened PDF
        const flattenedBytes = await pdfDoc.save();
        console.log(`[flattenPDF] Flattened PDF size: ${flattenedBytes.length} bytes (original: ${pdfBuffer.length})`);

        return Buffer.from(flattenedBytes);
    } catch (error: any) {
        console.error('[flattenPDF] Error flattening PDF:', error.message);
        // If flattening fails, return original PDF
        console.log('[flattenPDF] Returning original PDF due to error');
        return pdfBuffer;
    }
}
