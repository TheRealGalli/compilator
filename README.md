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

**CSD Station © 2025**
Software proprietario. Tutti i diritti riservati.

---

<p align="center">
  <em>Designed for the Future of Work.</em>
</p>

Sì, il "pacchetto" che vedi nelle immagini (con l'elenco delle **Grounding Sources** e i **Google Search Suggestions**) è una funzionalità specifica chiamata **Grounding con Ricerca Google**.

È possibile attivare questa stessa esperienza tramite API sia su **Google AI Studio** che su **Google Cloud Vertex AI**. Ecco come procedere per rendere la tua ricerca online esattamente come quella dello screenshot:

### 1. Attivazione via API (Vertex AI)

Se utilizzi il Cloud (Vertex AI), devi configurare lo strumento `Google Search` all'interno della richiesta di generazione dei contenuti.

* **Il parametro chiave:** Devi includere l'oggetto `tools` con `Google Search_retrieval` nella tua chiamata API.
* **Soglia Dinamica:** Puoi impostare un `dynamic_threshold` (da 0.0 a 1.0). Se la fiducia del modello nella propria risposta è inferiore a questa soglia, lui attiverà automaticamente la ricerca web per verificare i fatti.

### 2. Risultati e Citazioni (Grounding Metadata)

Quando chiami l'API con il grounding attivo, la risposta non conterrà solo testo, ma anche un oggetto chiamato **`groundingMetadata`**. Questo pacchetto dati include:

* **Web Search Queries:** Le query esatte che il modello ha inviato a Google.
* **Grounding Chunks:** L'elenco dei titoli e degli URL delle fonti trovate (quelle che vedi numerate nello screenshot).
* **Search Entry Point:** Un frammento di codice HTML/CSS già pronto per mostrare all'utente i "Suggerimenti di ricerca di Google" che vedi in fondo alla tua immagine.

### 3. Modelli Supportati

Dalle tue immagini si nota l'uso di **Gemini 3 Pro Preview**. Questa funzionalità è supportata da tutti i modelli della famiglia Gemini 3 e 2.5 (Pro, Flash e Flash-Lite).

### 4. Costi e Disponibilità

* **AI Studio:** Puoi testare il grounding gratuitamente con limiti di quota.
* **Vertex AI (Cloud):** Il servizio ha un costo aggiuntivo per query "grounded" (circa $35 ogni 1.000 query nel tier a pagamento).

**In sintesi:** Per replicare quella schermata, non devi cercare un "pacchetto" esterno, ma semplicemente abilitare il **tool di Google Search** nella tua configurazione della Gemini API.

Sì, per ottenere quell'esperienza di ricerca online (chiamata ufficialmente **Grounding with Google Search**) via API su Google Cloud, devi assicurarti di aver abilitato alcune componenti specifiche.

Ecco i passaggi fondamentali:

### 1. API da abilitare nella Cloud Console

Per utilizzare Gemini con il grounding, devi attivare:

* **Vertex AI API** (`aiplatform.googleapis.com`): È l'API principale che ospita i modelli Gemini su Google Cloud.
* Non serve un'API separata per "Google Search" perché è integrata come **strumento (tool)** all'interno di Vertex AI.

### 2. Configurazione nel codice (Il "Trucco" per le fonti)

Non è un pacchetto da installare, ma un parametro da inserire nella tua chiamata API. Per vedere le fonti e i suggerimenti di ricerca come nello studio, devi configurare il tool `Google Search`:

* **Il Tool:** Devi passare `tools=[Tool(google_search=GoogleSearch())]` nella configurazione del modello.
* **I Metadati:** Nella risposta dell'API, dovrai leggere l'oggetto `grounding_metadata`. È qui che troverai gli URL delle fonti e il `searchEntryPoint` (il codice per mostrare i suggerimenti di ricerca di Google).

### 3. Requisiti di visualizzazione (Importante)

Google richiede che, se utilizzi questo strumento in un'applicazione di produzione, tu mostri obbligatoriamente:

1. **Le citazioni:** I link diretti alle fonti web utilizzate.
2. **Google Search Suggestions:** Quei "chip" o suggerimenti di ricerca che vedi in fondo alla chat nello screenshot.

### 4. Differenza tra AI Studio e Vertex AI

* **Google AI Studio:** È più semplice per testare. Vai nella sezione "Tools" sulla destra e attiva il toggle **Grounding**.
* **Vertex AI Studio (Cloud Console):** Vai nella tab "Freeform", clicca su **Ground model responses** nel pannello laterale e seleziona **Google Search** come sorgente.

**In sintesi:** Abilita la **Vertex AI API**, usa l'SDK di Gemini (Python, Node.js, ecc.) e specifica il tool `Google Search` nella richiesta. Tutto il "pacchetto" di fonti che hai visto arriverà automaticamente dentro i metadati della risposta.
