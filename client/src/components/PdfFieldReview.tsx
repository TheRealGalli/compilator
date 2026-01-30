import { useState } from 'react';
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

    // Filter which items to show: show if it has a value and is not empty
    const compilableSorted = proposals
        .filter(p => p.value !== undefined && p.value !== "" && p.value !== "[Vuoto]" && p.value !== "[FONTE MANCANTE]");

    const approvedCount = compilableSorted.filter(p => p.status === 'approved').length;
    const allApproved = approvedCount === proposals.length && proposals.length > 0;

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden border-none shadow-none">
            <div className="p-2 border-b flex items-center justify-between bg-muted/30 flex-shrink-0">
                <div className="flex flex-col">
                    <h3 className="text-xs font-semibold text-foreground tracking-tight uppercase tracking-wider">{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleAcceptAll}
                                    disabled={isCompiling || proposals.length === 0 || allApproved}
                                    className={`
                                        flex items-center h-5 px-2 rounded-full border text-[9px] font-bold transition-all
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

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                    {(compilableSorted.length === 0) && (
                        <div className="flex flex-col items-center justify-center p-8 opacity-40">
                            <Square className="w-6 h-6 mb-2 animate-pulse text-blue-400" />
                            <p className="text-[10px] font-medium text-center px-4 tracking-tight uppercase tracking-widest">
                                {isCompiling ? "Rilevamento campi..." : "Nessun campo rilevato"}
                            </p>
                        </div>
                    )}
                    {compilableSorted
                        .map((proposal) => (
                            <div
                                key={proposal.name}
                                className={`p-2 rounded border transition-all animate-in fade-in slide-in-from-bottom-1 duration-300 ${proposal.status === 'approved' ? 'bg-green-500/5 border-green-500/20' :
                                    proposal.status === 'rejected' ? 'bg-red-500/5 border-red-500/20 opacity-60' :
                                        'bg-card border-border/60 hover:border-border shadow-sm'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">
                                                {proposal.name.substring(0, 15)}
                                            </span>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="w-2.5 h-2.5 text-blue-400 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-[200px]">
                                                        <p className="text-[10px]">{proposal.reasoning}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>

                                        <div className="text-[11px] font-bold text-foreground mb-1 leading-tight line-clamp-2">
                                            {proposal.label || proposal.name}
                                        </div>

                                        {editingName === proposal.name ? (
                                            <div className="flex gap-1 mt-2">
                                                <Input
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="h-7 text-[11px] py-1 px-2"
                                                    autoFocus
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 shrink-0" onClick={() => saveEdit(proposal.name)}>
                                                    <Save className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border-b-2 shadow-sm ${proposal.value === "[FONTE MANCANTE]"
                                                    ? "text-amber-600 bg-amber-500/5 border-amber-500/20"
                                                    : "text-blue-600 bg-blue-500/5 border-blue-500/20"
                                                    }`}>
                                                    {proposal.type === 'checkbox' ? (proposal.value === 'true' || proposal.value === true ? "Selezionato" : "Deselezionato") : String(proposal.value) || "[Vuoto]"}
                                                </span>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-40 hover:opacity-100" onClick={() => startEditing(proposal)}>
                                                    <Edit2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => updateStatus(proposal.name, 'approved')}
                                            className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${proposal.status === 'approved'
                                                ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                                : 'border-border bg-background hover:border-green-400 text-transparent'
                                                }`}
                                        >
                                            <Check className={`w-3.5 h-3.5 ${proposal.status === 'approved' ? 'opacity-100' : 'opacity-0'}`} />
                                        </button>
                                        <button
                                            onClick={() => updateStatus(proposal.name, 'rejected')}
                                            className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${proposal.status === 'rejected'
                                                ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                                : 'border-border bg-background hover:border-red-400 text-transparent'
                                                }`}
                                        >
                                            <X className={`w-3.5 h-3.5 ${proposal.status === 'rejected' ? 'opacity-100' : 'opacity-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            </ScrollArea >

            <div className="p-3 bg-muted/10 border-t flex flex-col gap-2 flex-shrink-0">
                <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 shadow-md transition-all active:scale-[0.98] text-xs"
                    onClick={onFinalize}
                    disabled={isFinalizing || proposals.length === 0 || isCompiling}
                >
                    {isFinalizing ? (
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Finalizzazione...
                        </div>
                    ) : isCompiling ? (
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Analisi AI...
                        </div>
                    ) : (proposals.length > 0 ? "Finalizza PDF" : "Caricamento...")}
                </Button>
                <div className="flex items-center justify-center gap-1.5 opacity-60">
                    <Info className="w-2.5 h-2.5 text-blue-500" />
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                        Versione 2.5 • Studio Master
                    </p>
                </div>
            </div>
        </div>
    );
}
