import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Wand2, CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StudioStep {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    description?: string;
}

interface StudioMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    steps?: StudioStep[];
    timestamp: string;
}

interface StudioChatProps {
    onAgentAction?: (action: any) => void;
    isProcessing?: boolean;
    pinnedSource: any;
    currentFields: any[];
}

export function StudioChat({ onAgentAction, isProcessing, pinnedSource, currentFields }: StudioChatProps) {
    const [messages, setMessages] = useState<StudioMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isFirstRun = useRef(true);
    const { toast } = useToast();

    // Auto-start agent on first mount (triggered by Star 2)
    useEffect(() => {
        if (isFirstRun.current && pinnedSource) {
            isFirstRun.current = false;
            autoStartAgent();
        }
    }, [pinnedSource]);

    const autoStartAgent = async () => {
        const welcomeMessage: StudioMessage = {
            id: "welcome",
            role: "assistant",
            content: "Ciao! Sto analizzando il documento per procedere con la compilazione automatica...",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages([welcomeMessage]);
        setIsLoading(true);

        try {
            const res = await apiRequest('POST', '/api/studio/chat', {
                messages: [{ role: 'user', content: 'Inizia la compilazione del documento usando i dati disponibili.' }],
                context: { pinnedSource, currentFields }
            });
            const data = await res.json();

            const agentResponse: StudioMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.text,
                steps: data.steps || [],
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, agentResponse]);
            if (data.action && onAgentAction) onAgentAction(data.action);
        } catch (error) {
            console.error('Auto-start fail:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: StudioMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput("");
        setIsLoading(true);

        try {
            const res = await apiRequest('POST', '/api/studio/chat', {
                messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                context: { pinnedSource, currentFields }
            });

            const data = await res.json();

            const assistantMessage: StudioMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.text,
                steps: data.steps || [],
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, assistantMessage]);

            if (data.action && onAgentAction) {
                onAgentAction(data.action);
            }

        } catch (error) {
            console.error('Studio Chat Error:', error);
            toast({ variant: "destructive", title: "Errore Agente", description: "Impossibile completare l'azione." });
        } finally {
            setIsLoading(false);
        }
    };

    const updateLastMessageSteps = (messageId: string, stepId: string, status: StudioStep['status'], description?: string) => {
        setMessages(prev => prev.map(msg => {
            if (msg.id === messageId && msg.steps) {
                return {
                    ...msg,
                    steps: msg.steps.map(step =>
                        step.id === stepId ? { ...step, status, description: description || step.description } : step
                    )
                };
            }
            return msg;
        }));
    };

    return (
        <div className="h-full flex flex-col bg-background rounded-lg border overflow-hidden shadow-sm">
            <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                <div className="space-y-4">
                    <AnimatePresence initial={false}>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className={`w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {msg.role === 'assistant' ? <Wand2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                </div>
                                <div className={`max-w-[85%] space-y-2`}>
                                    <div className={`p-2 rounded-lg text-xs leading-relaxed ${msg.role === 'assistant' ? 'bg-muted/50 border shadow-sm' : 'bg-blue-600 text-white shadow-md'
                                        }`}>
                                        {msg.content}
                                    </div>

                                    {msg.steps && (
                                        <div className="bg-muted/30 border rounded-md p-2 space-y-2 mt-2">
                                            {msg.steps.map((step) => (
                                                <div key={step.id} className="flex items-start gap-2">
                                                    {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5" />}
                                                    {step.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin mt-0.5" />}
                                                    {step.status === 'pending' && <Circle className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />}
                                                    {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5" />}

                                                    <div className="flex-1">
                                                        <p className={`text-[11px] font-medium ${step.status === 'running' ? 'text-amber-700' :
                                                            step.status === 'completed' ? 'text-green-700' : 'text-muted-foreground'
                                                            }`}>
                                                            {step.label}
                                                        </p>
                                                        {step.description && step.status === 'running' && (
                                                            <p className="text-[10px] text-muted-foreground animate-pulse italic">
                                                                {step.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            <div className="p-2 border-t bg-muted/20">
                <div className="relative group">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Chiedi all'agente studio..."
                        className="resize-none pr-10 text-xs min-h-[50px] focus-visible:ring-amber-500/50"
                        disabled={isLoading}
                    />
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-1 bottom-1 h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

