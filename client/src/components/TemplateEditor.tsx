import { TiptapBubbleMenu as BubbleMenu, useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import { useEffect } from 'react';
import { MentionButton } from './MentionButton';

interface TemplateEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  enableMentions?: boolean;
  onMention?: (text: string) => void;
}

// Helper to escape markdown characters so they appear as literals in Tiptap
const escapeMarkdown = (text: string) => {
  if (!text) return "";
  // Escape *, _, [, ] to prevent them from being parsed as formatting
  // We strictly target characters the user wants to see: ** for bold, [ ] for checkbox
  return text
    .replace(/(\*)/g, '\\$1')
    .replace(/(\[)/g, '\\$1')
    .replace(/(\])/g, '\\$1');
  // Note: We don't escape _ yet unless requested, to minimize noise. 
  // User specifically asked for ** and checkboxes.
};

const unescapeMarkdown = (text: string) => {
  if (!text) return "";
  // Revert the escaping to get back raw markdown
  return text
    .replace(/\\(\*)/g, '$1')
    .replace(/\\(\[)/g, '$1')
    .replace(/\\(\])/g, '$1');
};

export function TemplateEditor({
  value = "",
  onChange,
  placeholder = "Seleziona un template preimpostato o incolla qui il tuo modello...\n\nIstruzioni Formattazione:\n# Titolo\n**Grassetto**\n[ ] Checkbox vuota\n[x] Checkbox selezionata",
  className = "",
  title = "Template da Compilare",
  enableMentions = false,
  onMention
}: TemplateEditorProps) {

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
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
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
      BubbleMenuExtension,
    ],
    content: escapeMarkdown(value), // Initialize with escaped content
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none h-full focus:outline-none p-8 text-sm leading-loose tracking-wide font-normal text-foreground/90 font-mono',
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      // Unescape before sending back to parent
      onChange?.(unescapeMarkdown(markdown));
    },
  });

  // Sync external value changes to editor
  useEffect(() => {
    if (editor) {
      const currentRaw = unescapeMarkdown((editor.storage as any).markdown.getMarkdown());
      if (value !== currentRaw) {
        // Only update if genuinely different to avoid cursor jumps
        // Note: Cursor jumps might still happen if we transform. 
        // Ideally we only update if *remote* change.
        editor.commands.setContent(escapeMarkdown(value));
      }
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
        /* ... existing styles ... */
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
        /* Checkbox / TaskList Styles - Keep purely CSS if needed, but we rely on text [ ] now */
        
        /* Placeholder */
        .ProseMirror p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground));
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* ... styles ... */
        .dark .ProseMirror h1, 
        .dark .ProseMirror h2, 
        .dark .ProseMirror h3,
        .dark .ProseMirror h4 {
            color: hsl(var(--foreground));
        }
        
        .ProseMirror p, 
        .ProseMirror span, 
        .ProseMirror div,
        .ProseMirror li, 
        .ProseMirror td,
        .ProseMirror th {
          color: hsl(var(--foreground)) !important;
          font-size: 13px !important;
          line-height: 2 !important; 
        }
        
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
        {editor && enableMentions && (
          <BubbleMenu
            // @ts-ignore
            editor={editor}
            tippyOptions={{
              duration: 100,
              zIndex: 9999,
              appendTo: () => document.body,
            }}
            shouldShow={({ editor, from, to }) => {
              // Only show if there's a selection and it's not empty
              return from !== to;
            }}
          >
            <MentionButton
              onClick={() => {
                const { from, to } = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, ' ');
                if (text.trim()) {
                  onMention?.(text.trim());
                  // Clear selection after clicking to hide menu
                  editor.chain().focus().run();
                }
              }}
            />
          </BubbleMenu>
        )}
        <EditorContent editor={editor} className="h-full w-full" />
      </div>
    </div>
  );
}
