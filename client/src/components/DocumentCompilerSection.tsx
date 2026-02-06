import { Asterisk, FileText, ChevronUp, Wand2, Menu, Type, ChevronDown, Printer, Download, X, Check, Copy, Settings2, Sparkles, Zap, BookOpen, Scale, Loader2 } from "lucide-react";
import { RefineChat } from "./RefineChat";
import { motion, AnimatePresence } from "framer-motion";
import { ThreeStars } from "@/components/ui/three-stars"; // Gromit Core Branding
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { PdfPreview } from "./PdfPreview";
import { ModelSettings } from "./ModelSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generatePDFScreenshot } from '@/utils/screenshot';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSources } from "@/contexts/SourcesContext";
import { useCompiler } from "@/contexts/CompilerContext";
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
  onCompile?: (content: string) => void;
}

interface Document {
  name: string;
  gcsPath: string;
}

export function DocumentCompilerSection({
  modelProvider: initialModelProvider = 'gemini',
  onModelProviderChange,
  onCompile
}: DocumentCompilerSectionProps = {}) {
  const {
    templateContent, setTemplateContent,
    compiledContent, setCompiledContent,
    isRefiningMode, setIsRefiningMode,
    isReviewing, setIsReviewing,
    pendingContent, setPendingContent,
    lastCompileContext, setLastCompileContext,
    notes, setNotes,
    temperature, setTemperature,
    webResearch, setWebResearch,
    detailedAnalysis, setDetailedAnalysis,
    formalTone, setFormalTone,
    isLocked, setIsLocked,
    currentMode, setCurrentMode,
    frozenColor, setFrozenColor,
    pinnedSourceId, setPinnedSourceId,
    takeStandardSnapshot, restoreStandardSnapshot,
    takeMasterSnapshot, restoreMasterSnapshot,
    resetSession
  } = useCompiler();

  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof templates | "">("");
  const [isCompiledView, setIsCompiledView] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const { toast } = useToast();
  const { sources, selectedSources, masterSource, toggleMaster } = useSources();

  // Template Generation State
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);

  const [modelProvider, setModelProvider] = useState<'openai' | 'gemini'>(initialModelProvider);
  const [studioFontSize, setStudioFontSize] = useState<number>(14);

  // PDF Mode is now handled by currentMode in context
  const isPdfMode = currentMode === 'fillable';
  const setIsPdfMode = (val: boolean) => setCurrentMode(val ? 'fillable' : 'standard');

  const [pendingMention, setPendingMention] = useState<{ text: string; id: string; start?: number; end?: number } | null>(null);
  const [isOutputVisible, setIsOutputVisible] = useState(true);
  const [mentionCounts, setMentionCounts] = useState({ template: 0, copilot: 0 });

  const handleMention = (text: string, source: 'template' | 'copilot', start?: number, end?: number) => {
    setMentionCounts(prev => {
      const newCount = prev[source] + 1;
      const mentionId = `#${source === 'template' ? 'T' : 'C'}${newCount}`;
      setPendingMention({ text, id: mentionId, start, end });
      return { ...prev, [source]: newCount };
    });
  };



  useEffect(() => {
    // 1. PINNING/UNPINNING Logic
    if (masterSource?.id !== pinnedSourceId) {
      if (pinnedSourceId && isLocked) {
        takeMasterSnapshot(pinnedSourceId);
      }

      if (masterSource) {
        if (!isLocked) {
          takeStandardSnapshot();
        }
        restoreMasterSnapshot(masterSource.id);
        // If it's a fresh pin (no content yet), show template view
        setIsCompiledView(false);
      } else if (isLocked && !masterSource) {
        restoreStandardSnapshot();
        // Return to where we were in standard mode (if it was compiled, show it)
        setIsCompiledView(compiledContent !== "");
      }
    }
  }, [masterSource?.id, pinnedSourceId, isLocked, compiledContent, restoreMasterSnapshot, restoreStandardSnapshot, takeStandardSnapshot, takeMasterSnapshot, setPinnedSourceId]);

  useEffect(() => {
    // 2. AUTO-ACTIVATE PDF STUDIO if master is fillable AND not in bypass mode
    // ONLY if not already locked by a compile
    if (isLocked) return;

    if (masterSource?.isFillable && !masterSource?.isBypass) {
      if (!isPdfMode) {
        setIsPdfMode(true);
      }
    } else {
      if (isPdfMode) setIsPdfMode(false);
    }
  }, [masterSource?.id, masterSource?.isFillable, masterSource?.isBypass, isLocked, isPdfMode]);

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
    setIsCompiledView(false);
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
        setIsCompiledView(false);
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

  // 4. Handle Master Source Selection/Toggling
  const handleToggleMaster = (sourceId: string) => {
    toggleMaster(sourceId);
  };

  const handlePreview = (content: string) => {
    setPendingContent(content);
    setIsReviewing(true);
  };

  const handleCompile = async () => {
    if (isCompiling || isPdfMode) return;

    // Allow empty template if masterSource is present (Classic Workflow)
    if (!templateContent.trim() && !masterSource && selectedSources.length === 0) {
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
      const { getApiUrl } = await import("@/lib/api-config");

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
      // Log removed to clean up console

      if (data.compiledContent) {
        // Sanitize escaped brackets
        let sanitizedContent = data.compiledContent
          .replace(/\\+\s*\[/g, '[')
          .replace(/\\+\s*\]/g, ']')
          .replace(/\\-/g, '-')
          .replace(/\\\*/g, '*');

        // Force checkboxes to be list items for Tiptap (replace "^[ ]" with "- [ ]")
        sanitizedContent = sanitizedContent.replace(/^(\s*)\[([ xX])\]/gm, '$1- [$2]');

        const context = {
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
          notes,
          temperature,
          webResearch,
          detailedAnalysis,
          formalTone,
          modelProvider,
          fetchedCompilerContext: data.fetchedCompilerContext,
          extractedFields: data.extractedFields,
          manualAnnotations: data.manualAnnotations,
          groundingMetadata: data.groundingMetadata
        };

        setLastCompileContext(context);
        setCompiledContent(sanitizedContent);
        setTemplateContent(sanitizedContent);
        setIsCompiledView(true);
        setIsRefiningMode(true); // Auto-trigger Copilot Mode

        // FREEZE UI if master pin is active
        if (masterSource) {
          setIsLocked(true);
          // Calculate the color to freeze
          let color = 'text-muted-foreground';
          if (!masterSource.isBypass) {
            if (masterSource.isXfa) color = 'text-red-500 fill-red-500/20';
            else if (masterSource.isAlreadyFilled) color = 'text-orange-500 fill-orange-500/20';
            else if (masterSource.isFillable) color = 'text-green-500 fill-green-500/20';
          }
          setFrozenColor(color);
          // Save this master compilation state
          takeMasterSnapshot(masterSource.id);
        } else {
          // Take snapshot of this standard compilation to restore later on unpin
          takeStandardSnapshot();
        }

        if (onCompile) onCompile(sanitizedContent); // Notify parent of compilation

        toast({
          title: "Documento compilato con successo",
          description: `Modello: ${modelProvider} | Docs: ${selectedSources.length}`,
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

  // Handle Review Actions
  const handleAcceptRefinement = () => {
    if (pendingContent) {
      setCompiledContent(pendingContent);
      setTemplateContent(pendingContent); // Update template content as well
      if (onCompile) onCompile(pendingContent);
      toast({ title: "Modifica Accettata", description: "Il documento è stato aggiornato." });
    }
    setIsReviewing(false);
    setPendingContent(null);
  };

  const handleRejectRefinement = () => {
    setIsReviewing(false);
    setPendingContent(null);
    toast({ title: "Modifica Annullata", description: "Ripristinata versione precedente." });
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
      // Add Table imports
      const {
        Document: DocxDocument, Packer, Paragraph, TextRun, Footer, SimpleField,
        AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle,
        TableLayoutType
      } = await import("docx");
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
            bold: true,
            font: "Arial", // Standard font to avoid replacement warnings on Mac
            size: options.size || 24,
            color: isChecked ? "1D4ED8" : "37352F"
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

      // Helper to strip markdown escapes for DOCX (e.g. \# -> #, \[ -> [)
      const unescapeMarkdown = (text: string) => {
        if (!text) return "";
        return text.replace(/\\([#*_\[\]\-|])/g, '$1');
      };

      const lines = compiledContent ? compiledContent.split('\n') : [];
      const docChildren: any[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          docChildren.push(new Paragraph({ text: "" }));
          continue;
        }

        // 0. Detect Tables (More lenient: starts with | or contains >= 2 pipes)
        const isTableLine = (str: string) => str.trim().startsWith('|') || (str.split('|').length > 2);

        if (isTableLine(line)) {
          const tableRowsData: string[][] = [];
          let j = i;

          // Buffer table lines
          while (j < lines.length && isTableLine(lines[j])) {
            const rowLine = lines[j].trim();
            // Skip separator lines (| --- | --- | or --- | ---)
            if (rowLine.match(/^[|\s\-:.]+$/)) {
              j++;
              continue;
            }

            let cells = rowLine.split('|');
            // Remove first and last empty elements if they exist
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();

            if (cells.length > 0) {
              tableRowsData.push(cells.map(c => c.trim()));
            }
            j++;
          }

          if (tableRowsData.length > 0) {
            // Find max columns to ensure consistency
            const maxCols = Math.max(...tableRowsData.map(r => r.length));
            const baseWidth = 9070;
            const cellWidth = Math.floor(baseWidth / maxCols);

            const tableRows = tableRowsData.map((row, rowIndex) => {
              const isHeader = rowIndex === 0;
              // Ensure row has maxCols cells
              const standardRow = [...row];
              while (standardRow.length < maxCols) standardRow.push("");

              return new TableRow({
                children: standardRow.map(cellText => new TableCell({
                  children: [new Paragraph({
                    children: parseInline(unescapeMarkdown(cellText), { size: 22, bold: isHeader }),
                    alignment: AlignmentType.LEFT
                  })],
                  width: { size: cellWidth, type: WidthType.DXA },
                  shading: isHeader ? { fill: "F3F4F6" } : undefined,
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }))
              });
            });

            docChildren.push(new Table({
              rows: tableRows,
              width: { size: baseWidth, type: WidthType.DXA },
              columnWidths: Array(maxCols).fill(cellWidth),
              layout: TableLayoutType.FIXED,
            }));

            i = j - 1;
            continue;
          }
        }

        // Clean text for normal paragraphs *after* failing table check
        const rawText = unescapeMarkdown(cleanText(line));

        // 1. Detect Headers (# Header)
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
        // 2. Detect Bullets
        else if (rawText.startsWith('- ') || rawText.startsWith('* ') || rawText.match(/^\d+\. /)) {
          const isNumbered = rawText.match(/^\d+\. /);
          const textContent = isNumbered ? rawText.replace(/^\d+\. /, '') : rawText.substring(2);

          docChildren.push(new Paragraph({
            children: parseInline(textContent),
            bullet: isNumbered ? undefined : { level: 0 },
            numbering: isNumbered ? { reference: "numbered-list", level: 0 } : undefined,
            spacing: { after: 120, line: 360 }
          }));
        }
        // 3. Standard Paragraph
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
        numbering: {
          config: [
            {
              reference: "numbered-list",
              levels: [
                {
                  level: 0,
                  format: "decimal",
                  text: "%1.",
                  alignment: AlignmentType.START,
                  style: {
                    paragraph: {
                      indent: { left: 720, hanging: 360 },
                    },
                  },
                },
              ],
            },
          ],
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
          <h2 className="text-xl font-semibold">Compilatore Documenti</h2>
        </div>
        <div className="relative flex flex-col items-end min-h-[40px]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {!isPdfMode && !isRefiningMode && (
              <>
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
                              setIsCompiledView(false);
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
                  className="w-full sm:w-auto gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`w-6 h-6 ${isCompiling ? 'animate-turbo-spin text-blue-300' : ''}`}
                  >
                    <path d="M12 2v20M2 12h20M4.929 4.929l14.142 14.142M4.929 19.071L19.071 4.929" />
                  </svg>
                  {isCompiling ? "Processando..." : "Compila con AI"}
                </Button>
              </>
            )}
          </div>
          {!templateContent && masterSource && !isPdfMode && (
            <div className="absolute top-[32px] right-0 pointer-events-none">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold opacity-60 mr-1">
                Basato sul Master Pin
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {isPdfMode ? (
          /* PDF STUDIO UNIFIED VIEW */
          <div className="h-full grid grid-cols-12 gap-4">
            {/* COLUMN 1: Settings OR Chat (col-span-3) */}
            <div className="col-span-3 h-full flex flex-col overflow-hidden">
              <ModelSettings
                className="flex-1"
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
                isRefining={isRefiningMode}
                chatInterface={
                  <RefineChat
                    minimal={true}
                    compileContext={lastCompileContext}
                    currentContent={pendingContent || compiledContent}
                    onPreview={(newContent) => {
                      setPendingContent(newContent);
                      setIsReviewing(true);
                    }}
                    isReviewing={isReviewing}
                    onAccept={handleAcceptRefinement}
                    onReject={handleRejectRefinement}
                    onClose={() => setIsRefiningMode(false)}
                    pendingMention={pendingMention}
                    onMentionConsumed={() => setPendingMention(null)}
                    onMentionCreated={(text, source, start, end) => handleMention(text, source, start, end)}
                  />
                }
              />
            </div>

            {/* COLUMN 2: PDF Preview (col-span-9) */}
            <div className="col-span-9 flex flex-col min-h-0 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-blue-500/20 shadow-xl shadow-blue-500/5 bg-background/50">
                <PdfPreview
                  fileBase64={masterSource?.base64 || ""}
                  fileName={masterSource?.name}
                  className="rounded-none border-none h-full"
                  selectedSources={selectedSources.map(s => ({
                    name: s.name,
                    type: s.type,
                    base64: s.base64
                  }))}
                  notes={notes}
                  webResearch={webResearch}
                  modelProvider={modelProvider}
                  onCompile={(content, metadata) => {
                    // Synchronize state when PDF is compiled via AI assist
                    setIsCompiledView(true);
                    setCompiledContent(content);
                    setTemplateContent(content);
                    setIsRefiningMode(true);

                    // Also store context for Copilot
                    setLastCompileContext({
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
                      notes,
                      temperature,
                      webResearch,
                      detailedAnalysis,
                      formalTone,
                      modelProvider,
                      ...metadata
                    });
                  }}
                />
              </Card>
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-12 gap-4 overflow-hidden relative">
            {/* COLUMN 1: Settings OR Chat (col-span-3) */}
            <div className="col-span-3 h-full flex flex-col overflow-hidden">
              <ModelSettings
                className="flex-1"
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
                isRefining={isRefiningMode}
                chatInterface={
                  <RefineChat
                    minimal={true}
                    compileContext={lastCompileContext}
                    currentContent={pendingContent || compiledContent}
                    onPreview={(newContent) => {
                      setPendingContent(newContent);
                      setIsReviewing(true);
                    }}
                    isReviewing={isReviewing}
                    onAccept={handleAcceptRefinement}
                    onReject={handleRejectRefinement}
                    onClose={() => setIsRefiningMode(false)}
                    pendingMention={pendingMention}
                    onMentionConsumed={() => setPendingMention(null)}
                    onMentionCreated={(text, source, start, end) => handleMention(text, source, start, end)}
                  />
                }
              />
            </div>

            {/* FLEXIBLE AREA FOR COLUMN 2 AND COLUMN 3 */}
            <div className="col-span-9 h-full flex gap-4 min-w-0">
              {/* COLUMN 2: Template Editor (flexible) */}
              <div className="flex-1 h-full min-w-0 transition-all duration-500 ease-in-out">
                <TemplateEditor
                  key={`editor-${isReviewing}-${isLocked}`}
                  value={isReviewing ? (pendingContent || templateContent) : templateContent}
                  onChange={(val) => {
                    setTemplateContent(val);
                    // Sync with output ONLY if we are in "Template Compilato" mode (Copilot active)
                    if (isRefiningMode && !isReviewing) {
                      setCompiledContent(val);
                    }
                  }}
                  title={isReviewing
                    ? "Anteprima Modifiche AI"
                    : (compiledContent
                      ? `Template Compilato${masterSource ? ` (${masterSource.name})` : ''}`
                      : ((currentMode as string) === 'fillable'
                        ? `Template PDF${masterSource ? ` (${masterSource.name})` : ''}`
                        : `Template da Compilare${masterSource ? ` (${masterSource.name})` : ''}`))
                  }
                  placeholder="Inserisci qui il testo o il template..."
                  enableMentions={!isReviewing}
                  onMention={(text, start, end) => handleMention(text, 'template', start, end)}
                  headerRight={isReviewing ? (
                    <div className="flex gap-1 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 border-slate-200 bg-white/80 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all"
                        onClick={handleRejectRefinement}
                        title="Rifiuta modifiche"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 border-slate-200 bg-white/80 text-slate-500 hover:text-green-600 hover:bg-green-50 hover:border-green-200 shadow-sm transition-all"
                        onClick={handleAcceptRefinement}
                        title="Accetta modifiche"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : null}
                />
              </div>

              {/* CUSTOM BLUE TOGGLE HANDLE */}
              <div className="flex flex-col justify-center shrink-0">
                <button
                  onClick={() => setIsOutputVisible(!isOutputVisible)}
                  className="w-[6px] h-[15px] rounded-full bg-[#2563eb] shadow-lg flex flex-col items-center justify-center gap-[2px] hover:scale-125 transition-transform z-[100]"
                  title={isOutputVisible ? "Nascondi output" : "Mostra output"}
                >
                  <div className="w-[1px] h-[3px] bg-white/90 rounded-full" />
                  <div className="w-[1px] h-[3px] bg-white/90 rounded-full" />
                </button>
              </div>

              {/* COLUMN 3: Compiled Output (Animated Sidebar) */}
              <AnimatePresence mode="popLayout">
                {isOutputVisible && (
                  <motion.div
                    initial={{ x: 50, opacity: 0, width: 0, marginLeft: -16 }}
                    animate={{ x: 0, opacity: 1, width: '44.44%', marginLeft: 0 }} // 4/9 of col-span-9 = 44.44%
                    exit={{ x: 50, opacity: 0, width: 0, marginLeft: -16 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.32, 0.72, 0, 1]
                    }}
                    className="h-full flex flex-col min-w-0"
                  >
                    <CompiledOutput
                      content={compiledContent}
                      onCopy={() => {
                        navigator.clipboard.writeText(compiledContent);
                        toast({
                          title: "Copiato",
                          description: "Il contenuto è stato copiato negli appunti.",
                        });
                      }}
                      onDownload={handleDownload}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

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
          </DialogContent >
        </Dialog>
      </div>
    </div>
  );
}
