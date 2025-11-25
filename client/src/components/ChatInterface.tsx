import { Send, FileText, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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

interface Document {
  name: string;
  gcsPath: string;
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { getApiUrl } = await import("@/lib/api-config");
      const response = await fetch(getApiUrl('/api/documents'));
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

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

    try {
      // Prepara i messaggi per l'API (solo user e assistant, senza metadata)
      const apiMessages = [...messages, userMessage]
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const response = await apiRequest('POST', '/api/chat', {
        messages: apiMessages,
        modelProvider: 'gemini', // Enforce Gemini
        selectedDocuments, // Pass selected documents context
        temperature: 0.7,
      });

      const data = await response.json();

      if (data.success && data.message) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message.content,
          timestamp: "Ora",
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Errore durante la chat');
      }
    } catch (error: any) {
      console.error('Errore durante chat:', error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante l'invio del messaggio.",
        variant: "destructive",
      });

      // Aggiungi un messaggio di errore
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Mi dispiace, si è verificato un errore. Riprova più tardi.",
        timestamp: "Ora",
      };
      setMessages((prev) => [...prev, errorMessage]);
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

  const toggleDocument = (gcsPath: string) => {
    setSelectedDocuments(prev =>
      prev.includes(gcsPath)
        ? prev.filter(p => p !== gcsPath)
        : [...prev, gcsPath]
    );
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 max-w-3xl mx-auto">
          {messages.map((message) => (
            <ChatMessage key={message.id} {...message} />
          ))}
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
            {documents.length > 0 && (
              <div className="flex justify-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-2">
                      <FileText className="w-4 h-4" />
                      {selectedDocuments.length > 0
                        ? `${selectedDocuments.length} documenti selezionati`
                        : "Seleziona contesto"}
                      <ChevronUp className="w-4 h-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-4 border-b">
                      <h4 className="font-medium leading-none">Documenti di contesto</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Seleziona i documenti da usare per la risposta
                      </p>
                    </div>
                    <ScrollArea className="h-[200px] p-4">
                      <div className="space-y-4">
                        {documents.map((doc) => (
                          <div key={doc.gcsPath} className="flex items-start space-x-2">
                            <Checkbox
                              id={doc.gcsPath}
                              checked={selectedDocuments.includes(doc.gcsPath)}
                              onCheckedChange={() => toggleDocument(doc.gcsPath)}
                            />
                            <Label
                              htmlFor={doc.gcsPath}
                              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {doc.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Fai una domanda sui tuoi documenti..."
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
