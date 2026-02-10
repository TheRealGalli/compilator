import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { testOllamaConnection } from '@/lib/ollama';
import { useQuery } from '@tanstack/react-query';

type OllamaStatus = 'loading' | 'connected' | 'disconnected';

interface OllamaContextType {
    status: OllamaStatus;
    checkStatus: () => Promise<void>;
}

const OllamaContext = createContext<OllamaContextType | undefined>(undefined);

export function OllamaProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<OllamaStatus>('loading');
    const isChecking = useRef(false);

    // Auth Guard: Only check Ollama if user is logged in
    const { data: user, isFetched: isAuthAttempted } = useQuery({
        queryKey: ['/api/user'],
        retry: false,
        refetchOnWindowFocus: false,
    });

    const checkStatus = useCallback(async () => {
        // Fallback: Don't check if not authenticated or not yet attempted
        if (!isAuthAttempted || !user) {
            console.log('[OllamaContext] Check saltato: utente non autenticato.');
            setStatus('disconnected');
            return;
        }

        if (isChecking.current) return;
        isChecking.current = true;

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
    }, [isAuthAttempted, user]);

    // Primo controllo all'avvio (o quando l'autenticazione cambia)
    useEffect(() => {
        if (isAuthAttempted) {
            checkStatus();
        }
    }, [checkStatus, isAuthAttempted]);

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
