Compilator
==========

Versione stile NotebookLM con due modalità:
- Analisi: carica fino a 10 documenti (PDF, DOCX, XLSX, immagini OCR) e ottieni un'analisi strutturata via LLM.
- Compilazione: usa 1 template opzionale + fino a 9 fonti per compilare un documento (download DOCX o anteprima testo/markdown).

Architettura
------------
- server/ (Express + TypeScript): estrazione testi, integrazione OpenAI Responses API, generazione DOCX, integrazioni Excel.
- frontend/ (Vite + React + TS): UI/UX con 3 sezioni (Analisi, Compilazione, Integrazioni).

Prerequisiti
------------
- Node.js >= 18
- Chiave OpenAI: `OPENAI_API_KEY`

Setup Server
------------
1) cd server
2) npm install
3) Crea un file `.env` con:
   PORT=8787
   CORS_ORIGIN=http://localhost:5173
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   OCR_LANGS=eng+ita
4) npm run dev

Setup Frontend
--------------
1) cd frontend
2) npm install
3) Crea un file `.env` con (opzionale):
   VITE_SERVER_URL=http://localhost:8787
4) npm run dev (apre su http://localhost:5173)

Cloud Run (Server)
------------------
Build:
  cd server
  docker build -t gcr.io/PROJECT_ID/compilator-server:latest .
  docker push gcr.io/PROJECT_ID/compilator-server:latest
Deploy:
- Porta 8080, variabili OPENAI_API_KEY, OPENAI_MODEL, OCR_LANGS, CORS_ORIGIN impostate

Note Funzionali
---------------
- OCR: usa Tesseract.js (variabile `OCR_LANGS` per lingue, es. eng+ita).
- DOCX: generato lato server; in modalità "docx" il download parte direttamente.
- Integrazioni Excel: puoi salvare un header e api key; importare un Excel remoto via URL.

GitHub Pages (Frontend)
-----------------------
- Router: configurato con HashRouter (non servono rewrites 404 su Pages).
- `frontend/vite.config.ts` legge `VITE_BASE` per il base path (default `/`).
- Workflow incluso: `.github/workflows/deploy-frontend.yml`

Passi:
1) Imposta nelle Repository Variables:
   - `VITE_SERVER_URL`: URL del backend su Cloud Run (es. `https://compilator-xxxxx-a.run.app`)
   - `VITE_BASE`: `/<REPO_NAME>/` (es. `/Compilator/`) oppure lascia vuoto per `/`
2) Su Cloud Run configura CORS:
   - `CORS_ORIGIN`: `https://<username>.github.io` oppure `https://<username>.github.io/<REPO_NAME>`
3) Abilita GitHub Pages → Build and deployment → Source: GitHub Actions
4) Push su `main` (o usa azione manuale) → il workflow pubblica `frontend/dist`

