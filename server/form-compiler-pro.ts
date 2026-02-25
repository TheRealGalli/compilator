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
): Promise<Array<{ name: string; label: string; value: string | boolean; reasoning: string }>> {
    try {
        const prompt = `Sei un esperto di Document Intelligence ad altissima precisione.
Il tuo obiettivo è analizzare e compilare il PDF (FILE MASTER allegato) procedendo in modo sequenziale, campo per campo, partendo dal primo ID tecnico fornito.

SCHELETRO DEI CAMPI DA COMPILARE:
${fields.map(f => `- ID: "${f.name}", Tipo: "${f.type}", Label: "${f.label || 'N/A'}", Valore Attuale: "${f.value !== undefined ? f.value : 'Vuoto'}"`).join('\n')}

PROTOCOLLO DI ANALISI SPAZIALE (TASSATIVO):
1. **Localizzazione Visiva**: Per ogni ID (es: "f1_1[0]"), trova la sua posizione esatta nel FILE MASTER (immagine).
2. **Lettura Etichetta Umana**: Leggi l'etichetta stampata accanto o sopra il campo. Ignora il nome tecnico se contrasta con l'etichetta visiva.
3. **Cross-Reference & Reasoning**: Cerca nelle FONTI il dato corrispondente all'etichetta letta. Formula un breve pensiero (reasoning) che spieghi perché hai scelto quel valore (es: "Trovato indirizzo in fattura X corrispondente a label 1c").
4. **Web Research (Se Attivo)**: ${webResearch ? 'È ATTIVA la ricerca Google. Usala per chiarire dubbi su codici o istruzioni ministeriali del modulo.' : 'Non attiva.'}
5. **Precisione**: Preserva '0', 'N/A' o valori preesistenti se validi.

TESTO FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

Restituisci ESCLUSIVAMENTE un JSON conforme a questo esempio:
{
  "proposals": [
    { 
      "name": "f1_1[0]", 
      "label": "Name of Reporting Corporation", 
      "value": "Google LLC",
      "reasoning": "Rilevato nome società nell'intestazione del file master."
    }
  ]
}
`;

        const parts: any[] = [{ text: prompt }];

        // Add Master PDF
        parts.push({
            inlineData: {
                data: masterFile.base64,
                mimeType: masterFile.mimeType
            }
        });

        // Add primary Source files (limit to first 5 for performance and token limits)
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
