import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TiptapBubbleMenu as BubbleMenu, useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import { useEffect } from 'react';
import { MentionButton } from './MentionButton';

interface CompiledOutputProps {
  content: string;
  onCopy: () => void;
  onDownload: () => void;
  readOnly?: boolean;
  enableMentions?: boolean;
  onMention?: (text: string) => void;
}

// Helper to escape markdown characters so they appear as literals in Tiptap
const escapeMarkdown = (text: string) => {
  if (!text) return "";
  return text
    .replace(/(\*)/g, '\\$1')
    .replace(/(\[)/g, '\\$1')
    .replace(/(\])/g, '\\$1');
};

export function CompiledOutput({
  content,
  onCopy,
  onDownload,
  readOnly = false,
  enableMentions = false,
  onMention
}: CompiledOutputProps) {

  const editor = useEditor({
    editable: false,
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
      }),
      BubbleMenuExtension,
    ],
    content: escapeMarkdown(content),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none h-full focus:outline-none text-sm leading-loose tracking-wide font-normal text-foreground/90 font-mono',
      },
    },
  });

  // Sync content updates
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      // Only update if content is actually different to avoid cursor jumps/re-renders
      if (currentMarkdown !== content) {
        editor.commands.setContent(escapeMarkdown(content));
      }
    }
  }, [content, editor]);

  return (
    <Card className="h-full flex flex-col min-h-0">
      <CardHeader className="flex-shrink-0 pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documento Compilato</CardTitle>
          <div className="flex gap-2">
            {!readOnly && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onCopy}
                  disabled={!content}
                  data-testid="button-copy-compiled"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDownload}
                  disabled={!content}
                  data-testid="button-download-compiled"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden relative p-0">
        <div className="h-full w-full overflow-y-auto p-6 scrollbar-thin">
          {content ? (
            <div className="text-sm h-full" data-testid="text-compiled-output">
              {editor && enableMentions && (
                <BubbleMenu
                  // @ts-ignore
                  editor={editor}
                  tippyOptions={{
                    duration: 100,
                    zIndex: 9999,
                    appendTo: () => document.body,
                    placement: 'top',
                    offset: [0, 10],
                  }}
                  shouldShow={({ editor, from, to }) => {
                    return from !== to;
                  }}
                >
                  <MentionButton
                    onClick={() => {
                      const { from, to } = editor.state.selection;
                      const text = editor.state.doc.textBetween(from, to, ' ');
                      if (text.trim()) {
                        onMention?.(text.trim());
                        editor.chain().focus().run();
                      }
                    }}
                  />
                </BubbleMenu>
              )}
              <EditorContent editor={editor} className="h-full w-full" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium">Il Compilatore AI trasforma template in documenti completi.</p>
              <p>Seleziona un template preimpostato o carica il tuo, aggiungi documenti di contesto (visure, contratti, foto), e l'AI compilerà automaticamente tutti i placeholder con le informazioni estratte dai tuoi file.</p>
              <p className="text-xs">Perfetto per: contratti, relazioni tecniche, privacy policy, documenti legali.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
