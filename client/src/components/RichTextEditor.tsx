import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Bold, Italic, Strikethrough, List, ListOrdered } from "lucide-react";

// --- TIPTAP IMPORTS ---
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
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
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder = "What's on your mind?", showToolbar = false, className = "" }) => {
  
  // 🚨 NEW: Smart initialization logic to protect legacy spacing
  const processInitialValue = (val: string) => {
    if (!val) return "";
    // If it is already HTML (from Tiptap), leave it alone.
    if (/<[a-z][\s\S]*>/i.test(val)) return val;
    // If it is legacy plain text, convert \n to <br> so the editor respects lines!
    return val.replace(/\n/g, '<br>');
  };

  const editor = useEditor({
    content: processInitialValue(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.isEmpty);
    },
    extensions: [
      StarterKit,
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
      // 🚨 NEW: Auto-detect @mentions and #hashtags when pasting from other apps!
      transformPastedHTML(html) {
        return html
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

  return (
    <div className="flex-1 flex flex-col h-full w-full">
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
        `}
      </style>
      
      {showToolbar && (
        <div className="flex items-center gap-1 border-b border-gray-100 p-2 bg-slate-50/50 rounded-t-2xl shrink-0">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Bold className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Italic className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Strikethrough className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-gray-200 mx-1"></div>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-100'}`}><List className="w-4 h-4" /></button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-brand-orange text-white' : 'text-gray-500 hover:bg-gray-100'}`}><ListOrdered className="w-4 h-4" /></button>
        </div>
      )}
      
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
};

export default RichTextEditor;