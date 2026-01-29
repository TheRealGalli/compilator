import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';

export interface PdfFormField {
    name: string;
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
): Promise<Array<{ name: string; value: string | boolean; reasoning: string }>> {
    try {
        const prompt = `Sei un esperto di Document Intelligence. 
Abbiamo rilevato i seguenti campi in un PDF ufficiale. 
Il tuo compito è mappare le informazioni dalle FONTI e dalle NOTE ai nomi tecnici dei campi del PDF.

CAMPI RILEVATI:
${fields.map(f => `- Nome: "${f.name}", Tipo: ${f.type}`).join('\n')}

FONTI E CONTESTO:
${sourceContext}

NOTE UTENTE:
${notes}

REGOLE:
1. Per ogni campo, fornisci una suggestione di valore (stringa per testo, booleano per checkbox).
2. Spiega BREVEMENTE (max 15 parole) il PERCHÉ di quel valore citando la fonte.
3. Se un dato non è presente, proponi un valore vuoto o "false".

Restituisci un JSON con questa struttura:
{
  "proposals": [
    { "name": "NomeCampo", "value": "ValoreProposto", "reasoning": "Spiegazione..." }
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
