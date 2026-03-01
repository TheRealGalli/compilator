// Configurazione URL API
// In sviluppo usa localhost, in produzione usa l'URL di Cloud Run
const CLOUD_RUN_URL = 'https://compilator-983823068962.europe-west1.run.app';

// Endpoints that ALWAYS go to the main backend (auth, user profile, deploy orchestration)
const MAIN_BACKEND_ONLY_PREFIXES = [
  '/api/user',
  '/api/auth',
  '/api/greeting',
  '/api/deploy',
  '/api/gmail',
  '/api/drive',
  '/api/cors-test',
];

/**
 * Returns true if this endpoint should always use the main backend,
 * regardless of whether a self-hosted backend is configured.
 */
function isMainBackendEndpoint(endpoint: string): boolean {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return MAIN_BACKEND_ONLY_PREFIXES.some(prefix => clean.startsWith(prefix));
}

/**
 * Get the main backend URL (never the self-hosted one).
 * Used for auth, user profile, deploy orchestration.
 */
const getMainBackendUrl = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return CLOUD_RUN_URL;
};

/**
 * Get the self-hosted backend URL if configured and user is authenticated.
 */
const getSelfHostedUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gromit_custom_backend_url');
};

/**
 * Get the base URL for an API request.
 * - Auth/profile/deploy endpoints → always main backend
 * - AI/processing endpoints → self-hosted backend if configured, otherwise main
 */
const getBaseUrlForEndpoint = (endpoint: string): string => {
  // Auth and profile endpoints always go to the main backend
  if (isMainBackendEndpoint(endpoint)) {
    return getMainBackendUrl();
  }

  // AI/processing endpoints: use self-hosted if configured
  const selfHosted = getSelfHostedUrl();
  if (selfHosted) {
    return selfHosted;
  }

  return getMainBackendUrl();
};

// Legacy: default base URL for backward compatibility (used by non-endpoint-aware code)
export const API_BASE_URL = getMainBackendUrl();

export const setCustomBackendUrl = (url: string | null) => {
  if (url) {
    localStorage.setItem('gromit_custom_backend_url', url);
    localStorage.setItem('gromit_private_cloud_url', url);
  } else {
    localStorage.removeItem('gromit_custom_backend_url');
    localStorage.removeItem('gromit_private_cloud_url');
  }
  // Persist to user profile on the backend (fire-and-forget)
  const mainBackend = getMainBackendUrl();
  fetch(`${mainBackend}/api/user/self-hosted-url`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ selfHostedUrl: url }),
  }).catch(() => { /* silently ignore if not authenticated */ });
  // Reload page to apply changes across the app
  window.location.reload();
};

export const getCustomBackendUrl = () => {
  return localStorage.getItem('gromit_custom_backend_url');
};

export const getSavedPrivateCloudUrl = () => {
  return localStorage.getItem('gromit_private_cloud_url');
};

export function getApiUrl(endpoint: string): string {
  // Rimuovi lo slash iniziale se presente
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  // Route to the correct backend based on the endpoint
  const baseUrl = getBaseUrlForEndpoint(`/${cleanEndpoint}`);
  return `${baseUrl}/${cleanEndpoint}`;
}
