import { useEffect, useState } from "react";
import { motion, useSpring, AnimatePresence } from "framer-motion";
import { Asterisk } from "lucide-react";
import {
    FaChessPawn, FaChessRook, FaChessKnight, FaChessBishop,
    FaChessQueen, FaChessKing
} from "react-icons/fa6";
import chessBoardImage from "../assets/chess_board.png";

const INITIAL_BOARD = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
];

const ChessPiece = ({ type }: { type: string }) => {
    const isWhite = type.startsWith('w');
    const colorClass = isWhite ? "text-white" : "text-blue-500";
    const shadow = "drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]";
    const size = 28;

    const piece = type.substring(1);
    switch (piece) {
        case 'P': return <FaChessPawn className={`${colorClass} ${shadow}`} size={size} />;
        case 'R': return <FaChessRook className={`${colorClass} ${shadow}`} size={size} />;
        case 'N': return <FaChessKnight className={`${colorClass} ${shadow}`} size={size} />;
        case 'B': return <FaChessBishop className={`${colorClass} ${shadow}`} size={size} />;
        case 'Q': return <FaChessQueen className={`${colorClass} ${shadow}`} size={size} />;
        case 'K': return <FaChessKing className={`${colorClass} ${shadow}`} size={size} />;
        default: return null;
    }
};

const checkDeviceSync = () => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || /iPad/.test(ua);
    const hasMobileBypass = new URLSearchParams(window.location.search).get('mobile') === 'true';
    return (isMobileUA || isIPad) && !hasMobileBypass;
};

