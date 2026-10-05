import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, PhoneCall, BrainCircuit, Compass, PlayCircle, FileCheck, HeartHandshake, LogIn, Mail, KeyRound, X } from "lucide-react";
import DiscoveryOrchestrator from "./Stage1_DiscoveryCall/DiscoveryOrchestrator";
import AssessmentForm from "./Stage2_Assessment/AssessmentForm";
import RecommendationView from "./Stage3_Recommendation/RecommendationView";
import ClassesBeginView from "./Stage4_Classes/ClassesBeginView";
import ConfirmationView from "./Stage5_Confirmation/ConfirmationView";
import ObservationView from "./Stage6_Observation/ObservationView";

export interface AdmissionData {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  childAge?: number;
  currentSchooling?: string;
  admissionStage: number; 
  meetLink?: string;
  meetingDateISO?: string;
  leadDetails?: any;
  stage2_Assessment?: any;
  stage3_Recommendation?: any;
  stage4_ClassesBegin?: any;
}

const STAGES = [
  { id: 1, title: "Discovery Call", icon: PhoneCall },
  { id: 2, title: "Assessment", icon: BrainCircuit },
  { id: 3, title: "Recommendation", icon: Compass },
  { id: 4, title: "Classes Begin", icon: PlayCircle },
  { id: 5, title: "Confirmation", icon: FileCheck },
  { id: 6, title: "Observation", icon: HeartHandshake }
];

