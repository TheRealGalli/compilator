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
            console.log('[OllamaContext] Avvio verifica connessione locale...');

            // Usiamo solo la connessione diretta del browser (Zero-Data Privacy e Performance)
            // Il proxy lato server viene rimosso perché non può vedere il localhost dell'utente
            const isDirectReachable = await testOllamaConnection();

            if (isDirectReachable) {
                console.log('[OllamaContext] Connessione locale riuscita.');
                setStatus('connected');
                return;
            }

            console.log('[OllamaContext] Connessione locale fallita. Controlla la console per istruzioni su come sbloccare il browser.');
            setStatus('disconnected');

        } catch (error) {
            console.error('[OllamaContext] Errore critico durante la verifica:', error);
            setStatus('disconnected');
        }
    }, []);

    useEffect(() => {
        checkStatus();
        // Controllo ogni 30 secondi
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
