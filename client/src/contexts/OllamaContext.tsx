import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { testOllamaConnection, getRunningModels, DEFAULT_OLLAMA_MODEL, preloadModel, unloadModel } from '@/lib/ollama';
import { useQuery } from '@tanstack/react-query';

type OllamaStatus = 'loading' | 'connected' | 'disconnected';
type OllamaAccountStatus = 'connected' | 'disconnected';

interface OllamaContextType {
    status: OllamaStatus;
    checkStatus: () => Promise<void>;
    accountStatus: OllamaAccountStatus;
    accountEmail?: string;
    accountToken?: string;
    connectAccount: (email: string, token: string) => Promise<void>;
    disconnectAccount: () => void;
    expectedModel?: string; // Modello che ci aspettiamo sia il default
    selectedModel: string;
    setModel: (model: string) => void;
    installedModels: string[];
}

const OllamaContext = createContext<OllamaContextType | undefined>(undefined);

export function OllamaProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<OllamaStatus>('loading');
    const [accountStatus, setAccountStatus] = useState<OllamaAccountStatus>(() => {
        return (localStorage.getItem('ollama_account_status') as OllamaAccountStatus) || 'disconnected';
    });
    const [accountEmail, setAccountEmail] = useState<string | undefined>(() => {
        return localStorage.getItem('ollama_account_email') || undefined;
    });
    const [accountToken, setAccountToken] = useState<string | undefined>(() => {
        return localStorage.getItem('ollama_account_token') || undefined;
    });
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        return localStorage.getItem('ollama_selected_model') || DEFAULT_OLLAMA_MODEL;
    });
    const [installedModels, setInstalledModels] = useState<string[]>([]);
    const isChecking = useRef(false);

    // Auth Guard: Only check Ollama if user is logged in
    const { data: user, isFetched: isAuthAttempted } = useQuery({
        queryKey: ['/api/user'],
        retry: false,
        refetchOnWindowFocus: false,
    });

    const hasFailedInitialCheck = useRef(false);

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
            const isDirectReachable = await testOllamaConnection();

            if (isDirectReachable) {
                setStatus('connected');
                // Fetch models dynamically
                const models = await getRunningModels();
                setInstalledModels(models);
                hasFailedInitialCheck.current = false; // Reset if successful
            } else {
                setStatus('disconnected');
                hasFailedInitialCheck.current = true; // Set if disconnected
            }
        } catch (error) {
            console.error('[OllamaContext] Errore durante il controllo di Ollama:', error);
            setStatus('disconnected');
            hasFailedInitialCheck.current = true; // Set if error
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

    // Usiamo una ref per accedere allo stato corrente senza triggerare l'effect
    const statusRef = useRef(status);
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Listener per la tab focus: se torniamo sulla tab, controlliamo lo status
    useEffect(() => {
        const handleFocus = () => {
            if (statusRef.current !== 'connected' && !hasFailedInitialCheck.current) {
                checkStatus();
            } else if (hasFailedInitialCheck.current) {
                // Se aveva fallito in precedenza ma ora l'utente torna sulla pagina, riprova una volta.
                checkStatus();
            }
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [checkStatus]);

    const connectAccount = useCallback(async (email: string, token: string) => {
        // Simuliamo un delay di connessione
        await new Promise(r => setTimeout(r, 800));
        setAccountStatus('connected');
        setAccountEmail(email);
        setAccountToken(token);
        localStorage.setItem('ollama_account_status', 'connected');
        localStorage.setItem('ollama_account_email', email);
        localStorage.setItem('ollama_account_token', token);
        console.log(`[OllamaContext] Account connesso: ${email} con Token.`);
    }, []);

    const disconnectAccount = useCallback(() => {
        setAccountStatus('disconnected');
        setAccountEmail(undefined);
        setAccountToken(undefined);
        localStorage.removeItem('ollama_account_status');
        localStorage.removeItem('ollama_account_email');
        console.log('[OllamaContext] Account disconnesso.');
    }, []);

    const setModel = useCallback((model: string) => {
        const oldModel = selectedModel;
        setSelectedModel(model);
        localStorage.setItem('ollama_selected_model', model);

        // Lifecycle: Unload old model to free VRAM and preload new one
        if (oldModel && oldModel !== model) {
            unloadModel(oldModel);
        }
        preloadModel(model);
    }, [selectedModel]);

    // Lifecycle: Proactive preload on mount or visibility
    useEffect(() => {
        if (status === 'connected' && selectedModel) {
            preloadModel(selectedModel);
        }
    }, [status, selectedModel]);

    // Lifecycle: Unload on browser close / refresh
    useEffect(() => {
        const handleUnload = () => {
            if (selectedModel) {
                // We use a "fire and forget" or sync approach if possible, 
                // but since unloadModel uses fetch, we hope it completes 
                // or the browser extension (Bridge) handles the handover.
                unloadModel(selectedModel);
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [selectedModel]);

    return (
        <OllamaContext.Provider value={{
            status,
            checkStatus,
            accountStatus,
            accountEmail,
            accountToken,
            connectAccount,
            disconnectAccount,
            selectedModel,
            setModel,
            installedModels
        }}>
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
