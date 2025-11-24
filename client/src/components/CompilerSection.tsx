import { Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeEditor } from "./CodeEditor";
import { OutputConsole } from "./OutputConsole";
import { useState } from "react";

export function CompilerSection() {
  const [language, setLanguage] = useState<"javascript" | "python">("javascript");
  const [code, setCode] = useState(`// JavaScript Example\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(\`fibonacci(\${i}) = \${fibonacci(i)}\`);\n}`);
  const [output, setOutput] = useState("");
  const [errors, setErrors] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setOutput("");
    setErrors("");

    try {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => {
        logs.push(args.join(" "));
      };

      if (language === "javascript") {
        eval(code);
      }

      console.log = originalLog;
      setOutput(logs.join("\n"));
    } catch (error) {
      setErrors(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setOutput("");
    setErrors("");
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Code Compiler</h2>
          <Select value={language} onValueChange={(v) => setLanguage(v as "javascript" | "python")}>
            <SelectTrigger className="w-[160px]" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            data-testid="button-download-code"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button 
            onClick={handleRun}
            disabled={isRunning}
            data-testid="button-run-code"
          >
            <Play className="w-4 h-4 mr-2" />
            {isRunning ? "Running..." : "Run Code"}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">
        <div className="lg:col-span-3 min-h-0">
          <CodeEditor 
            value={code}
            onChange={setCode}
            language={language}
          />
        </div>
        <div className="lg:col-span-2 min-h-0">
          <OutputConsole 
            output={output}
            errors={errors}
            onClear={handleClear}
          />
        </div>
      </div>
    </div>
  );
}
