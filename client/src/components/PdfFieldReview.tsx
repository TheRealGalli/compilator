import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Check, X, Info, Edit2, Save, Square } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface FieldProposal {
    name: string;
    label?: string; // New: human readable label
    type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'unknown';
    value: string | boolean;
    reasoning: string;
    status: 'pending' | 'approved' | 'rejected';
}

interface PdfFieldReviewProps {
    proposals: FieldProposal[];
    onUpdate: (updated: FieldProposal[]) => void;
    onFinalize: () => void;
    isFinalizing: boolean;
    isCompiling?: boolean;
    title?: string;
}

export function PdfFieldReview({ proposals, onUpdate, onFinalize, isFinalizing, isCompiling, title = "Revisione Campi PDF" }: PdfFieldReviewProps) {
    const [editingName, setEditingName] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    // Animation/Progression State: revealedNames tracks which items are visible to the user
    const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());
    const revealTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Effect to drip-feed proposals into the visible list
    useEffect(() => {
        // Find proposals that have a value/reasoning but aren't revealed yet
        const pendingReveal = proposals.filter(p =>
            p.value !== "" &&
            p.value !== undefined &&
            !revealedNames.has(p.name)
        );

        if (pendingReveal.length > 0 && !revealTimerRef.current) {
            // "Drip feed" - reveal one every 3 seconds
            revealTimerRef.current = setInterval(() => {
                setRevealedNames(prev => {
                    // Get the next item to reveal from the latest proposals
                    const currentProposals = proposals; // capture current scale
                    const nextToReveal = currentProposals.find(p =>
                        p.value !== "" &&
                        p.value !== undefined &&
                        !prev.has(p.name)
                    );

                    if (!nextToReveal) {
                        if (revealTimerRef.current) clearInterval(revealTimerRef.current);
                        revealTimerRef.current = null;
                        return prev;
                    }

                    const next = new Set(prev);
                    next.add(nextToReveal.name);
                    return next;
                });
            }, 3000); // 3 seconds interval as requested
        }

        return () => {
            if (revealTimerRef.current) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
            }
        };
    }, [proposals, revealedNames]);

    const updateStatus = (name: string, status: FieldProposal['status']) => {
        const next = proposals.map(p => p.name === name ? { ...p, status } : p);
        onUpdate(next);
    };

    const handleAcceptAll = () => {
        if (isCompiling || proposals.length === 0) return;
        const next = proposals.map(p => ({ ...p, status: 'approved' as const }));
        onUpdate(next);
    };

    const startEditing = (proposal: FieldProposal) => {
        setEditingName(proposal.name);
        setEditValue(String(proposal.value));
    };

    const saveEdit = (name: string) => {
        const next = proposals.map(p => {
            if (p.name !== name) return p;
            const updatedValue = p.type === 'checkbox' ? (editValue.toLowerCase() === 'true' || editValue === 'Selezionato') : editValue;
            return { ...p, value: updatedValue, status: 'approved' as const };
        });
        onUpdate(next);
        setEditingName(null);
    };

    // Filter which items to show based on animation state
    const compilableSorted = proposals
        .filter(p => p.value !== undefined && p.value !== "" && p.value !== "[Vuoto]" && p.value !== "[FONTE MANCANTE]")
        .filter(p => revealedNames.has(p.name));

    const approvedCount = compilableSorted.filter(p => p.status === 'approved').length;
    const allApproved = approvedCount === proposals.length && proposals.length > 0;

    return (
        <Card className="flex flex-col h-full border rounded-lg bg-background shadow-none">
            <div className="p-3 border-b flex items-center justify-between bg-muted/30 flex-shrink-0">
                <div className="flex flex-col">
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Revisione intelligente dei campi mappati</p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleAcceptAll}
                                    disabled={isCompiling || proposals.length === 0 || allApproved}
                                    className={`
                                        flex items-center h-6 px-2.5 rounded-full border text-[10px] font-bold transition-all
                                        ${allApproved
                                            ? 'bg-green-600/20 text-green-700 border-green-300'
                                            : isCompiling
                                                ? 'bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed'
                                                : 'bg-blue-600/10 text-blue-700 border-blue-200/50 hover:bg-blue-600/20 active:scale-95 cursor-pointer'
                                        }
                                    `}
                                >
                                    {approvedCount} / {proposals.length}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                <p className="text-[10px]">
                                    {allApproved ? "Tutti i campi approvati" : isCompiling ? "Analisi in corso..." : "Clicca per approvare tutti"}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    {(compilableSorted.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-40 opacity-40">
                            <Square className="w-8 h-8 mb-2 animate-pulse text-blue-400" />
                            <p className="text-xs font-medium text-center px-4 tracking-tight">Sto analizzando il documento...<br />I campi compilati appariranno qui.</p>
                        </div>
                    )}
                    {compilableSorted
                        .map((proposal) => (
                            <div
                                key={proposal.name}
                                className={`p-3 rounded-lg border transition-all animate-in fade-in slide-in-from-bottom-2 duration-500 ${proposal.status === 'approved' ? 'bg-green-500/10 border-green-500/20' :
                                    proposal.status === 'rejected' ? 'bg-red-500/10 border-red-500/20 opacity-60' :
                                        'bg-muted/5 border-border/50'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                RILEVAZIONE CAMPO
                                            </span>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="w-3 h-3 text-blue-400 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-[200px]">
                                                        <p className="text-xs">{proposal.reasoning}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>

                                        <div className="text-sm text-foreground/80 leading-relaxed mb-1">
                                            <span className="font-bold text-foreground">{proposal.label || proposal.name}</span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground mb-2">
                                            compilo con:
                                        </div>

                                        {editingName === proposal.name ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-8 text-sm"
                                                    autoFocus
                                                />
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => saveEdit(proposal.name)}>
                                                    <Save className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm px-2 py-0.5 rounded border ${proposal.value === "[FONTE MANCANTE]"
                                                    ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                                                    : "text-blue-500 bg-blue-500/10 border-blue-500/20"
                                                    }`}>
                                                    {proposal.type === 'checkbox' ? (proposal.value === 'true' || proposal.value === true ? "Selezionato" : "Deselezionato") : String(proposal.value) || "[Vuoto]"}
                                                </span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={() => startEditing(proposal)}>
                                                    <Edit2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateStatus(proposal.name, 'approved')}
                                            className={`w-7 h-7 rounded border flex items-center justify-center transition-all ${proposal.status === 'approved'
                                                ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                                : 'border-blue-200/50 bg-transparent hover:border-green-400 text-transparent'
                                                }`}
                                        >
                                            <Check className={`w-4 h-4 ${proposal.status === 'approved' ? 'opacity-100' : 'opacity-0'}`} />
                                        </button>
                                        <button
                                            onClick={() => updateStatus(proposal.name, 'rejected')}
                                            className={`w-7 h-7 rounded border flex items-center justify-center transition-all ${proposal.status === 'rejected'
                                                ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                                : 'border-blue-200/50 bg-transparent hover:border-red-400 text-transparent'
                                                }`}
                                        >
                                            <X className={`w-4 h-4 ${proposal.status === 'rejected' ? 'opacity-100' : 'opacity-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            </ScrollArea >

            <div className="p-3 bg-muted/10 border-t flex flex-col gap-2">
                <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 shadow-sm transition-all active:scale-[0.98]"
                    onClick={onFinalize}
                    disabled={isFinalizing || proposals.length === 0}
                >
                    {isFinalizing ? (
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Generazione...
                        </div>
                    ) : (proposals.length > 0 ? "Finalizza Compilazione" : "Caricamento Campi...")}
                </Button>
                <div className="flex items-center justify-center gap-1.5 opacity-60">
                    <Info className="w-2.5 h-2.5 text-blue-500" />
                    <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-tighter">
                        I valori approvati verranno inseriti nel modulo PDF originale
                    </p>
                </div>
            </div>
        </Card >
    );
}
