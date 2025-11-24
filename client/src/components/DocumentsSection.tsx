import { FileUploadZone } from "./FileUploadZone";
import { FileCard } from "./FileCard";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useState } from "react";

interface Document {
  id: string;
  name: string;
  size: string;
}

export function DocumentsSection() {
  const [documents, setDocuments] = useState<Document[]>([]);

  const handleFilesSelected = (files: FileList) => {
    const newDocs: Document[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    }));
    setDocuments([...documents, ...newDocs]);
  };

  const handleRemove = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Documents</h2>
        {documents.length > 0 && (
          <Button data-testid="button-analyze-documents">
            <Sparkles className="w-4 h-4 mr-2" />
            Analyze Documents
          </Button>
        )}
      </div>

      <div className="mb-6">
        <FileUploadZone onFilesSelected={handleFilesSelected} />
      </div>

      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Uploaded Files ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <FileCard
                key={doc.id}
                name={doc.name}
                size={doc.size}
                onRemove={() => handleRemove(doc.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
