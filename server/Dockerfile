FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Install deps
COPY package.json package-lock.json* ./
RUN npm install --only=production || npm install

# Build
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]

