Compilator Server (Express + TypeScript)
========================================

API per:
- Estrazione testo da documenti (PDF, DOCX, XLSX, immagini via OCR)
- Analisi multi-documento (fino a 10)
- Compilazione documento (1 template opzionale + fino a 9 fonti) con generazione DOCX
- Integrazioni Excel (credenziali + fetch remoto)

Setup locale
------------
1) Requisiti: Node.js >= 18
2) Installazione
   npm install
3) Variabili ambiente (crea un .env)
   PORT=8787
   CORS_ORIGIN=http://localhost:5173
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   OCR_LANGS=eng+ita
4) Dev
   npm run dev

Endpoint principali
-------------------
- GET /api/health
- POST /api/files/extract (multipart/form-data: files[])
- POST /api/analyze (JSON: { task?, documents: [{name,text}] })
- POST /api/compile (JSON: { instructions?, template?, sources, outputFormat? })
- POST /api/integrations/excel/credentials (JSON: { headerName?, apiKey? })
- POST /api/integrations/excel/fetch (JSON: { url, extraHeaders? })

Provider LLM
------------
Di default usa OpenAI. Per usare Gemini (Vertex AI) su GCP:

1) Imposta variabili:
   LLM_PROVIDER=vertex
   GCP_PROJECT=your-project-id
   GCP_LOCATION=us-central1   # o europe-west8, ecc.
   VERTEX_MODEL=gemini-1.5-pro  # opzionale

2) Autenticazione:
   In Cloud Run usa il service account del servizio con permesso Vertex AI User.
   In locale, `gcloud auth application-default login` oppure set di credenziali con GOOGLE_APPLICATION_CREDENTIALS.

Build & Run con Docker (per Cloud Run)
--------------------------------------
docker build -t gcr.io/PROJECT_ID/compilator-server:latest .
docker push gcr.io/PROJECT_ID/compilator-server:latest

Deploy Cloud Run:
- Porta 8080
- Imposta env OPENAI_API_KEY, OPENAI_MODEL, OCR_LANGS, CORS_ORIGIN
- Esempio comandi (gcloud):
  gcloud run deploy compilator-server \
    --image gcr.io/PROJECT_ID/compilator-server:latest \
    --platform managed \
    --region europe-west8 \
    --allow-unauthenticated \
    --port 8080 \
    --set-env-vars "OPENAI_MODEL=gpt-4o-mini,OCR_LANGS=eng+ita,CORS_ORIGIN=https://<username>.github.io" \
    --set-secrets "OPENAI_API_KEY=projects/PROJECT_NUMBER/secrets/OPENAI_API_KEY:latest"

Note su CORS:
- Impostare CORS_ORIGIN all'origin esatto del frontend (es. https://<username>.github.io oppure https://<username>.github.io/<repo>)
- Per test locali: CORS_ORIGIN=http://localhost:5173

Secret Manager (consigliato):
- Creare il secret OPENAI_API_KEY in Google Secret Manager
- Collegarlo come variabile segreta in Cloud Run (`--set-secrets OPENAI_API_KEY=...`)

