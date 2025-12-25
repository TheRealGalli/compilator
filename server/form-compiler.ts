import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Helper functions for scanned form compilation using Document AI Form Parser
 */

/**
 * Core interfaces for form discovery and mapping
 */
export interface FormField {
    fieldName: string;
    fieldType: string;
    boundingBox: {
        normalizedVertices: Array<{ x: number; y: number }>;
    };
    confidence: number;
    pageNumber: number;
}

export interface FieldMapping {
    [fieldName: string]: string | {
        value: string;
        x?: number;
        y?: number;
    };
}

/**
 * NEW: Pure-Gemini Discovery Loop
 * Instead of Document AI, Gemini 2.0 Master scans the image and identifies "fillable" areas.
 */
export async function discoverFieldsWithGemini(
    pdfBase64: string,
    geminiModel: any
): Promise<FormField[]> {
    try {
        console.log('[discoverFieldsWithGemini] Starting pure-Gemini field discovery...');

        const prompt = `Sei un esperto di analisi di moduli cartacei (Document Intelligence).
Analizza l'immagine del PDF e identifica TUTTI i campi che dovrebbero essere compilati.

Per ogni campo, fornisci:
1. "fieldName": Un nome descrittivo semantico (es: "Cognome", "Codice Fiscale", "Data di Nascita").
2. "box": Coordinate normalizzate [ymin, xmin, ymax, xmax] (0-1) che circondano lo spazio dove andrebbe scritto il testo (la riga o il box).
3. "type": Il tipo di campo (text, date, signature, checkbox).

Sii estremamente preciso con le coordinate X e Y. Se vedi una riga orizzontale, il box deve stare esattamente sopra di essa.

**OUTPUT RICHIESTO (solo JSON):**
{
  "fields": [
    { "fieldName": "Nome", "box": [0.12, 0.45, 0.15, 0.65], "type": "text" },
    ...
  ]
}`;

        const parts: any[] = [
            { text: prompt },
            {
                inlineData: {
                    data: pdfBase64,
                    mimeType: 'application/pdf'
                }
            }
        ];

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: parts }]
        });

        let text = '';
        const response = await result.response;
        if (typeof response.text === 'function') {
            text = response.text();
        } else {
            text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[discoverFieldsWithGemini] No JSON found in response, returning empty fields');
            return [];
        }

        const data = JSON.parse(jsonMatch[0]);
        const geminiFields = data.fields || [];

        // Map Gemini output to our FormField interface
        const fields: FormField[] = geminiFields.map((f: any, idx: number) => {
            const [ymin, xmin, ymax, xmax] = f.box || [0, 0, 0, 0];
            return {
                fieldName: f.fieldName || `campo_${idx}`,
                fieldType: f.type || 'text',
                boundingBox: {
                    normalizedVertices: [
                        { x: xmin, y: ymin },
                        { x: xmax, y: ymin },
                        { x: xmax, y: ymax },
                        { x: xmin, y: ymax }
                    ]
                },
                confidence: 1.0,
                pageNumber: 0
            };
        });

        console.log(`[discoverFieldsWithGemini] Successfully discovered ${fields.length} fields`);
        return fields;

    } catch (error: any) {
        console.error('[discoverFieldsWithGemini] Error during discovery:', error.message);
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
5. **Simboli pre-stampati**: Se il modulo ha già dei simboli (es. '/' nelle date come '__/__/____' o ':' negli orari), NON includere questi simboli nel valore se il testo deve essere inserito negli spazi tra di essi.
6. **Griglie di caratteri**: Se noti una griglia di quadratini singoli (es. per il Codice Fiscale o P.IVA), e Document AI ha identificato ogni quadratino come un campo separato, inserisci UN SOLO carattere per ogni campo corrispondente.
7. **Allineamento**: Assicurati che il testo sia centrato orizzontalmente rispetto allo spazio disponibile se si tratta di quadratini, o allineato a sinistra se si tratta di righe lunghe.
8. Usa coordinate normalizzate (0-1).

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

        let text = '';
        try {
            const response = await result.response;
            if (typeof response.text === 'function') {
                text = response.text();
            } else {
                text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
        } catch (e) {
            console.error('[decideFieldContents] Error extracting text:', e);
            text = JSON.stringify(result);
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[decideFieldContents] No JSON found in response:', text);
            return {};
        }

        const mappings = JSON.parse(jsonMatch[0]);
        console.log(`[decideFieldContents] Generated ${Object.keys(mappings).length} field mappings`);
        return mappings;

    } catch (error: any) {
        console.error('[decideFieldContents] Error:', error.message);
        return {};
    }
}

/**
 * Visual Audit: Gemini Vision analyzes the proposed placements and corrects them.
 * This is the "Red Pin" logic: checking if characters land exactly where they should.
 */
export async function auditFieldPlacements(
    pdfBase64: string,
    proposedMappings: FieldMapping,
    fields: FormField[],
    geminiModel: any
): Promise<FieldMapping> {
    try {
        console.log('[auditFieldPlacements] Starting visual audit for precision...');

        const auditDescription = Object.keys(proposedMappings).map(idx => {
            const m = proposedMappings[idx];
            const field = fields[parseInt(idx)];
            const val = typeof m === 'string' ? m : m.value;
            const x = typeof m === 'object' ? m.x : 0;
            const y = typeof m === 'object' ? m.y : 0;
            return `Campo ${idx} ("${field.fieldName}"): Valore="${val}", Proposta X=${x?.toFixed(3)}, Y=${y?.toFixed(3)}`;
        }).join('\n');

        let prompt = `Sei un esperto di precisione tipografica. Analizza l'immagine del modulo e verifica se le coordinate (x,y) proposte fanno "poggiare" il testo esattamente sopra le righe fisiche o nei box.

**COORDINATE PROPOSTE:**
${auditDescription}

**ISTRUZIONI DI CONTROLLO:**
1. Osserva l'immagine reale. Dove vedi una riga orizzontale, il testo deve stare circa 1-2 pixel SOPRA di essa.
2. Se vedi dei box (quadratini per Codice Fiscale, etc.), il carattere deve essere CENTRATO perfettamente nel box.
3. Se le coordinate proposte sono palesemente fuori riga o fuori box, CORREGGILE (x, y) basandoti solo sulla visione.
4. Se sono accettabili, confermale.
5. Usa coordinate normalizzate (0-1).

**OUTPUT RICHIESTO (solo JSON):**
{
  "0": { "value": "Valore", "x": 0.123, "y": 0.456 },
  ...
}`;

        const parts: any[] = [
            { text: prompt },
            {
                inlineData: {
                    data: pdfBase64,
                    mimeType: 'application/pdf'
                }
            }
        ];

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: parts }]
        });

        let text = '';
        try {
            const response = await result.response;
            if (typeof response.text === 'function') {
                text = response.text();
            } else {
                text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
        } catch (e) {
            console.error('[auditFieldPlacements] Error extracting response:', e);
            return proposedMappings;
        }

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[auditFieldPlacements] Audit failed to return JSON, using original mappings');
            return proposedMappings;
        }

        const auditedMappings = JSON.parse(jsonMatch[0]);
        console.log(`[auditFieldPlacements] Visual audit completed. Corrections: ${Object.keys(auditedMappings).length}`);
        return auditedMappings;

    } catch (error: any) {
        console.error('[auditFieldPlacements] Error during audit:', error.message);
        return proposedMappings;
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
        // Start SVG document (No XML declaration as it's used as an overlay in HTML)
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pdfWidth}" height="${pdfHeight}" viewBox="0 0 ${pdfWidth} ${pdfHeight}" style="background:transparent;">\n`;
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
