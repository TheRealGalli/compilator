import { FileUploadZone } from "./FileUploadZone";
import { FileCard } from "./FileCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSources } from "@/contexts/SourcesContext";
import { useGmail } from "@/contexts/GmailContext";
import { GmailLogo } from "./ConnectorsSection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function DocumentsSection() {
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const { toast } = useToast();
  const { sources, addSource, removeSource, maxSources } = useSources();
  const { isConnected, messages, isFetchingMessages, fetchMessages, importEmail } = useGmail();

  const handleFilesSelected = async (selectedFiles: File[]) => {
    setIsUploading(true);
    try {
      let successCount = 0;
      let failedCount = 0;

      for (const file of selectedFiles) {
        const success = await addSource(file);
        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "File aggiunti alle fonti",
          description: `${successCount} file${successCount > 1 ? ' aggiunti' : ' aggiunto'} alle fonti (max ${maxSources})`,
        });
      }

      if (failedCount > 0) {
        toast({
          title: "Limite raggiunto",
          description: `${failedCount} file non ${failedCount > 1 ? 'aggiunti' : 'aggiunto'} - limite massimo ${maxSources} fonti`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error adding files:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiunta dei file",
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
        const success = await addSource(file);
        if (success) {
          toast({
            title: "Email Importata",
            description: `"${subject}" aggiunta alle fonti.`,
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

  return (
    <div className="h-full p-6 flex flex-col gap-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Gestione Documenti</h2>
          <p className="text-muted-foreground mt-1">
            Carica fino a {maxSources} fonti per l'analisi (solo sessione corrente)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2">
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Connessioni</h3>
            <div className="h-[1px] w-full bg-border" />
          </div>
          <div className="flex">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-red-100 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => fetchMessages()}>
                  <GmailLogo className="w-4 h-4" />
                  Gmail
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                  <div>
                    <DialogTitle>Importa da Gmail</DialogTitle>
                    <DialogDescription>Seleziona un'email da aggiungere come fonte</DialogDescription>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => fetchMessages()} disabled={isFetchingMessages}>
                    <RefreshCw className={`w-4 h-4 ${isFetchingMessages ? 'animate-spin' : ''}`} />
                  </Button>
                </DialogHeader>
                <ScrollArea className="flex-1 mt-4 border rounded-md">
                  {isFetchingMessages && messages.length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Recupero email in corso...</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      Nessuna email trovata. Prova a ricaricare.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {messages.map((msg) => (
                        <div key={msg.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start justify-between gap-4 group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm truncate">{msg.subject}</span>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {msg.date ? format(new Date(msg.date), 'dd MMM HH:mm', { locale: it }) : ''}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mb-1">Da: {msg.from}</p>
                            <p className="text-xs text-muted-foreground/80 line-clamp-1 italic">{msg.snippet}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isImporting === msg.id}
                            onClick={() => handleImportEmail(msg.id, msg.subject)}
                          >
                            {isImporting === msg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3 mr-1" />
                            )}
                            Importa
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>
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
            <p className="text-sm text-muted-foreground mt-2">
              Le fonti sono temporanee e verranno rimosse al refresh della pagina.
            </p>
            <p className="text-xs text-orange-500/80 mt-4 font-medium uppercase tracking-wide">
              ⚠ I modelli possono allucinare, verificare sempre i dati.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
