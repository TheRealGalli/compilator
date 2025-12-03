import type { Express, Request, Response } from "express";
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

const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'notebooklm-compiler-files';

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

      // Use Google Generative AI SDK directly
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const systemPrompt = 'Sei un assistente AI esperto nella compilazione di documenti legali e commerciali.';
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemPrompt
      });

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

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: temperature || 0.7,
        }
      });

      const response = await result.response;
      const text = response.text();

      res.json({
        success: true,
        compiledContent: text,
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
      const { temperature } = req.body;
      let { messages, sources } = req.body; // sources: array of {name, type, size, url: GCS URL}

      // Parse messages if string (multipart/form-data)
      if (typeof messages === 'string') {
        try {
          messages = JSON.parse(messages);
        } catch (e) {
          console.error('[ERROR] Failed to parse messages JSON:', e);
          messages = [];
        }
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messaggi richiesti' });
      }

      // Recupera la chiave API dal Secret Manager
      const apiKey = await getModelApiKey('gemini');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      console.log(`[DEBUG] Received ${sources?.length || 0} sources`);
      console.log(`[DEBUG] Messages type: ${typeof messages}, isArray: ${Array.isArray(messages)}`);
      console.log(`[DEBUG] Sources type:`, typeof sources);
      console.log(`[DEBUG] Sources is array:`, Array.isArray(sources));

      if (sources && sources.length > 0) {
        console.log('[DEBUG] Sources:', sources.map((s: any) => ({ name: s.name, type: s.type, url: s.url?.substring(0, 100) })));
      }

      // Download and process files
      let filesContext = '';
      const multimodalFiles: any[] = [];

      if (sources && Array.isArray(sources)) {
        console.log(`[DEBUG] Processing ${sources.length} sources`);

        for (const source of sources) {
          try {
            let buffer: Buffer;
            let base64: string;

            // Check if we have direct base64 content (Client-side RAG)
            if (source.base64) {
              console.log(`[DEBUG] Using client-side base64 for ${source.name}`);
              base64 = source.base64;
            }
            // Fallback to GCS download (Legacy/Compiler)
            else if (source.url) {
              console.log(`[DEBUG] Downloading from GCS: ${source.url}`);
              // Extract path from URL
              // URL format: https://storage.googleapis.com/BUCKET_NAME/path/to/file
              const urlParts = source.url.split(`/${BUCKET_NAME}/`);
              if (urlParts.length < 2) {
                console.error(`Invalid GCS URL format: ${source.url}`);
                continue;
              }

              // Remove any query parameters if present
              const gcsPath = urlParts[1].split('?')[0];
              console.log(`[DEBUG] Extracted GCS path: ${gcsPath}`);

              buffer = await downloadFile(gcsPath);
              base64 = buffer.toString('base64');
            } else {
              console.warn(`[WARN] Source ${source.name} has no base64 or url`);
              continue;
            }

            const isImage = source.type.startsWith('image/');

            if (isImage) {
              multimodalFiles.push({
                type: 'image',
                image: base64,
                mimeType: source.type,
              });
            } else {
              multimodalFiles.push({
                type: 'file',
                data: base64,
                mimeType: source.type,
              });
            }

            console.log(`[DEBUG] Added ${source.name} as ${isImage ? 'image' : 'file'} attachment`);
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

      try {
        // 1. Sanitize inputs to ensure they are safe for the SDK
        const sanitizedMessages = messages
          .filter((msg: any) => msg.role !== 'system') // Remove system messages (passed separately)
          .map((msg: any) => {
            // Ensure role is valid
            const role = (msg.role === 'data' ? 'user' : msg.role) || 'user';

            // Ensure content is never undefined/null
            let content = msg.content;
            if (content === undefined || content === null) {
              content = '';
            }

            // If content is array, sanitize parts
            if (Array.isArray(content)) {
              content = content.map((part: any) => {
                if (part.type === 'text') {
                  return { type: 'text', text: String(part.text || '') };
                }
                // Keep other parts if they look valid, otherwise fallback to text
                if (part.type === 'image' || part.type === 'file') {
                  return part;
                }
                return { type: 'text', text: '' };
              });
            } else {
              // Ensure string content
              content = String(content);
            }

            return {
              role,
              content,
            };
          });

        // 2. Use sanitized messages directly as CoreMessages
        // We manually ensured they are strictly { role, content }
        coreMessages = sanitizedMessages;

      } catch (err) {
        console.error('[ERROR] Message conversion failed:', err);
        // Fallback: try to construct a minimal valid user message to avoid 500
        coreMessages = [{ role: 'user', content: 'Error processing previous messages.' }];
      }

      // If we have multimodal files, attach them to the last user message
      if (multimodalFiles.length > 0 && coreMessages.length > 0) {
        const lastMessageIndex = coreMessages.length - 1;
        const lastMessage = coreMessages[lastMessageIndex];

        if (lastMessage.role === 'user') {
          // Ensure content is an array of parts
          let currentContent: any[] = [];

          if (typeof lastMessage.content === 'string') {
            currentContent = [{ type: 'text', text: lastMessage.content }];
          } else if (Array.isArray(lastMessage.content)) {
            currentContent = lastMessage.content;
          } else {
            currentContent = [{ type: 'text', text: '' }];
          }

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
      // Log the EXACT payload we are sending to generateText
      try {
        console.log('[DEBUG] Final coreMessages payload:', JSON.stringify(coreMessages, null, 2));
      } catch (e) {
        console.log('[DEBUG] Could not stringify coreMessages');
      }

      if (coreMessages.length === 0) {
        return res.status(400).json({ error: 'No valid messages found' });
      }

      // 3. Use Google Cloud Vertex AI SDK (Native GCP)
      // This uses ADC (Application Default Credentials) automatically on Cloud Run
      const { VertexAI } = await import("@google-cloud/vertexai");

      const project = process.env.GCP_PROJECT_ID;
      const location = 'europe-west1'; // Reverted to europe-west1 as requested

      let authOptions = undefined;
      if (process.env.GCP_CREDENTIALS) {
        try {
          const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
          authOptions = { credentials };
          console.log('[DEBUG] Using explicit GCP_CREDENTIALS from env');
        } catch (e) {
          console.error('[ERROR] Failed to parse GCP_CREDENTIALS:', e);
        }
      }

      const vertex_ai = new VertexAI({
        project: project,
        location: location,
        googleAuthOptions: authOptions
      });
      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash", // Latest stable Flash model
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstruction }]
        }
      });

      // Map CoreMessages to Vertex AI format
      // Vertex AI expects 'role' to be 'user' or 'model'
      // Content parts are similar but strict on types
      const googleHistory = coreMessages.map(msg => {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        let parts: any[] = [];

        if (typeof msg.content === 'string') {
          parts = [{ text: msg.content }];
        } else if (Array.isArray(msg.content)) {
          parts = msg.content.map((part: any) => {
            if (part.type === 'text') {
              return { text: part.text };
            }
            if (part.type === 'image') {
              return { inlineData: { mimeType: part.mimeType || 'image/jpeg', data: part.image } };
            }
            if (part.type === 'file') {
              return { inlineData: { mimeType: part.mimeType, data: part.data } };
            }
            return { text: '' };
          });
        }

        return { role, parts };
      });

      console.log('[DEBUG] Sending request to Vertex AI (europe-west1) with gemini-2.5-flash');

      const result = await model.generateContent({
        contents: googleHistory,
        generationConfig: {
          temperature: req.body.temperature || 0.7,
        }
      });

      const response = result.response;
      // Vertex AI response structure: response.candidates[0].content.parts[0].text
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Return JSON response
      res.json({
        success: true,
        message: {
          content: text,
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
