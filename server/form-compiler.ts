import { PDFDocument } from 'pdf-lib';

/**
 * Core interfaces for form discovery
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

/**
 * Pure-Gemini Discovery Loop
 * Gemini 2.0 scans the image and identifies "fillable" areas.
 */
export async function discoverFieldsWithGemini(
    pdfBase64: string,
    geminiModel: any
): Promise<FormField[]> {
    try {
        console.log('[discoverFieldsWithGemini] Starting pure-Gemini field discovery...');

        const prompt = `Sei un esperto di analisi di moduli cartacei (Document Intelligence).
Analizza l'immagine del PDF e identifica TUTTI i campi che dovrebbero essere compilati.

Per ogni campo, fornisci un JSON con questa struttura:
{
  "fields": [
    {
      "fieldName": "Nome del campo (es: Cognome)",
      "box": [ymin, xmin, ymax, xmax],
      "type": "text | date | checkbox | signature"
    }
  ]
}

Sii estremamente preciso con le coordinate normalizzate (0-1).`;

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
            console.warn('[discoverFieldsWithGemini] No JSON found in response');
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
 * Get PDF dimensions from buffer (still used by some parts of the system if needed)
 */
export async function getPDFDimensions(pdfBuffer: Buffer): Promise<{ width: number; height: number }> {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();
        return { width, height };
    } catch (error) {
        console.error('[getPDFDimensions] Error:', error);
        return { width: 595, height: 842 }; // A4
    }
}
