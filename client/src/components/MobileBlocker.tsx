import { useEffect, useState, useMemo } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { Asterisk } from "lucide-react";
import {
    FaChessPawn, FaChessRook, FaChessKnight, FaChessBishop,
    FaChessQueen, FaChessKing
} from "react-icons/fa6";
import chessBoardImage from "../assets/chess_board.png";

const ChessPiece = ({ row, col }: { row: number, col: number }) => {
    const isWhite = row >= 6;
    const isBlue = row <= 1;

    if (!isWhite && !isBlue) return null;

    const colorClass = isWhite ? "text-white" : "text-blue-500";
    const shadow = "drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]";
    const size = 28;

    // Initial position logic
    if (row === 1 || row === 6) return <FaChessPawn className={`${colorClass} ${shadow}`} size={size} />;

    if (row === 0 || row === 7) {
        if (col === 0 || col === 7) return <FaChessRook className={`${colorClass} ${shadow}`} size={size} />;
        if (col === 1 || col === 6) return <FaChessKnight className={`${colorClass} ${shadow}`} size={size} />;
        if (col === 2 || col === 5) return <FaChessBishop className={`${colorClass} ${shadow}`} size={size} />;
        if (col === 3) return <FaChessQueen className={`${colorClass} ${shadow}`} size={size} />;
        if (col === 4) return <FaChessKing className={`${colorClass} ${shadow}`} size={size} />;
    }

    return null;
};

export function MobileBlocker() {
    const [isBlocked, setIsBlocked] = useState(false);
    const [isGromitSpinning, setIsGromitSpinning] = useState(false);
    const [isChessMode, setIsChessMode] = useState(false);

    const handleGromitClick = () => {
        setIsGromitSpinning(true);
        setIsChessMode(prev => !prev);
        setTimeout(() => setIsGromitSpinning(false), 1000);
    };

    // Spring-smoothed rotation values for premium feel
    const rotateX = useSpring(0, { stiffness: 60, damping: 20 });
    const rotateY = useSpring(0, { stiffness: 60, damping: 20 });

    useEffect(() => {
        const checkDevice = () => {
            const ua = navigator.userAgent;
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || /iPad/.test(ua);

            // For testing: allow manual bypass via URL or if on localhost
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const hasMobileBypass = new URLSearchParams(window.location.search).get('mobile') === 'true';

            // If we are on mobile/iPad AND not in bypass mode, we block
            setIsBlocked((isMobileUA || isIPad) && !hasMobileBypass);
        };

        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (e.beta !== null && e.gamma !== null) {
                // Beta is tilt front-to-back (-180 to 180)
                // Gamma is tilt left-to-right (-90 to 90)
                // We normalize for a subtle effect centered around the usual holding angle
                const y = Math.max(Math.min(e.gamma / 1.5, 20), -20);
                const x = Math.max(Math.min((e.beta - 45) / 1.5, 20), -20);
                rotateX.set(-x);
                rotateY.set(y);
            }
        };

        checkDevice();

        if (window.DeviceOrientationEvent) {
            // Request permission for iOS 13+ devices if needed (usually handled by browser prompt)
            window.addEventListener("deviceorientation", handleOrientation);
        }

        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [rotateX, rotateY]);

    if (!isBlocked) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0055ff] flex items-center justify-center overflow-hidden touch-none select-none">
            {/* Vibrant Background Sync */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2277ff_0%,_#0055ff_100%)] opacity-50" />

            <motion.div
                style={{ rotateX, rotateY, perspective: 1500 }}
                className="relative z-10 w-full max-w-[min(94vw,520px)] aspect-square"
            >
                {/* Gromit Logo & Title - Repositioned Outside/Above the board */}
                <div
                    className="absolute -top-12 left-0 z-20 flex items-center cursor-pointer group active:scale-95 transition-transform"
                    onClick={handleGromitClick}
                >
                    <div className="flex items-center -space-x-3">
                        <Asterisk
                            className={`text-blue-600 transition-transform duration-1000 ${isGromitSpinning ? 'rotate-[360deg]' : ''}`}
                            style={{ filter: 'drop-shadow(0 0 1px black) drop-shadow(0 0 1px black)' }}
                            width={32}
                            height={32}
                            strokeWidth={3}
                        />
                        <Asterisk
                            className="text-blue-600"
                            style={{ filter: 'drop-shadow(0 0 1px black) drop-shadow(0 0 1px black)' }}
                            width={32}
                            height={32}
                            strokeWidth={3}
                        />
                    </div>

                    <AnimatePresence mode="wait">
                        {isChessMode && (
                            <motion.span
                                initial={{ opacity: 0, x: "100vw" }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: "100vw" }}
                                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                className="ml-1.5 text-white text-xl font-bold tracking-tight drop-shadow-md whitespace-nowrap"
                            >
                                Gromit-Chess
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                {/* Main Crystal Container */}
                <div className="w-full h-full relative rounded-3xl overflow-hidden border border-white/40 backdrop-blur-[30px] bg-white/[0.05] shadow-[0_60px_150px_rgba(0,0,0,0.6),inset_0_0_80px_rgba(255,255,255,0.05)]">

                    {/* The Actual High-Res Image - Focused on the board */}
                    <img
                        src={chessBoardImage}
                        alt="Chess Board"
                        className="absolute inset-0 w-[112%] h-[112%] max-w-none object-cover left-[-6%] top-[-6%] opacity-95"
                    />

                    {/* Interactive Overlay Grid (Precisely Aligned to the Board) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[75.0%] h-[75.0%] grid grid-cols-8 grid-rows-8 translate-y-[-0.2%]">
                            {Array.from({ length: 64 }).map((_, i) => {
                                const row = Math.floor(i / 8);
                                const col = i % 8;

                                return (
                                    <div
                                        key={i}
                                        className="w-full h-full relative flex items-center justify-center transition-all duration-300 hover:bg-white/[0.1] active:bg-white/[0.2] cursor-pointer border border-white/5"
                                        onClick={() => console.log(`Square ${i} clicked`)}
                                    >
                                        <AnimatePresence>
                                            {isChessMode && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 2, ease: "easeOut" }}
                                                    className="relative"
                                                >
                                                    <ChessPiece row={row} col={col} />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Premium Glass Glare Effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15)_0%,_transparent_60%)] pointer-events-none" />

                    {/* Framed Internal Bezel */}
                    <div className="absolute inset-[4px] rounded-[22px] border border-white/25 pointer-events-none shadow-[inset_0_0_30px_rgba(255,255,255,0.1)]" />
                </div>
            </motion.div>

            {/* Ambient glow behind the board */}
            <div className="absolute w-[90%] h-[90%] bg-blue-400/10 blur-[200px] -z-1" />
        </div>
    );
}
