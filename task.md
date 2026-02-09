# Task List: Ecosystem-Wide Client-Side Extraction

- [ ] **Infrastructure Setup**
    - [ ] Create `client/src/lib/extraction.ts` with robust PDF, DOCX, XLSX parsers.
    - [ ] Verify `pdfjs-dist` worker configuration for performance.

- [ ] **Feature Migration: Pawn Guardrail** (Priority 1)
    - [ ] Update `DocumentCompilerSection.tsx` to use local extraction.
    - [ ] Remove `/api/pawn-extract` calls.

- [ ] **Feature Migration: Chat & RAG** (Priority 2)
    - [ ] Identify where files are uploaded for chat/RAG (likely `DragDrop` or file input components).
    - [ ] Intercept file uploads to extract text LOCALLY before sending to `server/rag-utils` or storage.
    - [ ] Ensure RAG indexing uses the client-extracted text instead of re-processing on server.

- [ ] **Backend Cleanup**
    - [ ] **DELETE** `/api/pawn-extract` endpoint.
    - [ ] **REMOVE** or **DEPRECATE** server-side `extractText` function in `server/routes.ts` (unless needed for legacy fallback).

- [ ] **Verification**
    - [ ] Verify Pawn flow (GDPR/Privacy check).
    - [ ] Verify Chat/RAG flow (Knowledge retrieval).
    - [ ] Stress test with large PDFs (client-side performance check).
