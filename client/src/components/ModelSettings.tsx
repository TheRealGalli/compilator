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
  onNotesChange?: (value: string) => void;
  onTemperatureChange?: (value: number) => void;
  onWebResearchChange?: (value: boolean) => void;
  onDetailedAnalysisChange?: (value: boolean) => void;
  onFormalToneChange?: (value: boolean) => void;
}

export function ModelSettings({
  notes = "",
  temperature = 0.7,
  webResearch = false,
  detailedAnalysis = true,
  formalTone = true,
  onNotesChange,
  onTemperatureChange,
  onWebResearchChange,
  onDetailedAnalysisChange,
  onFormalToneChange,
}: ModelSettingsProps) {
  return (
    <div className="h-full flex flex-col border rounded-lg bg-background overflow-hidden">
      <div className="border-b px-4 py-3 bg-muted/30 flex-shrink-0">
        <h3 className="text-sm font-medium">Impostazioni Modello</h3>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Note Aggiuntive</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => onNotesChange?.(e.target.value)}
              placeholder="Inserisci note o istruzioni specifiche per la compilazione del documento..."
              className="min-h-[100px] text-sm"
              data-testid="textarea-notes"
            />
            <p className="text-xs text-muted-foreground">
              Aggiungi contesto o requisiti specifici per migliorare la qualità del documento
            </p>
          </div>

          <Separator />

          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Creatività (Temperature)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Controlla la creatività del modello. Valori bassi (0.1-0.3) per testi formali,
                    valori alti (0.7-1.0) per contenuti creativi.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-2">
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
          <div className="space-y-4">
            <Label className="text-sm font-medium">Strumenti AI</Label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="web-research" className="text-sm font-medium cursor-pointer">
                      Web Research
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Consente al modello di cercare informazioni online per arricchire il documento
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ricerca informazioni aggiornate online
                  </p>
                </div>
                <Switch
                  id="web-research"
                  checked={webResearch}
                  onCheckedChange={onWebResearchChange}
                  data-testid="switch-web-research"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="detailed-analysis" className="text-sm font-medium cursor-pointer">
                      Analisi Dettagliata
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Analizza approfonditamente i documenti fonte per estrarre dettagli rilevanti
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estrae informazioni dettagliate dai documenti
                  </p>
                </div>
                <Switch
                  id="detailed-analysis"
                  checked={detailedAnalysis}
                  onCheckedChange={onDetailedAnalysisChange}
                  data-testid="switch-detailed-analysis"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="formal-tone" className="text-sm font-medium cursor-pointer">
                      Tono Formale
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs text-xs">
                          Utilizza un linguaggio formale e professionale nel documento generato
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Linguaggio professionale e formale
                  </p>
                </div>
                <Switch
                  id="formal-tone"
                  checked={formalTone}
                  onCheckedChange={onFormalToneChange}
                  data-testid="switch-formal-tone"
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
