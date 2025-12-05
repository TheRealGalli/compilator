# CSD Station - Compilatore Documenti AI

<p align="center">
  <img src="client/public/csd-logo-blue.svg" alt="CSD Station Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Compilatore AI per documenti legali e commerciali</strong><br>
  Carica visure, contratti e foto • L'AI compila automaticamente i tuoi template
</p>

---

## 🚀 Funzionalità

- **📄 Compilatore Documenti**: Carica template (Privacy Policy, Contratti, Relazioni) e documenti di contesto, l'AI compila automaticamente i placeholder
- **💬 Analizzatore Chat**: Fai domande sui tuoi documenti, ottieni risposte basate sui file caricati
- **📷 Supporto Multimodale**: PDF, immagini, audio, video - il modello analizza visivamente i documenti
- **🔍 OCR Nativo**: Estrae testo da documenti scansionati e foto

## 🏗️ Architettura

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | React + Vite + TypeScript |
| **Backend** | Express.js + Node.js |
| **AI Model** | Gemini 2.5 Flash (Vertex AI) |
| **Storage** | Google Cloud Storage |
| **Hosting Frontend** | GitHub Pages |
| **Hosting Backend** | Google Cloud Run |

## 📦 Setup Locale

### Prerequisiti

- Node.js 20+
- Account GCP con progetto configurato
- Credenziali GCP (ADC o service account)

### Installazione

```bash
git clone https://github.com/TheRealGalli/compilator.git
cd compilator
npm install
```

### Variabili d'Ambiente

Crea `.env` nella root:

```env
GCP_PROJECT_ID=your-project-id
GCP_STORAGE_BUCKET=your-bucket-name
GCP_CREDENTIALS={"type":"service_account",...}  # JSON inline opzionale
```

### Avvio

```bash
npm run dev
```

## 🌐 Deploy

### Frontend (GitHub Pages)

Push su `main` → deploy automatico via GitHub Actions

### Backend (Cloud Run)

```bash
gcloud run deploy csd-station \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated
```

## 📁 Struttura

```
├── client/                 # Frontend React
│   ├── src/components/     # UI Components
│   └── public/             # Assets statici
├── server/                 # Backend Express
│   └── routes.ts           # API endpoints
├── .github/workflows/      # CI/CD
└── Dockerfile              # Container Cloud Run
```

## 🔌 API Endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| `POST` | `/api/compile` | Compila template con AI |
| `POST` | `/api/chat` | Chat con documenti |
| `POST` | `/api/files/upload` | Upload file |
| `GET` | `/api/health` | Health check |

## 💰 Costi Stimati

Per uno studio con ~150 documenti/mese:

| Voce | Costo Mensile |
|------|---------------|
| Vertex AI (Gemini Flash) | ~€1-5 |
| Cloud Run | ~€5-10 |
| Cloud Storage | ~€1 |
| **Totale** | **~€7-16/mese** |

## 📄 Licenza

Proprietario - CSD Station © 2024
