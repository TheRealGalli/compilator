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
    title?: string;
}

export function PdfFieldReview({ proposals, onUpdate, onFinalize, isFinalizing, title = "Revisione Campi PDF" }: PdfFieldReviewProps) {
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>("");

    const updateStatus = (index: number, status: FieldProposal['status']) => {
        const next = [...proposals];
        next[index].status = status;
        onUpdate(next);
    };

    const startEditing = (index: number) => {
        setEditingIdx(index);
        setEditValue(String(proposals[index].value));
    };

    const saveEdit = (index: number) => {
        const next = [...proposals];
        const type = next[index].type;

        if (type === 'checkbox') {
            next[index].value = editValue.toLowerCase() === 'true';
        } else {
            next[index].value = editValue;
        }

        next[index].status = 'approved';
        onUpdate(next);
        setEditingIdx(null);
    };

    return (
        <Card className="flex flex-col h-full border rounded-lg bg-background shadow-none">
            <div className="p-3 border-b flex items-center justify-between bg-muted/30 flex-shrink-0">
                <div className="flex flex-col">
                    <h3 className="text-sm font-semibold text-gray-900 tracking-tight">{title}</h3>
                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Revisione intelligente dei campi mappati</p>
                </div>
                <Badge variant="outline" className="bg-blue-600/10 text-blue-700 border-blue-200/50 text-[10px] h-5 font-bold px-2">
                    {proposals.filter(p => p.status === 'approved').length} / {proposals.length}
                </Badge>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                    {proposals.length === 0 && !isFinalizing && (
                        <div className="flex flex-col items-center justify-center h-40 opacity-40">
                            <Square className="w-8 h-8 mb-2 animate-pulse text-blue-400" />
                            <p className="text-xs font-medium">L'AI sta analizzando i 143 campi...</p>
                        </div>
                    )}
                    {proposals.map((proposal, idx) => (
                        <div
                            key={proposal.name}
                            className={`p-3 rounded-lg border transition-all ${proposal.status === 'approved' ? 'bg-green-50 border-green-200' :
                                proposal.status === 'rejected' ? 'bg-red-50 border-red-200 opacity-60' :
                                    'bg-white border-blue-100'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                                            Rilevazione Campo
                                        </span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Info className="w-3 h-3 text-blue-400" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-[200px]">
                                                    <p className="text-xs">{proposal.reasoning}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>

                                    <div className="text-sm text-gray-700 leading-relaxed mb-2">
                                        Compilazione del campo <span className="font-mono font-bold text-gray-900 break-all">"{proposal.name.split('.').pop() || proposal.name}"</span> con:
                                    </div>

                                    {editingIdx === idx ? (
                                        <div className="flex gap-2">
                                            <Input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="h-8 text-sm"
                                                autoFocus
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => saveEdit(idx)}>
                                                <Save className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-sm px-2 py-0.5 rounded border ${proposal.value === "[FONTE MANCANTE]"
                                                ? "text-amber-700 bg-amber-50 border-amber-100"
                                                : "text-blue-700 bg-blue-50 border-blue-100"
                                                }`}>
                                                {proposal.type === 'checkbox' ? (proposal.value === 'true' || proposal.value === true ? "Selezionato" : "Deselezionato") : String(proposal.value) || "[Vuoto]"}
                                            </span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100" onClick={() => startEditing(idx)}>
                                                <Edit2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => updateStatus(idx, 'approved')}
                                        className={`w-7 h-7 rounded border flex items-center justify-center transition-all ${proposal.status === 'approved'
                                            ? 'bg-green-600 border-green-600 text-white shadow-sm'
                                            : 'border-blue-200 bg-white hover:border-green-400 text-transparent'
                                            }`}
                                    >
                                        <Check className={`w-4 h-4 ${proposal.status === 'approved' ? 'opacity-100' : 'opacity-0'}`} />
                                    </button>
                                    <button
                                        onClick={() => updateStatus(idx, 'rejected')}
                                        className={`w-7 h-7 rounded border flex items-center justify-center transition-all ${proposal.status === 'rejected'
                                            ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                            : 'border-blue-200 bg-white hover:border-red-400 text-transparent'
                                            }`}
                                    >
                                        <X className={`w-4 h-4 ${proposal.status === 'rejected' ? 'opacity-100' : 'opacity-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

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
                    <Info className="w-2.5 h-2.5 text-blue-600" />
                    <p className="text-[9px] font-medium text-gray-500 uppercase tracking-tighter">
                        I valori approvati verranno inseriti nel modulo PDF originale
                    </p>
                </div>
            </div>
        </Card>
    );
}