export function MobileBlocker() {
    const [isBlocked, setIsBlocked] = useState(checkDeviceSync());
    const [isGromitSpinning, setIsGromitSpinning] = useState(false);
    const [isChessMode, setIsChessMode] = useState(false);
    const [board, setBoard] = useState<(string | null)[][]>(INITIAL_BOARD);
    const [selectedSquare, setSelectedSquare] = useState<{ r: number, c: number } | null>(null);
    const [feedback, setFeedback] = useState<{ r: number, c: number, type: 'valid' | 'invalid' } | null>(null);
    const [time, setTime] = useState(0);
    const [timerActive, setTimerActive] = useState(false);

    useEffect(() => {
        let interval: any;
        if (timerActive) {
            interval = setInterval(() => setTime(t => t + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleGromitClick = () => {
        setIsGromitSpinning(true);
        setIsChessMode(prev => !prev);
        if (!isChessMode) {
            setBoard(INITIAL_BOARD);
            setSelectedSquare(null);
            setFeedback(null);
            setTime(0);
            setTimerActive(false);
        }
        setTimeout(() => setIsGromitSpinning(false), 1000);
    };

    const isValidMove = (piece: string, fromR: number, fromC: number, toR: number, toC: number): boolean => {
        const dr = Math.abs(toR - fromR);
        const dc = Math.abs(toC - fromC);
        const pType = piece.substring(1);
        const isWhite = piece.startsWith('w');

        if (dr === 0 && dc === 0) return false;

        const targetPiece = board[toR][toC];
        if (targetPiece && targetPiece.startsWith(isWhite ? 'w' : 'b')) return false;

        switch (pType) {
            case 'P':
                if (isWhite) {
                    if (fromC === toC && fromR - toR === 1 && !board[toR][toC]) return true;
                    if (fromC === toC && fromR === 6 && fromR - toR === 2 && !board[toR][toC] && !board[5][toC]) return true;
                    if (dr === 1 && dc === 1 && board[toR][toC]?.startsWith('b')) return true;
                } else {
                    if (fromC === toC && toR - fromR === 1 && !board[toR][toC]) return true;
                    if (fromC === toC && fromR === 1 && toR - fromR === 2 && !board[toR][toC] && !board[2][toC]) return true;
                    if (dr === 1 && dc === 1 && board[toR][toC]?.startsWith('w')) return true;
                }
                return false;
            case 'R': return dr === 0 || dc === 0;
            case 'N': return (dr === 2 && dc === 1) || (dr === 1 && dc === 2);
            case 'B': return dr === dc;
            case 'Q': return dr === dc || dr === 0 || dc === 0;
            case 'K': return dr <= 1 && dc <= 1;
        }
        return false;
    };

    const handleSquareClick = (r: number, c: number) => {
        if (!isChessMode) return;

        const piece = board[r][c];

        if (selectedSquare) {
            const pieceAtFrom = board[selectedSquare.r][selectedSquare.c];
            if (pieceAtFrom && isValidMove(pieceAtFrom, selectedSquare.r, selectedSquare.c, r, c)) {
                // Start timer ONLY on first valid move
                if (!timerActive) setTimerActive(true);

                const newBoard = board.map(row => [...row]);
                newBoard[r][c] = pieceAtFrom;
                newBoard[selectedSquare.r][selectedSquare.c] = null;
                setBoard(newBoard);
                setFeedback({ r, c, type: 'valid' });
                setTimeout(() => setFeedback(null), 500);
                setSelectedSquare(null);
            } else {
                setFeedback({ r, c, type: 'invalid' });
                setTimeout(() => setFeedback(null), 500);
                if (piece) setSelectedSquare({ r, c });
                else setSelectedSquare(null);
            }
        } else {
            if (piece) setSelectedSquare({ r, c });
        }
    };

    const rotateX = useSpring(0, { stiffness: 60, damping: 20 });
    const rotateY = useSpring(0, { stiffness: 60, damping: 20 });

    useEffect(() => {
        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (e.beta !== null && e.gamma !== null) {
                const y = Math.max(Math.min(e.gamma / 1.5, 20), -20);
                const x = Math.max(Math.min((e.beta - 45) / 1.5, 20), -20);
                rotateX.set(-x);
                rotateY.set(y);
            }
        };

        if (window.DeviceOrientationEvent) {
            window.addEventListener("deviceorientation", handleOrientation);
        }
        return () => window.removeEventListener("deviceorientation", handleOrientation);
    }, [rotateX, rotateY]);

    if (!isBlocked) return null;

    const s = isChessMode ? 1.0 : 1.5;
    const boldOutlineStyle = {
        filter: `
            drop-shadow(${s}px ${s}px 0 black) 
            drop-shadow(-${s}px -${s}px 0 black) 
            drop-shadow(${s}px -${s}px 0 black) 
            drop-shadow(-${s}px ${s}px 0 black)
            drop-shadow(${s}px 0 0 black)
            drop-shadow(-${s}px 0 0 black)
            drop-shadow(0 ${s}px 0 black)
            drop-shadow(0 -${s}px 0 black)
        `,
        transition: 'filter 1s ease-in-out'
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0055ff] flex items-center justify-center overflow-hidden touch-none select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2277ff_0%,_#0055ff_100%)] opacity-50" />

            <motion.div
                style={{ rotateX, rotateY, perspective: 1500 }}
                className="relative z-10 w-full max-w-[min(94vw,520px)] aspect-square"
            >
                <div className="absolute -top-14 left-0 right-0 z-20 flex items-center justify-between px-1">
                    <div
                        className="flex items-center cursor-pointer group active:scale-95 transition-transform"
                        onClick={handleGromitClick}
                    >
                        <div className="flex items-center -space-x-3">
                            <motion.div
                                animate={{ rotate: isChessMode ? 360 : 0 }}
                                transition={{ duration: 1, ease: "easeInOut" }}
                            >
                                <Asterisk
                                    className="text-blue-600"
                                    style={boldOutlineStyle}
                                    size={32}
                                />
                            </motion.div>
                            <div className="relative">
                                <Asterisk
                                    className="text-blue-600"
                                    style={boldOutlineStyle}
                                    size={32}
                                />
                            </div>
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

                    <AnimatePresence>
                        {isChessMode && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-white font-mono text-lg shadow-lg"
                            >
                                {formatTime(time)}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="w-full h-full relative rounded-3xl overflow-hidden border border-white/40 backdrop-blur-[30px] bg-white/[0.05] shadow-[0_60px_150px_rgba(0,0,0,0.6),inset_0_0_80px_rgba(255,255,255,0.05)]">
                    <img
                        src={chessBoardImage}
                        alt="Chess Board"
                        className="absolute inset-0 w-[112%] h-[112%] max-w-none object-cover left-[-6%] top-[-6%] opacity-95"
                    />

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[75.0%] h-[75.0%] grid grid-cols-8 grid-rows-8 translate-y-[-0.2%]">
                            {board.map((row, r) => row.map((piece, c) => (
                                <div
                                    key={`${r}-${c}`}
                                    className={`w-full h-full relative flex items-center justify-center transition-all duration-300 cursor-pointer border border-white/5
                                        ${selectedSquare?.r === r && selectedSquare?.c === c ? 'bg-white/20' : ''}
                                        ${feedback?.r === r && feedback?.c === c ? (feedback.type === 'valid' ? 'bg-green-500/40' : 'bg-red-500/40') : 'hover:bg-white/10 active:bg-white/15'}
                                    `}
                                    onClick={() => handleSquareClick(r, c)}
                                >
                                    <AnimatePresence>
                                        {isChessMode && piece && (
                                            <motion.div
                                                key={`${piece}-${r}-${c}`}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                className="relative z-10"
                                            >
                                                <ChessPiece type={piece} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )))}
                        </div>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15)_0%,_transparent_60%)] pointer-events-none" />
                    <div className="absolute inset-[4px] rounded-[22px] border border-white/25 pointer-events-none shadow-[inset_0_0_30px_rgba(255,255,255,0.1)]" />
                </div>
            </motion.div>

            <div className="absolute w-[90%] h-[90%] bg-blue-400/10 blur-[200px] -z-1" />

            {/* Ultra-precise dynamic screen border frame */}
            <motion.div
                className="fixed inset-0 pointer-events-none z-[10000] border-black opacity-100"
                initial={{ borderWidth: isBlocked ? "9px" : "0px" }}
                animate={{ borderWidth: isChessMode ? "6px" : "9px" }}
                transition={{ duration: 1, ease: "easeInOut" }}
            />
        </div>
    );
}
