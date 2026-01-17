
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';

/**
 * Updates an existing file in Google Drive with new content.
 * 
 * @param tokens - The user's OAuth2 tokens
 * @param fileId - The ID of the file to update
 * @param newContent - The new text content for the file
 * @param mimeType - The MIME type of the content (default: text/plain)
 */
export async function updateDriveFile(
    tokens: any,
    fileId: string,
    newContent: string,
    mimeType: string = 'text/plain'
): Promise<{ success: boolean; id?: string; webViewLink?: string; error?: string }> {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokens);

        const drive = google.drive({ version: 'v3', auth });

        // Check file type first
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType, name'
        });

        const currentMimeType = fileMetadata.data.mimeType;
        console.log(`[Drive Tool] Updating file ${fileId} (${currentMimeType})`);

        // Handle Google Docs specifically using Docs API
        if (currentMimeType === 'application/vnd.google-apps.document') {
            console.log(`[Drive Tool] Detected Google Doc. Switching to Docs API.`);
            const docs = google.docs({ version: 'v1', auth });

            // 1. Get document to determine bounds
            const doc = await docs.documents.get({ documentId: fileId });
            const content = doc.data.body?.content;
            if (!content || content.length === 0) throw new Error('Could not retrieve document content');

            // 2. Prepare batch update
            const lastIndex = content[content.length - 1].endIndex;
            const requests = [];

            // Delete existing content (preserve EOF marker)
            if (lastIndex && lastIndex > 2) {
                requests.push({
                    deleteContentRange: {
                        range: {
                            startIndex: 1,
                            endIndex: lastIndex - 1
                        }
                    }
                });
            }

            // Insert new content
            if (newContent.length > 0) {
                requests.push({
                    insertText: {
                        location: { index: 1 },
                        text: newContent
                    }
                });
            }

            if (requests.length > 0) {
                await docs.documents.batchUpdate({
                    documentId: fileId,
                    requestBody: { requests }
                });
            }

            return { success: true, id: fileId };
        }

        // Standard Drive File Update (Text, Binary, etc.)
        const media = {
            mimeType: mimeType,
            body: newContent
        };

        const response = await drive.files.update({
            fileId: fileId,
            media: media,
            fields: 'id, name, webViewLink, modifiedTime'
        });

        console.log(`[Drive Tool] File updated successfully: ${response.data.id}`);

        return {
            success: true,
            id: response.data.id || undefined,
            webViewLink: response.data.webViewLink || undefined
        };

    } catch (error: any) {
        console.error('[Drive Tool] Error updating file:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Downloads a file from Drive, handling Google Docs export logic.
 */
export async function downloadDriveFile(
    tokens: any,
    fileId: string
): Promise<{ buffer: Buffer; mimeType: string; name: string } | null> {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokens);
        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, size'
        });

        const mimeType = fileMetadata.data.mimeType || 'application/octet-stream';
        const fileName = fileMetadata.data.name || 'documento';

        let data: Buffer;
        let finalMimeType = mimeType;
        let finalFileName = fileName;

        if (mimeType === 'application/vnd.google-apps.document') {
            // Export Google Doc as text
            const exportRes = await drive.files.export({
                fileId: fileId,
                mimeType: 'text/plain'
            }, { responseType: 'arraybuffer' });
            data = Buffer.from(exportRes.data as ArrayBuffer);
            finalMimeType = 'text/plain';
            finalFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            // Export Google Sheet as XLSX
            const exportRes = await drive.files.export({
                fileId: fileId,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }, { responseType: 'arraybuffer' });
            data = Buffer.from(exportRes.data as ArrayBuffer);
            finalMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            finalFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
        } else {
            // Download binary file
            const downloadRes = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'arraybuffer' });
            data = Buffer.from(downloadRes.data as ArrayBuffer);
        }

        return {
            buffer: data,
            mimeType: finalMimeType,
            name: finalFileName
        };
    } catch (error) {
        console.error(`[Drive Tool] Failed to download file ${fileId}:`, error);
        return null;
    }
}

/**
 * Creates a NEW file in Google Drive.
 * 
 * @param tokens - The user's OAuth2 tokens
 * @param fileName - Name of the file to create
 * @param content - Content of the file
 * @param mimeType - MIME Type (default: text/plain)
 * @param parentFolderId - Optional folder ID to place the file in
 */
export async function createDriveFile(
    tokens: any,
    fileName: string,
    content: string,
    mimeType: string = 'text/plain',
    parentFolderId?: string
): Promise<{ success: boolean; id?: string; webViewLink?: string; error?: string }> {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokens);

        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata: any = {
            name: fileName,
        };

        if (parentFolderId) {
            fileMetadata.parents = [parentFolderId];
        }

        const media = {
            mimeType: mimeType,
            body: content
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink'
        });

        console.log(`[Drive Tool] File created successfully: ${response.data.id}`);

        return {
            success: true,
            id: response.data.id || undefined,
            webViewLink: response.data.webViewLink || undefined
        };

    } catch (error: any) {
        console.error('[Drive Tool] Error creating file:', error);
        return { success: false, error: error.message };
    }
}
