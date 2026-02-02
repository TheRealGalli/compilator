import { useState, useRef } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Info, Mic, Square } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";

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
}: ModelSettingsProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    <div className="h-full flex flex-col border rounded-lg bg-background overflow-hidden">
      <div className="border-b px-2 py-1.5 bg-muted/30 flex-shrink-0">
        <h3 className="text-sm font-medium">Impostazioni Modello</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-xs font-medium">Note Aggiuntive</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 rounded-full transition-all ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-muted-foreground hover:text-blue-600 hover:bg-blue-50'}`}
                      onClick={() => isRecording ? stopRecording() : startRecording()}
                      disabled={isTranscribing}
                    >
                      {isRecording ? <Square className="w-2.5 h-2.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-[10px]">{isRecording ? "Ferma e trascrivi" : "Attiva input vocale"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder={isRecording ? "Registrazione in corso..." : isTranscribing ? "Trascrizione..." : "Formati supportati:\nTesto: PDF, DOCX, TXT, CSV\nImmagini: JPG, PNG, WebP\nAudio: MP3, WAV, FLAC"}
              className="min-h-[186px] text-xs resize-none"
              data-testid="textarea-notes"
              disabled={isRecording || isTranscribing}
            />
          </div>

          <Separator />

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Creatività</Label>
            </div>
            <div className="space-y-1.5">
              <Slider
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
                    <Label className="text-xs font-medium uppercase tracking-tighter opacity-70">
                      Guardrail
                    </Label>
                    <div className="ml-auto flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-[1px] border border-muted-foreground/30 bg-muted-foreground/10 cursor-pointer hover:bg-blue-500/30 transition-colors"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Guardrail 2 (Empty for Balance) */}
              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card min-h-[42px] opacity-40">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-tighter opacity-30">
                      Guardrail
                    </Label>
                  </div>
                </div>
              </div>

              {/* Space Filler Card */}
              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card min-h-[42px] opacity-20">
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="model-provider" className="text-xs font-medium cursor-pointer">
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
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
