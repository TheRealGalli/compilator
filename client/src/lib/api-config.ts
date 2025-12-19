// Configurazione URL API
// In sviluppo usa localhost, in produzione usa l'URL di Cloud Run
const CLOUD_RUN_URL = 'https://compilator-983823068962.europe-west1.run.app';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:5000';

  // Check if running on GitHub Pages or other production environment
  if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
    return CLOUD_RUN_URL;
  }

  return CLOUD_RUN_URL;
};

export const API_BASE_URL = getBaseUrl();

console.log('[API Config] Using Base URL:', API_BASE_URL);
if (typeof window !== 'undefined') {
  console.log('[API Config] Current Origin:', window.location.origin);
}

export function getApiUrl(endpoint: string): string {
  // Rimuovi lo slash iniziale se presente
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  // Se l'endpoint inizia già con 'api/', usa direttamente
  if (cleanEndpoint.startsWith('api/')) {
    // If API_BASE_URL already has /api, don't double it. 
    // Usually Cloud Run URL is root, so we append /api/ if needed, but original code replaced it.
    // Simplifying: Just append to base.
    // If base is .../api/ endpoint, avoiding conflict.
    // Current Cloud Run URL is root.
    return `${API_BASE_URL}/${cleanEndpoint}`;
  }

  return `${API_BASE_URL}/${cleanEndpoint}`;
}

