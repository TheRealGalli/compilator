import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { testOllamaConnection } from '@/lib/ollama';

type OllamaStatus = 'loading' | 'connected' | 'disconnected';

interface OllamaContextType {
    status: OllamaStatus;
    checkStatus: () => Promise<void>;
}

const OllamaContext = createContext<OllamaContextType | undefined>(undefined);

export function OllamaProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<OllamaStatus>('loading');
    const isChecking = useRef(false);

    const checkStatus = useCallback(async () => {
        if (isChecking.current) return;
        isChecking.current = true;
        setStatus('loading');
        try {
            console.log('[OllamaContext] Avvio verifica connessione locale...');
            const isDirectReachable = await testOllamaConnection();

            if (isDirectReachable) {
                console.log('[OllamaContext] Connessione locale riuscita.');
                setStatus('connected');
            } else {
                console.log('[OllamaContext] Connessione locale fallita. Controlla la console.');
                setStatus('disconnected');
            }
        } catch (error) {
            console.error('[OllamaContext] Errore critico durante la verifica:', error);
            setStatus('disconnected');
        } finally {
            isChecking.current = false;
        }
    }, []);

    useEffect(() => {
        checkStatus();
        // Controllo periodico solo se disconnesso, per non disturbare l'inferenza
        const interval = setInterval(() => {
            if (status !== 'connected') {
                checkStatus();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [checkStatus, status]);

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
