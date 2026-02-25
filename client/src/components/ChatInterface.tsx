import { AnimatePresence, motion } from "framer-motion";
import { Send, Bot, Globe, Mic, Square, Asterisk, HardDrive, Paperclip, Play, X } from "lucide-react";
import { MentionButton } from "./MentionButton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api-config";
import { useSources } from "@/contexts/SourcesContext";
import { useGoogleDrive } from "@/contexts/GoogleDriveContext";
import { useChat, type Message } from "@/contexts/ChatContext";
import { DriveLogo } from "./ConnectorsSection";
import { createPortal } from "react-dom";

// { id, role, content, timestamp, sources, audioUrl, groundingMetadata, searchEntryPoint, shortTitle }


interface ChatInterfaceProps {
  modelProvider?: 'openai' | 'gemini';
}

interface Mention {
  id: string;
  text: string;
  label: string;
  source: 'chat' | 'selection';
}

export function ChatInterface({ modelProvider = 'gemini' }: ChatInterfaceProps) {
  const { messages, setMessages, isGreetingLoading, suggestedPrompts, setSuggestedPrompts } = useChat();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [webResearch, setWebResearch] = useState(false);
  const [isDriveMode, setIsDriveMode] = useState(false);
  const [toolMode, setToolMode] = useState<'allegati' | 'run'>('allegati');
  const { toast } = useToast();
  const { selectedSources, masterSource } = useSources();

  // Mention State
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery({ queryKey: ['/api/user'] });
  const isAuthenticated = !!user;

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleMicClick = () => {
    if (isLoading || isTranscribing) return;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    clickTimeoutRef.current = setTimeout(() => {
      if (!isRecording) {
        startRecording();
      } else {
        togglePause();
      }
      clickTimeoutRef.current = null;
    }, 250); // Small delay to distinguish single vs double click
  };

  const handleMicDoubleClick = () => {
    if (isLoading || isTranscribing) return;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    if (isRecording) {
      stopRecording();
    }
  };

  const togglePause = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
        toast({
          title: "Registrazione in Pausa",
          description: "Clicca ancora per riprendere, doppio click per terminare.",
        });
      } else if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
        toast({
          title: "Registrazione Ripresa",
          description: "Sto registrando...",
        });
      }
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
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setIsPaused(false);
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
      setIsPaused(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (isLoading || isTranscribing) return;
    setIsTranscribing(true);
    toast({
      title: "Trascrizione in corso...",
      description: "Sto convertendo il tuo audio in testo.",
    });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch(getApiUrl('/api/transcribe'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore nella trascrizione');
      }

      const data = await res.json();

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
    }
  };


  // Extract fields from master source for context (optional but consistent)
  const [extractedFields, setExtractedFields] = useState<Array<{ name: string; type: string }>>([]);

  useEffect(() => {
    if (!masterSource) {
      setExtractedFields([]);
      return;
    }

    const extractFields = async () => {
      try {
        const response = await fetch(getApiUrl('/api/extract-fields-for-context'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterSource: {
              name: masterSource.name,
              type: masterSource.type,
              base64: masterSource.base64
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          setExtractedFields(data.fields || []);
        }
      } catch (error) {
        console.error('Error extracting fields for context:', error);
      }
    };


    extractFields();
  }, [masterSource?.id]);

  const updateSelectionPosition = useCallback(() => {
    if (isMouseDown) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.toString().trim().length === 0) {
      setSelection(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (!container.contains(sel.anchorNode)) {
      // Only show if selection is within this chat component
      return;
    }

    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const firstRect = rects[0];

    setSelection({
      text: sel.toString().trim(),
      x: firstRect.left + (firstRect.width / 2),
      y: firstRect.top - 10
    });
  }, [isMouseDown]);

  // Handle Selection for Mentions
  useEffect(() => {
    const handleMouseDown = () => setIsMouseDown(true);
    const handleMouseUp = () => {
      setIsMouseDown(false);
      // Wait a tick for DOM selection to finalize
      requestAnimationFrame(() => {
        updateSelectionPosition();
      });
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [updateSelectionPosition]);

  // Track scroll events to keep button anchored
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      const handleScroll = () => {
        if (selection) {
          updateSelectionPosition();
        }
      };
      viewport.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', updateSelectionPosition);
      return () => {
        viewport.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', updateSelectionPosition);
      };
    }
  }, [updateSelectionPosition, selection]);

  const handleMentionClick = () => {
    if (selection) {
      const newMention: Mention = {
        id: Date.now().toString(),
        text: selection.text,
        label: `C${mentions.length + 1}`,
        source: 'selection'
      };
      setMentions(prev => [...prev, newMention]);
      // Inject tag into prompt input
      setInput(prev => (prev ? prev + ' ' : '') + `#${newMention.label} `);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const removeMention = (id: string) => {
    setMentions(mentions.filter(m => m.id !== id));
  };


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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };


    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setMentions([]); // Clear mentions
    setSuggestedPrompts([]);
    setIsLoading(true);

    try {
      const apiMessages = newMessages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      const totalSize = selectedSources.reduce((acc, s) => acc + (s.size || 0), 0);
      if (totalSize > 30 * 1024 * 1024) {
        throw new Error("Il totale dei documenti selezionati è troppo grande (max 30MB). Deseleziona alcuni file.");
      }

      const response = await apiRequest('POST', '/api/chat', {
        messages: apiMessages,
        modelProvider: 'gemini',
        sources: selectedSources,
        temperature: 0.7,
        webResearch: webResearch,
        driveMode: isDriveMode,
        toolMode: (webResearch || isDriveMode) ? undefined : toolMode,
        masterSource: masterSource ? {
          name: masterSource.name,
          type: masterSource.type,
          base64: masterSource.base64
        } : null,
        extractedFields: extractedFields.length > 0 ? extractedFields : undefined,
        mentions: mentions // Send mentions to backend
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        groundingMetadata: data.groundingMetadata,
        searchEntryPoint: data.searchEntryPoint,
        shortTitle: data.shortTitle,
        aiMetadata: data.aiMetadata,
      };

      if (data.file) {
        const base64Data = data.file.base64;
        const fileName = data.file.name;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        const { saveAs } = await import("file-saver");
        saveAs(blob, fileName);

        toast({
          title: "Documento generato",
          description: `L'AI ha compilato il file "${fileName}" basandosi sulla tua richiesta.`,
        });
      }

      const updatedMessages = [...newMessages, assistantMessage];
      setMessages(updatedMessages);
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

  const { userIdentity } = useGoogleDrive();

  return (
    <div className="flex flex-col h-full relative">
      {/* Mention Button Overlay — anchored to selection rect */}
      {selection && createPortal(
        <div
          style={{
            position: 'fixed',
            left: selection.x,
            top: selection.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 99999, // Super high z-index
            pointerEvents: 'auto'
          }}
        >
          <MentionButton onClick={handleMentionClick} />
        </div>,
        document.body
      )}

      <div className="flex-1 overflow-hidden flex flex-col relative" ref={containerRef}>
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((message) => (
              <ChatMessage key={message.id} {...message} userInitial={userIdentity?.initial} />
            ))}
            {(isLoading || isGreetingLoading) && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Asterisk
                    className="w-6 h-6 text-blue-600 animate-spin"
                    strokeWidth={3}
                  />
                </div>
                <div className="bg-muted rounded-lg">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="border-t bg-background p-4">
        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            {suggestedPrompts.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-2 mb-4 min-h-[40px]"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {suggestedPrompts.map((prompt, i) => (
                  <motion.div
                    key={`${prompt}-${i}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: i * 0.05
                    }}
                  >
                    <Badge
                      variant="secondary"
                      className="cursor-pointer hover-elevate active-elevate-2"
                      onClick={() => setInput(prompt)}
                      data-testid={`badge-prompt-${i}`}
                    >
                      {prompt}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-2 ${!isAuthenticated ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Globe className={`w-4 h-4 ${webResearch ? 'text-blue-600' : 'text-muted-foreground'}`} />
                    <Label htmlFor="web-research-chat" className={`text-xs ${!isAuthenticated ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      Web Research
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    {isAuthenticated
                      ? "Abilita ricerca Google in tempo reale per informazioni aggiornate"
                      : "Login richiesto per la ricerca web"
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
              <Switch
                id="web-research-chat"
                checked={webResearch}
                onCheckedChange={(checked) => {
                  setWebResearch(checked);
                  if (checked) setIsDriveMode(false);
                }}
                disabled={!isAuthenticated}
              />

              <div className="w-px h-4 bg-border mx-2" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-full w-8 h-8 transition-all duration-300 ${isRecording
                      ? isPaused
                        ? 'bg-amber-100 text-amber-600' // Paused State
                        : 'bg-red-100 text-red-600' // Recording State (Static)
                      : 'text-muted-foreground' // Idle State
                      }`}
                    onClick={handleMicClick}
                    onDoubleClick={handleMicDoubleClick}
                    disabled={isLoading || isTranscribing}
                  >
                    {isRecording ? (
                      isPaused ? (
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      ) : (
                        <Mic className="w-4 h-4" /> // Keep Mic icon while recording, maybe change to Pause icon if desired, but user asked for "pause" functionality behavior. 
                        // Actually standard UI is: click to pause -> shows Play/Resume. 
                        // While recording -> shows Pause? Or just Mic pulsing? 
                        // User said: "clicchiamo una volta si mette in pausa".
                        // Let's use a Pause icon when recording to indicate "Click to Pause"? 
                        // Or just keep Mic pulsing. 
                        // Visually: 
                        // Recording: Red Pulse (Standard)
                        // Paused: Amber Static (Standard)
                        // To resume: Click again.
                      )
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{!isAuthenticated ? "Login richiesto" : isRecording ? (isPaused ? "In Pausa (Click: Riprendi, DblClick: Fine)" : "Registrando (Click: Pausa, DblClick: Fine)") : "Attiva input vocale (STT)"}</p>
                </TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-border mx-2" />

              {/* Tool Mode Selector: Allegati / Run */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (webResearch || isDriveMode) {
                        // Re-activate: disable Web Research / Drive Mode
                        setWebResearch(false);
                        setIsDriveMode(false);
                        return;
                      }
                      setToolMode(toolMode === 'allegati' ? 'run' : 'allegati');
                    }}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${webResearch || isDriveMode
                      ? 'opacity-50 bg-muted text-muted-foreground hover:opacity-70'
                      : toolMode === 'run'
                        ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                  >
                    {webResearch || isDriveMode ? (
                      <span className="text-[10px]">Disattivato</span>
                    ) : toolMode === 'allegati' ? (
                      <><Paperclip className="w-3 h-3" /> Allegati</>
                    ) : (
                      <><Play className="w-3 h-3" /> Run</>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    {webResearch || isDriveMode
                      ? "Disattivato: Web Research o Drive Mode è attivo"
                      : toolMode === 'allegati'
                        ? "Modalità Allegati: genera file scaricabili (PDF, DOCX, MD, JSONL, LaTeX)"
                        : "Modalità Run: il modello può eseguire codice Python per calcoli e validazione"
                    }
                  </p>
                </TooltipContent>
              </Tooltip>

              {userIdentity && (
                <>
                  <div className="w-px h-4 bg-border mx-2" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`rounded-full w-8 h-8 ${isDriveMode ? 'bg-green-100' : ''}`}
                        onClick={() => {
                          const next = !isDriveMode;
                          setIsDriveMode(next);
                          if (next) setWebResearch(false);
                        }}
                        disabled={isLoading || isTranscribing || !isAuthenticated}
                      >
                        <DriveLogo className={`w-5 h-5 ${!isDriveMode ? 'opacity-50 grayscale' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{!isAuthenticated ? "Login richiesto" : isDriveMode ? "Drive Mode ATTIVO (Modifica file)" : "Attiva Drive Mode"}</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex flex-col border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring">
                {/* Mention chips inline above textarea */}
                {mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                    {mentions.map(m => (
                      <span key={m.id} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 text-[11px] px-2 py-0.5 rounded-full border border-indigo-200 max-w-[200px]">
                        <span className="font-bold">#{m.label}</span>
                        <span className="truncate">"{m.text}"</span>
                        <button onClick={() => removeMention(m.id)} className="hover:text-indigo-900 ml-0.5 flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={!isAuthenticated ? "Fai una domanda.." : webResearch ? "Fai una domanda (con ricerca web)..." : isRecording ? (isPaused ? "Registrazione in pausa..." : "Registrazione in corso...") : isTranscribing ? "Trascrizione audio..." : "Fai una domanda sui tuoi documenti..."}
                  className="resize-none min-h-[50px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="input-chat"
                  disabled={isRecording || isTranscribing}
                />
              </div>
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
