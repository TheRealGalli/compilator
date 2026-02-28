import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "./api-config";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// In-memory session ID to survive React updates but reset on full page refresh
let inMemorySessionId: string | null = localStorage.getItem('csd_sid');

// Export a function to update it (e.g. from Home context)
export function setSessionId(sid: string) {
  inMemorySessionId = sid;
  localStorage.setItem('csd_sid', sid);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal
): Promise<Response> {
  // Se l'URL è relativo, usa getApiUrl per costruire l'URL completo
  const fullUrl = url.startsWith('http') ? url : getApiUrl(url);

  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders || {})
  };

  // FALLBACK: Add session ID if cookies are blocked (Incognito)
  if (inMemorySessionId) {
    headers['x-session-id'] = inMemorySessionId;
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    signal,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      // queryKey è un array, il primo elemento è l'URL
      const url = queryKey[0] as string;
      const fullUrl = url.startsWith('http') ? url : getApiUrl(url);

      const headers: Record<string, string> = {};
      if (inMemorySessionId) {
        headers['x-session-id'] = inMemorySessionId;
      }

      const res = await fetch(fullUrl, {
        credentials: "include",
        headers
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
