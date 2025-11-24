import { CodeEditor } from "../CodeEditor";

export default function CodeEditorExample() {
  return (
    <div className="h-[500px] p-8">
      <CodeEditor 
        value="// Example code\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('World'));"
        onChange={(value) => console.log("Code changed:", value)}
      />
    </div>
  );
}
