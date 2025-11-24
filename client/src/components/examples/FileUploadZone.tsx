import { FileUploadZone } from "../FileUploadZone";

export default function FileUploadZoneExample() {
  return (
    <div className="p-8">
      <FileUploadZone 
        onFilesSelected={(files) => {
          console.log(`Selected ${files.length} file(s)`);
        }}
      />
    </div>
  );
}
