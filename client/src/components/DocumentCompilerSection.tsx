import { Sparkles, FileText, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { ModelSettings } from "./ModelSettings";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSources } from "@/contexts/SourcesContext";

const templates = {
  privacy: {
    name: "Privacy Policy",
    content: `INFORMATIVA SULLA PRIVACY

1. INTRODUZIONE
La presente informativa sulla privacy descrive come raccogliamo, utilizziamo e proteggiamo i dati personali degli utenti di [AZIENDA].

2. DATI RACCOLTI
Raccogliamo i seguenti tipi di dati:
- Informazioni di contatto (nome, email, telefono)
- Dati di navigazione
- Cookie e tecnologie simili

3. UTILIZZO DEI DATI
I dati raccolti vengono utilizzati per:
- Fornire i nostri servizi
- Migliorare l'esperienza utente
- Comunicazioni relative ai servizi

4. PROTEZIONE DEI DATI
[AZIENDA] implementa misure di sicurezza appropriate per proteggere i dati personali.

5. DIRITTI DELL'UTENTE
Gli utenti hanno il diritto di accedere, correggere o cancellare i propri dati personali.

6. CONTATTI
Per qualsiasi richiesta relativa ai dati personali, contattare [AZIENDA] all'indirizzo email [EMAIL_AZIENDA].

Data di entrata in vigore: [DATA]

© [DATA] [AZIENDA]. Tutti i diritti riservati.`
  },
  relazione: {
    name: "Relazione Tecnica",
    content: `RELAZIONE TECNICA

Progetto: [PROGETTO]
Cliente: [CLIENTE]
Data: [DATA]
Responsabile: [RESPONSABILE]

═══════════════════════════════════════

1. INTRODUZIONE

Il presente documento illustra l'analisi tecnica svolta per il progetto [PROGETTO] commissionato da [CLIENTE].

Obiettivi principali:
- [OBIETTIVO_1]
- [OBIETTIVO_2]
- [OBIETTIVO_3]

2. ANALISI DELLA SITUAZIONE

Situazione attuale: [DESCRIZIONE_SITUAZIONE]

Problematiche identificate:
- [PROBLEMA_1]
- [PROBLEMA_2]

3. SOLUZIONE PROPOSTA

[DESCRIZIONE_SOLUZIONE]

4. RISORSE NECESSARIE

Personale: [PERSONALE]
Budget stimato: [BUDGET]
Tempistiche: [TEMPISTICHE]

5. PIANO DI IMPLEMENTAZIONE

Fase 1: [FASE_1]
Fase 2: [FASE_2]
Fase 3: [FASE_3]

6. CONCLUSIONI

[CONCLUSIONI]

Si raccomanda di procedere con l'implementazione della soluzione proposta nei tempi indicati.

═══════════════════════════════════════

Redatto da: [RESPONSABILE]
Data: [DATA]
Firma: ___________________`
  },
  contratto: {
    name: "Contratto di Servizio",
    content: `CONTRATTO DI PRESTAZIONE DI SERVIZI

Tra le parti:

FORNITORE:
Ragione sociale: [FORNITORE]
Sede legale: [SEDE_FORNITORE]
P.IVA: [PIVA_FORNITORE]
Rappresentata da: [RAPPRESENTANTE_FORNITORE]

E

CLIENTE:
Ragione sociale: [CLIENTE]
Sede legale: [SEDE_CLIENTE]
P.IVA: [PIVA_CLIENTE]
Rappresentata da: [RAPPRESENTANTE_CLIENTE]

═══════════════════════════════════════

PREMESSO CHE:

- Il Fornitore svolge attività di [ATTIVITA_FORNITORE]
- Il Cliente necessita di servizi di [SERVIZIO]
- Le parti intendono regolare i termini della collaborazione

SI CONVIENE E SI STIPULA QUANTO SEGUE:

Art. 1 - OGGETTO DEL CONTRATTO
Il presente contratto ha per oggetto la fornitura di [SERVIZIO_DETTAGLIO] da parte del Fornitore al Cliente.

Art. 2 - DURATA
Il contratto ha durata di [DURATA] con decorrenza dal [DATA_INIZIO] e termine il [DATA_FINE].

Art. 3 - CORRISPETTIVO
Il Cliente si impegna a corrispondere al Fornitore l'importo complessivo di € [IMPORTO] (Euro [IMPORTO_LETTERE]), oltre IVA di legge.

Art. 4 - MODALITÀ DI PAGAMENTO
Il pagamento avverrà secondo le seguenti modalità: [MODALITA_PAGAMENTO]

Art. 5 - OBBLIGHI DEL FORNITORE
Il Fornitore si impegna a:
- [OBBLIGO_FORNITORE_1]
- [OBBLIGO_FORNITORE_2]

Art. 6 - OBBLIGHI DEL CLIENTE
Il Cliente si impegna a:
- [OBBLIGO_CLIENTE_1]
- [OBBLIGO_CLIENTE_2]

Art. 7 - RECESSO
Ciascuna parte potrà recedere dal contratto con preavviso scritto di [PREAVVISO_RECESSO] giorni.

Art. 8 - RISERVATEZZA
Le parti si impegnano a mantenere riservate tutte le informazioni scambiate nell'ambito del presente contratto.

Art. 9 - FORO COMPETENTE
Per qualsiasi controversia è competente il Foro di [FORO_COMPETENTE].

═══════════════════════════════════════

Luogo e Data: [LUOGO], [DATA]

Firma del Fornitore                    Firma del Cliente

___________________                    ___________________

[RAPPRESENTANTE_FORNITORE]            [RAPPRESENTANTE_CLIENTE]
[FORNITORE]                           [CLIENTE]`
  }
} as const;

