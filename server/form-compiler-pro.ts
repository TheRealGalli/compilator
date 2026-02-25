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
        const CHUNK_SIZE = 40; // Max fields per parallel request
        const fieldChunks: PdfFormField[][] = [];
        for (let i = 0; i < fields.length; i += CHUNK_SIZE) {
            fieldChunks.push(fields.slice(i, i + CHUNK_SIZE));
        }

        const allProposals: Array<{ name: string; label: string; value: string | boolean }> = [];

        await Promise.all(fieldChunks.map(async (chunk, index) => {
            const prompt = `Sei un esperto di Document Intelligence e Precision Mapping. 
Abbiamo rilevato i seguenti campi tecnici in un PDF ufficiale (FILE MASTER allegato). 

IL TUO OBIETTIVO: 
Mappare con precisione chirurgica ogni informazione dalle FONTI ai campi del PDF originale.

PROCESSO DI ANALISI (TASSATIVO):
1. **Analisi Visiva Master**: Guarda il FILE MASTER (immagine/PDF). Trova la posizione esatta di ogni ID (es: "f1_1[0]").
2. **Lettura Etichetta**: Leggi l'etichetta umana stampata proprio sopra o accanto a quel campo (es: "1a Name of Corporation").
3. **Verifica Incrociata**: NON basarti sul nome tecnico per dedurre il contenuto. Usa SOLO l'etichetta visiva che hai letto.
4. **Mappatura Dati**: Cerca nelle FONTI l'informazione che risponde a quell'etichetta.

REGOLE PER I VALORI:
- **Testo**: Inserisci il valore pulito. Se un campo chiede "Anno", scrivi "2025", non "L'anno è 2025".
- **Checkbox**: Rispondi SOLO true o false.
- **Valori Preesistenti (CRITICO)**: Se un campo ha già un Valore Attuale sensato (es: '0', 'N/A', o un numero), **NON SOVRASCRIVERLO** con stringhe vuote o avvisi a meno che le FONTI non indichino esplicitamente un valore diverso per quel campo.
- **Dati Mancanti**: Se non trovi l'informazione nelle FONTI e il campo è vuoto, lascialo vuoto (stringa vuota ""). Usa "[DATO MANCANTE]" **SOLO ED ESCLUSIVAMENTE** come ultima risorsa se l'assenza del dato invalida palesemente il documento. NON inventare mai valori plausibili.

CAMPI DA ANALIZZARE (CHUNK ${index + 1} di ${fieldChunks.length}):
${chunk.map(f => `- ID: "${f.name}", Tipo: "${f.type}", Label: "${f.label || 'N/A'}", Valore Attuale: "${f.value !== undefined ? f.value : 'Vuoto'}"`).join('\n')}

TESTO FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

Restituisci ESCLUSIVAMENTE un JSON conforme allo schema richiesto. Non includere altre chiavi.
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

            try {
                const result = await geminiModel.generateContent({
                    contents: [{ role: 'user', parts }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                proposals: {
                                    type: "ARRAY",
                                    items: {
                                        type: "OBJECT",
                                        properties: {
                                            name: { type: "STRING" },
                                            label: { type: "STRING" },
                                            value: { type: "STRING" }
                                        },
                                        required: ["name", "label", "value"]
                                    }
                                }
                            },
                            required: ["proposals"]
                        }
                    }
                });

                const response = await result.response;
                const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    if (data.proposals) {
                        allProposals.push(...data.proposals);
                    }
                }
            } catch (chunkErr) {
                console.error(`[proposePdfFieldValues] Error in chunk ${index}:`, chunkErr);
            }
        }));

        return allProposals;

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
