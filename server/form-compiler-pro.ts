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
    const CHUNK_SIZE = 30;
    const fieldChunks: PdfFormField[][] = [];
    for (let i = 0; i < fields.length; i += CHUNK_SIZE) {
        fieldChunks.push(fields.slice(i, i + CHUNK_SIZE));
    }

    const allProposals: Array<{ name: string; label: string; value: string | boolean }> = [];

    // Process chunks in small parallel batches to avoid Vertex rate limits while improving focus
    for (let i = 0; i < fieldChunks.length; i += 2) {
        const batch = fieldChunks.slice(i, i + 2);

        const batchResults = await Promise.all(batch.map(async (chunk, chunkIdx) => {
            try {
                const prompt = `Sei un esperto di Document Intelligence ad alta precisione.
Il tuo obiettivo è compilare un BLOCCO di campi del PDF (FILE MASTER allegato) utilizzando i TESTI FONTE, le NOTE UTENTE e la tua conoscenza tecnica.

SCHELETRO DEI CAMPI DA COMPILARE (Blocco ${i / CHUNK_SIZE + chunkIdx + 1}):
${chunk.map(f => `- ID: "${f.name}", Tipo: "${f.type}", Label: "${f.label || 'N/A'}", Valore Attuale: "${f.value !== undefined ? f.value : 'Vuoto'}"`).join('\n')}

REGOLE DI PRECISIONE (TASSATIVE):
1. **Verifica Coerenza Label**: Prima di inserire un valore, confrontalo con la Label del campo. Se il campo chiede una DATA (es. 'Date of incorporation'), NON inserire un NOME o un INDIRIZZO.
2. **Web Research (Se Attiva)**: ${webResearch ? 'È ATTIVA la ricerca Google. Se le istruzioni per compilare questo specifico PDF sono ambigue o se mancano direttive nelle fonti, USALA per cercare le regole ufficiali di compilazione (es. istruzioni IRS per il modulo caricato).' : 'Non attiva.'}
3. **Valori Preesistenti**: Preserva valori come '0' o 'N/A' se sensati.
4. **Dati Mancanti**: Lascia vuoto ("") se il dato non esiste. Usa "[DATO MANCANTE]" solo per casistiche critiche.

TESTO FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

Restituisci ESCLUSIVAMENTE un JSON conforme a questo esempio:
{
  "proposals": [
    { "name": "ID_CAMPO", "label": "LABEL_LETTA", "value": "VALORE_TROVATO" }
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

                // Add primary Source files (limit to first 5 for performance)
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
            } catch (err) {
                console.error(`[proposePdfFieldValues] Error in chunk:`, err);
            }
            return [];
        }));

        allProposals.push(...batchResults.flat());
    }

    return allProposals;
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