interface DocumentCompilerSectionProps {
  modelProvider?: 'openai' | 'gemini';
  onModelProviderChange?: (value: 'openai' | 'gemini') => void;
}

interface Document {
  name: string;
  gcsPath: string;
}

export function DocumentCompilerSection({
  modelProvider: initialModelProvider = 'gemini',
  onModelProviderChange
}: DocumentCompilerSectionProps = {}) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof templates | "">("");
  const [templateContent, setTemplateContent] = useState("");
  const [compiledContent, setCompiledContent] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const { toast } = useToast();
  const { selectedSources, toggleSource } = useSources();

  // Model settings
  const [notes, setNotes] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [webResearch, setWebResearch] = useState(false);
  const [detailedAnalysis, setDetailedAnalysis] = useState(true);
  const [formalTone, setFormalTone] = useState(true);
  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini'>(initialModelProvider);

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

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value as keyof typeof templates);
    if (value && templates[value as keyof typeof templates]) {
      setTemplateContent(templates[value as keyof typeof templates].content);
      setCompiledContent("");
    }
  };

  const handleCompile = async () => {
    if (!templateContent.trim()) {
      toast({
        title: "Errore",
        description: "Il template non può essere vuoto.",
        variant: "destructive",
      });
      return;
    }

    setIsCompiling(true);

    try {
      const { apiRequest } = await import("@/lib/queryClient");
      const response = await apiRequest('POST', '/api/compile', {
        template: templateContent,
        notes,
        temperature,
        webResearch,
        detailedAnalysis,
        formalTone,
        modelProvider: 'gemini', // Enforce Gemini
        sources: selectedSources, // Pass selected sources
        model: 'gemini-2.5-flash',
      });

      const data = await response.json();

      if (data.success && data.compiledContent) {
        setCompiledContent(data.compiledContent);

        const settingsInfo = [];
        if (webResearch) settingsInfo.push('Web Research');
        if (detailedAnalysis) settingsInfo.push('Analisi Dettagliata');
        if (formalTone) settingsInfo.push('Tono Formale');
        if (selectedSources.length > 0) settingsInfo.push(`${selectedSources.length} docs`);

        toast({
          title: "Documento compilato con successo",
          description: `Temperatura: ${temperature.toFixed(1)} | Strumenti attivi: ${settingsInfo.join(', ')}`,
        });
      } else {
        throw new Error(data.error || 'Errore durante la compilazione');
      }
    } catch (error: any) {
      console.error('Errore durante compilazione:', error);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la compilazione del documento.",
        variant: "destructive",
      });
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCopy = () => {
    if (!compiledContent) return;

    navigator.clipboard.writeText(compiledContent);
    toast({
      title: "Copiato",
      description: "Il documento è stato copiato negli appunti.",
    });
  };

  const handleDownload = () => {
    if (!compiledContent) return;

    const blob = new Blob([compiledContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const templateName = selectedTemplate ? templates[selectedTemplate].name : 'documento';
    a.download = `${templateName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Download completato",
      description: "Il documento è stato scaricato con successo.",
    });
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold">Compilatore Documenti AI</h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-template">
              <SelectValue placeholder="Seleziona template" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 border-b">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('template-upload')?.click();
                  }}
                  data-testid="button-upload-template"
                >
                  <span className="mr-2">📄</span>
                  Upload Template
                </Button>
                <input
                  id="template-upload"
                  type="file"
                  accept=".txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setTemplateContent(event.target?.result as string);
                        setSelectedTemplate("");
                        toast({
                          title: "Template caricato",
                          description: `${file.name} è stato caricato con successo.`,
                        });
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </div>
              <SelectItem value="privacy">Privacy Policy</SelectItem>
              <SelectItem value="relazione">Relazione Tecnica</SelectItem>
              <SelectItem value="contratto">Contratto di Servizio</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleCompile}
            disabled={!templateContent || isCompiling}
            data-testid="button-compile"
            className="w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isCompiling ? "Compilazione..." : "Compila con AI"}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        <div className="lg:col-span-3 h-[500px] lg:h-full">
          <ModelSettings
            notes={notes}
            temperature={temperature}
            webResearch={webResearch}
            detailedAnalysis={detailedAnalysis}
            formalTone={formalTone}
            modelProvider={modelProvider}
            onNotesChange={setNotes}
            onTemperatureChange={setTemperature}
            onWebResearchChange={setWebResearch}
            onDetailedAnalysisChange={setDetailedAnalysis}
            onFormalToneChange={setFormalTone}
            onModelProviderChange={setModelProvider}
          />
        </div>
        <div className="lg:col-span-4 h-[400px] lg:h-full">
          <TemplateEditor
            value={templateContent}
            onChange={setTemplateContent}
          />
        </div>
        <div className="lg:col-span-5 h-[400px] lg:h-full">
          <CompiledOutput
            content={compiledContent}
            onCopy={handleCopy}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  );
}
