import type { Express, Request, Response } from "express";
import { google } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { uploadFile, downloadFile, deleteFile, fileExists, uploadFileToPath, listFiles, saveDocumentChunks, loadMultipleDocumentChunks } from "./gcp-storage";
import { getModelApiKey } from "./gcp-secrets";
import mammoth from 'mammoth';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { chunkText, type ChunkedDocument, selectRelevantChunks, formatContextWithCitations, type DocumentChunk } from './rag-utils';

// Configurazione CORS per permettere richieste dal frontend su GitHub Pages
const FRONTEND_URL = process.env.FRONTEND_URL || "https://*.github.io";

// Configurazione multer per gestire upload di file in memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === 'application/pdf') {
      const data = await pdf(buffer);
      return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    }
    return '';
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

async function getDocumentsContext(selectedDocuments: string[]): Promise<string> {
  if (!selectedDocuments || selectedDocuments.length === 0) {
    return '';
  }

  let context = '\n\nDOCUMENTI DI CONTESTO:\n';

  for (const docPath of selectedDocuments) {
    try {
      const sidecarPath = `${docPath}.txt`;
      if (await fileExists(sidecarPath)) {
        const buffer = await downloadFile(sidecarPath);
        const text = buffer.toString('utf-8');
        context += `\n--- INIZIO DOCUMENTO: ${docPath} ---\n${text}\n--- FINE DOCUMENTO ---\n`;
      }
    } catch (error) {
      console.error(`Errore recupero contesto per ${docPath}:`, error);
    }
  }

  return context;
}

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

  // List documents endpoint
  app.get('/api/documents', async (_req: Request, res: Response) => {
    try {
      const files = await listFiles();
      // Filter out sidecar .txt files
      const documents = files.filter(f => !f.name.endsWith('.txt'));
      res.json(documents);
    } catch (error: any) {
      console.error('Errore durante recupero documenti:', error);
      res.status(500).json({ error: error.message || 'Errore durante recupero documenti' });
    }
  });

  // Upload file endpoint
  app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file fornito' });
      }

      // 1. Upload original file
      const result = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      // 2. Extract text
      const textContent = await extractText(req.file.buffer, req.file.mimetype);

      // 3. Upload extracted text as sidecar if text was extracted
      if (textContent) {
        const sidecarPath = `${result.gcsPath}.txt`;
        const textBuffer = Buffer.from(textContent, 'utf-8');

        await uploadFileToPath(
          textBuffer,
          sidecarPath,
          'text/plain'
        );

        console.log(`Text extracted and saved to ${sidecarPath}`);

        // 4. Create and save document chunks
        try {
          const chunks = chunkText(
            textContent,
            req.file.originalname,
            result.gcsPath,
            1000 // max tokens per chunk
          );

          const chunkedDocument: ChunkedDocument = {
            documentName: req.file.originalname,
            documentPath: result.gcsPath,
            chunks,
            createdAt: new Date().toISOString(),
          };

          await saveDocumentChunks(result.gcsPath, chunkedDocument);
          console.log(`Created ${chunks.length} chunks for ${req.file.originalname}`);
        } catch (chunkError) {
          console.error('Error creating chunks:', chunkError);
          // Don't fail the upload if chunking fails
        }
      }

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
      const { template, notes, temperature, formalTone, selectedDocuments } = req.body;

      if (!template) {
        return res.status(400).json({ error: 'Template richiesto' });
      }

      // Recupera contesto dai documenti selezionati
      const documentsContext = await getDocumentsContext(selectedDocuments);

      // Recupera la chiave API dal Secret Manager (default gemini)
      const apiKey = await getModelApiKey('gemini');

      // Use Vercel AI SDK with Google provider
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      const systemPrompt = 'Sei un assistente AI esperto nella compilazione di documenti legali e commerciali.';
      const userPrompt = `Compila il seguente template sostituendo i placeholder con informazioni basate sulle note fornite e sui documenti di contesto.

Template:
${template}

${notes ? `Note:\n${notes}` : ''}

${documentsContext}

Istruzioni:
- Sostituisci tutti i placeholder tra parentesi quadre (es. [AZIENDA], [EMAIL]) con informazioni appropriate
- Usa le informazioni dai documenti di contesto se disponibili
- Mantieni la struttura e il formato del template
- Usa un tono ${formalTone ? 'formale' : 'informale'}
- Fornisci contenuti dettagliati e professionali`;

      const result = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: temperature || 0.7,
      });

      res.json({
        success: true,
        compiledContent: result.text,
      });
    } catch (error: any) {
      console.error('Errore durante compilazione:', error);
      res.status(500).json({
        error: error.message || 'Errore durante compilazione documento',
      });
    }
  });

  // Endpoint per chat con AI (con streaming)
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { messages, selectedDocuments, sources } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messaggi richiesti' });
      }

      // Recupera la chiave API dal Secret Manager
      const apiKey = await getModelApiKey('gemini');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      // Build system message (without context for now - sources are in-memory)
      let contextMessage = '';

      // TODO: Handle in-memory sources when implementation is complete
      // For now, just provide a basic system message

      const systemMessage = `Sei un assistente AI di ricerca. Aiuti gli utenti ad analizzare documenti e rispondere a domande.

${contextMessage}

Rispondi in modo chiaro e conciso alle domande dell'utente.`;

      // Use streamText for real-time responses
      const result = streamText({
        model: google('gemini-2.5-flash'),
        system: systemMessage,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: req.body.temperature || 0.7,
      });

      // Stream the response back
      return result.toTextStreamResponse();
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
