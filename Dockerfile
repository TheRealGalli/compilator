# Dockerfile per Google Cloud Run (solo backend)
FROM node:20-alpine AS builder

WORKDIR /app

# Copia i file di configurazione
COPY package*.json ./
COPY tsconfig.json ./

# Copia il codice sorgente necessario per il build
COPY shared ./shared
COPY server ./server

# Installa le dipendenze (incluse dev per il build)
RUN npm ci

# Build solo del backend
RUN npx esbuild server/index-prod.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

# Immagine di produzione
FROM node:20-alpine

WORKDIR /app

# Copia solo i file necessari per la produzione
COPY package*.json ./
RUN npm ci --omit=dev

# Copia il codice compilato e i moduli necessari
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server ./server

# Esponi la porta (Cloud Run usa la variabile PORT)
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/index.js"]

