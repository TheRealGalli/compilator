import { Storage } from '@google-cloud/storage';
import path from 'path';
import { Readable } from 'stream';
import type { ChunkedDocument } from './rag-utils';
import { randomUUID } from 'crypto';

// Inizializza il client Storage di GCP
// Usa Application Default Credentials (ADC) - su Cloud Run rileva automaticamente il progetto
const storage = new Storage();

// Nome del bucket (configurabile via env, altrimenti usa il project ID come base)
const getBucketName = () => {
  if (process.env.GCP_STORAGE_BUCKET) return process.env.GCP_STORAGE_BUCKET;
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'gromit';
  return `${projectId}-gromit-docs`.toLowerCase();
};

let BUCKET_NAME = getBucketName();

export interface FileUploadResult {
  fileName: string;
  publicUrl: string;
  gcsPath: string;
}

/**
 * Carica un file su Google Cloud Storage
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalFileName: string,
  contentType?: string,
): Promise<FileUploadResult> {
  const bucket = storage.bucket(BUCKET_NAME);

  // Genera un nome file univoco
  const fileExtension = originalFileName.split('.').pop() || '';
  const uniqueFileName = `${randomUUID()}.${fileExtension}`;
  const gcsPath = `uploads/${uniqueFileName}`;

  const file = bucket.file(gcsPath);

  // Carica il file
  await file.save(fileBuffer, {
    metadata: {
      contentType: contentType || 'application/octet-stream',
    },
    public: false, // I file sono privati per default
  });

  // Genera un URL firmato valido per 7 giorni
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 giorni
  });

  return {
    fileName: originalFileName,
    publicUrl: signedUrl,
    gcsPath,
  };
}

/**
 * Inizializza il bucket: lo crea se non esiste e configura il lifecycle.
 * Questo viene chiamato all'avvio del server.
 */
export async function initializeGcs(): Promise<void> {
  try {
    // Aggiorna BUCKET_NAME caso mai il progetto sia stato rilevato dopo
    const projectId = await storage.getProjectId();
    if (!process.env.GCP_STORAGE_BUCKET) {
      BUCKET_NAME = `${projectId}-gromit-docs`.toLowerCase();
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const [exists] = await bucket.exists();

    if (!exists) {
      console.log(`[GCS] Creating bucket: ${BUCKET_NAME}...`);
      await storage.createBucket(BUCKET_NAME, {
        location: 'EU', // Può essere reso configurabile
        storageClass: 'STANDARD',
      });
    }

    console.log(`[GCS] Configuring lifecycle policy for bucket: ${BUCKET_NAME}`);
    await bucket.setMetadata({
      lifecycle: {
        rule: [
          {
            action: { type: 'Delete' },
            condition: { age: 1 }, // 1 giorno di retention per i file temporanei
          },
        ],
      },
    });
    console.log(`[GCS] Storage initialized successfully.`);
  } catch (error) {
    console.error('[GCS] Error initializing storage:', error);
  }
}

/**
 * Carica un file su Google Cloud Storage in un percorso specifico
 */
export async function uploadFileToPath(
  fileBuffer: Buffer,
  gcsPath: string,
  contentType?: string,
): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  await file.save(fileBuffer, {
    metadata: {
      contentType: contentType || 'application/octet-stream',
    },
    public: false,
  });

  return gcsPath;
}

/**
 * Scarica un file da Google Cloud Storage
 */
export async function downloadFile(gcsPath: string): Promise<Buffer> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  const [buffer] = await file.download();
  return buffer;
}

/**
 * Elimina un file da Google Cloud Storage
 */
export async function deleteFile(gcsPath: string): Promise<void> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  await file.delete();
}

/**
 * Verifica se un file esiste
 */
export async function fileExists(gcsPath: string): Promise<boolean> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  const [exists] = await file.exists();
  return exists;
}

/**
 * Lista i file nel bucket
 */
export async function listFiles(prefix: string = 'uploads/'): Promise<any[]> {
  const bucket = storage.bucket(BUCKET_NAME);
  const [files] = await bucket.getFiles({ prefix });

  return Promise.all(files.map(async (file) => {
    const [metadata] = await file.getMetadata();
    // Genera signed URL per download/preview
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 giorni
    });

    return {
      name: file.name.replace(prefix, ''), // Nome file pulito
      gcsPath: file.name,
      size: metadata.size,
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      publicUrl: signedUrl,
    };
  }));
}

/**
 * Salva i chunks di un documento su GCS
 */
export async function saveDocumentChunks(
  gcsPath: string,
  chunkedDocument: ChunkedDocument
): Promise<void> {
  const bucket = storage.bucket(BUCKET_NAME);
  const chunksPath = `${gcsPath}.chunks.json`;
  const file = bucket.file(chunksPath);

  const jsonContent = JSON.stringify(chunkedDocument, null, 2);
  await file.save(jsonContent, {
    contentType: 'application/json',
    metadata: {
      cacheControl: 'public, max-age=3600',
    },
  });
}

/**
 * Carica i chunks di un documento da GCS
 */
export async function loadDocumentChunks(
  gcsPath: string
): Promise<ChunkedDocument | null> {
  const bucket = storage.bucket(BUCKET_NAME);
  const chunksPath = `${gcsPath}.chunks.json`;
  const file = bucket.file(chunksPath);

  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }

  const [buffer] = await file.download();
  const chunkedDocument: ChunkedDocument = JSON.parse(buffer.toString('utf-8'));
  return chunkedDocument;
}

/**
 * Carica i chunks da più documenti
 */
export async function loadMultipleDocumentChunks(
  gcsPaths: string[]
): Promise<ChunkedDocument[]> {
  const promises = gcsPaths.map(path => loadDocumentChunks(path));
  const results = await Promise.all(promises);
  return results.filter((doc): doc is ChunkedDocument => doc !== null);
}
