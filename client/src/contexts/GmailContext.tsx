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

interface GmailContextType {
    isConnected: boolean;
    isLoading: boolean;
    messages: GmailMessage[];
    isFetchingMessages: boolean;
    checkConnection: () => Promise<void>;
    connect: () => Promise<void>;
    logout: () => Promise<void>;
    fetchMessages: () => Promise<void>;
    importEmail: (msgId: string, subject: string) => Promise<string | null>;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

export function GmailProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMessages, setIsFetchingMessages] = useState(false);
    const [messages, setMessages] = useState<GmailMessage[]>([]);
    const { toast } = useToast();

    const checkConnection = useCallback(async () => {
        try {
            const res = await apiRequest('GET', '/api/auth/check');
            const data = await res.json();
            setIsConnected(data.isConnected);
            if (data.isConnected && messages.length === 0) {
                // Only auto-fetch if connected and we don't have messages yet
                fetchMessages();
            }
        } catch (error) {
            console.error("Check connection error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [messages.length]);

    const fetchMessages = useCallback(async () => {
        setIsFetchingMessages(true);
        try {
            const res = await apiRequest('GET', '/api/gmail/messages');
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            } else {
                setIsConnected(false); // Token might have expired
            }
        } catch (error) {
            console.error("Fetch messages error:", error);
        } finally {
            setIsFetchingMessages(false);
        }
    }, []);

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
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const importEmail = async (msgId: string, subject: string): Promise<string | null> => {
        try {
            const res = await apiRequest('GET', `/api/gmail/message/${msgId}`);
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

    useEffect(() => {
        checkConnection();

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
                setIsConnected(true);
                fetchMessages();
                toast({
                    title: "Gmail Connesso",
                    description: "La connessione a Gmail è stata stabilita.",
                });
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [checkConnection, fetchMessages, toast]);

    return (
        <GmailContext.Provider value={{
            isConnected,
            isLoading,
            messages,
            isFetchingMessages,
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
