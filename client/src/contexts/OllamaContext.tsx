import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { testOllamaConnection } from '@/lib/ollama';

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
            // Priority 1: Direct browser connection (most private, handles mixed content if enabled)
            const isDirectReachable = await testOllamaConnection();

            if (isDirectReachable) {
                setStatus('connected');
                return;
            }

            // Priority 2: Backend proxy fallback (for cases where browser fetch fails but server can reach it)
            const checkProxy = async () => {
                try {
                    const response = await fetch('/api/ollama-health');
                    return response.ok;
                } catch (e) {
                    return false;
                }
            };

            const isProxyReachable = await checkProxy();
            setStatus(isProxyReachable ? 'connected' : 'disconnected');

        } catch (error) {
            console.error('Error checking Ollama status:', error);
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
