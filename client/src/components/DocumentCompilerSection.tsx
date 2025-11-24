import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { ModelSettings } from "./ModelSettings";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
};

export function DocumentCompilerSection() {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof templates | "">("");
  const [templateContent, setTemplateContent] = useState("");
  const [compiledContent, setCompiledContent] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const { toast } = useToast();

  // Model settings
  const [notes, setNotes] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [webResearch, setWebResearch] = useState(false);
  const [detailedAnalysis, setDetailedAnalysis] = useState(true);
  const [formalTone, setFormalTone] = useState(true);

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value as keyof typeof templates);
    if (value && templates[value as keyof typeof templates]) {
      setTemplateContent(templates[value as keyof typeof templates].content);
      setCompiledContent("");
    }
  };

  const handleCompile = () => {
    if (!templateContent.trim()) {
      toast({
        title: "Errore",
        description: "Il template non può essere vuoto.",
        variant: "destructive",
      });
      return;
    }

    setIsCompiling(true);
    
    setTimeout(() => {
      let compiled = templateContent;
      
      // Base replacements
      const replacements: Record<string, string> = {
        '[DATA]': new Date().toLocaleDateString('it-IT'),
        '[AZIENDA]': 'Acme Corporation S.r.l.',
        '[EMAIL_AZIENDA]': 'privacy@acmecorp.it',
        '[PROGETTO]': 'Modernizzazione Infrastruttura IT',
        '[CLIENTE]': 'Beta Industries S.p.A.',
        '[RESPONSABILE]': 'Ing. Mario Rossi',
        '[OBIETTIVO_1]': 'Migliorare le performance del sistema',
        '[OBIETTIVO_2]': 'Ridurre i costi operativi del 30%',
        '[OBIETTIVO_3]': 'Aumentare la sicurezza dei dati',
        '[DESCRIZIONE_SITUAZIONE]': 'L\'infrastruttura attuale presenta criticità nelle performance',
        '[PROBLEMA_1]': 'Server obsoleti con capacità insufficiente',
        '[PROBLEMA_2]': 'Mancanza di ridondanza e backup adeguati',
        '[DESCRIZIONE_SOLUZIONE]': 'Migrazione verso cloud infrastructure con architettura scalabile',
        '[PERSONALE]': '5 sviluppatori senior, 2 project manager, 1 security specialist',
        '[BUDGET]': '€ 150.000',
        '[TEMPISTICHE]': '6 mesi (gennaio-giugno 2025)',
        '[FASE_1]': 'Analisi e pianificazione (mese 1-2)',
        '[FASE_2]': 'Implementazione e migrazione (mese 3-5)',
        '[FASE_3]': 'Testing e deployment (mese 6)',
        '[CONCLUSIONI]': 'La soluzione proposta è tecnicamente fattibile e economicamente sostenibile',
        '[FORNITORE]': 'Tech Solutions S.r.l.',
        '[SEDE_FORNITORE]': 'Via Roma 123, 20100 Milano (MI)',
        '[PIVA_FORNITORE]': 'IT12345678901',
        '[RAPPRESENTANTE_FORNITORE]': 'Dott. Giovanni Bianchi',
        '[SEDE_CLIENTE]': 'Via Garibaldi 45, 00100 Roma (RM)',
        '[PIVA_CLIENTE]': 'IT98765432109',
        '[RAPPRESENTANTE_CLIENTE]': 'Dott.ssa Laura Verdi',
        '[ATTIVITA_FORNITORE]': 'consulenza informatica e sviluppo software',
        '[SERVIZIO]': 'consulenza informatica',
        '[SERVIZIO_DETTAGLIO]': 'consulenza e sviluppo software personalizzato per la modernizzazione infrastrutturale',
        '[DURATA]': '12 mesi',
        '[DATA_INIZIO]': '01/01/2025',
        '[DATA_FINE]': '31/12/2025',
        '[IMPORTO]': '50.000',
        '[IMPORTO_LETTERE]': 'cinquantamila/00',
        '[MODALITA_PAGAMENTO]': 'bonifico bancario entro 30 giorni dalla data fattura',
        '[OBBLIGO_FORNITORE_1]': 'Fornire i servizi con professionalità e competenza',
        '[OBBLIGO_FORNITORE_2]': 'Rispettare le tempistiche concordate',
        '[OBBLIGO_CLIENTE_1]': 'Effettuare i pagamenti nei termini stabiliti',
        '[OBBLIGO_CLIENTE_2]': 'Fornire le informazioni necessarie per l\'esecuzione dei servizi',
        '[PREAVVISO_RECESSO]': '30',
        '[FORO_COMPETENTE]': 'Milano',
        '[LUOGO]': 'Milano',
      };

      // Apply model settings influence
      if (detailedAnalysis) {
        // Add more detailed information
        replacements['[DESCRIZIONE_SOLUZIONE]'] = 'Migrazione verso cloud infrastructure con architettura scalabile basata su microservizi. La soluzione prevede l\'utilizzo di container Docker orchestrati con Kubernetes per garantire alta disponibilità e scalabilità automatica. Implementazione di CI/CD pipeline per deployment automatizzato e monitoraggio avanzato tramite stack ELK.';
      }

      if (formalTone) {
        // Ensure formal language (already in templates, but could be enhanced)
        replacements['[CONCLUSIONI]'] = 'Si raccomanda vivamente di procedere con l\'implementazione della soluzione proposta nei tempi concordati, al fine di garantire il raggiungimento degli obiettivi prefissati e la piena soddisfazione delle esigenze del Cliente.';
      }

      // Apply temperature influence (simulated)
      if (temperature > 0.8) {
        // More creative/varied content
        replacements['[DESCRIZIONE_SOLUZIONE]'] = 'Proponiamo un approccio innovativo di migrazione cloud che combina le migliori pratiche DevOps con tecnologie all\'avanguardia, creando un ecosistema IT resiliente e altamente performante che supporterà la crescita aziendale per i prossimi anni.';
      } else if (temperature < 0.3) {
        // More precise/concise content
        replacements['[DESCRIZIONE_SOLUZIONE]'] = 'Migrazione cloud con tecnologie standard del settore.';
      }

      // Apply replacements
      for (const [placeholder, value] of Object.entries(replacements)) {
        compiled = compiled.replaceAll(placeholder, value);
      }

      // Add notes if provided
      if (notes.trim()) {
        compiled += `\n\n───────────────────────────────────────\nNOTE AGGIUNTIVE:\n${notes.trim()}`;
      }

      // Simulate web research influence
      if (webResearch) {
        compiled += `\n\n───────────────────────────────────────\nFONTI DI RICERCA ONLINE:\n- Normativa GDPR aggiornata al ${new Date().toLocaleDateString('it-IT')}\n- Best practices di settore da fonti autorevoli\n- Dati di mercato e benchmark industriali`;
      }
      
      setCompiledContent(compiled);
      setIsCompiling(false);
      
      const settingsInfo = [];
      if (webResearch) settingsInfo.push('Web Research');
      if (detailedAnalysis) settingsInfo.push('Analisi Dettagliata');
      if (formalTone) settingsInfo.push('Tono Formale');
      
      toast({
        title: "Documento compilato con successo",
        description: `Temperatura: ${temperature.toFixed(1)} | Strumenti attivi: ${settingsInfo.join(', ')}`,
      });
    }, 2000);
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
              <SelectValue placeholder="Seleziona modello" />
            </SelectTrigger>
            <SelectContent>
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
            onNotesChange={setNotes}
            onTemperatureChange={setTemperature}
            onWebResearchChange={setWebResearch}
            onDetailedAnalysisChange={setDetailedAnalysis}
            onFormalToneChange={setFormalTone}
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
