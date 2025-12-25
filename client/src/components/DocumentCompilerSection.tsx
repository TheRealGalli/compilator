import { Asterisk, FileText, ChevronUp, Wand2, Menu, Type, ChevronDown, Printer, Download } from "lucide-react";
import { ThreeStars } from "@/components/ui/three-stars";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { ModelSettings } from "./ModelSettings";
import { PDFViewer } from "./PDFViewer";
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

interface Annotation {
  id: string;
  x: number;
  y: number;
  text: string;
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
  const { selectedSources, pinnedSource } = useSources();

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
  const [manualAnnotations, setManualAnnotations] = useState<Annotation[]>([]);



  useEffect(() => {
    if (!pinnedSource) {
      setExtractedFields([]);
      return;
    }

    const extractFields = async () => {
      try {
        const { getApiUrl } = await import("@/lib/api-config");
        const response = await fetch(getApiUrl('/api/extract-fields-for-context'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pinnedSource: {
              name: pinnedSource.name,
              type: pinnedSource.type,
              base64: pinnedSource.base64
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          setExtractedFields(data.fields || []);
          console.log(`[DocumentCompiler] Extracted ${data.fields?.length} fields for context`);
        }
      } catch (error) {
        console.error('Error extracting fields for context:', error);
      }
    };

    extractFields();
  }, [pinnedSource?.id]);

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
        pinnedSource: pinnedSource ? {
          name: pinnedSource.name,
          type: pinnedSource.type,
          base64: pinnedSource.base64
        } : null,
        extractedFields: extractedFields.length > 0 ? extractedFields : undefined,
        manualAnnotations: manualAnnotations.length > 0 ? manualAnnotations : undefined
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
      const { Document: DocxDocument, Packer, Paragraph, TextRun, Footer, SimpleField, AlignmentType } = await import("docx");
      const { saveAs } = await import("file-saver");

      // Helper to strip emojis (Standard ranges without u flag for compatibility)
      const cleanText = (text: string) => {
        return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
      };

      const lines = compiledContent.split('\n');
      const docChildren = lines.map(line => {
        const rawText = cleanText(line).replace(/\*\*/g, '').trim();

        if (!rawText) return new Paragraph({ text: "" });

        // Detect Bullets
        if (rawText.startsWith('- ') || rawText.startsWith('* ') || rawText.match(/^\d+\. /)) {
          const isNumbered = rawText.match(/^\d+\. /);
          const textContent = isNumbered ? rawText.replace(/^\d+\. /, '') : rawText.substring(2);

          return new Paragraph({
            children: [new TextRun({ text: textContent, font: "Arial", size: 22, color: "37352F" })],
            bullet: { level: 0 }, // docx handles numbering if we use numbering objects, but simple bullet is safer for loose text
            spacing: { after: 120, line: 360 }
          });
        }

        // Detect Headers (All CAPS, short) -> "Notion H2/H3" style
        if (rawText.length > 3 && rawText.length < 60 && rawText === rawText.toUpperCase() && !rawText.includes('.')) {
          return new Paragraph({
            children: [new TextRun({ text: rawText, font: "Arial", bold: true, size: 28, color: "37352F" })],
            spacing: { before: 240, after: 120, line: 360 }
          });
        }

        // Standard Paragraph
        return new Paragraph({
          children: [new TextRun({ text: rawText, font: "Arial", size: 22, color: "37352F" })],
          spacing: { after: 120, line: 360 }
        });
      });

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
          {/* Hide template selector in Studio Mode */}
          {!pinnedSource && (
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
          )}

          <Button
            onClick={handleCompile}
            disabled={!templateContent || isCompiling}
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
              className={`w-10 h-10 mr-0.5 ${isCompiling ? 'animate-turbo-spin text-blue-300' : ''}`}
            >
              <path d="M12 2v20M2 12h20M4.929 4.929l14.142 14.142M4.929 19.071L19.071 4.929" />
            </svg>
            {isCompiling ? "Compilazione..." : "Compila con AI"}
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
            {pinnedSource ? (
              // STUDIO MODE - Show PDF Viewer or Coming Soon
              // STUDIO MODE - Show File Preview
              (() => {
                const isPDF = pinnedSource.type.includes('pdf');
                const isWord = pinnedSource.type.includes('wordprocessingml') || pinnedSource.type.includes('msword') || pinnedSource.name.endsWith('.docx');
                const isText = pinnedSource.type.includes('text/plain') || pinnedSource.name.endsWith('.txt');
                const isCSV = pinnedSource.type.includes('text/csv') || pinnedSource.name.endsWith('.csv');

                if (isPDF) {
                  return (
                    <PDFViewer
                      base64={pinnedSource.base64 || ''}
                      fileName={pinnedSource.name}
                      onAnnotationsChange={setManualAnnotations}
                    />
                  );
                }

                if (isText || isCSV) {
                  const safeDecodeBase64 = (b64: string) => {
                    try {
                      const binString = atob(b64);
                      const bytes = new Uint8Array(binString.length);
                      for (let i = 0; i < binString.length; i++) {
                        bytes[i] = binString.charCodeAt(i);
                      }
                      return new TextDecoder().decode(bytes);
                    } catch (e) {
                      return "Errore decodifica testo.";
                    }
                  };

                  const handleDownloadText = () => {
                    const content = safeDecodeBase64(pinnedSource.base64 || '');
                    const blob = new Blob([content], { type: pinnedSource.type });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = pinnedSource.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  };

                  const handlePrintText = () => {
                    const content = safeDecodeBase64(pinnedSource.base64 || '');
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`<pre style="white-space: pre-wrap; font-family: monospace; padding: 20px;">${content}</pre>`);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  };

                  return (
                    <Card className="h-full flex flex-col overflow-hidden bg-card border-border shadow-sm">
                      <div className="h-10 bg-[#1e1e1e] flex items-center justify-between px-4 z-20">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-white/90">Studio Preview</span>
                          <div className="h-4 w-px bg-white/10 mx-1" />

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/10 gap-1 h-7 px-2 font-normal">
                                <Type className="w-3.5 h-3.5" />
                                <span className="text-[10px]">IMPOSTAZIONI</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                              <DropdownMenuLabel>Personalizza Anteprima</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <div className="p-4 space-y-4">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-foreground">Dimensione Caratteri</span>
                                    <span className="text-xs text-muted-foreground">{studioFontSize}px</span>
                                  </div>
                                  <Slider
                                    value={[studioFontSize]}
                                    onValueChange={(v) => setStudioFontSize(v[0])}
                                    min={8}
                                    max={32}
                                    step={1}
                                  />
                                </div>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center gap-4">
                          <p className="text-[11px] text-white/40 truncate max-w-[300px]">{pinnedSource.name}</p>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={handlePrintText} title="Stampa" className="text-white/40 hover:text-white hover:bg-white/10 h-7 w-7">
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={handleDownloadText} title="Scarica" className="text-white/40 hover:text-white hover:bg-white/10 h-7 w-7">
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex-1 overflow-auto p-12 font-mono whitespace-pre-wrap selection:bg-indigo-500/30 selection:text-current text-foreground/90 bg-background/50 transition-all duration-200"
                        style={{ fontSize: `${studioFontSize}px` }}
                      >
                        {safeDecodeBase64(pinnedSource.base64 || '')}
                      </div>
                    </Card>
                  );
                }




                if (isWord) {
                  return (
                    <Card className="h-full flex items-center justify-center p-12">
                      <div className="text-center max-w-md">
                        <div className="text-6xl mb-4">📝</div>
                        <h3 className="text-xl font-semibold mb-2">Word Preview</h3>
                        <p className="text-muted-foreground">
                          Il file <strong>{pinnedSource.name}</strong> è caricato ed è pronto per essere usato come fonte.
                          Al momento i file Word possono essere analizzati dall'IA ma non visualizzati direttamente in anteprima.
                        </p>
                      </div>
                    </Card>
                  );
                }

                // Default Coming Soon
                return (
                  <Card className="h-full flex items-center justify-center p-12">
                    <div className="text-center max-w-md">
                      <div className="text-6xl mb-4">🚧</div>
                      <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
                      <p className="text-muted-foreground">
                        L'anteprima per questo tipo di file sarà disponibile prossimamente.
                      </p>
                    </div>
                  </Card>
                );
              })()

            ) : (
              // NORMAL MODE - Show Template + Output
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
