import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Helper functions for scanned form compilation using Document AI Form Parser
 */

interface FormField {
    fieldName: string;
    fieldType: string;
    boundingBox: {
        normalizedVertices: Array<{ x: number; y: number }>;
    };
    confidence: number;
    pageNumber: number;
}

interface FieldMapping {
    [fieldName: string]: string;
}

/**
 * Extract form fields from a PDF using Document AI Form Parser
 */
export async function extractFormFields(pdfBuffer: Buffer, projectId: string): Promise<FormField[]> {
    try {
        // Get processor ID from environment variable
        const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
        if (!processorId) {
            console.warn('[extractFormFields] DOCUMENT_AI_PROCESSOR_ID not set - returning empty fields');
            return [];
        }

        // IMPORTANT: Must set API endpoint to match processor location
        // Default client uses 'us-documentai.googleapis.com'
        // If processor is in different region, must specify endpoint
        const location = 'eu'; // Processor is in Europe
        const apiEndpoint = `${location}-documentai.googleapis.com`;

        const client = new DocumentProcessorServiceClient({
            apiEndpoint: apiEndpoint
        });

        // Processor name format: projects/{project}/locations/{location}/processors/{id}
        const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
        console.log(`[extractFormFields] Using processor: ${processorName}`);
        console.log(`[extractFormFields] Using API endpoint: ${apiEndpoint}`);
        console.log(`[extractFormFields] PDF buffer size: ${pdfBuffer.length} bytes`);

        // Document AI expects base64 encoded string, not Buffer
        const base64Content = pdfBuffer.toString('base64');
        console.log(`[extractFormFields] Base64 content length: ${base64Content.length} chars`);

        const request = {
            name: processorName,
            rawDocument: {
                content: base64Content,
                mimeType: 'application/pdf',
            },
        };

        const [result] = await client.processDocument(request);
        const { document } = result;

        if (!document?.pages) {
            console.warn('[extractFormFields] No pages found in document');
            return [];
        }

        const fields: FormField[] = [];

        // Extract form fields from Document AI response
        for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
            const page = document.pages[pageIndex];

            if (page.formFields) {
                for (const field of page.formFields) {
                    const fieldName = field.fieldName?.textAnchor?.content || `field_${fields.length}`;
                    const fieldValue = field.fieldValue?.textAnchor?.content || '';

                    if (field.fieldName?.boundingPoly) {
                        const rawVertices = field.fieldName.boundingPoly.normalizedVertices || [];
                        // Filter and type-guard to ensure we have valid vertices
                        const vertices = rawVertices
                            .filter((v): v is { x: number; y: number } =>
                                v !== null && v !== undefined &&
                                typeof v.x === 'number' && typeof v.y === 'number'
                            );

                        fields.push({
                            fieldName: fieldName.trim(),
                            fieldType: field.valueType || 'text',
                            boundingBox: {
                                normalizedVertices: vertices
                            },
                            confidence: field.fieldName.confidence || 0,
                            pageNumber: pageIndex
                        });
                    }
                }
            }
        }

        console.log(`[extractFormFields] Found ${fields.length} form fields`);
        return fields;

    } catch (error) {
        console.error('[extractFormFields] Error:', error);
        throw new Error(`Failed to extract form fields: ${error}`);
    }
}

/**
 * Use Gemini to decide what content to fill in each field
 */
export async function decideFieldContents(
    fields: FormField[],
    documentContext: string,
    geminiModel: any
): Promise<FieldMapping> {
    try {
        const fieldsDescription = fields.map((f, idx) =>
            `${idx}. "${f.fieldName}" (tipo: ${f.fieldType})`
        ).join('\n');

        const prompt = `Analizza questo modulo scansionato e decidi il contenuto appropriato per ogni campo.

**CAMPI RILEVATI:**
${fieldsDescription}

**CONTESTO DOCUMENTO:**
${documentContext}

**ISTRUZIONI:**
1. Determina il tipo di modulo (modulo fiscale, contratto, domanda, etc.)
2. Identifica il valore appropriato per ogni campo
3. Usa dati realistici, professionali e coerenti
4. Rispetta formati standard (date: GG/MM/AAAA, numeri con separatori corretti, etc.)
5. Se un campo non è chiaro, usa "N/A" o lascia vuoto

**OUTPUT RICHIESTO (solo JSON, niente altro testo):**
{
  "0": "valore campo 0",
  "1": "valore campo 1",
  ...
}`;

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : '{}';

        const fieldMapping: FieldMapping = JSON.parse(jsonString);

        console.log(`[decideFieldContents] Generated values for ${Object.keys(fieldMapping).length} fields`);
        return fieldMapping;

    } catch (error) {
        console.error('[decideFieldContents] Error:', error);
        return {};
    }
}

/**
 * Generate SVG overlay with blue ink text positioned on form fields
 */
