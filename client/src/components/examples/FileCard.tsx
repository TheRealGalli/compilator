import { FileCard } from "../FileCard";

export default function FileCardExample() {
  return (
    <div className="p-8 space-y-4">
      <FileCard 
        name="research-paper.pdf" 
        size="2.4 MB"
        onRemove={() => console.log("Remove clicked")}
      />
      <FileCard 
        name="meeting-notes.txt" 
        size="48 KB"
        onRemove={() => console.log("Remove clicked")}
      />
    </div>
  );
}
