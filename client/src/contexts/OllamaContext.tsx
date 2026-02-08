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

        // Non resettiamo lo stato a 'loading' se siamo già connessi per evitare flickering UI
        // Ma facciamo comunque il controllo in background
        try {
            console.log('[OllamaContext] Verifica connessione locale...');
            const isDirectReachable = await testOllamaConnection();

            if (isDirectReachable) {
                console.log('[OllamaContext] Connessione locale OK.');
                setStatus('connected');
            } else {
                console.log('[OllamaContext] Connessione locale FALLITA.');
                setStatus('disconnected');
            }
        } catch (error) {
            console.error('[OllamaContext] Errore critico:', error);
            setStatus('disconnected');
        } finally {
            isChecking.current = false;
        }
    }, []);

    // Primo controllo all'avvio
    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    // Controllo periodico separato (ogni 30 secondi)
    // Usiamo una ref per accedere allo stato corrente senza triggerare l'effect
    const statusRef = useRef(status);
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    useEffect(() => {
        const interval = setInterval(() => {
            // Se siamo già connessi, controlliamo meno spesso o saltiamo se stiamo lavorando
            // Per ora lo facciamo ogni 30s solo se non siamo già in "connected"
            // o se vogliamo essere sicuri che la connessione regga.
            if (statusRef.current !== 'connected') {
                checkStatus();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [checkStatus]); // NOTA: status NON deve essere qui o causerà un loop infinito

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
