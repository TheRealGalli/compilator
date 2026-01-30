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
    geminiModel: any,
    webResearch: boolean = false
): Promise<Array<{ name: string; label: string; value: string | boolean; reasoning: string }>> {
    try {
        const tools: any[] = [];
        if (webResearch) {
            tools.push({ googleSearch: {} });
        }

        const prompt = `Sei un esperto di Document Intelligence e Precision Mapping. 
Abbiamo rilevato i seguenti campi tecnici in un PDF ufficiale (FILE MASTER allegato). 

IL TUO OBIETTIVO: 
Mappare con precisione ogni informazione dalle FONTI ai campi del PDF originale.

PROCESSO DI ANALISI:
1. **Analisi Visiva Master**: Guarda attentamente il FILE MASTER (immagine PDF). Identifica la posizione visiva di ogni campo tecnico (es. "f1_1[0]").
2. **Lettura Etichette**: Leggi il testo stampato immediatamente sopra, sotto o accanto al box del campo nel FILE MASTER (es. "1a Name of reporting corporation", "City or town"). 
3. **Sostituzione Label**: Ignora il nome tecnico (es. "f1_1") e usa come "label" l'etichetta umana che hai letto visivamente.
4. **Mappatura Dati**: Cerca nelle FONTI e nelle NOTE UTENTE l'informazione che corrisponde a quell'etichetta visiva.
${webResearch ? `5. **Ricerca Web**: Se un campo è ambiguo (es. "Box 12 code"), cerca le istruzioni ufficiali del modulo per capire cosa inserire.` : ''}

REGOLE DI RISPOSTA:
- Sii estremamente preciso: se il campo chiede solo la città, non mettere l'indirizzo intero.
- Per le checkbox, rispondi true o false.
- Se l'informazione manca, scrivi "[FONTE MANCANTE]".

CAMPI DA ANALIZZARE:
${fields.map(f => `- ID: "${f.name}", Label Attuale: "${f.label || 'N/A'}"`).join('\n')}

TESTO FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

Restituisci JSON:
{
  "proposals": [
    { 
      "name": "ID originale", 
      "label": "Etichetta Umana Leggibile", 
      "value": "Valore Proposto", 
      "reasoning": "Logica usata (es: Trovata nel box 1a del Master)" 
    }
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
