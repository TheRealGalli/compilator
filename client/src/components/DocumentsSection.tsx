import { FileUploadZone } from "./FileUploadZone";
import { FileCard } from "./FileCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw, Inbox, Tag, Users, Info, Search, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSources } from "@/contexts/SourcesContext";
import { useGmail } from "@/contexts/GmailContext";
import { GmailLogo } from "./ConnectorsSection";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function DocumentsSection() {
  const [view, setView] = useState<'main' | 'gmail'>('main');
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const { toast } = useToast();
  const { sources, addSource, removeSource, maxSources } = useSources();
  const { isConnected, messages, isFetchingMessages, fetchMessages, importEmail, nextPageToken, currentCategory, setCategory, searchQuery, setSearchQuery } = useGmail();
  const [localSearch, setLocalSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const handleFilesSelected = async (selectedFiles: File[]) => {
    setIsUploading(true);
    try {
      let successCount = 0;

      for (const file of selectedFiles) {
        const result = await addSource(file);

        if (result === 'success') {
          successCount++;
        } else if (result === 'file_too_large') {
          toast({
            title: "File troppo grande",
            description: `"${file.name}": caricamento fonte file troppo grande (max 25MB)`,
            variant: "destructive",
          });
        } else if (result === 'limit_reached') {
          toast({
            title: "Limite raggiunto",
            description: `Limite massimo di ${maxSources} fonti raggiunto.`,
            variant: "destructive",
          });
        } else if (result === 'duplicate') {
          toast({
            title: "File duplicato",
            description: `"${file.name}" è già presente nelle fonti.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Errore",
            description: `Errore durante l'aggiunta di "${file.name}"`,
            variant: "destructive",
          });
        }
      }

      if (successCount > 0) {
        toast({
          title: "Fonti aggiornate",
          description: `${successCount} file aggiunti con successo.`,
        });
      }
    } catch (error: any) {
      console.error('Error adding files:', error);
      toast({
        title: "Errore critico",
        description: "Si è verificato un errore durante l'upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImportEmail = async (msgId: string, subject: string) => {
    setIsImporting(msgId);
    try {
      const content = await importEmail(msgId, subject);
      if (content) {
        const fileName = `Gmail_${subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        const file = new File([content], fileName, { type: 'text/plain' });
        const result = await addSource(file);
        if (result === 'success') {
          toast({
            title: "Email Importata",
            description: `"${subject}" aggiunta alle fonti.`,
          });
        } else if (result === 'file_too_large') {
          toast({
            title: "Email Too Large",
            description: "Il contenuto dell'email supera il limite di dimensione.",
            variant: "destructive",
          });
        }
      }
    } finally {
      setIsImporting(null);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      removeSource(id);
      toast({
        title: "Fonte rimossa",
        description: "La fonte è stata rimossa dalla sessione",
      });
    } catch (error: any) {
      console.error('Error removing file:', error);
      toast({
        title: "Errore",
        description: "Errore durante la rimozione",
        variant: "destructive",
      });
    }
  };

  const formatSize = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (view === 'gmail') {
    return (
      <div className="h-full p-6 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setView('main')} className="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              Indietro
            </Button>
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <GmailLogo className="w-6 h-6" />
                Importa da Gmail
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Seleziona un'email da aggiungere come fonte</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant={showSearch ? "secondary" : "ghost"}
              onClick={() => {
                if (showSearch) {
                  setSearchQuery("");
                  setLocalSearch("");
                }
                setShowSearch(!showSearch);
              }}
              className={`w-9 h-9 border border-transparent transition-all ${showSearch ? 'border-primary/20 shadow-sm' : ''}`}
            >
              <Search className={`w-4 h-4 ${showSearch ? 'text-primary' : ''}`} />
            </Button>
            <Button size="icon" variant="ghost" className="w-9 h-9" onClick={() => fetchMessages()} disabled={isFetchingMessages}>
              <RefreshCw className={`w-4 h-4 ${isFetchingMessages ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="flex px-6 border-b border-border/40 gap-8 overflow-x-auto">
          {[
            { id: 'primary', label: 'Principali', icon: Inbox, color: 'text-blue-600', border: 'border-blue-600' },
            { id: 'promotions', label: 'Promozioni', icon: Tag, color: 'text-green-600', border: 'border-green-600' },
            { id: 'social', label: 'Social', icon: Users, color: 'text-purple-600', border: 'border-purple-600' },
            { id: 'updates', label: 'Aggiornamenti', icon: Info, color: 'text-orange-600', border: 'border-orange-600' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id as any)}
              disabled={isFetchingMessages}
              className={`flex items-center gap-2.5 py-3.5 text-xs font-semibold transition-all border-b-2 -mb-[1px] outline-none whitespace-nowrap
                ${currentCategory === tab.id
                  ? `${tab.color} ${tab.border} opacity-100`
                  : 'text-muted-foreground/60 border-transparent hover:text-muted-foreground hover:border-muted-foreground/20 opacity-80'
                } ${isFetchingMessages ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${currentCategory === tab.id ? tab.color : 'text-muted-foreground/40'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`px-6 py-2 bg-muted/20 border-b border-border/40 transition-all duration-300 overflow-hidden ${showSearch ? 'h-auto opacity-100' : 'h-0 opacity-0'}`}>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Cerca tra le tue email con la potenza dell'AI..."
              className="w-full bg-background/50 border border-border/60 rounded-lg pl-10 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchQuery(localSearch);
                }
              }}
            />
            {localSearch && (
              <button
                onClick={() => {
                  setLocalSearch("");
                  setSearchQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground/50" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 border rounded-xl bg-card shadow-sm overflow-hidden">
          {isFetchingMessages && messages.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Recupero email in corso...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nessuna email trovata in questa sessione. Clicca il tasto aggiorna per riprovare.
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((msg) => (
                <div key={msg.id} className="p-5 hover:bg-muted/30 transition-colors flex items-start justify-between gap-6 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 wrap">
                      <span className="font-semibold text-sm truncate max-w-[400px]">{msg.subject}</span>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                        {msg.date ? format(new Date(msg.date), 'dd MMM yyyy HH:mm', { locale: it }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-1.5 opacity-80 font-medium">Da: {msg.from}</p>
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed opacity-90">{msg.snippet}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={isImporting === msg.id}
                    onClick={() => handleImportEmail(msg.id, msg.subject)}
                  >
                    {isImporting === msg.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-3 h-3 mr-2" />
                    )}
                    Importa
                  </Button>
                </div>
              ))}
              {nextPageToken && (
                <div className="p-6 flex justify-center bg-muted/5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMessages(nextPageToken)}
                    disabled={isFetchingMessages}
                    className="gap-2 shadow-sm"
                  >
                    {isFetchingMessages ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Carica altre email
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full p-6 flex flex-col gap-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Gestione Documenti</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Carica fino a {maxSources} fonti per l'analisi (solo sessione corrente)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 2v20M2 12h20M4.929 4.929l14.142 14.142M4.929 19.071L19.071 4.929" />
            </svg>
            Genera Sommario
          </Button>
        </div>
      </div>

      <FileUploadZone
        onFilesSelected={handleFilesSelected}
        disabled={isUploading}
      />

      {isConnected && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60 whitespace-nowrap">Connessioni</h3>
            <div className="h-[1px] w-full bg-border/60" />
          </div>
          <div className="flex">
            <Button
              variant="outline"
              className="gap-2 border-red-50 hover:bg-red-50 hover:text-red-600 transition-all hover:border-red-200 shadow-sm"
              onClick={() => {
                fetchMessages();
                setView('gmail');
              }}
            >
              <GmailLogo className="w-4 h-4" />
              Gmail
            </Button>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex-1 overflow-auto">
          <h3 className="text-lg font-semibold mb-4">
            Fonti Caricate ({sources.length}/{maxSources})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((source) => (
              <FileCard
                key={source.id}
                name={source.name}
                size={formatSize(source.size)}
                onRemove={() => handleRemove(source.id)}
              />
            ))}
          </div>
        </div>
      )}

      {sources.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div className="max-w-md">
            <p className="text-muted-foreground">
              Nessuna fonte caricata. Trascina file qui sopra o clicca per selezionarli.
            </p>
            <p className="text-sm text-muted-foreground mt-2 opacity-70">
              Le fonti sono temporanee e verranno rimosse al refresh della pagina.
            </p>
            <div className="mt-8 p-3 px-4 rounded-full bg-orange-500/5 text-orange-500/80 text-[10px] font-bold uppercase tracking-widest inline-block border border-orange-500/10">
              ⚠ I modelli possono allucinare, verificare sempre i dati.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
