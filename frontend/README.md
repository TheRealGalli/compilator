Compilator Frontend (Vite + React)
==================================

Sviluppo locale
---------------
1) Requisiti: Node.js >= 18
2) Installazione
   npm install
3) Avvio dev
   npm run dev

Variabili d'ambiente (.env)
---------------------------
Creare un file `.env` nella cartella `frontend/` (vedi anche `.env.example`):

VITE_SERVER_URL=http://localhost:8787
VITE_BASE=/

- VITE_SERVER_URL: URL del backend (in dev: http://localhost:8787; in prod: URL Cloud Run)
- VITE_BASE: base path Vite (per GitHub Pages impostare a `/<REPO_NAME>/`)

Build
-----
npm run build
I file statici si trovano in `dist/`.

GitHub Pages
------------
- Impostare `VITE_BASE=/<REPO_NAME>/` (in `.env` o nel CI)
- Costruire: `npm run build`
- Pubblicare la cartella `dist/` su GitHub Pages (branch `gh-pages` o Pages da `docs/`)

Collegamento al backend su Cloud Run
------------------------------------
1) Deploy del server su Cloud Run (vedi README del server)
2) Prendere l'URL pubblico di Cloud Run (es. `https://compilator-xxxxx.run.app`)
3) Nel frontend impostare:
   VITE_SERVER_URL=https://compilator-xxxxx.run.app
4) Ricostruire e ripubblicare su GitHub Pages

Routing
-------
Il frontend usa `HashRouter`, quindi funziona correttamente su GitHub Pages senza configurazioni speciali del server statico.


