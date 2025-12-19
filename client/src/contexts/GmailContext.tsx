import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface GmailMessage {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    snippet: string;
    date: string;
}

export type GmailCategory = 'primary' | 'social' | 'promotions' | 'updates';

interface GmailContextType {
    isConnected: boolean;
    isLoading: boolean;
    messages: GmailMessage[];
    isFetchingMessages: boolean;
    nextPageToken: string | null;
    currentCategory: GmailCategory;
    searchQuery: string;
    setCategory: (category: GmailCategory) => void;
    setSearchQuery: (query: string) => void;
    checkConnection: () => Promise<void>;
    connect: () => Promise<void>;
    logout: () => Promise<void>;
    fetchMessages: (pageToken?: string) => Promise<void>;
    importEmail: (msgId: string, subject: string) => Promise<string | null>;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

export function GmailProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMessages, setIsFetchingMessages] = useState(false);
    const [hasFetchFailed, setHasFetchFailed] = useState(false);
    const [messages, setMessages] = useState<GmailMessage[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [currentCategory, setCurrentCategory] = useState<GmailCategory>('primary');
    const [searchQuery, setSearchQuery] = useState('');
    // Store tokens in state to survive tab active session
    const [tokens, setTokens] = useState<any>(() => {
        const saved = sessionStorage.getItem('gmail_tokens');
        return saved ? JSON.parse(saved) : null;
    });

    const { toast } = useToast();

    const getGmailHeaders = useCallback((): Record<string, string> => {
        return tokens ? { 'x-gmail-tokens': JSON.stringify(tokens) } : {};
    }, [tokens]);

    const checkConnection = useCallback(async () => {
        try {
            const res = await apiRequest('GET', '/api/auth/check', undefined, getGmailHeaders());
            const data = await res.json();
            setIsConnected(data.isConnected);
            if (data.isConnected) {
                setHasFetchFailed(false); // Reset on check
            }
        } catch (error) {
            console.error("Check connection error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [getGmailHeaders]);

    const fetchMessages = useCallback(async (pageToken?: string) => {
        if (isFetchingMessages) return;
        setIsFetchingMessages(true);
        if (!pageToken) {
            setHasFetchFailed(false);
            setNextPageToken(null);
        }
        try {
            const baseUrl = '/api/gmail/messages';
            const params = new URLSearchParams();
            if (pageToken) params.append('pageToken', pageToken);

            if (searchQuery) {
                params.append('q', searchQuery);
            } else {
                params.append('category', currentCategory);
            }

            const url = `${baseUrl}?${params.toString()}`;
            const res = await apiRequest('GET', url, undefined, getGmailHeaders());
            if (res.ok) {
                const data = await res.json();
                if (pageToken) {
                    setMessages(prev => [...prev, ...(data.messages || [])]);
                } else {
                    setMessages(data.messages || []);
                }
                setNextPageToken(data.nextPageToken || null);
                setHasFetchFailed(false);
            } else if (res.status === 401) {
                setIsConnected(false);
                setTokens(null);
                sessionStorage.removeItem('gmail_tokens');
            } else {
                setHasFetchFailed(true);
            }
        } catch (error) {
            console.error("Fetch messages error:", error);
            setHasFetchFailed(true);
        } finally {
            setIsFetchingMessages(false);
        }
    }, [getGmailHeaders, isFetchingMessages, currentCategory, searchQuery]);

    const connect = async () => {
        try {
            const res = await apiRequest('GET', '/api/auth/google');
            const data = await res.json();
            if (data.url) {
                const width = 500;
                const height = 600;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                window.open(data.url, 'google-auth', `width=${width},height=${height},left=${left},top=${top}`);
            }
        } catch (error) {
            toast({
                title: "Errore Connessione",
                description: "Impossibile avviare il processo di autenticazione.",
                variant: "destructive",
            });
        }
    };

    const logout = async () => {
        try {
            await apiRequest('POST', '/api/auth/logout');
            setIsConnected(false);
            setMessages([]);
            setTokens(null);
            setHasFetchFailed(false);
            setNextPageToken(null);
            sessionStorage.removeItem('gmail_tokens');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const importEmail = async (msgId: string, subject: string): Promise<string | null> => {
        try {
            const res = await apiRequest('GET', `/api/gmail/message/${msgId}`, undefined, getGmailHeaders());
            if (res.ok) {
                const data = await res.json();
                return data.body;
            }
        } catch (error) {
            console.error("Import email error:", error);
            toast({
                title: "Errore Importazione",
                description: `Impossibile importare l'email: ${subject}`,
                variant: "destructive",
            });
        }
        return null;
    };

    const setCategory = useCallback((category: GmailCategory) => {
        if (category === currentCategory && !searchQuery) return;
        setCurrentCategory(category);
        setSearchQuery('');
        setMessages([]);
        setNextPageToken(null);
        setHasFetchFailed(false);
    }, [currentCategory, searchQuery]);

    useEffect(() => {
        // Run once on mount
        const init = async () => {
            await checkConnection();
        };
        init();

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
                const newTokens = event.data.tokens;
                if (newTokens) {
                    setTokens(newTokens);
                    sessionStorage.setItem('gmail_tokens', JSON.stringify(newTokens));
                }
                setIsConnected(true);
                setHasFetchFailed(false);
                setNextPageToken(null);
                toast({
                    title: "Gmail Connesso",
                    description: "La connessione a Gmail è stata stabilita.",
                });
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [toast, checkConnection]); // Solo toast e mount

    // Auto-fetch messages when connection status changes or tokens are updated
    useEffect(() => {
        if (isConnected && messages.length === 0 && !isFetchingMessages && !hasFetchFailed) {
            fetchMessages();
        }
    }, [isConnected, messages.length, isFetchingMessages, hasFetchFailed, fetchMessages]);

    return (
        <GmailContext.Provider value={{
            isConnected,
            isLoading,
            messages,
            isFetchingMessages,
            nextPageToken,
            currentCategory,
            searchQuery,
            setCategory,
            setSearchQuery,
            checkConnection,
            connect,
            logout,
            fetchMessages,
            importEmail
        }}>
            {children}
        </GmailContext.Provider>
    );
}

export function useGmail() {
    const context = useContext(GmailContext);
    if (context === undefined) {
        throw new Error("useGmail must be used within a GmailProvider");
    }
    return context;
}
