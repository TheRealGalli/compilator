import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

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
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    base: process.env.GITHUB_PAGES 
      ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] || 'compilator'}/` 
      : '/',
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    publicDir: path.resolve(import.meta.dirname, "client", "public"),
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
