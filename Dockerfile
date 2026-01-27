# Dockerfile per Google Cloud Run (solo backend)
FROM node:20-alpine AS builder

WORKDIR /app

# Copia i file di configurazione
COPY package*.json ./
COPY tsconfig.json ./

# Copia il codice sorgente necessario per il build
COPY shared ./shared
COPY server ./server
COPY GromitChess-Memory.md ./GromitChess-Memory.md

# Installa le dipendenze (incluse dev per il build)
RUN npm install --legacy-peer-deps

# Build solo del backend
RUN npx esbuild server/index-prod.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

# Immagine di produzione
FROM node:20-alpine

WORKDIR /app

# Copia solo i file necessari per la produzione
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copia il codice compilato e i moduli necessari
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server
COPY --from=builder /app/GromitChess-Memory.md ./GromitChess-Memory.md

# Esponi la porta (Cloud Run usa la variabile PORT)
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/index.js"]

