
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

        // 1. Update file metadata (optional, e.g. name, but here we just update content)
        // 2. Update file media
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
