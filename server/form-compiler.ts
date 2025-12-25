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
    [fieldName: string]: string | {
        value: string;
        x?: number;
        y?: number;
    };
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

        // DETAILED LOGGING for debugging
        console.log('[extractFormFields] === DOCUMENT AI RESPONSE DEBUG ===');
        console.log('[extractFormFields] Document exists:', !!document);
        console.log('[extractFormFields] Pages count:', document?.pages?.length || 0);

        if (document) {
            console.log('[extractFormFields] Available properties:', Object.keys(document));

            // CHECK FOR ENTITIES (alternative extraction method)
            if (document.entities) {
                console.log('[extractFormFields] !!! FOUND ENTITIES !!!');
                console.log('[extractFormFields] Entities count:', document.entities.length);
                if (document.entities.length > 0) {
                    console.log('[extractFormFields] First entity structure:',
                        JSON.stringify(document.entities[0], null, 2));
                }
            } else {
                console.log('[extractFormFields] No entities array found');
            }

            if (document.pages && document.pages.length > 0) {
                const firstPage = document.pages[0];
                console.log('[extractFormFields] First page properties:', Object.keys(firstPage));
                console.log('[extractFormFields] Has formFields:', !!firstPage.formFields);
                console.log('[extractFormFields] formFields length:', firstPage.formFields?.length || 0);
                console.log('[extractFormFields] Has tables:', !!firstPage.tables);
                console.log('[extractFormFields] Has paragraphs:', !!firstPage.paragraphs);
                console.log('[extractFormFields] Has lines:', !!firstPage.lines);
                console.log('[extractFormFields] Has tokens:', !!firstPage.tokens);

                // Log full structure of formFields if present
                if (firstPage.formFields && firstPage.formFields.length > 0) {
                    console.log('[extractFormFields] First formField structure:',
                        JSON.stringify(firstPage.formFields[0], null, 2));
                }
            }
        }
        console.log('[extractFormFields] === END DEBUG ===');

        if (!document?.pages) {
            console.warn('[extractFormFields] No pages found in document');
            return [];
        }

        const fields: FormField[] = [];

        // Extract form fields from Document AI response
        for (let pageIndex = 0; pageIndex < document.pages.length; pageIndex++) {
            const page = document.pages[pageIndex];

            console.log(`[extractFormFields] Processing page ${pageIndex}...`);

            if (page.formFields) {
                console.log(`[extractFormFields] Found ${page.formFields.length} form fields on page ${pageIndex}`);

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
            } else {
                console.log(`[extractFormFields] No formFields property on page ${pageIndex}`);
            }
        }




        console.log(`[extractFormFields] Found ${fields.length} form fields`);

        // FALLBACK: If Form Parser found 0 fields, try OCR Processor
        if (fields.length === 0) {
            const ocrProcessorId = process.env.DOCUMENT_AI_PROCESSOR_ID_2;

            if (ocrProcessorId) {
                console.log('[extractFormFields] ⚠️ Form Parser found 0 fields - trying OCR fallback...');
                const ocrFields = await extractFieldsFromOCR(pdfBuffer, projectId, ocrProcessorId);
                console.log(`[extractFormFields] ✅ OCR Processor found ${ocrFields.length} fields`);
                return ocrFields;
            } else {
                console.warn('[extractFormFields] DOCUMENT_AI_PROCESSOR_ID_2 not set - no OCR fallback available');
            }
        }

        return fields;

    } catch (error) {
        console.error('[extractFormFields] Error:', error);
        throw new Error(`Failed to extract form fields: ${error}`);
    }
}

/**
 * Fallback: Extract form fields using OCR Processor
 * Uses pattern matching on OCR text to identify form fields
 */
