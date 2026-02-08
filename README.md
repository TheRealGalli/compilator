# CSD Station

<p align="center">
  <img src="client/public/csd-logo-blue.svg" alt="CSD Station Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Document Intelligence Engine (D.I.E.)</strong>
</p>

<p align="center">
  <em>Il Motore Intelligente per l'Automazione Documentale e la Privacy Zero-Data</em>
</p>

---

## Visione

CSD Station ridefinisce l'automazione documentale trasformando dati non strutturati in output professionali pronti all'uso. Non è un semplice compilatore, ma un **Document Intelligence Engine** progettato per comprendere il contesto, analizzare fonti eterogenee e generare documentazione complessa con precisione chirurgica, mantenendo la massima protezione della privacy tramite elaborazione locale.

---

## Funzionalità Principali

### 🧠 Compilatore Cognitivo
Il cuore pulsante del sistema. Supera il concetto di "trova e sostituisci" grazie a una comprensione semantica profonda.
- **Analisi Regionale & Multimodale**: Ingerisce visure camerali, contratti, immagini (OCR) e audio (trascrizione), comprendendone le relazioni.
- **Sintesi Intelligente**: Estrae entità complesse (date, importi, clausole legali) e le armonizza all'interno di template dinamici.
- **Vault Context**: Un sistema di "memoria di lavoro" che orchestra le informazioni tra più documenti per garantire coerenza totale.

### 🔬 Analizzatore Avanzato
Un oracolo digitale per i tuoi archivi.
- **Interrogazione Semantica**: Poni domande in linguaggio naturale ai tuoi documenti (Grounding con Vertex AI).
- **Verifica Cross-Documentale**: Incrocia i dati tra diverse fonti per garantire la verità dei fatti.

### 🛡️ Compilatore Guardrail (Pawn)
Il modulo dedicato alla **Privacy Zero-Data**.
- **Anonimizzazione Preventiva**: Prima che i dati lascino il tuo browser verso il Cloud, il sistema rileva e oscura dati sensibili (PII).
- **Elaborazione Locale**: Utilizza **Ollama** per analizzare i testi localmente sul tuo computer.
- **Controllo Totale**: Report dettagliato delle entità rilevate prima dell'invio ai modelli Gemini.
- *Per l'attivazione vedi la sezione [Integrazioni](#integrazioni).*

---

## Architettura Tecnologica

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite.
- **Backend**: Node.js, Express, Google Cloud Run.
- **AI Engine**: Google Vertex AI (**Gemini 2.5 Flash**) per il cloud, **Ollama (Gemma 3 1B)** per la modalità locale.

---

## Integrazioni

### 📦 Google Workspace
- **Google Drive**: Sfoglia e importa documenti direttamente dal tuo cloud.
- **Gmail**: Analizza i messaggi recenti per estrarre contesto utile.

### 🦙 Local AI (Ollama)
Per abilitare il **Compilatore Guardrail** stabilmente sul tuo Mac, segui questi passaggi per superare le barriere di sicurezza (CORS) del browser:

#### Configurazione Permanente (macOS)
1. Apri il **Terminale** e incolla questo comando per creare l'automatismo di avvio:
   ```bash
   cat <<EOF > ~/Library/LaunchAgents/setenv.ollama.plist
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>Label</key>
     <string>setenv.ollama</string>
     <key>ProgramArguments</key>
     <array>
       <string>/bin/launchctl</string>
       <string>setenv</string>
       <string>OLLAMA_ORIGINS</string>
       <string>https://therealgalli.github.io,http://localhost*,http://127.0.0.1*</string>
     </array>
     <key>RunAtLoad</key>
     <true/>
   </dict>
   </plist>
   EOF
   ```
2. Attiva l'automatismo:
   ```bash
   launchctl load ~/Library/LaunchAgents/setenv.ollama.plist
   ```
3. Assicurati di aver installato il modello specifico:
   ```bash
   ollama pull gemma3:1b
   ```
4. **Riavvia Ollama** (Quit e Riapri).

---

## Deployment

- **Frontend**: Ospitato su [GitHub Pages](https://therealgalli.github.io/compilator/).
- **Backend**: Containerizzato su **Google Cloud Run** in zona `europe-west1`.

---

## Licenza

**CSD Station © 2025**
Software proprietario sviluppato da CSD Station LLC. Tutti i diritti riservati.

<p align="center">
  <em>Designed for the Future of Work.</em>
</p>
