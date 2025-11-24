import { Sparkles, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateEditor } from "./TemplateEditor";
import { CompiledOutput } from "./CompiledOutput";
import { SourceSelector } from "./SourceSelector";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Source {
  id: string;
  name: string;
  selected: boolean;
}

const templates = {
  privacy: {
    name: "Privacy Policy",
    content: `INFORMATIVA SULLA PRIVACY

1. INTRODUZIONE
La presente informativa sulla privacy descrive come raccogliamo, utilizziamo e proteggiamo i dati personali degli utenti.

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
Implementiamo misure di sicurezza appropriate per proteggere i dati personali.

5. DIRITTI DELL'UTENTE
Gli utenti hanno il diritto di accedere, correggere o cancellare i propri dati personali.

Data: [DATA]
Azienda: [AZIENDA]`
  },
  relazione: {
    name: "Relazione Tecnica",
    content: `RELAZIONE TECNICA

Progetto: [PROGETTO]
Data: [DATA]
Responsabile: [RESPONSABILE]

1. INTRODUZIONE
[Descrizione generale del progetto e obiettivi]

2. ANALISI DELLA SITUAZIONE
[Analisi del contesto attuale e problematiche]

3. SOLUZIONE PROPOSTA
[Descrizione dettagliata della soluzione]

4. RISORSE NECESSARIE
- Personale: [PERSONALE]
- Budget: [BUDGET]
- Tempistiche: [TEMPISTICHE]

5. CONCLUSIONI
[Riepilogo e raccomandazioni]

Firma: ___________________`
  },
  contratto: {
    name: "Contratto di Servizio",
    content: `CONTRATTO DI SERVIZIO

Tra:
FORNITORE: [FORNITORE]
Sede: [SEDE_FORNITORE]

E:
CLIENTE: [CLIENTE]
Sede: [SEDE_CLIENTE]

PREMESSO CHE:
- Il Fornitore offre servizi di [SERVIZIO]
- Il Cliente desidera usufruire di tali servizi

SI CONVIENE E SI STIPULA QUANTO SEGUE:

Art. 1 - OGGETTO DEL CONTRATTO
Il presente contratto ha per oggetto la fornitura di [SERVIZIO_DETTAGLIO]

Art. 2 - DURATA
Il contratto ha durata di [DURATA] a partire dal [DATA_INIZIO]

Art. 3 - CORRISPETTIVO
Il Cliente si impegna a corrispondere l'importo di [IMPORTO] Euro

Art. 4 - MODALITÀ DI PAGAMENTO
Il pagamento avverrà secondo le seguenti modalità: [MODALITA_PAGAMENTO]

Luogo e Data: ___________________
Firma Fornitore: ___________________
Firma Cliente: ___________________`
  }
};

export function DocumentCompilerSection() {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof templates | "">("");
  const [templateContent, setTemplateContent] = useState("");
  const [compiledContent, setCompiledContent] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const { toast } = useToast();

  const [sources, setSources] = useState<Source[]>([
    { id: "1", name: "documento-base.pdf", selected: true },
    { id: "2", name: "dati-azienda.txt", selected: true },
    { id: "3", name: "informazioni-legali.docx", selected: false },
    { id: "4", name: "termini-servizio.pdf", selected: true },
    { id: "5", name: "clausole-standard.txt", selected: false },
    { id: "6", name: "dati-contatto.pdf", selected: true },
    { id: "7", name: "riferimenti-normativi.docx", selected: false },
    { id: "8", name: "template-base.txt", selected: false },
    { id: "9", name: "glossario-termini.pdf", selected: false },
  ]);

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value as keyof typeof templates);
    if (value && templates[value as keyof typeof templates]) {
      setTemplateContent(templates[value as keyof typeof templates].content);
    }
  };

  const handleToggleSource = (id: string) => {
    setSources(sources.map(s => 
      s.id === id ? { ...s, selected: !s.selected } : s
    ));
  };

  const handleCompile = () => {
    setIsCompiling(true);
    
    setTimeout(() => {
      const selectedSources = sources.filter(s => s.selected);
      
      let compiled = templateContent;
      compiled = compiled.replace('[DATA]', new Date().toLocaleDateString('it-IT'));
      compiled = compiled.replace('[AZIENDA]', 'Acme Corporation S.r.l.');
      compiled = compiled.replace('[PROGETTO]', 'Modernizzazione Infrastruttura IT');
      compiled = compiled.replace('[RESPONSABILE]', 'Ing. Mario Rossi');
      compiled = compiled.replace('[PERSONALE]', '5 sviluppatori, 2 project manager');
      compiled = compiled.replace('[BUDGET]', '€150,000');
      compiled = compiled.replace('[TEMPISTICHE]', '6 mesi');
      compiled = compiled.replace('[FORNITORE]', 'Tech Solutions S.r.l.');
      compiled = compiled.replace('[SEDE_FORNITORE]', 'Via Roma 123, Milano');
      compiled = compiled.replace('[CLIENTE]', 'Acme Corporation S.r.l.');
      compiled = compiled.replace('[SEDE_CLIENTE]', 'Via Garibaldi 45, Roma');
      compiled = compiled.replace('[SERVIZIO]', 'consulenza informatica');
      compiled = compiled.replace('[SERVIZIO_DETTAGLIO]', 'consulenza e sviluppo software personalizzato');
      compiled = compiled.replace('[DURATA]', '12 mesi');
      compiled = compiled.replace('[DATA_INIZIO]', '01/01/2025');
      compiled = compiled.replace('[IMPORTO]', '50.000');
      compiled = compiled.replace('[MODALITA_PAGAMENTO]', 'bonifico bancario entro 30 giorni');
      
      setCompiledContent(compiled);
      setIsCompiling(false);
      
      toast({
        title: "Documento compilato",
        description: `Utilizzate ${selectedSources.length} fonti per generare il documento.`,
      });
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledContent);
    toast({
      title: "Copiato",
      description: "Il documento è stato copiato negli appunti.",
    });
  };

  const handleDownload = () => {
    const blob = new Blob([compiledContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documento-compilato-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download avviato",
      description: "Il documento è stato scaricato.",
    });
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Compilatore Documenti</h2>
        <div className="flex items-center gap-4">
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-[200px]" data-testid="select-template">
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
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isCompiling ? "Compilazione..." : "Compila Documento"}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        <div className="lg:col-span-3 min-h-0">
          <SourceSelector sources={sources} onToggle={handleToggleSource} />
        </div>
        <div className="lg:col-span-4 min-h-0">
          <TemplateEditor 
            value={templateContent}
            onChange={setTemplateContent}
          />
        </div>
        <div className="lg:col-span-5 min-h-0">
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
