import { VertexAI } from '@google-cloud/vertexai';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

const project = process.env.GCP_PROJECT_ID || 'compilator-479214';
const location = 'us-central1';
const vertex_ai = new VertexAI({ project: project, location: location });

// Specialized Agent for Studio Mode
export class StudioAgent {
    private model: any;

    constructor() {
        this.model = vertex_ai.getGenerativeModel({
            model: 'gemini-1.5-flash-002', // Using Flash for speed and vision
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
            }
        });
    }

    async chat(messages: any[], context: { pinnedSource?: any, currentFields?: any[] }) {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";

        // Construct context string
        const sourceName = context.pinnedSource?.name || "Documento sconosciuto";
        const fieldsInfo = context.currentFields && context.currentFields.length > 0
            ? `CAMPI RILEVATI (${context.currentFields.length}):\n${context.currentFields.map(f => `- ${f.name} (valore: "${f.value || ''}")`).join('\n')}`
            : "Nessun campo rilevato finora.";

        console.log(`[StudioAgent] Processing request for ${sourceName}`);

        const systemPrompt = `
      Sei l'Agente Studio di Gromit. Hai il controllo COMPLETO della sidebar di Document Studio.
      L'utente ti sta parlando per completare un documento PDF o immagine: "${sourceName}".
      
      ${fieldsInfo}
      
      OBIETTIVO:
      - Sii estremamente preciso (pixel-perfect).
      - Se l'utente chiede di 'compilare', identifica i campi dai 'CAMPI RILEVATI' e riempili usando i dati che hai o inventando dati verosimili se richiesto.
      - Se l'utente segnala errori visivi, ammetti l'errore e proponi una correzione.
      - Usa sempre un tono professionale e rassicurante.

      OUTPUT FORMAT (JSON):
      {
        "text": "Risposta testuale all'utente",
        "steps": [
          { "id": "task_id", "label": "Titolo Task", "status": "completed" | "running" | "pending" | "error", "description": "Dettaglio" }
        ],
        "action": { "type": "fill_fields" | "adjust_coordinates", "data": { "NomeCampo": "Valore", ... } }
      }
    `;

        try {
            const chatSession = this.model.startChat({
                history: [
                    { role: 'user', parts: [{ text: systemPrompt }] },
                    { role: 'model', parts: [{ text: "Ricevuto. Ho analizzato la struttura del documento e sono pronto." }] }
                ],
            });

            const result = await chatSession.sendMessage(lastUserMessage);
            const responseText = result.response.candidates[0].content.parts[0].text;

            // Clean JSON if model included markdown blocks
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {
                text: responseText,
                steps: [
                    { id: 'plan', label: 'Analisi', status: 'completed', description: 'Richiesta elaborata.' }
                ]
            };
        } catch (error: any) {
            console.error('[StudioAgent] Execution error:', error);
            return {
                text: "Mi dispiace, ho incontrato un problema tecnico nell'elaborazione della tua richiesta.",
                steps: [{ id: 'error', label: 'Errore', status: 'error', description: error.message }]
            };
        }
    }

    // Logic for visual verification (Screenshot of a field area)
    async captureFieldArea(pdfBase64: string, field: any) {
        // This would use a library to render the PDF page to a canvas/image 
        // and crop the area around the field.
        // For now, return a placeholder or implement using a helper if available.
        console.log(`[StudioAgent] Capturing field area for: ${field.name}`);
        return null;
    }
}

export const studioAgent = new StudioAgent();
