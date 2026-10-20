import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon, X, Loader2, Send, Clock } from "lucide-react";
import Muialert from "./Muialert";
import { UserData } from "../App";

interface CreatePostProps {
  userData: UserData;
  onPostCreated: () => void;
}

const CreatePost = ({ userData, onPostCreated }: CreatePostProps) => {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // 🚨 NEW: Scheduling States
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imageFile) {
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

        const cloudinaryRes = await fetch(
          "https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", 
          { method: "POST", body: formData }
        );

        if (!cloudinaryRes.ok) throw new Error("Failed to upload image to Cloudinary");
        const cloudinaryData = await cloudinaryRes.json();
        finalImageUrl = cloudinaryData.secure_url;
      }

      const token = localStorage.getItem("jwtoken");
      if (!token) {
        navigate("/signin");
        return;
      }

      const postData = {
        content: content,
        imageUrl: finalImageUrl, 
        scheduledFor: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : null
      };

      const response = await fetch(`${import.meta.env.VITE_API}posts`, { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) throw new Error("Failed to create post");

      setContent("");
      removeImage();
      setShowSchedule(false);
      setScheduledFor("");
      
      const isScheduled = showSchedule && scheduledFor;
      setAlert({ 
        show: true, 
        message: isScheduled ? "Post scheduled successfully!" : "Post shared successfully!", 
        type: "success" 
      });
      
      onPostCreated();

    } catch (error: any) {
      setAlert({ show: true, message: error.message || "Something went wrong", type: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-6">
      <h2 className="text-2xl font-display font-bold text-brand-blue mb-6">Create a CuTe Post</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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
          
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Share something CuTe..."
            className="w-full bg-slate-50 border border-gray-200 rounded-2xl p-4 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange transition-all resize-none custom-scrollbar"
            rows={4}
            disabled={isUploading}
          />
        </div>

        {imagePreview && (
          <div className="relative ml-16 mt-2 rounded-2xl overflow-hidden shadow-sm border border-gray-100 inline-block max-w-full">
            <img src={imagePreview} alt="Preview" className="max-h-80 object-contain" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 bg-gray-900/60 hover:bg-red-500 text-white p-1.5 rounded-full backdrop-blur-sm transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 🚨 NEW: Schedule Picker Dropdown */}
        {showSchedule && (
          <div className="ml-16 mt-2 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in slide-in-from-top-2">
            <label className="block text-xs font-bold text-brand-blue uppercase tracking-widest mb-2">
              Publish Date & Time
            </label>
            <div className="flex items-center gap-3">
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <button
                type="button"
                onClick={() => { setShowSchedule(false); setScheduledFor(""); }}
                className="text-gray-400 hover:text-red-500 transition-colors p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <hr className="border-gray-100 my-4" />

        <div className="flex items-center justify-between ml-16">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-brand-blue hover:text-brand-orange hover:bg-orange-50 px-4 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50"
              disabled={isUploading}
            >
              <ImageIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Photo</span>
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageSelect}
            />

            {/* 🚨 NEW: Schedule Toggle Button */}
            <button
              type="button"
              onClick={() => setShowSchedule(!showSchedule)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors disabled:opacity-50 ${showSchedule ? 'text-brand-orange bg-orange-50' : 'text-brand-blue hover:text-brand-orange hover:bg-orange-50'}`}
              disabled={isUploading}
            >
              <Clock className="w-5 h-5" />
              <span className="hidden sm:inline">Schedule</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isUploading || (!content.trim() && !imageFile) || (showSchedule && !scheduledFor)}
            className="flex items-center gap-2 bg-brand-orange text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-orange-600 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{showSchedule && scheduledFor ? "Schedule" : "Post"}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {alert.show && (
        <div className="mt-4">
          <Muialert
            message={alert.message}
            severity={alert.type}
            onClose={() => setAlert({ ...alert, show: false })}
          />
        </div>
      )}
    </div>
  );
};

export default CreatePost;