import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import compression from "compression";
import { storage } from "./storage";
import { uploadFile, downloadFile, deleteFile, fileExists, uploadFileToPath, listFiles, saveDocumentChunks, loadMultipleDocumentChunks } from "./gcp-storage";
import { getModelApiKey } from "./gcp-secrets";
import mammoth from 'mammoth';
// pdf-parse is imported dynamically in extractText function
import { chunkText, type ChunkedDocument, selectRelevantChunks, formatContextWithCitations, type DocumentChunk } from './rag-utils';

// Configurazione CORS per permettere richieste dal frontend su GitHub Pages
const FRONTEND_URL = process.env.FRONTEND_URL || "https://*.github.io";

// Max file size for multimodal processing (20MB to avoid memory issues)
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Configurazione multer per gestire upload di file in memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 20MB max (reduced from 50MB)
  },
});

const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'notebooklm-compiler-files';

// Cache VertexAI client to avoid re-initialization
let vertexAICache: { client: any; project: string; location: string } | null = null;

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
  // Enable gzip compression for all responses (reduces network bandwidth by ~70%)
  app.use(compression());

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
      const { template, notes, temperature, formalTone, detailedAnalysis, webResearch, sources } = req.body;

      if (!template) {
        return res.status(400).json({ error: 'Template richiesto' });
      }

      console.log(`[DEBUG Compile] Received sources:`, sources?.length || 0);

      // Build multimodal files from sources with base64
      const multimodalFiles: any[] = [];
      const failedFiles: string[] = [];

      if (sources && Array.isArray(sources)) {
        for (const source of sources) {
          if (source.base64) {
            // Determine MIME type from file extension
            const fileName = source.name || 'file';
            let mimeType = source.type || 'application/octet-stream';

            // Normalize MIME type based on extension if needed
            if (fileName.endsWith('.pdf')) {
              mimeType = 'application/pdf';
            } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
              mimeType = 'image/jpeg';
            } else if (fileName.endsWith('.png')) {
              mimeType = 'image/png';
            } else if (fileName.endsWith('.webp')) {
              mimeType = 'image/webp';
            } else if (fileName.endsWith('.mp3')) {
              mimeType = 'audio/mpeg';
            } else if (fileName.endsWith('.wav')) {
              mimeType = 'audio/wav';
            } else if (fileName.endsWith('.flac')) {
              mimeType = 'audio/flac';
            }

            // Reject video files
            if (mimeType.startsWith('video/')) {
              failedFiles.push(`${fileName} (video non supportato)`);
              continue;
            }

            multimodalFiles.push({
              type: mimeType.startsWith('image/') ? 'image' : 'file',
              data: source.base64,
              mimeType: mimeType,
              name: fileName
            });

            console.log(`[DEBUG Compile] Added source: ${fileName} (${mimeType})`);
          } else {
            // Source exists but no base64 data
            failedFiles.push(`${source.name || 'file'} (dati non ricevuti)`);
          }
        }
      }

      // Check if sources were expected but not received
      if (sources && sources.length > 0 && multimodalFiles.length === 0) {
        const errorMsg = failedFiles.length > 0
          ? `Errore nel caricamento dei file: ${failedFiles.join(', ')}`
          : 'Nessun file valido ricevuto. Verifica che i file siano supportati (PDF, immagini, audio).';

        console.log(`[ERROR Compile] ${errorMsg}`);
        return res.status(400).json({ error: errorMsg });
      }

      // If some files failed but others worked, log warning
      if (failedFiles.length > 0) {
        console.log(`[WARNING Compile] Some files failed: ${failedFiles.join(', ')}`);
      }

      console.log(`[DEBUG Compile] Total multimodal files: ${multimodalFiles.length}`);

      // Use Vertex AI SDK with caching
      const project = process.env.GCP_PROJECT_ID;
      const location = 'europe-west1';

      let vertex_ai: any;
      if (vertexAICache && vertexAICache.project === project && vertexAICache.location === location) {
        vertex_ai = vertexAICache.client;
      } else {
        const { VertexAI } = await import("@google-cloud/vertexai");

        let authOptions = undefined;
        if (process.env.GCP_CREDENTIALS) {
          try {
            const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
            authOptions = { credentials };
          } catch (e) {
            console.error('[ERROR Compile] Failed to parse GCP_CREDENTIALS:', e);
          }
        }

        vertex_ai = new VertexAI({
          project: project,
          location: location,
          googleAuthOptions: authOptions
        });

        vertexAICache = { client: vertex_ai, project: project!, location };
        console.log('[DEBUG] VertexAI client created and cached');
      }

      // Get current datetime in Italian format
      const now = new Date();
      const dateTimeIT = now.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const systemPrompt = `Data e ora corrente: ${dateTimeIT}

Sei un assistente AI esperto nella compilazione di documenti legali e commerciali.
${detailedAnalysis ? `
MODALITÀ ANALISI DETTAGLIATA ATTIVA:
- Fornisci risposte approfondite e complete
- Includi tutti i dettagli rilevanti trovati nei documenti
- Espandi le sezioni con informazioni contestuali
- Aggiungi clausole e specifiche tecniche dove appropriato` : ''}
${webResearch ? `
MODALITÀ WEB RESEARCH ATTIVA:
- Integra le informazioni con conoscenze aggiornate
- Aggiungi riferimenti normativi e legali pertinenti
- Includi best practices del settore
- Suggerisci miglioramenti basati su standard attuali` : ''}
${multimodalFiles.length > 0 ? `
Hai accesso a ${multimodalFiles.length} file multimodali (immagini, PDF, documenti, audio).

