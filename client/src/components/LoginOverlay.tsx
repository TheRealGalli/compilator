import React from "react";
import { Button } from "@/components/ui/button";
import { SiGoogle } from "react-icons/si";
import { ShieldCheck, FileText, HelpCircle, Info } from "lucide-react";

import { API_BASE_URL } from "@/lib/api-config";

export function LoginOverlay() {
    const handleGoogleLogin = () => {
        window.location.href = `${API_BASE_URL}/api/auth/google`;
    };

    return (
        <div className="absolute inset-0 z-50 flex items-stretch bg-[#002aff] animate-in fade-in duration-500">
            {/* LEFT COLUMN: Greeting (1/3) */}
            <div className="flex-1 flex flex-col justify-start pt-[20vh] lg:pt-[25vh] p-8 text-white border-r border-white/10 overflow-hidden relative">
                <h1 className="text-3xl font-bold mb-4 tracking-tight">Benvenuto in Gromit</h1>
                <p className="text-base opacity-90 leading-relaxed">
                    La piattaforma avanzata per l'analisi e la compilazione dei tuoi documenti.
                    Accedi per iniziare a lavorare con la potenza dell'Intelligenza Artificiale.
                </p>
                <div className="mt-8 flex flex-col gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Powered by</p>
                    <div className="flex gap-4 opacity-75">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <ShieldCheck className="w-4 h-4" /> Vertex AI
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <FileText className="w-4 h-4" /> Ollama
                        </div>
                    </div>
                </div>
            </div>

            {/* CENTER COLUMN: Login Action (1/3) */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white/5 relative overflow-hidden group">
                {/* Subtle dynamic background effect could go here */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <h2 className="text-2xl font-semibold text-white mb-8 z-10 text-center">Accedi al tuo account</h2>

                <Button
                    size="lg"
                    onClick={handleGoogleLogin}
                    className="w-full max-w-xs h-14 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-semibold text-lg shadow-xl transition-all transform hover:scale-[1.02] z-10 flex items-center justify-center gap-3"
                >
                    <SiGoogle className="w-6 h-6" />
                    Continua con Google
                </Button>

                <p className="mt-6 text-white/60 text-sm z-10 text-center">
                    Non serve password. Semplice e veloce.
                </p>
            </div>

            {/* RIGHT COLUMN: Information & Links (1/3) */}
            <div className="flex-1 flex flex-col justify-start pt-[20vh] lg:pt-[25vh] p-8 pb-20 border-l border-white/10 bg-black/10 relative">
                <h3 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2 tracking-tight">
                    <Info className="w-6 h-6" /> Informazioni
                </h3>

                <ul className="mt-8 space-y-4 text-white/80">
                    <li>
                        <a href="#" className="flex items-center gap-3 hover:text-white hover:underline transition-colors group">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors shrink-0" />
                            Privacy Policy
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex items-center gap-3 hover:text-white hover:underline transition-colors group">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors shrink-0" />
                            Termini di Servizio
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex items-center gap-3 hover:text-white hover:underline transition-colors group">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors shrink-0" />
                            I Nostri Piani
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex items-center gap-3 hover:text-white hover:underline transition-colors group">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors shrink-0" />
                            Chi Siamo
                        </a>
                    </li>
                    <li>
                        <a href="#" className="flex items-center gap-3 hover:text-white hover:underline transition-colors group">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/50 group-hover:bg-white transition-colors shrink-0" />
                            Supporto Clienti
                            <HelpCircle className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity shrink-0 ml-auto sm:ml-0" />
                        </a>
                    </li>
                </ul>

                <div className="absolute bottom-0 left-0 right-0 pb-3 pt-4 text-white/40 text-xs text-center border-t border-white/5">
                    © 2025 CSD Station LLC. All rights reserved.
                </div>
            </div>
        </div>
    );
}
