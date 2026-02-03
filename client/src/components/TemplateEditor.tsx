import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
// TaskList and TaskItem imports removed
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface TemplateEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
}

export function TemplateEditor({
  value = "",
  onChange,
  placeholder = "Seleziona un template preimpostato o incolla qui il tuo modello...\n\nIstruzioni Formattazione:\n# Titolo\n**Grassetto**\n[ ] Checkbox vuota\n[x] Checkbox selezionata",
  className = "",
  title = "Template da Compilare"
}: TemplateEditorProps) {

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Show # Title as text
        bold: false,    // Show **text** as text
        italic: false,  // Show *text* as text
        strike: false,  // Show ~~text~~ as text
        code: false,    // Show `code` as text
        blockquote: false, // Show > quote as text
        bulletList: false, // Show - item as text
        orderedList: false, // Show 1. item as text
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      // TaskList and TaskItem removed to show raw [ ] checkboxes
      Markdown.configure({
        html: false, // Force markdown output
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none h-full focus:outline-none p-8 text-sm leading-loose tracking-wide font-normal text-foreground/90 font-mono',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onChange?.(markdown);
    },
  });

  // Sync external value changes to editor (e.g. when template is selected)
  useEffect(() => {
    if (editor && value !== (editor.storage as any).markdown.getMarkdown()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div className={`h-full flex flex-col border rounded-lg overflow-hidden bg-background ${className}`}>
      <style>{`
        .ProseMirror {
          height: 100%;
          overflow-y: auto;
        }
        /* Table Styles */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .ProseMirror td,
        .ProseMirror th {
          min-width: 1em;
          border: 1px solid hsl(var(--border)); 
          padding: 3px 5px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror th {
          font-weight: bold;
          text-align: left;
          background-color: hsl(var(--muted));
        }
        .ProseMirror .selectedCell:after {
          z-index: 2;
          position: absolute;
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          background: rgba(200, 200, 255, 0.4);
          pointer-events: none;
        }
        /* Checkbox / TaskList Styles */
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .ProseMirror li[data-type="taskItem"] {
          display: flex;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        .ProseMirror li[data-type="taskItem"] > label {
          margin-right: 0.5rem;
          user-select: none;
          margin-top: 0.35rem; /* Align checkbox with text */
        }
        
        /* Placeholder */
        .ProseMirror p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* Dark Mode Specific Overrides if prose-invert isn't enough */
        .dark .ProseMirror h1, 
        .dark .ProseMirror h2, 
        .dark .ProseMirror h3,
        .dark .ProseMirror h4 {
            color: hsl(var(--foreground));
        }
        
        /* Force Text Color & Size (Aggressive Override) */
        .ProseMirror p, 
        .ProseMirror span, 
        .ProseMirror div,
        .ProseMirror li, 
        .ProseMirror td,
        .ProseMirror th {
          color: hsl(var(--foreground)) !important;
          font-size: 13px !important; /* Smaller than text-sm */
          line-height: 2 !important; 
        }
        
        /* Dark Mode Specific - Force White Titles & Links */
        .dark .ProseMirror h1, 
        .dark .ProseMirror h2, 
        .dark .ProseMirror h3,
        .dark .ProseMirror h4,
        .dark .ProseMirror h5,
        .dark .ProseMirror h6,
        .dark .ProseMirror a,
        .dark .ProseMirror strong {
            color: #ffffff !important;
        }
      `}</style>
      <div className="border-b px-2 py-1.5 bg-muted/30 flex-shrink-0 flex justify-between items-center">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <EditorContent editor={editor} className="h-full w-full" />
      </div>
    </div>
  );
}
