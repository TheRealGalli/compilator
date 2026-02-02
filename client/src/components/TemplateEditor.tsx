import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
}

export function TemplateEditor({
  value = "",
  onChange,
  placeholder = "Seleziona un modello o scrivi il tuo template...",
  className = "",
  title = "Template da Compilare"
}: TemplateEditorProps) {
  // Split content into blocks based on double newlines
  // If value is empty, start with one empty block
  const blocks = value ? value.split('\n\n') : [""];

  const handleBlockChange = (index: number, newValue: string) => {
    const newBlocks = [...blocks];
    newBlocks[index] = newValue;
    onChange?.(newBlocks.join('\n\n'));
  };

  const addBlock = () => {
    onChange?.(value + (value ? "\n\n" : "") + "");
  };

  const removeBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    onChange?.(newBlocks.join('\n\n'));
  }

  return (
    <div className={`h-full flex flex-col border rounded-lg overflow-hidden bg-background ${className}`}>
      <div className="border-b px-4 py-2 bg-muted/30 flex-shrink-0 flex justify-between items-center">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{blocks.length} Paragrafi</span>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {blocks.map((block, index) => (
              <div key={index} className="group relative">
                <Textarea
                  value={block}
                  onChange={(e) => handleBlockChange(index, e.target.value)}
                  className="w-full resize-none border rounded-md focus-visible:ring-1 p-4 text-base leading-relaxed tracking-wide font-normal text-foreground/90 min-h-[100px] bg-card hover:bg-accent/5 transition-colors"
                  placeholder={`Paragrafo ${index + 1}...`}
                  data-testid={`textarea-block-${index}`}
                />
                {blocks.length > 1 && (
                  <button
                    onClick={() => removeBlock(index)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    title="Rimuovi paragrafo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addBlock}
              className="w-full py-3 border-2 border-dashed rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-accent/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              Aggiungi Paragrafo
            </button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
