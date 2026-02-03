import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, Sparkles, X } from "lucide-react";
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
    onPreview: (newContent: string) => void;
    isReviewing: boolean;
    onAccept: () => void;
    onReject: () => void;
    initialExplanation?: string;
    onClose?: () => void;
    minimal?: boolean;
}

export function RefineChat({ compileContext, currentContent, onPreview, isReviewing, onAccept, onReject, initialExplanation, onClose, minimal = false }: RefineChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
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

    // In minimal mode, we might want to pre-fill the input with the AI's message 
    // to simulate "the model wrote into the text field", allowing the user to read and then clear/type.
    // OR we relies on placeholder? 
    // User expectation: "Compare la risposta del modello".
    // Let's use a state that combines everything for the minimal view.
    // Actually, `messages` are the source of truth.
    // If minimal, we display the LAST AI message as a read-only block? No, "campo di testo".
    // Let's just render the Textarea.

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Minimal Mode Effect: When a new AI message arrives, update 'input'?
    // Disadvantage: User loses what they typed if they were typing. (Unlikely in turn-based).
    // Let's try: The text interface SHOWS the interaction.
    // But the user specifically asked for "campo di testo... che si allarga".
    // I'll stick to standard chat logic state, but RENDER only the textarea.
    // But what does the user see?
    // I will show the LAST message from the AI as the "Placeholder" (if input empty).
    // Visual Hack: Use a value derived from "Input" (if typing) OR "Last AI Message" (if idle).

    const lastAiMessage = messages.slice().reverse().find(m => m.role === 'ai')?.text || "";

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || isReviewing) return;

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

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                text: data.explanation || "Ecco la bozza modificata. Controlla e conferma.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);

            if (data.newContent) {
                onPreview(data.newContent);
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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (minimal) {
        // Minimal Console Mode
        // We show the Input value.
        // If Input is empty and we are NOT loading, we show the last AI message as a "prompt" or pseudo-value.
        // Actually, to make it feel like "the model replied inside the field", let's render the last AI message
        // UNTIL the user focuses or starts typing? 
        // Or cleaner: Just show the Last AI Message as the value, and when user types, they replace it?
        // Let's rely on standard Placeholder behavior with the AI message as placeholder.
        // PROBLEM: Placeholders are gray and cutoff. 
        // SOLUTION: We render a Textarea. If input is empty, we show a standard placeholder or the AI message?
        // The user wants "Dissolvenza".
        // Let's try: Display the AI message. User types blindly? No.

        // Revised Minimal Logic:
        // We treat the "Conversation" as a single buffer? No.
        // Let's show:
        // 1. Textarea for Input.
        // 2. ABOVE it (or inside via absolute positioning?) the AI response fading in/out?
        // User said: "All'interno di questo campo di testo".
        // I will use a simple textarea. The `value` is `input`. 
        // The `placeholder` is `lastAiMessage`.
        // This is safe and standard.
        // "Dissolvenza" happens when the component mounts (already handled by parent).

        // Wait, if I use placeholder, it will look like gray ghost text. 
        // The user might want it to look like real text.
        // Let's try using `input` state to HOLD the AI message initially?
        // Yes. When AI replies, we `setInput(aiMsg.text)`. User can edit it to send? 
        // No, that sends the AI message back.
        // Let's stick to: Textarea is for USER input.
        // But we need to show the AI output.
        // "Compare ... la risposta del modello".
        // I will render the AI response as a styled block *within* the container, and the Input below it?
        // User said: "Soltanto il campo di testo".
        // Maybe the interactions are just text lines?
        // Let's implement a "Log" style textarea.
        // No, keep it simple.
        // Textarea `value` = `input`.
        // AI response is rendered as a clean paragraph *above* the input in a shared container that *looks* like one text area?
        // User said "Al posto della seconda foto".
        // Let's try:
        // Container (looks like textarea)
        //   - AI Message (Text)
        //   - Input (Textarea, transparent, no border)

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col h-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring"
            >
                <ScrollArea className="flex-1 -mr-2 pr-2 mb-2">
                    <div className="space-y-4">
                        {messages.filter(m => m.role === 'ai' || m.role === 'user').map((msg) => (
                            <div key={msg.id} className={cn(
                                "text-xs leading-relaxed",
                                msg.role === 'user' ? "font-bold text-slate-800" : "text-slate-600"
                            )}>
                                {msg.role === 'user' ? "> " : ""}{msg.text}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-slate-400 italic">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Scrivendo...
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="relative shrink-0">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isReviewing || isLoading}
                        placeholder="Scrivi qui..."
                        className="min-h-[40px] w-full resize-none bg-transparent border-0 p-0 focus-visible:ring-0 placeholder:text-slate-400"
                        rows={1}
                        autoFocus
                    />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden"
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full hover:bg-slate-100">
                        <X className="w-4 h-4 text-slate-500" />
                    </Button>
                )}
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
                                Controlla l&apos;anteprima a destra e conferma/rifiuta.
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
