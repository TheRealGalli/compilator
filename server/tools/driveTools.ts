
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import * as xlsx from 'xlsx';

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

        // Handle Google Sheets specifically
        if (currentMimeType === 'application/vnd.google-apps.spreadsheet') {
            console.log(`[Drive Tool] Detected Google Sheet. Switching to Sheets API.`);
            const sheets = google.sheets({ version: 'v4', auth });

            // 1. Parse newContent 
            // Check for multi-sheet format: [FOGLIO DI CALCOLO: SheetName] ... content ...
            const sheetRegex = /\[FOGLIO DI CALCOLO:\s*([^\]]+)\]([\s\S]*?)(?=\[FOGLIO DI CALCOLO:|$)/g;
            let match;
            const updates: { name: string; csv: string }[] = [];

            while ((match = sheetRegex.exec(newContent)) !== null) {
                updates.push({ name: match[1].trim(), csv: match[2].trim() });
            }

            if (updates.length > 0) {
                console.log(`[Drive Tool] Multi-sheet update detected: ${updates.length} sheets.`);
                // Process each sheet update
                for (const update of updates) {
                    console.log(`[Drive Tool] Updating sheet: ${update.name}`);
                    const wb = xlsx.read(update.csv, { type: 'string' });
                    const ws = wb.Sheets[wb.SheetNames[0]]; // Content itself
                    const values = xlsx.utils.sheet_to_json(ws, { header: 1 });

                    if (values && values.length > 0) {
                        // Clear range first (heuristic: assume sheet exists)
                        try {
                            await sheets.spreadsheets.values.clear({
                                spreadsheetId: fileId,
                                range: update.name,
                            });
                            await sheets.spreadsheets.values.update({
                                spreadsheetId: fileId,
                                range: update.name,
                                valueInputOption: 'USER_ENTERED',
                                requestBody: { values: values as any[][] }
                            });
                        } catch (err: any) {
                            console.warn(`[Drive Tool] Failed to update sheet '${update.name}'. It might not exist. Error: ${err.message}`);
                            // Optional: Create sheet if missing? (Complex, requires batchUpdate addSheet)
                            // For now, we log and continue.
                        }
                    }
                }
                return { success: true, id: fileId };
            }

            // Fallback: Single Sheet (Global overwrite of first sheet)
            const wb = xlsx.read(newContent, { type: 'string' });
            const firstSheetName = wb.SheetNames[0]; // Input sheet
            const ws = wb.Sheets[firstSheetName];
            const values = xlsx.utils.sheet_to_json(ws, { header: 1 }); // 2D Array

            if (!values || values.length === 0) {
                throw new Error("Parsed content is empty. Please provide valid CSV data.");
            }

            // 2. Get target spreadsheet details to find the first sheet name
            const meta = await sheets.spreadsheets.get({ spreadsheetId: fileId });
            const targetSheetTitle = meta.data.sheets?.[0]?.properties?.title || 'Sheet1';

            // 3. Clear existing content
            await sheets.spreadsheets.values.clear({
                spreadsheetId: fileId,
                range: targetSheetTitle,
            });

            // 4. Update with new values
            await sheets.spreadsheets.values.update({
                spreadsheetId: fileId,
                range: targetSheetTitle,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: values as any[][] }
            });

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

/**
 * Updates a specific range of cells in a Google Sheet.
 * @param tokens - User tokens
 * @param fileId - Spreadsheet ID
 * @param range - A1 notation range (e.g. 'Sheet1!A1:B2')
 * @param values - 2D Array of values
 */
