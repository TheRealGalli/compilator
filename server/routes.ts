import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import fs from 'fs';
import path from 'path';
import multer from "multer";
import compression from "compression";
import { storage } from "./storage";
import { uploadFile, downloadFile, deleteFile, fileExists, uploadFileToPath, listFiles, saveDocumentChunks, loadMultipleDocumentChunks, configureBucketLifecycle } from "./gcp-storage";
import { getModelApiKey } from "./gcp-secrets";
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
// pdf-parse is imported dynamically in extractText function
import { chunkText, type ChunkedDocument, selectRelevantChunks, formatContextWithCitations, type DocumentChunk } from './rag-utils';
import { google } from 'googleapis';
import crypto from 'crypto';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { getSecret } from './gcp-secrets';
import { Document as DocxDocument, Packer, Paragraph, TextRun, AlignmentType } from "docx";


// [pdfjs-dist removed - using client-side extraction instead]
import { AiService } from './ai'; // Import new AI Service
import type { FormField } from './form-compiler';
import { generatePDF, generateDOCX, generateMD, generateJSONL } from './tools/fileGenerator'; // Import Generators
import {
  updateDriveFile,
  downloadDriveFile,
  createDriveFile,
  updateSheetCellRange,
  getSheetMetadata,
  updateSheetMetadata
} from './tools/driveTools'; // Import Drive Tools for Write Access

// Initialize AI Service
const aiService = new AiService(process.env.GCP_PROJECT_ID || 'compilator-479214');

// Initialize GCS Bucket Lifecycle (Auto-delete files after 30 days)
configureBucketLifecycle().catch(err => console.error('[GCS] Failed to configure lifecycle:', err));

// Configurazione CORS per permettere richieste dal frontend su GitHub Pages
const FRONTEND_URL = process.env.FRONTEND_URL || "https://*.github.io";

// Max file size for multimodal processing (20MB to avoid memory issues)
const MAX_FILE_SIZE_MB = 250;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Cache for Document AI layout results (Key: base64 hash, Value: discovered fields)
// [Removed legacy layout cache]

// --- TUNED MODEL CONFIGURATION (ANALYZER ONLY) ---
const ANALYZER_LOCATION = 'europe-west1';
// Use full resource name for Tuned Models
const ANALYZER_MODEL_ID = 'gemini-2.5-flash';
// const ANALYZER_MODEL_ID = 'gemini-2.5-flash'; // TEST: Base model to verify europe-west8 connectivity
// -------------------------------------------------

// Configurazione multer per gestire upload di file in memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 20MB max (reduced from 50MB)
  },
});

const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'notebooklm-compiler-files';

/**
 * Helper to generate a professional DOCX from text
 */
