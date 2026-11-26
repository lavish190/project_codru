import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  List, ListOrdered, Heading1, Heading2, Heading3, 
  Link as LinkIcon, Unlink, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Minus, Image as ImageIcon, Table as TableIcon,
  Plus, Trash2, Undo, Redo, Loader2
} from "lucide-react";

// --- TIPTAP v3 IMPORTS ---
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

// ==========================================
// CLOUDINARY UPLOAD HELPER FOR INLINE IMAGES
// ==========================================
const uploadInlineImageToCloudinary = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "cute_profiles");
  formData.append("cloud_name", "da6jhcsmm");

  const res = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload inline image");
  const data = await res.json();
  return data.secure_url;
};

// ==========================================
// 1. FLOATING UI COMPONENTS
// ==========================================
const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command({ id: item.username, label: item.name });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') { setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length); return true; }
      if (event.key === 'ArrowDown') { setSelectedIndex((selectedIndex + 1) % props.items.length); return true; }
      if (event.key === 'Enter') { selectItem(selectedIndex); return true; }
      return false;
    },
  }));

  useEffect(() => setSelectedIndex(0), [props.items]);

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden w-64 z-[9999]">
      {props.items.length > 0 ? props.items.map((item: any, index: number) => (
        <button type="button" key={item._id} onClick={() => selectItem(index)} className={`w-full text-left flex items-center gap-3 px-4 py-2 transition-colors ${index === selectedIndex ? 'bg-orange-50' : 'bg-transparent hover:bg-gray-50'}`}>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 shrink-0">
            {item.photo ? <img src={item.photo} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-blue text-white flex items-center justify-center text-xs font-bold">{item.name?.charAt(0) || "U"}</div>}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold truncate ${index === selectedIndex ? 'text-brand-orange' : 'text-gray-800'}`}>{item.name}</p>
            <p className="text-[10px] text-gray-500 truncate">@{item.username}</p>
          </div>
        </button>
      )) : <div className="px-4 py-3 text-sm text-gray-500 text-center">No users found</div>}
    </div>
  );
});

const HashtagExtension = Mention.extend({ name: 'hashtag' });
const HashtagList = forwardRef((props: any, ref) => {
  const selectItem = () => { if (props.items[0]) props.command({ id: props.items[0].id, label: props.items[0].label }); };
  useImperativeHandle(ref, () => ({ onKeyDown: ({ event }: any) => { if (event.key === 'Enter' || event.key === ' ') { selectItem(); return true; } return false; } }));
  if (!props.items.length) return null;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-[9999]">
      <button type="button" className="w-full text-left px-4 py-2 bg-blue-50 text-brand-blue font-bold hover:bg-blue-100 transition-colors" onClick={selectItem}>
        Add #{props.items[0].label}
      </button>
    </div>
  );
});

