import { Asterisk, FileText, ChevronUp, Wand2, Menu, Type, ChevronDown, Printer, Download, X, Check, Copy, Settings2, Sparkles, Zap, BookOpen, Scale, Loader2, Trash2, Plus, Info } from "lucide-react";
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

import {
  FaChessPawn
} from "react-icons/fa6";
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
import { Input } from "@/components/ui/input";
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
import { extractTextLocally } from "@/lib/local-extractor";
import { extractPIILocal, unifyPIIFindings, isNoisyPII, DEFAULT_OLLAMA_MODEL, AVAILABLE_MODELS } from '../lib/ollama';
import { useOllama } from "@/contexts/OllamaContext";
import { performMechanicalGlobalSweep, performMechanicalReverseSweep, anonymizeWithOllamaLocal } from "@/lib/privacy";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// extractTextLocally imported above

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
    activeGuardrails, guardrailVault, setGuardrailVault,
    frozenColor, setFrozenColor,
    pinnedSourceId, setPinnedSourceId,
    takeStandardSnapshot, restoreStandardSnapshot,
    takeMasterSnapshot, restoreMasterSnapshot,
    resetSession
  } = useCompiler();

  const { status: ollamaStatus, selectedModel } = useOllama();

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
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [mentionCounts, setMentionCounts] = useState({ template: 0, copilot: 0, anteprema: 0 });

  const [isAnonymizationReportOpen, setIsAnonymizationReportOpen] = useState(false);
  const [reportVault, setReportVault] = useState<Record<string, string>>({});
  const [reportVaultCounts, setReportVaultCounts] = useState<Record<string, number>>({});
  const [isWaitingForPawnApproval, setIsWaitingForPawnApproval] = useState(false);
  const [unsupportedSources, setUnsupportedSources] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [manualInputScanId, setManualInputScanId] = useState<string | null>(null);
  const [manualInputText, setManualInputText] = useState("");
  const sourceTextCache = useRef<Array<{ name: string; text: string; originalText?: string }>>([]);

  const handleMention = (text: string, source: 'template' | 'copilot' | 'anteprema', start?: number, end?: number) => {
    setMentionCounts(prev => {
      const newCount = prev[source] + 1;
      const tagMap = { template: 'T', copilot: 'C', anteprema: 'A' };
      const mentionId = `#${tagMap[source]}${newCount}`;
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

  // 3. RESET PAWN APPROVAL if sources change (Security Check)
  useEffect(() => {
    if (activeGuardrails.includes('pawn')) {
      setIsWaitingForPawnApproval(false);
    }

    // CACHE GC: Sync sourceTextCache with current sources
    // This prevents "Skipping duplicate" logic from blocking re-uploads of the same file
    if (sourceTextCache.current) {
      const currentSourceNames = new Set(selectedSources.map(s => s.name));
      if (masterSource) currentSourceNames.add(masterSource.name);

      const beforeCount = sourceTextCache.current.length;
      sourceTextCache.current = sourceTextCache.current.filter(doc => currentSourceNames.has(doc.name));
      const afterCount = sourceTextCache.current.length;

      if (beforeCount !== afterCount) {
        console.log(`[DocumentCompiler] Cache GC: Pruned ${beforeCount - afterCount} stale docs.`);
      }
    }
  }, [selectedSources, masterSource, activeGuardrails]);

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



  const handleSubmitManualInput = async () => {
    if (!manualInputText.trim() || !manualInputScanId) return;

    setIsCompiling(true); // Show loader if needed
    try {
      console.log(`[DocumentCompiler] Processing manual input for scan ${manualInputScanId}...`);
      const findings = await extractPIILocal(manualInputText, selectedModel);

      const newVault = { ...reportVault };
      const newCounts = { ...reportVaultCounts };

      findings.forEach(f => {
        const category = f.category.toUpperCase().replace(/[^A-Z_]/g, '_');
        const value = f.value.trim();
        if (value.length < 2) return;

        // Correct Mapping: [TOKEN] -> Value (Consistent with PDF flow)
        // Check if value already exists under ANY token to avoid duplicates
        let existingToken = "";
        for (const [t, v] of Object.entries(newVault)) {
          if (v.toLowerCase().trim() === value.toLowerCase().trim()) {
            existingToken = t;
            break;
          }
        }

        if (!existingToken) {
          const count = (newCounts[category] || 0) + 1;
          newCounts[category] = count;
          const token = `[${category}_${count}]`;
          newVault[token] = value;
        }
      });

      setReportVault(newVault);
      setGuardrailVault(newVault); // Sync both
      setReportVaultCounts(newCounts);

      // Update source text cache so it's used for the final server call
      const scanSource = unsupportedSources.find(s => s.id === manualInputScanId);
      if (scanSource) {
        console.log(`[Pawn] Caching manual text for scan '${scanSource.name}' to enable Zero-Data override.`);
        sourceTextCache.current = [
          ...sourceTextCache.current,
          {
            name: scanSource.name,
            text: manualInputText,
            originalText: manualInputText
          }
        ];
      }

      // Remove from unsupported
      setUnsupportedSources(prev => prev.filter(s => s.id !== manualInputScanId));
      setIsManualInputOpen(false);
      setManualInputText("");
      setManualInputScanId(null);

      toast({
        title: "Testo inserito",
        description: "Il testo della scansione è stato aggiunto e anonimizzato correttamente.",
      });
    } catch (err) {
      console.error("[DocumentCompiler] Manual input processing failed:", err);
      toast({
        title: "Errore",
        description: "Impossibile processare il testo inserito.",
        variant: "destructive"
      });
    } finally {
      setIsCompiling(false);
    }
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

      // --- NEW: PREVENTIVE PAWN CHECK (LOCAL-FIRST) ---
      if (activeGuardrails.includes('pawn') && !isWaitingForPawnApproval) {
        console.log('[DocumentCompiler] Hybrid Pawn Check triggered...');

        if (ollamaStatus !== 'connected') {
          toast({
            title: "Ollama non connesso",
            description: "Assicurati che Ollama sia attivo e che l'estensione Gromit Bridge sia installata.",
            variant: "destructive"
          });
          setIsCompiling(false);
          return;
        }

        try {
          // --- PHASE 1: SURGICAL EXTRACTION ---
          // Identify all PII findings from all texts to build a MASTER VAULT
          console.log('[Gromit Frontend] STEP 1: Multimodal Extraction starting (v5.8.10)...');

          const vaultMap = new Map<string, string>(Object.entries(guardrailVault));
          const vaultCounts = new Map<string, number>();

          // Helper to extract findings and update vaultMap
          const extractAndVault = async (text: string, vMap: Map<string, string>, vCounts: Map<string, number>) => {
            if (!text || text.trim().length === 0) return;
            const findings = await extractPIILocal(text, selectedModel);

            // Dynamic Category Strategy: LLM is the source of truth.
            // We only keep the synonym mapping but allow ANY new category.

            for (const f of findings) {
              const rawValue = f.value.trim();
              let category = f.category.toUpperCase().replace(/[^A-Z_]/g, '_');

              // 1. Basic validation
              if (!rawValue || rawValue.length < 2) continue;

              // Category normalization (synonyms)
              if (category.includes('NAME') || category.includes('PERSON') || category.includes('NOME')) category = 'FULL_NAME';
              else if (category.includes('SUR') || category.includes('LAST') || category.includes('COGN')) category = 'SURNAME';
              else if (category.includes('ORG') || category.includes('COMPANY') || category.includes('AZIENDA') || category.includes('CORP')) category = 'ORGANIZATION';
              else if (category.includes('ADDR') || category.includes('INDIRIZZO')) category = 'FULL_ADDRESS';
              else if (category.includes('STREET') || category.includes('VIA')) category = 'STREET';
              else if (category.includes('MAIL')) category = 'EMAIL';
              else if (category.includes('TEL') || category.includes('PHONE') || category.includes('CELL')) category = 'PHONE_NUMBER';
              else if (category.includes('BANK') || category.includes('IBAN')) category = 'IBAN';
              else if (category.includes('CITY') || category.includes('CITTA')) category = 'CITY';
              else if (category.includes('STATE') || category.includes('PROV')) category = 'STATE_PROVINCE';
              else if (category.includes('COUNTRY') || category.includes('NATION') || category.includes('NAZION')) category = 'COUNTRY';
              else if (category.includes('TAX') || category.includes('SOCIAL') || category.includes('FISCAL') || category.includes('CODICE')) category = 'TAX_ID';
              else if (category.includes('VAT') || category.includes('IVA')) category = 'VAT_NUMBER';
              else if (category.includes('ZIP') || category.includes('POST') || category.includes('CAP')) category = 'ZIP_CODE';
              else if (category.includes('BIRTH')) {
                if (category.includes('PLACE') || category.includes('LUOGO')) category = 'PLACE_OF_BIRTH';
                else category = 'DATE_OF_BIRTH';
              }
              else if (category.includes('DOC') || category.includes('NUMBER')) category = 'DOCUMENT_ID';
              else if (category.includes('ROLE') || category.includes('JOB') || category.includes('RUOLO')) category = 'JOB_TITLE';
              // If not a synonym, we KEEP the LLM's category as is.

              const value = rawValue;
              let token = "";
              const normalizedValue = value.toLowerCase();

              // GLOBAL DEDUPLICATION & UPGRADE SCHEME (User-Dictated "LLM Supremacy")
              // Rule: If the VALUE exists, we must align with the LLM's categorization, 
              // effectively overwriting the "dumber" Regex/Generic extraction.

              let existingTokenToNuke = "";
              let existingValue = ""; // To store the value associated with existingTokenToNuke

              for (const [t, v] of vMap.entries()) {
                // Loose matching: case-insensitive, trim spaces
                if (v.toLowerCase().trim() === normalizedValue.trim()) {
                  token = t;
                  existingValue = v; // Store the existing value

                  // DECISION: Do we upgrade?
                  // If the current token is generic (e.g. ORGANIZATION) 
                  // and the new category is specific/custom (e.g. TITOLO)
                  // OR even if just different, if LLM is confident (implicit), we prefer LLM's context.
                  // User said: "If Regex found X, and LLM found X but calls it Y, we use Y".

                  const currentCategory = t.replace(/^\[|_\d+\]$/g, '');
                  const newCategory = category;

                  // If categories mismatch and the new one is not just a synonym but likely better
                  if (currentCategory !== newCategory) {
                    // We decide to UPGRADE to the LLM's definition.
                    existingTokenToNuke = t;
                    token = ""; // Force creation of new token below
                  }
                  break;
                }
              }

              if (existingTokenToNuke) {
                console.log(`[DocumentCompiler] LEVELLING UP '${existingValue}': ${existingTokenToNuke} -> [${category}_...]`);
                vMap.delete(existingTokenToNuke);
                // effectively removing the old key, so the code below will generate a fresh one
              }

              if (!token) {
                // VALUE IS NEW OR UPGRADED: Create a new token for this category.
                // Find how many tokens already exist for THIS category to increment the index.
                let nextIndex = 1;
                const existingIndices = Array.from(vMap.keys())
                  .filter(t => t.startsWith(`[${category}_`))
                  .map(t => {
                    const match = t.match(/_(\d+)\]$/);
                    return match ? parseInt(match[1]) : 0;
                  });

                if (existingIndices.length > 0) {
                  nextIndex = Math.max(...existingIndices) + 1;
                }

                token = `[${category}_${nextIndex}]`;
                vMap.set(token, value);
                console.log(`[DocumentCompiler] Vault registered: ${token} (Redacted Value)`);
              }

              // Count total occurrences of this value (via its unique token)
              vCounts.set(token, (vCounts.get(token) || 0) + 1);
            }
          };

          // 1. Fetch text from sources (with Cache)
          let allDocs = [];
          if (sourceTextCache.current.length > 0) {
            console.log('[DocumentCompiler] [Cache] Using cached source texts.');
            allDocs = sourceTextCache.current;
          } else {

            // NEW: Gather all unique sources (Selected + Master) to avoid double extraction
            const uniqueFiles = new Map<string, { name: string; type: string; base64: string }>();

            selectedSources.forEach(s => {
              if (s.base64) uniqueFiles.set(s.id || s.name, { name: s.name, type: s.type, base64: s.base64 });
            });

            if (masterSource && masterSource.base64) {
              uniqueFiles.set(masterSource.id || masterSource.name, { name: masterSource.name, type: masterSource.type, base64: masterSource.base64 });
            }

            const localExtractedDocs: any[] = [];

            // Helper to convert base64 to File for local extraction
            const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
              const byteCharacters = atob(base64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });
              return new File([blob], filename, { type: mimeType });
            };

            // Sequential Extraction (Safe for 8GB RAM)
            const currentUnsupported: Array<{ id: string; name: string; type: string }> = [];

            for (const source of Array.from(uniqueFiles.entries())) {
              const [id, sData] = source;

              try {
                const file = base64ToFile(sData.base64, sData.name, sData.type);
                const text = await extractTextLocally(file);

                if (text === "[[GROMIT_SCAN_DETECTED]]") {
                  currentUnsupported.push({ id, name: sData.name, type: 'Scansione' });
                  // We don't add scans to localExtractedDocs as they are not supportable by Pawn for anonymization
                } else {
                  localExtractedDocs.push({ name: sData.name, text, originalText: text });
                }
              } catch (e) {
                console.error(`[DocumentCompiler] Local extraction failed for ${sData.name}:`, e);
              }
            }

            setUnsupportedSources(currentUnsupported);

            const rawDocs = [
              ...(templateContent.trim() ? [{ name: 'Template [Form]', text: templateContent, originalText: templateContent }] : []),
              ...(notes.trim() ? [{ name: 'Note [Aggiuntive]', text: notes, originalText: notes }] : []),
              ...localExtractedDocs
            ];

            allDocs = rawDocs;
            sourceTextCache.current = allDocs;
          }

          // console.log(`[Gromit Frontend] STEP 2: Avvio Ultra-Drive Analysis su ${allDocs.length} sorgenti...`);
          const startTime = Date.now();
          const DOC_BATCH_SIZE = 3; // Process 3 docs in parallel (Optimized for performance)
          const flatResults = [];

          for (let i = 0; i < allDocs.length; i += DOC_BATCH_SIZE) {
            const batch = allDocs.slice(i, i + DOC_BATCH_SIZE);
            const batchNum = (i / DOC_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(allDocs.length / DOC_BATCH_SIZE);

            console.log(`[DocumentCompiler] [Batch ${batchNum}/${totalBatches}] In elaborazione...`);

            const batchResults = await Promise.all(batch.map(async (doc) => {
              const charCount = doc.text.length;
              console.log(`[Gromit Frontend] STEP 2.1: Analizzando '${doc.name}' (${charCount} char)...`);
              console.log(`[Gromit Frontend] >> RAW EXTRACTED TEXT FOR '${doc.name}' <<\n${doc.text}\n>> END RAW TEXT <<`);

              const findings = await extractPIILocal(doc.text, selectedModel);

              console.log(`[DocumentCompiler] <- '${doc.name}' finito: ${findings.length} elementi trovati.`);
              return { name: doc.name, findings };
            }));

            flatResults.push(...batchResults);
          }

          const totalTime = (Date.now() - startTime) / 1000;
          // console.log(`[DocumentCompiler] Estrazione completata in ${totalTime.toFixed(1)}s (${(totalTime / allDocs.length).toFixed(1)}s per doc).`);

          // 3. Robust Vault Registration (Pawn Style)
          const ALLOWED = [
            'NOME', 'COGNOME', 'DATA_NASCITA', 'LUOGO_NASCITA', 'CODICE_FISCALE',
            'PARTITA_IVA', 'EIN_USA', 'INDIRIZZO', 'TELEFONO', 'EMAIL', 'URL',
            'IBAN', 'DOCUMENTO', 'SESSO', 'NAZIONALITA', 'RUOLO', 'DATI_FINANZIARI',
            'DATI_SENSIBILI', 'DATI_COMPORTAMENTALI', 'INDIRIZZO_IP', 'ALTRO'
          ];

          const uniqueFoundValues = new Set<string>();

          for (const res of flatResults) {
            console.log(`[DocumentCompiler] Processing PII findings from: ${res.name} (${res.findings.length} findings)`);

            for (const f of res.findings) {
              const rawValue = f.value.trim();
              if (!rawValue || rawValue.length < 2) continue;

              // Grounding Check
              if (rawValue.includes('[') || rawValue.includes(']') || rawValue.includes('<')) continue;
              if (rawValue.toLowerCase() === 'null' || rawValue.toLowerCase() === 'undefined') continue;
              if (isNoisyPII(rawValue)) continue;

              // 1. Determine Category
              let category = f.label ? f.label : f.category.toUpperCase().replace(/[^A-Z_]/g, '_');

              // 2. Category normalization (English-First)
              if (!f.label && !ALLOWED.includes(category)) {
                if (category.includes('NAME') || category.includes('PERSON') || category.includes('NOME')) category = 'NOME';
                else if (category.includes('SUR') || category.includes('LAST') || category.includes('COGN')) category = 'COGNOME';
                else if (category.includes('ORG') || category.includes('COMPANY') || category.includes('AZIENDA') || category.includes('CORP')) continue; // Reject organization
                else if (category.includes('ADDR') || category.includes('INDIRIZZO') || category.includes('STREET') || category.includes('VIA') || category.includes('CITY') || category.includes('CITTA') || category.includes('PROV') || category.includes('ZIP') || category.includes('CAP')) category = 'INDIRIZZO';
                else if (category.includes('MAIL')) category = 'EMAIL';
                else if (category.includes('TEL') || category.includes('PHONE') || category.includes('CELL')) category = 'TELEFONO';
                else if (category.includes('BANK') || category.includes('IBAN') || category.includes('FINAN')) category = 'DATI_FINANZIARI';
                else if (category.includes('TAX') || category.includes('SOCIAL') || category.includes('FISCAL') || category.includes('CODICE')) category = 'CODICE_FISCALE';
                else if (category.includes('VAT') || category.includes('IVA')) category = 'PARTITA_IVA';
                else if (category.includes('BIRTH')) {
                  if (category.includes('PLACE') || category.includes('LUOGO')) category = 'LUOGO_NASCITA';
                  else category = 'DATA_NASCITA';
                }
                else if (category.includes('DOC') || category.includes('NUMBER')) category = 'DOCUMENTO';
                else if (category.includes('ROLE') || category.includes('JOB') || category.includes('RUOLO')) category = 'RUOLO';
                else category = 'ALTRO';
              }

              // Register in set for unification later
              if (category !== 'ALTRO' && !category.includes('GENERIC_PII')) {
                uniqueFoundValues.add(rawValue);
              }

              let token = "";
              const normalizedValue = rawValue.toLowerCase();

              // Deduplication (Case-Insensitive)
              for (const [existingToken, existingValue] of vaultMap.entries()) {
                if (existingValue.toLowerCase() === normalizedValue) {
                  token = existingToken;
                  break;
                }
              }

              if (!token) {
                let nextIndex = 1;
                const existingIndices = Array.from(vaultMap.keys())
                  .filter(t => t.startsWith(`[${category}_`))
                  .map(t => {
                    const match = t.match(/_(\d+)\]$/);
                    return match ? parseInt(match[1]) : 0;
                  });

                if (existingIndices.length > 0) {
                  nextIndex = Math.max(...existingIndices) + 1;
                }

                token = `[${category}_${nextIndex}]`;
                vaultMap.set(token, rawValue);
                console.log(`[DocumentCompiler] Registered: ${token} -> ${rawValue}`);
              }
              vaultCounts.set(token, (vaultCounts.get(token) || 0) + 1);
            }
          }

          // 4. Intelligent Unification (Post-Processing Refinement)
          // This groups variations of the same PII (e.g. addresses, names)
          let finalValueToTokenMap: Record<string, string> = {};

          try {
            console.log(`[DocumentCompiler] STEP 3: Unifying ${uniqueFoundValues.size} variations...`);
            const unificationMap = await unifyPIIFindings(Array.from(uniqueFoundValues), selectedModel);
            console.log(`[DocumentCompiler] STEP 3 COMPLETE: LLM returned ${Object.keys(unificationMap).length} mappings.`);

            // Group existing tokens by their canonical values
            const canonicalToToken = new Map<string, string>();
            const processedValues = new Set<string>();

            // Re-build vault and mapping based on canonical results
            for (const [token, originalValue] of Array.from(vaultMap.entries())) {
              const canonical = unificationMap[originalValue] || originalValue;
              const normalizedCanonical = canonical.toLowerCase();

              if (!canonicalToToken.has(normalizedCanonical)) {
                // Keep the first token assigned to this canonical group
                canonicalToToken.set(normalizedCanonical, token);
                // Update vault with the most canonical name if it exists
                vaultMap.set(token, canonical);
              }

              const targetToken = canonicalToToken.get(normalizedCanonical)!;
              finalValueToTokenMap[originalValue] = targetToken;
              finalValueToTokenMap[canonical] = targetToken;

              // If merged, we might want to update counts (optional for now)
            }
          } catch (uErr) {
            console.error("[DocumentCompiler] Unification Refinement failed, using identity mapping:", uErr);
            // Fallback: simple token mapping
            for (const [token, value] of Array.from(vaultMap.entries())) {
              finalValueToTokenMap[value] = token;
            }
          }

          const masterVault = Object.fromEntries(vaultMap);
          const masterCounts = Object.fromEntries(vaultCounts);

          // --- PHASE 3: MECHANICAL GLOBAL SWEEP (LOCAL) ---
          // --- PHASE 3: MECHANICAL GLOBAL SWEEP (LOCAL) ---
          // console.log('[Gromit Frontend] STEP 3: Mechanical Global Sweep (Local-Privacy)...');

          // Apply anonymity to ALL documents locally
          const anonymizedDocs = allDocs.map(doc => {
            const anonymizedText = performMechanicalGlobalSweep(doc.text, finalValueToTokenMap);
            return {
              ...doc,
              text: anonymizedText,
              originalText: doc.text // Keep for preview if needed
            };
          });

          // Update Source Cache with anonymized versions
          sourceTextCache.current = anonymizedDocs;

          console.log('[DocumentCompiler] Local Anonymization Complete.');

          setReportVault(masterVault);
          setReportVaultCounts(masterCounts);
          setGuardrailVault(masterVault); // FIX: Ensure context is updated with local PII
          setIsWaitingForPawnApproval(true);
          setIsAnonymizationReportOpen(true);
          setIsCompiling(false);
          return; // STOP HERE until user approves
        } catch (error) {
          console.error('[DocumentCompiler] Privacy Check Error:', error);
          toast({
            title: "Errore Privacy Check",
            description: "Si è verificato un errore durante l'analisi dei dati sensibili.",
            variant: "destructive"
          });
          setIsCompiling(false);
          return;
        }
      }

      // --- COMPILATION PHASE (Post-Approval or No-Guardrail) ---
      console.log('[DocumentCompiler] Starting Compilation Phase...');

      // Define final payload variables
      let finalTemplate = templateContent;
      let finalNotes = notes;
      let finalSources: any[] = [];
      let finalMasterSource: any = null;

      // PREPARE PAYLOAD FOR SERVER (ZERO-DATA COMPLIANCE)
      if (activeGuardrails.includes('pawn')) {
        console.log('[DocumentCompiler] Preparing Zero-Data Payload (Local Anonymization)...');

        // 1. Mechanical sweep for Template & Notes (Local)
        finalTemplate = performMechanicalGlobalSweep(templateContent, guardrailVault);
        finalNotes = performMechanicalGlobalSweep(notes, guardrailVault);

        // 2. Prepare Sources (Text Only - Anonymized)
        const getAnonymizedText = async (source: any) => {
          // Try to find in cache first
          const cached = sourceTextCache.current.find(d => d.name === source.name);

          // CRITICAL FIX: If we have ORIGINAL text, re-anonymize it with the UPDATED vault (post-user-edits)
          if (cached && cached.originalText) {
            // console.log(`[Gromit Frontend] Re-anonymizing cached source '${source.name}' with updated vault...`);
            const reAnonymized = performMechanicalGlobalSweep(cached.originalText, guardrailVault);
            console.log(`[Gromit Frontend] >> FINAL ANONYMIZED PAYLOAD FOR '${source.name}' <<\n${reAnonymized}\n>> END PAYLOAD <<`);
            return reAnonymized;
          }

          // Fallback: Use previously anonymized text if original is missing (shouldn't happen for text docs)
          if (cached && cached.text) {
            console.warn(`[Pawn] Warning: Using cached anonymized text for '${source.name}' (No re-sweep possible).`);
            return cached.text;
          }

          // If not in cache, extract now (fallback) and Anonymize on the fly
          let text = "";
          if (source.base64 && !source.type.startsWith('image/')) {
            const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
              const byteCharacters = atob(base64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mimeType });
              return new File([blob], filename, { type: mimeType });
            };
            try {
              const file = base64ToFile(source.base64, source.name, source.type);
              text = await extractTextLocally(file);
            } catch (e) {
              console.error("Local extract error fallback:", e);
            }
          }

          // Apply Sweep
          const freshAnonymized = performMechanicalGlobalSweep(text, guardrailVault);
          console.log(`[Gromit Frontend] >> FINAL ANONYMIZED PAYLOAD FOR '${source.name}' (Fresh Extract) <<\n${freshAnonymized}\n>> END PAYLOAD <<`);
          return freshAnonymized;
        };

        // Helper to encode UTF-8 text to Base64
        const toBase64 = (str: string) => {
          try {
            return btoa(unescape(encodeURIComponent(str)));
          } catch (e) {
            console.error("Base64 encode error", e);
            return "";
          }
        };


        // Construct Sources Payload
        for (const s of selectedSources) {
          const cached = sourceTextCache.current.find(d => d.name === s.name);

          // ZERO-DATA ENFORCEMENT for Visual Sources (Images/Scans)
          // If we have extracted text (either automatic OCR or Manual Input), we send ONLY that text.
          // We DO NOT send the original image/pdf base64.
          if (cached && (cached.originalText || cached.text)) {
            const anonymizedText = await getAnonymizedText(s);
            console.log(`[Pawn] Converting '${s.name}' (${s.type}) to Text-Only Payload for Privacy.`);

            // PREPEND OCR/VISION TAG ensures server knows this is reconstructed text
            const taggedText = `[FONTE ESTRATTA DA SCANSIONE/VISION]\n${anonymizedText}`;

            finalSources.push({
              name: s.name,
              type: 'text/plain', // Force type to text/plain
              base64: toBase64(taggedText),
              anonymizedText: taggedText,
              originalType: s.type
            });
          } else {
            // It's an unsupported source (Image, Audio, or unhandled Scan) WITHOUT text.
            // This will trigger the warning in the UI, and if user proceeds, it sends original.
            console.warn(`[Pawn] Source '${s.name}' has no extracted text. Sending original base64.`);
            finalSources.push({
              name: s.name,
              type: s.type,
              base64: s.base64,
            });
          }
        }

        // Construct Master Payload
        if (masterSource) {
          const cached = sourceTextCache.current.find(d => d.name === masterSource.name);
          if (cached && (cached.originalText || cached.text)) {
            const anonymizedMaster = await getAnonymizedText(masterSource);
            console.log(`[Pawn] Converting Master '${masterSource.name}' to Text-Only Payload.`);
            finalMasterSource = {
              name: masterSource.name,
              type: 'text/plain',
              base64: toBase64(anonymizedMaster),
              anonymizedText: anonymizedMaster,
              originalType: masterSource.type
            };
          } else {
            // Unsupported Master
            finalMasterSource = {
              name: masterSource.name,
              type: masterSource.type,
              base64: masterSource.base64,
            };
          }
        }

      } else {
        // Standard Flow (Send Base64) - Legacy or Non-Pawn
        // console.log('[DocumentCompiler] Preparing Standard Payload (Base64)...');
        finalSources = selectedSources.map((source) => ({
          name: source.name,
          type: source.type,
          base64: source.base64,
        }));
        if (masterSource) {
          finalMasterSource = {
            name: masterSource.name,
            type: masterSource.type,
            base64: masterSource.base64,
          };
        }
      }

      console.log(`[DocumentCompiler] Sending ${finalSources.length} sources to server...`);

      const response = await apiRequest('POST', '/api/compile', {
        template: finalTemplate,
        modelProvider,
        notes: finalNotes,
        temperature: temperature,
        sources: finalSources,
        masterSource: finalMasterSource,
        webResearch,
        detailedAnalysis,
        formalTone,
        studioFontSize,
        currentMode,
        // ZERO-DATA: We DO NOT send the vault to the server. 
        // The server processes tokens (e.g. [NOME_1]) and returns them.
        // We handle de-anonymization locally upon receipt.
        pawnVault: undefined
      });

      const data = await response.json();

      if (data.compiledContent) {
        // Sanitize escaped brackets
        let sanitizedContent = data.compiledContent
          .replace(/\\+\s*\[/g, '[')
          .replace(/\\+\s*\]/g, ']')
          .replace(/\\-/g, '-')
          .replace(/\\\*/g, '*');

        // Force checkboxes to be list items for Tiptap
        sanitizedContent = sanitizedContent.replace(/^(\s*)\[([ xX])\]/gm, '$1- [$2]');

        // Context Construction for Refinement
        const context = {
          sources: finalSources.map(s => ({
            ...s,
          })),
          masterSource: finalMasterSource,
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

        // Restoration of original values for the user (Reverse Sweep)
        let finalContent = sanitizedContent;
        if (activeGuardrails.includes('pawn')) {
          finalContent = performMechanicalReverseSweep(sanitizedContent, guardrailVault);
          console.log('[DocumentCompiler] De-anonymization complete.');
        }

        setLastCompileContext(context);
        setCompiledContent(finalContent);
        setTemplateContent(finalContent);
        setIsCompiledView(true);
        setIsRefiningMode(true); // Auto-trigger Copilot Mode

        // FREEZE UI if master pin is active
        if (masterSource) {
          setIsLocked(true);
          let color = 'text-muted-foreground';
          if (!masterSource.isBypass) {
            if (masterSource.isXfa) color = 'text-red-500 fill-red-500/20';
            else if (masterSource.isAlreadyFilled) color = 'text-orange-500 fill-orange-500/20';
            else if (masterSource.isFillable) color = 'text-green-500 fill-green-500/20';
          }
          setFrozenColor(color);
          takeMasterSnapshot(masterSource.id);
        } else {
          takeStandardSnapshot();
        }

        if (onCompile) onCompile(sanitizedContent);

        if (data.guardrailVault) {
          setGuardrailVault(data.guardrailVault);
        }

        setIsWaitingForPawnApproval(false);

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
      const finalContent = performMechanicalReverseSweep(pendingContent, guardrailVault);
      setCompiledContent(finalContent);
      setTemplateContent(finalContent); // Update template content as well
      if (onCompile) onCompile(finalContent);
      toast({ title: "Modifica Accettata", description: "Il documento è stato aggiornato e de-anonimizzato." });
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
                        name="template-upload"
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

      <div className="flex-1 min-h-0 flex flex-col overflow-visible">
        {isPdfMode ? (
          /* PDF STUDIO UNIFIED VIEW */
          <div className="flex-1 min-h-0 grid grid-cols-12 gap-4">
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
          <div className="flex-1 min-h-0 flex gap-4 overflow-visible">
            {/* COLUMN 1: Settings OR Chat (25% approx col-span-3) */}
            <div className="w-[25%] min-w-[280px] h-full flex flex-col overflow-hidden">
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

            {/* FLEXIBLE CONTAINER FOR EDITOR & OUTPUT (75% approx col-span-9) */}
            <div className="flex-1 h-full min-w-0 flex relative overflow-visible">
              {/* COLUMN 2: Template Editor (flexible) */}
              <div className="flex-1 h-full min-w-0 flex flex-col overflow-visible relative">
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
                  placeholder=""
                  enableMentions={isReviewing || !!compiledContent}
                  onMention={(text, start, end) => handleMention(text, isReviewing ? 'anteprema' : 'template', start, end)}
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
                >
                  <div className="space-y-4 max-w-sm mt-0">
                    <p className="font-medium text-foreground">Seleziona un template preimpostato o carica il tuo, aggiungi documenti di contesto (visure, contratti, foto), e l'AI compilerà automaticamente tutti i placeholder con le informazioni estratte dai tuoi file.</p>
                    <p className="text-xs">Perfetto per: contratti, relazioni tecniche, privacy policy, documenti legali.</p>
                  </div>
                </TemplateEditor>

                {/* CUSTOM TOGGLE HANDLE (Dynamically centered in gutter or gap) */}
                <div
                  className={`absolute right-0 top-1/2 -translate-y-1/2 z-[40] transition-all duration-500 ease-[0.32,0.72,0,1] ${isOutputVisible ? 'translate-x-[12px]' : 'translate-x-[15px]'}`}
                >
                  <button
                    onClick={() => setIsOutputVisible(!isOutputVisible)}
                    className="w-[8px] h-[33px] rounded-full bg-[#2563eb] shadow-lg flex flex-col items-center justify-center gap-[4px] hover:scale-110 active:scale-95 transition-all outline-none p-0"
                    title={isOutputVisible ? "Nascondi output" : "Mostra output"}
                  >
                    <div className="w-[1.2px] h-[7px] bg-white rounded-full flex-shrink-0" />
                    <div className="w-[1.2px] h-[7px] bg-white rounded-full flex-shrink-0" />
                  </button>
                </div>
              </div>

              {/* COLUMN 3: Compiled Output (Animated Sidebar) */}
              <AnimatePresence mode="popLayout" initial={false}>
                {isOutputVisible && (
                  <motion.div
                    key="output-sidebar"
                    initial={{ width: 0, opacity: 0, x: 20 }}
                    animate={{ width: '44.44%', opacity: 1, x: 0 }}
                    exit={{ width: 0, opacity: 0, x: 20 }}
                    transition={{
                      duration: 0.5,
                      ease: [0.32, 0.72, 0, 1]
                    }}
                    className="h-full flex flex-col min-w-0 pl-4 overflow-hidden"
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
              <Label htmlFor="generate-template-prompt" className="sr-only">Descrizione del documento</Label>
              <Textarea
                id="generate-template-prompt"
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

      {/* Anonymization Report Dialog */}
      <Dialog open={isAnonymizationReportOpen} onOpenChange={setIsAnonymizationReportOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex justify-between items-center w-full">
              <div className="flex items-center gap-2 text-xl">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <FaChessPawn size={20} />
                </div>
                Analisi Privacy Local (Zero-Data)
              </div>
            </DialogTitle>
            <div className="flex justify-between items-center mt-2">
              <DialogDescription className="text-slate-600">
                Abbiamo individuato i seguenti dati sensibili. Puoi <strong>modificare</strong>, <strong>aggiungere</strong> o <strong>rimuovere</strong> i campi prima della compilazione.
              </DialogDescription>
              {unsupportedSources.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-sm h-fit">
                  <Info className="w-3 h-3" />
                  Fonti Non Supportate
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 px-6 py-2">
            <div className="max-h-[400px] overflow-y-auto mt-2 border rounded-xl shadow-inner bg-slate-50/50">
              <div className="p-0">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-100/80 backdrop-blur sticky top-0 z-10 border-b">
                    <tr>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 w-[35%]">Token Privacy</th>
                      <th className="text-left py-3 px-4 font-bold text-slate-700 w-[55%]">Valore Originale</th>
                      <th className="text-center py-3 px-2 font-bold text-slate-700 w-[10%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {Object.entries(reportVault).sort((a, b) => a[0].localeCompare(b[0])).map(([token, value]) => (
                      <tr key={token} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="py-2 px-2 align-top">
                          <Input
                            id={`token-${token}`}
                            aria-label={`Token Privacy: ${token}`}
                            value={token}
                            onChange={(e) => {
                              const newToken = e.target.value.toUpperCase();
                              const newVault = { ...reportVault };
                              const val = newVault[token];
                              delete newVault[token];
                              newVault[newToken] = val;
                              setReportVault(newVault);
                              // Also update guardrailVault immediately to keep sync
                              setGuardrailVault(newVault);
                            }}
                            className="font-mono text-xs font-bold text-blue-700 h-8 bg-blue-50/50 border-blue-200 focus:border-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2 align-top">
                          <Input
                            id={`value-${token}`}
                            aria-label={`Valore Originale per ${token}`}
                            value={value}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              const newVault = { ...reportVault, [token]: newVal };
                              setReportVault(newVault);
                              setGuardrailVault(newVault);
                            }}
                            className="text-sm text-slate-900 font-semibold h-8 border-slate-200 focus:border-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2 align-middle text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                            onClick={() => {
                              const newVault = { ...reportVault };
                              delete newVault[token];
                              setReportVault(newVault);
                              setGuardrailVault(newVault);
                            }}
                            title="Rimuovi dato"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {Object.keys(reportVault).length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400 italic bg-white">
                          Nessun dato sensibile rilevato. Aggiungine uno manualmente.
                        </td>
                      </tr>
                    )}
                    {/* ADD ROW BUTTON ROW */}
                    <tr className="bg-slate-50/50 border-t border-slate-200">
                      <td colSpan={3} className="py-2 px-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-slate-300 hover:border-blue-300"
                          onClick={() => {
                            const nextIdx = Object.keys(reportVault).length + 1;
                            const newToken = `[NUOVO_CAMPO_${nextIdx}]`;
                            const newVault = { ...reportVault, [newToken]: "" };
                            setReportVault(newVault);
                            setGuardrailVault(newVault);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Aggiungi Campo Manuale
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground px-1 mt-2 leading-relaxed">
              Modifica i token o i valori se necessario. I dati originali non vengono inviati all&apos;IA.
            </p>

            {unsupportedSources.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 text-[11px] font-bold uppercase tracking-tight">
                  <Info className="w-3.5 h-3.5" />
                  Dettaglio Fonti Non Supportate dal Sistema Pawn
                </div>
                <div className="max-h-[160px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 gap-1">
                    {unsupportedSources.map((s, idx) => (
                      <div key={idx} className="flex flex-col gap-1 text-[10px] text-amber-700 bg-white/50 px-2 py-1.5 rounded border border-amber-100/50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate max-w-[200px]">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-100 px-1.5 py-0.5 rounded text-[9px] font-bold">{s.type}</span>
                            {s.type === 'Scansione' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[9px] font-bold border-amber-300 text-amber-800 hover:bg-amber-100"
                                onClick={() => {
                                  setManualInputScanId(s.id);
                                  setIsManualInputOpen(true);
                                }}
                              >
                                Inserisci manualmente
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[9px] text-amber-600 leading-tight italic mt-1">
                  Queste fonti verranno inviate integralmente al server AI poiché il sistema Pawn locale non supporta l&apos;anonimizzazione di immagini, audio o documenti senza testo (scansioni).
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 p-6 pt-2 border-t bg-slate-50/50">
            <Button
              variant="outline"
              onClick={() => {
                setIsAnonymizationReportOpen(false);
                setIsWaitingForPawnApproval(false);
              }}
            >
              Annulla
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                setIsAnonymizationReportOpen(false);
                // Confirm: guardrailVault is already properly updated by the inputs
                handleCompile();
              }}
            >
              {isWaitingForPawnApproval ? "Conferma e Compila con AI" : "Chiudi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MANUAL SCAN INPUT DIALOG */}
      <Dialog open={isManualInputOpen} onOpenChange={(open) => {
        if (!open) {
          setIsManualInputOpen(false);
          setManualInputText("");
          setManualInputScanId(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-white border-none shadow-2xl">
          <DialogHeader className="p-6 border-b bg-slate-50/50 flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-amber-500 rounded text-white">
                  <FileText size={18} />
                </div>
                Inserimento Manuale Testo Scansione
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Incolla il testo della scansione qui sotto. Verrà anonimizzato localmente prima dell'invio.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-slate-200"
              onClick={() => setIsManualInputOpen(false)}
            >
              <X size={20} />
            </Button>
          </DialogHeader>

          <div className="flex-1 p-6 flex flex-col min-h-0 bg-white">
            <Textarea
              autoFocus
              value={manualInputText}
              onChange={(e) => setManualInputText(e.target.value)}
              placeholder="Incolla qui il contenuto testuale del documento..."
              className="flex-1 text-base leading-relaxed resize-none border-2 border-slate-100 focus-visible:border-blue-500 focus-visible:ring-blue-500/20 rounded-xl p-6 transition-all font-sans"
            />
          </div>

          <div className="p-6 border-t bg-slate-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic">
              <Sparkles size={12} className="text-blue-500" />
              Il testo verrà processato dal sistema Pawn (Ollama) per proteggere la tua privacy.
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-lg px-6"
                onClick={() => setIsManualInputOpen(false)}
              >
                Annulla
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-8 font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                disabled={!manualInputText.trim() || isCompiling}
                onClick={handleSubmitManualInput}
              >
                {isCompiling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Elaborazione...
                  </>
                ) : (
                  "Conferma ed Estrai Dati"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
