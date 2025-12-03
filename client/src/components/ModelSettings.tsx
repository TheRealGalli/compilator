import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  return (
    <div className="h-full flex flex-col border rounded-lg bg-background overflow-hidden">
      <div className="border-b px-2 py-1.5 bg-muted/30 flex-shrink-0">
        <h3 className="text-sm font-medium">Impostazioni Modello</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">Note Aggiuntive</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder="Formati supportati:&#10;Testo: PDF, DOCX, TXT&#10;Immagini: JPG, PNG, WebP&#10;Audio: MP3, WAV, FLAC, AAC&#10;Video: MP4, MOV, AVI, WebM"
              className="min-h-[140px] text-xs resize-none"
              data-testid="textarea-notes"
            />
          </div>

          <Separator />

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Creatività</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Valori bassi (0.1-0.3) per testi formali, alti (0.7-1.0) per creatività.
                  </p>
                </TooltipContent>
              </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Ricerca informazioni online
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <Switch
                  id="web-research"
                  checked={webResearch}
                  onCheckedChange={onWebResearchChange}
                  data-testid="switch-web-research"
                />
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="detailed-analysis" className="text-xs font-medium cursor-pointer">
                      Analisi Dettagliata
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Analisi approfondita documenti
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <Switch
                  id="detailed-analysis"
                  checked={detailedAnalysis}
                  onCheckedChange={onDetailedAnalysisChange}
                  data-testid="switch-detailed-analysis"
                />
              </div>

              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="formal-tone" className="text-xs font-medium cursor-pointer">
                      Tono Formale
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Linguaggio formale e professionale
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <Switch
                  id="formal-tone"
                  checked={formalTone}
                  onCheckedChange={onFormalToneChange}
                  data-testid="switch-formal-tone"
                />
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg border bg-card">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="model-provider" className="text-xs font-medium cursor-pointer">
                      Modello
                    </Label>
                    <div className="space-y-2">
                      <div className="p-2 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                        Gemini 2.5 Flash (Google)
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
