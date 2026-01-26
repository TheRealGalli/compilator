import { useEffect, useState } from "react";
import { motion, useSpring, AnimatePresence } from "framer-motion";
import { Asterisk } from "lucide-react";
import {
    FaChessPawn, FaChessRook, FaChessKnight, FaChessBishop,
    FaChessQueen, FaChessKing
} from "react-icons/fa6";
import chessBoardImage from "../assets/chess_board.png";

const INITIAL_BOARD = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'].map(type => ({ type, hasMoved: false })),
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'].map(type => ({ type, hasMoved: false })),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'].map(type => ({ type, hasMoved: false })),
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR'].map(type => ({ type, hasMoved: false }))
];

type Piece = { type: string, hasMoved: boolean } | null;

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
    const [isChessMode, setIsChessMode] = useState(false);
    const [board, setBoard] = useState<Piece[][]>(INITIAL_BOARD.map(row => row.map(p => p ? { ...p } : null)));
    const [selectedSquare, setSelectedSquare] = useState<{ r: number, c: number } | null>(null);
    const [feedback, setFeedback] = useState<{ r: number, c: number, type: 'valid' | 'invalid' } | null>(null);
    const [time, setTime] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [currentTurn, setCurrentTurn] = useState<'w' | 'b'>('w');
    const [gameStatus, setGameStatus] = useState<'play' | 'checkmate' | 'stalemate'>('play');

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
        setIsChessMode(prev => !prev);
        if (!isChessMode) {
            setBoard(INITIAL_BOARD.map(row => row.map(p => p ? { ...p } : null)));
            setSelectedSquare(null);
            setFeedback(null);
            setTime(0);
            setTimerActive(false);
            setCurrentTurn('w');
            setGameStatus('play');
        }
    };

    const isSquareAttacked = (r: number, c: number, board: Piece[][], attackerColor: 'w' | 'b'): boolean => {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.type.startsWith(attackerColor)) {
                    // Simple recursive check (avoiding infinite castling check)
                    if (isValidMoveInternal(piece, row, col, r, c, board, false)) return true;
                }
            }
        }
        return false;
    };

    const isKingInCheck = (board: Piece[][], color: 'w' | 'b'): boolean => {
        let kingPos = { r: -1, c: -1 };
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p?.type === `${color}K`) {
                    kingPos = { r, c };
                    break;
                }
            }
        }
        if (kingPos.r === -1) return false;
        return isSquareAttacked(kingPos.r, kingPos.c, board, color === 'w' ? 'b' : 'w');
    };

    const isValidMove = (piece: Piece, fromR: number, fromC: number, toR: number, toC: number): boolean => {
        if (!piece) return false;
        return isValidMoveInternal(piece, fromR, fromC, toR, toC, board, true);
    };

    const isValidMoveInternal = (piece: Piece, fromR: number, fromC: number, toR: number, toC: number, currentBoard: Piece[][], checkCastling: boolean): boolean => {
        if (!piece) return false;
        const dr = Math.abs(toR - fromR);
        const dc = Math.abs(toC - fromC);
        const pType = piece.type.substring(1);
        const isWhite = piece.type.startsWith('w');

        if (dr === 0 && dc === 0) return false;

        const targetPiece = currentBoard[toR][toC];
        if (targetPiece && targetPiece.type.startsWith(isWhite ? 'w' : 'b')) return false;

        let valid = false;
        switch (pType) {
            case 'P':
                if (isWhite) {
                    if (fromC === toC && fromR - toR === 1 && !currentBoard[toR][toC]) valid = true;
                    // Pawn double move: only if hasMoved is false
                    else if (fromC === toC && !piece.hasMoved && fromR - toR === 2 && !currentBoard[toR][toC] && !currentBoard[5][toC]) valid = true;
                    else if (dr === 1 && dc === 1 && currentBoard[toR][toC]?.type.startsWith('b')) valid = true;
                } else {
                    if (fromC === toC && toR - fromR === 1 && !currentBoard[toR][toC]) valid = true;
                    // Pawn double move: only if hasMoved is false
                    else if (fromC === toC && !piece.hasMoved && toR - fromR === 2 && !currentBoard[toR][toC] && !currentBoard[2][toC]) valid = true;
                    else if (dr === 1 && dc === 1 && currentBoard[toR][toC]?.type.startsWith('w')) valid = true;
                }
                break;
            case 'R':
                if (dr === 0 || dc === 0) {
                    valid = !isPathBlocked(fromR, fromC, toR, toC, currentBoard);
                }
                break;
            case 'N': valid = (dr === 2 && dc === 1) || (dr === 1 && dc === 2); break;
            case 'B':
                if (dr === dc) {
                    valid = !isPathBlocked(fromR, fromC, toR, toC, currentBoard);
                }
                break;
            case 'Q':
                if (dr === dc || dr === 0 || dc === 0) {
                    valid = !isPathBlocked(fromR, fromC, toR, toC, currentBoard);
                }
                break;
            case 'K':
                if (dr <= 1 && dc <= 1) valid = true;
                // Castling logic (Arrocco)
                else if (checkCastling && !piece.hasMoved && dr === 0 && dc === 2) {
                    const isShort = toC > fromC;
                    const rookC = isShort ? 7 : 0;
                    const rook = currentBoard[fromR][rookC];
                    if (rook && rook.type.substring(1) === 'R' && !rook.hasMoved) {
                        const pathClear = isShort ?
                            !currentBoard[fromR][5] && !currentBoard[fromR][6] :
                            !currentBoard[fromR][1] && !currentBoard[fromR][2] && !currentBoard[fromR][3];

                        if (pathClear) {
                            // Can't castle out of check, through check, or into check
                            const attackerColor = isWhite ? 'b' : 'w';
                            if (!isKingInCheck(currentBoard, isWhite ? 'w' : 'b')) {
                                const stepC = isShort ? 1 : -1;
                                if (!isSquareAttacked(fromR, fromC + stepC, currentBoard, attackerColor)) {
                                    valid = true;
                                }
                            }
                        }
                    }
                }
                break;
        }

        if (valid && checkCastling) {
            // Simulate move to ensure King isn't in check
            const simulatedBoard = currentBoard.map(row => [...row]);
            simulatedBoard[toR][toC] = piece;
            simulatedBoard[fromR][fromC] = null;
            if (isKingInCheck(simulatedBoard, isWhite ? 'w' : 'b')) return false;
        }

        return valid;
    };

    const isPathBlocked = (fromR: number, fromC: number, toR: number, toC: number, currentBoard: Piece[][]): boolean => {
        const stepR = toR === fromR ? 0 : (toR > fromR ? 1 : -1);
        const stepC = toC === fromC ? 0 : (toC > fromC ? 1 : -1);
        let currR = fromR + stepR;
        let currC = fromC + stepC;
        while (currR !== toR || currC !== toC) {
            if (currentBoard[currR][currC]) return true;
            currR += stepR;
            currC += stepC;
        }
        return false;
    };

    const handleSquareClick = (r: number, c: number) => {
        if (!isChessMode) return;

        const piece = board[r][c];

        if (selectedSquare) {
            const pieceAtFrom = board[selectedSquare.r][selectedSquare.c];
            if (pieceAtFrom && isValidMove(pieceAtFrom, selectedSquare.r, selectedSquare.c, r, c)) {
                if (!timerActive) setTimerActive(true);

                const newBoard = board.map(row => [...row]);
                newBoard[r][c] = { ...pieceAtFrom, hasMoved: true };

                // Pawn Promotion (to Queen)
                if (pieceAtFrom.type.substring(1) === 'P') {
                    if ((currentTurn === 'w' && r === 0) || (currentTurn === 'b' && r === 7)) {
                        newBoard[r][c] = { type: `${currentTurn}Q`, hasMoved: true };
                    }
                }

                newBoard[selectedSquare.r][selectedSquare.c] = null;

                // Checkmate / Stalemate detection for next turn
                const nextTurn = currentTurn === 'w' ? 'b' : 'w';
                let hasLegalMoves = false;
                outer: for (let fromR = 0; fromR < 8; fromR++) {
                    for (let fromC = 0; fromC < 8; fromC++) {
                        const p = newBoard[fromR][fromC];
                        if (p && p.type.startsWith(nextTurn)) {
                            for (let toR = 0; toR < 8; toR++) {
                                for (let toC = 0; toC < 8; toC++) {
                                    if (isValidMoveInternal(p, fromR, fromC, toR, toC, newBoard, true)) {
                                        hasLegalMoves = true;
                                        break outer;
                                    }
                                }
                            }
                        }
                    }
                }

                if (!hasLegalMoves) {
                    setTimerActive(false);
                    if (isKingInCheck(newBoard, nextTurn)) setGameStatus('checkmate');
                    else setGameStatus('stalemate');
                }

                setBoard(newBoard);
                setFeedback({ r, c, type: 'valid' });
                setTimeout(() => setFeedback(null), 500);
                setSelectedSquare(null);
                setCurrentTurn(nextTurn);
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

    const getFilter = (thickness: number) => `
        drop-shadow(${thickness}px ${thickness}px 0 black) 
        drop-shadow(-${thickness}px -${thickness}px 0 black) 
        drop-shadow(${thickness}px -${thickness}px 0 black) 
        drop-shadow(-${thickness}px ${thickness}px 0 black)
        drop-shadow(${thickness}px 0 0 black)
        drop-shadow(-${thickness}px 0 0 black)
        drop-shadow(0 ${thickness}px 0 black)
        drop-shadow(0 -${thickness}px 0 black)
    `;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0055ff] flex items-center justify-center overflow-hidden touch-none select-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2277ff_0%,_#0055ff_100%)] opacity-50" />

            {/* Set theme-color meta tag for browser continuity */}
            <style dangerouslySetInnerHTML={{
                __html: `
                :root { background: #0055ff; }
                meta[name="theme-color"] { content: #0055ff; }
            `}} />

            <motion.div
                style={{ rotateX, rotateY, perspective: 1500 }}
                className="relative z-10 w-full max-w-[min(94vw,520px)] aspect-square"
            >
                <div className="absolute -top-16 left-0 right-0 z-20 flex items-center justify-between px-1 h-12">
                    <div
                        className="flex items-center cursor-pointer group active:scale-95 transition-transform relative"
                        onClick={handleGromitClick}
                    >
                        <div className="flex items-center -space-x-3 shrink-0">
                            <motion.div
                                animate={{
                                    rotate: isChessMode ? 360 : 0,
                                    filter: getFilter(isChessMode ? 1.0 : 1.5)
                                }}
                                transition={{ duration: 1, ease: "easeInOut" }}
                                style={{ willChange: "transform, filter" }}
                            >
                                <Asterisk
                                    className="text-blue-600"
                                    size={32}
                                />
                            </motion.div>
                            <motion.div
                                animate={{
                                    filter: getFilter(isChessMode ? 1.0 : 1.5)
                                }}
                                transition={{ duration: 1, ease: "easeInOut" }}
                                style={{ willChange: "filter" }}
                            >
                                <Asterisk
                                    className="text-blue-600"
                                    size={32}
                                />
                            </motion.div>
                        </div>

                        <AnimatePresence>
                            {isChessMode && (
                                <motion.span
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                    className="absolute left-[56px] text-white text-xl font-bold tracking-tight drop-shadow-md whitespace-nowrap"
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
                        <AnimatePresence>
                            {gameStatus !== 'play' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none"
                                >
                                    <div className="bg-white/90 px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2">
                                        <span className="text-black text-2xl font-bold tracking-tight">
                                            {gameStatus === 'checkmate' ? 'CHECKMATE' : 'STALEMATE'}
                                        </span>
                                        <span className="text-blue-600 font-semibold uppercase tracking-widest text-sm">
                                            {gameStatus === 'checkmate' ? (currentTurn === 'w' ? 'Blue wins' : 'White wins') : 'Draw'}
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                                key={`${piece.type}-${r}-${c}`}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                className="relative z-10"
                                            >
                                                <ChessPiece type={piece.type} />
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
            </motion.div >

            <div className="absolute w-[90%] h-[90%] bg-blue-400/10 blur-[200px] -z-1" />
        </div >
    );
}