async function extractFieldsFromOCR(pdfBuffer: Buffer, projectId: string, ocrProcessorId: string): Promise<FormField[]> {
    try {
        const location = 'eu';
        const apiEndpoint = `${location}-documentai.googleapis.com`;
        const client = new DocumentProcessorServiceClient({ apiEndpoint });

        const processorName = `projects/${projectId}/locations/${location}/processors/${ocrProcessorId}`;
        console.log(`[extractFieldsFromOCR] Using OCR processor: ${processorName}`);

        const base64Content = pdfBuffer.toString('base64');

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
            console.warn('[extractFieldsFromOCR] No pages found');
            return [];
        }

        const fields: FormField[] = [];

        // Patterns for Italian form fields
        const formPatterns = [
            { pattern: /(.+?):\s*_{3,}/gi, type: 'text' },
            { pattern: /(.+?)\s+_{5,}/gi, type: 'text' },
            { pattern: /Il\/La\s+sottoscritto\/a/i, type: 'text', name: 'Il/La sottoscritto/a' },
            { pattern: /nato\s+il/i, type: 'date', name: 'nato il' },
            { pattern: /Data\s*[_\.]{2,}/i, type: 'date', name: 'Data' },
            { pattern: /Firma.*titolare/i, type: 'signature', name: 'Firma del titolare' },
            { pattern: /codice\s+fiscale/i, type: 'text', name: 'Codice Fiscale' },
        ];

        for (const page of document.pages) {
            if (!page.paragraphs) continue;

            for (const paragraph of page.paragraphs) {
                const textAnchor = paragraph.layout?.textAnchor;
                if (!textAnchor) continue;

                const startIndex = textAnchor.textSegments?.[0]?.startIndex || 0;
                const endIndex = textAnchor.textSegments?.[0]?.endIndex || 0;
                const text = document.text?.substring(Number(startIndex), Number(endIndex)) || '';

                const boundingPoly = paragraph.layout?.boundingPoly;
                if (!boundingPoly?.normalizedVertices) continue;

                for (const { pattern, type, name } of formPatterns) {
                    const match = text.match(pattern);
                    if (match) {
                        const fieldName = name || (match[1]?.trim()) || text.substring(0, 50);

                        const vertices = boundingPoly.normalizedVertices.filter(
                            (v): v is { x: number; y: number } =>
                                v !== null && v !== undefined &&
                                typeof v.x === 'number' && typeof v.y === 'number'
                        );

                        if (vertices.length > 0) {
                            fields.push({
                                fieldName: fieldName.trim(),
                                fieldType: type,
                                boundingBox: { normalizedVertices: vertices },
                                confidence: paragraph.layout?.confidence || 0.8,
                                pageNumber: 0
                            });
                        }
                        break;
                    }
                }
            }
        }

        console.log(`[extractFieldsFromOCR] Found ${fields.length} fields via OCR pattern matching`);
        return fields;

    } catch (error: any) {
        console.error('[extractFieldsFromOCR] Error:', error.message);
        return [];
    }
}


/**
 * Use Gemini to decide what content to fill in each field
 */
