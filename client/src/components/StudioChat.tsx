
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, User, Bot, Sparkles, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface StudioChatProps {
    onSendMessage: (message: string) => Promise<string>;
    isProcessing?: boolean;
}

export function StudioChat({ onSendMessage, isProcessing = false }: StudioChatProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Ciao! Sono pronto a compilare il documento. I campi sono stati rilevati. Cosa scriviamo?",
            timestamp: Date.now()
        }
    ]);
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!inputValue.trim() || isProcessing) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue("");

        try {
            const response = await onSendMessage(userMsg.content);
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error("Chat error:", error);
            toast({ variant: "destructive", title: "Errore Chat", description: "Non sono riuscito a rispondere." });
        }
    };

    return (
        <div className="h-full flex flex-col border rounded-lg bg-background overflow-hidden relative">
            <div className="border-b px-3 py-2 bg-muted/30 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-medium">Assistant Compilatore</h3>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative bg-slate-50/50 dark:bg-slate-950/20" ref={scrollRef}>
                <div className="p-3 space-y-4 min-h-full">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <Avatar className="w-6 h-6 mt-1 flex-shrink-0">
                                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">AI</AvatarFallback>
                                </Avatar>
                            )}

                            <div
                                className={`rounded-xl px-3 py-2 text-sm max-w-[85%] shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-slate-900 border'
                                    }`}
                            >
                                {msg.content}
                            </div>

                            {msg.role === 'user' && (
                                <Avatar className="w-6 h-6 mt-1 flex-shrink-0">
                                    <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">
                                        <User className="w-3 h-3" />
                                    </AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    ))}

                    {isProcessing && (
                        <div className="flex gap-2 justify-start">
                            <Avatar className="w-6 h-6 mt-1 flex-shrink-0">
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">AI</AvatarFallback>
                            </Avatar>
                            <div className="rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-900 border shadow-sm flex items-center gap-2">
                                <span className="animate-pulse">Sto pensando...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-3 bg-background border-t">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="flex gap-2"
                >
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Istruzioni per la compilazione..."
                        className="flex-1"
                        disabled={isProcessing}
                    />
                    <Button type="submit" size="icon" disabled={isProcessing || !inputValue.trim()} className="shrink-0">
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
