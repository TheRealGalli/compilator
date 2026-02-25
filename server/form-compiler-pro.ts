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
            let value: string | boolean | undefined = undefined;

            if (field instanceof PDFTextField) {
                type = 'text';
                value = field.getText();
            } else if (field instanceof PDFCheckBox) {
                type = 'checkbox';
                value = field.isChecked();
            } else if (field instanceof PDFDropdown) {
                type = 'dropdown';
                const selected = field.getSelected();
                value = selected.length > 0 ? selected[0] : "";
            } else if (field instanceof PDFRadioGroup) {
                type = 'radio';
                value = field.getSelected();
            }

            return { name, label: label || name, type, value };
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
    sourceContext: string,
    notes: string,
    geminiModel: any,
    webResearch: boolean = false
): Promise<Array<{ name: string; label: string; value: string | boolean }>> {
    try {
        const prompt = `Sei un esperto di Document Intelligence.
Il tuo obiettivo è compilare i campi del PDF (FILE MASTER allegato) utilizzando esclusivamente le informazioni presenti nei TESTI FONTE e nelle NOTE UTENTE.

Ti forniamo di seguito lo scheletro completo dei campi del form PDF. Per ogni campo troverai il suo ID tecnico (name), il tipo (text, checkbox, radio, dropdown), un'etichetta (Label, se disponibile) e il suo Valore Attuale.

REGOLE PER I VALORI:
- **Testo**: Inserisci solo il valore finale pulito e diretto.
- **Checkbox/Radio**: Rispondi SOLO 'true' o 'false', oppure il valore esatto dell'opzione selezionata.
- **Valori Preesistenti (CRITICO)**: Se un campo ha già un Valore Attuale sensato (es: '0', 'N/A', o un numero), **NON SOVRASCRIVERLO** con stringhe vuote a meno che le FONTI non indichino esplicitamente un valore diverso per quel campo.
- **Dati Mancanti**: Se non trovi l'informazione nelle FONTI e il campo è vuoto, lascialo vuoto (stringa vuota ""). Usa "[DATO MANCANTE]" solo se l'assenza del dato invalida palesemente il documento nel caso dell'utente. NON inventare mai valori.

SCHELETRO DEI CAMPI DA COMPILARE:
${fields.map(f => `- ID: "${f.name}", Tipo: "${f.type}", Label: "${f.label || 'N/A'}", Valore Attuale: "${f.value !== undefined ? f.value : 'Vuoto'}"`).join('\n')}

TESTO FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

Restituisci ESCLUSIVAMENTE un output in formato JSON valido che rappresenti un array di oggetti chiamato "proposals".
Ogni oggetto deve avere 'name', 'label' e 'value'.
Esempio:
{
  "proposals": [
    { "name": "f1_1[0]", "label": "Name of Reporting Corporation", "value": "Google LLC" }
  ]
}
Assicurati che sia UNICO E VALIDO JSON senza markup markdown aggiuntivo testuale fuori dal JSON.
`;

        const parts: any[] = [{ text: prompt }];

        parts.push({
            inlineData: {
                data: masterFile.base64,
                mimeType: masterFile.mimeType
            }
        });

        for (const source of sourceFiles.slice(0, 5)) {
            parts.push({
                inlineData: {
                    data: source.base64,
                    mimeType: source.mimeType
                }
            });
        }

        const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const response = await result.response;
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return data.proposals || [];
        }

        return [];

    } catch (error) {
        console.error('[proposePdfFieldValues] Fatal Error:', error);
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
