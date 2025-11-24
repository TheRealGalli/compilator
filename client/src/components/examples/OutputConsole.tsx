import { OutputConsole } from "../OutputConsole";

export default function OutputConsoleExample() {
  return (
    <div className="h-[300px] p-8">
      <OutputConsole 
        output="Hello, World!\nCode executed successfully.\nResult: 42"
        errors=""
        onClear={() => console.log("Clear console")}
      />
    </div>
  );
}
