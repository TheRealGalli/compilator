import { Asterisk, FileText, ChevronUp, Wand2, Menu, Type, ChevronDown, Printer, Download } from "lucide-react";
import { ThreeStars } from "@/components/ui/three-stars";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { ModelSettings } from "./ModelSettings";
import { Card } from "@/components/ui/card";

import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { generatePDFScreenshot } from '@/utils/screenshot';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSources } from "@/contexts/SourcesContext";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";


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
  const { toast } = useToast();
  const { selectedSources, masterSource } = useSources();

  // Template Generation State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  // Model settings
  const [notes, setNotes] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [webResearch, setWebResearch] = useState(false);
  const [detailedAnalysis, setDetailedAnalysis] = useState(true);
  const [formalTone, setFormalTone] = useState(true);
  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini'>(initialModelProvider);
  const [extractedFields, setExtractedFields] = useState<Array<{ fieldName: string; fieldType: string }>>([]);
  const [studioFontSize, setStudioFontSize] = useState<number>(14);



  useEffect(() => {
    // We are temporarily disabling field extraction based on pinned source
    setExtractedFields([]);
  }, [masterSource?.id]);

  // const fetchDocuments = async () => { // This function is no longer used.
  //   try {
  //     const { getApiUrl } = await import("@/lib/api-config");
  //     const response = await fetch(getApiUrl('/api/documents'));
  //     if (response.ok) {
  //       const data = await response.json();
  //       setDocuments(data);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching documents:', error);
  //   }
  // };

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value as keyof typeof templates);
    if (value && templates[value as keyof typeof templates]) {
      setTemplateContent(templates[value as keyof typeof templates].content);
      setCompiledContent("");
    }
  };

  const handleGenerateTemplate = async () => {
    if (!generatePrompt.trim()) return;

    setIsGeneratingTemplate(true);
    try {
      const { apiRequest } = await import("@/lib/queryClient");
      const { getApiUrl } = await import("@/lib/api-config");
      const response = await fetch(getApiUrl('/api/generate-template'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: generatePrompt,
          notes: notes, // Pass model settings notes
          sources: selectedSources.map((source) => ({
            name: source.name,
            type: source.type,
            base64: source.base64,
          })),
        }),
      });

      const data = await response.json();

      if (data.template) {
        setTemplateContent(data.template);
        setSelectedTemplate(""); // Clear predefined selection
        setIsGenerateModalOpen(false);
        setGeneratePrompt("");

        toast({
          title: "Template generato",
          description: "Il template è stato creato con successo.",
        });
      } else {
        throw new Error("Nessun template generato");
      }
    } catch (error: any) {
      console.error('Error generating template:', error);
      toast({
        title: "Errore",
        description: "Errore generazione template. Riprova.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const handleCompile = async () => {
    if (isCompiling) return;

    if (!templateContent.trim() && selectedSources.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona un template o aggiungi delle fonti per procedere.",
        variant: "destructive",
      });
      return;
    }

    setIsCompiling(true);
    try {
      const { apiRequest } = await import("@/lib/queryClient");

      console.log('[DEBUG Frontend] selectedSources:', selectedSources);

      // Pass sources with base64 content directly
      const sourcesForCompiler = selectedSources.map((source) => ({
        name: source.name,
        type: source.type,
        base64: source.base64,
      }));

      console.log('[DEBUG Frontend] Sources for compiler:', sourcesForCompiler.length);

      const response = await apiRequest('POST', '/api/compile', {
        template: templateContent,
        notes,
        temperature,
        webResearch,
        detailedAnalysis,
        formalTone,
        modelProvider,
        sources: selectedSources.map(s => ({
          name: s.name,
          type: s.type,
          base64: s.base64
        })),
        masterSource: masterSource ? {
          name: masterSource.name,
          type: masterSource.type,
          base64: masterSource.base64
        } : null,
        extractedFields: extractedFields.length > 0 ? extractedFields : undefined
      });



      const data = await response.json();
      if (data.compiledContent) {
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
      }
    } catch (error: any) {
      console.error('Errore compilazione:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile compilare il documento.",
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

  const handleDownload = async () => {
    if (!compiledContent) return;

    try {
      const { Document: DocxDocument, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, Footer, SimpleField, AlignmentType } = await import("docx");
      const { saveAs } = await import("file-saver");

      // Helper to strip emojis (Standard ranges without u flag for compatibility)
      const cleanText = (text: string) => {
        return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
      };

      // Helper to parse inline formatting (like **bold**)
      const parseInline = (text: string, options: { size?: number, color?: string, bold?: boolean } = {}) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return new TextRun({
              text: part.slice(2, -2),
              bold: true,
              font: "Arial",
              size: options.size || 22,
              color: options.color || "37352F"
            });
          }
          return new TextRun({
            text: part,
            bold: options.bold || false,
            font: "Arial",
            size: options.size || 22,
            color: options.color || "37352F"
          });
        });
      };

      const lines = compiledContent.split('\n');
      const docChildren: any[] = [];
      let currentTableRows: any[] = [];

      // Helper to close and push table
      const pushCurrentTable = () => {
        if (currentTableRows.length > 0) {
          docChildren.push(new Table({
            rows: currentTableRows,
            width: { size: 100 * 50, type: WidthType.PERCENTAGE }, // 5000 = 100%
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "37352F" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "37352F" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "37352F" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "37352F" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
              insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
            }
          }));
          docChildren.push(new Paragraph({ text: "" }));
          currentTableRows = [];
        }
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Table Detection (| col | col |)
        if (line.startsWith('|') && line.endsWith('|')) {
          // Check if it's a separator line (| --- | --- |) 
          // Improved regex to be more specific to markdown separators
          if (line.match(/^\|[\s\-:|]+\|$/) && line.includes('-')) {
            continue;
          }

          const cells = line.split('|').slice(1, -1).map(c => c.trim());

          if (cells.length > 0) {
            currentTableRows.push(new TableRow({
              children: cells.map((cellText, colIdx) => new TableCell({
                children: [new Paragraph({
                  children: parseInline(cleanText(cellText), { size: 20 }),
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 80, after: 80 } // Add some vertical padding inside cells
                })],
                // DOCX uses a scale of 5000 for 100% width in PERCENTAGE mode
                width: { size: (100 / cells.length) * 50, type: WidthType.PERCENTAGE },
                shading: currentTableRows.length === 0 ? { fill: "F7F7F7" } : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                  left: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                  right: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                }
              }))
            }));
          }
          continue;
        } else {
          // If not a table line, push existing table if any
          pushCurrentTable();
        }

        const rawText = cleanText(line);
        if (!rawText) {
          docChildren.push(new Paragraph({ text: "" }));
          continue;
        }
        // ... (rest of headers logic remains same)

        // Detect Headers (# Header)
        if (rawText.startsWith('# ')) {
          docChildren.push(new Paragraph({
            children: parseInline(rawText.substring(2), { size: 32, bold: true }),
            spacing: { before: 400, after: 200 }
          }));
        } else if (rawText.startsWith('## ')) {
          docChildren.push(new Paragraph({
            children: parseInline(rawText.substring(3), { size: 28, bold: true }),
            spacing: { before: 300, after: 150 }
          }));
        } else if (rawText.startsWith('### ')) {
          docChildren.push(new Paragraph({
            children: parseInline(rawText.substring(4), { size: 24, bold: true }),
            spacing: { before: 200, after: 100 }
          }));
        }
        // Detect Bullets
        else if (rawText.startsWith('- ') || rawText.startsWith('* ') || rawText.match(/^\d+\. /)) {
          const isNumbered = rawText.match(/^\d+\. /);
          const textContent = isNumbered ? rawText.replace(/^\d+\. /, '') : rawText.substring(2);

          docChildren.push(new Paragraph({
            children: parseInline(textContent),
            bullet: { level: 0 },
            spacing: { after: 120, line: 360 }
          }));
        }
        // Standard Paragraph
        else {
          docChildren.push(new Paragraph({
            children: parseInline(rawText),
            spacing: { after: 120, line: 360 }
          }));
        }
      }

      // Final push for any table at the end of the document
      pushCurrentTable();

      const doc = new DocxDocument({
        styles: {
          default: {
            document: {
              run: {
                font: "Arial",
                size: 22,
                color: "37352F",
              },
              paragraph: {
                spacing: { line: 360 }, // 1.5 line spacing
              }
            }
          }
        },
        sections: [{
          properties: {},
          children: docChildren,
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: "** ",
                      color: "0066CC", // Blue
                      bold: true,
                      size: 22,
                      font: "Arial"
                    }),
                    new SimpleField("PAGE"),
                  ],
                }),
              ],
            }),
          },
        }],
      });

      const blob = await Packer.toBlob(doc);
      const templateName = selectedTemplate ? templates[selectedTemplate as keyof typeof templates].name : 'documento';
      saveAs(blob, `${templateName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.docx`);

      toast({
        title: "Download completato",
        description: "Il documento .docx è stato scaricato con successo (Formattazione professionale).",
      });

    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Errore Download",
        description: "Impossibile generare il file DOCX.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Compilatore Documenti AI</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Always show template selector */}
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-template">
              <SelectValue placeholder="Seleziona template" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 border-b space-y-1">
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
                <Button
                  variant="outline"
                  className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsGenerateModalOpen(true);
                  }}
                  data-testid="button-generate-template"
                >
                  <span className="mr-2">✏️</span>
                  Genera Template
                </Button>
              </div>
              <SelectItem value="privacy">Privacy Policy</SelectItem>
              <SelectItem value="relazione">Relazione Tecnica</SelectItem>
              <SelectItem value="contratto">Contratto di Servizio</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleCompile}
            disabled={(!templateContent && !masterSource) || isCompiling}
            data-testid="button-compile"
            className="w-full sm:w-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-6 h-6 mr-2 ${isCompiling ? 'animate-turbo-spin text-blue-300' : ''}`}
            >
              <path d="M12 2v20M2 12h20M4.929 4.929l14.142 14.142M4.929 19.071L19.071 4.929" />
            </svg>
            {isCompiling ? "Processando..." : "Compila con AI"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 min-h-[400px] lg:min-h-0 lg:h-full overflow-auto">
            {/* Conditional Rendering: ModelSettings vs StudioChat */}
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

          <div className="lg:col-span-9 min-h-[300px] lg:min-h-0 lg:h-full overflow-auto">
            {/* NORMAL MODE - Show Template + Output */}
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TemplateEditor
                value={templateContent}
                onChange={setTemplateContent}
              />
              <CompiledOutput
                content={compiledContent}
                onCopy={handleCopy}
                onDownload={handleDownload}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Template Generation Modal */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">✏️</span>
              Genera Template con AI
            </DialogTitle>
            <DialogDescription>
              Descrivi il tipo di documento che ti serve. L'AI genererà uno scheletro pronto con i placeholder corretti.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Es: Verbale di riunione del consiglio di amministrazione, formale, con elenco partecipanti e deliberazioni..."
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerateModalOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleGenerateTemplate}
              disabled={!generatePrompt.trim() || isGeneratingTemplate}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Asterisk className={`mr-2 h-4 w-4 text-white ${isGeneratingTemplate ? 'animate-turbo-spin' : ''}`} />
              {isGeneratingTemplate ? "Generazione..." : "Genera Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