// ==========================================
// 2. MAIN EDITOR COMPONENT
// ==========================================
interface RichTextEditorProps {
  value: string;
  onChange: (html: string, isEmpty: boolean) => void;
  placeholder?: string;
  showToolbar?: boolean;
  className?: string; 
  allowHeadings?: boolean; 
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = "What's on your mind?", 
  showToolbar = false, 
  className = "",
  allowHeadings = false 
}) => {
  const [, setForceRender] = useState(0);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);

  const processInitialValue = (val: string) => {
    if (!val) return "";
    if (/<[a-z][\s\S]*>/i.test(val)) return val;
    return val.replace(/\n/g, '<br>');
  };

  const editor = useEditor({
    content: processInitialValue(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.isEmpty);
    },
    onSelectionUpdate: () => setForceRender(prev => prev + 1),
    onTransaction: () => setForceRender(prev => prev + 1),
      extensions: [
      StarterKit.configure({
        heading: allowHeadings ? { levels: [1, 2, 3] } : false,
        underline: allowHeadings ? undefined : false,
        blockquote: allowHeadings ? undefined : false,
        codeBlock: allowHeadings ? undefined : false,
        horizontalRule: allowHeadings ? undefined : false,
        link: {
          openOnClick: false,
          HTMLAttributes: { class: 'text-brand-blue underline cursor-pointer' },
        },
      }),
      Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' }),
      ...(allowHeadings ? [
        Highlight.configure({ multicolor: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Image.configure({
          inline: false,
          allowBase64: false,
          HTMLAttributes: { class: 'rounded-2xl max-w-full h-auto my-6 mx-auto shadow-md border border-gray-100' },
        }),
        TableKit.configure({
          table: { resizable: true },
        }),
      ] : []),

      Mention.configure({
        HTMLAttributes: { class: 'text-brand-orange font-bold bg-orange-50 px-1 rounded-md cursor-pointer' },
        suggestion: {
          items: async ({ query }) => {
            if (!query) return [];
            const token = localStorage.getItem("jwtoken");
            try {
              const res = await fetch(`${import.meta.env.VITE_API}search-users?q=${query}`, { headers: { "Authorization": `Bearer ${token}` } });
              if (!res.ok) return [];
              return (await res.json()).slice(0, 5);
            } catch (e) { return []; }
          },
          render: () => {
            let component: ReactRenderer;
            let popup: any;
            return {
              onStart: props => {
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                if (!props.clientRect) return;
                popup = tippy('body', { getReferenceClientRect: props.clientRect as any, appendTo: () => document.body, content: component.element, showOnCreate: true, interactive: true, trigger: 'manual', placement: 'bottom-start' });
              },
              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect as any });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') { popup[0].hide(); return true; }
                return (component.ref as any)?.onKeyDown(props);
              },
              onExit() { popup[0].destroy(); component.destroy(); },
            };
          },
        },
      }),
      HashtagExtension.configure({
        HTMLAttributes: { class: 'text-brand-blue font-bold bg-blue-50 px-1 rounded-md cursor-pointer' },
        suggestion: {
          char: '#',
          items: ({ query }) => query ? [{ id: query, label: query }] : [],
          render: () => {
            let component: ReactRenderer;
            let popup: any;
            return {
              onStart: props => {
                component = new ReactRenderer(HashtagList, { props, editor: props.editor });
                if (!props.clientRect) return;
                popup = tippy('body', { getReferenceClientRect: props.clientRect as any, appendTo: () => document.body, content: component.element, showOnCreate: true, interactive: true, trigger: 'manual', placement: 'bottom-start' });
              },
              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect as any });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') { popup[0].hide(); return true; }
                return (component.ref as any)?.onKeyDown(props);
              },
              onExit() { if (popup) popup[0].destroy(); if (component) component.destroy(); },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: `focus:outline-none w-full p-4 text-slate-700 custom-scrollbar ${className}`,
      },
      transformPastedHTML(html) {
        return html
          .replace(/<p[^>]*>(\s|&nbsp;|<br>)*<\/p>/gi, '')
          .replace(/(^|\s)@([\w.]+)(?![^<]*>)/g, '$1<span data-type="mention" data-id="$2">@$2</span>')
          .replace(/(^|\s)#([\w.]+)(?![^<]*>)/g, '$1<span data-type="hashtag" data-id="$2">#$2</span>');
      },
      handlePaste(view, event) {
        if (!allowHeadings) return false;
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.startsWith("image/"));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();
        setIsUploadingInlineImage(true);
        uploadInlineImageToCloudinary(file)
          .then(url => {
            const { schema } = view.state;
            const node = schema.nodes.image.create({ src: url });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
          })
          .catch(err => console.error("Inline paste upload failed:", err))
          .finally(() => setIsUploadingInlineImage(false));
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (!allowHeadings || moved) return false;
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;

        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        setIsUploadingInlineImage(true);
        uploadInlineImageToCloudinary(file)
          .then(url => {
            const { schema } = view.state;
            const node = schema.nodes.image.create({ src: url });
            const pos = coords ? coords.pos : view.state.selection.from;
            view.dispatch(view.state.tr.insert(pos, node));
          })
          .catch(err => console.error("Inline drop upload failed:", err))
          .finally(() => setIsUploadingInlineImage(false));
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return; 

    const processed = processInitialValue(value);
    if (processed !== editor.getHTML() && value !== editor.getHTML()) {
      editor.commands.setContent(processed, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const alt = window.prompt("Optional image alt text (good for SEO):", "") || "";
    setIsUploadingInlineImage(true);
    try {
      const url = await uploadInlineImageToCloudinary(file);
      editor.chain().focus().setImage({ src: url, alt }).run();
    } catch (err) {
      console.error("Failed to upload inline image:", err);
      window.alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploadingInlineImage(false);
      if (inlineImageInputRef.current) inlineImageInputRef.current.value = "";
    }
  };

  const btnClass = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${active ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`;

  return (
    <div className="flex-1 flex flex-col h-full w-full relative">
      <style>
        {`
          .tippy-box { background: transparent !important; }
          .tippy-content { padding: 0 !important; }
          .tippy-arrow { display: none !important; }
          .is-editor-empty:first-child::before { color: #94a3b8; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
          .ProseMirror p { margin-bottom: 0.5rem; min-height: 1.25rem; }
          .ProseMirror p:last-child { margin-bottom: 0; }
          .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .ProseMirror h1 { font-size: 2.25rem; font-weight: 900; line-height: 1.2; margin-bottom: 1rem; margin-top: 1.5rem; color: #111827; }
          .ProseMirror h2 { font-size: 1.875rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.875rem; margin-top: 1.5rem; color: #1f2937; }
          .ProseMirror h3 { font-size: 1.5rem; font-weight: 700; line-height: 1.4; margin-bottom: 0.75rem; margin-top: 1.25rem; color: #374151; }
          .ProseMirror blockquote { border-left: 4px solid #ed7f23; background: #fff7ed; padding: 0.75rem 1rem; margin: 1rem 0; border-radius: 0 0.75rem 0.75rem 0; font-style: italic; color: #374151; }
          .ProseMirror pre { background: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; margin: 1rem 0; font-family: monospace; font-size: 0.9rem; }
          .ProseMirror hr { border: none; border-top: 2px solid #e2e8f0; margin: 1.75rem 0; }
          .ProseMirror mark { background-color: #fef08a; padding: 0.1rem 0.25rem; border-radius: 0.25rem; }
          .ProseMirror img { max-width: 100%; height: auto; border-radius: 1rem; margin: 1.5rem auto; display: block; }
          .ProseMirror img.ProseMirror-selectednode { outline: 3px solid #ed7f23; }
          /* TABLE STYLES */
          .ProseMirror .tableWrapper { overflow-x: auto; margin: 1.5rem 0; }
          .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; overflow: hidden; border-radius: 0.75rem; }
          .ProseMirror td, .ProseMirror th { min-width: 1em; border: 1px solid #cbd5e1; padding: 0.65rem 0.85rem; vertical-align: top; box-sizing: border-box; position: relative; }
          .ProseMirror th { font-weight: 700; text-align: left; background-color: #f8fafc; color: #1e293b; }
          .ProseMirror .selectedCell:after { z-index: 2; position: absolute; content: ""; left: 0; right: 0; top: 0; bottom: 0; background: rgba(23, 101, 164, 0.12); pointer-events: none; }
          .ProseMirror .column-resize-handle { position: absolute; right: -2px; top: 0; bottom: -2px; width: 4px; background-color: #1765a4; pointer-events: none; }
        `}
      </style>
      
      {showToolbar && (
        <div className="sticky top-0 z-[50] flex flex-col border-b border-gray-100 bg-slate-50/95 backdrop-blur-md rounded-t-2xl shadow-sm shrink-0">
          {/* PRIMARY TOOLBAR */}
          <div className="flex flex-wrap items-center gap-1 p-2">
            <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30" title="Undo"><Undo className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30" title="Redo"><Redo className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-gray-300 mx-1"></div>

            {allowHeadings && (
              <>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title="Heading 1"><Heading1 className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Heading 2"><Heading2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="Heading 3"><Heading3 className="w-4 h-4" /></button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
              </>
            )}

            <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Bold"><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Italic"><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title="Underline"><UnderlineIcon className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
            {allowHeadings && (
              <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={btnClass(editor.isActive('highlight'))} title="Highlight"><Highlighter className="w-4 h-4" /></button>
            )}

            <div className="w-px h-5 bg-gray-300 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Bullet List"><List className="w-4 h-4" /></button>
            <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Numbered List"><ListOrdered className="w-4 h-4" /></button>

            {allowHeadings && (
              <>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Align Left"><AlignLeft className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Align Center"><AlignCenter className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Align Right"><AlignRight className="w-4 h-4" /></button>

                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Quote"><Quote className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} title="Code Block"><Code className="w-4 h-4" /></button>
                <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-2 rounded-lg text-gray-500 hover:bg-gray-200" title="Insert Divider"><Minus className="w-4 h-4" /></button>

                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={setLink} className={btnClass(editor.isActive('link'))} title="Add Link"><LinkIcon className="w-4 h-4" /></button>
                {editor.isActive('link') && (
                  <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} className="p-2 rounded-lg transition-colors text-red-500 hover:bg-red-50" title="Remove Link"><Unlink className="w-4 h-4" /></button>
                )}

                {/* INLINE IMAGE UPLOAD */}
                <button 
                  type="button" 
                  disabled={isUploadingInlineImage}
                  onClick={() => inlineImageInputRef.current?.click()} 
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-50" 
                  title="Insert Inline Image"
                >
                  {isUploadingInlineImage ? <Loader2 className="w-4 h-4 animate-spin text-brand-orange" /> : <ImageIcon className="w-4 h-4" />}
                </button>
                <input ref={inlineImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleInlineImageUpload} />

                {/* INSERT TABLE */}
                <button 
                  type="button" 
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} 
                  className={btnClass(editor.isActive('table'))} 
                  title="Insert 3x3 Table"
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* CONTEXTUAL TABLE CONTROLS */}
          {allowHeadings && editor.isActive('table') && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-blue-50/80 border-t border-blue-100 text-xs font-bold text-slate-700 animate-in fade-in duration-150">
              <span className="text-[10px] uppercase tracking-wider text-brand-blue mr-1">Table:</span>
              <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-1 bg-white hover:bg-blue-100 rounded-md border border-blue-200 flex items-center gap-1"><Plus className="w-3 h-3"/> Col Left</button>
              <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 bg-white hover:bg-blue-100 rounded-md border border-blue-200 flex items-center gap-1"><Plus className="w-3 h-3"/> Col Right</button>
              <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 rounded-md border border-red-200">Del Col</button>
              <div className="w-px h-4 bg-blue-200 mx-0.5"></div>
              <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-1 bg-white hover:bg-blue-100 rounded-md border border-blue-200 flex items-center gap-1"><Plus className="w-3 h-3"/> Row Above</button>
              <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 bg-white hover:bg-blue-100 rounded-md border border-blue-200 flex items-center gap-1"><Plus className="w-3 h-3"/> Row Below</button>
              <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1 bg-white hover:bg-red-50 text-red-600 rounded-md border border-red-200">Del Row</button>
              <div className="w-px h-4 bg-blue-200 mx-0.5"></div>
              <button type="button" onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="px-2 py-1 bg-white hover:bg-blue-100 rounded-md border border-blue-200">Toggle Header</button>
              <button type="button" onClick={() => editor.chain().focus().mergeOrSplit().run()} className="px-2 py-1 bg-white hover:bg-blue-100 rounded-md border border-blue-200">Merge/Split</button>
              <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="ml-auto px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md border border-red-200 flex items-center gap-1"><Trash2 className="w-3 h-3"/> Delete Table</button>
            </div>
          )}
        </div>
      )}
      
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
};

export default RichTextEditor;
