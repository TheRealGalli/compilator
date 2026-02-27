import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs/promises';
import { Readable } from 'stream';
import type { ChunkedDocument } from './rag-utils';
import { randomUUID } from 'crypto';

// Branching Logic: GCS vs Local
const STORAGE_MODE = process.env.STORAGE_MODE || 'gcs';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// GCS Client (only if mode is gcs)
const storage = STORAGE_MODE === 'gcs' ? new Storage() : null;

// Nome del bucket (configurabile via env, altrimenti usa il project ID come base)
const getBucketName = () => {
  if (process.env.GCP_STORAGE_BUCKET) return process.env.GCP_STORAGE_BUCKET;
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'gromit';
  return `${projectId}-gromit-docs`.toLowerCase();
};

let BUCKET_NAME = STORAGE_MODE === 'gcs' ? getBucketName() : '';

export interface FileUploadResult {
  fileName: string;
  publicUrl: string;
  gcsPath: string;
}

/**
 * Inizializza lo storage: crea il bucket (GCS) o la cartella (Local)
 */
export async function initializeGcs(): Promise<void> {
  if (STORAGE_MODE === 'local') {
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      console.log(`[Storage] Local mode active. Directory: ${UPLOADS_DIR}`);
    } catch (error) {
      console.error('[Storage] Error creating local uploads directory:', error);
    }
    return;
  }

  // GCS Logic
  if (!storage) return;
  try {
    const projectId = await storage.getProjectId();
    if (!process.env.GCP_STORAGE_BUCKET) {
      BUCKET_NAME = `${projectId}-gromit-docs`.toLowerCase();
    }

    const bucket = storage.bucket(BUCKET_NAME);
    const [exists] = await bucket.exists();

    if (!exists) {
      console.log(`[GCS] Creating bucket: ${BUCKET_NAME}...`);
      await storage.createBucket(BUCKET_NAME, {
        location: 'EU',
        storageClass: 'STANDARD',
      });
    }

    console.log(`[GCS] Configuring lifecycle policy for bucket: ${BUCKET_NAME}`);
    await bucket.setMetadata({
      lifecycle: {
        rule: [
          {
            action: { type: 'Delete' },
            condition: { age: 1 },
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
 * Carica un file
 */
export async function uploadFile(
  fileBuffer: Buffer,
  originalFileName: string,
  contentType?: string,
): Promise<FileUploadResult> {
  const fileExtension = originalFileName.split('.').pop() || '';
  const uniqueFileName = `${randomUUID()}.${fileExtension}`;
  const filePath = `uploads/${uniqueFileName}`;

  if (STORAGE_MODE === 'local') {
    const fullPath = path.join(UPLOADS_DIR, uniqueFileName);
    await fs.writeFile(fullPath, fileBuffer);

    // In local mode, we return a relative URL or a placeholder
    return {
      fileName: originalFileName,
      publicUrl: `/api/files/${filePath}`,
      gcsPath: filePath,
    };
  }

  // GCS Mode
  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(filePath);

  await file.save(fileBuffer, {
    metadata: { contentType: contentType || 'application/octet-stream' },
    public: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return {
    fileName: originalFileName,
    publicUrl: signedUrl,
    gcsPath: filePath,
  };
}

/**
 * Carica un file in un percorso specifico
 */
export async function uploadFileToPath(
  fileBuffer: Buffer,
  filePath: string,
  contentType?: string,
): Promise<string> {
  if (STORAGE_MODE === 'local') {
    const fileName = path.basename(filePath);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    await fs.writeFile(fullPath, fileBuffer);
    return filePath;
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(filePath);
  await file.save(fileBuffer, {
    metadata: { contentType: contentType || 'application/octet-stream' },
    public: false,
  });
  return filePath;
}

/**
 * Scarica un file
 */
export async function downloadFile(filePath: string): Promise<Buffer> {
  if (STORAGE_MODE === 'local') {
    const fileName = path.basename(filePath);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    return await fs.readFile(fullPath);
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(filePath);
  const [buffer] = await file.download();
  return buffer;
}

/**
 * Elimina un file
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (STORAGE_MODE === 'local') {
    const fileName = path.basename(filePath);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    try {
      await fs.unlink(fullPath);
    } catch (e) {
      console.warn(`[Storage] Failed to delete local file: ${fullPath}`);
    }
    return;
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(filePath);
  await file.delete();
}

/**
 * Verifica se un file esiste
 */
export async function fileExists(filePath: string): Promise<boolean> {
  if (STORAGE_MODE === 'local') {
    const fileName = path.basename(filePath);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(filePath);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Lista i file
 */
export async function listFiles(prefix: string = 'uploads/'): Promise<any[]> {
  if (STORAGE_MODE === 'local') {
    try {
      const files = await fs.readdir(UPLOADS_DIR);
      return await Promise.all(files.map(async (fileName) => {
        const fullPath = path.join(UPLOADS_DIR, fileName);
        const stats = await fs.stat(fullPath);
        return {
          name: fileName,
          gcsPath: `uploads/${fileName}`,
          size: stats.size,
          timeCreated: stats.birthtime,
          publicUrl: `/api/files/uploads/${fileName}`,
        };
      }));
    } catch (e) {
      return [];
    }
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const [files] = await bucket.getFiles({ prefix });

  return Promise.all(files.map(async (file) => {
    const [metadata] = await file.getMetadata();
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return {
      name: file.name.replace(prefix, ''),
      gcsPath: file.name,
      size: metadata.size,
      contentType: metadata.contentType,
      timeCreated: metadata.timeCreated,
      publicUrl: signedUrl,
    };
  }));
}

/**
 * Salva i chunks di un documento
 */
export async function saveDocumentChunks(
  filePath: string,
  chunkedDocument: ChunkedDocument
): Promise<void> {
  const jsonContent = JSON.stringify(chunkedDocument, null, 2);
  const chunksPath = `${filePath}.chunks.json`;

  if (STORAGE_MODE === 'local') {
    const fileName = path.basename(chunksPath);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    await fs.writeFile(fullPath, jsonContent);
    return;
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(chunksPath);
  await file.save(jsonContent, {
    contentType: 'application/json',
    metadata: { cacheControl: 'public, max-age=3600' },
  });
}

/**
 * Carica i chunks di un documento
 */
export async function loadDocumentChunks(
  filePath: string
): Promise<ChunkedDocument | null> {
  const chunksPath = `${filePath}.chunks.json`;

  if (STORAGE_MODE === 'local') {
    const fileName = path.basename(chunksPath);
    const fullPath = path.join(UPLOADS_DIR, fileName);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  const bucket = storage!.bucket(BUCKET_NAME);
  const file = bucket.file(chunksPath);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [buffer] = await file.download();
  return JSON.parse(buffer.toString('utf-8'));
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
