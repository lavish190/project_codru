import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Pen, User, LogOut, FileText, Loader2, Shield, Users, Home } from "lucide-react";
import Muialert from "./Muialert";
import { optimizeImage } from "../utils/image";

interface NavprofileProps {
  setShowProfile: (show: boolean) => void;
  showProfile: boolean;
  closeNavProfile: () => void;
  userData: any;
  setUserData: any;
}

export default function Navprofile({
  setShowProfile,
  showProfile,
  closeNavProfile,
  userData,
  setUserData,
}: NavprofileProps) {
  const [showAlert, setShowAlert] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navProfileRef = useRef<HTMLDivElement>(null);

  // --- ROLE CHECKS ---
  const isStudent = userData?.role === "Student";
  const isTeacher = userData?.role === "Teacher";
  const isParent = userData?.role === "Parent";
  const isAdmin = userData?.isAdmin;

  const SignOut = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API}signout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      localStorage.removeItem("jwtoken"); 
      localStorage.removeItem("Username");
      localStorage.removeItem("Photo");

      closeNavProfile();
      navigate("/signin");
      window.location.reload(); 
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const handlePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "cute_profiles"); 
      formData.append("cloud_name", "da6jhcsmm");       

      const cloudinaryRes = await fetch(
        "https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", 
        {
          method: "POST",
          body: formData,
        }
      );

      const cloudinaryData = await cloudinaryRes.json();

      if (!cloudinaryRes.ok) throw new Error("Failed to upload to Cloudinary");

      const secureUrl = cloudinaryData.secure_url;

      const dbRes = await fetch(`${import.meta.env.VITE_API}profile-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: localStorage.getItem("Username"),
          photo: secureUrl, 
        }),
      });

      const jsondata = await dbRes.json();

      if (dbRes.ok) {
        setUserData((prevData: any) => ({
          ...prevData,
          Photo: secureUrl,
        }));
        
        localStorage.setItem("Photo", secureUrl);
        setAlertMessage("Profile picture updated!");
        setShowAlert(true);
      } else {
        throw new Error(jsondata.error || "Failed to update database");
      }
    } catch (err: any) {
      console.error(err);
      setAlertMessage(err.message || "Failed to update image");
      setShowAlert(true);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePenClick = () => fileInputRef.current?.click();

  // 🚨 FIX: Using "click" instead of "mousedown" prevents the double-toggle bug!
  const handleClickOutside = (event: MouseEvent) => {
    if (navProfileRef.current && !navProfileRef.current.contains(event.target as Node)) {
      closeNavProfile();
    }
  };

  useEffect(() => {
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Helper function for navigating to specific dashboard tabs
  const handleNav = (targetView: string) => {
    closeNavProfile();
    navigate("/dashboard", { state: { targetView } });
  };

  if (!showProfile) return null;

  return (
    <div 
      ref={navProfileRef} 
      className="
        fixed z-60 bg-white overflow-hidden flex flex-col p-5 border border-gray-100
        /* 📱 MOBILE: Bottom Sheet */
        bottom-16 left-0 w-full max-h-[85vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-slide-up
        /* 💻 DESKTOP: Top Right Dropdown */
        md:bottom-auto md:top-20 md:right-8 md:left-auto md:w-80 md:rounded-3xl md:shadow-2xl md:animate-fade-in-down
      "
    >
      {/* Close Button */}
      <button 
        onClick={closeNavProfile}
        className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Profile Header */}
      <div className="flex flex-col items-center mt-2 mb-4 shrink-0">
        <div className="relative group cursor-pointer" onClick={handlePenClick}>
          <div className="w-20 h-20 rounded-full border-4 border-brand-orange/20 overflow-hidden relative">
            {isUploading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
              </div>
            )}
            {userData?.Photo ? (
              <img src={optimizeImage(userData.Photo)} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-orange-50 flex items-center justify-center text-brand-orange">
                <User className="w-8 h-8" />
              </div>
            )}
          </div>
          
          <div className="absolute bottom-0 right-0 bg-brand-blue text-white p-1.5 rounded-full shadow-md group-hover:bg-brand-orange transition-colors z-20">
            <Pen className="w-3 h-3" />
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handlePhotoInput} />
        </div>
        
        <h3 className="mt-3 font-display font-bold text-lg text-gray-800">Hi, {userData?.Name || "Explorer"}</h3>
        <p className="text-xs text-gray-400 font-medium">@{localStorage.getItem("Username")}</p>
        
        {/* Cute Role Badge */}
        <span className="mt-2 text-[10px] uppercase tracking-widest font-black text-brand-orange bg-brand-orange/10 px-3 py-1 rounded-full">
          {userData?.role || "User"} {isAdmin && "• ADMIN"}
        </span>
      </div>

      <hr className="border-gray-100 my-4 shrink-0" />

      {/* Action Buttons Container (Scrollable on tiny mobile screens) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pb-2">
        
        {/* 🚨 Dynamic Role-Based Buttons */}
        {isStudent && (
          <button
            onClick={() => handleNav("report")}
            className="flex items-center gap-3 w-full px-4 py-3 md:py-2 text-sm font-bold text-brand-blue bg-blue-50 rounded-xl hover:bg-brand-blue hover:text-white transition-colors"
          >
            <FileText className="w-4 h-4" /> See My Report
          </button>
        )}

        {isTeacher && (
          <button
            onClick={() => handleNav("management")}
            className="flex items-center gap-3 w-full px-4 py-3 md:py-2 text-sm font-bold text-brand-blue bg-blue-50 rounded-xl hover:bg-brand-blue hover:text-white transition-colors"
          >
            <Users className="w-4 h-4" /> Management
          </button>
        )}

        {isParent && (
          <button
            onClick={() => handleNav("village")}
            className="flex items-center gap-3 w-full px-4 py-3 md:py-2 text-sm font-bold text-brand-blue bg-blue-50 rounded-xl hover:bg-brand-blue hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" /> My Village
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => handleNav("audit-log")}
            className="flex items-center gap-3 w-full px-4 py-3 md:py-2 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-600 hover:text-white transition-colors"
          >
            <Shield className="w-4 h-4" /> Security Audit Log
          </button>
        )}

        {/* 🚨 Universal Manage & Sign Out Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button 
            onClick={() => handleNav("profile")}
            className="flex items-center justify-center gap-2 px-3 py-3 md:py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:border-brand-orange hover:text-brand-orange transition-colors"
          >
            <User className="w-4 h-4" /> Manage
          </button>
          
          <button 
            onClick={SignOut}
            className="flex items-center justify-center gap-2 px-3 py-3 md:py-2 text-sm font-medium text-red-600 border border-red-100 bg-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {showAlert && (
        <div className="mt-4 shrink-0">
          <Muialert message={alertMessage} severity="error" onClose={() => setShowAlert(false)} />
        </div>
      )}
    </div>
  );
}