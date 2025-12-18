import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2 } from "lucide-react";
import { useGmail } from "@/contexts/GmailContext";

export const GmailLogo = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
        <path fill="#EA4335" d="M20 18h-2V9.25L12 13 6 9.25V18H4V6c0-.55.45-1 1-1h1l6 3.75L18 5h1c.55 0 1 .45 1 1v12z" />
        <path fill="#4285F4" d="M22 6v12c0 1.1-.9 2-2 2h-2V9.25L12 13 6 9.25V20H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h3l5 3.12L17 4h3c1.1 0 2 .9 2 2z" opacity=".2" />
        <path fill="#FBBC05" d="M12 13L6 9.25V6c0-.55.45-1 1-1h1l4 2.5L12 13z" opacity=".2" />
        <path fill="#34A853" d="M12 13l6-3.75V6c0-.55.45-1-1-1h-1l-4 2.5L12 13z" opacity=".2" />
    </svg>
);

export function ConnectorsSection() {
    const { isConnected, isLoading, isFetchingMessages, connect, logout, fetchMessages } = useGmail();

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
                            <div className="p-2 bg-white border border-slate-100 shadow-sm rounded-lg flex items-center justify-center">
                                <GmailLogo className="w-6 h-6" />
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
                                <Button variant="outline" className="flex-1" onClick={logout}>
                                    Disconnetti
                                </Button>
                                <Button size="icon" variant="outline" onClick={fetchMessages} disabled={isFetchingMessages}>
                                    <RefreshCw className={`w-4 h-4 ${isFetchingMessages ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        ) : (
                            <Button className="w-full bg-red-600 hover:bg-red-700 text-white" onClick={connect}>
                                Connetti Gmail
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Placeholder cards */}
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
        </div>
    );
}
