import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFName, PDFString, PDFHexString, rgb, StandardFonts } from 'pdf-lib';

export interface PdfFormField {
    name: string;
    label?: string; // Human readable label (e.g. "Name of Reporting Corporation")
    ref?: string;   // Native PDF Object Reference (e.g. "24")
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
            let rect: { x: number; y: number; width: number; height: number } | undefined = undefined;

            // Find visual location of the field
            try {
                const widgets = field.acroField.getWidgets();
                if (widgets && widgets.length > 0) {
                    const widget = widgets[0];
                    const rectangle = widget.getRectangle();

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

                    const page = pages[pageIndex];
                    const { width: pageW, height: pageH } = page.getSize();

                    // NORMALIZE to 0-1000 and FLIP Y-AXIS (PDF is bottom-up, Vision is top-down)
                    // Gemini Vision expects coordinates relative to top-left.
                    rect = {
                        x: Math.round((rectangle.x / pageW) * 1000),
                        y: Math.round(((pageH - (rectangle.y + rectangle.height)) / pageH) * 1000), // Top-down flip
                        width: Math.round((rectangle.width / pageW) * 1000),
                        height: Math.round((rectangle.height / pageH) * 1000)
                    };
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
            let nativeRef = "";

            // Extract Native PDF Object Reference
            try {
                // @ts-ignore - access internal acroField ref
                const ref = (field as any).acroField?.ref;
                if (ref) {
                    nativeRef = `${ref.objectNumber}`;
                }
            } catch (e) {
                console.warn(`[getPdfFormFields] Could not get native ref for ${name}`);
            }

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

            // Filter out labels that are identical to the name (technical IDs)
            const cleanLabel = (label && label !== name) ? label : undefined;

            return { name, label: cleanLabel, ref: nativeRef, type, value, page: pageIndex + 1, rect };
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

            // Create a mapping from Native ID to technical name for the final response
            const nativeToNameMap: Record<string, string> = {};
            pageFields.forEach(f => {
                if (f.ref) nativeToNameMap[`#${f.ref}`] = f.name;
            });

            console.log(`[proposePdfFieldValues] Page ${pageNum}: START processing ${pageFields.length} fields`);
            const startTime = Date.now();

            const prompt = `Sei un esperto di Document Intelligence ad altissima precisione.
Stai lavorando sulla **PAGINA ${pageNum}** di un documento PDF complesso.

ID TECNICI NATIVI (PDF-OBJ) DA COMPILARE (PAGINA ${pageNum}):
${pageFields.map(f => `- Native ID: "#${f.ref || '?'}"${f.label ? `, Label Suggerita: "${f.label}"` : ''}, Tipo: "${f.type}", Posizione Visiva [0-1000]: [top:${f.rect?.y}, left:${f.rect?.x}, width:${f.rect?.width}, height:${f.rect?.height}]`).join('\n')}

**DIFESA VISIVA (MARKER SUL DOCUMENTO)**:
Ho disegnato dei **tag rossi** con scritto il numero dell'ID (es: #24) direttamente sopra ogni campo nella versione del PDF che stai analizzando.
1. localizza il tag rosso con il numero (es: #24).
2. analizza cosa c'è scritto **SOTTO** o **ACCANTO** a quel tag nel documento originale.
3. usa quel contesto visivo per capire cosa inserire.

**GUIDA SEMANTICA ALLINEAMENTO VISIVO (TASSATIVO)**:
1. Le coordinate [0-1000] partono dall'angolo TOP-LEFT del PDF (0,0 è l'angolo in alto a sinistra).
2. I "Native ID" (es: #24) corrispondono AI TAG ROSSI disegnati sul documento.
3. **NON USARE IL NOME DELL'ID (#24, #25, etc.)** per dedurre cosa scrivere nel campo. Usa solo il contesto visivo ad esso associato.
4. Il risultato finale nel JSON deve usare lo stesso "Native ID" come chiave per mappare le risposte.

PROTOCOLLO DI ANALISI & VISUAL FIT (TASSATIVO):
1. **Analisi Spaziale**: Usa le coordinate fornite per localizzare ogni campo.
2. **Visual Fit (Dimensioni)**: Adatta la risposta allo spazio fisico (rect). Se il box è stretto (es: campo Anno), usa formati abbreviati (es: "25" invece di "2025"). Non sforare mai i bordi visivi.
3. **Checkboxes (Crocette)**: Se il tipo è "checkbox", analizza pixel-per-pixel le fonti e il master per capire se deve essere barrato. Non saltarle mai.
4. **Cross-Reference**: Estrai i dati dalle FONTI. Se un dato è incerto, non inventare; lascia vuoto.
5. **Reasoning Breve**: Spiega la scelta in max 10 parole (es: "Inserito anno abbreviato per box stretto").

6. **ANTI-LOOP PROTOCOL**: Se un campo richiede un valore che sembra causare una ripetizione infinita o se il contesto è ambiguo, lascia il valore vuoto "" e spiega nel reasoning: "Dato ambiguo, inserimento bloccato per sicurezza".

TESTO FONTI:
${sourceContext}

NOTE UTENTE:
${notes}

Restituisci ESCLUSIVAMENTE un JSON:
{
  "proposals": [
    { 
      "name": "ID_CAMPO", 
      "label": "Etichetta Visiva", 
      "value": "Valore (Adattato allo spazio)",
      "reasoning": "Breve nota logica"
    }
  ]
}
`;

            const parts: any[] = [{ text: prompt }];

            // Generate an annotated version of the Master PDF with VISUAL IDs for Gemini Vision
            let annotatedBase64 = masterFile.base64;
            try {
                annotatedBase64 = await generateAnnotatedPdf(Buffer.from(masterFile.base64, 'base64'), pageFields);
            } catch (err) {
                console.error(`[proposePdfFieldValues] Failed to generate annotated PDF for page ${pageNum}:`, err);
            }

            // Add Annotated Master PDF (Multimodal context with visual anchors)
            parts.push({
                inlineData: {
                    mimeType: masterFile.mimeType,
                    data: annotatedBase64
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

                // Mappa il Native ID ("#24") nel nome tecnico reale ("f2_1[0]") atteso dal DOM
                const sanitizedProposals = (parsed.proposals || []).map((p: any) => {
                    const technicalName = nativeToNameMap[p.name] || p.name;
                    return { ...p, name: technicalName };
                });

                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`[proposePdfFieldValues] Page ${pageNum}: END processing. Found ${sanitizedProposals.length} proposals in ${duration}s`);
                return sanitizedProposals;
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

/**
 * Generates a temporary PDF with field Object Numbers drawn directly over the fields.
 * This provides absolute visual grounding for Gemini Vision.
 */
export async function generateAnnotatedPdf(buffer: Buffer, fields: PdfFormField[]): Promise<string> {
    const pdfDoc = await PDFDocument.load(buffer);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    for (const field of fields) {
        if (!field.page || !field.rect || !field.ref) continue;
        const page = pages[field.page - 1];
        if (!page) continue;

        const { x, y, width, height } = field.rect;
        const pageW = page.getWidth();
        const pageH = page.getHeight();

        // Convert normalized [0-1000] (Top-Down) back to PDF points (Bottom-Up)
        const pdfX = (x / 1000) * pageW;
        const topEdge = (y / 1000) * pageH;
        const pdfYTop = pageH - topEdge; // This is the TOP of the field in PDF coords

        const text = `#${field.ref}`;
        const fontSize = 10;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const padding = 2;

        // Draw a bright background tag for the ID
        page.drawRectangle({
            x: pdfX,
            y: pdfYTop - (fontSize + padding * 2), // Draw just below the top edge
            width: textWidth + padding * 2,
            height: fontSize + padding * 2,
            color: rgb(1, 0, 0), // RED for high visibility
            opacity: 0.8
        });

        // Draw the ID text in white
        page.drawText(text, {
            x: pdfX + padding,
            y: pdfYTop - (fontSize + padding),
            size: fontSize,
            font: font,
            color: rgb(1, 1, 1),
        });
    }

    const modifiedBuffer = await pdfDoc.save();
    return Buffer.from(modifiedBuffer).toString('base64');
}