export function generateSVGOverlay(
    fields: FormField[],
    fieldValues: FieldMapping,
    pdfWidth: number,
    pdfHeight: number
): string {
    const svgElements: string[] = [];

    fields.forEach((field, idx) => {
        const value = fieldValues[idx.toString()];
        if (!value || value === 'N/A') return;

        const vertices = field.boundingBox.normalizedVertices;
        if (!vertices || vertices.length < 2) return;

        // Calculate position and size from bounding box
        // Document AI returns normalized coordinates (0-1)
        const x = vertices[0].x * pdfWidth;
        const y = vertices[0].y * pdfHeight;
        const width = (vertices[2].x - vertices[0].x) * pdfWidth;
        const height = (vertices[2].y - vertices[0].y) * pdfHeight;

        // Calculate font size based on field height (roughly 70% of height)
        const fontSize = Math.max(8, Math.min(height * 0.7, 14));

        // Blue ink color
        const blueInk = '#1E40AF';

        // Create text element with precise positioning
        svgElements.push(`
      <text 
        x="${x + 2}" 
        y="${y + height * 0.75}" 
        font-family="Helvetica, Arial, sans-serif" 
        font-size="${fontSize}px" 
        fill="${blueInk}"
        text-anchor="start"
      >${escapeXml(value)}</text>
    `);
    });

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${pdfWidth}" height="${pdfHeight}" xmlns="http://www.w3.org/2000/svg">
  ${svgElements.join('\n')}
</svg>`;

    return svg;
}

/**
 * Merge PDF with SVG overlay using pdf-lib
 */
export async function mergePDFWithSVG(
    pdfBuffer: Buffer,
    svgString: string
): Promise<Buffer> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();

        if (pages.length === 0) {
            throw new Error('PDF has no pages');
        }

        // For now, we'll add text directly using pdf-lib instead of SVG
        // SVG overlay would require converting SVG to PDF first
        // This is a simpler approach that works well for form filling

        console.log(`[mergePDFWithSVG] Processed ${pages.length} pages`);

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);

    } catch (error) {
        console.error('[mergePDFWithSVG] Error:', error);
        throw new Error(`Failed to merge PDF with overlay: ${error}`);
    }
}

/**
 * Main function: Fill form fields directly on PDF using pdf-lib
 */
export async function fillFormFieldsOnPDF(
    pdfBuffer: Buffer,
    fields: FormField[],
    fieldValues: FieldMapping
): Promise<Buffer> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Blue ink color
        const blueInk = rgb(0.117, 0.251, 0.686); // #1E40AF

        let fieldsFilledCount = 0;

        fields.forEach((field, idx) => {
            const value = fieldValues[idx.toString()];
            if (!value || value === 'N/A') return;

            const page = pages[field.pageNumber] || pages[0];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            const vertices = field.boundingBox.normalizedVertices;
            if (!vertices || vertices.length < 2) return;

            // Convert normalized coordinates to actual page coordinates
            const x = vertices[0].x * pageWidth;
            // PDF coordinates start from bottom, Document AI from top
            const y = pageHeight - (vertices[0].y * pageHeight);
            const fieldWidth = (vertices[2].x - vertices[0].x) * pageWidth;
            const fieldHeight = (vertices[2].y - vertices[0].y) * pageHeight;

            // Calculate font size
            const fontSize = Math.max(8, Math.min(fieldHeight * 0.7, 14));

            // Draw text on the page
            try {
                page.drawText(value, {
                    x: x + 2,
                    y: y - fieldHeight * 0.75,
                    size: fontSize,
                    font: font,
                    color: blueInk,
                });
                fieldsFilledCount++;
            } catch (err) {
                console.warn(`[fillFormFieldsOnPDF] Failed to draw field ${idx}:`, err);
            }
        });

        console.log(`[fillFormFieldsOnPDF] Filled ${fieldsFilledCount}/${fields.length} fields`);

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);

    } catch (error) {
        console.error('[fillFormFieldsOnPDF] Error:', error);
        throw new Error(`Failed to fill form fields: ${error}`);
    }
}

/**
 * Generate SVG overlay with filled form fields
 * NEW APPROACH: Instead of modifying PDF, create SVG layer
 */
export function generateSVGWithFields(
    fields: FormField[],
    fieldValues: FieldMapping,
    pdfWidth: number,
    pdfHeight: number
): string {
    try {
        // Start SVG document
        let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${pdfWidth}" height="${pdfHeight}" viewBox="0 0 ${pdfWidth} ${pdfHeight}">\n`;
        svg += `  <!-- Studio Mode Compiled Form - Blue Ink Layer -->\n`;
        svg += `  <style>\n`;
        svg += `    .field-text {\n`;
        svg += `      font-family: 'Times New Roman', Times, serif;\n`;
        svg += `      font-size: 12px;\n`;
        svg += `      fill: #1E40AF;\n`;  // Blue ink
        svg += `      dominant-baseline: text-before-edge;\n`;
        svg += `    }\n`;
        svg += `  </style>\n\n`;

        let fieldsCount = 0;

        fields.forEach((field, idx) => {
            const value = fieldValues[idx.toString()];
            if (!value || value === 'N/A') return;

            const vertices = field.boundingBox.normalizedVertices;
            if (!vertices || vertices.length < 2) return;

            // Convert normalized coords to actual coords
            const x = vertices[0].x * pdfWidth;
            const y = vertices[0].y * pdfHeight;

            // Escape XML entities
            const escapedValue = value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

            svg += `  <text x="${x.toFixed(2)}" y="${y.toFixed(2)}" class="field-text" data-field="${field.fieldName}">${escapedValue}</text>\n`;
            fieldsCount++;
        });

        svg += `</svg>`;

        console.log(`[generateSVGWithFields] Generated SVG with ${fieldsCount}/${fields.length} fields`);
        return svg;

    } catch (error) {
        console.error('[generateSVGWithFields] Error:', error);
        throw new Error(`Failed to generate SVG: ${error}`);
    }
}

/**
 * Get PDF dimensions from buffer
 */
export async function getPDFDimensions(pdfBuffer: Buffer): Promise<{ width: number; height: number }> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();
        return { width, height };
    } catch (error) {
        console.error('[getPDFDimensions] Error:', error);
        // Default to A4 if we can't read PDF
        return { width: 595, height: 842 }; // A4 in points
    }
}

/**
 * Helper: Escape XML special characters
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
