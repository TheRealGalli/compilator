# Guida al Deploy

Questa guida ti aiuterà a configurare e deployare l'applicazione su GitHub Pages (frontend) e Google Cloud Run (backend).

## Prerequisiti

1. Account GitHub con un repository
2. Account Google Cloud Platform con un progetto
3. Google Cloud SDK installato (`gcloud` CLI)

## Setup GCP

### 1. Crea un progetto GCP

```bash
gcloud projects create notebooklm-compiler --name="NotebookLM Compiler"
gcloud config set project notebooklm-compiler
```

### 2. Abilita le API necessarie

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Crea un bucket Cloud Storage

```bash
gsutil mb -p $(gcloud config get-value project) -l europe-west1 gs://notebooklm-compiler-files
```

### 4. Configura le chiavi API nel Secret Manager

```bash
# Per OpenAI
echo -n "sk-your-openai-api-key" | gcloud secrets create MODEL_API_KEY_OPENAI --data-file=-

# Per altri provider (es. Google AI)
echo -n "your-google-ai-key" | gcloud secrets create MODEL_API_KEY_GOOGLE --data-file=-
```

### 5. Crea un service account per Cloud Build

```bash
# Crea il service account
gcloud iam service-accounts create cloud-build-sa \
  --display-name="Cloud Build Service Account"

# Assegna i permessi necessari
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Permessi per Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Permessi per Storage
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/storage.admin"

# Permessi per Secret Manager
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 6. Crea un service account per Cloud Run

```bash
# Crea il service account per l'applicazione
gcloud iam service-accounts create app-runtime-sa \
  --display-name="App Runtime Service Account"

PROJECT_ID=$(gcloud config get-value project)

# Permessi per Storage
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:app-runtime-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Permessi per Secret Manager
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:app-runtime-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Configurazione GitHub

### 1. Configura GitHub Secrets

Vai su Settings > Secrets and variables > Actions nel tuo repository GitHub e aggiungi:

- `GCP_PROJECT_ID`: Il tuo Project ID GCP (es. `notebooklm-compiler`)
- `GCP_SA_KEY`: Il JSON del service account (vedi sotto)

### 2. Ottieni le credenziali del service account

```bash
# Crea una chiave per il service account di Cloud Build
gcloud iam service-accounts keys create key.json \
  --iam-account=$PROJECT_NUMBER@cloudbuild.gserviceaccount.com

# Copia il contenuto di key.json e incollalo nel secret GCP_SA_KEY su GitHub
cat key.json

# Elimina il file locale per sicurezza
rm key.json
```

### 3. Configura GitHub Pages

1. Vai su Settings > Pages nel tuo repository
2. Seleziona "GitHub Actions" come source
3. Il workflow `.github/workflows/deploy-frontend.yml` gestirà automaticamente il deploy

### 4. Configura le variabili d'ambiente per il frontend

Dopo il primo deploy del backend, otterrai un URL Cloud Run (es. `https://notebooklm-compiler-xxx.run.app`).

Aggiungi questa variabile nel repository GitHub:
- Settings > Secrets and variables > Actions > Variables
- Aggiungi `VITE_CLOUD_RUN_URL` con il valore dell'URL del tuo Cloud Run

Oppure modifica il workflow per usare un secret.

## Deploy

### Deploy Automatico

Una volta configurato tutto, i deploy sono automatici:

- **Frontend**: Deploy automatico su GitHub Pages quando fai push su `main`
- **Backend**: Deploy automatico su Cloud Run quando modifichi file in `server/`, `shared/`, o i file di configurazione

### Deploy Manuale del Backend

Se vuoi deployare manualmente:

```bash
# Assicurati di essere autenticato
gcloud auth login

# Imposta il progetto
gcloud config set project your-project-id

# Deploy usando Cloud Build
gcloud builds submit --config=cloudbuild.yaml

# Oppure deploy diretto
gcloud run deploy notebooklm-compiler \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --service-account app-runtime-sa@your-project-id.iam.gserviceaccount.com \
  --set-env-vars GCP_PROJECT_ID=your-project-id,GCP_STORAGE_BUCKET=notebooklm-compiler-files
```

## Verifica del Deploy

### Verifica Backend

```bash
# Controlla lo stato del servizio
gcloud run services describe notebooklm-compiler --region europe-west1

# Testa l'endpoint
curl https://your-service-url.run.app/api/health
```

### Verifica Frontend

1. Vai su `https://your-username.github.io/NotebookLMCompiler/`
2. Controlla la console del browser per eventuali errori CORS
3. Prova a caricare un file e verificare che venga salvato su GCS

## Troubleshooting

### Errore CORS

Se vedi errori CORS nel browser, verifica che:
1. Il backend permetta le richieste dal dominio GitHub Pages
2. La variabile `FRONTEND_URL` nel backend sia configurata correttamente

### Errore "Secret not found"

Verifica che:
1. Il secret esista in Secret Manager: `gcloud secrets list`
2. Il service account abbia i permessi: `roles/secretmanager.secretAccessor`

### Errore "Bucket not found"

Verifica che:
1. Il bucket esista: `gsutil ls`
2. Il service account abbia i permessi: `roles/storage.objectAdmin`

### Build fallisce

Controlla i log di Cloud Build:
```bash
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

## Costi Stimati

- **GitHub Pages**: Gratuito
- **Cloud Run**: Pay-per-use, molto economico per uso moderato (~$0.40 per milione di richieste)
- **Cloud Storage**: ~$0.020 per GB/mese
- **Secret Manager**: Gratuito per i primi 6 secret, poi ~$0.06 per secret/mese

Per un uso moderato (1000 richieste/giorno, 10GB storage), il costo mensile è circa $1-5.

