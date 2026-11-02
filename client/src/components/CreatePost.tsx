import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, X, Loader2, Send, Clock, Maximize2, Minimize2, CheckCircle2, Trash2, Globe, ChevronLeft, ChevronRight, MoveLeft, MoveRight, Plus} from "lucide-react";
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
  const LINKEDIN_DRAFT_KEY = `cute_post_linkedin_draft_${userData._id}`;

  const [content, setContent] = useState(() => localStorage.getItem(DRAFT_KEY) || "");
  const [isContentEmpty, setIsContentEmpty] = useState(!content);
  
  // Replace imageFiles and imagePreviews with this single state:
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  
  // --- NEW SCHEDULING STATE INIT ---
  const savedScheduleRaw = localStorage.getItem(SCHEDULE_DRAFT_KEY);
  let initialScheduleConfig = { isScheduled: false, syncTimes: true, times: { cute: "", linkedin: "" } };

  if (savedScheduleRaw) {
    try {
      initialScheduleConfig = JSON.parse(savedScheduleRaw);
    } catch (e) {
      initialScheduleConfig = { isScheduled: true, syncTimes: true, times: { cute: savedScheduleRaw, linkedin: savedScheduleRaw } };
    }
  }

  const [scheduleConfig, setScheduleConfig] = useState(initialScheduleConfig);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isSocialMenuOpen, setIsSocialMenuOpen] = useState(false);

  const [isLinkedInConnected, setIsLinkedInConnected] = useState(false);
  const [postToLinkedIn, setPostToLinkedIn] = useState(false);

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasDraft, setHasDraft] = useState(!!content || scheduleConfig.isScheduled);

  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });

  // NEW: Tracks which image is open in the full-screen viewer (null means closed)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkConnections = async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        // We will build this quick check route on the backend next
        const res = await fetch(`${import.meta.env.VITE_API}auth/connections`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        setIsLinkedInConnected(data.linkedin); 
      } catch (err) {
        console.error("Failed to fetch social connections");
      }
    };
    checkConnections();
  }, []);

  // --- LOAD DRAFTS ONCE USER DATA IS READY ---
  useEffect(() => {
    if (userData?._id) {
      const draftKey = `cute_post_draft_${userData._id}`;
      const scheduleKey = `cute_post_schedule_draft_${userData._id}`;
      
      const savedText = localStorage.getItem(draftKey);
      if (savedText && isContentEmpty) {
        setContent(savedText);
        setIsContentEmpty(false);
        setHasDraft(true);
      }

      const savedScheduleRaw = localStorage.getItem(scheduleKey);
      if (savedScheduleRaw && !scheduleConfig.isScheduled) {
        try {
          const parsed = JSON.parse(savedScheduleRaw);
          setScheduleConfig(parsed);
          setHasDraft(true);
        } catch (e) {
          setScheduleConfig({ isScheduled: true, syncTimes: true, times: { cute: savedScheduleRaw, linkedin: savedScheduleRaw } });
          setHasDraft(true);
        }
      }
      
      const savedImagesRaw = localStorage.getItem(`cute_post_images_draft_${userData._id}`);
      if (savedImagesRaw) {
        try {
          const parsedUrls = JSON.parse(savedImagesRaw);
          setImageUrls(parsedUrls);
          setHasDraft(true);
        } catch (e) {
          console.error("Failed to parse saved images");
        }
      }

      const savedLinkedIn = localStorage.getItem(`cute_post_linkedin_draft_${userData._id}`);
      if (savedLinkedIn === "true") {
        setPostToLinkedIn(true);
      }
    }
  }, [userData?._id]); // Only runs when the user ID successfully loads

  // --- HANDLERS ---
  const handleContentChange = (html: string, isEmpty: boolean) => {
    setContent(html);
    setIsContentEmpty(isEmpty);
    if (isEmpty) {
      localStorage.removeItem(DRAFT_KEY);
      // Check local storage directly instead of relying on state here
      setHasDraft(!!localStorage.getItem(SCHEDULE_DRAFT_KEY)); 
    } else {
      localStorage.setItem(DRAFT_KEY, html);
      setHasDraft(true);
    }
  };
  const LinkedinIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
    </svg>
  );
  const updateScheduleConfig = (newConfig: typeof scheduleConfig) => {
    setScheduleConfig(newConfig);
    if (newConfig.isScheduled && (newConfig.times.cute || newConfig.times.linkedin)) {
      localStorage.setItem(SCHEDULE_DRAFT_KEY, JSON.stringify(newConfig));
      setHasDraft(true);
    } else {
      localStorage.removeItem(SCHEDULE_DRAFT_KEY);
      setHasDraft(!isContentEmpty);
    }
  };

  const handleLinkedInToggle = async () => {
  if (isLinkedInConnected) {
    // 🚨 UPDATE THIS BLOCK
    const newState = !postToLinkedIn;
    setPostToLinkedIn(newState);
    if (newState) {
      localStorage.setItem(LINKEDIN_DRAFT_KEY, "true");
    } else {
      localStorage.removeItem(LINKEDIN_DRAFT_KEY);
    }
  } else {
    // If not connected, trigger the OAuth flow we built!
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}auth/linkedin/connect`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirects to LinkedIn login
      }
    } catch (err) {
      setAlert({ show: true, message: "Failed to connect to LinkedIn", type: "error" });
    }
  }
};

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedFiles = files.slice(0, 9 - imageUrls.length);
    setIsUploadingImages(true);

    try {
      const uploadPromises = allowedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "cute_profiles"); 
        formData.append("cloud_name", "da6jhcsmm");       

        const res = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        return data.secure_url;
      });

      const newUrls = await Promise.all(uploadPromises);
      
      setImageUrls((prev) => {
        const updated = [...prev, ...newUrls];
        // Save the simple, lightweight URLs to localStorage
        localStorage.setItem(`cute_post_images_draft_${userData?._id}`, JSON.stringify(updated));
        setHasDraft(true);
        return updated;
      });
    } catch (err) {
      setAlert({ show: true, message: "Failed to upload images", type: "error" });
    } finally {
      setIsUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteImagesFromCloudinary = async (urlsToDelete: string[]) => {
    if (urlsToDelete.length === 0) return;
    try {
      await fetch(`${import.meta.env.VITE_API}posts/images`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` 
        },
        body: JSON.stringify({ urls: urlsToDelete })
      });
    } catch (err) {
      console.error("Cleanup failed", err);
    }
  };

  const removeImage = (indexToRemove: number) => {
    // 1. Purge from Cloudinary
    const urlToDelete = imageUrls[indexToRemove];
    deleteImagesFromCloudinary([urlToDelete]); 

    // 2. Remove from frontend state and local storage
    setImageUrls((prev) => {
      const updated = prev.filter((_, index) => index !== indexToRemove);
      if (updated.length > 0) {
        localStorage.setItem(`cute_post_images_draft_${userData?._id}`, JSON.stringify(updated));
      } else {
        localStorage.removeItem(`cute_post_images_draft_${userData?._id}`);
        // Only clear the "Saved" badge if there's also no text
        if (isContentEmpty) setHasDraft(false);
      }
      return updated;
    });
  };

  const clearDraft = () => {
    // 1. Purge ALL active images from Cloudinary
    deleteImagesFromCloudinary(imageUrls); 

    // 2. Clear all your original storage keys (Kept your exact constants!)
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(SCHEDULE_DRAFT_KEY);
    localStorage.removeItem(LINKEDIN_DRAFT_KEY); 
    localStorage.removeItem(`cute_post_images_draft_${userData?._id}`); // New key for images
    
    // 3. Reset all your original states
    setContent("");
    setIsContentEmpty(true);
    setScheduleConfig({ isScheduled: false, syncTimes: true, times: { cute: "", linkedin: "" } });
    setShowScheduleModal(false);
    setPostToLinkedIn(false);
    setHasDraft(false);
    
    // 4. Reset the new unified image array
    setImageUrls([]);
  };

  const nextViewerImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerIndex((prev) => (prev !== null && prev < imageUrls.length - 1 ? prev + 1 : prev));
  };

  const prevViewerImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewerIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  };

  // Swaps the image position and keeps the viewer focused on it
  const moveImage = (e: React.MouseEvent, index: number, direction: "left" | "right") => {
    e.stopPropagation(); // 🚨 This stops the viewer from closing!
    
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= imageUrls.length) return;

    const reorder = <T,>(list: T[]) => {
      const arr = [...list];
      [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
      return arr;
    };

    setImageUrls(reorder(imageUrls));
    setViewerIndex(newIndex);
  };

  // Safely deletes from the viewer and shifts the focus
  const removeImageFromViewer = (e: React.MouseEvent) => {
    e.stopPropagation(); // 🚨 Stop this from closing too!
    if (viewerIndex === null) return;
    removeImage(viewerIndex);
    if (imageUrls.length <= 1) {
      setViewerIndex(null);
    } else if (viewerIndex >= imageUrls.length - 1) {
      setViewerIndex(viewerIndex - 1);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // 1. Validation check uses imageFiles.length
    if (isContentEmpty && imageUrls.length === 0) {
      return setAlert({ show: true, message: "Please add some text or an image!", type: "error" });
    }

    if (scheduleConfig.isScheduled) {
      const now = new Date();
      if (scheduleConfig.syncTimes && new Date(scheduleConfig.times.cute) <= now) {
        return setAlert({ show: true, message: "Scheduled time must be in the future.", type: "error" });
      }
      if (!scheduleConfig.syncTimes && ((scheduleConfig.times.cute && new Date(scheduleConfig.times.cute) <= now) || (postToLinkedIn && scheduleConfig.times.linkedin && new Date(scheduleConfig.times.linkedin) <= now))) {
        return setAlert({ show: true, message: "Scheduled times must be in the future.", type: "error" });
      }
    }

    setIsUploading(true);
    let finalImageUrls: string[] = []; // Array instead of string

    try {
      

      const token = localStorage.getItem("jwtoken");
      if (!token) return navigate("/signin");

      const distribution = {
        cute: {
          status: scheduleConfig.isScheduled ? 'scheduled' : 'posted',
          scheduledFor: scheduleConfig.isScheduled ? new Date(scheduleConfig.times.cute).toISOString() : null
        },
        linkedin: postToLinkedIn ? {
          status: scheduleConfig.isScheduled ? 'scheduled' : 'posted',
          scheduledFor: scheduleConfig.isScheduled ? new Date(scheduleConfig.syncTimes ? scheduleConfig.times.cute : scheduleConfig.times.linkedin).toISOString() : null
        } : { status: 'unselected' }
      };

      const response = await fetch(`${import.meta.env.VITE_API}posts`, { 
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          content,
          images: finalImageUrls, // 3. Send the array matching our new backend schema!
          distribution 
        }),
      });

      if (!response.ok) throw new Error("Failed to create post");

      clearDraft();
      setIsExpanded(false);
      setAlert({ show: true, message: scheduleConfig.isScheduled ? "Post scheduled successfully!" : "Post shared successfully!", type: "success" });
      onPostCreated();

    } catch (error: any) {
      setAlert({ show: true, message: error.message || "Something went wrong", type: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const isReadyToSubmit = !isUploading && (!isContentEmpty || imageUrls.length > 0) && (!scheduleConfig.isScheduled || (scheduleConfig.isScheduled && !!scheduleConfig.times.cute));

  // --- SUB-COMPONENTS ---
  const renderScheduleModal = () => {
    if (!showScheduleModal) return null;
    const minTime = new Date().toISOString().slice(0, 16);

    return (
      <div className="absolute right-0 bottom-full mb-3 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">Schedule Post</h3>
          <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center justify-between mb-4 bg-gray-50 p-2 rounded-lg">
          <span className="text-xs font-semibold text-gray-600">Enable Scheduling</span>
          <input type="checkbox" checked={scheduleConfig.isScheduled} onChange={(e) => updateScheduleConfig({ ...scheduleConfig, isScheduled: e.target.checked })} className="w-4 h-4 accent-brand-orange" />
        </div>

        {scheduleConfig.isScheduled && (
          <div className="space-y-4">
            {postToLinkedIn && (
               <div className="flex items-center justify-between bg-blue-50/50 p-2 rounded-lg">
                 <span className="text-xs font-semibold text-gray-600">Same time for all platforms</span>
                 <input type="checkbox" checked={scheduleConfig.syncTimes} onChange={(e) => updateScheduleConfig({ ...scheduleConfig, syncTimes: e.target.checked })} className="w-4 h-4 accent-brand-blue" />
               </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1">
                CuTe Feed {!scheduleConfig.syncTimes && postToLinkedIn && "(Separate)"}
              </label>
              <input type="datetime-local" min={minTime} value={scheduleConfig.times.cute} onChange={(e) => updateScheduleConfig({ ...scheduleConfig, times: { ...scheduleConfig.times, cute: e.target.value } })} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-brand-orange outline-none" />
            </div>

            {!scheduleConfig.syncTimes && postToLinkedIn && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0A66C2] flex items-center gap-1"><LinkedinIcon className="w-5 h-5"/> LinkedIn</label>
                <input type="datetime-local" min={minTime} value={scheduleConfig.times.linkedin} onChange={(e) => updateScheduleConfig({ ...scheduleConfig, times: { ...scheduleConfig.times, linkedin: e.target.value } })} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#0A66C2] outline-none" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderActionToolbar = (layout: "compact" | "expanded") => (
  <div className={`flex items-center justify-between ${layout === "compact" ? "mt-4 ml-0 sm:ml-16" : "mt-6"} relative`}>
    
    {/* LEFT SIDE: Attachments & Socials */}
    <div className="flex items-center gap-1 sm:gap-2">
      <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-brand-blue hover:text-brand-orange hover:bg-orange-50 px-2 sm:px-3 py-1.5 rounded-full font-semibold transition-colors disabled:opacity-50 text-sm" disabled={isUploading}>
        <ImageIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Photo</span>
      </button>
      <input type="file" accept="image/*" multiple ref={fileInputRef} className="hidden" onChange={handleImageSelect} />

      {/* Upward Hover/Click Socials Menu */}
      <div 
        className="relative flex items-center justify-center"
        onMouseEnter={() => setIsSocialMenuOpen(true)}
        onMouseLeave={() => setIsSocialMenuOpen(false)}
      >
        <button 
          type="button" 
          onClick={() => setIsSocialMenuOpen((prev) => !prev)}
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${postToLinkedIn ? 'bg-blue-50 text-[#0A66C2]' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
        >
          {postToLinkedIn ? <LinkedinIcon className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
        </button>
        
        <div className="absolute bottom-full w-full h-3"></div>

        <div className={`absolute bottom-[calc(100%+0.25rem)] flex flex-col gap-2 bg-white border border-gray-100 shadow-xl rounded-full p-1.5 transition-all duration-200 z-20 ${isSocialMenuOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}`}>
          <button 
            type="button" 
            onClick={() => {
              handleLinkedInToggle();
              setIsSocialMenuOpen(false);
            }}
            className={`p-2 rounded-full transition-colors flex items-center justify-center ${postToLinkedIn ? 'bg-blue-50 text-[#0A66C2]' : 'text-gray-400 hover:text-[#0A66C2] hover:bg-blue-50'}`}
            title={isLinkedInConnected ? (postToLinkedIn ? "Disable LinkedIn" : "Enable LinkedIn") : "Connect LinkedIn"}
          >
            <LinkedinIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    {/* RIGHT SIDE: Post Actions */}
    <div className="flex items-center gap-3 sm:gap-4 relative justify-end">
      
      {/* DESKTOP ONLY: Text-based Clear Draft */}
      {hasDraft && (
        <button type="button" onClick={clearDraft} className="hidden sm:block text-xs font-bold text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap">
          Clear Draft
        </button>
      )}

      {renderScheduleModal()}

      {/* Ultra-Tight Apple Style Split Pill */}
      <div className={`shrink-0 flex items-stretch bg-brand-orange rounded-full transition-all divide-x divide-white/20 overflow-hidden ${!isReadyToSubmit ? 'opacity-50 grayscale-[15%]' : 'shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}>
        <button 
          type="button" 
          onClick={(e) => handleSubmit(e)} 
          disabled={!isReadyToSubmit} 
          className="text-white pl-4 pr-2.5 py-1.5 text-[13px] sm:text-sm font-bold flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed hover:bg-orange-600 disabled:hover:bg-transparent"
        >
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>{scheduleConfig.isScheduled ? "Schedule" : "Post"}</span>
        </button>

        <button 
          type="button" 
          onClick={() => setShowScheduleModal(!showScheduleModal)} 
          disabled={!isReadyToSubmit && !scheduleConfig.isScheduled}
          className={`text-white pr-3 pl-2.5 flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent ${showScheduleModal || scheduleConfig.isScheduled ? 'bg-orange-600' : 'hover:bg-orange-600'}`}
          title="Schedule Post Options"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  </div>
);

  return (
    <>
      {/* COMPACT MODE */}
      <div className={`max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-4 sm:p-6 relative ${isExpanded ? 'hidden' : 'block'}`}>
        
        {/* Top Right Badges (No longer overlapping!) */}
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6 flex items-center gap-2 z-10">
          {hasDraft && (
            <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-green-500 bg-green-50 px-2 py-1 rounded-full animate-in fade-in">
              <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">Saved</span>
            </span>
          )}
          <button onClick={() => setIsExpanded(true)} className="text-gray-400 hover:text-brand-blue transition-colors ml-1" title="Expand Editor">
            <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        
        {/* The pr-[90px] padding forces title wrapping on mobile, protecting the top-right icons */}
        <h2 className="text-xl sm:text-2xl font-display font-bold text-brand-blue mb-4 sm:mb-6 pr-[90px] sm:pr-0">Create a CuTe Post</h2>
        
        <div className="flex gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 border-2 border-brand-orange/20">
            {userData?.Photo ? <img src={userData.Photo} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center font-bold">{userData?.Name?.charAt(0).toUpperCase() || "U"}</div>}
          </div>
          
          <div className="relative w-full bg-slate-50 border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-orange/50 focus-within:border-brand-orange transition-all h-28 sm:h-32 flex">
            <RichTextEditor value={content} onChange={handleContentChange} showToolbar={false} />
            
            {/* MOBILE ONLY: Contextual Floating Trash Icon inside the editor */}
            {hasDraft && (
              <button 
                type="button" 
                onClick={clearDraft} 
                className="absolute bottom-2 right-2 sm:hidden bg-white border border-gray-200 text-gray-400 hover:text-red-500 p-1.5 rounded-lg shadow-sm transition-colors z-10"
                title="Clear Draft"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {imageUrls.length > 0 && (
          <div 
            className="flex gap-3 overflow-x-auto py-2 ml-0 sm:ml-16 mt-3 snap-x hide-scrollbar"
            onWheel={(e) => {
              // Magically converts vertical mouse wheel into horizontal scrolling!
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            {imageUrls.map((preview, index) => (
              <div key={index} className="relative shrink-0 snap-center rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-slate-50 w-40 h-40 sm:w-48 sm:h-48 group">
                {/* Inside your imagePreviews.map block, update the <img> tag to this: */}
                <img 
                  src={preview} 
                  alt={`Preview ${index + 1}`} 
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                  onClick={() => setViewerIndex(index)}
                />
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); removeImage(index); }} 
                  className="absolute top-2 right-2 bg-gray-900/60 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
                 
              </div>
            ))}
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
              <div className="flex items-center gap-4">
                {hasDraft && (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-500 bg-green-50 px-2.5 py-1 rounded-full animate-in fade-in">
                    <CheckCircle2 className="w-3 h-3" /> Saved
                  </span>
                )}
                <button onClick={() => setIsExpanded(false)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full font-bold text-sm transition-colors">
                  <Minimize2 className="w-4 h-4" /> Minimize
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col mb-4 border border-gray-200 rounded-2xl shadow-inner bg-white overflow-hidden min-h-[40vh]">
              <RichTextEditor value={content} onChange={handleContentChange} showToolbar={true} className="text-lg" />
            </div>

            <div className="space-y-4 shrink-0">
              {imageUrls.length > 0 && (
              <div 
                className="flex gap-3 overflow-x-auto py-2 ml-0 sm:ml-16 mt-3 snap-x hide-scrollbar"
                onWheel={(e) => {
                  // Magically converts vertical mouse wheel into horizontal scrolling!
                  if (e.deltaY !== 0) {
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
              >
                {imageUrls.map((preview, index) => (
                  <div key={index} className="relative shrink-0 snap-center rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-slate-50 w-40 h-40 sm:w-48 sm:h-48 group">
                    {/* Inside your imageUrls.map block, update the <img> tag to this: */}
                    <img 
                      src={preview} 
                      alt={`Preview ${index + 1}`} 
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                      onClick={() => setViewerIndex(index)}
                    />
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); removeImage(index); }} 
                      className="absolute top-2 right-2 bg-gray-900/60 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  
                  </div>
                ))}
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

      {/* ==========================================
          FULL SCREEN APPLE-STYLE IMAGE VIEWER 
      ========================================== */}
      {viewerIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setViewerIndex(null)}>
          
          {/* Top Bar: Controls & Close Button */}
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
            
            {/* Left Side: Counter & Sorting/Adding Controls */}
            <div className="flex items-center gap-4 sm:gap-6">
              <span className="text-white/90 font-medium text-sm sm:text-base tracking-widest bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">
                {viewerIndex + 1} / {imageUrls.length}
              </span>
              
              <div className="flex items-center gap-1 sm:gap-2 bg-black/40 rounded-full p-1 backdrop-blur-md">
                <button onClick={(e) => moveImage(e, viewerIndex, "left")} disabled={viewerIndex === 0} className="p-2 text-white disabled:text-white/20 hover:bg-white/20 rounded-full transition-colors" title="Move Left">
                  <MoveLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button onClick={(e) => moveImage(e, viewerIndex, "right")} disabled={viewerIndex === imageUrls.length - 1} className="p-2 text-white disabled:text-white/20 hover:bg-white/20 rounded-full transition-colors" title="Move Right">
                  <MoveRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {imageUrls.length < 9 && (
                <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-orange hover:bg-orange-600 px-3 py-1.5 rounded-full transition-colors shadow-lg">
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Photo</span>
                </button>
              )}
            </div>

            {/* Right Side: Delete & Close */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={(e) => removeImageFromViewer(e)} className="text-white/80 hover:text-red-500 transition-colors p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md" title="Delete Photo">
                <Trash2 className="w-5 h-5 sm:w-5 sm:h-5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex(null); }} className="text-white hover:text-brand-orange transition-colors p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Previous Button */}
          {viewerIndex > 0 && (
            <button 
              onClick={prevViewerImage}
              className="absolute left-2 sm:left-8 text-white p-3 sm:p-4 rounded-full bg-white/5 hover:bg-white/20 backdrop-blur-md transition-all hover:scale-110 z-10"
            >
              <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          )}

          {/* Main Focused Image */}
          <div className="relative w-full max-w-6xl px-16 sm:px-28 flex justify-center items-center h-full" onClick={(e) => e.stopPropagation()}>
            <img 
              src={imageUrls[viewerIndex]} 
              alt="Full screen view" 
              className="max-h-[75vh] sm:max-h-[85vh] max-w-full object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-200"
            />
          </div>

          {/* Next Button */}
          {viewerIndex < imageUrls.length - 1 && (
            <button 
              onClick={nextViewerImage}
              className="absolute right-2 sm:right-8 text-white p-3 sm:p-4 rounded-full bg-white/5 hover:bg-white/20 backdrop-blur-md transition-all hover:scale-110 z-10"
            >
              <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          )}

          {/* Bottom Desktop Thumbnail Strip (The "Left and Right" preview) */}
          {imageUrls.length > 1 && (
            <div className="absolute bottom-6 sm:bottom-8 left-0 right-0 flex justify-center gap-2 sm:gap-3 px-4 z-10" onClick={(e) => e.stopPropagation()}>
              {imageUrls.map((thumb, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setViewerIndex(idx)}
                  className={`h-12 w-12 sm:h-16 sm:w-16 rounded-lg overflow-hidden transition-all duration-300 shadow-lg ${viewerIndex === idx ? 'ring-2 ring-brand-orange scale-110 opacity-100' : 'opacity-40 hover:opacity-100 hover:-translate-y-1'}`}
                >
                  <img src={thumb} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CreatePost;