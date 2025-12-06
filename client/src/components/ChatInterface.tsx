import { Send, Bot, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSources } from "@/contexts/SourcesContext";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: string[];
}

interface ChatInterfaceProps {
  modelProvider?: 'openai' | 'gemini';
}

export function ChatInterface({ modelProvider = 'gemini' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Ciao! Sono il tuo assistente di ricerca AI. Posso aiutarti ad analizzare i tuoi documenti, rispondere a domande e generare approfondimenti. Come posso aiutarti?",
      timestamp: "Ora",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [webResearch, setWebResearch] = useState(false);
  const { toast } = useToast();
  const { selectedSources } = useSources();

  const suggestedPrompts = [
    "Riassumi i punti chiave",
    "Quali sono i risultati principali?",
    "Genera note di studio",
    "Crea una FAQ",
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: "Ora",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Add placeholder for streaming response
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
      timestamp: "Ora",
    }]);

    try {
      const apiMessages = [...messages, userMessage]
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const response = await apiRequest('POST', '/api/chat', {
        messages: apiMessages,
        modelProvider: 'gemini',
        sources: selectedSources,
        temperature: 0.7,
        webResearch: webResearch,
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: data.text } : msg
        )
      );

    } catch (error: any) {
      console.error('Errore durante chat:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante la chat.",
        variant: "destructive",
      });

      setMessages((prev) =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: "Mi dispiace, si è verificato un errore. Riprova più tardi." }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((message) => (
            <ChatMessage key={message.id} {...message} />
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-muted rounded-lg">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedPrompts.map((prompt, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer hover-elevate active-elevate-2"
                  onClick={() => setInput(prompt)}
                  data-testid={`badge-prompt-${i}`}
                >
                  {prompt}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">

            {/* Web Research Toggle */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Globe className={`w-4 h-4 ${webResearch ? 'text-blue-600' : 'text-muted-foreground'}`} />
                    <Label htmlFor="web-research-chat" className="text-xs cursor-pointer">
                      Web Research
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Abilita ricerca Google in tempo reale per informazioni aggiornate
                  </p>
                </TooltipContent>
              </Tooltip>
              <Switch
                id="web-research-chat"
                checked={webResearch}
                onCheckedChange={setWebResearch}
              />
            </div>

            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={webResearch ? "Fai una domanda (con ricerca web)..." : "Fai una domanda sui tuoi documenti..."}
                className="resize-none min-h-[60px]"
                data-testid="input-chat"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
