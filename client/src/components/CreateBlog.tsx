import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, X, Loader2, Send, FileText, AlertCircle, Eye } from "lucide-react";
import Muialert from "./Muialert";
import RichTextEditor from "./RichTextEditor";
import { UserData } from "../App";

interface CreateBlogProps {
  userData: UserData;
}

const CreateBlog = ({ userData }: CreateBlogProps) => {
  const navigate = useNavigate();
  
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
  
  // UI States
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });

  // 🚨 1. LOAD DRAFT FROM LOCAL STORAGE ON MOUNT
  useEffect(() => {
    const savedDraft = localStorage.getItem("marketing_blog_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.summary) setSummary(parsed.summary);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.content) {
          setContent(parsed.content);
          setIsContentEmpty(false);
        }
        if (parsed.authorName) setAuthorName(parsed.authorName);
        if (parsed.imagePreview) setImagePreview(parsed.imagePreview);
      } catch (e) {
        console.error("Failed to load blog draft", e);
      }
    }
  }, []);

  // 🚨 2. AUTO-SAVE DRAFT ON CHANGES
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem("marketing_blog_draft", JSON.stringify({
          title, summary, category, content, authorName, imagePreview
        }));
      } catch (e) {
        // Fallback: If image string is too large for local storage, save text only
        console.warn("Image too large for local storage draft. Saving text only.");
        localStorage.setItem("marketing_blog_draft", JSON.stringify({
          title, summary, category, content, authorName
        }));
      }
    }, 1000); // Wait 1 second after typing stops to save
    return () => clearTimeout(timer);
  }, [title, summary, category, content, authorName, imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setTitle("");
    setSummary("");
    setContent("");
    setIsContentEmpty(true);
    setCategory("Academics");
    removeImage();
    localStorage.removeItem("marketing_blog_draft"); // 🚨 Clear draft on success
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Allow submission if they have an imagePreview (from draft) even if the File object is null
    if (!title.trim() || !summary.trim() || isContentEmpty || (!imageFile && !imagePreview)) {
      setAlert({ show: true, message: "Please fill in all fields and add a cover image.", type: "error" });
      return;
    }

    setIsPublishing(true);

    try {
      let finalImageUrl = imagePreview; // Default to draft image if it's a URL

      // Upload Cover Image if a NEW file was selected
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("upload_preset", "cute_profiles"); 
        formData.append("cloud_name", "da6jhcsmm");       

        const cloudinaryRes = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { 
          method: "POST", 
          body: formData 
        });
        
        if (!cloudinaryRes.ok) throw new Error("Failed to upload cover image");
        const cloudinaryData = await cloudinaryRes.json();
        finalImageUrl = cloudinaryData.secure_url;
      }

      // Submit to Node.js Backend
      const token = localStorage.getItem("jwtoken");
      if (!token) {
        navigate("/signin");
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API}blogs`, { 
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          title,
          summary,
          content,
          coverImage: finalImageUrl,
          category,
          authorName
        }),
      });

      if (!response.ok) throw new Error("Failed to publish blog");

      setAlert({ show: true, message: "Blog published! The main website is rebuilding now.", type: "success" });
      resetForm();

    } catch (error: any) {
      console.error(error);
      setAlert({ show: true, message: error.message || "Something went wrong", type: "error" });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <style>
        {`
          /* Shared Tiptap HTML Content Styling */
          .tiptap-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content p { margin-bottom: 1rem; }
          .tiptap-content p:last-child { margin-bottom: 0; }
          .tiptap-content strong { font-weight: bold; }
          .tiptap-content em { font-style: italic; }
          .tiptap-content s { text-decoration: line-through; }
        `}
      </style>
      
      <div className="w-full pb-10">
        
        <div className="bg-blue-50 border border-brand-blue/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-brand-blue shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-brand-blue">Marketing Blog Publisher</h3>
            <p className="text-sm text-brand-blue/80 mt-1">
              Blogs published here are sent directly to the public-facing marketing website. 
              Drafts are auto-saved to your browser.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          
          <div className="p-6 border-b border-gray-50 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-brand-orange w-6 h-6" />
              <h2 className="text-xl font-display font-bold text-gray-800">Write a New Article</h2>
            </div>
            
            {/* 🚨 PREVIEW BUTTON */}
            <button 
              type="button" 
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:border-brand-blue hover:text-brand-blue transition-colors"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>

          <div className="p-6 space-y-6">
            
            {/* TITLE & CATEGORY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Blog Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g., Are we pushing our children too hard?"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Category</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  list="categories"
                  placeholder="E.g., Academic Pressure"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800"
                />
                <datalist id="categories">
                  <option value="Academic Pressure" />
                  <option value="Parenting Tips" />
                  <option value="Mental Health" />
                  <option value="Career Guidance" />
                </datalist>
              </div>
            </div>

            {/* SUMMARY */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Short Summary (SEO / Card Preview)</label>
              <textarea 
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A brief 2-3 line summary of what this article is about..."
                className="w-full h-24 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 resize-none custom-scrollbar"
              />
            </div>

            {/* COVER IMAGE */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cover Image</label>
              {imagePreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 max-h-64 flex justify-center">
                  <img src={imagePreview} alt="Cover Preview" className="object-contain w-full h-full" />
                  <button type="button" onClick={removeImage} className="absolute top-4 right-4 bg-gray-900/60 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-gray-400 hover:text-brand-blue hover:border-brand-blue hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <ImageIcon className="w-10 h-10 mb-2" />
                  <p className="font-bold">Click to upload cover image</p>
                  <p className="text-xs mt-1">High quality JPG or PNG</p>
                </div>
              )}
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
            </div>

            {/* MAIN CONTENT (Tiptap) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Main Content</label>
              <div className="border border-brand-orange/50 rounded-2xl overflow-hidden bg-white flex flex-col min-h-[400px]">
                <RichTextEditor 
                  value={content} 
                  onChange={(html, isEmpty) => {
                    setContent(html);
                    setIsContentEmpty(isEmpty);
                  }} 
                  showToolbar={true} 
                  className="min-h-[400px] text-lg"
                />
              </div>
            </div>

            {/* AUTHOR NAME OVERRIDE */}
            <div className="space-y-2 md:w-1/2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Publishing As</label>
              <input 
                type="text" 
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800"
              />
              <p className="text-xs text-gray-400">Defaults to your profile name, but you can override it for guest posts.</p>
            </div>

          </div>

          {/* ACTION BAR */}
          <div className="p-6 bg-slate-50 border-t border-gray-100 flex items-center justify-end gap-4">
            <button 
              type="button"
              onClick={() => {
                if(window.confirm("Cancel and delete draft?")) resetForm();
              }}
              className="px-6 py-2.5 rounded-full font-bold text-gray-500 hover:bg-gray-200 transition-colors"
            >
              Clear Draft
            </button>
            <button 
              type="submit" 
              disabled={isPublishing} 
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-2.5 rounded-full font-bold shadow-md hover:bg-orange-600 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
            >
              {isPublishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /><span>Publish Article</span></>}
            </button>
          </div>
        </form>
      </div>

      {/* 🚨 PREVIEW MODAL */}
      {showPreview && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50 shrink-0 rounded-t-3xl">
              <div className="flex items-center gap-2 text-brand-blue">
                <Eye className="w-5 h-5" />
                <h3 className="font-bold">Article Preview</h3>
              </div>
              <button 
                onClick={() => setShowPreview(false)} 
                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-500 rounded-full transition-colors shadow-sm"
              >
                <X size={16}/>
              </button>
            </div>

            {/* Simulated Marketing Website Layout */}
            <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar bg-white">
              
              <div className="max-w-2xl mx-auto">
                <span className="text-sm font-bold text-brand-orange uppercase tracking-wider">{category || "Uncategorized"}</span>
                <h1 className="text-3xl md:text-5xl font-display font-black text-gray-900 mt-3 mb-6 leading-tight">
                  {title || "Your blog title will appear here..."}
                </h1>
                
                <p className="text-gray-500 mb-8 font-medium text-lg md:text-xl leading-relaxed">
                  {summary || "Your summary provides context to the reader before they dive into the main article..."}
                </p>

                <div className="flex items-center gap-4 mb-10 pb-10 border-b border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-lg font-black shrink-0">
                    {authorName ? authorName.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{authorName || "Author Name"}</p>
                    <p className="text-sm text-gray-500">March 4, 2026 • {Math.ceil((content.length || 1) / 800)} min read</p>
                  </div>
                </div>
              </div>

              {/* Cover Image */}
              {imagePreview ? (
                <div className="w-full max-w-4xl mx-auto rounded-3xl overflow-hidden shadow-lg mb-10 bg-gray-50">
                  <img src={imagePreview} alt="Cover" className="w-full h-auto max-h-[500px] object-cover" />
                </div>
              ) : (
                <div className="w-full max-w-4xl mx-auto h-64 bg-gray-100 border-2 border-dashed border-gray-200 rounded-3xl mb-10 flex items-center justify-center text-gray-400 font-bold">
                  Cover Image Placement
                </div>
              )}

              {/* Rich Text Body */}
              <div className="max-w-2xl mx-auto">
                <div
                  className="tiptap-content text-gray-800 text-lg md:text-xl leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: content || "<p class='text-gray-400 italic'>Your main rich text content will be rendered here...</p>" }}
                />
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {alert.show && createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-md px-4">
          <Muialert message={alert.message} severity={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
        </div>,
        document.body
      )}
    </>
  );
};

export default CreateBlog;
