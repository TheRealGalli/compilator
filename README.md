# CSD Station

<p align="center">
  <img src="client/public/csd-logo-blue.svg" alt="CSD Station Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Piattaforma AI per la Compilazione Intelligente di Documenti</strong>
</p>

---

## Panoramica

CSD Station è una piattaforma web che sfrutta l'intelligenza artificiale per automatizzare la compilazione di documenti professionali. Il sistema analizza documenti di contesto (visure camerali, contratti, fotografie, certificati) e utilizza le informazioni estratte per compilare automaticamente template predefiniti o personalizzati.

---

## Funzionalità Principali

### 📄 Compilatore Documenti

Il cuore della piattaforma. Permette di:

- **Selezionare un template** tra quelli preimpostati (Privacy Policy, Relazione Tecnica, Contratto di Servizio) oppure caricare un template personalizzato in formato `.txt` o `.md`
- **Caricare documenti di contesto** come visure camerali, contratti esistenti, certificati, fotografie di documenti o qualsiasi file che contenga informazioni utili
- **Compilazione automatica**: l'AI analizza i documenti caricati, estrae le informazioni rilevanti (nomi, indirizzi, codici fiscali, P.IVA, importi, date) e le inserisce nei placeholder del template
- **Controlli avanzati**:
  - *Creatività*: regola il livello di creatività del modello (da preciso a creativo)
  - *Analisi Dettagliata*: attiva un'analisi più approfondita dei documenti
  - *Tono Formale*: imposta il registro linguistico del documento generato
  - *Web Research*: integra informazioni da fonti esterne quando appropriato

### 💬 Analizzatore

Un assistente conversazionale che permette di:

- **Interrogare i documenti caricati** con domande in linguaggio naturale
- **Ottenere sintesi e riassunti** dei contenuti
- **Estrarre informazioni specifiche** dai file
- **Verificare dati** presenti nei documenti

### 📁 Gestione Documenti

- **Upload drag-and-drop** per caricare velocemente i file
- **Supporto multimodale completo**:
  - Documenti: PDF, DOCX, TXT
  - Immagini: JPG, PNG, WebP
  - Audio: MP3, WAV, FLAC, AAC
  - Video: MP4, MOV, AVI, WebM
- **Selezione multipla** delle fonti da utilizzare per la compilazione
- **Anteprima** dei file caricati

### 📋 Output

- **Visualizzazione formattata** del documento compilato
- **Copia negli appunti** con un click
- **Download** del documento generato

---

## Architettura Tecnica

### Frontend

L'interfaccia utente è costruita con:

- **React 18** con TypeScript per la type-safety
- **Vite** come build tool per sviluppo veloce e bundle ottimizzati
- **Tailwind CSS** per lo styling utility-first
- **Shadcn/UI** come libreria di componenti accessibili
- **Lucide React** per l'iconografia

L'applicazione è una Single Page Application (SPA) con routing client-side e stato gestito tramite React Context.

### Backend

Il server è implementato con:

- **Node.js** runtime
- **Express.js** come framework HTTP
- **TypeScript** per type-safety end-to-end

Il backend espone API RESTful per la gestione dei file e la comunicazione con i servizi AI.

### Intelligenza Artificiale

Il motore AI utilizza:

- **Google Vertex AI** come piattaforma di ML
- **Gemini 2.5 Flash** come modello generativo
- Elaborazione **multimodale nativa**: il modello può analizzare direttamente immagini, PDF e altri formati senza necessità di preprocessing
- **OCR integrato**: riconoscimento automatico del testo in documenti scansionati o fotografati

### Cloud Infrastructure

- **Google Cloud Storage** per l'archiviazione sicura dei file
- **Google Cloud Run** per l'hosting serverless del backend (scalabilità automatica)
- **GitHub Pages** per l'hosting statico del frontend

---

## Requisiti di Sistema

### Per l'Utilizzo
- Browser moderno (Chrome, Firefox, Safari, Edge)
- Connessione internet

### Per lo Sviluppo
- Node.js 20+
- Account Google Cloud Platform
- Credenziali GCP configurate

---

## Installazione

```bash
# Clona il repository
git clone https://github.com/TheRealGalli/compilator.git

# Installa le dipendenze
cd compilator
npm install

# Configura le variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue credenziali GCP

# Avvia in modalità sviluppo
npm run dev
```

---

## Struttura del Progetto

```
├── client/                 # Applicazione React
│   ├── src/
│   │   ├── components/     # Componenti UI riutilizzabili
│   │   ├── contexts/       # React Context per stato globale
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilities e configurazioni
│   │   └── pages/          # Componenti pagina
│   └── public/             # Asset statici
├── server/                 # Backend Express
│   ├── routes.ts           # Definizione API
│   ├── gcp-storage.ts      # Integrazione Cloud Storage
│   └── gcp-secrets.ts      # Gestione secrets
├── shared/                 # Codice condiviso client/server
└── .github/workflows/      # Pipeline CI/CD
```

---

## Deploy

### Frontend
Il frontend viene automaticamente deployato su GitHub Pages ad ogni push sul branch `main`.

### Backend
Il backend viene deployato su Google Cloud Run tramite GitHub Actions. Il workflow gestisce build, containerizzazione e deploy automatico.

---

## Licenza

Software proprietario - CSD Station © 2024

Tutti i diritti riservati.
