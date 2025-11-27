import type { Express, Request, Response } from "express";
import { google } from '@ai-sdk/google';
import { generateText, streamText, convertToCoreMessages } from 'ai';
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { uploadFile, downloadFile, deleteFile, fileExists, uploadFileToPath, listFiles, saveDocumentChunks, loadMultipleDocumentChunks } from "./gcp-storage";
import { getModelApiKey } from "./gcp-secrets";
import mammoth from 'mammoth';
// pdf-parse is imported dynamically in extractText function
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
    console.log(`[DEBUG extractText] Processing ${mimeType}, buffer size: ${buffer.length}`);
    if (mimeType === 'application/pdf') {
      // Use dynamic import for pdf-parse (ESM module)
      const pdfParseModule = await import('pdf-parse');
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const data = await pdfParse(buffer);
      console.log(`[DEBUG extractText] PDF parsed, text length: ${data.text.length}, pages: ${data.numpages}`);
      return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      console.log(`[DEBUG extractText] DOCX parsed, text length: ${result.value.length}`);
      return result.value;
    } else if (mimeType === 'text/plain') {
      const text = buffer.toString('utf-8');
      console.log(`[DEBUG extractText] Text file, length: ${text.length}`);
      return text;
    }
    console.log(`[DEBUG extractText] Unsupported mime type: ${mimeType}`);
    return '';
  } catch (error) {
    console.error('[ERROR extractText] Failed:', error);
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

    // Allow GitHub Pages and local development
    const allowedOrigins = [
      'https://therealgalli.github.io',
      'http://localhost:5173',
      'http://localhost:3000',
    ];

    if (origin && allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  // Upload file endpoint - uploads to GCS with 1-hour TTL
  app.post('/api/files/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file fornito' });
      }

      // Upload to GCS with TTL for temp storage
      const result = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      console.log(`File uploaded to GCS: ${result.gcsPath}`);

      res.json({
        success: true,
        file: {
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          publicUrl: result.publicUrl,
          gcsPath: result.gcsPath,
        },
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      res.status(500).json({
        error: error.message || 'Errore durante upload file',
      });
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

  // Endpoint per chat con AI (con streaming e file support)
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { messages, sources } = req.body; // sources: array of {name, type, size, url: GCS URL}

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messaggi richiesti' });
      }

      // Recupera la chiave API dal Secret Manager
      const apiKey = await getModelApiKey('gemini');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      console.log(`[DEBUG] Received ${sources?.length || 0} sources`);
      console.log(`[DEBUG] Sources type:`, typeof sources);
      console.log(`[DEBUG] Sources is array:`, Array.isArray(sources));

      if (sources && sources.length > 0) {
        console.log('[DEBUG] Sources:', sources.map((s: any) => ({ name: s.name, type: s.type, url: s.url?.substring(0, 100) })));
      }

      // Download files from GCS and attach as multimodal content
      const multimodalFiles: any[] = [];
      let filesContext = '';

      if (sources && sources.length > 0) {
        console.log(`[DEBUG] Starting to process ${sources.length} files`);

        for (const source of sources) {
          try {
            // Extract GCS path from URL (remove query params from signed URL)
            const urlWithoutParams = source.url.split('?')[0];
            const pathParts = urlWithoutParams.split('/');
            const gcsPath = pathParts.slice(4).join('/');

            console.log(`[DEBUG] Processing file: ${source.name} (${source.type})`);
            console.log(`[DEBUG] GCS path: ${gcsPath}`);

            // Download file from GCS
            const buffer = await downloadFile(gcsPath);
            console.log(`[DEBUG] Downloaded ${buffer.length} bytes for ${source.name}`);

            // Convert to base64 and add as multimodal file
            const base64 = buffer.toString('base64');
            multimodalFiles.push({
              type: 'file' as const,
              data: base64,
              mimeType: source.type,
            });

            console.log(`[DEBUG] Added ${source.name} as multimodal attachment`);
            filesContext += `- ${source.name} (${source.type})\n`;
          } catch (error) {
            console.error(`Error processing file ${source.name}:`, error);
          }
        }
      }

      console.log(`[DEBUG] Multimodal files attached: ${multimodalFiles.length}`);

      // Build system instruction
      const systemInstruction = `Sei un assistente AI di ricerca. ${multimodalFiles.length > 0 ? `Hai accesso ai seguenti file:\n\n${filesContext}\nAnalizza attentamente i file forniti per rispondere alle domande. Cita sempre la fonte delle informazioni (nome del file).` : 'Aiuti gli utenti ad analizzare documenti.'}`;

      console.log(`[DEBUG] System instruction length: ${systemInstruction.length} characters`);

      // Build messages with multimodal files if present
      let coreMessages: any[] = [];

      // Manual strict conversion to CoreMessage format
      // We avoid convertToCoreMessages as it was crashing
      if (messages && Array.isArray(messages)) {
        coreMessages = messages.map((msg: any) => {
          // Normalize role
          let role = msg.role;
          if (role === 'data') role = 'user';
          if (!['system', 'user', 'assistant', 'tool'].includes(role)) {
            role = 'user'; // Default to user for unknown roles
          }

          // Normalize content
          let content = msg.content;
          if (typeof content !== 'string' && !Array.isArray(content)) {
            content = String(content || '');
          }

          // If content is array, ensure it has valid parts
          if (Array.isArray(content)) {
            content = content.map((part: any) => {
              if (part.type === 'text') return { type: 'text', text: part.text };
              // We can add other part types if needed, but for now text is main priority from UI
              return { type: 'text', text: JSON.stringify(part) };
            });
          }

          return { role, content };
        });
      }

      // If we have multimodal files, attach them to the last user message
      if (multimodalFiles.length > 0 && coreMessages.length > 0) {
        const lastMessageIndex = coreMessages.length - 1;
        const lastMessage = coreMessages[lastMessageIndex];

        if (lastMessage.role === 'user') {
          // Ensure content is an array of parts
          const currentContent = typeof lastMessage.content === 'string'
            ? [{ type: 'text', text: lastMessage.content }]
            : Array.isArray(lastMessage.content)
              ? lastMessage.content
              : [{ type: 'text', text: '' }];

          coreMessages[lastMessageIndex] = {
            ...lastMessage,
            content: [
              ...currentContent,
              ...multimodalFiles,
            ],
          };
          console.log(`[DEBUG] Attached ${multimodalFiles.length} multimodal files to last user message`);
        }
      }

      console.log(`[DEBUG] Core messages count: ${coreMessages.length}`);
      try {
        console.log('[DEBUG] Final coreMessages:', JSON.stringify(coreMessages, null, 2).substring(0, 1000));
      } catch (e) { console.log('[DEBUG] Could not stringify coreMessages'); }

      // Use generateText with multimodal content
      const result = await generateText({
        model: google('gemini-2.5-flash'),
        system: systemInstruction,
        messages: coreMessages,
        temperature: req.body.temperature || 0.7,
      });

      // Return JSON response
      res.json({
        success: true,
        message: {
          content: result.text,
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
