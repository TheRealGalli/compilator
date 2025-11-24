import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TemplateEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

export function TemplateEditor({ 
  value = "", 
  onChange,
  placeholder = "Seleziona un modello o scrivi il tuo template..."
}: TemplateEditorProps) {
  return (
    <div className="h-full flex flex-col border rounded-lg overflow-hidden bg-background">
      <div className="border-b px-2 py-1.5 bg-muted/30 flex-shrink-0">
        <h3 className="text-sm font-medium">Template da Compilare</h3>
      </div>
      <div className="flex-1 overflow-hidden">
        <Textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-full w-full resize-none border-0 rounded-none focus-visible:ring-0 p-2 font-mono text-xs"
          placeholder={placeholder}
          data-testid="textarea-template-editor"
        />
      </div>
    </div>
  );
}
