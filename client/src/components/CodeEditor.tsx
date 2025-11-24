import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: "javascript" | "python";
}

export function CodeEditor({ 
  value = "", 
  onChange,
  language = "javascript" 
}: CodeEditorProps) {
  const [code, setCode] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setCode(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="h-full flex flex-col border rounded-lg overflow-hidden">
      <div className="flex-1 relative">
        <Textarea
          value={code}
          onChange={handleChange}
          className="h-full font-mono text-sm resize-none border-0 rounded-none focus-visible:ring-0"
          placeholder={`// Write your ${language} code here...\nconsole.log("Hello, world!");`}
          data-testid="textarea-code-editor"
        />
      </div>
    </div>
  );
}
