import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFName, PDFString, PDFHexString } from 'pdf-lib';

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
            let label = "";

            // Try to extract a useful label from the native field properties (Alternate Name / TU)
            try {
                // @ts-ignore - access internal acroField for advanced properties
                const acroField = (field as any).acroField;
                if (acroField) {
                    const dict = acroField.dict;
                    const tu = dict.get(PDFName.of('TU'));
                    if (tu instanceof PDFString || tu instanceof PDFHexString) {
                        label = tu.decodeText();
                    }
                }
            } catch (e) {
                console.warn(`[getPdfFormFields] Could not get alternate name for ${name}`);
            }

            let type: PdfFormField['type'] = 'unknown';
            if (field instanceof PDFTextField) type = 'text';
            else if (field instanceof PDFCheckBox) type = 'checkbox';
            else if (field instanceof PDFDropdown) type = 'dropdown';
            else if (field instanceof PDFRadioGroup) type = 'radio';

            return { name, label: label || name, type };
        });
    } catch (error) {
        console.error('[getPdfFormFields] Error:', error);
        return [];
    }
}

export interface MultimodalFile {
    base64: string;
    mimeType: string;
    name: string;
}

/**
 * Proposes values for detected fields using Gemini.
 * Uses Multimodal capabilities to "see" the PDF instead of relying on broken text extraction.
 */
export async function proposePdfFieldValues(
    fields: PdfFormField[],
    masterFile: MultimodalFile,
    sourceFiles: MultimodalFile[],
    sourceContext: string, // Text-based context (MD, DOCX, etc.)
    notes: string,
    geminiModel: any
): Promise<Array<{ name: string; label: string; value: string | boolean; reasoning: string }>> {
    try {
        const prompt = `Sei un esperto di Document Intelligence. 
Abbiamo rilevato i seguenti campi tecnici in un PDF ufficiale (FILE MASTER allegato). 
Il tuo compito è:
1. Analizzare il FILE MASTER per capire visivamente a cosa corrispondono i campi tecnici.
2. Mappare le informazioni dai DOCUMENTI FONTE allegati e dalle NOTE ai campi del PDF.
3. Per OGNI campo tecnico, dedurre l'ETICHETTA UMANA (Label) leggendo il nome tecnico (es. "f1_1[0]") e GUARDARE il FILE MASTER per capire cosa c'è scritto accanto o sopra al campo (es. "1a. Name of Reporting Corporation"). È fondamentale che il "label" sia leggibile e utile per un umano.

CAMPI RILEVATI DA COMPILARE:
${fields.map(f => `- Nome Tecnico: "${f.name}", Etichetta: "${f.label || 'N/A'}"`).join('\n')}

TESTO ESTRATTO DALLE FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

REGOLE CRITICHE:
1. Restituisci suggerimenti SOLO per i campi che riesci a compilare con ragionevole certezza.
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

        // Prepare multimodal parts
        const parts: any[] = [{ text: prompt }];

        // Add Master PDF
        parts.push({
            inlineData: {
                data: masterFile.base64,
                mimeType: masterFile.mimeType
            }
        });

        // Add Source Files (limit to avoid token/quota issues if many)
        for (const source of sourceFiles.slice(0, 5)) {
            parts.push({
                inlineData: {
                    data: source.base64,
                    mimeType: source.mimeType
                }
            });
        }

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts }]
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
