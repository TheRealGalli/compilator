import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface OutputConsoleProps {
  output?: string;
  errors?: string;
  onClear?: () => void;
}

export function OutputConsole({ 
  output = "", 
  errors = "",
  onClear 
}: OutputConsoleProps) {
  return (
    <div className="h-full flex flex-col border rounded-lg bg-muted/30">
      <Tabs defaultValue="console" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <TabsList className="h-8">
            <TabsTrigger value="console" className="text-xs" data-testid="tab-console">Console</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs" data-testid="tab-errors">Errors</TabsTrigger>
          </TabsList>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-7 w-7"
            onClick={onClear}
            data-testid="button-clear-console"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        <TabsContent value="console" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <pre className="p-4 font-mono text-xs" data-testid="text-console-output">
              {output || "No output yet. Run your code to see results."}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="errors" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <pre className="p-4 font-mono text-xs text-destructive" data-testid="text-console-errors">
              {errors || "No errors."}
            </pre>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
