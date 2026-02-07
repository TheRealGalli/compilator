import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

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
            // PROVE DIRECT REACH FIRST (Localhost from browser)
            // Note: This might hit CORS but we check if the server is at least reachable
            // We also check via our backend proxy just in case the server is local too

            const checkLocal = async () => {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);

                    const response = await fetch('http://localhost:11434/api/tags', {
                        method: 'GET',
                        mode: 'no-cors', // Trying to avoid CORS issues for a simple ping
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    return true; // If it didn't throw, it's likely reachable
                } catch (e) {
                    return false;
                }
            };

            const checkProxy = async () => {
                try {
                    // Use the proxy we defined in routes.ts
                    // We need getApiUrl but we don't have it here, we'll use a relative path if possible or assume it's on the same origin
                    const response = await fetch('/api/ollama-health');
                    return response.ok;
                } catch (e) {
                    return false;
                }
            };

            const isLocalReachable = await checkLocal();
            const isProxyReachable = await checkProxy();

            if (isLocalReachable || isProxyReachable) {
                setStatus('connected');
            } else {
                setStatus('disconnected');
            }
        } catch (error) {
            console.error('Error checking Ollama status:', error);
            setStatus('disconnected');
        }
    }, []);

    useEffect(() => {
        checkStatus();

        // Optional: periodic check
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
