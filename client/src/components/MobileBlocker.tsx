import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function MobileBlocker() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            // 1024px is a common breakpoint for tablets in landscape or smaller laptops
            // We want to block anything smaller than a standard desktop view
            setIsMobile(window.innerWidth < 1024);
        };

        // Check initially
        checkScreenSize();

        // Add listener
        window.addEventListener("resize", checkScreenSize);

        // Cleanup
        return () => window.removeEventListener("resize", checkScreenSize);
    }, []);

    if (!isMobile) return null;

    return (
        <div className="fixed inset-0 z-50 bg-blue-600 flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="bg-white/10 p-6 rounded-full mb-6 backdrop-blur-sm">
                <Monitor className="w-16 h-16" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Versione Desktop Richiesta</h1>
            <p className="text-lg max-w-md text-blue-100 leading-relaxed">
                Questa applicazione è ottimizzata per l'uso su computer.
                <br />
                Per favore, accedi da un browser desktop per utilizzare tutte le funzionalità del Compilatore AI.
            </p>
        </div>
    );
}
