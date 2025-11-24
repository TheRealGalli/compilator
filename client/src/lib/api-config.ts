// Configurazione URL API
// In sviluppo usa localhost, in produzione usa l'URL di Cloud Run
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV 
    ? 'http://localhost:5000/api' 
    : import.meta.env.VITE_CLOUD_RUN_URL || 'https://your-service-url.run.app/api');

export function getApiUrl(endpoint: string): string {
  // Rimuovi lo slash iniziale se presente
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  
  // Se l'endpoint inizia già con 'api/', usa direttamente
  if (cleanEndpoint.startsWith('api/')) {
    return cleanEndpoint.replace('api/', API_BASE_URL.replace('/api', '') + '/api/');
  }
  
  return `${API_BASE_URL}/${cleanEndpoint}`;
}

