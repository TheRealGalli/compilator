import type { Express, Request, Response } from "express";
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { uploadFile, downloadFile, deleteFile, fileExists } from "./gcp-storage";
import { getModelApiKey } from "./gcp-secrets";
import OpenAI from "openai";

// Configurazione CORS per permettere richieste dal frontend su GitHub Pages
const FRONTEND_URL = process.env.FRONTEND_URL || "https://*.github.io";

// Configurazione multer per gestire upload di file in memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurazione CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (FRONTEND_URL.includes('*') || origin.includes('github.io'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Upload file endpoint
  app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file fornito' });
      }

      const result = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      res.json({
        success: true,
        file: result,
      });
    } catch (error: any) {
      console.error('Errore durante upload file:', error);
      res.status(500).json({ error: error.message || 'Errore durante upload file' });
    }
  });

  // Download file endpoint
  app.get('/api/files/:gcsPath(*)', async (req: Request, res: Response) => {
    try {
      const { gcsPath } = req.params;

      if (!await fileExists(gcsPath)) {
        return res.status(404).json({ error: 'File non trovato' });
      }

      const buffer = await downloadFile(gcsPath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
    } catch (error: any) {
      console.error('Errore durante download file:', error);
      res.status(500).json({ error: error.message || 'Errore durante download file' });
    }
  });

  // Delete file endpoint
  app.delete('/api/files/:gcsPath(*)', async (req: Request, res: Response) => {
    try {
      const { gcsPath } = req.params;
      await deleteFile(gcsPath);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Errore durante eliminazione file:', error);
      res.status(500).json({ error: error.message || 'Errore durante eliminazione file' });
    }
  });

  // Endpoint per compilare documenti con AI
  app.post('/api/compile', async (req: Request, res: Response) => {
    try {
      const { template, notes, temperature, formalTone, modelProvider = 'openai' } = req.body;

      if (!template) {
        return res.status(400).json({ error: 'Template richiesto' });
      }

      // Recupera la chiave API dal Secret Manager
      const apiKey = await getModelApiKey(modelProvider);

      // Inizializza il client OpenAI
      const openai = new OpenAI({ apiKey });

      // Prepara il prompt
      const prompt = `Compila il seguente template sostituendo i placeholder con informazioni basate sulle note fornite.

Template:
${template}

${notes ? `Note e contesto:\n${notes}` : ''}

Istruzioni:
- Sostituisci tutti i placeholder tra parentesi quadre (es. [AZIENDA], [EMAIL]) con informazioni appropriate
- Mantieni la struttura e il formato del template
- Usa un tono ${req.body.formalTone ? 'formale' : 'informale'}
- Fornisci contenuti dettagliati e professionali`;

      let compiledContent = '';
      if (modelProvider === 'gemini') {
        // Use Vercel AI SDK with Google provider
        // Set the API key in env (Vercel AI SDK reads from GOOGLE_GENERATIVE_AI_API_KEY)
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

        const systemPrompt = 'Sei un assistente AI esperto nella compilazione di documenti legali e commerciali.';
        const userPrompt = `Compila il seguente template sostituendo i placeholder con informazioni basate sulle note fornite.\n\nTemplate:\n${template}\n\n${notes ? `Note e contesto:\n${notes}` : ''}\n\nIstruzioni:\n- Sostituisci tutti i placeholder tra parentesi quadre (es. [AZIENDA], [EMAIL]) con informazioni appropriate\n- Mantieni la struttura e il formato del template\n- Usa un tono ${formalTone ? 'formale' : 'informale'}\n- Fornisci contenuti dettagliati e professionali`;

        const result = await generateText({
          model: google('gemini-2.5-flash'),
          system: systemPrompt,
          prompt: userPrompt,
          temperature: temperature || 0.7,
        });

        compiledContent = result.text;
      } else {
        // Fallback to OpenAI
        const openai = new OpenAI({ apiKey });
        const prompt = `Compila il seguente template sostituendo i placeholder con informazioni basate sulle note fornite.\n\nTemplate:\n${template}\n\n${notes ? `Note e contesto:\n${notes}` : ''}\n\nIstruzioni:\n- Sostituisci tutti i placeholder tra parentesi quadre (es. [AZIENDA], [EMAIL]) con informazioni appropriate\n- Mantieni la struttura e il formato del template\n- Usa un tono ${formalTone ? 'formale' : 'informale'}\n- Fornisci contenuti dettagliati e professionali`;
        const completion = await openai.chat.completions.create({
          model: req.body.model || 'gpt-4',
          messages: [
            { role: 'system', content: 'Sei un assistente AI esperto nella compilazione di documenti legali e commerciali.' },
            { role: 'user', content: prompt },
          ],
          temperature: temperature || 0.7,
        });
        compiledContent = completion.choices[0]?.message?.content || '';
      }

      res.json({
        success: true,
        compiledContent,
      });
    } catch (error: any) {
      console.error('Errore durante compilazione:', error);
      res.status(500).json({
        error: error.message || 'Errore durante compilazione documento',
      });
    }
  });

  // Endpoint per chat con AI
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { messages, modelProvider = 'openai' } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messaggi richiesti' });
      }

      // Recupera la chiave API dal Secret Manager
      const apiKey = await getModelApiKey(modelProvider);

      let responseContent = '';
      if (modelProvider === 'gemini') {
        // Use Vercel AI SDK with Google provider
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

        // Convert messages to the format expected by generateText
        const systemMessage = 'Sei un assistente AI di ricerca. Aiuti gli utenti ad analizzare documenti e rispondere a domande.';
        const conversationHistory = messages.map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');

        const result = await generateText({
          model: google('gemini-2.5-flash'),
          system: systemMessage,
          prompt: conversationHistory,
          temperature: req.body.temperature || 0.7,
        });

        responseContent = result.text;
      } else {
        // Fallback to OpenAI
        const openai = new OpenAI({ apiKey });

        // Chiama l'API di OpenAI
        const completion = await openai.chat.completions.create({
          model: req.body.model || 'gpt-4',
          messages: messages.map((msg: any) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: req.body.temperature || 0.7,
        });
        responseContent = completion.choices[0]?.message?.content || '';
      }

      res.json({
        success: true,
        message: {
          role: 'assistant',
          content: responseContent,
        },
      });
    } catch (error: any) {
      console.error('Errore durante chat:', error);
      res.status(500).json({
        error: error.message || 'Errore durante chat',
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