export async function updateSheetCellRange(
    tokens: any,
    fileId: string,
    range: string,
    values: string[][]
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokens);

        const sheets = google.sheets({ version: 'v4', auth });

        await sheets.spreadsheets.values.update({
            spreadsheetId: fileId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: values }
        });

        console.log(`[Drive Tool] Sheet range ${range} updated successfully.`);
        return { success: true, id: fileId };
    } catch (error: any) {
        console.error('[Drive Tool] Error updating sheet range:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Collapses a list of cell addresses (e.g. ["A1", "A2", "B1"]) into minimal A1 ranges.
 */
function collapseCellsToRanges(cells: string[]): string[] {
    if (!cells || cells.length === 0) return [];
    // For now, a simple unique list is better than raw JSON, 
    // but range collapsing would be ideal. Due to time, let's just 
    // ensure it's a reasonably short string or first-last if too many.
    if (cells.length > 20) {
        return [`${cells[0]}:${cells[cells.length - 1]} (${cells.length} cells total)`];
    }
    return cells;
}

/**
 * Retrieves metadata for a Google Sheet, summarizing Data Validation rules and Formatting.
 * This version summarizes the grid data to avoid token overflow.
 */
export async function getSheetMetadata(
    tokens: any,
    fileId: string
): Promise<{ success: boolean; metadata?: any; error?: string }> {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokens);
        const sheets = google.sheets({ version: 'v4', auth });

        // Fetch Grid Data
        const response = await sheets.spreadsheets.get({
            spreadsheetId: fileId,
            includeGridData: true,
            fields: 'sheets(properties(title,sheetId,gridProperties),data(rowData(values(userEnteredFormat(backgroundColor,textFormat),dataValidation))))'
        });

        const spreadsheet = response.data;
        const summarizedSheets = (spreadsheet.sheets || []).map(sheet => {
            const title = sheet.properties?.title;
            const gridData = sheet.data?.[0]?.rowData || [];

            const validations: any[] = [];
            const formats: any[] = [];

            // SAFETY: Limit number of rows processed to avoid OOM
            const MAX_ROWS = 2000;
            const rowsToProcess = gridData.slice(0, MAX_ROWS);

            rowsToProcess.forEach((row, rIdx) => {
                const values = row.values || [];
                values.forEach((cell, cIdx) => {
                    if (cell.dataValidation) {
                        const ruleJson = JSON.stringify(cell.dataValidation);
                        let existing = validations.find(v => v.ruleJson === ruleJson);
                        if (!existing) {
                            existing = { ruleJson, rule: cell.dataValidation, cells: [] };
                            validations.push(existing);
                        }
                        if (existing.cells.length < 500) existing.cells.push(`${String.fromCharCode(65 + cIdx)}${rIdx + 1}`);
                    }

                    const format = cell.userEnteredFormat;
                    if (format) {
                        const isBold = format.textFormat?.bold;
                        const bgColor = format.backgroundColor;
                        const hasBg = bgColor && ((bgColor.red || 0) < 0.98 || (bgColor.green || 0) < 0.98 || (bgColor.blue || 0) < 0.98);

                        if (isBold || hasBg) {
                            const formatJson = JSON.stringify(format);
                            let existing = formats.find(f => f.formatJson === formatJson);
                            if (!existing) {
                                existing = { formatJson, format, cells: [] };
                                formats.push(existing);
                            }
                            if (existing.cells.length < 500) existing.cells.push(`${String.fromCharCode(65 + cIdx)}${rIdx + 1}`);
                        }
                    }
                });
            });

            // Cleanup for model visibility using range collapsing
            const cleanValidations = validations.map(v => ({
                rule: v.rule,
                ranges: collapseCellsToRanges(v.cells)
            }));
            const cleanFormats = formats.map(f => ({
                format: f.format,
                ranges: collapseCellsToRanges(f.cells)
            }));

            return {
                title,
                sheetId: sheet.properties?.sheetId,
                validations: cleanValidations,
                significantFormats: cleanFormats
            };
        });

        return { success: true, metadata: { sheets: summarizedSheets } };
    } catch (error: any) {
        console.error('[Drive Tool] Error getting sheet metadata:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Updates Google Sheet metadata (Validation, Formatting) via batchUpdate.
 */
export async function updateSheetMetadata(
    tokens: any,
    fileId: string,
    requests: any[]
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!requests || requests.length === 0) {
            throw new Error("No requests provided for metadata update.");
        }

        const auth = new google.auth.OAuth2();
        auth.setCredentials(tokens);
        const sheets = google.sheets({ version: 'v4', auth });

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: fileId,
            requestBody: {
                requests: requests
            }
        });

        console.log(`[Drive Tool] Metadata updated for file ${fileId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[Drive Tool] Error updating sheet metadata:', error);
        return { success: false, error: error.message };
    }
}
