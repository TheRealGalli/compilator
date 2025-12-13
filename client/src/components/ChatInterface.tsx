import { Send, Bot, Globe, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getApiUrl } from "@/lib/api-config";
import { useSources } from "@/contexts/SourcesContext";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  sources?: string[];
  audioUrl?: string; // URL blob locale per riproduzione
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

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        handleSendAudio(audioBlob);

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Errore Microfono",
        description: "Impossibile accedere al microfono. Verifica i permessi del browser.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (isLoading || isTranscribing) return;

    // Show loading state for transcription
    setIsTranscribing(true);

    // Let's use a toast for specific feedback.
    toast({
      title: "Trascrizione in corso...",
      description: "Sto convertendo il tuo audio in testo.",
    });

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      // Use fetch directly for FormData to ensure correct headers
      // Note: apiRequest helper might assume JSON content-type default
      const res = await fetch(getApiUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore nella trascrizione');
      }

      const data = await res.json();

      // Populate input with transcribed text
      if (data.text) {
        setInput((prev) => prev + (prev ? " " : "") + data.text);
      } else {
        toast({
          title: "Attenzione",
          description: "Nessun testo rilevato nell'audio.",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Errore trascrizione:', error);
      toast({
        title: "Errore Trascrizione",
        description: error.message || "Impossibile trascrivere l'audio.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      // Clean up local tracks if any active (already done in onstop, but good practice)
    }
  };

  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "Riassumi i punti chiave",
    "Quali sono i risultati?", // Shortened to fit roughly 20 chars
    "Note di studio",
    "Crea una FAQ",
  ]);

  const fetchSuggestedQuestions = async (currentMessages: Message[]) => {
    try {
      const apiMessages = currentMessages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const res = await apiRequest('POST', '/api/suggest-questions', {
        messages: apiMessages,
        sources: selectedSources,
        webResearch: webResearch,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          setSuggestedPrompts(data.questions);
        }
      }
    } catch (error) {
      console.error("Failed to fetch suggested questions:", error);
    }
  };

  const handleSend = async (forcedInput?: string) => {
    const textToSend = forcedInput || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: "Ora",
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const apiMessages = newMessages
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

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text,
        timestamp: "Ora",
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);

      // Fetch new suggested questions based on the updated conversation
      fetchSuggestedQuestions(updatedMessages);

    } catch (error: any) {
      console.error('Errore durante chat:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante la chat.",
        variant: "destructive",
      });

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Mi dispiace, si è verificato un errore. Riprova più tardi.",
        timestamp: "Ora",
      }]);
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
          {suggestedPrompts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {suggestedPrompts.map((prompt, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="cursor-pointer hover-elevate active-elevate-2 px-3 py-1.5 text-xs sm:text-sm"
                  onClick={() => handleSend(prompt)}
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

              <div className="w-px h-4 bg-border mx-2" /> {/* Divider */}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full w-8 h-8 ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-muted-foreground'}`}
                    onClick={toggleRecording}
                    disabled={isLoading || isTranscribing}
                  >
                    {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? "Ferma registrazione e invia" : "Attiva input vocale (STT)"}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={webResearch ? "Fai una domanda (con ricerca web)..." : isRecording ? "Registrazione in corso..." : isTranscribing ? "Trascrizione audio..." : "Fai una domanda sui tuoi documenti..."}
                className="resize-none min-h-[60px]"
                data-testid="input-chat"
                disabled={isRecording || isTranscribing}
              />
              <Button
                size="icon"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading || isRecording || isTranscribing}
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
