import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, X, Loader2, Send, FileText, AlertCircle, Eye, Settings2, AlignLeft, AlignCenter, AlignRight, Link2, Upload, Maximize, Minimize, ArrowLeft } from "lucide-react";
import Muialert from "./Muialert";
import RichTextEditor from "./RichTextEditor";
import { UserData } from "../App";

interface CreateBlogProps {
  userData: UserData;
  editBlogData?: any; 
  onEditComplete?: () => void; 
}

const CreateBlog = ({ userData, editBlogData, onEditComplete }: CreateBlogProps) => {
  const navigate = useNavigate();
  const isEditMode = !!editBlogData;
  
  // Form States
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("Academics");
  const [authorName, setAuthorName] = useState(userData?.Name || "");
  const [content, setContent] = useState("");
  const [isContentEmpty, setIsContentEmpty] = useState(true);
  
  // Image States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🚨 CTA DESIGNER STATES
  const [cta, setCta] = useState({
    enabled: false,
    text: "Learn More",
    link: "",
    color: "bg-brand-orange",
    size: "py-3 px-8 text-base",
    alignment: "justify-center",
    width: "w-auto",
    radius: "rounded-full",
    iconUrl: "",
    textColor: "text-white",
    newIconFile: null as File | null
  });
  
  // UI States
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });

  useEffect(() => {
    if (isEditMode && editBlogData) {
      setTitle(editBlogData.title || "");
      setSummary(editBlogData.summary || "");
      setCategory(editBlogData.category || "Academics");
      setContent(editBlogData.content || "");
      setIsContentEmpty(!editBlogData.content);
      setAuthorName(editBlogData.authorName || "");
      setImagePreview(editBlogData.coverImage || null);
      
      if (editBlogData.cta) {
        setCta({
          enabled: editBlogData.cta.enabled || false,
          text: editBlogData.cta.text || "Learn More",
          link: editBlogData.cta.link || "",
          color: editBlogData.cta.color || "bg-brand-orange",
          textColor: editBlogData.cta.textColor || "text-white",
          size: editBlogData.cta.size || "py-3 px-8 text-base",
          alignment: editBlogData.cta.alignment || "justify-center",
          width: editBlogData.cta.width || "w-auto",
          radius: editBlogData.cta.radius || "rounded-full",
          iconUrl: editBlogData.cta.iconUrl || "",
          newIconFile: null
        });
      }
    } else {
      const savedDraft = localStorage.getItem("marketing_blog_draft");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.title) setTitle(parsed.title);
          if (parsed.summary) setSummary(parsed.summary);
          if (parsed.category) setCategory(parsed.category);
          if (parsed.content) { setContent(parsed.content); setIsContentEmpty(false); }
          if (parsed.authorName) setAuthorName(parsed.authorName);
          if (parsed.imagePreview) setImagePreview(parsed.imagePreview);
          if (parsed.cta) setCta(parsed.cta);
        } catch (e) { console.error("Failed to load blog draft", e); }
      }
    }
  }, [isEditMode, editBlogData]);

  useEffect(() => {
    if (isEditMode) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("marketing_blog_draft", JSON.stringify({
          title, summary, category, content, authorName, imagePreview, cta: { ...cta, newIconFile: null }
        }));
      } catch (e) {
        localStorage.setItem("marketing_blog_draft", JSON.stringify({
          title, summary, category, content, authorName, cta: { ...cta, newIconFile: null }
        }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, summary, category, content, authorName, imagePreview, cta, isEditMode]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    if (isEditMode && onEditComplete) { onEditComplete(); return; }
    setTitle(""); setSummary(""); setContent(""); setIsContentEmpty(true);
    setCategory("Academics"); setImageFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setCta({ ...cta, enabled: false, newIconFile: null });
    localStorage.removeItem("marketing_blog_draft");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim() || isContentEmpty || (!imageFile && !imagePreview)) {
      setAlert({ show: true, message: "Please fill in all fields and add a cover image.", type: "error" });
      return;
    }
    if (cta.enabled && !cta.text.trim()) {
      setAlert({ show: true, message: "Please provide text for the CTA button.", type: "error" });
      return;
    }

    setIsPublishing(true);

    try {
      let finalImageUrl = imagePreview;
      let finalCtaIconUrl = cta.iconUrl;

      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("upload_preset", "cute_profiles"); 
        formData.append("cloud_name", "da6jhcsmm");       
        const res = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Failed to upload cover image");
        finalImageUrl = (await res.json()).secure_url;
      }

      if (cta.enabled && cta.newIconFile) {
        const iconData = new FormData();
        iconData.append("file", cta.newIconFile);
        iconData.append("upload_preset", "cute_profiles");
        iconData.append("cloud_name", "da6jhcsmm");
        const iconRes = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { method: "POST", body: iconData });
        if (!iconRes.ok) throw new Error("Failed to upload CTA icon");
        finalCtaIconUrl = (await iconRes.json()).secure_url;
      }

      const token = localStorage.getItem("jwtoken");
      if (!token) { navigate("/signin"); return; }

      const endpoint = isEditMode ? `blogs/${editBlogData._id}` : "blogs";
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(`${import.meta.env.VITE_API}${endpoint}`, { 
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          title, summary, content, coverImage: finalImageUrl, category, authorName,
          cta: {
            enabled: cta.enabled, text: cta.text, link: cta.link, color: cta.color, 
            size: cta.size, alignment: cta.alignment, width: cta.width, radius: cta.radius,
            iconUrl: finalCtaIconUrl, textColor: cta.textColor
          }
        }),
      });

      if (!response.ok) throw new Error(`Failed to ${isEditMode ? "update" : "publish"} blog`);
      setAlert({ show: true, message: `Blog ${isEditMode ? "updated" : "published"}! Cloudflare is rebuilding.`, type: "success" });
      setTimeout(() => resetForm(), 1500);

    } catch (error: any) {
      setAlert({ show: true, message: error.message || "Something went wrong", type: "error" });
    } finally { setIsPublishing(false); }
  };

  const radii = ['rounded-none', 'rounded-md', 'rounded-xl', 'rounded-full'];
  const sizes = [
    { label: 'S', val: 'py-2 px-6 text-sm' },
    { label: 'M', val: 'py-3 px-8 text-base' },
    { label: 'L', val: 'py-4 px-10 text-lg' }
  ];

  return (
    <>
      <style>
        {`
          /* 🚨 SYNCED WITH HTML: pre-wrap and min-height prevent empty lines from collapsing */
          .tiptap-content { white-space: pre-wrap; }
          .tiptap-content h1 { font-size: 2.25rem; font-weight: 900; line-height: 1.2; margin-bottom: 1rem; margin-top: 1.5rem; color: #111827; }
          .tiptap-content h2 { font-size: 1.875rem; font-weight: 800; line-height: 1.3; margin-bottom: 0.875rem; margin-top: 1.5rem; color: #1f2937; }
          .tiptap-content h3 { font-size: 1.5rem; font-weight: 700; line-height: 1.4; margin-bottom: 0.75rem; margin-top: 1.25rem; color: #374151; }
          .tiptap-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
          .tiptap-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
          .tiptap-content p { margin-bottom: 1rem; line-height: 1.7; min-height: 1.5rem; }
          .tiptap-content p:last-child { margin-bottom: 0; }
          .tiptap-content strong { font-weight: bold; }
          .tiptap-content em { font-style: italic; }
          .tiptap-content s { text-decoration: line-through; }
          .tiptap-content a { color: #1765a4; text-decoration: underline; cursor: pointer; }
        `}
      </style>
      
      <div className="w-full pb-10">
        {!isEditMode && (
          <div className="bg-blue-50 border border-brand-blue/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-brand-blue shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-brand-blue">Marketing Blog Publisher</h3>
              <p className="text-sm text-brand-blue/80 mt-1">Blogs published here are sent directly to the public-facing marketing website. Drafts are auto-saved to your browser.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100">
          
          <div className="p-6 border-b border-gray-50 bg-slate-50 flex items-center justify-between rounded-t-3xl">
            <div className="flex items-center gap-3">
              {/* 🚨 NEW: BACK BUTTON FOR EDIT MODE */}
              {isEditMode && (
                <button type="button" onClick={onEditComplete} className="p-2 hover:bg-blue-100 bg-blue-50 text-brand-blue rounded-full transition-colors mr-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              {isEditMode ? <Settings2 className="text-brand-blue w-6 h-6" /> : <FileText className="text-brand-orange w-6 h-6" />}
              <h2 className="text-xl font-display font-bold text-gray-800">{isEditMode ? "Edit Article" : "Write a New Article"}</h2>
            </div>
            <button type="button" onClick={() => setShowPreview(true)} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:border-brand-blue hover:text-brand-blue transition-colors">
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Blog Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Category</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} list="categories" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800" />
                <datalist id="categories">
                  <option value="Academic Pressure" />
                  <option value="Parenting Tips" />
                  <option value="Mental Health" />
                  <option value="Career Guidance" />
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Short Summary (Preview Text)</label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="w-full h-24 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 resize-none custom-scrollbar" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cover Image</label>
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 max-h-64 flex justify-center">
                  <img src={imagePreview} alt="Cover Preview" className="object-contain w-full h-full" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); if(fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute top-4 right-4 bg-gray-900/60 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-colors"><X className="w-5 h-5" /></button>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-400 hover:text-brand-blue hover:border-brand-blue hover:bg-blue-50 cursor-pointer transition-colors">
                  <ImageIcon className="w-10 h-10 mb-2" />
                  <p className="font-bold">Click to upload cover image</p>
                </div>
              )}
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Main Content</label>
              <div className="border border-brand-orange/50 rounded-2xl bg-white flex flex-col min-h-[400px]">
                <RichTextEditor value={content} onChange={(html, isEmpty) => { setContent(html); setIsContentEmpty(isEmpty); }} showToolbar={true} allowHeadings={true} className="min-h-[400px] text-lg" />
              </div>
            </div>

            {/* APPLE / FIGMA STYLE CTA BUILDER */}
            <div className="border border-gray-200 rounded-2xl bg-slate-50 overflow-hidden shadow-sm transition-all duration-300">
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors" onClick={() => setCta({...cta, enabled: !cta.enabled})}>
                <div>
                  <h3 className="font-bold text-gray-800">Add Call-to-Action (CTA)</h3>
                  <p className="text-xs text-gray-500">Design a custom button for the bottom of this article.</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors relative ${cta.enabled ? 'bg-brand-orange' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${cta.enabled ? 'left-7' : 'left-1'}`}></div>
                </div>
              </div>

              {cta.enabled && (
                <div className="border-t border-gray-200 bg-white flex flex-col animate-in slide-in-from-top-2 duration-300">
                  <div className="relative p-12 md:p-16 flex items-center bg-slate-100/50 border-b border-gray-200 transition-all duration-300 min-h-[250px]" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                    <div className={`w-full flex ${cta.alignment}`}>
                      <div className={`relative group ${cta.width}`}>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 scale-95 group-hover:scale-100">
                          <div className="bg-gray-900 text-white rounded-full shadow-xl px-4 py-2 flex items-center gap-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Radius</span>
                            <input 
                              type="range" min="0" max="3" 
                              value={radii.indexOf(cta.radius)} 
                              onChange={e => setCta({...cta, radius: radii[parseInt(e.target.value)]})}
                              className="w-24 accent-brand-blue h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45"></div>
                        </div>

                        <div className={`relative flex items-center justify-center gap-2 ${cta.textColor} font-bold transition-all duration-300 shadow-md ${cta.color} ${cta.size} ${cta.width} ${cta.radius} ring-4 ring-transparent hover:ring-brand-blue/30`}>
                          {(cta.iconUrl || cta.newIconFile) && (
                            <div className="relative group/icon cursor-pointer">
                              <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">❖</span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setCta({...cta, iconUrl: "", newIconFile: null}); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/icon:opacity-100 transition-opacity"><X size={12}/></button>
                            </div>
                          )}
                          <input 
                            id="ctaButtonText" name="ctaButtonText" type="text" 
                            value={cta.text} onChange={e => setCta({...cta, text: e.target.value})}
                            placeholder="Button Text"
                            className="bg-transparent border-none outline-none text-center placeholder-current opacity-90 focus:outline-none focus:ring-0 w-full min-w-[50px] transition-all text-inherit"
                            size={Math.max(cta.text.length, 10)} 
                            />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex flex-wrap items-center justify-between gap-6 bg-white">
                    <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-brand-blue/50 transition-shadow">
                      <Link2 className="w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Paste link (https://)" value={cta.link} onChange={e => setCta({...cta, link: e.target.value})} className="bg-transparent border-none outline-none text-sm font-medium text-gray-800 w-full" />
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-full border border-gray-200">
                        {['bg-brand-orange', 'bg-brand-blue', 'bg-gray-900'].map(c => (
                          <button key={c} type="button" onClick={() => setCta({...cta, color: c})} className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${c} ${cta.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} />
                        ))}
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex gap-1.5 p-1 bg-slate-100 rounded-full border border-gray-200">
                        {['text-white', 'text-gray-900'].map(tc => (
                            <button key={tc} type="button" onClick={() => setCta({...cta, textColor: tc})} className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs transition-transform hover:scale-110 ${tc === 'text-white' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} ${cta.textColor === tc ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}>A</button>
                        ))}
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex bg-slate-100 rounded-xl border border-gray-200 p-0.5">
                        {sizes.map(s => (
                          <button key={s.label} type="button" onClick={() => setCta({...cta, size: s.val})} className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${cta.size === s.val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{s.label}</button>
                        ))}
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setCta({...cta, alignment: 'justify-start'})} className={`p-1.5 rounded-lg transition-colors ${cta.alignment === 'justify-start' ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-500 hover:bg-gray-100'}`}><AlignLeft size={16} /></button>
                        <button type="button" onClick={() => setCta({...cta, alignment: 'justify-center'})} className={`p-1.5 rounded-lg transition-colors ${cta.alignment === 'justify-center' ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-500 hover:bg-gray-100'}`}><AlignCenter size={16} /></button>
                        <button type="button" onClick={() => setCta({...cta, alignment: 'justify-end'})} className={`p-1.5 rounded-lg transition-colors ${cta.alignment === 'justify-end' ? 'bg-brand-blue/10 text-brand-blue' : 'text-gray-500 hover:bg-gray-100'}`}><AlignRight size={16} /></button>
                        <div className="w-px h-5 bg-gray-300 mx-1 self-center"></div>
                        <button type="button" onClick={() => setCta({...cta, width: cta.width === 'w-auto' ? 'w-full' : 'w-auto'})} className={`p-1.5 rounded-lg transition-colors text-gray-500 hover:bg-gray-100`} title="Toggle Full Width">
                          {cta.width === 'w-auto' ? <Maximize size={16} /> : <Minimize size={16} />}
                        </button>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-brand-orange text-xs font-bold hover:bg-orange-100 transition-colors">
                        <Upload size={14} /> <span>Icon</span>
                        <input type="file" accept="image/*" onChange={e => setCta({...cta, newIconFile: e.target.files?.[0] || null})} className="hidden" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 md:w-1/2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Publishing As</label>
              <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800" />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-gray-100 flex items-center justify-end gap-4 rounded-b-3xl">
            <button type="button" onClick={resetForm} className="px-6 py-2.5 rounded-full font-bold text-gray-500 hover:bg-gray-200 transition-colors">
              {isEditMode ? "Cancel Edit" : "Clear Draft"}
            </button>
            <button type="submit" disabled={isPublishing} className="flex items-center gap-2 bg-brand-orange text-white px-8 py-2.5 rounded-full font-bold shadow-md hover:bg-orange-600 hover:shadow-lg transition-all disabled:opacity-50 transform hover:-translate-y-0.5">
              {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /><span>{isEditMode ? "Save Changes" : "Publish Article"}</span></>}
            </button>
          </div>
        </form>
      </div>

      {showPreview && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50 shrink-0 rounded-t-3xl">
              <div className="flex items-center gap-2 text-brand-blue"><Eye className="w-5 h-5" /><h3 className="font-bold">Article Preview</h3></div>
              <button onClick={() => setShowPreview(false)} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-500 rounded-full transition-colors shadow-sm"><X size={16}/></button>
            </div>
            <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar bg-white rounded-b-3xl">
              <div className="max-w-2xl mx-auto">
                <span className="text-sm font-bold text-brand-orange uppercase tracking-wider">{category || "Uncategorized"}</span>
                <h1 className="text-3xl md:text-5xl font-display font-black text-gray-900 mt-3 mb-6 leading-tight">{title || "Your blog title will appear here..."}</h1>
                <div className="flex items-center gap-4 mb-10 pb-10 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-lg font-black shrink-0">{authorName ? authorName.charAt(0).toUpperCase() : "U"}</div>
                  <div>
                    <p className="font-bold text-gray-900">{authorName || "Author Name"}</p>
                    <p className="text-sm text-gray-500">March 4, 2026 • {Math.ceil((content.length || 1) / 800)} min read</p>
                  </div>
                </div>
              </div>
              
              {imagePreview ? (
                <div className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-lg mb-10 bg-gray-50"><img src={imagePreview} alt="Cover" className="w-full h-auto max-h-[500px] object-cover" /></div>
              ) : (
                <div className="w-full max-w-4xl mx-auto h-64 bg-gray-100 border-2 border-dashed border-gray-200 rounded-3xl mb-10 flex items-center justify-center text-gray-400 font-bold">Cover Image Placement</div>
              )}
              
              {/* 🚨 NEW: MATCHED SUMMARY TO HTML PLACEMENT */}
              <div className="max-w-2xl mx-auto mb-12">
                <p className="text-xl font-medium text-gray-800 leading-relaxed mb-8 border-l-4 border-brand-orange pl-4 italic">
                  {summary || "Your summary provides context to the reader before they dive into the main article..."}
                </p>
                <div className="tiptap-content text-gray-800 text-lg md:text-xl leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: content || "<p class='text-gray-400 italic'>Your main rich text content will be rendered here...</p>" }} />
              </div>

              {/* PREVIEW CTA BUTTON */}
              {cta.enabled && (
                <div className={`max-w-2xl mx-auto mt-12 pt-8 border-t border-gray-100 flex ${cta.alignment}`}>
                  <a href={cta.link || "#"} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center justify-center gap-2 ${cta.textColor} font-bold transition-transform hover:-translate-y-0.5 shadow-md hover:shadow-lg ${cta.color} ${cta.size} ${cta.width} ${cta.radius}`}>
                    {(cta.iconUrl || cta.newIconFile) && <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">❖</span>}
                    {cta.text || "Button Text"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>, document.body
      )}
      {alert.show && createPortal(<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100000] w-full max-w-md px-4"><Muialert message={alert.message} severity={alert.type} onClose={() => setAlert({ ...alert, show: false })} /></div>, document.body)}
    </>
  );
};

export default CreateBlog;