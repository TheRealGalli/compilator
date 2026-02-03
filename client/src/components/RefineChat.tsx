import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: Date;
}

interface RefineChatProps {
    compileContext: any;
    currentContent: string;
    onPreview: (newContent: string) => void; // Changed from onUpdateContent
    isReviewing: boolean; // Sync with parent state
    onAccept: () => void;
    onReject: () => void;
    initialExplanation?: string;
}

export function RefineChat({ compileContext, currentContent, onPreview, isReviewing, onAccept, onReject, initialExplanation }: RefineChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        // ... initial state mostly same
        if (initialExplanation) {
            return [{
                id: 'init-1',
                role: 'ai',
                text: initialExplanation,
                timestamp: new Date()
            }];
        }
        return [{
            id: 'init-0',
            role: 'ai',
            text: "Documento compilato! Sono pronto a fare modifiche. Scrivimi cosa vuoi cambiare.",
            timestamp: new Date()
        }];
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Hook: If isReviewing becomes FALSE, and we had a pending update logic?
    // Actually the parent handles the content commitment. 
    // We just need to know if we are blocked from sending new requests?
    // Ideally user should Confirm/Reject before sending NEW chat messages to avoid branching confusion.
    // So let's disable Input if isReviewing is true.

    const handleSend = async () => {
        if (!input.trim() || isLoading || isReviewing) return; // Block input during review

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    compileContext,
                    currentContent,
                    userInstruction: userMsg.text,
                    chatHistory: messages.map(m => ({ role: m.role, text: m.text }))
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            // Add AI response
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                text: data.explanation || "Ecco la bozza modificata. Controlla e conferma.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);

            if (data.newContent) {
                onPreview(data.newContent); // Trigger Preview Mode in Parent
            }

        } catch (error) {
            console.error("Refine error:", error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                text: "Errore durante la modifica. Riprova.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // ... Handle KeyDown ...
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden"
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Bot className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-800">Document Co-pilot</h3>
                    <p className="text-xs text-slate-500">
                        {isReviewing ? "In attesa di conferma..." : "Pronto a modificare"}
                    </p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex w-full",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                                )}
                            >
                                {msg.text}
                            </div>
                        </motion.div>
                    ))}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex w-full justify-start"
                        >
                            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-xs text-slate-500">Elaborazione modifiche...</span>
                            </div>
                        </motion.div>
                    )}
                    {/* Guidance Message when reviewing */}
                    {isReviewing && !isLoading && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex w-full justify-center"
                        >
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full px-4 py-1.5 text-xs font-medium shadow-sm flex items-center gap-2 animate-pulse">
                                <Sparkles className="w-3 h-3" />
                                Controlla l'anteprima a destra e conferma/rifiuta.
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200">
                <div className="relative">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isReviewing || isLoading}
                        placeholder={isReviewing ? "Conferma o rifiuta la modifica corrente..." : "Chiedi modifiche (es. 'Cambia la data')..."}
                        className="pr-12 min-h-[50px] max-h-[120px] resize-none rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                        rows={1}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || isReviewing}
                        className="absolute right-1 bottom-1 h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:bg-slate-300"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