export async function decideFieldContents(
    fields: FormField[],
    documentContext: string,
    geminiModel: any,
    pdfBase64?: string
): Promise<FieldMapping> {
    try {
        const fieldsDescription = fields.map((f, idx) =>
            `${idx}. "${f.fieldName}" (posizione approssimativa: x=${f.boundingBox.normalizedVertices[0].x.toFixed(3)}, y=${f.boundingBox.normalizedVertices[0].y.toFixed(3)})`
        ).join('\n');

        let prompt = `Analizza questo modulo scansionato e decidi il contenuto per ogni campo.
DEVI anche raffinare la posizione verticale (y) per assicurarti che il testo "poggi" esattamente sulla linea orizzontale del campo.

**CAMPI RILEVATI (Document AI):**
${fieldsDescription}

**CONTESTO DOCUMENTO:**
${documentContext}

**ISTRUZIONI DI GROUNDING VISIVO:**
1. Osserva l'immagine del PDF allegato.
2. Per ogni campo, decidi il valore da scrivere.
3. Se vedi una linea orizzontale (__________), fornisci le coordinate (x, y) esatte dove il testo dovrebbe iniziare per sembrare scritto a mano sopra la linea.
4. Il valore y dovrebbe essere leggermente sopra la linea fisica.
5. Se il modulo ha già dei simboli pre-stampati (es. "/" nelle date come __/__/____), EVITA di includere quel simbolo nel valore se il campo punta a uno spazio specifico tra i simboli. In generale, non duplicare simboli grafici già presenti nel layout.
6. Usa coordinate normalizzate (0-1).

**OUTPUT RICHIESTO (solo JSON):**
{
  "0": { "value": "Testo", "x": 0.452, "y": 0.512 },
  "1": { "value": "Altro testo", "x": 0.120, "y": 0.580 }
}`;

        const parts: any[] = [{ text: prompt }];

        if (pdfBase64) {
            parts.push({
                inlineData: {
                    data: pdfBase64,
                    mimeType: 'application/pdf'
                }
            });
        }

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: parts }]
        });
        const response = await result.response;
        const text = response.text();

        // Find JSON block
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[decideFieldContents] No JSON found in response:', text);
            return {};
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error: any) {
        console.error('[decideFieldContents] Error:', error.message);
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
        const mapping = fieldValues[idx.toString()];
        if (!mapping || mapping === 'N/A') return;

        const value = typeof mapping === 'string' ? mapping : mapping.value;
        if (!value || value === 'N/A') return;

        const vertices = field.boundingBox.normalizedVertices;
        if (!vertices || vertices.length < 2) return;

        // Calculate position and size from bounding box
        // Document AI returns normalized coordinates (0-1)
        let x, y;
        if (typeof mapping !== 'string' && typeof mapping.x === 'number' && typeof mapping.y === 'number') {
            x = mapping.x * pdfWidth;
            y = mapping.y * pdfHeight;
        } else {
            // Document AI default (usually top-left of label)
            x = vertices[0].x * pdfWidth;
            y = vertices[0].y * pdfHeight;
        }

        // Calculate dynamic height if not explicit
        const h = vertices.length >= 4
            ? (vertices[2].y - vertices[1].y) * pdfHeight
            : 20;

        // Calculate font size based on field height (roughly 70% of height)
        const fontSize = Math.max(8, Math.min(h * 0.7, 14));

        // Blue ink color
        const blueInk = '#1E40AF';

        // Create text element with precise positioning
        svgElements.push(`
      <text 
        x="${x + 2}" 
        y="${y + (h * 0.75)}" 
        font-family="Helvetica, Arial, sans-serif" 
        font-size="${fontSize}px" 
        fill="${blueInk}"
        text-anchor="start"
      >${escapeXml(value)}</text>
    `);
    });

    const svg = `<svg width="${pdfWidth}" height="${pdfHeight}" xmlns="http://www.w3.org/2000/svg" style="background:transparent;">
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
            const mapping = fieldValues[idx.toString()];
            if (!mapping || mapping === 'N/A') return;

            const value = typeof mapping === 'string' ? mapping : mapping.value;
            if (!value || value === 'N/A') return;

            const page = pages[field.pageNumber] || pages[0];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            const vertices = field.boundingBox.normalizedVertices;
            if (!vertices || vertices.length < 2) return;

            // Use refined coordinates if available
            let x, y;
            if (typeof mapping !== 'string' && typeof mapping.x === 'number' && typeof mapping.y === 'number') {
                x = mapping.x * pageWidth;
                // PDF coordinates start from bottom, Gemini (vision normalized) from top
                y = pageHeight - (mapping.y * pageHeight);
            } else {
                x = vertices[0].x * pageWidth;
                y = pageHeight - (vertices[0].y * pageHeight);
            }

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
            const mapping = fieldValues[idx.toString()];
            if (!mapping || mapping === 'N/A') return;

            const value = typeof mapping === 'string' ? mapping : mapping.value;
            if (!value || value === 'N/A') return;

            const vertices = field.boundingBox.normalizedVertices;
            if (!vertices || vertices.length < 2) return;

            // Use refined coordinates if provided by Gemini, otherwise fallback to Document AI
            let x, y;
            if (typeof mapping !== 'string' && typeof mapping.x === 'number' && typeof mapping.y === 'number') {
                x = mapping.x * pdfWidth;
                y = mapping.y * pdfHeight;
                console.log(`[generateSVGWithFields] Using REFINED coordinates for field ${idx}: ${x}, ${y}`);
            } else {
                x = vertices[0].x * pdfWidth;
                y = vertices[0].y * pdfHeight;
            }

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
