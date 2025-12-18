import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, RefreshCw, Plus, Check, Loader2, ExternalLink } from "lucide-react";
import { useSources } from "@/contexts/SourcesContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface GmailMessage {
    id: string;
    threadId: string;
    subject: string;
    from: string;
    snippet: string;
    date: string;
}

export function ConnectorsSection() {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingMessages, setIsFetchingMessages] = useState(false);
    const [messages, setMessages] = useState<GmailMessage[]>([]);
    const { toast } = useToast();
    const { addSource } = useSources();

    useEffect(() => {
        checkConnection();

        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
                setIsConnected(true);
                fetchMessages();
                toast({
                    title: "Gmail Connesso",
                    description: "La connessione a Gmail è stata stabilita per questa sessione.",
                });
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const checkConnection = async () => {
        try {
            const res = await apiRequest('GET', '/api/auth/check');
            const data = await res.json();
            setIsConnected(data.isConnected);
            if (data.isConnected) {
                fetchMessages();
            }
        } catch (error) {
            console.error("Check connection error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnect = async () => {
        try {
            const res = await apiRequest('GET', '/api/auth/google');
            const data = await res.json();
            if (data.url) {
                // Open OAuth in a popup
                const width = 500;
                const height = 600;
                const left = window.screenX + (window.outerWidth - width) / 2;
                const top = window.screenY + (window.outerHeight - height) / 2;
                window.open(data.url, 'google-auth', `width=${width},height=${height},left=${left},top=${top}`);
            }
        } catch (error) {
            toast({
                title: "Errore Connessione",
                description: "Impossibile avviare il processo di autenticazione.",
                variant: "destructive",
            });
        }
    };

    const handleLogout = async () => {
        try {
            await apiRequest('POST', '/api/auth/logout');
            setIsConnected(false);
            setMessages([]);
            toast({
                title: "Scollegato",
                description: "Connessione Gmail rimossa.",
            });
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const fetchMessages = async () => {
        setIsFetchingMessages(true);
        try {
            const res = await apiRequest('GET', '/api/gmail/messages');
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error("Fetch messages error:", error);
            toast({
                title: "Errore Gmail",
                description: "Impossibile recuperare le email.",
                variant: "destructive",
            });
        } finally {
            setIsFetchingMessages(false);
        }
    };

    const importMessage = async (msg: GmailMessage) => {
        try {
            const res = await apiRequest('GET', `/api/gmail/message/${msg.id}`);
            if (res.ok) {
                const data = await res.json();

                // Create a File object from the email content
                const fileName = `Email_${msg.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
                const file = new File([data.body], fileName, { type: 'text/plain' });

                await addSource(file);

                toast({
                    title: "Email Importata",
                    description: `"${msg.subject}" è stata aggiunta alle fonti.`,
                });
            }
        } catch (error) {
            console.error("Import email error:", error);
            toast({
                title: "Errore Importazione",
                description: "Impossibile importare il contenuto dell'email.",
                variant: "destructive",
            });
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Gmail Card */}
                <Card className="border-2 hover:border-primary/20 transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                                <Mail className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Gmail</CardTitle>
                                <CardDescription>Live Session Auth</CardDescription>
                            </div>
                        </div>
                        {isConnected ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                                Connesso
                            </Badge>
                        ) : (
                            <Badge variant="outline">Non collegato</Badge>
                        )}
                    </CardHeader>
                    <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground mb-6">
                            Analizza le tue email recenti senza uscire dall'app. I dati non vengono salvati permanentemente.
                        </p>
                        {isConnected ? (
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleLogout}>
                                    Disconnetti
                                </Button>
                                <Button size="icon" variant="outline" onClick={fetchMessages} disabled={isFetchingMessages}>
                                    <RefreshCw className={`w-4 h-4 ${isFetchingMessages ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        ) : (
                            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={handleConnect}>
                                Connetti Gmail
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Placeholder cards for future integrations */}
                <Card className="opacity-60 border-dashed">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                                <div className="w-6 h-6 bg-slate-300 rounded-sm" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Google Drive</CardTitle>
                                <CardDescription>Coming Soon</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="opacity-60 border-dashed">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                                <div className="w-6 h-6 bg-slate-300 rounded-sm" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">OneDrive</CardTitle>
                                <CardDescription>Coming Soon</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            {isConnected && (
                <Card className="mt-8 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/30">
                        <div>
                            <CardTitle>Email Recenti</CardTitle>
                            <CardDescription>Seleziona un'email da importare nell'Analizzatore</CardDescription>
                        </div>
                        {isFetchingMessages && <Loader2 className="w-4 h-4 animate-spin" />}
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            {messages.length === 0 && !isFetchingMessages ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    Nessuna email trovata o filtrata.
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
                                                className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                                                onClick={() => importMessage(msg)}
                                            >
                                                <Plus className="w-3 h-3 mr-2" />
                                                Importa
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
