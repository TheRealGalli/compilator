# NotebookLM Compiler

Applicazione web per la compilazione di documenti con AI, ispirata a Google NotebookLM.

## Architettura

- **Frontend**: React + Vite, deployato su GitHub Pages
- **Backend**: Express.js, deployato su Google Cloud Run
- **Storage**: Google Cloud Storage per i file
- **Secrets**: Google Secret Manager per le chiavi API

## Setup Locale

### Prerequisiti

- Node.js 20+
- Account Google Cloud Platform con progetto configurato
- Credenziali GCP configurate (Application Default Credentials o service account key)

### Installazione

```bash
npm install
```

### Variabili d'Ambiente

Crea un file `.env` nella root del progetto:

```env
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_STORAGE_BUCKET=notebooklm-compiler-files
GCP_KEY_FILE=path/to/service-account-key.json  # Opzionale se usi ADC

# Frontend (per sviluppo locale)
VITE_API_URL=http://localhost:5000/api

# Backend
PORT=5000
NODE_ENV=development
```

### Setup GCP

1. **Crea un bucket Cloud Storage**:
```bash
gsutil mb -p your-project-id -l europe-west1 gs://notebooklm-compiler-files
```

2. **Crea i secrets per le chiavi API**:
```bash
# Per OpenAI
echo -n "your-openai-api-key" | gcloud secrets create MODEL_API_KEY_OPENAI --data-file=-
```

3. **Configura le autorizzazioni**:
   - Il service account deve avere i ruoli:
     - `roles/storage.objectAdmin` per Cloud Storage
     - `roles/secretmanager.secretAccessor` per Secret Manager

### Sviluppo Locale

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend (in un altro terminale)
cd client
npm run dev
```

## Deploy

### Frontend su GitHub Pages

Il frontend viene deployato automaticamente su GitHub Pages tramite GitHub Actions quando fai push su `main`.

**Configurazione GitHub Pages**:
1. Vai su Settings > Pages nel tuo repository
2. Seleziona "GitHub Actions" come source
3. Il workflow `.github/workflows/deploy-frontend.yml` gestirà il deploy

**Variabili d'ambiente per il build**:
- `VITE_CLOUD_RUN_URL`: URL del backend su Cloud Run (es. `https://notebooklm-compiler-xxx.run.app`)

### Backend su Google Cloud Run

#### Prerequisiti

1. **Abilita le API necessarie**:
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

2. **Configura GitHub Secrets**:
   - `GCP_PROJECT_ID`: Il tuo Project ID GCP
   - `GCP_SA_KEY`: JSON del service account con permessi per Cloud Build e Cloud Run

3. **Crea un service account per Cloud Build**:
```bash
gcloud iam service-accounts create cloud-build-sa \
  --display-name="Cloud Build Service Account"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:cloud-build-sa@your-project-id.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:cloud-build-sa@your-project-id.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

#### Deploy Automatico

Il backend viene deployato automaticamente quando fai push su `main` e modifichi file nel server.

Il workflow `.github/workflows/deploy-backend.yml`:
1. Builda l'immagine Docker
2. La pusha su Container Registry
3. Deploya su Cloud Run

#### Deploy Manuale

```bash
# Build e push dell'immagine
gcloud builds submit --config=cloudbuild.yaml

# Oppure deploy diretto
gcloud run deploy notebooklm-compiler \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=your-project-id,GCP_STORAGE_BUCKET=notebooklm-compiler-files
```

## Struttura del Progetto

```
.
├── client/              # Frontend React
│   └── src/
│       ├── components/  # Componenti React
│       ├── lib/         # Utilities e configurazione API
│       └── pages/       # Pagine
├── server/              # Backend Express
│   ├── routes.ts        # Route API
│   ├── gcp-storage.ts   # Integrazione Cloud Storage
│   └── gcp-secrets.ts   # Integrazione Secret Manager
├── shared/              # Codice condiviso
├── .github/workflows/   # GitHub Actions workflows
├── Dockerfile          # Immagine Docker per Cloud Run
└── cloudbuild.yaml     # Configurazione Cloud Build
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/files/upload` - Upload file su GCS
- `GET /api/files/:gcsPath` - Download file da GCS
- `DELETE /api/files/:gcsPath` - Elimina file da GCS
- `POST /api/compile` - Compila documento con AI
- `POST /api/chat` - Chat con AI

## Note

- Il frontend su GitHub Pages comunica con il backend su Cloud Run tramite CORS
- Le chiavi API sono gestite tramite Secret Manager e non vengono mai esposte al frontend
- I file vengono salvati su Cloud Storage con URL firmati per l'accesso temporaneo

