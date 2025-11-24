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
      <div className="border-b px-4 py-2 bg-muted/30">
        <h3 className="text-sm font-medium">Template</h3>
      </div>
      <ScrollArea className="flex-1">
        <Textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-full min-h-[400px] resize-none border-0 rounded-none focus-visible:ring-0 p-4"
          placeholder={placeholder}
          data-testid="textarea-template-editor"
        />
      </ScrollArea>
    </div>
  );
}
