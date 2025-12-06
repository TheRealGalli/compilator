# CSD Station

<p align="center">
  <img src="client/public/csd-logo-blue.svg" alt="CSD Station Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Document Intelligence Engine</strong>
</p>

<p align="center">
  <em>Il Compilatore Cognitivo di Documenti</em>
</p>

---

## Visione

CSD Station ridefinisce l'automazione documentale trasformando dati non strutturati in output professionali pronti all'uso. Non è un semplice compilatore, ma un **Motore di Intelligenza Documentale** progettato per comprendere il contesto, analizzare fonti eterogenee e generare documentazione complessa con precisione chirurgica.

In un mondo dove il dato è il nuovo petrolio, CSD Station è la raffineria che estrae valore da visure, contratti e certificati, orchestrando il flusso di lavoro con l'eleganza di un assistente esperto e la potenza di un modello linguistico all'avanguardia.

---

## Core Capabilities

### 🧠 Compilatore Cognitivo
Il cuore pulsante del sistema. Supera il concetto di "trova e sostituisci" grazie a una comprensione semantica profonda.
- **Analisi Contestuale**: Ingerisce visure camerali, contratti, immagini e audio, comprendendone le relazioni intrinseche.
- **Sintesi Intelligente**: Estrae entità complesse (date, importi, clausole legali) e le armonizza all'interno di template dinamici.
- **Adattabilità**: Dal *Tono Formale* per atti legali alla *Creatività* per bozze preliminari, il motore si adatta alle esigenze specifiche del dominio.

### 🔬 Analizzatore Avanzato
Un oracolo digitale per i tuoi archivi.
- **Interrogazione Semantica**: Poni domande in linguaggio naturale ai tuoi documenti.
- **Verifica Cross-Documentale**: Incrocia i dati tra diverse fonti per garantire la coerenza delle informazioni.
- **Estrazione Mirata**: Isola clausole, scadenze e obblighi con precisione millimetrica.

### 🌐 Connettività & Gestione (Coming Soon)
- **Integrazione Cloud**: Connettori nativi per Google Drive e Notion.
- **Multimodalità Totale**: Supporto nativo per PDF, DOCX, Immagini (OCR integrato), Audio e Video.

---

## Architettura Tecnologica

Costruito su uno stack moderno e scalabile, progettato per performance e sicurezza enterprise-grade.

### Frontend
- **React 18 & TypeScript**: Un'interfaccia reattiva e type-safe.
- **Tailwind CSS & Shadcn/UI**: Design system pulito, accessibile e responsive.
- **Vite**: Build system di nuova generazione per performance ottimali.

### Backend & AI
- **Node.js & Express**: Runtime robusto e scalabile.
- **Google Vertex AI**: La potenza dei modelli **Gemini 2.5 Flash** per un ragionamento multimodale senza precedenti.
- **Google Cloud Platform**: Infrastruttura serverless su Cloud Run e storage sicuro su GCS.

---

## Getting Started

### Requisiti
- **Runtime**: Node.js 20+
- **Cloud**: Account Google Cloud Platform con Vertex AI abilitato.

### Installazione Rapida

```bash
# Clona il repository
git clone https://github.com/TheRealGalli/compilator.git

# Installa le dipendenze
cd compilator
npm install

# Configura l'ambiente
cp .env.example .env
# Inserisci le tue credenziali GCP nel file .env

# Avvia il motore
npm run dev
```

---

## Struttura del Progetto

```
├── client/                 # Frontend Application (React)
│   ├── src/components/     # UI Components Library
│   └── src/lib/            # Core Utilities
├── server/                 # Backend Services (Node.js)
│   ├── routes.ts           # API Endpoints
│   └── gcp-storage.ts      # Cloud Storage Integration
└── shared/                 # Shared Type Definitions
```

---

## Deployment

Il sistema è progettato per un deployment continuo e automatizzato:
- **Frontend**: GitHub Pages (Automatic Deploy)
- **Backend**: Google Cloud Run (Containerized via GitHub Actions)

---

## Licenza

**CSD Station © 2024**
Software proprietario. Tutti i diritti riservati.

---

<p align="center">
  <em>Designed for the Future of Work.</em>
</p>
