import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(async () => {
  const plugins = [
    react(),
    runtimeErrorOverlay(),
  ];

  // Aggiungi i plugin Replit solo in sviluppo e se REPL_ID è definito
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      const [cartographer, devBanner] = await Promise.all([
        import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()),
        import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
      ]);
      plugins.push(cartographer, devBanner);
    } catch (error) {
      // Ignora errori se i plugin non sono disponibili (es. in produzione)
      console.warn("Replit plugins non disponibili:", error);
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
        "@assets": path.resolve(__dirname, "attached_assets"),
      },
    },
    root: path.resolve(__dirname, "client"),
    base: process.env.GITHUB_PAGES
      ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || 'compilator'}/`
      : '/',
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
    publicDir: path.resolve(__dirname, "client", "public"),
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
