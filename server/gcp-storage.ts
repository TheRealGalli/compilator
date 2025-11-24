import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

// Inizializza il client Storage di GCP
// Se non è fornito un path per le credenziali, usa le credenziali di default dell'ambiente
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE, // Opzionale, se non fornito usa Application Default Credentials
});

// Nome del bucket (configurabile via env)
const BUCKET_NAME = process.env.GCP_STORAGE_BUCKET || 'notebooklm-compiler-files';

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

