# Implementation Plan: Client-Side Extraction Migration
Goal: Move file text extraction logic from the server to the client browser to ensure raw PII never leaves the user's device during the "Pawn" guardrail check.

## User Review Required
> [!IMPORTANT]
> This change will remove the `/api/pawn-extract` endpoint and add client-side dependencies (`pdfjs-dist`, `mammoth`, `xlsx`) to the frontend bundle. This increases the initial load size slightly but guarantees privacy.

## Proposed Changes

### Client-Side (Frontend)
#### [NEW] `client/src/lib/extraction.ts`
- Implement `extractTextClient(file: File): Promise<string>`
- Use `pdfjs-dist` for PDFs (ensure worker is loaded from CDN or local public assets to avoid webpack issues)
- Use `mammoth` for DOCX (standard browser usage)
- Use `xlsx` for Excel (standard browser usage)
- **Goal**: Unified extraction utility for the entire app.

#### [MODIFY] `client/src/components/DocumentCompilerSection.tsx`
- Replace `/api/pawn-extract` with `extractTextClient`.
- Ensure "Pawn" guardrail uses purely local text.

#### [MODIFY] `client/src/components/ChatInterface.tsx` (or equivalent file upload area)
- Ensure file uploads for Chat/RAG also utilize `extractTextClient`.
- If the app uploads files for RAG, send the *extracted text* alongside the file (or instead of relying on server extraction).

### Server-Side (Backend)
#### [MODIFY] `server/routes.ts` & `server/rag-utils.ts`
- **DELETE** `/api/pawn-extract`.
- **REFACTOR** RAG ingestion endpoints to accept client-provided text if available, bypassing server-side parsing.
- Keep server-side `extractText` ONLY as a fallback for API-based ingestion (if any), otherwise remove to enforcing Zero-Data.

## Verification Plan
### Automated Tests
- N/A (Manual feature verification focused)

### Manual Verification
1. **PDF Test**: Upload a PDF with sensitive data. Activate "Pedone". Compile. Verify console logs show "Client-Side Extraction" and NO network call to `/api/pawn-extract`.
2. **DOCX Test**: Repeat with a Word doc.
3. **XLSX Test**: Repeat with an Excel file.
4. **Network Tab**: Confirm no file upload occurs during the "Analyzing..." phase.
