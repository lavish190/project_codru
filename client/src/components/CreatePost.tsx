import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, X, Loader2, Send, Clock, Maximize2, Minimize2, CheckCircle2 } from "lucide-react";
import Muialert from "./Muialert";
import { UserData } from "../App";
import RichTextEditor from "./RichTextEditor";

interface CreatePostProps {
  userData: UserData;
  onPostCreated: () => void;
}

const CreatePost = ({ userData, onPostCreated }: CreatePostProps) => {
  const DRAFT_KEY = `cute_post_draft_${userData._id}`;
  const SCHEDULE_DRAFT_KEY = `cute_post_schedule_draft_${userData._id}`;

  const [content, setContent] = useState(() => localStorage.getItem(DRAFT_KEY) || "");
  const [isContentEmpty, setIsContentEmpty] = useState(!content);
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const savedSchedule = localStorage.getItem(SCHEDULE_DRAFT_KEY) || "";
  const [showSchedule, setShowSchedule] = useState(!!savedSchedule);
  const [scheduledFor, setScheduledFor] = useState(savedSchedule);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasDraft, setHasDraft] = useState(!!content || !!savedSchedule);

  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleContentChange = (html: string, isEmpty: boolean) => {
    setContent(html);
    setIsContentEmpty(isEmpty);
    if (isEmpty) {
      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(!!localStorage.getItem(SCHEDULE_DRAFT_KEY));
    } else {
      localStorage.setItem(DRAFT_KEY, html);
      setHasDraft(true);
    }
  };

  const handleScheduleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScheduledFor(val);
    if (val) {
      localStorage.setItem(SCHEDULE_DRAFT_KEY, val);
      setHasDraft(true);
    } else {
      localStorage.removeItem(SCHEDULE_DRAFT_KEY);
      setHasDraft(!isContentEmpty);
    }
  };

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

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(SCHEDULE_DRAFT_KEY);
    setContent("");
    setIsContentEmpty(true);
    setShowSchedule(false);
    setScheduledFor("");
    setHasDraft(false);
    removeImage();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isContentEmpty && !imageFile) {
      setAlert({ show: true, message: "Please add some text or an image!", type: "error" });
      return;
    }

    if (showSchedule && scheduledFor && new Date(scheduledFor) <= new Date()) {
      setAlert({ show: true, message: "Scheduled time must be in the future.", type: "error" });
      return;
    }

    setIsUploading(true);
    let finalImageUrl = "";

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        formData.append("upload_preset", "cute_profiles"); 
        formData.append("cloud_name", "da6jhcsmm");       

        const cloudinaryRes = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { method: "POST", body: formData });
        if (!cloudinaryRes.ok) throw new Error("Failed to upload image");
        finalImageUrl = (await cloudinaryRes.json()).secure_url;
      }

      const token = localStorage.getItem("jwtoken");
      if (!token) return navigate("/signin");

      const response = await fetch(`${import.meta.env.VITE_API}posts`, { 
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          content,
          imageUrl: finalImageUrl, 
          scheduledFor: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : null
        }),
      });

      if (!response.ok) throw new Error("Failed to create post");

      clearDraft();
      setIsExpanded(false);
      setAlert({ show: true, message: showSchedule && scheduledFor ? "Post scheduled successfully!" : "Post shared successfully!", type: "success" });
      onPostCreated();

    } catch (error: any) {
      setAlert({ show: true, message: error.message || "Something went wrong", type: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const isReadyToSubmit = !isUploading && (!isContentEmpty || imageFile) && !(showSchedule && !scheduledFor);

  const renderActionToolbar = (layout: "compact" | "expanded") => (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${layout === "compact" ? "ml-16 mt-4" : "mt-6"}`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-brand-blue hover:text-brand-orange hover:bg-orange-50 px-4 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50" disabled={isUploading}>
          <ImageIcon className="w-5 h-5" />
          <span className="hidden sm:inline">Photo</span>
        </button>
        <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />

        <button type="button" onClick={() => setShowSchedule(!showSchedule)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 ${showSchedule ? 'text-brand-orange bg-orange-50' : 'text-brand-blue hover:text-brand-orange hover:bg-orange-50'}`} disabled={isUploading}>
          <Clock className="w-5 h-5" />
          <span className="hidden sm:inline">Schedule</span>
        </button>

        {hasDraft && (
          <button type="button" onClick={clearDraft} className="text-xs font-bold text-gray-400 hover:text-red-500 ml-2 transition-colors">
            Clear Draft
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 justify-end">
        {hasDraft && <span className="flex items-center gap-1 text-xs font-bold text-green-500"><CheckCircle2 className="w-3 h-3" /> Auto-saved</span>}
        <button type="button" onClick={() => handleSubmit()} disabled={!isReadyToSubmit} className="flex items-center gap-2 bg-brand-orange text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-orange-600 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5">
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /><span>{showSchedule && scheduledFor ? "Schedule" : "Post"}</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* COMPACT MODE */}
      <div className={`max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-6 relative ${isExpanded ? 'hidden' : 'block'}`}>
        <button onClick={() => setIsExpanded(true)} className="absolute top-6 right-6 text-gray-400 hover:text-brand-blue transition-colors z-10" title="Expand Editor">
          <Maximize2 className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-display font-bold text-brand-blue mb-6">Create a CuTe Post</h2>
        
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-brand-orange/20">
            {userData?.Photo ? (
              <img src={userData.Photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center font-bold">
                {userData?.Name?.charAt(0).toUpperCase() || "U"}
              </div>
            )}
          </div>
          
          <div className="w-full bg-slate-50 border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-orange/50 focus-within:border-brand-orange transition-all h-32 flex">
            <RichTextEditor 
              value={content} 
              onChange={handleContentChange} 
              showToolbar={false} 
            />
          </div>
        </div>

        {showSchedule && (
          <div className="ml-16 mt-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in slide-in-from-top-2">
            <label className="block text-xs font-bold text-brand-blue uppercase tracking-widest mb-2">Publish Date & Time</label>
            <div className="flex items-center gap-3">
              <input type="datetime-local" value={scheduledFor} onChange={handleScheduleChange} min={new Date().toISOString().slice(0, 16)} className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue" />
              <button type="button" onClick={() => { setShowSchedule(false); handleScheduleChange({ target: { value: '' } } as any); }} className="text-gray-400 hover:text-red-500 transition-colors p-2"><X className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        {imagePreview && (
          <div className="relative ml-16 mt-3 rounded-2xl overflow-hidden shadow-sm border border-gray-100 inline-block max-w-full">
            <img src={imagePreview} alt="Preview" className="max-h-80 object-contain" />
            <button type="button" onClick={removeImage} className="absolute top-2 right-2 bg-gray-900/60 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"><X className="w-4 h-4" /></button>
          </div>
        )}

        {renderActionToolbar("compact")}
      </div>

      {/* EXPANDED MODE */}
      {isExpanded && (
        <div className="fixed inset-0 z-[9990] bg-slate-50 overflow-y-auto animate-in zoom-in-95 duration-200">
          <div className="max-w-4xl mx-auto min-h-screen flex flex-col p-4 md:p-8 bg-white shadow-2xl">
            
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                  {userData?.Photo ? <img src={userData.Photo} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center font-bold">{userData?.Name?.charAt(0).toUpperCase() || "U"}</div>}
                </div>
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-800">Drafting Post</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rich Text Editor</p>
                </div>
              </div>
              <button onClick={() => setIsExpanded(false)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full font-bold text-sm transition-colors">
                <Minimize2 className="w-4 h-4" /> Minimize
              </button>
            </div>

            <div className="flex-1 flex flex-col mb-4 border border-gray-200 rounded-2xl shadow-inner bg-white overflow-hidden min-h-[40vh]">
              <RichTextEditor 
                value={content} 
                onChange={handleContentChange} 
                showToolbar={true} 
                className="text-lg"
              />
            </div>

            <div className="space-y-4 shrink-0">
              {showSchedule && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                  <label className="block text-xs font-bold text-brand-blue uppercase tracking-widest mb-2">Publish Date & Time</label>
                  <div className="flex items-center gap-3">
                    <input type="datetime-local" value={scheduledFor} onChange={handleScheduleChange} min={new Date().toISOString().slice(0, 16)} className="flex-1 max-w-sm bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                    <button type="button" onClick={() => { setShowSchedule(false); handleScheduleChange({ target: { value: '' } } as any); }} className="text-gray-400 hover:text-red-500 transition-colors p-2"><X className="w-5 h-5" /></button>
                  </div>
                </div>
              )}

              {imagePreview && (
                <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 inline-block max-w-full bg-slate-50">
                  <img src={imagePreview} alt="Preview" className="max-h-[50vh] object-contain" />
                  <button type="button" onClick={removeImage} className="absolute top-4 right-4 bg-gray-900/60 hover:bg-red-500 text-white p-2 rounded-full backdrop-blur-sm transition-colors"><X className="w-5 h-5" /></button>
                </div>
              )}
            </div>

            <div className="mt-auto pt-6 pb-8 shrink-0">
              {renderActionToolbar("expanded")}
            </div>

          </div>
        </div>
      )}

      {alert.show && (
        <div className={`mt-4 ${isExpanded ? 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-md px-4' : ''}`}>
          <Muialert message={alert.message} severity={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
        </div>
      )}
    </>
  );
};

export default CreatePost;