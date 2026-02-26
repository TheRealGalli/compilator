import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';

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
    fileBase64: string,
    geminiModel: any,
    mimeType: string = 'application/pdf'
): Promise<FormField[]> {
    try {
        console.log(`[discoverFieldsWithGemini] Starting pure-Gemini field discovery for ${mimeType}...`);

        const prompt = `Sei un esperto di analisi di documenti e intelligence (Document Intelligence).
Analizza il file fornito (PDF, Testo o Immagine) e identifica TUTTI i "campi" o le "entità" che potrebbero essere compilati o che rappresentano dati chiave da estrarre.

Per ogni campo, fornisci un JSON con questa struttura:
{
  "fields": [
    {
      "fieldName": "Nome del campo (es: Cognome, Data, Indirizzo)",
      "box": [ymin, xmin, ymax, xmax],
      "type": "text | date | checkbox | signature | entity"
    }
  ]
}

**PROTOCOLLO ANTI-LOOP**: Se il documento è troppo complesso e rischi di generare migliaia di campi identici, fermati e chiedi chiarimenti. NON ripetere mai caratteri grafici per più di 15 volte.

Sii estremamente preciso. Per i file PDF/Immagini usa coordinate normalizzate (0-1). Per i file di puro testo, prova a stimarne la posizione nel documento.`;

        const isDOCX = mimeType.includes('wordprocessingml') || mimeType.includes('msword');
        const parts: any[] = [{ text: prompt }];

        if (isDOCX) {
            console.log(`[discoverFieldsWithGemini] DOCX detected, extracting text...`);
            const buffer = Buffer.from(fileBase64, 'base64');
            const { value: text } = await mammoth.extractRawText({ buffer });
            parts.push({ text: `[CONTENUTO DOCUMENTO WORD]:\n${text}` });
        } else {
            parts.push({
                inlineData: {
                    data: fileBase64,
                    mimeType: mimeType
                }
            });
        }


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
