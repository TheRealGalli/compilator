import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';

export interface PdfFormField {
    name: string;
    label?: string; // Human readable label (e.g. "Name of Reporting Corporation")
    type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown';
    value?: string | boolean;
}

/**
 * Extracts native AcroForm fields from a PDF buffer.
 */
export async function getPdfFormFields(buffer: Buffer): Promise<PdfFormField[]> {
    try {
        const pdfDoc = await PDFDocument.load(buffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        return fields.map(field => {
            const name = field.getName();
            let type: PdfFormField['type'] = 'unknown';

            if (field instanceof PDFTextField) type = 'text';
            else if (field instanceof PDFCheckBox) type = 'checkbox';
            else if (field instanceof PDFDropdown) type = 'dropdown';
            else if (field instanceof PDFRadioGroup) type = 'radio';

            return { name, type };
        });
    } catch (error) {
        console.error('[getPdfFormFields] Error:', error);
        return [];
    }
}

/**
 * Proposes values for detected fields using Gemini.
 * Maps field names visually or by name to source context.
 */
export async function proposePdfFieldValues(
    fields: PdfFormField[],
    sourceContext: string,
    notes: string,
    geminiModel: any
): Promise<Array<{ name: string; label: string; value: string | boolean; reasoning: string }>> {
    try {
        const prompt = `Sei un esperto di Document Intelligence. 
Abbiamo rilevato i seguenti campi tecnici in un PDF ufficiale. 
Il tuo compito è:
1. Mappare le informazioni dalle FONTI e dalle NOTE ai campi del PDF (se pertinenti).
2. Per OGNI campo tecnico, dedurre l'ETICHETTA UMANA (Label) leggendo il nome tecnico o immaginando il testo che lo precede (es. "f1_1[0]" -> "1a. Name of Reporting Corporation").

CAMPI RILEVATI:
${fields.map(f => `- Nome Tecnico: "${f.name}", Tipo: ${f.type}`).join('\n')}

FONTI E CONTESTO:
${sourceContext}

NOTE UTENTE:
${notes}

REGOLE CRITICHE:
1. Restituisci suggerimenti SOLO per i campi che riesci a compilare con certezza dalle fonti.
2. Per ogni suggerimento, fornisci:
   - "name": Il nome tecnico rilevato.
   - "label": L'etichetta umana (es. "1a Name", "Total Assets").
   - "value": Il valore proposto (stringa per testo, booleano per checkbox).
   - "reasoning": Spiegazione breve (max 10 parole).

Restituisci un JSON con questa struttura:
{
  "proposals": [
    { "name": "f1_1[0]", "label": "1a Name of Corporation", "value": "CyberSpace Station", "reasoning": "Trovato nel Master." }
  ]
}
`;

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const response = await result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return [];

        const data = JSON.parse(jsonMatch[0]);
        return data.proposals || [];

    } catch (error) {
        console.error('[proposePdfFieldValues] Error:', error);
        return [];
    }
}

/**
 * Fills the original PDF with the approved values.
 */
export async function fillNativePdf(buffer: Buffer, values: Record<string, string | boolean>): Promise<Buffer> {
    try {
        const pdfDoc = await PDFDocument.load(buffer);
        const form = pdfDoc.getForm();

        for (const [name, value] of Object.entries(values)) {
            try {
                const field = form.getField(name);
                if (field instanceof PDFTextField) {
                    field.setText(String(value));
                } else if (field instanceof PDFCheckBox) {
                    if (value === true || value === 'true' || value === 'on') {
                        field.check();
                    } else {
                        field.uncheck();
                    }
                } else if (field instanceof PDFRadioGroup) {
                    field.select(String(value));
                } else if (field instanceof PDFDropdown) {
                    field.select(String(value));
                }
            } catch (fieldError) {
                console.warn(`[fillNativePdf] Could not fill field "${name}":`, fieldError);
            }
        }

        // Flatten the form to make it non-editable (optional, but professional)
        // form.flatten(); 

        const filledBuffer = await pdfDoc.save();
        return Buffer.from(filledBuffer);
    } catch (error) {
        console.error('[fillNativePdf] Error:', error);
        throw error;
    }
}
