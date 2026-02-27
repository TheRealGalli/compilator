import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Cpu, LogIn, Link2, Mail, ExternalLink, Rocket } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useGmail } from "@/contexts/GmailContext";
import { useOllama } from "@/contexts/OllamaContext";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setCustomBackendUrl, getCustomBackendUrl, getApiUrl } from "@/lib/api-config";
import { Settings2, Cloud, ShieldCheck, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const GmailLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <path fill="#EA4335" d="M20 18h-2V9.25L12 13 6 9.25V18H4V6c0-.55.45-1 1-1h1l6 3.75L18 5h1c.55 0 1 .45 1 1v12z" />
        <path fill="#4285F4" d="M22 6v12c0 1.1-.9 2-2 2h-2V9.25L12 13 6 9.25V20H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h3l5 3.12L17 4h3c1.1 0 2 .9 2 2z" opacity=".2" />
        <path fill="#FBBC05" d="M12 13L6 9.25V6c0-.55.45-1 1-1h1l4 2.5L12 13z" opacity=".2" />
        <path fill="#34A853" d="M12 13l6-3.75V6c0-.55.45-1-1-1h-1l-4 2.5L12 13z" opacity=".2" />
    </svg>
);

export const DriveLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <path fill="#0066da" d="M12.4 12.3l4.5 7.8 4.4-7.8h-8.9zm-1.8 1.1l-4.5 7.8h8.9l-4.4-7.8zm-1.1-1.8L5 3.8 0.6 11.6h8.9zM13.6 1L9.1 8.8h8.9L13.6 1z" />
        <path fill="#00ac47" d="M13.6 1L9.1 8.8h8.9L13.6 1z" opacity=".8" />
        <path fill="#ffba00" d="M5 3.8L0.6 11.6h8.9L5 3.8z" opacity=".8" />
    </svg>
);

export const VertexAILogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <path fill="#4285F4" d="M12 2L4 7v10l8 5 8-5V7l-8-5z" opacity=".2" />
        <path fill="#4285F4" d="M12 22l-8-5V7l8 5 8-5v10l-8 5z" />
        <path fill="#34A853" d="M12 12l8-5-8-5-8 5 8 5z" opacity=".5" />
    </svg>
);

export const CalendarLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <rect width="18" height="18" x="3" y="4" fill="#4285F4" rx="2" ry="2" />
        <path fill="#FFF" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V9h14v10zM7 11h5v5H7z" />
    </svg>
);

export const FormsLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <path fill="#7248B9" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z" />
    </svg>
);

export const ContactsLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <path fill="#4285F4" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
    </svg>
);

export function ConnectorsSection() {
    const { isConnected, isLoading, isFetchingMessages, connect, logout, fetchMessages } = useGmail();
    const {
        status: ollamaStatus,
        checkStatus: checkOllama,
        accountStatus,
        accountEmail,
        connectAccount,
        disconnectAccount
    } = useOllama();
    const { toast } = useToast();

    const [isOllamaModalOpen, setIsOllamaModalOpen] = useState(false);
    const [ollamaEmail, setOllamaEmail] = useState("");
    const [ollamaToken, setOllamaToken] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);

    // Private Cloud / Custom Backend State
    const [isPrivateBackendModalOpen, setIsPrivateBackendModalOpen] = useState(false);
    const [tempBackendUrl, setTempBackendUrl] = useState(getCustomBackendUrl() || "");
    const currentBackendUrl = getCustomBackendUrl();

    // Wizard State
    const [wizardStep, setWizardStep] = useState<"setup" | "keys" | "deploy">("setup");
    const [setupProjectId, setSetupProjectId] = useState("");
    const [setupGeminiKey, setSetupGeminiKey] = useState("");
    const [setupClientId, setSetupClientId] = useState("");
    const [setupClientSecret, setSetupClientSecret] = useState("");
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployStatus, setDeployStatus] = useState("");

    useEffect(() => {
        checkOllama();
    }, []);

    const handleConnectOllamaAccount = async () => {
        if (!ollamaEmail.includes('@')) {
            toast({
                title: "Email non valida",
                description: "Inserisci un indirizzo email valido per procedere.",
                variant: "destructive"
            });
            return;
        }

        if (ollamaToken.length < 10) {
            toast({
                title: "Token non valido",
                description: "Il Token API sembra troppo corto. Verificalo nel tuo profilo ollama.com.",
                variant: "destructive"
            });
            return;
        }

        setIsConnecting(true);
        try {
            await connectAccount(ollamaEmail, ollamaToken);
            toast({
                title: "Account Collegato",
                description: `L'account Ollama (${ollamaEmail}) è stato connesso con successo.`,
            });
            setIsOllamaModalOpen(false);
        } catch (error) {
            toast({
                title: "Errore di connessione",
                description: "Impossibile collegare l'account in questo momento. Riprova più tardi.",
                variant: "destructive"
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSaveBackendUrl = () => {
        if (tempBackendUrl && !tempBackendUrl.startsWith('http')) {
            toast({
                title: "URL non valido",
                description: "L'URL deve iniziare con http:// o https://",
                variant: "destructive"
            });
            return;
        }

        setCustomBackendUrl(tempBackendUrl || null);
        toast({
            title: "Configurazione Aggiornata",
            description: tempBackendUrl ? "Gromit ora punta al tuo backend privato." : "Gromit è tornato a usare il backend standard.",
        });
        setIsPrivateBackendModalOpen(false);
    };

    const handleDeployToCloud = async () => {
        setIsDeploying(true);
        setDeployStatus("Abilitazione API Google Cloud...");

        try {
            const response = await fetch(getApiUrl("/api/deploy/private-cloud"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: setupProjectId,
                    geminiApiKey: setupGeminiKey,
                    googleClientId: setupClientId,
                    googleClientSecret: setupClientSecret
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Errore durante il deploy.");
            }

            const data = await response.json();
            setDeployStatus("Build e Deploy avviati! In attesa di Cloud Run...");

            toast({
                title: "Deploy Avviato ✨",
                description: "Il tuo backend privato si starà accendendo tra pochi istanti."
            });

            // If we have a URL, we can suggest it
            if (data.serviceUrl) {
                setTempBackendUrl(data.serviceUrl);
            }

            setWizardStep("setup");
            setIsPrivateBackendModalOpen(false);
        } catch (error: any) {
            console.error("Deploy failure:", error);
            toast({
                title: "Errore Deploy",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsDeploying(false);
            setDeployStatus("");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Connettori</h1>
                <p className="text-muted-foreground">Collega i tuoi account esterni per analizzare i tuoi dati direttamente.</p>
            </div>

            <div className="space-y-12">
                {/* Google Category */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Google</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                        {/* Gmail Card */}
                        <Card className="border-2 hover:border-primary/20 transition-all flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <GmailLogo className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Gmail</CardTitle>
                                        <CardDescription className="truncate">Posta elettronica</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    {isConnected ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                            Connesso
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">Non collegato</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Analizza le tue email recenti per estrarre informazioni e contesto utile.
                                </p>
                                <div className="mt-auto">
                                    {isConnected ? (
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="flex-1" onClick={logout}>
                                                Disconnetti
                                            </Button>
                                            <Button size="icon" variant="outline" onClick={() => fetchMessages()} disabled={isFetchingMessages}>
                                                <RefreshCw className={`w-4 h-4 ${isFetchingMessages ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={connect}>
                                            Connetti Gmail
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Google Drive Card */}
                        <Card className={`border-2 transition-all flex flex-col ${isConnected ? 'hover:border-primary/20' : 'opacity-60 border-dashed'}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <DriveLogo className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Google Drive</CardTitle>
                                        <CardDescription className="truncate">File & Documenti</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    {isConnected ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                            Connesso
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">Non collegato</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Sfoglia i tuoi documenti, fogli di calcolo e PDF salvati su Drive per l'analisi intelligente.
                                </p>
                                <div className="mt-auto">
                                    {isConnected ? (
                                        <Button variant="outline" className="w-full" disabled>
                                            Già Connesso (via Google)
                                        </Button>
                                    ) : (
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={connect}>
                                            Connetti Drive
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Google Calendar Card */}
                        <Card className="opacity-60 border-dashed flex flex-col hover:opacity-100 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <CalendarLogo className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Calendar</CardTitle>
                                        <CardDescription className="truncate">Scadenze & Eventi</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    <Badge variant="outline">In arrivo</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Sincronizza le scadenze estratte dai contratti e gestisci i promemoria direttamente.
                                </p>
                                <div className="mt-auto">
                                    <Button variant="outline" className="w-full" disabled>
                                        Prossimamente
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Google Forms Card */}
                        <Card className="opacity-60 border-dashed flex flex-col hover:opacity-100 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <FormsLogo className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Forms</CardTitle>
                                        <CardDescription className="truncate">Data Capture</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    <Badge variant="outline">In arrivo</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Genera moduli per raccogliere informazioni mancanti dai tuoi clienti in modo strutturato.
                                </p>
                                <div className="mt-auto">
                                    <Button variant="outline" className="w-full" disabled>
                                        Prossimamente
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Google Contacts Card */}
                        <Card className="opacity-60 border-dashed flex flex-col hover:opacity-100 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <ContactsLogo className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Contacts</CardTitle>
                                        <CardDescription className="truncate">Rubrica Smart</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    <Badge variant="outline">In arrivo</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Riconosci e aggiorna i referenti estratti dai documenti nella tua rubrica aziendale.
                                </p>
                                <div className="mt-auto">
                                    <Button variant="outline" className="w-full" disabled>
                                        Prossimamente
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Pseudonimizzazione Category */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Pseudonimizzazione</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                        {/* Ollama Card */}
                        <Card className={`border-2 transition-all flex flex-col ${ollamaStatus === 'connected' ? 'border-blue-200 bg-blue-50/20' : 'opacity-60 border-dashed hover:opacity-100'}`}>
                            {/* ... Content remains same for Ollama ... */}
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-900 border border-slate-700 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <Cpu className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Ollama</CardTitle>
                                        <CardDescription className="truncate">Local AI Engine</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    {ollamaStatus === 'connected' ? (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                                            Rilevato
                                        </Badge>
                                    ) : ollamaStatus === 'loading' ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    ) : (
                                        <Badge variant="outline">Non rilevato</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Motore locale per la protezione della privacy e sanitizzazione "Zero-Data".
                                    {accountStatus === 'connected' && (
                                        <span className="block mt-2 font-medium text-blue-600 flex items-center gap-1.5">
                                            <Mail className="w-3.5 h-3.5" />
                                            Account: {accountEmail}
                                        </span>
                                    )}
                                </p>
                                <div className="mt-auto space-y-3">
                                    <Button
                                        variant={accountStatus === 'connected' ? "outline" : "secondary"}
                                        className={`w-full ${accountStatus === 'connected' ? '' : (ollamaStatus === 'connected' ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed')}`}
                                        disabled={ollamaStatus !== 'connected' && accountStatus !== 'connected'}
                                        onClick={() => accountStatus === 'connected' ? disconnectAccount() : setIsOllamaModalOpen(true)}
                                    >
                                        {accountStatus === 'connected' ? (
                                            <>
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Scollega account Ollama
                                            </>
                                        ) : (
                                            <>
                                                {ollamaStatus === 'connected' ? <Link2 className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                                                {ollamaStatus === 'connected' ? 'Connetti account Ollama' : 'Effettua Login a Ollama'}
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={checkOllama}
                                        disabled={ollamaStatus === 'loading'}
                                    >
                                        {ollamaStatus === 'connected' ? 'Riconnetti' : 'Rileva Localmente'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Vertex AI Card */}
                        <Card className="opacity-60 border-dashed flex flex-col hover:opacity-100 transition-all">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <VertexAILogo className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Vertex AI</CardTitle>
                                        <CardDescription className="truncate">Cloud AI Engine</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    <Badge variant="outline">In arrivo</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Potenza del cloud con privacy garantita. Prossimamente disponibile per l'integrazione enterprise.
                                </p>
                                <div className="mt-auto">
                                    <Button variant="outline" className="w-full" disabled>
                                        Coming Soon
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Backend Category */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Backend</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                        {/* Private Cloud Run Card */}
                        <Card className={`border-2 transition-all flex flex-col ${currentBackendUrl ? 'border-green-200 bg-green-50/20' : 'hover:border-primary/20'}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <Cloud className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">Private Cloud</CardTitle>
                                        <CardDescription className="truncate">Your Instance</CardDescription>
                                    </div>
                                </div>
                                <div className="shrink-0 ml-2">
                                    {currentBackendUrl ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 flex gap-1">
                                            <ShieldCheck className="w-3 h-3" />
                                            Attivo
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline">Default Cloud</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    Gestisci il tuo backend privato su Cloud Run per il controllo totale dei tuoi dati.
                                    {currentBackendUrl && <span className="block mt-2 font-mono text-[10px] break-all opacity-70">{currentBackendUrl}</span>}
                                </p>
                                <div className="mt-auto space-y-3">
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" onClick={() => setIsPrivateBackendModalOpen(true)}>
                                            <Settings2 className="w-4 h-4 mr-2" />
                                            Configura
                                        </Button>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="secondary" className="px-3" onClick={handleDeployToCloud}>
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Aggiorna Backend</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Prossimamente Category */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Prossimamente</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                        <Card className="opacity-60 border-dashed flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center w-10 h-10 shrink-0">
                                        <div className="w-6 h-6 bg-slate-100 rounded-sm flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-slate-400">OD</span>
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">OneDrive</CardTitle>
                                        <CardDescription className="truncate">Prossimamente</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-4 flex-1 flex flex-col">
                                <p className="text-sm text-muted-foreground mb-6">
                                    In arrivo: l'integrazione con Microsoft OneDrive per i tuoi file business.
                                </p>
                                <div className="mt-auto">
                                    <Button variant="outline" className="w-full" disabled>
                                        Coming Soon
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <Dialog open={isOllamaModalOpen} onOpenChange={setIsOllamaModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Connetti Account Ollama</DialogTitle>
                        <DialogDescription>
                            Inserisci l'email associata al tuo account Ollama Cloud per abilitare i modelli remoti (GTP, SS20).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right text-xs">
                                Email
                            </Label>
                            <Input
                                id="email"
                                placeholder="mario.rossi@esempio.it"
                                className="col-span-3 text-sm"
                                value={ollamaEmail}
                                onChange={(e) => setOllamaEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="token" className="text-right text-xs">
                                API Token
                            </Label>
                            <Input
                                id="token"
                                type="password"
                                placeholder="Inserisci il tuo Token Cloud..."
                                className="col-span-3 text-sm"
                                value={ollamaToken}
                                onChange={(e) => setOllamaToken(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-[25%]">
                            Trovi il tuo token personale nel profilo su <a href="https://ollama.com" target="_blank" className="text-blue-500 underline">ollama.com</a>.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOllamaModalOpen(false)}>
                            Annulla
                        </Button>
                        <Button type="submit" className="bg-slate-900 text-white" onClick={handleConnectOllamaAccount} disabled={isConnecting}>
                            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                            Connetti
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPrivateBackendModalOpen} onOpenChange={(open) => {
                setIsPrivateBackendModalOpen(open);
                if (!open) setWizardStep("setup");
            }}>
                <DialogContent className="sm:max-w-[700px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Cloud className="w-5 h-5 text-blue-600" />
                            Backend Privato: Setup Magico
                        </DialogTitle>
                        <DialogDescription className="text-[11px]">
                            {wizardStep === "setup" ? "Passo 1/3: Identità e Motore AI (Setup Magico)" :
                                wizardStep === "keys" ? "Passo 2/3: Integrazioni Google (Opzionale)" :
                                    "Passo 3/3: Riepilogo e Lancio"}
                        </DialogDescription>
                    </DialogHeader>

                    {wizardStep === "setup" && (
                        <div className="py-4 space-y-6 text-sm">
                            <div className="space-y-4">
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-xs text-center">
                                    <strong>Magical Setup:</strong> Useremo un'architettura "serverless" (Cloud Run). Nessun costo fisso, paghi solo quando usi Gromit.
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">1. Gemini API Key (da AI Studio)</Label>
                                    <Input
                                        type="password"
                                        placeholder="Incolla la tua API Key..."
                                        value={setupGeminiKey}
                                        onChange={(e) => setSetupGeminiKey(e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Ottienila in 3 secondi su <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 underline font-bold">Google AI Studio</a>.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold">2. ID Progetto Google Cloud</Label>
                                    <Input
                                        placeholder="es. gen-lang-client-..."
                                        value={setupProjectId}
                                        onChange={(e) => setSetupProjectId(e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Usa l'ID (es. <code>gen-lang-client-xxx</code>) che trovi nella colonna "Project" su <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 underline font-bold">AI Studio</a>, proprio sotto il nome del progetto.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {wizardStep === "keys" && (
                        <div className="py-4 space-y-6">
                            <div className="space-y-4">
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-700 text-[10px]">
                                    <strong>Attenzione:</strong> Gmail e Drive richiedono la creazione di un Client OAuth 2.0. Questo va fatto **obbligatoriamente** nella <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline font-bold">Console Google Cloud</a> (non su AI Studio).
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">OAuth Client ID</Label>
                                        <Input
                                            placeholder="Client ID..."
                                            value={setupClientId}
                                            onChange={(e) => setSetupClientId(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">OAuth Client Secret</Label>
                                        <Input
                                            type="password"
                                            placeholder="Client Secret..."
                                            value={setupClientSecret}
                                            onChange={(e) => setSetupClientSecret(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {wizardStep === "deploy" && (
                        <div className="py-4 space-y-6">
                            <div className="text-center space-y-3">
                                <div className="flex justify-center">
                                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100 mb-2">
                                        <ShieldCheck className="w-8 h-8 text-green-600" />
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold">Tutto pronto per il decollo!</h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                    Cliccando il tasto sotto, verrai reindirizzato a Google Cloud Shell.
                                    Il sistema caricherà automaticamente la tua configurazione "Zero-Data".
                                </p>
                            </div>

                            <div className="p-4 bg-slate-900 rounded-xl text-white text-[10px] font-mono space-y-3 overflow-x-auto shadow-xl border border-slate-700">
                                <p className="text-slate-400 border-b border-slate-800 pb-1 mb-2 font-bold uppercase tracking-wider text-[9px]">Checklist Configurazione</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                    <p><span className="text-slate-500">Project:</span> {setupProjectId || 'Auto'}</p>
                                    <p><span className="text-slate-500">Storage:</span> Local (Ephemeral)</p>
                                    <p><span className="text-slate-500">AI Engine:</span> Gemini API (Studio)</p>
                                    <p><span className="text-slate-500">Integrations:</span> {setupClientId ? 'Attive' : 'Disabilitate'}</p>
                                </div>
                                {isDeploying && (
                                    <div className="pt-3 border-t border-slate-800 space-y-2">
                                        <div className="flex items-center gap-2 text-blue-400">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>{deployStatus}</span>
                                        </div>
                                        <Progress value={33} className="h-1 bg-slate-800" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 sm:gap-0 mt-4 h-12">
                        {wizardStep === "setup" ? (
                            <>
                                <Button
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                        setTempBackendUrl("");
                                        setCustomBackendUrl(null);
                                        toast({ title: "Reset effettuato", description: "Ripristinato il backend standard." });
                                        setIsPrivateBackendModalOpen(false);
                                    }}
                                >
                                    Reset Home
                                </Button>
                                <div className="flex-1" />
                                <Button
                                    className="bg-slate-900 text-white"
                                    onClick={() => {
                                        if (!setupProjectId || !setupGeminiKey) {
                                            toast({
                                                title: "Dati mancanti",
                                                description: "Project ID e Gemini API Key sono richiesti per il Setup Magico.",
                                                variant: "destructive"
                                            });
                                            return;
                                        }
                                        setWizardStep("keys");
                                    }}
                                >
                                    Continua
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" className="text-slate-500" onClick={() => {
                                    if (wizardStep === "keys") setWizardStep("setup");
                                    if (wizardStep === "deploy") setWizardStep("keys");
                                }}>
                                    Indietro
                                </Button>
                                <div className="flex-1" />
                                {wizardStep !== "deploy" ? (
                                    <Button
                                        className="bg-slate-900 text-white"
                                        onClick={() => {
                                            if (wizardStep === "keys") {
                                                setWizardStep("deploy");
                                            }
                                        }}
                                    >
                                        Continua
                                    </Button>
                                ) : (
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg animate-pulse hover:animate-none px-6"
                                        onClick={() => {
                                            handleDeployToCloud();
                                            setIsPrivateBackendModalOpen(false);
                                            toast({
                                                title: "Deployment Avviato",
                                                description: "Segui le istruzioni nella finestra di Google Cloud Shell che si è aperta."
                                            });
                                        }}
                                    >
                                        <Cloud className="w-4 h-4 mr-2" />
                                        LANCIA DEPLOY
                                    </Button>
                                )}
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
