import { FileUploadZone } from "./FileUploadZone";
import { FileCard } from "./FileCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw, Inbox, Tag, Users, Info, Search, X, FileText, Paperclip, Trash2, Brain, Send } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSources } from "@/contexts/SourcesContext";
import { useGmail } from "@/contexts/GmailContext";
import { GmailLogo, DriveLogo } from "./ConnectorsSection";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useGoogleDrive, DriveCategory } from "@/contexts/GoogleDriveContext";


export function DocumentsSection() {
  const [view, setView] = useState<'main' | 'gmail' | 'drive'>('main');
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const { toast } = useToast();
  const { sources, addSource, removeSource, maxSources } = useSources();
  const memoryFile = sources.find(s => s.isMemory);
  const { isConnected, messages, isFetchingMessages, fetchMessages, importEmail, nextPageToken, currentCategory, setCategory, searchQuery, setSearchQuery } = useGmail();
  const {
    files, isFetchingFiles, fetchFiles, importFile,
    currentCategory: driveCategory, setCategory: setDriveCategory,
    searchQuery: driveSearch, setSearchQuery: setDriveSearch,
    nextPageToken: driveNextToken, currentFolderId, folderPath,
    navigateToFolder, goToParentFolder, resetNavigation
  } = useGoogleDrive();
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
            description: `"${file.name}": caricamento fonte file troppo grande (max 30MB)`,
            variant: "destructive",
          });
        } else if (result === 'limit_reached') {
          toast({
            title: "Limite raggiunto",
            description: `Limite massimo di ${maxSources} fonti raggiunto.`,
            variant: "destructive",
          });
        } else if (result === 'invalid_format') {
          toast({
            title: "Formato non supportato",
            description: `"${file.name}" non è in un formato supportato (Standard: PDF, DOCX, Immagini, RTF, MD, CSV, JSON).`,
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

  const handleImportEmail = async (msgId: string, subject: string, includeAttachments: boolean = false) => {
    setIsImporting(msgId);
    try {
      const data = await importEmail(msgId, subject, includeAttachments);
      if (data) {
        const emailContentSize = new Blob([data.body]).size;
        const attachmentsSize = data.attachments.reduce((acc, a) => acc + (a.size || 0), 0);
        const totalSize = emailContentSize + attachmentsSize;

        if (totalSize > 30 * 1024 * 1024) {
          toast({
            title: "Errore caricamento mail",
            description: "caricamento mail tra le fonti file troppo grande supera 30 MB",
            variant: "destructive",
          });
          return;
        }

        // Add email body
        const emailDate = messages.find(m => m.id === msgId)?.date;
        const dateSuffix = emailDate ? `_${format(new Date(emailDate), 'dd/MM/yy_HH:mm')}` : '';
        const fileName = `Gmail_${subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${dateSuffix}.txt`;
        const file = new File([data.body], fileName, { type: 'text/plain' });
        await addSource(file);

        // Add attachments
        for (const attach of data.attachments) {
          // Convert base64 to File object
          const byteCharacters = atob(attach.base64.replace(/-/g, '+').replace(/_/g, '/'));
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: attach.mimeType });

          // Rename attachment to link it to the email
          const safeSubject = subject.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
          const attachName = `Allegato_da_${safeSubject}${dateSuffix}_${attach.name}`;
          const attachFile = new File([blob], attachName, { type: attach.mimeType });

          await addSource(attachFile);
        }

        toast({
          title: includeAttachments ? "Email e Allegati Importati" : "Email Importata",
          description: `"${subject}" ${includeAttachments ? 'e i suoi allegati sono stati aggiunti' : 'aggiunta'} alle fonti.`,
        });
      }
    } catch (error) {
      console.error("Error importing email:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'importazione.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(null);
    }
  };

  const handleImportDriveFile = async (fileId: string, name: string) => {
    setIsImporting(fileId);
    try {
      const data = await importFile(fileId, name);
      if (data) {
        // Create a File object from the base64 data
        const byteCharacters = atob(data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType });
        const file = new File([blob], data.name, { type: data.mimeType });
        const result = await addSource(file, { driveId: fileId });
        if (result === 'success') {
          toast({
            title: "File Importato",
            description: `"${data.name}" aggiunto alle fonti.`,
          });
        }
      }
    } catch (error) {
      console.error("Error importing Drive file:", error);
      toast({
        title: "Errore",
        description: "Impossibile importare il file selezionato.",
        variant: "destructive",
      });
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
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
            { id: 'sent', label: 'Inviati', icon: Send, color: 'text-gray-600', border: 'border-gray-600' },
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
                  <div className="flex gap-1 items-center">
                    {(msg.attachmentCount ?? 0) > 0 && (
                      <div className="h-8 px-2 flex items-center justify-center bg-muted/50 text-muted-foreground rounded text-xs font-medium border border-border/40">
                        {msg.attachmentCount}
                      </div>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleImportEmail(msg.id, msg.subject, false)}
                            disabled={isImporting === msg.id}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            {isImporting === msg.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Importa solo testo</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleImportEmail(msg.id, msg.subject, true)}
                            disabled={isImporting === msg.id}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            {isImporting === msg.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Paperclip className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Importa testo e allegati</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
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

  if (view === 'drive') {
    return (
      <div className="h-full p-6 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetNavigation();
                setView('main');
              }}
              className="gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              Indietro
            </Button>
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <DriveLogo className="w-8 h-8" />
                Google Drive
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Esplora i tuoi documenti e fogli di calcolo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="w-9 h-9" onClick={() => fetchFiles(undefined, true)} disabled={isFetchingFiles}>
              <RefreshCw className={`w-4 h-4 ${isFetchingFiles ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        {folderPath.length > 0 && (
          <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground bg-muted/30 py-2 rounded-lg border border-border/40 max-w-full overflow-hidden">
            <button onClick={resetNavigation} className="hover:text-primary transition-colors flex items-center gap-1 shrink-0">
              Drive
            </button>
            {folderPath.map((folder, idx) => (
              <React.Fragment key={folder.id}>
                <span className="shrink-0">/</span>
                <button
                  className={`hover:text-primary transition-colors truncate max-w-[200px] ${idx === folderPath.length - 1 ? 'text-foreground font-medium' : ''}`}
                  disabled={idx === folderPath.length - 1}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="flex px-6 border-b border-border/40 gap-8 overflow-x-auto">
          {[
            { id: 'all', label: 'Tutti i file', icon: FileText, color: 'text-slate-600', border: 'border-slate-600' },
            { id: 'pdfs', label: 'PDF', icon: Info, color: 'text-red-600', border: 'border-red-600' },
            { id: 'docs', label: 'Documenti', icon: FileText, color: 'text-blue-600', border: 'border-blue-600' },
            { id: 'sheets', label: 'Fogli di calcolo', icon: Tag, color: 'text-green-600', border: 'border-green-600' },
            { id: 'folders', label: 'Cartelle', icon: Inbox, color: 'text-amber-500', border: 'border-amber-500' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDriveCategory(tab.id as any)}
              disabled={isFetchingFiles}
              className={`flex items-center gap-2.5 py-3.5 text-xs font-semibold transition-all border-b-2 -mb-[1px] outline-none whitespace-nowrap
                ${driveCategory === tab.id
                  ? `${tab.color} ${tab.border} opacity-100`
                  : 'text-muted-foreground/60 border-transparent hover:text-muted-foreground hover:border-muted-foreground/20 opacity-80'
                } ${isFetchingFiles ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <tab.icon className={`w-3.5 h-3.5 ${driveCategory === tab.id ? tab.color : 'text-muted-foreground/40'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 border rounded-xl bg-card shadow-sm overflow-hidden">
          {isFetchingFiles && files.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Caricamento file...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              Nessun file trovato in questa categoria.
            </div>
          ) : (
            <div className="divide-y">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-6 group ${file.mimeType === 'application/vnd.google-apps.folder' ? 'cursor-pointer' : ''}`}
                  onClick={() => {
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                      navigateToFolder(file.id, file.name);
                    }
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-muted rounded-lg border border-border/40">
                      {file.mimeType === 'application/vnd.google-apps.folder' ? (
                        <Inbox className="w-5 h-5 text-amber-500" />
                      ) : file.iconLink ? (
                        <img src={file.iconLink} alt="" className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {file.mimeType.split('.').pop()?.replace('vnd.google-apps.', '') || 'File'}
                        {file.modifiedTime && ` • Modificato ${format(new Date(file.modifiedTime), 'dd MMM yyyy', { locale: it })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {file.mimeType !== 'application/vnd.google-apps.folder' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 text-xs font-medium bg-background hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImportDriveFile(file.id, file.name);
                        }}
                        disabled={isImporting === file.id}
                      >
                        {isImporting === file.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Importa
                      </Button>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 group-hover:text-amber-500 transition-colors"><path d="m9 18 6-6-6-6" /></svg>
                    )}
                  </div>
                </div>
              ))}
              {driveNextToken && (
                <div className="p-6 flex justify-center bg-muted/5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFiles(driveNextToken)}
                    disabled={isFetchingFiles}
                    className="gap-2"
                  >
                    {isFetchingFiles ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Carica altri file
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={`gap-2 shrink-0 ${memoryFile ? 'border-blue-500/50 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10' : ''}`}>
                <Brain className="w-4 h-4" />
                Gromit Memory
                {memoryFile && <span className="flex h-2 w-2 rounded-full bg-green-500" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <Brain className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold">Gromit Memory</h4>
                </div>

                {memoryFile ? (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500/20 p-2 rounded shrink-0">
                        <DriveLogo className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{memoryFile.name}</p>
                        <p className="text-xs text-muted-foreground">Memoria di sistema attiva</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8"
                      onClick={() => handleRemove(memoryFile.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Disattiva Memoria
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Nessuna memoria di sistema attiva.
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Collega Google Drive per caricare automaticamente "Gromit-Memory.pdf".
                    </p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
          <div className="flex gap-3">
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
            <Button
              variant="outline"
              className="gap-2 border-blue-50 hover:bg-blue-50 hover:text-blue-600 transition-all hover:border-blue-200 shadow-sm"
              onClick={() => {
                fetchFiles();
                setView('drive');
              }}
            >
              <DriveLogo className="w-4 h-4" />
              Google Drive
            </Button>
          </div>
        </div>
      )}

      {sources.filter(s => !s.isMemory).length > 0 && (
        <div className="flex-1 overflow-auto">
          <h3 className="text-lg font-semibold mb-4">
            Fonti Caricate ({sources.filter(s => !s.isMemory).length}/{maxSources})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.filter(s => !s.isMemory).map((source) => (
              <FileCard
                key={source.id}
                name={source.name}
                size={formatSize(source.size)}
                isMemory={source.isMemory}
                onRemove={() => handleRemove(source.id)}
              />
            ))}
          </div>
        </div>
      )}

      {sources.filter(s => !s.isMemory).length === 0 && (
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