async function generateProfessionalDocxBase64(content: string): Promise<string> {
  const lines = content.split('\n');
  const children = lines.map(line => {
    const text = line.trim();
    if (!text) return new Paragraph({ text: "" });

    // Simple markdown-style bold detection
    const parts = text.split(/(\*\*.*?\*\*)/g);
    const textRuns = parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({ text: part.replace(/\*\*/g, ''), bold: true, size: 24 });
      }
      return new TextRun({ text: part, size: 24 });
    });

    return new Paragraph({
      children: textRuns,
      spacing: { after: 120 }
    });
  });

  const doc = new DocxDocument({
    sections: [{
      properties: {},
      children: children
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer.toString('base64');
}

// [Removed legacy analyzePdfLayout function - replaced by AiService]

// NEW: Extract form fields from PDF with exact coordinates using pdf-lib


// [pdfjs-dist functions REMOVED - extraction is now client-side in DocumentStudio.tsx]

// NEW: Gemini-powered Layout Analysis
// [Removed legacy analyzeLayoutWithGemini function - replaced by AiService]

/**
 * Helper to overlay text on a PDF at specific coordinates
 * coordinateBox is expected to be [ymin, xmin, ymax, xmax] in 0-1000 scale (Gemini output)
 * OR precise coordinates if coming from Document AI
 */


/**
 * Helper to fill DOCX using smart template replacement
 */


// Cache VertexAI client to avoid re-initialization
let vertexAICache: { client: any; project: string; location: string } | null = null;

// Helper function to fetch and extract text from a URL
// Helper function to fetch and extract text from a URL
async function fetchUrlContent(url: string, retryCount = 0): Promise<string | null> {
  try {
    console.log(`[DEBUG Fetcher] Fetching URL: ${url} (Attempt ${retryCount + 1})`);

    // Robust headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn(`[DEBUG Fetcher] Failed to fetch ${url}: ${response.status} ${response.statusText}`);

      // GITHUB SPECIFIC FALLBACK
      // If we get 403/429/503 from GitHub, try the API
      if (url.includes('github.com') && !url.includes('api.github.com')) {
        console.log('[DEBUG Fetcher] Attempting GitHub API Fallback...');
        const gitHubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
        const match = url.match(gitHubRegex);
        if (match) {
          const [_, owner, repo] = match;
          // Fallback to fetching README from API
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
          console.log(`[DEBUG Fetcher] Fallback API URL: ${apiUrl}`);

          try {
            const apiRes = await fetch(apiUrl, {
              headers: {
                'Accept': 'application/vnd.github.raw', // Request raw content
                'User-Agent': 'NotebookLMCompiler-Bot'
              }
            });

            if (apiRes.ok) {
              const rawContent = await apiRes.text();
              console.log(`[DEBUG Fetcher] GitHub API Fallback SUCCESS. Length: ${rawContent.length}`);
              return `[GITHUB CONTENT FROM API]\n${rawContent.substring(0, 20000)}`;
            } else {
              console.warn(`[DEBUG Fetcher] GitHub API also failed: ${apiRes.status}`);
            }
          } catch (apiErr) {
            console.error('[DEBUG Fetcher] GitHub API error:', apiErr);
          }
        }
      }

      // Retry logic for generic errors (5xx)
      if (retryCount < 2 && response.status >= 500) {
        console.log(`[DEBUG Fetcher] Retrying ${url} in 1000ms...`);
        await new Promise(r => setTimeout(r, 1000));
        return fetchUrlContent(url, retryCount + 1);
      }

      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, and other noise
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('iframe').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove(); // Often contains site nav, not content

    // Extract text from body
    // Get text from important tags directly to maintain some structure
    let content = '';

    // Try to find main content usually in article, main, or specific divs
    const mainContent = $('article, main, #content, .content, .markdown-body, .readme').text();

    if (mainContent && mainContent.length > 500) {
      content = mainContent;
    } else {
      // Fallback to body text if no main container found
      content = $('body').text();
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();

    // Limit content length to avoid token limits (Gemini 1.5 Flash has 1M context, so 50k chars is fine)
    return content.substring(0, 50000);
  } catch (error) {
    console.error(`[DEBUG Fetcher] Error fetching ${url}:`, error);
    if (retryCount < 2) {
      console.log(`[DEBUG Fetcher] Retrying ${url} in 1000ms...`);
      await new Promise(r => setTimeout(r, 1000));
      return fetchUrlContent(url, retryCount + 1);
    }
    return null;
  }
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    console.log(`[DEBUG extractText] Processing ${mimeType}, buffer size: ${buffer.length}`);
    if (mimeType === 'application/pdf') {
      // Use dynamic import for pdf-parse (ESM module)
      const pdfParseModule = await import('pdf-parse');
      // Fix for "pdfParse is not a function" - handle both default and direct export
      const pdfParse = (pdfParseModule as any).default ? (pdfParseModule as any).default : pdfParseModule;

      console.log('[DEBUG extractText] Calling pdfParse...');
      const data = await pdfParse(buffer);
      console.log(`[DEBUG extractText] PDF parsed, text length: ${data.text.length}, pages: ${data.numpages}`);
      return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      console.log(`[DEBUG extractText] DOCX parsed, text length: ${result.value.length}`);
      return result.value;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
      // XLSX Support via SheetJS (xlsx)
      console.log(`[DEBUG extractText] Processing XLSX file...`);
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      let fullText = '';
      const MAX_CELLS_PER_SHEET = 10000; // Safety limit for 512MB RAM environment

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rangeStr = sheet['!ref'];

        if (rangeStr) {
          const range = xlsx.utils.decode_range(rangeStr);
          const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);

          let sheetContent = "";
          let cellsProcessed = 0;
          let limitReached = false;

          // If too huge, just take the first 5000 rows to avoid infinite loop overhead in extreme cases
          const safetyMaxRows = 5000;
          const endRow = range.e.r > (range.s.r + safetyMaxRows) ? (range.s.r + safetyMaxRows) : range.e.r;

          for (let R = range.s.r; R <= endRow; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cell_address = xlsx.utils.encode_cell({ r: R, c: C });
              const cell = sheet[cell_address];

              // Smart Filter: Only consider cells with actual content (Value or Formula)
              if (cell && (cell.v !== undefined || cell.f)) {
                if (cellsProcessed >= MAX_CELLS_PER_SHEET) {
                  limitReached = true;
                  break;
                }

                let cellText = `[${cell_address}] ${cell.v !== undefined ? cell.v : ''}`;
                if (cell.f) cellText += ` {Formula: =${cell.f}}`;
                sheetContent += `${cellText} | `;

                cellsProcessed++;
              }
            }
            sheetContent += "\n"; // Add newline after row even if empty, preserving structure
            if (limitReached) break;
          }

          fullText += `[FOGLIO DI CALCOLO: ${sheetName}]\n${sheetContent}\n`;
          if (limitReached) {
            fullText += `\n[ATTENZIONE: Foglio troncato. Visualizzate prime ${MAX_CELLS_PER_SHEET} celle PIENE (non vuote). Usa 'get_sheet_metadata' per vedere la struttura completa.]\n\n`;
          } else if (range.e.r > endRow) {
            fullText += `\n[ATTENZIONE: Foglio troncato per sicurezza (Max ${safetyMaxRows} righe scansionate).]\n\n`;
          } else {
            fullText += "\n\n";
          }
        } else {
          fullText += `[FOGLIO DI CALCOLO: ${sheetName}]\n(Foglio Vuoto)\n\n`;
        }
      });
      console.log(`[DEBUG extractText] XLSX parsed, sheets: ${workbook.SheetNames.length}`);
      return fullText;
    } else if (
      mimeType === 'text/plain' ||
      mimeType === 'text/csv' ||
      mimeType === 'text/tab-separated-values' ||
      mimeType === 'text/markdown' ||
      mimeType === 'text/rtf' ||
      mimeType === 'application/rtf' ||
      mimeType === 'application/json' ||
      mimeType === 'application/ld+json' ||
      mimeType === 'application/x-jsonlines' ||
      mimeType === '' || // Handle missing mimeType
      !mimeType // Handle null/undefined
    ) {
      const text = buffer.toString('utf-8');
      console.log(`[DEBUG extractText] Text-based file (${mimeType || 'unknown'}), length: ${text.length}`);
      return text;
    }
    console.log(`[DEBUG extractText] Unsupported mime type: ${mimeType}`);
    // Attempt fallback for unknown types that might be text
    if (!mimeType || mimeType === 'application/octet-stream') {
      try {
        const text = buffer.toString('utf-8');
        // Simple heuristic: if it has no null bytes in the first 1000 chars, treat as text
        if (!text.substring(0, 1000).includes('\0')) {
          console.log(`[DEBUG extractText] Fallback: Treating unknown mimeType as text. Length: ${text.length}`);
          return text;
        }
      } catch (e) {
        // ignore
      }
    }

    return '[ERRORE SISTEMA: Formato file non supportato o tipo MIME errato]';
  } catch (error) {
    console.error('[ERROR extractText] Failed:', error);
    return `[ERRORE SISTEMA: Impossibile estrarre testo dal file. Dettagli: ${error instanceof Error ? error.message : String(error)}]`;
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

// Google OAuth2 Config - placeholder to be initialized dynamically
let oauth2Client: any = null;

async function getOAuth2Client() {
  if (oauth2Client) return oauth2Client;

  // Rimuove spazi, virgolette, barre verticali e residui di URL encoding
  const cleanKey = (key: string | undefined) => key?.replace(/[\s"'|]|%20/g, '');

  let clientId = cleanKey(process.env.GOOGLE_CLIENT_ID);
  let clientSecret = cleanKey(process.env.GOOGLE_CLIENT_SECRET);
  let source = 'environment variables';

  if (process.env.NODE_ENV === 'production' && (!clientId || !clientSecret)) {
    console.log('[OAuth] Missing credentials in environment, attempting Secret Manager fallback...');
    try {
      if (!clientId) {
        const secret = await getSecret('GOOGLE_CLIENT_ID');
        clientId = cleanKey(secret);
        if (clientId) source = 'Secret Manager';
      }
      if (!clientSecret) {
        const secret = await getSecret('GOOGLE_CLIENT_SECRET');
        clientSecret = cleanKey(secret);
        if (clientSecret) source = 'Secret Manager';
      }
    } catch (e: any) {
      console.error('[OAuth] Secret Manager retrieval failed:', e.message);
    }
  }

  if (clientId) {
    const maskedId = `${clientId.substring(0, 10)}...${clientId.substring(clientId.length - 10)}`;
    console.log(`[OAuth] Client ID from ${source}: ${maskedId} (Length: ${clientId.length})`);
  } else {
    console.warn('[OAuth] Client ID is MISSING');
  }

  if (clientSecret) {
    const maskedSecret = `${clientSecret.substring(0, 5)}... (Total Length: ${clientSecret.length})`;
    console.log(`[OAuth] Client Secret from ${source}: ${maskedSecret}`);
  } else {
    console.warn('[OAuth] Client Secret is MISSING');
  }

  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://compilator-983823068962.europe-west1.run.app/api/auth/google/callback'
    : 'http://localhost:5001/api/auth/google/callback';

  console.log(`[OAuth] Configured with Redirect URI: ${redirectUri}`);

  oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  return oauth2Client;
}

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
];

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to get tokens from session or header
  const getGoogleTokens = (req: Request) => {
    if ((req.session as any).tokens) return (req.session as any).tokens;
    const header = req.headers['x-gmail-tokens'];
    if (header && typeof header === 'string') {
      try {
        return JSON.parse(header);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Gmail Auth Routes
  app.get('/api/auth/google', async (req, res) => {
    console.log(`[OAuth] Request to /api/auth/google from origin: ${req.headers.origin || 'unknown'}`);
    const client = await getOAuth2Client();

    if (!client._clientId || !client._clientSecret) {
      console.error('[OAuth] CRITICAL ERROR: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set.');
      return res.status(500).json({
        error: 'Configurazione OAuth mancante sul server. Assicurati che GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET siano impostate su Cloud Run o Secret Manager.'
      });
    }

    const redirectUri = process.env.NODE_ENV === 'production'
      ? 'https://compilator-983823068962.europe-west1.run.app/api/auth/google/callback'
      : 'http://localhost:5001/api/auth/google/callback';

    console.log('[OAuth] Generating URL with redirect_uri:', redirectUri);

    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',
      redirect_uri: redirectUri
    });

    console.log('[OAuth] Generated URL:', url);
    res.json({ url });
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    const client = await getOAuth2Client();
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Code missing' });

    try {
      const redirectUri = process.env.NODE_ENV === 'production'
        ? 'https://compilator-983823068962.europe-west1.run.app/api/auth/google/callback'
        : 'http://localhost:5001/api/auth/google/callback';

      try {
        console.log('[OAuth] Exchanging code for tokens with Redirect URI:', redirectUri);
        const { tokens } = await client.getToken({
          code: code as string,
          redirect_uri: redirectUri
        });
        console.log('[OAuth] Tokens successfully retrieved');
        (req.session as any).tokens = tokens;

        // Redirect back to connectors page with tokens in postMessage to survive session issues
        res.send(`
        <script>
          const tokens = ${JSON.stringify(tokens)};
          window.opener.postMessage({ type: 'GMAIL_AUTH_SUCCESS', tokens: tokens }, '*');
          window.close();
        </script>
      `);
      } catch (error: any) {
        const errorData = error.response?.data;
        console.error('[OAuth] Token exchange FAILED:', errorData || error.message);
        console.error('[OAuth] Error details:', JSON.stringify(errorData, null, 2));
        res.status(500).send(`Authentication failed: ${error.message}`);
      }
    } catch (e: any) {
      console.error('[OAuth] Outer callback error:', e.message);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/api/auth/check', (req, res) => {
    // Check session or header (if provided in a test way, but check is usually for initial UI)
    const isConnected = !!((req.session as any).tokens || req.headers['x-gmail-tokens']);
    res.json({ isConnected });
  });

  app.post('/api/auth/logout', (req, res) => {
    (req.session as any).tokens = null;
    res.json({ success: true });
  });


  // Gmail Data Routes
  app.get('/api/gmail/messages', async (req, res) => {
    const tokens = getGoogleTokens(req);
    if (!tokens) return res.status(401).json({ error: 'Not connected to Gmail' });

    try {
      const client = await getOAuth2Client();
      client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: client });
      const { pageToken, category, q } = req.query;

      let categoryFilter = 'category:primary';
      if (category === 'social') categoryFilter = 'category:social';
      else if (category === 'promotions') categoryFilter = 'category:promotions';
      else if (category === 'updates') categoryFilter = 'category:updates';

      const searchQuery = q ? `${categoryFilter} ${q}` : categoryFilter;

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
        pageToken: pageToken as string,
        q: searchQuery
      });

      const messages = response.data.messages || [];
      const detailedMessages = await Promise.all(messages.map(async (msg: any) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full'
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(Senza Oggetto)';
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Sconosciuto';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';

        // Count attachments
        const parts = detail.data.payload?.parts || [];
        const attachmentCount = parts.filter((part: any) =>
          part.filename && part.filename.length > 0
        ).length;

        return {
          id: msg.id,
          threadId: msg.threadId,
          snippet: detail.data.snippet,
          subject,
          from,
          date,
          attachmentCount
        };
      }));

      res.json({
        messages: detailedMessages,
        nextPageToken: response.data.nextPageToken || null
      });
    } catch (error) {
      console.error('Error fetching Gmail metadata:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // --- GOOGLE DRIVE ROUTES ---

  app.get('/api/drive/files', async (req, res) => {
    const tokens = getGoogleTokens(req);
    if (!tokens) return res.status(401).json({ error: 'Not connected to Google' });

    try {
      const client = await getOAuth2Client();
      client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: client });
      const { pageToken, category, q, folderId } = req.query;

      let query = "trashed = false";

      // If folderId is provided, we look inside that folder
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      } else {
        // Only show root/top-level files if no folder/search is active
        // actually for "All files" it's better to show everything but folders
        // unless they are in the folders category
      }

      // Filter by category
      if (category === 'docs') {
        query += " and mimeType = 'application/vnd.google-apps.document'";
      } else if (category === 'sheets') {
        query += " and mimeType = 'application/vnd.google-apps.spreadsheet'";
      } else if (category === 'pdfs') {
        query += " and mimeType = 'application/pdf'";
      } else if (category === 'folders') {
        query += " and mimeType = 'application/vnd.google-apps.folder'";
      } else if (category === 'all') {
        // Exclude folders from "all" to avoid cluttering, user wanted them separate
        query += " and mimeType != 'application/vnd.google-apps.folder'";
      }

      // Add search text if present
      if (q) {
        query += ` and name contains '${(q as string).replace(/'/g, "\\'")}'`;
      }

      const response = await drive.files.list({
        pageSize: 20,
        pageToken: pageToken as string,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, thumbnailLink)',
        q: query,
        orderBy: 'modifiedTime desc'
      });

      res.json({
        files: response.data.files || [],
        nextPageToken: response.data.nextPageToken || null
      });
    } catch (error) {
      console.error('Error fetching Drive files:', error);
      res.status(500).json({ error: 'Failed to fetch Drive files' });
    }
  });

  app.get('/api/drive/export/:id', async (req, res) => {
    const tokens = getGoogleTokens(req);
    const { id } = req.params;
    if (!tokens) return res.status(401).json({ error: 'Not connected to Google' });

    try {
      const client = await getOAuth2Client();
      client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: client });

      // 1. Get file metadata
      const file = await drive.files.get({
        fileId: id,
        fields: 'id, name, mimeType, size'
      });

      const mimeType = file.data.mimeType || 'application/octet-stream';
      const fileName = file.data.name || 'documento';

      console.log(`[DEBUG Drive] Exporting file: ${fileName} (${mimeType})`);

      let data: Buffer;
      let finalMimeType = mimeType;
      let finalFileName = fileName;

      if (mimeType === 'application/vnd.google-apps.document') {
        // Export Google Doc as text
        const exportRes = await drive.files.export({
          fileId: id,
          mimeType: 'text/plain'
        }, { responseType: 'arraybuffer' });
        data = Buffer.from(exportRes.data as ArrayBuffer);
        finalMimeType = 'text/plain';
        finalFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Export Google Sheet as XLSX
        const exportRes = await drive.files.export({
          fileId: id,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }, { responseType: 'arraybuffer' });
        data = Buffer.from(exportRes.data as ArrayBuffer);
        finalMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
      } else {
        // Download binary file (PDF, etc.)
        const downloadRes = await drive.files.get({
          fileId: id,
          alt: 'media'
        }, { responseType: 'arraybuffer' });
        data = Buffer.from(downloadRes.data as ArrayBuffer);
      }

      res.json({
        name: finalFileName,
        mimeType: finalMimeType,
        base64: data.toString('base64'),
        size: data.length
      });

    } catch (error) {
      console.error('Error exporting Drive file:', error);
      res.status(500).json({ error: 'Failed to export file' });
    }
  });

  app.get('/api/gmail/message/:id', async (req, res) => {
    const tokens = getGoogleTokens(req);
    const { id } = req.params;
    const includeAttachments = req.query.attachments === 'true';
    if (!tokens) return res.status(401).json({ error: 'Not connected to Gmail' });

    try {
      const client = await getOAuth2Client();
      client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: client });
      const response = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full'
      });

      // Helper to extract body
      const getBody = (payload: any): string => {
        if (payload.body?.data) {
          return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        if (payload.parts) {
          return payload.parts.map((part: any) => getBody(part)).join('\n');
        }
        return '';
      };

      const body = getBody(response.data.payload);
      const attachments: any[] = [];

      if (includeAttachments && response.data.payload?.parts) {
        const fetchAttachments = async (parts: any[]) => {
          for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
              try {
                const attachRes = await gmail.users.messages.attachments.get({
                  userId: 'me',
                  messageId: id,
                  id: part.body.attachmentId
                });

                if (attachRes.data.data) {
                  attachments.push({
                    name: part.filename,
                    mimeType: part.mimeType,
                    size: part.body.size,
                    base64: attachRes.data.data // Already base64 from Gmail API
                  });
                }
              } catch (err) {
                console.error(`Error fetching attachment ${part.filename}:`, err);
              }
            } else if (part.parts) {
              await fetchAttachments(part.parts);
            }
          }
        };
        await fetchAttachments(response.data.payload.parts);
      }

      res.json({ body, attachments });
    } catch (error) {
      console.error('Error fetching email details:', error);
      res.status(500).json({ error: 'Failed to fetch email details' });
    }
  });

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

  // Helper function to convert file data to a Gemini part
  const fileToPart = async (base64Data: string, mimeType: string) => {
    // Strip data URI prefix if present
    const cleanBase64 = base64Data.split(',')[1] || base64Data;

    const isMultimodal =
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      mimeType === 'text/markdown' ||
      mimeType === 'application/rtf' ||
      mimeType === 'text/rtf' ||
      mimeType === 'application/json' ||
      mimeType === 'text/html' ||
      mimeType === 'application/xml' ||
      mimeType === 'text/xml';

    if (isMultimodal) {
      return {
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64
        }
      };
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
      // Handle DOCX by extracting text
      const buffer = Buffer.from(cleanBase64, 'base64');
      const textContent = await extractText(buffer, mimeType);
      return { text: `Contenuto del documento Word (DOCX):\n${textContent}` };
    } else if (mimeType.startsWith('text/')) {
      // For other text-based files, just decode
      const textContent = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      return { text: `Contenuto del file (${mimeType}):\n${textContent}` };
    }
    // Fallback for unsupported types, or if you want to send them as generic data
    return {
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64
      }
    };
  };

  // Endpoint per generare preview intelligente di documento pinnato
  app.post('/api/preview-pinned', async (req: Request, res: Response) => {
    try {
      const { source } = req.body;

      if (!source || !source.name || !source.base64) {
        return res.status(400).json({ error: 'Sorgente pinnata mancante o non valida' });
      }

      console.log(`[API preview-pinned] Generating preview for: ${source.name}`);

      // Get Gemini API key
      const apiKey = await getModelApiKey('gemini');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      // Initialize Vertex AI
      const projectId = process.env.GCP_PROJECT_ID || 'compilator-479214';
      const location = 'europe-west1';
      const vertexAI = new VertexAI({ project: projectId, location });
      const model = vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
        ]
      });

      // Prepare multimodal content once
      const filePart = await fileToPart(source.base64, source.type);

      const systemPrompt = `Sei un assistente di analisi documentale specializzato. Il tuo compito è fornire una preview intelligente e strutturata del documento.

**ISTRUZIONI PREVIEW:**
1. Analizza attentamente il documento
2. Fornisci una sintesi chiara e concisa
3. Identifica i punti chiave e le informazioni principali
4. Evidenzia argomenti trattati e struttura
5. Usa un formato leggibile con sezioni chiare

**FORMATO OUTPUT:**
- Usa intestazioni (#) e grassetti (**Titolo**)
- **Tabelle Markdown:** Usa le tabelle (| Col | Col |) per dati strutturati, importi o elenchi tecnici.
- Elenca punti chiave (•)
- Massimo 500 parole
- Linguaggio professionale ma accessibile`;

      // Simplified prompt construction
      const userPrompt = `Analizza questo documento e fornisci una preview intelligente seguendo le istruzioni del sistema.`;

      const request = {
        contents: [{
          role: 'user',
          parts: [
            { text: systemPrompt },
            filePart,
            { text: userPrompt }
          ]
        }]
      };

      // Generate preview
      const response = await model.generateContent(request);
      const previewText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || 'Impossibile generare preview';

      console.log(`[API preview-pinned] Preview generated successfully (${previewText.length} chars)`);

      res.json({ preview: previewText });

    } catch (error: any) {
      console.error('[API preview-pinned] Error:', error);
      res.status(500).json({
        error: error.message || 'Errore durante generazione preview'
      });
    }
  });

  // Endpoint per estrarre solo i campi del documento master (per contesto chat)
  app.post('/api/extract-fields-for-context', async (req: Request, res: Response) => {
    try {
      const { masterSource } = req.body;

      if (!masterSource || !masterSource.name || !masterSource.base64) {
        return res.status(400).json({ error: 'Documento master mancante o non valido' });
      }

      // Support PDF, DOCX, TXT, CSV for form field extraction
      const isPDF = masterSource.type.includes('pdf');
      const isDOCX = masterSource.type.includes('wordprocessingml') || masterSource.type.includes('msword');
      const isTXT = masterSource.type.includes('text/plain') || masterSource.name.endsWith('.txt');
      const isCSV = masterSource.type.includes('text/csv') || masterSource.name.endsWith('.csv');

      if (!isPDF && !isDOCX && !isTXT && !isCSV) {
        // For unsupported files, return empty fields
        return res.json({ fields: [], fileType: masterSource.type });
      }


      console.log(`[API extract-fields-for-context] Extracting fields from: ${masterSource.name}`);

      const { discoverFieldsWithGemini, getPDFDimensions } = await import('./form-compiler');
      const { flattenPDF } = await import('./pdf-utils');

      let pdfBuffer = Buffer.from(masterSource.base64, 'base64');

      // Flatten PDF to remove interactive fields (makes them visible to Gemini)
      if (isPDF) {
        console.log('[API extract-fields-for-context] Flattening PDF...');
        pdfBuffer = (await flattenPDF(pdfBuffer)) as any;
      }

      const projectId = process.env.GCP_PROJECT_ID || 'compilator-479214';

      // Initialize Gemini Model for Discovery
      const apiKey = await getModelApiKey('gemini');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      const location = 'us-central1';
      const vertexAIInstance = new VertexAI({ project: projectId, location });
      const model = vertexAIInstance.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
        ]
      });

      // Extract fields using Gemini Vision
      const fields = await discoverFieldsWithGemini(pdfBuffer.toString('base64'), model, masterSource.type);


      // Return simplified field list (just names and types, no coordinates)
      const simplifiedFields = fields.map((f: FormField) => ({
        name: f.fieldName,
        type: f.fieldType
      }));

      console.log(`[API extract-fields-for-context] Extracted ${simplifiedFields.length} fields`);

      res.json({
        fields: simplifiedFields,
        fileType: masterSource.type
      });

    } catch (error: any) {
      console.error('[API extract-fields-for-context] Error:', error);
      // Don't fail the chat - just return empty fields
      res.json({ fields: [], error: error.message });
    }
  });



  // Endpoint per compilare documenti con AI
  // NEW: Layout analysis for Document Studio (Gemini-Native via AiService)



  app.post('/api/compile', async (req: Request, res: Response) => {
    try {
      const { template, notes, sources: multimodalFiles, modelProvider, webResearch, detailedAnalysis, formalTone, masterSource, extractedFields, manualAnnotations } = req.body;

      console.log('[API compile] Request received:', {
        modelProvider,
        sourcesCount: multimodalFiles?.length,
        notesLength: notes?.length,
        webResearch,
        detailedAnalysis
      });

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

      // --- URL FETCHING LOGIC ---
      let fetchedCompilerContext = '';
      if (webResearch && notes) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = notes.match(urlRegex);
        if (urls && urls.length > 0) {
          console.log(`[DEBUG Compile] Found URLs in notes: ${urls.join(', ')}`);
          for (const url of urls) {
            const content = await fetchUrlContent(url);
            if (content) {
              fetchedCompilerContext += `\n--- FONTE WEB ESTERNA (${url}) ---\n${content}\n--- FINE FONTE WEB ---\n`;
            }
          }
        }
      }

      const hasExternalSources = fetchedCompilerContext.length > 0;
      let compileTextContext = fetchedCompilerContext;

      // Check for memory file
      const hasMemory = multimodalFiles?.some((s: any) => s.isMemory);

      // Build System Prompt
      let systemPrompt = `Data e ora corrente: ${dateTimeIT}

Sei un assistente AI esperto nella compilazione di documenti.

Devi compilare il template sottostante utilizzando le informazioni fornite nei documenti allegati (PDF, Immagini, Testo) e nelle note dell'utente.

**CONTESTUALIZZAZIONE E TERMINOLOGIA:**
- **COERENZA TERMINOLOGICA**: Devi adattare ogni termine, abbreviazione o riferimento alla terminologia specifica presente nei documenti caricati (Fascicolo).
- **CONTESTO DOCUMENTALE**: Interpreta i placeholder e il contenuto basandoti sul linguaggio tecnico e professionale rilevato nelle fonti (es. se la controparte è definita "Promissario Acquirente" in una fonte, usa quel termine con coerenza).

**ISTRUZIONI GESTIONE MEMORIA & DATI:**
${hasMemory ? `
1. **MEMORIA DI SISTEMA (Priorità Alta):** Hai accesso a un file "Gromit-Memory".
   - Usa questo file per recuperare l'IDENTITÀ di chi scrive (Nome, Cognome, Indirizzo, Ruolo).
   - NON usare questi dati se il template richiede i dati di una controparte (es. destinatario).
` : ''}
2. **NO ALLUCINAZIONI & REGOLE DI ESTRAZIONE (Tassativo):**
   - Prima di dichiarare un dato come mancante, controlla SCRUPOLOSAMENTE: **Memoria di Sistema**, tutti i **Documenti allegati**, la **Fonte Master** e il testo del **Template** stesso (che potrebbe contenere dati precompilati).
   - Se un dato è presente in QUALSIASI di queste fonti: **USALO**.
   - Solo se il dato è assolutamente assente ovunque: SCRIVI "[DATO MANCANTE]".
   - **VIETATO** inventare dati anagrafici (es. "Mario Rossi", date a caso). È meglio un campo vuoto che un dato falso, ma è UN ERRORE dichiarare mancate informazioni presenti nelle fonti.

${extractedFields && extractedFields.length > 0 ? `
3. **STRUTTURA DOCUMENTO TARGET (Intelligence Gemini Vision):**
   Il documento che stiamo compilando (o che fa da base) contiene i seguenti campi rilevati visivamente:
   ${extractedFields.map((f: any) => `- ${f.fieldName} (${f.fieldType})`).join('\n')}
   ASSICURATI che il contenuto generato includa o faccia riferimento a questi campi se pertinenti.
` : ''}
${manualAnnotations && manualAnnotations.length > 0 ? `
4. **ANNOTAZIONI MANUALI STUDIO (Priorità Massima):**
   L'utente ha aggiunto manualmente i seguenti testi sull'anteprima del documento:
   ${manualAnnotations.map((a: any) => `- Pagina ${a.pageNumber}: "${a.text}"`).join('\n')}
   QUESTI DATI HANNO LA PRIORITÀ su qualsiasi altra fonte. Usali per sovrascrivere o completare i campi corrispondenti nel template.
` : ''}
${masterSource ? `
4. **MASTER SOURCE (Spunta Blu) - Fonte Primaria di Dati e Stile:**
   Il documento "${masterSource.name}" è contrassegnato come MASTER.
   - **DATI:** Estrai con priorità massima ogni informazione utile (nomi, date, importi) da questo documento. Se il Master dice "Dott. Mario Zanchi", NON scrivere "[DATO MANCANTE]".
   - **STILE:** Usa questo documento come riferimento per lo STILE e il LAYOUT del documento finale.
` : ''}

- **GESTIONE CHECKBOX:**
  - Se il template o il MASTER contengono checkbox (es. "[ ]", "☐", o punti elenco che fungono da scelta), devi **spuntarli precisamente** in base ai dati trovati nelle fonti.
  - Usa la notazione standard: **[x]** per opzione selezionata e **[ ]** per opzione non selezionata.
  - Esempio: Se trovi "Mezzi propri" selezionato nel Master, scrivi **[x] Mezzi propri** nel documento finale.
- **SINTESI:** Incrocia i dati delle varie fonti per ottenere un risultato completo.

${detailedAnalysis ? `
MODALITÀ ANALISI DETTAGLIATA ATTIVA:
- Fornisci risposte approfondite.
- Includi i dettagli rilevanti trovati nei documenti.` : ''}

${webResearch ? `
MODALITÀ WEB RESEARCH ATTIVA:
- Usa i link forniti nelle note per il contesto e l'argomento (adatta il contenuto al link).
- **PRIORITÀ DATI:** Se un dato è presente sia nel LINK che nelle FONTI CARICATE (PDF/Doc), usa SEMPRE il dato delle FONTI CARICATE.
- I link servono per arricchire, non per sovrascrivere i documenti ufficiali.` : ''}

${(multimodalFiles.length > 0 || masterSource || hasExternalSources) ? `
Hai accesso a ${multimodalFiles.length + (masterSource ? 1 : 0) + (hasExternalSources ? 1 : 0)} fonti.
ANALIZZA TUTTE LE FONTI CON ATTENZIONE.` : 'NESSUNA FONTE FORNITA. Compila solo basandoti sulle Note o rifiuta la compilazione.'}
`;

      // Build User Prompt
      const userPrompt = template ? `Compila il seguente template:

TEMPLATE:
${template}

${notes ? `NOTE UTENTE:\n${notes}` : ''}

${formalTone ? 'Usa un tono formale.' : ''}

ISTRUZIONI OUTPUT:
- Restituisci il DOCUMENTO COMPLETAMENTE COMPILATO.
- Sostituisci i placeholder nel testo.
- Non restituire JSON.
- Non dire "Ecco il documento compilato", restituisci SOLO il testo del documento.
` : `Genera un documento completo basandoti sulle note dell'utente e seguendo ESATTAMENTE la struttura e lo stile del documento MASTER fornito.

${notes ? `NOTE UTENTE:\n${notes}` : ''}

${formalTone ? 'Usa un tono formale.' : ''}

ISTRUZIONI OUTPUT:
- Restituisci il DOCUMENTO FINALE COMPLETATO.
- Includi tutte le sezioni necessarie basandoti sul MASTER SOURCE.
- Non restituire JSON.
- Non dire "Ecco il documento", restituisci SOLO il testo del documento.
`;

      console.log('[DEBUG Compile] Pre-processing multimodal parts in parallel...');
      const [preProcessedSourceParts, preProcessedMasterParts] = await Promise.all([
        multimodalFiles?.length > 0 ? aiService.processMultimodalParts(multimodalFiles) : Promise.resolve([]),
        masterSource ? aiService.processMultimodalParts([masterSource]) : Promise.resolve([])
      ]);

      console.log('[DEBUG Compile] Calling AiService.compileDocument (Unified Pass: Content + Layout)...');
      const { content: finalContent } = await aiService.compileDocument({
        systemPrompt,
        userPrompt,
        multimodalFiles: multimodalFiles || [],
        masterSource: masterSource || null,
        preProcessedParts: preProcessedSourceParts
      });

      console.log('[DEBUG Compile] AI Compilation complete.');

      res.json({
        success: true,
        compiledContent: finalContent
      });

    } catch (error: any) {
      console.error('Errore durante compilazione:', error);
      res.status(500).json({
        error: error.message || 'Errore durante compilazione documento',
      });
    }
  });




  // Endpoint per trascrizione audio (Server-Side STT)
  app.post('/api/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nessun file audio fornito' });
      }
      console.log(`[DEBUG Transcribe] Received audio file: ${req.file.originalname}, size: ${req.file.size}, mime: ${req.file.mimetype} `);

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
      }

      // Use Gemini 1.5 Flash for speed
      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: {
          role: 'system',
          parts: [{ text: "Sei un trascrizionista esperto. Il tuo compito è trascrivere l'audio fornito in testo italiano, fedelmente e velocemente. Non aggiungere commenti, solo il testo trascritto. Se l'audio non è chiaro, scrivi [Audio non chiaro]." }]
        }
      });

      // Prepare request
      const audioPart = {
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString('base64')
        }
      };

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [audioPart] }],
        generationConfig: {
          temperature: 0,
        }
      });

      const response = await result.response;
      let text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      console.log(`[DEBUG Transcribe] Transcription result: ${text.substring(0, 50)}...`);

      res.json({ text: text.trim() });

    } catch (error: any) {
      console.error('Errore durante trascrizione:', error);
      res.status(500).json({
        error: error.message || 'Errore durante trascrizione audio',
      });
    }
  });

  // Endpoint per generare domande suggerite
  app.post('/api/suggest-questions', async (req: Request, res: Response) => {
    try {
      const { messages, sources, webResearch } = req.body;

      // Check validation constraints:
      // Don't generate if no sources and no web research (or no context)
      const hasSources = sources && Array.isArray(sources) && sources.length > 0;
      // Check for URLs in the last user message to see if web research is relevant
      const lastMessage = messages?.[messages.length - 1];
      const hasUrls = lastMessage?.role === 'user' && /(https?:\/\/[^\s]+)/.test(lastMessage.content);
      const hasContext = hasSources || (webResearch && hasUrls);

      // Relaxed constraint: Generate questions even without sources/urls if we have message history
      // if (!hasContext) {
      //   return res.json({ questions: [] });
      // }

      // Initialize Vertex AI (using cache logic)
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
        vertex_ai = new VertexAI({ project, location, googleAuthOptions: authOptions });
        vertexAICache = { client: vertex_ai, project: project!, location };
      }

      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: {
          role: 'system',
          parts: [{ text: "Sei un analista dati esperto e diretto. Genera ESATTAMENTE 4 domande brevi (massimo 25 caratteri l'una) in italiano, che approfondiscono l'analisi. Usa uno stile telegrafico ma naturale. Esempi: 'Analisi costi dettagliata?', 'Quali trend futuri?', 'Rischi principali?'. Restituisci SOLO un array JSON di stringhe." }]
        }
      });

      // Prepare simple context for generation
      const historyText = messages.slice(-3).map((m: any) => `${m.role}: ${m.content} `).join('\n');
      const prompt = `Contesto: \n${historyText} \n\nGenera 4 domande follow - up brevi(max 25 caratteri).Output JSON array.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.5 }
      });

      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      let questions = [];
      try {
        questions = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse suggested questions JSON:", e);
        questions = [];
      }

      // Enforce max 25 chars hard limit (relaxed)
      questions = questions.map((q: string) => q.length > 25 ? q.substring(0, 24) + "." : q).slice(0, 4);

      res.json({ questions });

    } catch (error: any) {
      console.error('Errore generazione domande suggerite:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint per generare template di documenti con AI
  app.post('/api/generate-template', async (req: Request, res: Response) => {
    try {
      const { prompt, notes, sources } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Descrizione template richiesta' });
      }

      console.log(`[DEBUG Template Gen]Request: ${prompt.substring(0, 50)}... Notes incl: ${!!notes} `);

      // Initialize Vertex AI
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
        vertex_ai = new VertexAI({ project, location, googleAuthOptions: authOptions });
        vertexAICache = { client: vertex_ai, project: project!, location };
      }

      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: {
          role: 'system',
          parts: [{
            text: `Sei un esperto creatore di template documentali professionali(Document Intelligence Engine) dotato di un LABORATORIO DI RICERCA in background.