const AdmissionPortal: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [admissionData, setAdmissionData] = useState<AdmissionData | null>(null);

  // 🚨 NEW: Resume Application State
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumeStep, setResumeStep] = useState<"email" | "otp">("email");
  const [resumeEmail, setResumeEmail] = useState("");
  const [resumeOtp, setResumeOtp] = useState("");
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState("");

  const fetchAdmissionProgress = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    const token = localStorage.getItem("jwtoken");
    
    if (!token) {
      setCurrentStage(1);
      setAdmissionData(null);
      if (showLoader) setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch User Identity (Name, Email, Phone)
      const profileRes = await fetch(`${import.meta.env.VITE_API}get-user-profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      // 2. Fetch Admissions Pipeline Progress (Stage, Meet Link, Dates)
      const progressRes = await fetch(`${import.meta.env.VITE_API}api/my-admission-progress`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (profileRes.ok && progressRes.ok) {
        const user = await profileRes.json();
        const progress = await progressRes.json();

        // Merge them perfectly!
        const mergedData = { 
          ...user,
          ...progress,
          admissionStage: progress.admissionStage || 1,
          meetLink: progress.meetLink,
          meetingDateISO: progress.meetingDateISO,
          stage2_Assessment: progress.stage2_Assessment 
        };

        setAdmissionData(mergedData);
        setCurrentStage(mergedData.admissionStage);
      } else {
        localStorage.removeItem("jwtoken");
        setCurrentStage(1);
      }
    } catch (error) {
      console.error("Failed to fetch admission status:", error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Run immediately on load WITH the loading screen
    fetchAdmissionProgress(true);

    // 2. Poll every 10 seconds SILENTLY in the background
    const interval = setInterval(() => {
      fetchAdmissionProgress(false); // <-- Pass false!
    }, 10000);

    // 3. Re-fetch immediately if they switch tabs, also SILENTLY
    const handleFocus = () => fetchAdmissionProgress(false); // <-- Pass false!
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleSendOtp = async () => {
    if (!resumeEmail.includes("@")) return setResumeError("Please enter a valid email.");
    
    // Safety check for active sessions
    if (admissionData?.email && admissionData.email.toLowerCase() !== resumeEmail.toLowerCase().trim()) {
       const confirmLogout = window.confirm(`You are logged in as ${admissionData.email}. Proceeding will log you out. Continue?`);
       if (!confirmLogout) return;
       localStorage.removeItem("jwtoken"); 
    }

    setIsResuming(true);
    setResumeError("");
    
    try {
      // 🚨 PERFECT MATCH: Hitting your exact existing route
      const res = await fetch(`${import.meta.env.VITE_API}generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resumeEmail.toLowerCase().trim() })
      });

      if (res.ok) {
        setResumeStep("otp"); // Move to OTP input screen
      } else {
        const data = await res.json();
        setResumeError(data.error || "Failed to send OTP.");
      }
    } catch (err) {
      setResumeError("Network error. Please try again.");
    } finally {
      setIsResuming(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (resumeOtp.length < 4) return setResumeError("Please enter the full OTP.");
    setIsResuming(true);
    setResumeError("");
    
    try {
      // NOTE: Point this to your route that verifies the OTP and returns the JWT
      const res = await fetch(`${import.meta.env.VITE_API}verify-otp-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resumeEmail.toLowerCase().trim(), otp: resumeOtp })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("jwtoken", data.token);
        
        // Clean up and reload data!
        setShowResumeModal(false);
        setResumeStep("email");
        setResumeOtp("");
        // fetchAdmissionProgress(); // This auto-shifts them to Stage 2, 3, etc.
        window.location.reload();
      } else {
        setResumeError("Invalid or expired OTP.");
      }
    } catch (err) {
      setResumeError("Network error. Please try again.");
    } finally {
      setIsResuming(false);
    }
  };

  const GlobalStepper = () => (
    <div className="max-w-5xl mx-auto mb-14 px-2">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-6 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0 hidden md:block"></div>
        <div 
          className="absolute left-0 top-6 -translate-y-1/2 h-1 bg-brand-orange rounded-full z-0 transition-all duration-700 ease-in-out hidden md:block"
          style={{ width: `${((currentStage - 1) / (STAGES.length - 1)) * 100}%` }}
        ></div>
        
        {STAGES.map((s) => {
          const Icon = s.icon;
          const isActive = currentStage === s.id;
          const isPast = currentStage > s.id;
          return (
            <div key={s.id} className="relative z-10 flex flex-col items-center">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold transition-all duration-500 border-4 ${
                isActive ? "bg-[#ed7f23] border-orange-100 text-white shadow-lg scale-110" : 
                isPast ? "bg-[#1765a4] border-blue-50 text-white" : 
                "bg-white border-gray-100 text-gray-400"
              }`}>
                <Icon size={isActive || isPast ? 20 : 18} />
              </div>
              <div className={`hidden md:flex flex-col items-center absolute top-14 w-32 text-center transition-colors duration-300 ${
                isActive ? "text-[#ed7f23]" : isPast ? "text-[#1765a4]" : "text-gray-400"
              }`}>
                <span className="font-black text-[11px] uppercase tracking-widest mb-0.5">Stage {s.id}</span>
                <span className="font-bold text-xs leading-tight h-8 flex items-start justify-center">{s.title}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="md:hidden text-center mt-6">
        <p className="text-sm font-black text-[#ed7f23] uppercase tracking-widest">Stage {currentStage}</p>
        <h2 className="text-xl font-display font-bold text-[#1765a4]">{STAGES[currentStage - 1].title}</h2>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#f7f4f1]">
        <Loader2 className="w-12 h-12 text-[#ed7f23] animate-spin mb-4" />
        <h2 className="text-[#1765a4] text-xl font-bold font-display">Loading your journey...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4f1] pt-5 px-4 pb-20 overflow-hidden relative">
      
      {/* 🚨 NEW: Resume Button (Only shows if they aren't logged in) */}
      {currentStage === 1 && (
        <div className="max-w-5xl mx-auto flex justify-end mb-4 pr-2">
          <button 
            onClick={() => setShowResumeModal(true)}
            className="flex items-center gap-2 bg-white text-[#1765a4] border border-blue-100 px-4 py-2 rounded-full font-bold text-sm shadow-sm hover:shadow hover:bg-blue-50 transition-all active:scale-95"
          >
            <LogIn size={16} />
            Resume Application
          </button>
        </div>
      )}

      <GlobalStepper />

      <AnimatePresence mode="wait">
        <motion.div key={`stage-${currentStage}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
          {currentStage === 1 && <DiscoveryOrchestrator admissionData={admissionData} />}
          {currentStage === 2 && <AssessmentForm admissionData={admissionData} onComplete={fetchAdmissionProgress} />}
          {currentStage === 3 && <RecommendationView admissionData={admissionData} onComplete={fetchAdmissionProgress} />}
          {currentStage === 4 && <ClassesBeginView admissionData={admissionData} />}
          {currentStage === 5 && <ConfirmationView admissionData={admissionData} />}
          {currentStage === 6 && <ObservationView admissionData={admissionData} />}
        </motion.div>
      </AnimatePresence>

      {/* 🚨 NEW: Resume Application Modal */}
      <AnimatePresence>
        {showResumeModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowResumeModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition"
              >
                <X size={18} />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1765a4]">
                  {resumeStep === "email" ? <Mail size={28} /> : <KeyRound size={28} />}
                </div>
                <h3 className="text-2xl font-display font-bold text-slate-800">Welcome Back</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {resumeStep === "email" ? "Enter your email to resume your application." : "Enter the verification code sent to your email."}
                </p>
              </div>

              {resumeError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl text-center border border-red-100">
                  {resumeError}
                </div>
              )}

              {resumeStep === "email" ? (
                <div className="space-y-4">
                  <input 
                    type="email" 
                    placeholder="parent@example.com"
                    value={resumeEmail}
                    onChange={(e) => setResumeEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl font-medium outline-none focus:border-[#1765a4] transition"
                  />
                  <button 
                    onClick={handleSendOtp}
                    disabled={isResuming || !resumeEmail}
                    className="w-full bg-[#1765a4] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center"
                  >
                    {isResuming ? <Loader2 size={20} className="animate-spin" /> : "Send Code"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Enter 4-digit code"
                    maxLength={4}
                    value={resumeOtp}
                    onChange={(e) => setResumeOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl font-black text-center tracking-[0.5em] text-xl outline-none focus:border-[#1765a4] transition"
                  />
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={isResuming || resumeOtp.length < 4}
                    className="w-full bg-[#ed7f23] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center"
                  >
                    {isResuming ? <Loader2 size={20} className="animate-spin" /> : "Verify & Resume"}
                  </button>
                  <button 
                    onClick={() => { setResumeStep("email"); setResumeOtp(""); setResumeError(""); }}
                    className="w-full text-slate-400 text-sm font-bold hover:text-slate-600 transition"
                  >
                    Change Email
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdmissionPortal;