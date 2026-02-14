import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Cpu, LogIn, Link2 } from "lucide-react";
import { useGmail } from "@/contexts/GmailContext";
import { useOllama } from "@/contexts/OllamaContext";
import { useEffect } from "react";

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

export function ConnectorsSection() {
    const { isConnected, isLoading, isFetchingMessages, connect, logout, fetchMessages } = useGmail();
    const { status: ollamaStatus, checkStatus: checkOllama } = useOllama();

    useEffect(() => {
        checkOllama();
    }, []);

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

                {/* Ollama Card */}
                <Card className={`border-2 transition-all flex flex-col ${ollamaStatus === 'connected' ? 'border-blue-200 bg-blue-50/20' : 'opacity-60 border-dashed hover:opacity-100'}`}>
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
                        </p>
                        <div className="mt-auto space-y-3">
                            <Button
                                variant="secondary"
                                className={`w-full ${ollamaStatus === 'connected' ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                                disabled={ollamaStatus !== 'connected'}
                            >
                                {ollamaStatus === 'connected' ? (
                                    <>
                                        <Link2 className="w-4 h-4 mr-2" />
                                        Connetti Ollama
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-4 h-4 mr-2" />
                                        Effettua Login a Ollama
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
            </div>
        </div>
    );
}