TUO PROCESSO OPERATIVO(Back - ground Laboratory):
  1.  Usa i tuoi strumenti(Google Search) per ANALIZZARE il settore specifico della richiesta dell'utente. Cerca standard aggiornati, normative recenti e best practices per quel tipo di documento oggi.
  2.  COMPRENDI profondamente il contesto professionale(legale, tecnico, amministrativo).
3.  SPECIALIZZATI nella creazione del template perfetto per quel caso specifico.
4.  **CONTESTUALIZZAZIONE**: Adatta ogni termine e riferimento alla terminologia specifica presente nei documenti caricati (Fascicolo).

REGOLE FONDAMENTALI DI OUTPUT(IMPORTANTE):
  1.  Usa SOLO TESTO PURO.NON usare MAI sintassi Markdown(niente grassetto **, niente corsivo *, niente hashtag #).
2.  L'output deve essere pulito e ordinato, pronto per essere incollato in un editor di testo semplice.
  3.  Usa SOLO lingua ITALIANA formale e professionale.
4.  Per ogni dato variabile che dovrà essere compilato in seguito, usa ESCLUSIVAMENTE il formato placeholder con parentesi quadre e MAIUSCOLO.Esempio: [NOME_CLIENTE], [DATA], [IMPORTO], [DESCRIZIONE_PROGETTO].
5.  NON inventare dati fittizi(es.non scrivere "Mario Rossi", scrivi[NOME_COGNOME]).
6.  Struttura il documento con intestazioni chiare(usa il MAIUSCOLO per i titoli), elenchi puntati se necessari(usa semplici trattini -) e sezioni ben definite con spaziature.
7.  All'inizio del documento inserisci sempre:
    TITOLO DEL DOCUMENTO(TUTTO MAIUSCOLO)
  [DATA]

Esempio di output desiderato(formato corretto):
VERBALE DI RIUNIONE
  Data: [DATA]
  Partecipanti: [ELENCO_PARTECIPANTI]
  Argomento: [ARGOMENTO_RIUNIONE]

  1. INTRODUZIONE
Si è riunito il giorno[DATA] presso[LUOGO] il consiglio...` }]
        },
        tools: [{ googleSearch: {} }]
      });

      // Construct rich user prompt
      let userPrompt = `Crea un template per: ${prompt} `;
      if (notes) {
        userPrompt += `\n\nNOTE AGGIUNTIVE E CONTESTO UTENTE: \n${notes} \n\nUsa queste note per adattare il linguaggio, il formato o le sezioni specifiche del template.`;
      }

      const parts: any[] = [];

      // Process Sources Context
      if (sources && Array.isArray(sources) && sources.length > 0) {
        const hasMemory = sources.some((s: any) => s.isMemory);

        userPrompt += `\n\n[IMPORTANTE - FONTI ALLEGATE] Ho allegato dei documenti.`;

        if (hasMemory) {
          userPrompt += `\nNOTA SPECIALE MEMORIA: È incluso un file di "Memoria/Profilo" (Gromit-Memory).
             - Usa la Memoria per: Stile, Formattazione preferita, Dati anagrafici chi compilatore.
             - Usa gli ALTRI file per: Il contenuto vero e proprio del documento (Dati del verbale, progetto, ecc).
             - Se devi citare info dalla memoria (es. "Chi scrive"), fallo in modo naturale ("Come da tue preferenze...").`;
        }

        userPrompt += `\nUSALI come contesto primario per capire di cosa si sta parlando. Basati sui documenti allegati per inferire la struttura corretta.`;

        console.log(`[DEBUG Template Gen] Processing ${sources.length} sources for context...`);
        // ... rest of loop

        for (const source of sources) {
          if (source.base64 && source.type) {
            // Use the new fileToPart helper
            const filePart = await fileToPart(source.base64, source.type);
            parts.push(filePart);
          }
        }
      }

      // Add text instruction
      parts.push({ text: userPrompt });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          maxOutputTokens: 50000,
          temperature: 0.7,
        }
      });

      const generatedTemplate = result.response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      console.log(`[DEBUG Template Gen]Success, length: ${generatedTemplate.length} `);

      res.json({ template: generatedTemplate });

    } catch (error: any) {
      console.error('Errore generazione template:', error);
      res.status(500).json({ error: error.message || 'Errore durante generazione template' });
    }
  });

  // Endpoint per chat con AI (con streaming e file support)
  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const { temperature, webResearch, driveMode } = req.body;
      let { messages, sources } = req.body; // sources: array of {name, type, size, url: GCS URL, isMemory?: boolean}

      // Prioritize Memory files (Hierarchical Context: System > Memory > Sources > User)
      if (sources && Array.isArray(sources)) {
        sources.sort((a: any, b: any) => {
          if (a.isMemory && !b.isMemory) return -1;
          if (!a.isMemory && b.isMemory) return 1;
          return 0;
        });

        // 0. LIVE DRIVE REFRESH (If Drive Mode active)
        // When Drive Mode is ON, we ignore the stale content provided by frontend and fetch fresh content from Drive ID.
        if (driveMode) {
          console.log('[Drive Mode] Active. Checking for Drive sources to refresh...');
          const tokens = getGoogleTokens(req);
          if (tokens) {
            for (const source of sources) {
              if (source.driveId) {
                console.log(`[Drive Mode] Refreshing content for ${source.name} (${source.driveId})...`);
                const freshFile = await downloadDriveFile(tokens, source.driveId);
                if (freshFile) {
                  // Update source with FRESH content
                  source.base64 = freshFile.buffer.toString('base64');
                  source.type = freshFile.mimeType;
                  source.name = freshFile.name; // Name might change (e.g. .txt appended)
                  // Also update driveId if for some reason it's different? No, keep it.
                  console.log(`[Drive Mode] Source refreshed: ${source.name}`);
                }
              }
            }
          } else {
            console.warn('[Drive Mode] No Google Tokens found. Cannot refresh sources.');
          }
        }
      }

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

      // --- URL FETCHING LOGIC ---
      let fetchedContentContext = '';

      // Check last message for URLs
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'user' && typeof lastMessage.content === 'string') {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = lastMessage.content.match(urlRegex);

        if (urls && urls.length > 0) {
          if (webResearch) {
            for (const url of urls) {
              const content = await fetchUrlContent(url);
              if (content) {
                fetchedContentContext += `\n--- CONTENUTO ESTRATTO DA LINK: ${url} ---\n${content}\n--- FINE CONTENUTO LINK ---\n`;
              }
            }
          } else {
            fetchedContentContext += `\n[AVVISO DI SISTEMA] L'utente ha incluso URL ma la Web Research è DISATTIVATA. Non hai accesso ai link.\n`;
          }
        }
      }

      // Recupera la chiave API dal Secret Manager
      const apiKey = await getModelApiKey('gemini');
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

      // Download and process files
      let filesContext = '';
      let memoryContext = '';
      if (fetchedContentContext) {
        filesContext += fetchedContentContext;
      }
      const multimodalFiles: any[] = [];

      if (sources && Array.isArray(sources)) {
        const sourceResults = await Promise.all(sources.map(async (source) => {
          try {
            let base64: string;
            if (source.base64) {
              base64 = source.base64;
            } else {
              return null;
            }

            if (source.type.startsWith('video/')) return null;

            // Normalize MIME type based on extension (fix for Drive/generic types)
            if (source.name.toLowerCase().endsWith('.docx')) {
              source.type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            } else if (source.name.toLowerCase().endsWith('.doc')) {
              source.type = 'application/msword';
            }

            const isMultimodal =
              !source.isMemory && ( // FORCE MEMORY AS TEXT to prevent model bias against local docs
                source.type.startsWith('image/') ||
                source.type === 'application/pdf' ||
                source.type.startsWith('audio/') ||
                source.type.startsWith('video/') ||
                source.type === 'text/markdown' ||
                source.type === 'application/rtf' ||
                source.type === 'text/rtf' ||
                source.type === 'application/json' ||
                source.type === 'text/html' ||
                source.type === 'application/xml' ||
                source.type === 'text/xml');
            source.type === 'text/xml';

            const isDOCX =
              source.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // DOCX
              source.type === 'application/msword'; // Old DOC

            if (isMultimodal) {
              return {
                multimodal: {
                  name: source.name,
                  id: source.driveId || source.id,
                  mimeType: source.type,
                  base64: base64,
                  isMemory: source.isMemory
                }
              };
            } else {
              const buffer = Buffer.from(base64, 'base64');
              const textContent = await extractText(buffer, source.type);
              if (textContent) {
                return {
                  text: {
                    name: source.name,
                    id: source.driveId || source.id,
                    content: textContent,
                    isMemory: source.isMemory
                  }
                };
              }
            }
          } catch (error) {
            console.error(`Error processing file ${source.name}:`, error);
          }
          return null;
        }));

        for (const result of sourceResults) {
          if (!result) continue;
          if (result.multimodal) {
            multimodalFiles.push(result.multimodal);
            if (!result.multimodal.isMemory) {
              const idInfo = result.multimodal.id ? ` [ID: ${result.multimodal.id}]` : '';
              filesContext += `- ${result.multimodal.name}${idInfo} (${result.multimodal.mimeType})\n`;
            } else {
              memoryContext += `[DISPONIBILE ALLEGATO MULTIMODALE DI MEMORIA: ${result.multimodal.name}]\n`;
            }
          } else if (result.text) {
            if (result.text.isMemory) {
              memoryContext += `[INFO PRELEVATE DALLA TUA MEMORIA INTERNA]:\n${result.text.content}\n`;
            } else {
              const idInfo = result.text.id ? ` [ID: ${result.text.id}]` : '';
              filesContext += `\n--- CONTENUTO FILE: ${result.text.name}${idInfo} ---\n${result.text.content}\n--- FINE CONTENUTO FILE ---\n`;
            }
          }
        }
      }

      // Calculate max response length - using tokens as per user request
      const maxTokens = 50000;

      let systemInstruction = `Sei un assistente AI di ricerca esperto e professionale.
`;

      // Check for memory file
      const hasMemory = sources?.some((s: any) => s.isMemory);

      if (hasMemory) {
        systemInstruction += `
**GESTIONE MEMORIA (CONTESTO SILENTE):**
Hai accesso a un file di memoria che contiene l'identità dell'utente (Carlo Galli) e le sue preferenze.
1. **Utilizzo**: Usa queste informazioni SOLO per personalizzare lo stile o rispondere a domande dirette su chi sei o sull'identità dell'utente. 
2. **Silenziamento**: NON menzionare MAI il file "Gromit-Memory.pdf" o "Memoria/Profilo" nella risposta. Deve essere un contesto trasparente.
3. **REGOLA AUREA**: La memoria NON è il documento da analizzare. È solo un foglio di stile/identità.
${memoryContext}
`;
      }

      systemInstruction += `

**TITOLO RIASSUNTIVO (OBBLIGATORIO):**
Alla fine di ogni risposta, aggiungi SEMPRE un titolo estremamente breve (max 5 parole) che riassuma il contenuto del messaggio, racchiuso tra i tag <short_title> e </short_title>.
Esempio: <short_title>Analisi Contratto Locazione</short_title>
`;

      systemInstruction += `
**TABELLE E FORMATTAZIONE (CALIBRAZIONE NOTION):**
1. **Sintassi GFM Rigorosa**: Per ogni tabella, ogni riga (inclusa intestazione e separatore) DEVE iniziare e finire con il carattere pipe \`|\`. Usa la riga di separazione standard \`|---|---|\`.
   Esempio corretto:
   | Colonna A | Colonna B |
   |:---|:---|
   | Dato 1 | Dato 2 |
2. **RESTRIZIONE TABELLE**: Usa le tabelle **STRETTAMENTE NECESSARIE SOLO PER LISTE DI DATI O PARAGONI**. 
   - **VIETATO** scrivere risposte discorsive, spiegazioni o frasi lunghe all'interno di una tabella.
   - Le spiegazioni e il testo discorsivo devono essere sempre fuori dalle tabelle, come normali paragrafi.
3. **Separazione Netta**: NON mischiare mai tabelle diverse. Chiudi sempre una tabella e inserisci un paragrafo di testo o una riga vuota prima di iniziarne un'altra.
4. **Copia-Incolla**: Mantieni una struttura pulita e standard affinché l'utente possa incollare la risposta su Notion mantenendo la formattazione tabellare originale.
5. **DIVIETO ASSOLUTO HTML**: NON usare mai tag HTML (es. <br>, <br/>, <hr>) per la formattazione. Usa SOLO Markdown standard. Se devi andare a capo all'interno di una cella, NON farlo (rompe il Markdown); piuttosto usa elenchi puntati fuori dalla tabella.

**RICHIESTE TECNICHE E LIMITI:**
1. **Completezza**: Se l'utente richiede JSON, codice o dataset, fornisci SEMPRE l'output integrale (max 50.000 token). NON usare mai commenti come "// rest of code" o "..." per abbreviare.
2. **Formattazione**: Racchiudi JSON e codice in blocchi markdown (es. \`\`\`json).
3. **Elenchi**: Usa elenchi puntati (-) per migliorare la leggibilità fuori dalle tabelle.
4. **Grassetto**: Usa il grassetto (**) per enfatizzare, ma evita hashtag (#) per i titoli.
`;
      systemInstruction += `
**DOCUMENTI ATTIVI DA ANALIZZARE (TARGET):**
Questi sono i documenti che l'utente ti ha chiesto di analizzare. Riferisciti A QUESTI per le tue risposte.
${filesContext}

6. Se la risposta non è nei documenti, dichiaralo.

**CONTESTUALIZZAZIONE E TERMINOLOGIA:**
- Interpreta ogni termine tecnico, abbreviazione o riferimento basandoti SCRUPOLOSAMENTE sul contesto dei documenti caricati. 
- Adatta il tuo linguaggio alla terminologia specifica usata nelle fonti (es. termini notarili, tecnici o legali specifici di quel fascicolo).

**STRATEGIA MODIFICA DRIVE (WORD & SHEETS):**
1. **Google Sheets (Fogli di Calcolo)**:
   - Il contenuto ti viene presentato come una lista di celle: \`[A1] Valore {Formula: =...} | [B1] Valore...\`.
   - **STRUMENTO**: Usa \`update_sheet_cell_range(fileId, range, values)\`.
     - Puoi scrivere valori PURI o FORMULE (es. "=SUM(A1:A5)").
     - **ATTENZIONE LOCALE (IMPORTANTE)**: Se il foglio è in Italiano (Euro, date GG/MM), usa il **PUNTO E VIRGOLA (;)** come separatore argomenti (es. \`= SUMIF(A: A; "Casa"; B:B)\`). La virgola (,) rompe la formula perché è usata per i decimali.
     - **METADATI E REGOLE (IMPORTANTE)**:
       - Il contenuto default è SOLO TESTO/VALORI. Le regole (Dropdown, Validazione, Colori) sono INVISIBILI a meno che tu non le cerchi.
       - Se l'utente chiede "Analizza le regole", "Controlla la struttura", "Vedi i menu a tendina" o "Perché questa cella è rossa?":
         - DEVI OBBLIGATORIAMENTE usare \`get_sheet_metadata(fileId)\`.
       - Per MODIFICARE regole/colori: Usa \`update_sheet_metadata(fileId, requests)\`.
       - Esempio creazione Dropdown: requests=[{setDataValidation: {range: {...}, rule: {condition: {type: 'ONE_OF_LIST', values: [{userEnteredValue: 'Si'}, {userEnteredValue: 'No'}]}}}}].
   - **AGGIORNAMENTI MIRATI**: Non riscriverti tutto il foglio. Modifica SOLO le celle necessarie.
     - **REGOLA ANTI-ERRORE**: Specifica sempre solo la **CELLA INIZIALE** (es. "B2") come range. Mai un range chiuso (es. "B2:C5") per evitare mismatch di dimensioni.
     - Esempio Corretto: range="B2", values=[["2024", "Gennaio"]] (scrive in B2 e C2).
   - **APPEND**: Per aggiungere righe, cerca l'ultima riga occupata nella lista celle e scrivi nella successiva.
   - **NON DISTRUGGERE IL LAYOUT**: Scrivi solo dove serve. Non sovrascrivere intestazioni o celle vuote se non richiesto.

   **PROTOCOLLO TASK COMPLESSI (OBBLIGATORIO):**
   Se l'utente richiede modifiche strutturali pesanti, calcoli complessi o ristrutturazioni massive:
   1. **STOP**: NON eseguire subito gli strumenti.
   2. **PIANIFICA**: Proponi un piano step-by-step in chat spiegando la logica (es. "1. Analizzo colonne, 2. Creo le formule in X, 3. Aggiorno totali").
   3. **ATTENDI**: Chiedi conferma ("Procedo con l'esecuzione?").
   4. **ESEGUI**: Solo dopo l'ok, usa gli strumenti.

2. **Google Docs (Word)**:
   - Usa \`update_drive_file\` con il testo completo. Qui devi riscrivere l'intero documento aggiornato.


**GUARDRAIL ALLEGATI E AZIONI FUTURE:**
1. **DIVIETO DI INVENZIONE**: NON fare mai riferimento ad allegati, documenti o file che NON sono presenti nell'elenco delle "FONTI CARICATE" sopra riportato.
2. **GESTIONE DOCUMENTI MANCANTI**: Se per rispondere correttamente rilevi che sarebbe necessario un documento non presente (es. una visura, un atto citato ma non allegato), dichiara chiaramente la sua assenza.
3. **CALL-TO-ACTION (OBBLIGATORIO)**: Se menzioni la mancanza di un documento o suggerisci la creazione di un nuovo allegato/bozza, devi SEMPRE terminare la tua risposta con questa esatta frase:
   *"Desideri che io proceda con la generazione degli allegati sopra menzionati?"*

4. **DISCLAIMER LEGALE (PROTEZIONE)**: Se la tua risposta comporta, suggerisce o richiede valutazioni legali autonome o interpretazioni di norme che potrebbero influenzare un atto finale, aggiungi SEMPRE questo avviso in fondo al messaggio (dopo la call-to-action):
   *"IMPORTANTE: Questa risposta comporta o suggerisce valutazioni legali autonome. Il sistema funge da supporto al linguaggio tecnico; l'output deve essere ricontrollato attentamente da un professionista umano."*

**CAPACITÀ DI GENERAZIONE FILE (OBBLIGATORIO PER OUTPUT ESTESI):**
- **REGOLA AUREA**: Se l'utente chiede di "creare un file", "generare un dataset", "fare un download", o se l'output previsto è un codice/JSON/Testo lungo (> 50 righe), **DEVI** usare i tool di generazione file.
- **DIVIETO**: NON stampare MAI codici interi, JSON enormi o documenti completi direttamente nella chat se puoi farne un file. La chat serve per la spiegazione, il file per il contenuto.
- **Formati Supportati**:
  1. **PDF**: \`generate_pdf\` (per documenti formattati, contratti, report).
  2. **DOCX**: \`generate_docx\` (per documenti modificabili Word).
  3. **Markdown**: \`generate_md\` (per note tecniche o documentazione).
  4. **JSONL**: \`generate_jsonl\` (per dataset).
- **Limitazioni**: NON puoi generare altri formati (es. RTF, ODG, ZIP). Se l'utente chiede un formato non supportato, proponi uno di quelli disponibili.

`;

      if (webResearch) {
        systemInstruction += `\n**MODALITÀ WEB RESEARCH ATTIVA**: Usa lo strumento di ricerca per link o info mancanti.
- **GROUNDING VS COMPLETEZZA**: Se l'utente richiede un intero dataset, JSON o un output tecnico esteso, dai priorità alla COMPLETEZZA dell'output (come da ISTRUZIONI BASE) anche se stai usando informazioni prelevate dal web. NON troncare dataset per brevità.`;
      }

      // Initialize Vertex AI
      const project = process.env.GCP_PROJECT_ID;
      const location = 'europe-west1'; // Revert to standard region
      const { VertexAI } = await import("@google-cloud/vertexai");

      // Force cleanup of cache if location mismatch
      if (vertexAICache && (vertexAICache.location !== location || vertexAICache.project !== project)) {
        console.log('[DEBUG Chat] Clearing Vertex AI Cache due to project/location change');
        vertexAICache = null;
      }

      let vertex_ai;
      if (vertexAICache && vertexAICache.project === project && vertexAICache.location === location) {
        vertex_ai = vertexAICache.client;
      } else {
        console.log(`[API Chat] Initializing new Vertex AI client for ${location}`);

        let authOptions = undefined;
        if (process.env.GCP_CREDENTIALS) {
          try {
            const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
            authOptions = { credentials };
          } catch (e) {
            console.error('[API Chat] Failed to parse GCP_CREDENTIALS', e);
          }
        }

        vertex_ai = new VertexAI({ project, location, googleAuthOptions: authOptions });
        vertexAICache = { client: vertex_ai, project: project!, location };
      }

      console.log(`[DEBUG Chat] Using Project: ${project}, Location: ${location}`);
      console.log(`[DEBUG Chat] Model ID: ${ANALYZER_MODEL_ID}`); // Will be 'gemini-2.5-flash'

      const model = vertex_ai.getGenerativeModel({
        model: ANALYZER_MODEL_ID,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstruction }]
        }
      });

      // Map messages
      const coreMessages = messages.map((msg: any) => {
        // Simplified mapping
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const parts = [{ text: typeof msg.content === 'string' ? msg.content : '' }];
        return { role, parts };
      });

      // Vertex AI requires history to start with 'user'. Remove leading 'model' messages.
      while (coreMessages.length > 0 && coreMessages[0].role === 'model') {
        console.log('[DEBUG Chat] Removed leading MODEL message from history to satisfy API requirements.');
        coreMessages.shift();
      }

      // Attach multimodal to last message
      if (multimodalFiles.length > 0 && coreMessages.length > 0) {
        const lastMsg = coreMessages[coreMessages.length - 1];
        if (lastMsg.role === 'user') {
          const fileParts = await Promise.all(multimodalFiles.map(f => fileToPart(f.base64, f.mimeType)));
          (lastMsg.parts as any[]).push(...fileParts);
        }
      }


      // --- 1. TOOL DEFINITIONS ---
      // --- 1. TOOL DEFINITIONS ---
      const standardGenerationTools = [{
        functionDeclarations: [
          {
            name: "generate_pdf",
            description: "Generates a downloadable PDF file from text content. Use this when the user specifically asks for a PDF.",
            parameters: {
              type: "OBJECT",
              properties: {
                content: { type: "STRING", description: "The text content to convert to PDF." },
                filename: { type: "STRING", description: "The desired filename (e.g., document.pdf)." }
              },
              required: ["content", "filename"]
            }
          },
          {
            name: "generate_docx",
            description: "Generates a downloadable DOCX (Word) file. Use this for editable documents.",
            parameters: {
              type: "OBJECT",
              properties: {
                content: { type: "STRING", description: "The content of the document." },
                filename: { type: "STRING", description: "The desired filename (e.g., document.docx)." }
              },
              required: ["content", "filename"]
            }
          },
          {
            name: "generate_md",
            description: "Generates a downloadable Markdown (.md) file. Use this for documentation.",
            parameters: {
              type: "OBJECT",
              properties: {
                content: { type: "STRING", description: "The markdown content." },
                filename: { type: "STRING", description: "The desired filename (e.g., readme.md)." }
              },
              required: ["content", "filename"]
            }
          },
          {
            name: "generate_jsonl",
            description: "Generates a downloadable JSONL dataset file. Use this for datasets.",
            parameters: {
              type: "OBJECT",
              properties: {
                data: { type: "STRING", description: "The JSONL data string." },
                filename: { type: "STRING", description: "The desired filename (e.g., dataset.jsonl)." }
              },
              required: ["data", "filename"]
            }
          }
        ]
      }];

      const driveTools = [{
        functionDeclarations: [
          {
            name: "update_drive_file",
            description: "Updates (overwrites) the content of an EXISTING file in user's Google Drive. Use this to modify a file you are analyzing.",
            parameters: {
              type: "OBJECT",
              properties: {
                fileId: { type: "STRING", description: "The Google Drive File ID to update." },
                newContent: { type: "STRING", description: "The new text content for the file." }
              },
              required: ["fileId", "newContent"]
            }
          },
          {
            name: "update_sheet_cell_range",
            description: "Updates a specific range of cells in a Google Sheet. Efficient for modifying spreadsheets without rewriting the whole file.",
            parameters: {
              type: "OBJECT",
              properties: {
                fileId: { type: "STRING", description: "The Google Sheet File ID." },
                range: { type: "STRING", description: "The A1 notation of the range to update (e.g., 'Sheet1!A1:B2')." },
                values: {
                  type: "ARRAY",
                  description: "A 2D array of values to write into the range.",
                  items: {
                    type: "ARRAY",
                    items: { type: "STRING" }
                  }
                }
              },
              required: ["fileId", "range", "values"]
            }
          },
          {
            name: "create_drive_file",
            description: "Creates a NEW file directly in user's Google Drive (instead of a temporary download link).",
            parameters: {
              type: "OBJECT",
              properties: {
                fileName: { type: "STRING", description: "Name of the new file." },
                content: { type: "STRING", description: "Content of the file." },
                folderId: { type: "STRING", description: "Optional: ID of the parent folder to create the file in." }
              },
              required: ["fileName", "content"]
            }
          },
          {
            name: "get_sheet_metadata",
            description: "Retrieves metadata for a Google Sheet, such as Data Validation rules (dropdowns), formatting, and named ranges. Use this to understand the structure before modifying.",
            parameters: {
              type: "OBJECT",
              properties: {
                fileId: { type: "STRING", description: "The Google Sheet File ID (spreadsheetId)." }
              },
              required: ["fileId"]
            }
          },
          {
            name: "update_sheet_metadata",
            description: "Updates metadata of a Google Sheet details (Validation Rules, Formatting, etc.) using the batchUpdate API format.",
            parameters: {
              type: "OBJECT",
              properties: {
                fileId: { type: "STRING", description: "The Google Sheet File ID." },
                requests: {
                  type: "ARRAY",
                  description: "Array of Google Sheets API Request objects (e.g. setDataValidation, repeatCell).",
                  items: { type: "OBJECT" }
                }
              },
              required: ["fileId", "requests"]
            }
          }
        ]
      }];

      // Initialize tools array based on Web Research toggle (Mutually Exclusive)
      let tools: any[] = [];

      if (webResearch) {
        // MODE: Web Research ON -> Only Google Search allowed
        console.log('[API Chat] Web Research IS ACTIVE. Disabling File Generation & Drive Tools.');
        tools = [{ googleSearch: {} }];
      } else if (driveMode) {
        // MODE: Drive Mode ON -> Only Drive tools allowed
        console.log('[API Chat] Drive Mode IS ACTIVE. Enabling Drive Write Tools ONLY.');
        tools = driveTools;
      } else {
        // MODE: Standard -> File Generation Tools allowed
        console.log('[API Chat] Standard Mode. Enabling File Generation Tools.');
        tools = standardGenerationTools;
      }

      // --- KEYWORD HEURISTIC FORCED TOOL MODE ---
      // If user asks for a file/download, FORCE the model to use the tool (ANY mode).
      let toolMode = 'AUTO';
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg && lastUserMsg.role === 'user' && typeof lastUserMsg.content === 'string') {
        const lowerMsg = lastUserMsg.content.toLowerCase();
        // Updated keywords to be action-oriented to avoid false positives on "Analyze this file"
        const fileKeywords = ['scarica', 'download', 'crea un file', 'genera file', 'generate file', 'export', 'dammi il pdf', 'dammi il docx', 'dammi il json', 'voglio il file', 'aggiorna', 'modifica', 'update', 'sovrascrivi', 'save to drive', 'salva su drive'];
        if (!webResearch && fileKeywords.some(kw => lowerMsg.includes(kw))) {
          console.log('[API Chat] File intent detected in user query -> FORCING tool mode to ANY');
          toolMode = 'ANY';
        }
      }

      // --- 2. INITIAL GENERATION ---
      const generateOptions: any = {
        contents: coreMessages,
        tools: tools,
        // STRICT TOOL CONFIGURATION
        toolConfig: tools.length > 0 ? {
          functionCallingConfig: {
            mode: toolMode,
          }
        } : undefined,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemInstruction }]
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        generationConfig: {
          maxOutputTokens: 50000,
          temperature: req.body.temperature || 0.3
        }
      };

      // Tuned Models often have issues with tools/Search.
      // We keep this check but currently we are on base model so tools are active.
      const tunedOptions = { ...generateOptions };

      console.log('[DEBUG Chat] Payload prepared. Calling generateContent...');
      let result;
      try {
        const start = Date.now();
        result = await model.generateContent(tunedOptions);
        console.log(`[DEBUG Chat] generateContent returned in ${Date.now() - start}ms`);
      } catch (err: any) {
        console.error('Generation Error:', err);
        throw err;
      }

      let response = await result.response;

      // Log Finish Reason for debugging
      if (response.candidates && response.candidates.length > 0) {
        console.log('[DEBUG Chat] Finish Reason:', response.candidates[0].finishReason);
        if (response.candidates[0].safetyRatings) {
          console.log('[DEBUG Chat] Safety Ratings:', JSON.stringify(response.candidates[0].safetyRatings));
        }
      } else {
        console.warn('[DEBUG Chat] No candidates in response!', JSON.stringify(response));
      }

      // --- 3. TOOL EXECUTION LOOP ---
      // Handle function calls (multi-turn)
      let functionCalls = response.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall);

      const MAX_TOOL_LOOPS = 5;
      let loopCount = 0;

      while (functionCalls && functionCalls.length > 0) {
        loopCount++;
        console.log(`[API Chat] Tool Loop Iteration ${loopCount}/${MAX_TOOL_LOOPS}`);
        if (loopCount > MAX_TOOL_LOOPS) {
          console.warn('[API Chat] Max tool loops reached. Breaking to prevent infinite loop.');
          break;
        }

        console.log('[API Chat] Model requested function calls:', functionCalls.length);

        // Append the model's request (with function calls) to history
        // Note: coreMessages needs the FunctionCall part to be valid history
        // We reconstruct the last message to include the function call
        const modelCallParts = response.candidates![0].content.parts;
        coreMessages.push({ role: 'model', parts: modelCallParts });

        const functionResponses: any[] = [];

        for (const callPart of functionCalls) {
          const call = callPart.functionCall;
          console.log(`[API Chat] Executing tool: ${call.name}`);

          let toolResult = { error: 'Unknown tool' };

          try {
            const args = call.args;
            let filePath: string | null = null;

            if (call.name === 'update_drive_file') {
              const { fileId, newContent } = args as any;
              console.log(`[Tool Execution] Updating Drive File: ${fileId}`);
              const tokens = getGoogleTokens(req); // Get user tokens from request
              if (!tokens) throw new Error("Google Authentication required to update Drive files.");

              const result = await updateDriveFile(tokens, fileId, newContent);

              if (result.success) {
                toolResult = {
                  message: `File updated successfully in Google Drive. ID: ${result.id}.`
                } as any;
              } else {
                toolResult = {
                  message: `Failed to update file: ${result.error}` // Return error as message to model
                } as any;
              }
            } else if (call.name === 'update_sheet_cell_range') {
              const { fileId, range, values } = args as any;
              console.log(`[Tool Execution] Updating Sheet Range: ${fileId}, Range: ${range}`);
              const tokens = getGoogleTokens(req);
              if (!tokens) throw new Error("Google Authentication required to update Drive files.");

              // Call the new drive tool function
              const result = await updateSheetCellRange(tokens, fileId, range, values);

              if (result.success) {
                toolResult = {
                  message: `Sheet range updated successfully. ID: ${result.id}.`
                } as any;
              } else {
                toolResult = {
                  message: `Failed to update sheet range: ${result.error}`
                } as any;
              }
            } else if (call.name === 'create_drive_file') {
              const { fileName, content, folderId } = args as any;
              console.log(`[Tool Execution] Creating Drive File: ${fileName}`);
              const tokens = getGoogleTokens(req);
              if (!tokens) throw new Error("Google Authentication required to create Drive files.");

              const result = await createDriveFile(tokens, fileName, content, 'text/plain', folderId);

              if (result.success) {
                toolResult = {
                  message: `File created successfully in Google Drive. ID: ${result.id}. Link: ${result.webViewLink}`
                } as any;
              } else {
                toolResult = {
                  message: `Failed to create file: ${result.error}` // Return error as message
                } as any;
              }
            } else if (call.name === 'get_sheet_metadata') {
              const { fileId } = args as any;
              console.log(`[Tool Execution] Getting Sheet Metadata: ${fileId}`);
              const tokens = getGoogleTokens(req);
              if (!tokens) throw new Error("Authentication required.");

              const result = await getSheetMetadata(tokens, fileId);

              if (result.success) {
                toolResult = { metadata: result.metadata } as any;
              } else {
                toolResult = { message: `Failed to get metadata: ${result.error}` } as any;
              }
            } else if (call.name === 'update_sheet_metadata') {
              const { fileId, requests } = args as any;
              console.log(`[Tool Execution] Updating Sheet Metadata: ${fileId}`);
              const tokens = getGoogleTokens(req);
              if (!tokens) throw new Error("Authentication required.");

              const result = await updateSheetMetadata(tokens, fileId, requests);

              if (result.success) {
                toolResult = { message: `Sheet metadata updated successfully.` } as any;
              } else {
                toolResult = { message: `Failed to update metadata: ${result.error}` } as any;
              }
            } else if (call.name === 'generate_pdf') {
              const filePath = await generatePDF((args as any).content, (args as any).filename);
              console.log(`[Tool Execution] PDF Generated at ${filePath}`);
              const buffer = fs.readFileSync(filePath);
              const uploadResult = await uploadFile(buffer, path.basename(filePath), 'application/pdf');
              toolResult = {
                downloadUrl: uploadResult.publicUrl,
                message: `File generated successfully. Users can download it here: ${uploadResult.publicUrl}\n\nIMPORTANT: You MUST return this link to the user formatted as a Markdown link, like this:\n[${path.basename(filePath)}](${uploadResult.publicUrl})`
              } as any;
            } else if (call.name === 'generate_docx') {
              filePath = await generateDOCX((args as any).content, (args as any).filename);
            } else if (call.name === 'generate_md') {
              filePath = await generateMD((args as any).content, (args as any).filename);
            } else if (call.name === 'generate_jsonl') {
              filePath = await generateJSONL((args as any).data, (args as any).filename);
            }

            if (filePath) {
              const buffer = fs.readFileSync(filePath);
              const uploadResult = await uploadFile(buffer, path.basename(filePath), 'application/octet-stream');
              toolResult = {
                downloadUrl: uploadResult.publicUrl,
                message: `File generated successfully. Users can download it here: ${uploadResult.publicUrl}\n\nIMPORTANT: You MUST return this link to the user formatted as a Markdown link, like this:\n[${path.basename(filePath)}](${uploadResult.publicUrl})`
              } as any;
            }

          } catch (e: any) {
            console.error(`[API Chat] Tool execution failed:`, e);
            toolResult = { error: e.message };
          }

          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { result: toolResult }
            }
          });
        }

        // Append function responses to history
        coreMessages.push({ role: 'function', parts: functionResponses });

        // Call model again with updated history
        console.log('[API Chat] Sending tool outputs back to model...');
        tunedOptions.contents = coreMessages;

        // CRITICAL FIX: Reset toolConfig to AUTO (or remove the ANY constraint) so the model can speak!
        if (tunedOptions.toolConfig && tunedOptions.toolConfig.functionCallingConfig) {
          console.log('[API Chat] Resetting tool mode to AUTO for follow-up response.');
          tunedOptions.toolConfig.functionCallingConfig.mode = 'AUTO';
        }

        result = await model.generateContent(tunedOptions);
        response = await result.response;

        // Check for recursive calls (unlikely but possible)
        functionCalls = response.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall);
      }

      // --- 4. FINAL RESPONSE PROCESSING ---
      // (Standard text extraction)
      let text = '';
      let groundingMetadata = null;
      let searchEntryPoint = null;

      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          text = candidate.content.parts.map((p: any) => p.text || '').join('');
        }
        if (candidate.groundingMetadata) {
          groundingMetadata = candidate.groundingMetadata;
          if (groundingMetadata.searchEntryPoint?.renderedContent) {
            searchEntryPoint = groundingMetadata.searchEntryPoint.renderedContent;
          }
        }
      }


      let shortTitle = "";
      const titleMatch = text.match(/<short_title>([\s\S]*?)<\/short_title>/);
      if (titleMatch) {
        shortTitle = titleMatch[1].trim();
        text = text.replace(/<short_title>[\s\S]*?<\/short_title>/, "").trim();
      }

      res.json({ text, groundingMetadata, searchEntryPoint, shortTitle });

    } catch (error: any) {
      console.error('Errore durante chat:', error);
      res.status(500).json({ error: error.message || 'Errore durante chat' });
    }
  });


  // --- EXTRACT IDENTITY ENDPOINT ---
  app.post('/api/extract-identity', async (req: Request, res: Response) => {
    try {
      console.log('[API Identity] Extracting identity from memory file...');
      const { fileData, mimeType } = req.body;

      if (!fileData || !mimeType) {
        return res.status(400).json({ error: 'File data required' });
      }

      const project = process.env.GCP_PROJECT_ID;
      const location = 'europe-west1';
      const { VertexAI } = await import("@google-cloud/vertexai");

      let vertex_ai;
      if (vertexAICache && vertexAICache.project === project && vertexAICache.location === location) {
        vertex_ai = vertexAICache.client;
      } else {
        vertex_ai = new VertexAI({ project, location });
        vertexAICache = { client: vertex_ai, project: project!, location };
      }

      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: {
          role: 'system',
          parts: [{ text: "Sei un estrattore di entità. Il tuo UNICO scopo è leggere il documento e trovare il NOME e COGNOME della persona a cui appartiene o che ha scritto il documento. Restituisci SOLO un JSON valido." }]
        }
      });

      const prompt = `Analizza questo file di memoria personale.
      Estrai il NOME COMPLETO della persona.
      Restituisci un JSON in questo formato esatto:
      {
        "name": "Nome Cognome",
        "initial": "N"
      }
      Se non trovi nulla, restituisci null.`;

      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: fileData } }
          ]
        }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const response = await result.response;
      const text = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('');

      console.log('[API Identity] Extraction result:', text);

      let identity = null;
      if (text) {
        try {
          identity = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse identity JSON', e);
        }
      }

      res.json({ identity });

    } catch (error: any) {
      console.error('Error in Identity endpoint:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- MASTER ENDPOINT (Red Pin) ---
  app.post('/api/master', async (req: Request, res: Response) => {
    try {
      console.log('[API Master] Endpoint triggered (Red Pin Active)');
      const { messages, sources, temperature, webResearch } = req.body;

      // Placeholder for future Master Logic
      // Currently acts as a pass-through to Gemini 2.5 Flash with specific system context

      const project = process.env.GCP_PROJECT_ID;
      const location = 'europe-west1';
      const { VertexAI } = await import("@google-cloud/vertexai");

      let vertex_ai;
      if (vertexAICache && vertexAICache.project === project && vertexAICache.location === location) {
        vertex_ai = vertexAICache.client;
      } else {
        vertex_ai = new VertexAI({ project, location });
        vertexAICache = { client: vertex_ai, project: project!, location };
      }

      const model = vertex_ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: {
          role: 'system',
          parts: [{ text: "Sei il MASTER AI. Hai priorità assoluta sulla fonte pinnata. [LOGICA DA SVILUPPARE]" }]
        }
      });

      // Basic generation
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: messages?.[messages.length - 1]?.content || 'Hello' }] }],
        generationConfig: { temperature: 0.7 }
      });

      const response = await result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || 'Master Endpoint: No response.';

      res.json({ text, groundingMetadata: null, searchEntryPoint: null });

    } catch (error: any) {
      console.error('Error in Master endpoint:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
