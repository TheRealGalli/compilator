import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function MobileBlocker() {
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        const checkDevice = () => {
            const ua = navigator.userAgent;
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || /iPad/.test(ua);
            setIsBlocked(isMobileUA || isIPad);
        };

        checkDevice();
    }, []);

    if (!isBlocked) return null;

    return (
        <div className="fixed inset-0 z-50 bg-[#0055ff] flex flex-col items-center justify-center p-6 text-white overflow-hidden">
            {/* Scacchiera Placeholder / Chess Board Foundation */}
            <div className="w-full max-w-[min(90vw,500px)] aspect-square grid grid-cols-8 grid-rows-8 border-2 border-white/20 shadow-2xl">
                {Array.from({ length: 64 }).map((_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const isWhite = (row + col) % 2 === 0;
                    return (
                        <div
                            key={i}
                            className={`w-full h-full flex items-center justify-center ${isWhite ? 'bg-white/10' : 'bg-black/10'
                                }`}
                        >
                            {/* Piece placeholder could go here */}
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 text-center">
                <h1 className="text-2xl font-bold mb-2">Ambiente Scacchi</h1>
                <p className="text-blue-100/80 text-sm max-w-[280px]">
                    Inizia una partita contro Gemini sfruttando lo stato della scacchiera.
                </p>
            </div>
        </div>
    );
}
