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
        <Card className="flex flex-col h-full border-blue-200 bg-blue-50/30">
            <div className="p-4 border-b flex items-center justify-between bg-muted/30">
                <div>
                    <h3 className="font-semibold text-blue-900">{title}</h3>
                    <p className="text-xs text-blue-700">Controlla e approva i dati proposti dall'intelligenza documentale.</p>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                    {proposals.filter(p => p.status === 'approved').length} / {proposals.length} Approvati
                </Badge>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
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

                                    <div className="text-sm text-gray-700 leading-relaxed">
                                        Compilazione del campo <span className="font-mono font-bold text-gray-900">"{proposal.name}"</span> con:
                                    </div>

                                    {editingIdx === idx ? (
                                        <div className="flex gap-2 mt-1">
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
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                {proposal.type === 'checkbox' ? (proposal.value ? "Selezionato" : "Deselezionato") : String(proposal.value) || "[Vuoto]"}
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

            <div className="p-4 bg-white border-t border-blue-100">
                <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    onClick={onFinalize}
                    disabled={isFinalizing || proposals.length === 0}
                >
                    {isFinalizing ? "Generazione PDF..." : "Finalizza Compilazione"}
                </Button>
                <p className="text-[10px] text-center text-gray-400 mt-2 italic">
                    I valori approvati verranno inseriti nei campi originali del modulo PDF.
                </p>
            </div>
        </Card>
    );
}
