import { useState, useRef, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Info, Mic, Square, Sparkles } from "lucide-react";
import {
  FaChessPawn, FaChessKnight, FaChessBishop,
  FaChessRook, FaChessQueen
} from "react-icons/fa6";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCompiler } from "@/contexts/CompilerContext";
import { useOllama } from "@/contexts/OllamaContext";

interface ModelSettingsProps {
  notes?: string;
  temperature?: number;
  webResearch?: boolean;
  detailedAnalysis?: boolean;
  formalTone?: boolean;
  modelProvider?: 'openai' | 'gemini';
  onNotesChange?: (value: string) => void;
  onTemperatureChange?: (value: number) => void;
  onWebResearchChange?: (value: boolean) => void;
  onDetailedAnalysisChange?: (value: boolean) => void;
  onFormalToneChange?: (value: boolean) => void;
  onModelProviderChange?: (value: 'openai' | 'gemini') => void;
  isRefining?: boolean;
  chatInterface?: React.ReactNode;
  className?: string;
}

export function ModelSettings({
  notes = "",
  temperature = 0.7,
  webResearch = false,
  detailedAnalysis = true,
  formalTone = true,
  modelProvider = 'gemini',
  onNotesChange,
  onTemperatureChange,
  onWebResearchChange,
  onDetailedAnalysisChange,
  onFormalToneChange,
  onModelProviderChange,
  isRefining = false,
  chatInterface,
  className
}: ModelSettingsProps) {
  const { activeGuardrails, toggleGuardrail } = useCompiler();
  const { status: ollamaStatus } = useOllama();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMicClick = () => {
    if (isTranscribing) return;

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
    }, 250);
  };

  const handleMicDoubleClick = () => {
    if (isTranscribing) return;

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
        onNotesChange?.(notes + (notes ? "\n" : "") + data.text);
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

  return (

    <div className={cn(
      "h-full flex flex-col min-h-0 border rounded-lg overflow-hidden",
      isRefining ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800" : "bg-background",
      className
    )}>
      <div className="border-b px-2 py-1.5 bg-muted/30 flex-shrink-0 flex items-center gap-2 h-10">
        <AnimatePresence mode="wait">
          {isRefining ? (
            <motion.div
              key="title-copilot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-indigo-700"
            >
              <h3 className="text-sm font-semibold">Document Copilot</h3>
            </motion.div>
          ) : (
            <motion.div
              key="title-settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="text-sm font-medium">Impostazioni Modello</h3>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {isRefining ? (
          /* Copilot Mode: Direct flex layout without ScrollArea to allow proper height expansion */
          <div className="flex-1 flex flex-col min-h-0 p-2">
            <AnimatePresence mode="wait">
              <motion.div
                key="chat-interface"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col min-h-0"
              >
                {chatInterface}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          /* Settings Mode: ScrollArea for scrollable content */
          <ScrollArea className="flex-1 [&>[data-radix-scroll-area-viewport]]:h-full">
            <div className="p-2 space-y-2">
              {/* Note Aggiuntive */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="notes" className="text-xs font-medium">Note Aggiuntive</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-full transition-all duration-300 ${isRecording ? (isPaused ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600') : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'}`}
                          onClick={handleMicClick}
                          onDoubleClick={handleMicDoubleClick}
                          disabled={isTranscribing}
                        >
                          {isRecording ? <Square className="w-2.5 h-2.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-[10px]">{isRecording ? (isPaused ? "Pausa (Click: Riprendi, DblClick: Fine)" : "Reg. (Click: Pausa, DblClick: Fine)") : "Attiva input vocale"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => onNotesChange?.(e.target.value)}
                  placeholder="Aggiungi qui le tue note per la compilazione."
                  className="text-xs resize-none min-h-[175px]"
                  data-testid="textarea-notes"
                  disabled={isRecording || isTranscribing}
                />
              </div>
              <Separator />

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature" className="text-xs font-medium">Temperatura</Label>
                </div>
                <div className="space-y-1.5">
                  <Slider
                    id="temperature"
                    value={[temperature]}
                    onValueChange={(value) => onTemperatureChange?.(value[0])}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full"
                    data-testid="slider-temperature"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Preciso</span>
                    <span className="font-medium text-foreground">{temperature.toFixed(1)}</span>
                    <span>Creativo</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tools */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Strumenti AI</Label>


                <div className="space-y-2">
                  <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="web-research" className="text-xs font-medium cursor-pointer">
                          Web Research
                        </Label>
                      </div>
                    </div>
                    <Switch
                      id="web-research"
                      checked={webResearch}
                      onCheckedChange={onWebResearchChange}
                      data-testid="switch-web-research"
                    />
                  </div>

                  {/* Guardrail 1 (Active) */}
                  <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card min-h-[42px]">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium cursor-pointer">
                          Guardrail
                        </Label>
                        <div className="ml-auto flex gap-3">
                          {[
                            { id: 'pawn', icon: FaChessPawn, size: 12, label: 'Pedone', description: 'Filtro Zero-Data: Anonymizza dati personali (Nomi, P.IVA, CF, Reati) prima dell\'invio all\'IA.' },
                            { id: 'knight', icon: FaChessKnight, size: 13, label: 'Cavallo', description: 'Prossimamente' },
                            { id: 'bishop', icon: FaChessBishop, size: 13, label: 'Alfiere', description: 'Prossimamente' },
                            { id: 'rook', icon: FaChessRook, size: 13, label: 'Torre', description: 'Prossimamente' },
                            { id: 'queen', icon: FaChessQueen, size: 14, label: 'Regina', description: 'Prossimamente' }
                          ].map((piece) => (
                            <TooltipProvider key={piece.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={() => {
                                      if (piece.id === 'pawn') {
                                        if (ollamaStatus === 'connected') {
                                          toggleGuardrail(piece.id);
                                        } else {
                                          toast({
                                            title: "Ollama non rilevato",
                                            description: "Collega il connettore con Ollama nella sezione Connettori per attivare il Filtro Zero-Data.",
                                            variant: "destructive"
                                          });
                                        }
                                      }
                                    }}
                                    className={cn(
                                      "w-[24px] h-[24px] flex items-center justify-center rounded-[1px] border cursor-pointer transition-colors overflow-hidden",
                                      activeGuardrails.includes(piece.id)
                                        ? "border-blue-500 bg-blue-500/20"
                                        : "border-muted-foreground/30 bg-muted-foreground/10 hover:bg-blue-500/10",
                                      piece.id === 'pawn' && ollamaStatus !== 'connected' && "opacity-40 grayscale-[0.5]",
                                      piece.id !== 'pawn' && "opacity-50 cursor-not-allowed"
                                    )}
                                  >
                                    <piece.icon
                                      className={cn(
                                        activeGuardrails.includes(piece.id) ? "text-blue-600" : "text-muted-foreground/60"
                                      )}
                                      size={piece.size}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-[10px] font-bold">{piece.label}</p>
                                  <p className="text-[10px] max-w-[150px] leading-tight mt-1">{piece.description}</p>
                                  {piece.id === 'pawn' && (
                                    <>
                                      <p className="text-[9px] text-blue-500 font-medium mt-1">powered by Ollama (GPT-OSS 20B) - 100% Locale</p>
                                      {ollamaStatus !== 'connected' && (
                                        <p className="text-[9px] text-red-500 font-bold mt-1 uppercase italic">⚠️ Disconnesso</p>
                                      )}
                                    </>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Guardrail 2 (Filler) */}
                  <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card min-h-[42px]">
                  </div>

                  {/* Space Filler Card */}
                  <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card min-h-[42px]">
                  </div>
                </div>
              </div>
              {/* Modello Indicator */}
              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card shrink-0">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium">
                      Modello
                    </Label>
                    <div className="ml-auto">
                      <div className="px-2 py-1 border rounded-md bg-muted/50 text-[10px] text-muted-foreground">
                        Gemini 2.5 Flash
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
