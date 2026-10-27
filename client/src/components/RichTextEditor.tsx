import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3, Link as LinkIcon, Unlink } from "lucide-react";

// --- TIPTAP IMPORTS ---
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

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
        <button key={item._id} onClick={() => selectItem(index)} className={`w-full text-left flex items-center gap-3 px-4 py-2 transition-colors ${index === selectedIndex ? 'bg-orange-50' : 'bg-transparent hover:bg-gray-50'}`}>
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
      <button className="w-full text-left px-4 py-2 bg-blue-50 text-brand-blue font-bold hover:bg-blue-100 transition-colors" onClick={selectItem}>
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
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-brand-blue underline cursor-pointer' } }),
      Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' }),
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
                popup = tippy('body', { getReferenceClientRect: props.clientRect, appendTo: () => document.body, content: component.element, showOnCreate: true, interactive: true, trigger: 'manual', placement: 'bottom-start' });
              },
              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
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
                popup = tippy('body', { getReferenceClientRect: props.clientRect, appendTo: () => document.body, content: component.element, showOnCreate: true, interactive: true, trigger: 'manual', placement: 'bottom-start' });
              },
              onUpdate(props) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
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
          // 🚨 Fix Google Docs double spacing: strips empty paragraphs completely
          .replace(/<p[^>]*>(\s|&nbsp;|<br>)*<\/p>/gi, '')
          // Preserve mentions and hashtags
          .replace(/(^|\s)@([\w.]+)/g, '$1<span data-type="mention" data-id="$2">@$2</span>')
          .replace(/(^|\s)#([\w.]+)/g, '$1<span data-type="hashtag" data-id="$2">#$2</span>');
      }
    },
  });

  useEffect(() => {
    if (editor) {
      const processed = processInitialValue(value);
      if (processed !== editor.getHTML() && value !== editor.getHTML()) {
        editor.commands.setContent(processed);
      }
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
          .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; }
          .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; }
          .ProseMirror h1 { font-size: 2.25rem; font-weight: 900; line-height: 1.2; margin-bottom: 1rem; margin-top: 1.5rem; color: #111827; }
          .ProseMirror h2 { font-size: 1.875rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.875rem; margin-top: 1.5rem; color: #1f2937; }
          .ProseMirror h3 { font-size: 1.5rem; font-weight: 700; line-height: 1.4; margin-bottom: 0.75rem; margin-top: 1.25rem; color: #374151; }
        `}
      </style>
      
      {showToolbar && (
        <div className="sticky top-0 z-[50] flex flex-wrap items-center gap-1 border-b border-gray-100 p-2 bg-slate-50/95 backdrop-blur-md rounded-t-2xl shadow-sm shrink-0">
          
          {allowHeadings && (
            <>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`} title="Heading 1"><Heading1 className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`} title="Heading 2"><Heading2 className="w-4 h-4" /></button>
              <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`} title="Heading 3"><Heading3 className="w-4 h-4" /></button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
            </>
          )}

          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`}><Bold className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`}><Italic className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`}><Strikethrough className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-300 mx-1"></div>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`}><List className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`}><ListOrdered className="w-4 h-4" /></button>

          {allowHeadings && (
            <>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button onClick={setLink} className={`p-2 rounded-lg transition-colors ${editor.isActive('link') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-200'}`} title="Add Link"><LinkIcon className="w-4 h-4" /></button>
              {editor.isActive('link') && (
                <button onClick={() => editor.chain().focus().unsetLink().run()} className="p-2 rounded-lg transition-colors text-red-500 hover:bg-red-50" title="Remove Link"><Unlink className="w-4 h-4" /></button>
              )}
            </>
          )}
        </div>
      )}
      
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
};

export default RichTextEditor;