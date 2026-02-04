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
import { MentionButton } from './MentionButton';

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
    pendingMention?: string | null;
    onMentionConsumed?: () => void;
}

interface MentionContext {
    id: string;
    text: string;
    source: 'copilot' | 'template';
}

export function RefineChat({
    compileContext,
    currentContent,
    onPreview,
    isReviewing,
    onAccept,
    onReject,
    initialExplanation,
    onClose,
    minimal = false,
    pendingMention,
    onMentionConsumed
}: RefineChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
    const [mentions, setMentions] = useState<MentionContext[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
        if (pendingMention) {
            const newMention: MentionContext = {
                id: `mention-t-${Date.now()}`,
                text: pendingMention,
                source: 'template'
            };
            setMentions(prev => [...prev, newMention]);
            onMentionConsumed?.();
        }
    }, [pendingMention]);

    const handleMouseUp = () => {
        const sel = window.getSelection();
        if (sel && sel.toString().trim().length > 0 && containerRef.current) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Check if selection is within the container
            if (containerRef.current.contains(sel.anchorNode)) {
                setSelection({
                    text: sel.toString().trim(),
                    x: rect.left + rect.width / 2,
                    y: rect.top - 10
                });
            }
        } else {
            setSelection(null);
        }
    };

    const handleMentionClick = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (selection) {
            const newMention: MentionContext = {
                id: `mention-c-${Date.now()}`,
                text: selection.text,
                source: 'copilot'
            };
            setMentions(prev => [...prev, newMention]);
            setSelection(null);
            // We keep window selection for better feedback
        }
    };

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
                mentions: mentions.map(m => ({ source: m.source, text: m.text })),
                chatHistory: messages.map(m => ({ role: m.role, text: m.text }))
            });

            const data = await response.json();

            // Success might be true even if JSON parsing failed but fallback was used
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

            // Clear mentions after successful send
            setMentions([]);

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
                className="flex flex-col h-full rounded-md border border-slate-200 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs shadow-sm focus-within:ring-1 focus-within:ring-blue-500 relative"
                onMouseUp={handleMouseUp}
                ref={containerRef}
            >
                <ScrollArea className="flex-1 -mr-2 pr-2 mb-2 [&>[data-radix-scroll-area-viewport]]:h-full">
                    <div className="space-y-4">
                        {React.useMemo(() => (
                            messages.filter(m => m.role === 'ai' || m.role === 'user').map((msg) => (
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
                            ))
                        ), [messages])}
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

                <div className="relative shrink-0 flex flex-col gap-2">
                    {/* Tags Area */}
                    {mentions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-1 px-1 max-h-16 overflow-y-auto">
                            {mentions.map((m, idx) => (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    key={m.id}
                                    className="flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-semibold border border-indigo-200"
                                >
                                    <span>#{m.source === 'template' ? 'T' : 'C'}{idx + 1}</span>
                                    <span className="max-w-[80px] truncate opacity-60 font-normal">{m.text}</span>
                                    <button
                                        onClick={() => setMentions(prev => prev.filter(item => item.id !== m.id))}
                                        className="hover:text-indigo-900 transition-colors"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                    <div className="relative">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isReviewing || isLoading || isAnalyzing}
                            placeholder="Scrivi qui..."
                            className="pr-12 min-h-[60px] max-h-[150px] resize-none bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-blue-500 text-sm"
                            rows={1}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Selection Mention Button */}
                {selection && (
                    <div
                        className="fixed z-[9999]"
                        style={{
                            left: selection.x,
                            top: selection.y,
                            transform: 'translate(-50%, -100%)'
                        }}
                    >
                        <MentionButton onClick={handleMentionClick} />
                    </div>
                )}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden relative"
            onMouseUp={handleMouseUp}
            ref={containerRef}
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
                    {React.useMemo(() => (
                        messages.map((msg) => (
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
                                            : "bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-bl-none"
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
                        ))
                    ), [messages])}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex w-full justify-start"
                        >
                            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-xs text-slate-500 dark:text-slate-400">Elaborazione modifiche...</span>
                            </div>
                        </motion.div>
                    )}
                    {isAnalyzing && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex w-full justify-start"
                        >
                            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-xs text-slate-500 dark:text-slate-400">L'AI sta analizzando il documento...</span>
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
            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                {/* Tags Area */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <AnimatePresence>
                        {mentions.map((m, idx) => (
                            <motion.div
                                key={m.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 text-indigo-700 rounded-full text-xs font-semibold border border-indigo-600/20"
                            >
                                <span className="uppercase tracking-tighter opacity-70">
                                    {m.source === 'template' ? 'Menzione Template Compilato' : 'Menzione Copilot'} {idx + 1}
                                </span>
                                <button
                                    onClick={() => setMentions(prev => prev.filter(item => item.id !== m.id))}
                                    className="hover:text-indigo-900 p-0.5"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                <div className="relative">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isReviewing || isLoading || isAnalyzing}
                        placeholder={isReviewing ? "Conferma o rifiuta la modifica corrente..." : "Chiedi modifiche (es. 'Cambia la data')..."}
                        className="pr-12 min-h-[50px] max-h-[120px] resize-none rounded-xl border-slate-200 bg-slate-100 dark:bg-slate-800 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-50"
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

            {/* Selection Mention Button */}
            {selection && (
                <div
                    className="fixed z-[9999]"
                    style={{
                        left: selection.x,
                        top: selection.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <MentionButton onClick={handleMentionClick} />
                </div>
            )}
        </motion.div>
    );
}
