import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-config";
import { apiRequest } from "@/lib/queryClient";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Analysis Trigger
    useEffect(() => {
        if (compileContext && messages.length === 0 && !isAnalyzing) {
            performInitialAnalysis();
        }
    }, [compileContext]);

    const performInitialAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const analysisPrompt = "Effettua un'analisi iniziale del documento appena compilato. Riassumi brevemente il contenuto, identifica chiaramente quale documento è stato usato come Master Pin (se presente) e quali fonti hai consultato. Concludi chiedendo come posso aiutarti oggi.";
            console.log("[RefineChat] Triggering initial analysis...");
            const response = await apiRequest('POST', '/api/refine', {
                compileContext,
                currentContent,
                userInstruction: analysisPrompt,
                chatHistory: []
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            const aiMsg: ChatMessage = {
                id: 'init-analysis',
                role: 'ai',
                text: data.explanation || "Analisi completata. Pronti per le tue modifiche.",
                timestamp: new Date()
            };
            setMessages([aiMsg]);

        } catch (error) {
            console.error("Initial analysis error:", error);
            const errorMsg = error instanceof Error ? error.message : "Errore sconosciuto";
            setMessages([{
                id: 'init-err',
                role: 'ai',
                text: `Documento pronto. C'è stato un intoppo durante l'analisi: ${errorMsg}. Puoi comunque scrivermi qui sotto per qualsiasi chiarimento.`,
                timestamp: new Date()
            }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const lastAiMessage = messages.slice().reverse().find(m => m.role === 'ai')?.text || "";

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || isReviewing || isAnalyzing) return;

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
            const response = await apiRequest('POST', '/api/refine', {
                compileContext,
                currentContent,
                userInstruction: userMsg.text,
                chatHistory: messages.map(m => ({ role: m.role, text: m.text }))
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
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col h-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring"
            >
                <ScrollArea className="flex-1 -mr-2 pr-2 mb-2 [&>[data-radix-scroll-area-viewport]]:h-full">
                    <div className="space-y-4">
                        {messages.filter(m => m.role === 'ai' || m.role === 'user').map((msg) => (
                            <div key={msg.id} className={cn(
                                "text-xs leading-relaxed break-words",
                                msg.role === 'user' ? "font-bold text-slate-800" : "text-slate-600"
                            )}>
                                {msg.role === 'user' ? "> " + msg.text : (
                                    <div className="max-w-full overflow-hidden">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-1" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-1" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-0.5" {...props} />,
                                                table: ({ node, ...props }) => (
                                                    <div className="overflow-x-auto my-1 rounded border border-slate-200 bg-white/50">
                                                        <table className="border-collapse w-full text-[10px]" {...props} />
                                                    </div>
                                                ),
                                                th: ({ node, ...props }) => <th className="border-b border-slate-200 px-1 py-0.5 bg-slate-50 text-left" {...props} />,
                                                td: ({ node, ...props }) => <td className="border-b border-slate-100 px-1 py-0.5 last:border-0" {...props} />,
                                                input: ({ node, ...props }) => (
                                                    <input
                                                        type="checkbox"
                                                        className="mr-1 w-3 h-3 rounded-sm border-slate-300 text-blue-600 pointer-events-none align-middle"
                                                        readOnly
                                                        checked={props.checked}
                                                        {...props}
                                                    />
                                                ),
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-slate-400 italic">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Scrivendo...
                            </div>
                        )}
                        {isAnalyzing && (
                            <div className="flex items-center gap-2 text-slate-400 italic">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Analisi in corso...
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="relative shrink-0">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isReviewing || isLoading || isAnalyzing}
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
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                ) : (
                                    <div className="prose prose-sm max-w-none prose-slate chat-markdown">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed text-slate-700" {...props} />,
                                                ul: ({ node, ...props }) => <ul className="list-disc ml-4 mb-2 text-slate-700" {...props} />,
                                                ol: ({ node, ...props }) => <ol className="list-decimal ml-4 mb-2 text-slate-700" {...props} />,
                                                li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                                a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                                blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-slate-300 pl-4 italic my-2 text-slate-600" {...props} />,
                                                table: ({ node, ...props }) => (
                                                    <div className="overflow-x-auto my-3 rounded-lg border border-slate-200 border-collapse">
                                                        <table className="min-w-full divide-y divide-slate-200 text-xs" {...props} />
                                                    </div>
                                                ),
                                                thead: ({ node, ...props }) => <thead className="bg-slate-50" {...props} />,
                                                th: ({ node, ...props }) => <th className="px-3 py-2 text-left font-semibold text-slate-900 border-b border-slate-200" {...props} />,
                                                td: ({ node, ...props }) => <td className="px-3 py-2 text-slate-700 border-b border-slate-100 last:border-b-0" {...props} />,
                                                code: ({ node, inline, ...props }: any) => (
                                                    <code
                                                        className={cn(
                                                            "bg-slate-100 rounded px-1 py-0.5 font-mono text-[10px] text-slate-800",
                                                            !inline && "block p-2 my-2 overflow-x-auto whitespace-pre bg-slate-50 border border-slate-200 rounded-md"
                                                        )}
                                                        {...props}
                                                    />
                                                ),
                                                input: ({ node, ...props }) => (
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mr-2 align-middle pointer-events-none"
                                                        readOnly
                                                        checked={props.checked}
                                                        {...props}
                                                    />
                                                ),
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                )}
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
                    {isAnalyzing && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex w-full justify-start"
                        >
                            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-xs text-slate-500">L'AI sta analizzando il documento...</span>
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
                        disabled={isReviewing || isLoading || isAnalyzing}
                        placeholder={isReviewing ? "Conferma o rifiuta la modifica corrente..." : "Chiedi modifiche (es. 'Cambia la data')..."}
                        className="pr-12 min-h-[50px] max-h-[120px] resize-none rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
                        rows={1}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || isReviewing || isAnalyzing}
                        className="absolute right-1 bottom-1 h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors disabled:bg-slate-300"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
