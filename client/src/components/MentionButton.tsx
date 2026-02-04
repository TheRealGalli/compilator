import { MessageSquare } from "lucide-react";
import { Button } from "./ui/button";

interface MentionButtonProps {
    onClick: () => void;
}

export function MentionButton({ onClick }: MentionButtonProps) {
    return (
        <div className="flex items-center bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl p-0.5 animate-in fade-in zoom-in duration-200">
            <Button
                variant="ghost"
                size="sm"
                className="h-7 px-3 text-slate-300 hover:text-white hover:bg-white/10 text-[11px] font-medium border-0 rounded-md flex items-center gap-1.5"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClick();
                }}
            >
                <MessageSquare className="w-3 h-3 opacity-70" />
                Chat
                <span className="text-[9px] opacity-40 font-mono ml-1">⌘L</span>
            </Button>
        </div>
    );
}
