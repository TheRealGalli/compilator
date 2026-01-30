import { Asterisk, FileText, ChevronUp, Wand2, Menu, Type, ChevronDown, Printer, Download } from "lucide-react";
import { ThreeStars } from "@/components/ui/three-stars";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { PdfFieldReview, type FieldProposal } from "./PdfFieldReview";
import { PdfPreview } from "./PdfPreview";
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
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";

import { getApiUrl } from "@/lib/api-config";
import { apiRequest } from "@/lib/queryClient";

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

  // PDF Mode & Field Review
  const [isPdfMode, setIsPdfMode] = useState(false);
  const [pdfProposals, setPdfProposals] = useState<FieldProposal[]>([]);
  const [isFinalizingPdf, setIsFinalizingPdf] = useState(false);
  const [finalizedPdfUrl, setFinalizedPdfUrl] = useState<string | null>(null);



  useEffect(() => {
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

    const isFillablePdf = masterSource && masterSource.isFillable;

    if (!isFillablePdf && !templateContent.trim() && selectedSources.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona un template o aggiungi delle fonti per procedere.",
        variant: "destructive",
      });
      return;
    }

    setIsCompiling(true);
    try {
      if (isFillablePdf) {
        // Step 1: Discover native fields
        const discoveryRes = await fetch(getApiUrl('/api/pdf/discover-fields'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ masterSource })
        });
        const { fields, cacheKey } = await discoveryRes.json();

        if (fields && fields.length > 0) {
          // IMMEDIATE UI FEEDBACK: Show the review panel and initialize placeholders
          setIsPdfMode(true);
          setPdfProposals(fields.map((f: any) => ({
            name: f.name,
            label: f.label || f.name,
            type: f.type,
            value: "",
            reasoning: "In attesa di analisi AI...",
            status: 'pending'
          })));

          // Step 2: Incremental AI proposals in batches
          const BATCH_SIZE = 25;
          let allProposals: any[] = [];

          for (let i = 0; i < fields.length; i += BATCH_SIZE) {
            const batch = fields.slice(i, i + BATCH_SIZE);

            try {
              const proposalRes = await fetch(getApiUrl('/api/pdf/propose-values'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fields: batch,
                  sources: selectedSources,
                  notes,
                  webResearch,
                  cacheKey,
                  // Inviamo il master in OGNI batch per garantire coerenza visiva e precisione di mappatura
                  masterSource: masterSource
                })
              });

              const { proposals } = await proposalRes.json();
              console.log(`[DEBUG PDF] Batch (${i}-${i + batch.length}) Received:`, proposals);
              allProposals = [...allProposals, ...proposals];

              // Aggiorniamo la UI incrementalmente per feedback istantaneo
              setPdfProposals(current => {
                const next = [...current];
                proposals.forEach((p: any) => {
                  const idx = next.findIndex(item => item.name === p.name);
                  if (idx !== -1) {
                    next[idx] = {
                      ...next[idx],
                      value: p.value,
                      label: p.label,
                      reasoning: p.reasoning,
                      status: 'pending' // Still needs human approval
                    };
                  }
                });
                return next;
              });

            } catch (err) {
              console.error(`[PDF Batch Error] Failed on batch ${i}:`, err);
            }
          }
        } else {
          toast({
            title: "Nessun campo rilevato",
            description: "Il PDF master non sembra contenere campi modulo compilabili.",
            variant: "destructive"
          });
        }
      } else {
        // Standard template compilation
        console.log('[DEBUG Frontend] selectedSources:', selectedSources);

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
          } : null
        });

        const data = await response.json();
        if (data.compiledContent) {
          setCompiledContent(data.compiledContent);
          setIsPdfMode(false); // Back to standard mode if we compile a template

          toast({
            title: "Documento compilato con successo",
            description: `Modello: ${modelProvider} | Docs: ${selectedSources.length}`,
          });
        }
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

  const handleFinalizePdf = async () => {
    if (isFinalizingPdf || pdfProposals.length === 0) return;

    setIsFinalizingPdf(true);
    try {
      // Filter only approved values
      const approvedValues: Record<string, string | boolean> = {};
      pdfProposals.forEach(p => {
        if (p.status === 'approved') {
          approvedValues[p.name] = p.value;
        }
      });

      const response = await fetch(getApiUrl('/api/pdf/finalize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterSource,
          values: approvedValues
        })
      });

      if (!response.ok) throw new Error("Errore durante la finalizzazione PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setFinalizedPdfUrl(url);

      // Trigger automatic download
      const a = document.createElement('a');
      a.href = url;
      a.download = `compilato-${masterSource?.name || 'documento'}.pdf`;
      a.click();

      toast({
        title: "PDF Finalizzato",
        description: "Il documento è stato generato e il download è iniziato.",
      });

    } catch (err: any) {
      console.error("[Finalize PDF Error]", err);
      toast({
        title: "Errore",
        description: "Impossibile generare il PDF finale.",
        variant: "destructive"
      });
    } finally {
      setIsFinalizingPdf(false);
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
      const { Document: DocxDocument, Packer, Paragraph, TextRun, Footer, SimpleField, AlignmentType } = await import("docx");
      const { saveAs } = await import("file-saver");

      // Helper to strip emojis (Standard ranges without u flag for compatibility)
      const cleanText = (text: string) => {
        return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
      };

      // Helper to parse inline formatting (like **bold** and [x]/[ ])
      const parseInline = (text: string, options: { size?: number, color?: string, bold?: boolean } = {}) => {
        // First handle bold splitting
        const parts = text.split(/(\*\*.*?\*\*)/g);
        const runs: any[] = [];

        parts.forEach(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            runs.push(...renderCheckboxesInDocx(boldText, { ...options, bold: true }));
          } else {
            runs.push(...renderCheckboxesInDocx(part, options));
          }
        });
        return runs;
      };

      // Helper to render checkbox symbols in DOCX
      const renderCheckboxesInDocx = (text: string, options: { size?: number, color?: string, bold?: boolean } = {}) => {
        const checkboxRegex = /\[([ xX])\]/g;
        const runs: any[] = [];
        let lastIdx = 0;
        let match;

        while ((match = checkboxRegex.exec(text)) !== null) {
          if (match.index > lastIdx) {
            runs.push(new TextRun({
              text: text.substring(lastIdx, match.index),
              bold: options.bold || false,
              font: "Arial",
              size: options.size || 24,
              color: options.color || "37352F"
            }));
          }

          const isChecked = match[1].toLowerCase() === 'x';
          runs.push(new TextRun({
            text: isChecked ? " ☒ " : " ☐ ",
            bold: true, // Make checkboxes bold for visibility
            font: "MS Gothic", // Use MS Gothic for reliable symbol rendering
            size: options.size || 24,
            color: isChecked ? "1D4ED8" : "37352F" // Blue for checked, dark for unchecked
          }));
          lastIdx = match.index + match[0].length;
        }

        if (lastIdx < text.length) {
          runs.push(new TextRun({
            text: text.substring(lastIdx),
            bold: options.bold || false,
            font: "Arial",
            size: options.size || 24,
            color: options.color || "37352F"
          }));
        }

        return runs;
      };

      const lines = compiledContent.split('\n');
      const docChildren: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const rawText = cleanText(line);
        if (!rawText) {
          docChildren.push(new Paragraph({ text: "" }));
          continue;
        }
        // ... (rest of headers logic remains same)

        // Detect Headers (# Header)
        if (rawText.startsWith('# ')) {
          docChildren.push(new Paragraph({
            children: parseInline(rawText.substring(2), { size: 36, bold: true }),
            spacing: { before: 400, after: 200 }
          }));
        } else if (rawText.startsWith('## ')) {
          docChildren.push(new Paragraph({
            children: parseInline(rawText.substring(3), { size: 30, bold: true }),
            spacing: { before: 300, after: 150 }
          }));
        } else if (rawText.startsWith('### ')) {
          docChildren.push(new Paragraph({
            children: parseInline(rawText.substring(4), { size: 27, bold: true }),
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

      const doc = new DocxDocument({
        styles: {
          default: {
            document: {
              run: {
                font: "Arial",
                size: 24,
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
                      size: 20,
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
                  accept=".txt,.md,.rtf"
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

          <div className="lg:col-span-9 min-h-[300px] lg:min-h-0 lg:h-full overflow-hidden">
            {isPdfMode ? (
              /* PDF STUDIO UNIFIED VIEW */
              <div className="h-full flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-500">
                <Card className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden border-blue-500/20 shadow-xl shadow-blue-500/5 bg-background/50">
                  <div className="flex-1 min-h-[400px] lg:min-h-0 border-r border-border/50">
                    <PdfPreview
                      fileBase64={masterSource?.base64 || ""}
                      className="rounded-none border-none h-full"
                    />
                  </div>
                  <div className="w-full lg:w-[400px] shrink-0 h-[400px] lg:h-full bg-muted/5">
                    <PdfFieldReview
                      proposals={pdfProposals}
                      onUpdate={setPdfProposals}
                      onFinalize={handleFinalizePdf}
                      isFinalizing={isFinalizingPdf}
                      isCompiling={isCompiling}
                      title="Studio Compilazione PDF"
                    />
                  </div>
                </Card>
              </div>
            ) : (
              /* STANDARD COMPILER VIEW */
              <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="min-h-[400px] lg:min-h-0 h-full">
                  <TemplateEditor
                    value={templateContent}
                    onChange={setTemplateContent}
                  />
                </div>

                <div className="min-h-[300px] lg:min-h-0 h-full">
                  <CompiledOutput
                    content={compiledContent}
                    onCopy={handleCopy}
                    onDownload={handleDownload}
                  />
                </div>
              </div>
            )}
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
