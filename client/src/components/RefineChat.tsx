import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { useCompiler } from '@/contexts/CompilerContext';
import { useQuery } from '@tanstack/react-query';
import { type User as UserType } from '@shared/schema';
import { anonymizeWithOllamaLocal, performMechanicalReverseSweep, performMechanicalGlobalSweep } from '@/lib/privacy';
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: Date;
    groundingMetadata?: any;
}

interface RefineChatProps {
    compileContext: any;
    currentContent: string;
    anonymizedContent?: string;
    onPreview: (newContent: string, newAnonymizedContent?: string) => void;
    isReviewing: boolean;
    onAccept: () => void;
    onReject: () => void;
    initialExplanation?: string;
    onClose?: () => void;
    minimal?: boolean;
    pendingMention?: { text: string; id: string; start?: number; end?: number } | null;
    onMentionConsumed?: () => void;
    onMentionCreated?: (text: string, source: 'copilot' | 'template' | 'anteprema', start?: number, end?: number) => void;
    selectedModel?: string;
}

interface MentionContext {
    id: string;
    text: string;
    label: string;
    source: 'copilot' | 'template' | 'anteprema';
    start?: number;
    end?: number;
    surroundingContext?: string;
}

export function RefineChat({
    compileContext,
    currentContent,
    anonymizedContent,
    onPreview,
    isReviewing,
    onAccept,
    onReject,
    initialExplanation,
    onClose,
    minimal = false,
    pendingMention,
    onMentionConsumed,
    onMentionCreated,
    selectedModel = "gpt-oss:20b" // Default fallback
}: RefineChatProps) {
    const { data: user } = useQuery<UserType>({ queryKey: ['/api/user'] });
    const {
        messages, setMessages,
        mentions, setMentions,
        mentionRegistry, setMentionRegistry,
        guardrailVault, setGuardrailVault
    } = useCompiler();
    const { toast } = useToast();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
    const [isMouseDown, setIsMouseDown] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
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
            const response = await apiRequest('POST', '/api/refine', {
                compileContext,
                currentContent: compileContext.activeGuardrails?.includes('pawn')
                    ? performMechanicalGlobalSweep(anonymizedContent || currentContent, guardrailVault)
                    : currentContent,
                userInstruction: analysisPrompt,
                chatHistory: [],
                webResearch: compileContext.webResearch,
                ollamaModel: selectedModel
            });

            const data = await response.json();
            console.log(`[RefineChat] >> RAW SERVER RESPONSE (Initial Analysis) <<\n${data.explanation}\n>> END RESPONSE <<`);
            if (!data.success) throw new Error(data.error);

            // ANTI-LOOP: Check for loop detection from AI
            if (data.explanation?.includes("LOOP_DETECTED")) {
                toast({
                    title: "Loop Rilevato",
                    description: "L'AI ha interrotto l'analisi per evitare un loop. Prova a ricaricare la pagina.",
                    variant: "destructive",
                });
            }

            const aiMsg: ChatMessage = {
                id: 'init-analysis',
                role: 'ai',
                // DE-ANONYMIZE INITIAL ANALYSIS (Reverse Sweep)
                // Se Pawn è attivo, mostriamo la risposta de-pseudonimizzata nel chat (per comodità utente)
                // ma il template di anteprima rimarrà pseudonimizzato per controllo sicurezza.
                text: (compileContext.activeGuardrails?.includes('pawn') && data.explanation)
                    ? performMechanicalReverseSweep(data.explanation, guardrailVault)
                    : (data.explanation || "Analisi completata. Pronti per le tue modifiche."),
                timestamp: new Date(),
                groundingMetadata: data.groundingMetadata
            };

            // ZERO-DATA: Vault stays client-side, server never sends it back

            setMessages(prev => {
                if (prev.length > 0) {
                    return prev;
                }
                return [aiMsg];
            });

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
                id: `mention-${Date.now()}`,
                text: pendingMention.text,
                label: pendingMention.id,
                source: pendingMention.id.startsWith('#A') ? 'anteprema' : 'template',
                start: pendingMention.start,
                end: pendingMention.end
            };
            setMentions(prev => [...prev, newMention]);
            setMentionRegistry(prev => [...prev, newMention]); // Persist to session registry
            onMentionConsumed?.();
        }
    }, [pendingMention, setMentions, setMentionRegistry, onMentionConsumed]);


    const updateSelectionPosition = useCallback(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') || scrollRef.current;
        if (!viewport) return;

        const viewportRect = viewport.getBoundingClientRect();
        const sel = window.getSelection();
        const selectedText = sel?.toString().trim();

        if (selectedText && selectedText.length > 0) {
            const container = containerRef.current;
            if (!container || !container.contains(sel?.anchorNode || null)) {
                setSelection(null);
                return;
            }

            const range = sel?.getRangeAt(0);
            const rects = range?.getClientRects();
            if (!rects || rects.length === 0) return;

            const firstRect = rects[0];

            // Visibility check: is the selection within viewport bounds?
            const isVisible = (
                firstRect.top >= viewportRect.top - 5 &&
                firstRect.bottom <= viewportRect.bottom + 5
            );

            if (isVisible) {
                setSelection({
                    text: selectedText,
                    x: firstRect.left + (firstRect.width / 2),
                    y: firstRect.top - 12
                });
                return;
            }
        }
        setSelection(null);
    }, []);

    // Track global selection and scroll events
    useEffect(() => {
        const handleMouseUp = () => {
            requestAnimationFrame(updateSelectionPosition);
        };

        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') || scrollRef.current;

        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('resize', updateSelectionPosition);
        if (viewport) {
            viewport.addEventListener('scroll', updateSelectionPosition, { passive: true });
        }

        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('resize', updateSelectionPosition);
            if (viewport) {
                viewport.removeEventListener('scroll', updateSelectionPosition);
            }
        };
    }, [updateSelectionPosition]);

    const handleMouseUp = (e: React.MouseEvent) => {
        // This is now redundant with the window listener, but we keep it for safety 
        // to prevent event bubbling issues if needed, or simply let window handle it.
    };

    const handleMentionClick = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (selection) {
            // Compute character offset of this selection within the document
            // to disambiguate duplicate text (e.g., "000856" appearing multiple times)
            let charStart: number | undefined;
            let charEnd: number | undefined;
            let surroundingContext = '';

            // Get precise surrounding text directly from the DOM node the user selected in!
            // This perfectly disambiguates duplicate text (e.g., two identical names in different paragraphs)
            const sel = window.getSelection();
            if (sel && sel.anchorNode && sel.anchorNode.textContent) {
                surroundingContext = sel.anchorNode.textContent.trim();
                // Truncate if ridiculously long, but keep a good chunk
                if (surroundingContext.length > 200) {
                    const localIdx = surroundingContext.indexOf(selection.text);
                    if (localIdx !== -1) {
                        const ctxStart = Math.max(0, localIdx - 60);
                        const ctxEnd = Math.min(surroundingContext.length, localIdx + selection.text.length + 60);
                        surroundingContext = surroundingContext.substring(ctxStart, ctxEnd);
                    } else {
                        surroundingContext = surroundingContext.substring(0, 200) + '...';
                    }
                }
            }

            if (currentContent && !surroundingContext) {
                const idx = currentContent.indexOf(selection.text);
                if (idx !== -1) {
                    charStart = idx;
                    charEnd = idx + selection.text.length;

                    // Extract surrounding context (30 chars before + after) for disambiguation
                    const ctxStart = Math.max(0, idx - 30);
                    const ctxEnd = Math.min(currentContent.length, idx + selection.text.length + 30);
                    surroundingContext = currentContent.substring(ctxStart, ctxEnd);
                }
            }

            const newMention: MentionContext = {
                id: `mention-${Date.now()}`,
                text: selection.text,
                label: `Selection-${Date.now().toString().slice(-4)}`,
                source: isReviewing ? 'anteprema' : 'copilot',
                start: charStart,
                end: charEnd,
                surroundingContext
            };
            onMentionCreated?.(selection.text, isReviewing ? 'anteprema' : 'copilot', charStart, charEnd);
            setMentionRegistry(prev => [...prev, newMention]);
            setSelection(null);
        }
    };

    const handleSend = async () => {
        const hasAntepremaMention = mentions.some(m => m.source === 'anteprema');
        if (!input.trim() || isLoading || (isReviewing && !hasAntepremaMention) || isAnalyzing) return;

        const mentionLabels = mentions.map(m => m.label).join(' ');
        const messageWithMentions = input + (mentionLabels ? ` (${mentionLabels})` : '');

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: messageWithMentions,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setMentions([]); // Clear immediately for UX feedback
        setIsLoading(true);

        try {
            // CHECK IF PAWN (PRIVACY) IS ACTIVE
            const isPawnActive = compileContext.activeGuardrails?.includes('pawn');
            console.log(`[RefineChat] Pawn Guardrail is ${isPawnActive ? 'ACTIVE' : 'INACTIVE'}`);

            let finalUserInstruction = userMsg.text;
            let finalCurrentContent = anonymizedContent || currentContent;
            let finalNotes = compileContext.notes;
            let updatedVault = guardrailVault;
            let sweptMentions = mentions;
            let sweptRegistry = mentionRegistry;

            if (isPawnActive) {
                // PRIVACY: Anonymize user instruction locally before sending
                console.log(`[RefineChat] Anonymizing instruction: "${userMsg.text}" with model ${selectedModel}...`);
                const result = await anonymizeWithOllamaLocal(
                    userMsg.text,
                    guardrailVault,
                    selectedModel
                );
                finalUserInstruction = result.anonymized;
                updatedVault = result.newVault;

                // Update local vault immediately
                setGuardrailVault(updatedVault);

                // PRIVACY CRITICAL: Anonymize the DOCUMENT CONTENT and NOTES using the updated vault.
                // We base our sweep on anonymizedContent if available to avoid re-introducing clear text.
                finalCurrentContent = performMechanicalGlobalSweep(anonymizedContent || currentContent, updatedVault);
                finalNotes = compileContext.notes ? performMechanicalGlobalSweep(compileContext.notes, updatedVault) : compileContext.notes;

                // PRIVACY CRITICAL: Anonymize MENTIONS payload because the user highlighted deciphered text
                // but the backend AI only understands pseudonymized text!
                sweptMentions = mentions.map(m => ({
                    ...m,
                    text: performMechanicalGlobalSweep(m.text, updatedVault),
                    surroundingContext: m.surroundingContext ? performMechanicalGlobalSweep(m.surroundingContext, updatedVault) : undefined
                }));

                sweptRegistry = mentionRegistry.map(m => ({
                    ...m,
                    text: performMechanicalGlobalSweep(m.text, updatedVault),
                    surroundingContext: m.surroundingContext ? performMechanicalGlobalSweep(m.surroundingContext, updatedVault) : undefined
                }));
            }

            const response = await apiRequest('POST', '/api/refine', {
                compileContext: {
                    ...compileContext,
                    notes: finalNotes // Send potentially anonymized notes
                },
                currentContent: finalCurrentContent, // Send potentially anonymized content

                userInstruction: finalUserInstruction,
                mentions: sweptMentions.map(m => ({ source: m.source, text: m.text, label: m.label, start: m.start, end: m.end, surroundingContext: m.surroundingContext })),
                mentionRegistry: sweptRegistry.map(m => ({ source: m.source, text: m.text, label: m.label, start: m.start, end: m.end, surroundingContext: m.surroundingContext })),
                chatHistory: messages.map(m => ({
                    role: m.role,
                    text: isPawnActive ? performMechanicalGlobalSweep(m.text, updatedVault) : m.text
                })),
                webResearch: compileContext.webResearch,
                ollamaModel: selectedModel
                // ZERO-DATA: Vault NEVER sent to server
            });

            const data = await response.json();
            console.log(`[RefineChat] >> RAW SERVER RESPONSE (Explanation) <<\n${data.explanation}\n>> END RESPONSE <<`);
            if (data.newContent) {
                console.log(`[RefineChat] >> RAW SERVER RESPONSE (New Content) <<\n${data.newContent}\n>> END RESPONSE <<`);
            }

            // ANTI-LOOP: Check for loop detection from AI
            if (data.explanation?.includes("LOOP_DETECTED") || data.newContent?.includes("LOOP_DETECTED")) {
                toast({
                    title: "Loop Rilevato",
                    description: "L'AI ha interrotto la generazione per un possibile loop. Ricarica la pagina per ripristinare il contesto.",
                    variant: "destructive",
                });
            }

            // Success might be true even if JSON parsing failed but fallback was used
            if (!data.success) throw new Error(data.error);

            // PRIVACY: De-anonymize the explanation received from AI
            const rawExplanation = data.explanation || "Ecco la bozza modificata. Controlla e conferma.";
            let deanonymizedExplanation = rawExplanation;

            // Only de-anonymize if Pawn was active (otherwise server returned clear text)
            if (isPawnActive) {
                deanonymizedExplanation = performMechanicalReverseSweep(rawExplanation, updatedVault);
            }

            // Add de-anonymized AI message to chat history
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                text: deanonymizedExplanation, // Show real values (Reverse Swept)
                timestamp: new Date(),
                groundingMetadata: data.groundingMetadata
            };


            // ZERO-DATA: Vault stays client-side, server never sends it back

            setMessages(prev => [...prev, aiMsg]);

            if (data.newContent) {
                // PAWN: In anteprima (Reviewing), mostriamo i dati REALI all'utente (Reverse Sweep).
                // Lo scambio con il server rimane basato sui token, ma l'utente deve vedere il risultato finale.
                const contentToShow = isPawnActive
                    ? performMechanicalReverseSweep(data.newContent, updatedVault)
                    : data.newContent;
                onPreview(contentToShow, data.newContent);
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
                className="flex flex-col h-full rounded-md border border-slate-200 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs shadow-sm focus-within:ring-1 focus-within:ring-blue-500 relative"
                onMouseUp={handleMouseUp}
                ref={containerRef}
            >
                <ScrollArea ref={scrollAreaRef} className="flex-1 -mr-2 pr-4 mb-2 [&>[data-radix-scroll-area-viewport]]:h-full">
                    <div className="space-y-4">
                        {React.useMemo(() => (
                            messages.filter(m => m.role === 'ai' || m.role === 'user').map((msg) => (
                                <div key={msg.id} className={cn(
                                    "text-xs leading-relaxed break-words px-1",
                                    msg.role === 'user' ? "font-bold text-slate-800" : "text-slate-600"
                                )}>
                                    {msg.role === 'user' ? "> " + msg.text : (
                                        <div className="max-w-full">
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

                                            {/* Grounding Sources (Google Search) for Minimal Mode */}
                                            {msg.groundingMetadata?.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-slate-200 w-full">
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                        {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                                                            <a
                                                                key={i}
                                                                href={chunk.web?.uri || '#'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 group/link opacity-80 hover:opacity-100"
                                                            >
                                                                <div className="w-3.5 h-3.5 flex items-center justify-center rounded-sm bg-blue-50 text-[8px] font-bold text-blue-600 border border-blue-100">
                                                                    {i + 1}
                                                                </div>
                                                                <span className="text-[10px] text-blue-600 font-medium hover:underline line-clamp-1 max-w-[120px]">
                                                                    {chunk.web?.title || 'Fonte Web'}
                                                                </span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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

                <div className="relative shrink-0 flex flex-col pt-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    {/* Tags Area (Internal) */}
                    {mentions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5 px-3 max-h-20 overflow-y-auto mentions-tag-area">
                            {mentions.map((m) => (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    key={m.id}
                                    className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/10 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-600/20"
                                >
                                    <span>{m.label}</span>
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
                    <div className="relative pr-2 pb-1">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isReviewing || isLoading || isAnalyzing}
                            placeholder="Scrivi qui..."
                            className="w-full min-h-[60px] max-h-[150px] resize-none bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-transparent text-sm shadow-none px-2"
                            rows={1}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Selection Mention Button */}
                {selection && createPortal(
                    <div
                        className="fixed z-[99999] pointer-events-auto"
                        style={{
                            left: selection.x,
                            top: selection.y,
                            transform: 'translate(-50%, -100%)'
                        }}
                    >
                        <MentionButton onClick={handleMentionClick} />
                    </div>,
                    document.body
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
                                    "flex w-full mb-3 max-w-[85%] relative",
                                    msg.role === 'user' ? "justify-end ml-auto" : "justify-start mr-auto"
                                )}>
                                {msg.role === 'user' && (user?.avatarUrl || compileContext.userInitial) && !minimal && (
                                    <div className="absolute -right-10 w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                        {user?.avatarUrl ? (
                                            <img src={user.avatarUrl} alt="User" className="w-full h-full object-cover" />
                                        ) : (
                                            compileContext.userInitial
                                        )}
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-3 text-sm shadow-sm break-words overflow-hidden",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : "bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-bl-none"
                                    )}
                                >
                                    {msg.role === 'user' ? (
                                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                    ) : (
                                        <div className="prose prose-sm max-w-none prose-slate chat-markdown break-words">
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

                                            {/* Grounding Sources (Google Search) for Standard Mode */}
                                            {msg.groundingMetadata?.groundingChunks && msg.groundingMetadata.groundingChunks.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-600 w-full">
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Fonti di Ricerca</span>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                                        {msg.groundingMetadata.groundingChunks.map((chunk: any, i: number) => (
                                                            <a
                                                                key={i}
                                                                href={chunk.web?.uri || '#'}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1.5 group/link"
                                                            >
                                                                <div className="w-4 h-4 flex items-center justify-center rounded-sm bg-blue-100 dark:bg-blue-900/30 text-[9px] font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors">
                                                                    {i + 1}
                                                                </div>
                                                                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:underline line-clamp-1 max-w-[200px]">
                                                                    {chunk.web?.title || 'Fonte Web'}
                                                                </span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
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
                <div className="relative flex flex-col pt-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                    {/* Tags Area (Internal) */}
                    <AnimatePresence>
                        {mentions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-1.5 px-3 pt-2 mentions-tag-area">
                                {mentions.map((m) => (
                                    <motion.div
                                        key={m.id}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-600/10 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-600/20"
                                    >
                                        <span>{m.label}</span>
                                        <button
                                            onClick={() => setMentions(prev => prev.filter(item => item.id !== m.id))}
                                            className="hover:text-indigo-900 p-0.5"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>

                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isReviewing || isLoading || isAnalyzing}
                        placeholder={isReviewing ? "Controlla l'anteprima nel PDF..." : "Chiedi modifiche (es. 'Cambia la data')..."}
                        className="w-full min-h-[50px] max-h-[120px] resize-none border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-transparent shadow-none text-sm px-3"
                        rows={1}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading || isReviewing || isAnalyzing}
                        className="absolute right-2 bottom-2 h-8 w-8 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:bg-slate-300 text-white shadow-lg shadow-blue-500/20"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Selection Mention Button */}
            {selection && createPortal(
                <div
                    className="fixed z-[99999] pointer-events-auto"
                    style={{
                        left: selection.x,
                        top: selection.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <MentionButton onClick={handleMentionClick} />
                </div>,
                document.body
            )}
        </motion.div>
    );
}
