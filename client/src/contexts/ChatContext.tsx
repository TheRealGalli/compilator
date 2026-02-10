import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getApiUrl } from "@/lib/api-config";
import { useSources } from "./SourcesContext";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    sources?: string[];
    audioUrl?: string;
    groundingMetadata?: any;
    searchEntryPoint?: string;
    shortTitle?: string;
    aiMetadata?: {
        codeExecutionResults?: Array<{ code: string; output: string }>;
    };
}

interface ChatContextType {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    isGreetingLoading: boolean;
    suggestedPrompts: string[];
    setSuggestedPrompts: React.Dispatch<React.SetStateAction<string[]>>;
    refreshGreeting: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isGreetingLoading, setIsGreetingLoading] = useState(false);
    const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
    const { selectedSources } = useSources();

    const refreshGreeting = useCallback(async () => {
        // Se abbiamo già dei messaggi, non rifacciamo il saluto a meno che non sia esplicito
        if (messages.length > 0) return;

        setIsGreetingLoading(true);
        try {
            const url = new URL(getApiUrl('/api/greeting'), window.location.origin);
            if (selectedSources && selectedSources.length > 0) {
                url.searchParams.append('sources', JSON.stringify(selectedSources.map(s => ({
                    id: s.id,
                    name: s.name,
                    type: s.type,
                    base64: s.base64,
                    isMemory: s.isMemory,
                    driveId: s.driveId
                }))));
            }

            const res = await fetch(url.toString());
            if (res.ok) {
                const data = await res.json();
                setMessages([{
                    id: "greeting",
                    role: "assistant",
                    content: data.text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
                if (data.suggestedQuestions) {
                    setSuggestedPrompts(data.suggestedQuestions);
                }
            } else {
                throw new Error('Failed to fetch greeting');
            }
        } catch (error) {
            console.error('Error fetching greeting:', error);
            // Fallback greeting if it's the first time
            setMessages([{
                id: "greeting-fallback",
                role: "assistant",
                content: "Ciao! Sono Gromit, il tuo assistente per l'analisi documentale. Come posso aiutarti oggi?",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
            setSuggestedPrompts(["Riassumi i punti chiave", "Quali sono i risultati?", "Note di studio", "Crea una FAQ"]);
        } finally {
            setIsGreetingLoading(false);
        }
    }, [selectedSources, messages.length]);

    // Carica il saluto solo all'inizio se non ci sono messaggi
    useEffect(() => {
        if (messages.length === 0 && !isGreetingLoading) {
            refreshGreeting();
        }
    }, []);

    return (
        <ChatContext.Provider value={{
            messages,
            setMessages,
            isGreetingLoading,
            suggestedPrompts,
            setSuggestedPrompts,
            refreshGreeting
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error("useChat must be used within a ChatProvider");
    }
    return context;
}
