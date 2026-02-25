import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFName, PDFString, PDFHexString } from 'pdf-lib';

export interface PdfFormField {
    name: string;
    label?: string; // Human readable label (e.g. "Name of Reporting Corporation")
    type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown';
    value?: string | boolean;
    page?: number;
    rect?: { x: number; y: number; width: number; height: number };
}

/**
 * Extracts native AcroForm fields from a PDF buffer.
 */
export async function getPdfFormFields(buffer: Buffer): Promise<PdfFormField[]> {
    try {
        const pdfDoc = await PDFDocument.load(buffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const pages = pdfDoc.getPages();

        return fields.map(field => {
            const name = field.getName();
            let label = "";
            let pageIndex = 0;
            let rect = { x: 0, y: 0, width: 0, height: 0 };

            // Find visual location of the field
            try {
                const widgets = field.acroField.getWidgets();
                if (widgets && widgets.length > 0) {
                    const widget = widgets[0];
                    const rectangle = widget.getRectangle();
                    rect = {
                        x: Math.round(rectangle.x),
                        y: Math.round(rectangle.y),
                        width: Math.round(rectangle.width),
                        height: Math.round(rectangle.height)
                    };

                    // Find which page this widget belongs to
                    const p = widget.P();
                    if (p) {
                        pageIndex = pages.findIndex(page => page.ref === p);
                    } else {
                        // Fallback: search all pages for this specific widget reference
                        for (let i = 0; i < pages.length; i++) {
                            const pageWidgets = pages[i].node.Annots();
                            if (pageWidgets) {
                                const array = pageWidgets.asArray();
                                if (array.some(ref => ref === (widget as any).ref)) {
                                    pageIndex = i;
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`[getPdfFormFields] Could not get visual location for ${name}`);
            }

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

            return { name, label: label || name, type, value, page: pageIndex + 1, rect };
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
        // Group fields by page
        const fieldsByPage = fields.reduce((acc, field) => {
            const p = field.page || 1;
            if (!acc[p]) acc[p] = [];
            acc[p].push(field);
            return acc;
        }, {} as Record<number, PdfFormField[]>);

        const pageNumbers = Object.keys(fieldsByPage).map(Number).sort((a, b) => a - b);
        console.log(`[proposePdfFieldValues] Parallelizing across ${pageNumbers.length} pages: ${pageNumbers.join(', ')}`);

        // Prepare parallel execution for each page
        const pagePromises = pageNumbers.map(async (pageNum) => {
            const pageFields = fieldsByPage[pageNum];

            const prompt = `Sei un esperto di Document Intelligence ad altissima precisione.
Il tuo obiettivo è analizzare e compilare il PDF (FILE MASTER allegato) procedendo in modo sequenziale, campo per campo, partendo dal primo ID tecnico fornito.

SCHELETRO DEI CAMPI DA COMPILARE (Con coordinate spaziali):
${pageFields.map(f => `- ID: "${f.name}", Tipo: "${f.type}", Label: "${f.label || 'N/A'}", Pagina: ${f.page}, Posizione: [x:${f.rect?.x}, y:${f.rect?.y}, w:${f.rect?.width}, h:${f.rect?.height}]`).join('\n')}

PROTOCOLLO DI ANALISI SPAZIALE (TASSATIVO):
1. **Localizzazione Visiva**: Per ogni ID (es: "f1_1[0]"), usa le coordinate fornite per trovare la sua posizione esatta nel FILE MASTER (immagine). Il PDF usa un sistema di coordinate dove (0,0) è in basso a sinistra della pagina. 
2. **Lettura Etichetta Umana**: Guarda cosa c'è scritto sopra o accanto al rettangolo alle coordinate indicate. Ignora il nome tecnico se contrasta con l'etichetta visiva che leggi sul foglio.
3. **Cross-Reference & Reasoning**: Cerca nelle FONTI il dato corrispondente all'etichetta letta. Formula un breve pensiero (reasoning) che spieghi perché hai scelto quel valore (es: "Rilevata label '1a Name' alle coordinate x,y; inserito valore da fattura Y").
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
      "reasoning": "Rilevato nome società nella pagina ${pageNum} del master."
    }
  ]
}
`;

            const parts: any[] = [{ text: prompt }];

            // Add Master PDF (Multimodal context)
            parts.push({
                inlineData: {
                    mimeType: masterFile.mimeType,
                    data: masterFile.base64
                }
            });

            // Add Source Files
            for (const source of sourceFiles) {
                parts.push({
                    inlineData: {
                        mimeType: source.mimeType,
                        data: source.base64
                    }
                });
            }

            const result = await geminiModel.generateContent({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1, // Minimal randomness for maximum precision
                }
            });

            const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!responseText) {
                console.warn(`[proposePdfFieldValues] No response for page ${pageNum}`);
                return [];
            }

            try {
                const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return parsed.proposals || [];
            } catch (err) {
                console.error(`[proposePdfFieldValues] JSON parse error for page ${pageNum}:`, err);
                return [];
            }
        });

        // Resolve all pages in parallel
        const allProposals = await Promise.all(pagePromises);

        // Flatten and return
        return allProposals.flat();

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
