import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { testOllamaConnection } from '@/lib/ollama';
import { getApiUrl } from '@/lib/api-config';

type OllamaStatus = 'loading' | 'connected' | 'disconnected';

interface OllamaContextType {
    status: OllamaStatus;
    checkStatus: () => Promise<void>;
}

const OllamaContext = createContext<OllamaContextType | undefined>(undefined);

export function OllamaProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<OllamaStatus>('loading');

    const checkStatus = useCallback(async () => {
        setStatus('loading');
        try {
            console.log('[OllamaContext] Checking status...');
            // Priority 1: Direct browser connection (most private, handles mixed content if enabled)
            const isDirectReachable = await testOllamaConnection();

            if (isDirectReachable) {
                console.log('[OllamaContext] Direct connection reachable.');
                setStatus('connected');
                return;
            }

            console.log('[OllamaContext] Direct connection failed, trying proxy fallback...');
            // Priority 2: Backend proxy fallback (for cases where browser fetch fails but server can reach it)
            const checkProxy = async () => {
                try {
                    const url = getApiUrl('/api/ollama-health');
                    const response = await fetch(url);
                    return response.ok;
                } catch (e) {
                    return false;
                }
            };

            const isProxyReachable = await checkProxy();
            console.log('[OllamaContext] Proxy reachable:', isProxyReachable);
            setStatus(isProxyReachable ? 'connected' : 'disconnected');

        } catch (error) {
            console.error('[OllamaContext] Error checking Ollama status:', error);
            setStatus('disconnected');
        }
    }, []);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    return (
        <OllamaContext.Provider value={{ status, checkStatus }}>
            {children}
        </OllamaContext.Provider>
    );
}

export function useOllama() {
    const context = useContext(OllamaContext);
    if (context === undefined) {
        throw new Error('useOllama must be used within an OllamaProvider');
    }
    return context;
}
