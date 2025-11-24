import { type Server } from "node:http";
import express, { type Express } from "express";
import runApp from "./app";

// In produzione, il frontend è servito da GitHub Pages
// Il backend serve solo le API
export async function serveAPIOnly(app: Express, _server: Server) {
  // Endpoint di root per verificare che il server sia attivo
  app.get("/", (_req, res) => {
    res.json({ 
      message: "NotebookLM Compiler API",
      version: "1.0.0",
      status: "running"
    });
  });
}

(async () => {
  await runApp(serveAPIOnly);
})();
