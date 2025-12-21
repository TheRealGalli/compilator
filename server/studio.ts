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
            model: 'gemini-2.5-flash', // Unified model
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
            }
        });
    }

    async chat(messages: any[], context: { pinnedSource?: any, currentFields?: any[], visualCheck?: string }) {
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
        - Sii estremamente preciso(pixel - perfect).
      - Se l'utente chiede di 'compilare', identifica i campi dai 'CAMPI RILEVATI' e riempili usando i dati che hai o inventando dati verosimili se richiesto.
            - DOPO aver compilato, o se l'utente chiede "controlla il lavoro", CHIEDI una verifica visiva usando l'azione 'verify_visual'.
      - Se ricevi un'immagine nel contesto (visualCheck), ANALIZZALA. Cerca testi sovrapposti, font troppo grandi, o allineamenti errati. Se trovi errori, CORREGGI usando 'fill_fields' o 'adjust_coordinates'. Se è tutto ok, dillo all'utente.
      - Usa sempre un tono professionale e rassicurante.

      OUTPUT FORMAT(JSON):
        {
            "text": "Risposta testuale all'utente",
                "steps": [
                    { "id": "task_id", "label": "Titolo Task", "status": "completed" | "running" | "pending" | "error", "description": "Dettaglio" }
                ],
                    "action": {
                "type": "fill_fields" | "adjust_coordinates" | "verify_visual",
                    "data": {
                    "focusField": "NomeCampoOpzionale", // Per verify_visual
                        "NomeCampo": "Valore" // Per fill_fields
                }
            }
        }
        `;

        try {
            // Check for image in context
            const history: any[] = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: "Ricevuto. Ho analizzato la struttura del documento e sono pronto." }] }
            ];

            // If context has visualCheck, add it as a user message with image
            if (context.visualCheck) {
                console.log("[StudioAgent] Received visual check image");
                history.push({
                    role: 'user',
                    parts: [
                        { text: "Ecco lo screenshot attuale del documento. Analizzalo per eventuali errori di allineamento o sovrapposizione." },
                        { inlineData: { mimeType: 'image/jpeg', data: context.visualCheck } }
                    ]
                });
            }

            const chatSession = this.model.startChat({ history });

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
        console.log(`[StudioAgent] Capturing field area for: ${field.name} `);
        return null;
    }
}

export const studioAgent = new StudioAgent();