IMPORTANTE - ANALISI MULTIMODALE:
- Per i PDF, analizza sia il testo estraibile che le immagini/scansioni
- Usa le capacità OCR native per leggere documenti scansionati o PDF immagine
- Estrai informazioni da visure, contratti, certificati anche se scansionati
- Riconosci testo in foto di documenti, tabelle, moduli compilati
- Cerca dati strutturati: nomi, indirizzi, P.IVA, codici fiscali, importi, date

IMPORTANTE - AUDIO:
- Per i file audio (MP3, WAV, FLAC), TRASCRIVI il contenuto parlato
- Estrai tutte le informazioni rilevanti dalla trascrizione
- Se l'audio contiene dettature, istruzioni o dati, usali per compilare il template

Analizza TUTTI i file forniti per estrapolare le informazioni necessarie a compilare il template.` : ''}`;

      // Configure model without tools (tools go in generateContent)
      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        }
      });

      const userPrompt = `Compila il seguente template con informazioni coerenti e professionali.
${notes ? `\nNOTE AGGIUNTIVE: ${notes}` : ''}
${formalTone ? '\nUsa un tono formale e professionale.' : ''}

TEMPLATE DA COMPILARE:
${template}

${multimodalFiles.length > 0 ? 'IMPORTANTE: Usa i dati che estrai dai file allegati per compilare i placeholder del template. NON inventare dati, usa SOLO quelli che trovi nei documenti.' : 'Compila i placeholder con dati di esempio realistici.'}

Istruzioni:
- Sostituisci tutti i placeholder tra parentesi quadre (es. [AZIENDA], [EMAIL]) con informazioni appropriate
- Usa le informazioni dai documenti forniti (foto, visure, PDF) per completare il template
- Mantieni la struttura e il formato del template
- Usa un tono ${formalTone ? 'formale' : 'informale'}
- Fornisci contenuti dettagliati e professionali
- IMPORTANTE: Analizza attentamente tutti i file multimodali forniti`;

      // Build contents with multimodal files
      const userParts: any[] = [{ text: userPrompt }];

      // Add multimodal files as inline data
      for (const file of multimodalFiles) {
        userParts.push({
          inlineData: { mimeType: file.mimeType, data: file.data }
        });
        console.log(`[DEBUG Compile] Added to userParts: ${file.name} (${file.mimeType}), data length: ${file.data?.length || 0}`);
      }

      console.log(`[DEBUG Compile] Total userParts: ${userParts.length} (1 text + ${multimodalFiles.length} files)`);

      // Build generateContent options with optional Google Search grounding
      const generateOptions: any = {
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: {
          temperature: temperature || 0.7,
        }
      };

      // Enable Google Search grounding when webResearch is active
      if (webResearch) {
        generateOptions.tools = [{ googleSearch: {} }];
        console.log('[DEBUG Compile] Google Search grounding ENABLED in generateContent');
      }

      const result = await model.generateContent(generateOptions);

      const response = result.response;
      let text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean up output: remove prompt echo if present
      // User reported that sometimes the output includes the prompt up to "TEMPLATE DA COMPILARE:"
      if (text.includes("TEMPLATE DA COMPILARE:")) {
        console.log('[DEBUG Compile] Stripping prompt header from output');
        const parts = text.split("TEMPLATE DA COMPILARE:");
        // Take the last part which should be the actual compiled content
        text = parts[parts.length - 1].trim();
      }

      console.log(`[DEBUG Compile] Generated ${text.length} characters`);

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
      const { temperature, webResearch } = req.body;
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

            // Reject video files
            if (source.type.startsWith('video/')) {
              console.log(`[WARN] Rejected video file: ${source.name}`);
              filesContext += `- ${source.name} (video non supportato)\n`;
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
            filesContext += `- ${source.name} (errore lettura file)\n`;
          }
        }
      }

      console.log(`[DEBUG] Multimodal files attached: ${multimodalFiles.length}`);

      // Calculate max response length based on number of documents
      const getMaxChars = (docCount: number): number => {
        if (docCount === 0) return 3000;
        if (docCount === 1) return 3000;
        if (docCount <= 5) return 3500;
        return 4000; // 6-10+ documents
      };

      const maxChars = getMaxChars(multimodalFiles.length);

      // Build enhanced system instruction for high-quality responses
      const systemInstruction = multimodalFiles.length > 0
        ? `Sei un assistente AI di ricerca esperto e professionale.

**DOCUMENTI DISPONIBILI:**
${filesContext}

**LIMITE LUNGHEZZA RISPOSTA:** Massimo ${maxChars} caratteri (include spazi e punteggiatura).

**ISTRUZIONI:**
1. Analizza attentamente i documenti forniti prima di rispondere
2. Fornisci risposte concise, precise e ben strutturate
3. Usa liste puntate per organizzare le informazioni quando necessario
4. Cita sempre la fonte tra parentesi, es: (da: nome_file.pdf)
5. Se la risposta non è nei documenti, dichiaralo esplicitamente
6. Evita ripetizioni e informazioni superflue
7. Usa un tono professionale ma accessibile
8. IMPORTANTE: Rispetta sempre il limite di ${maxChars} caratteri

**FORMATO RISPOSTA:**
- Inizia con un breve riepilogo (1-2 righe)
- Sviluppa i punti chiave in modo chiaro
- Concludi solo se necessario (evita conclusioni generiche)`
        : `Sei un assistente AI di ricerca esperto. 
Fornisci risposte concise, precise e ben strutturate.
Usa liste puntate per organizzare le informazioni quando necessario.
LIMITE LUNGHEZZA: Massimo 3000 caratteri.`;
      console.log(`[DEBUG] System instruction length: ${systemInstruction.length} characters, max response: ${maxChars}`);

      // Get current datetime in Italian format for analyzer
      const nowAnalyzer = new Date();
      const dateTimeITAnalyzer = nowAnalyzer.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Prepend datetime to system instruction
      const systemInstructionWithDate = `Data e ora corrente: ${dateTimeITAnalyzer}\n\n${systemInstruction}`;

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
      // Log summary instead of full payload to avoid memory issues with large files
      console.log(`[DEBUG] Message roles: ${coreMessages.map((m: any) => m.role).join(', ')}`);

      if (coreMessages.length === 0) {
        return res.status(400).json({ error: 'No valid messages found' });
      }

      // 3. Use Google Cloud Vertex AI SDK with caching
      const project = process.env.GCP_PROJECT_ID;
      const location = 'europe-west1';

      let vertex_ai: any;
      if (vertexAICache && vertexAICache.project === project && vertexAICache.location === location) {
        vertex_ai = vertexAICache.client;
      } else {
        const { VertexAI } = await import("@google-cloud/vertexai");

        let authOptions = undefined;
        if (process.env.GCP_CREDENTIALS) {
          try {
            const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
            authOptions = { credentials };
          } catch (e) {
            console.error('[ERROR] Failed to parse GCP_CREDENTIALS:', e);
          }
        }

        vertex_ai = new VertexAI({
          project: project,
          location: location,
          googleAuthOptions: authOptions
        });

        vertexAICache = { client: vertex_ai, project: project!, location };
        console.log('[DEBUG] VertexAI client created and cached');
      }

      // Configure model
      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash", // Latest stable Flash model
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstructionWithDate }]
        }
      });

      // Map CoreMessages to Vertex AI format
      // Vertex AI expects 'role' to be 'user' or 'model'
      // Content parts are similar but strict on types
      const googleHistory = coreMessages.map((msg: any) => {
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

      console.log('[DEBUG] Sending streaming request to Vertex AI (europe-west1) with gemini-2.5-flash');

      // Build generateContent options with optional Google Search grounding
      const generateOptions: any = {
        contents: googleHistory,
        generationConfig: {
          temperature: req.body.temperature || 0.7,
        }
      };

      // Enable Google Search grounding when webResearch is active
      if (webResearch) {
        generateOptions.tools = [{ googleSearch: {} }];
        console.log('[DEBUG Chat] Google Search grounding ENABLED in generateContent');
      }

      // Use standard generation for stability
      console.log('[DEBUG Chat] Starting standard generation response');
      const result = await model.generateContent(generateOptions);
      const response = await result.response;

      // Safely extract text from candidates
      let text = '';
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          text = candidate.content.parts[0].text || '';
        }
      } else if (typeof (response as any).text === 'function') {
        text = (response as any).text();
      }

      if (!text) {
        console.warn('[WARN Chat] Empty response text from model');
        text = "Non sono riuscito a generare una risposta. Riprova.";
      }

      res.json({ text });
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
