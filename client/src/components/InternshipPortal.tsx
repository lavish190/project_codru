import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, FileText, CheckCircle, Clock, Eye, EyeOff, Lock, Mail,
  AlertCircle, ArrowRight, ShieldCheck, IndianRupee, Loader2, RefreshCw,
  Briefcase, MonitorPlay, Download, Star, ExternalLink, Heart
} from "lucide-react";
import { 
  TextField, Checkbox, FormControlLabel, RadioGroup, Radio, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Rating
} from "@mui/material";
import { Email } from "@mui/icons-material";
import FunDatePicker from "./FunDatePicker";
import dayjs from "dayjs";

type ApplicationStatus = 'new' | 'draft' | 'pending' | 'rejected' | 'approved' | 'feedback_submitted' | 'completed';

// 🚨 Add your actual Google My Business Review link here!
const GOOGLE_REVIEW_LINK = "https://g.page/r/Ce7hWhc2uInsEAI/review";

const InternshipPortal = () => {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus>('new');
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  
  // Modals
  const [showReuploadAlert, setShowReuploadAlert] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showGoogleReviewModal, setShowGoogleReviewModal] = useState(false); 
  
  const [otpValue, setOtpValue] = useState("");
  const [tempExtractedData, setTempExtractedData] = useState<any>(null);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    resumeFile: null as File | null,
    driveId: "",
    driveLink: "",
    name: "",
    email: "",
    phone: "",
    sameAsWhatsapp: true,
    whatsapp: "",
    type: "internship", 
    topic: "",
    intent: "work",
    mode: "Remote",
    startDate: "",
    endDate: "",
    days: 0,
    price: 0,
    feedback: "",
    rating: 5,
    futureInterest: "yes",
    majorLearnings: ""
  });

  // 1. FETCH STATUS & HYDRATE ALL SAVED DATA
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}internship/status`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          if (data.applicationId) setApplicationId(data.applicationId);

          if (data.savedData) {
            setFormData(prev => ({
              ...prev,
              name: data.savedData.personalDetails?.name || "",
              email: data.savedData.personalDetails?.email || "",
              phone: data.savedData.personalDetails?.phone || "",
              whatsapp: data.savedData.personalDetails?.whatsapp || "",
              type: data.savedData.programDetails?.type || "internship",
              topic: data.savedData.programDetails?.topic || "",
              days: data.savedData.programDetails?.durationDays || 0,
              intent: data.savedData.programDetails?.intent || "work",
              mode: data.savedData.programDetails?.mode || "Remote",
              // 🚨 Hydrating dates so they survive a refresh!
              startDate: data.savedData.programDetails?.startDate || "",
              endDate: data.savedData.programDetails?.endDate || "",
              driveId: data.savedData.resumeDriveId || "",
              driveLink: data.savedData.resumeDriveLink || "",
            }));
          }

          if (data.status === "draft") {
            setStep(2);
          } else if (data.status === "pending" || data.status === "rejected") {
            setStep(3);
          } else if (data.status === "approved") {
            if (data.savedData?.feedback?.rating) {
              setStep(4);
            } else {
              setStep(3);
            }
          } else if (data.status === "feedback_submitted" || data.status === "completed") {
            setStep(4);
          }
        }
      } catch (error) {
        console.error("Failed to fetch application status", error);
      }
    };
    fetchStatus();
  }, []);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        
        setFormData(prev => ({ 
          ...prev, 
          days: diffDays,
          price: prev.intent === "learn" ? diffDays * 500 : 0
        }));
      } else {
        setFormData(prev => ({ ...prev, days: 0, price: 0 }));
      }
    }
  }, [formData.startDate, formData.endDate, formData.intent]);

  useEffect(() => {
    if (timer && timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setTimer(null);
    }
  }, [timer]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return alert("Please upload a valid PDF file.");

    setFormData(prev => ({ ...prev, resumeFile: file }));
    setIsParsing(true);

    const uploadData = new FormData();
    uploadData.append("resume", file);

    try {
      const headers: any = {};
      const token = localStorage.getItem("jwtoken");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${import.meta.env.VITE_API}internship/parse-resume`, {
        method: "POST",
        headers,
        body: uploadData, 
      });

      const result = await response.json();

      if (response.ok) {
        if (result.requireOtp) {
          setTempExtractedData(result.extractedData);
          await triggerOtpEmail(result.email);
          setShowOtpModal(true);
        } else {
          setFormData(prev => ({ ...prev, ...result.extractedData, driveId: result.driveId, driveLink: result.driveLink }));
          setStep(2);
        }
      }
    } catch (error) {
      alert("Network error while uploading resume.");
    } finally {
      setIsParsing(false);
    }
  };

  const triggerOtpEmail = async (targetEmail: string) => {
    setIsOtpSending(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (res.ok) setTimer(60);
    } catch (error) {
      alert("Failed to send OTP.");
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleOtpSubmit = async (finalOtp: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-otp-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: tempExtractedData.email, otp: finalOtp }),
      });

      if (res.ok) {
        const data = await res.json();
        
        localStorage.setItem("jwtoken", data.token); 
        if (data.user?.username) localStorage.setItem("Username", data.user.username);
        
        alert("✅ OTP Correct! You are now logged in. Uploading your file to Drive...");

        if (formData.resumeFile) {
          const uploadData = new FormData();
          uploadData.append("resume", formData.resumeFile);
          
          const uploadRes = await fetch(`${import.meta.env.VITE_API}internship/parse-resume`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${data.token}` },
            body: uploadData, 
          });
          
          const uploadResult = await uploadRes.json();
          
          if (uploadRes.ok) {
            setFormData(prev => ({
              ...prev,
              name: uploadResult.extractedData.name || tempExtractedData.name,
              email: uploadResult.extractedData.email || tempExtractedData.email,
              phone: uploadResult.extractedData.phone || tempExtractedData.phone,
              driveId: uploadResult.driveId,
              driveLink: uploadResult.driveLink
            }));
            
            setShowOtpModal(false);
            setStep(2);
          } else {
             if (uploadResult.existingStatus) {
                alert(uploadResult.error);
                window.location.reload();
             } else {
                alert("File uploaded to Drive failed: " + (uploadResult.error || "Unknown error"));
             }
          }
        }
      } else {
        const errorData = await res.json();
        alert("❌ OTP Failed: " + (errorData.error || "Invalid OTP."));
      }
    } catch (error) {
      alert("Error verifying OTP. Check console.");
      console.error(error);
    }
  };

  const handleConfirmReupload = () => {
    setShowReuploadAlert(false);
    setStep(1);
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const submitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const headers: any = { "Content-Type": "application/json" };
      const token = localStorage.getItem("jwtoken");
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${import.meta.env.VITE_API}internship/submit-application`, {
        method: "POST",
        headers,
        body: JSON.stringify({ formData, driveId: formData.driveId, driveLink: formData.driveLink }),
      });

      const result = await response.json();
      
      if (response.ok) {
        if (result.requireNewUserSetup) {
          await triggerOtpEmail(result.email);
          setShowNewUserModal(true);
          setIsSubmitting(false);
          return;
        }
        setStatus('pending');
        setStep(3);
      } else {
        alert(result.error || "Failed to submit application");
      }
    } catch (error) {
      alert("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return alert("Application ID missing.");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API}internship/submit-feedback/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
        },
        body: JSON.stringify({
          feedback: {
            rating: formData.rating,
            majorLearnings: formData.majorLearnings,
            generalFeedback: formData.feedback,
            futureInterest: formData.futureInterest
          }
        }),
      });

      if (response.ok) {
        setShowGoogleReviewModal(true);
      } else alert("Failed to submit feedback");
    } catch (error) {
      alert("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const proceedToStep4 = () => {
    setShowGoogleReviewModal(false);
    setStep(4);
  };

  const handleLeaveGoogleReview = () => {
    window.open(GOOGLE_REVIEW_LINK, "_blank");
    proceedToStep4(); 
  };

  const handleStartNewApplication = async () => {
    if (applicationId) {
      try {
        await fetch(`${import.meta.env.VITE_API}internship/acknowledge-certificate/${applicationId}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
      } catch (err) {
        console.error("Failed to acknowledge certificate.");
      }
    }
    setStatus('new');
    setStep(1);
    setApplicationId(null);
    setFormData({
      resumeFile: null, driveId: "", driveLink: "", name: "", email: "", phone: "",
      sameAsWhatsapp: true, whatsapp: "", type: "internship", topic: "", intent: "work",
      mode: "Remote", startDate: "", endDate: "", days: 0, price: 0,
      feedback: "", rating: 5, futureInterest: "yes", majorLearnings: ""
    });
  };

  const handleNewUserSetupSubmit = async () => {
    if (newPassword !== confirmPassword) return alert("Passwords do not match!");
    if (newPassword.length < 6) return alert("Password must be at least 6 characters.");
    if (otpValue.length !== 4) return alert("Please enter the 4-digit OTP.");

    try {
      const res = await fetch(`${import.meta.env.VITE_API}internship/verify-new-user-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          formData, driveId: formData.driveId, driveLink: formData.driveLink, 
          otp: otpValue, password: newPassword 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("jwtoken", data.token); 
        localStorage.setItem("Username", data.user.username);
        window.location.reload();
      } else {
        alert(data.error || "Verification failed.");
      }
    } catch (error) {
      alert("Error setting up account.");
    }
  };

  const handleRequestCertificate = async () => {
    if (!applicationId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API}internship/request-certificate/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
        }
      });

      if (response.ok) {
        setStatus('feedback_submitted'); 
      } else {
        alert("Failed to submit request.");
      }
    } catch (error) {
      alert("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================
  // STEP RENDERERS
  // =====================================

  const renderStep1Upload = () => (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in-up">
      <h2 className="text-4xl font-display font-bold text-brand-blue mb-4">Let's get started.</h2>
      <p className="text-gray-500 mb-10 max-w-md">Upload your resume. Our AI will extract your details, link your account, and set up your portal automatically.</p>
      
      <div className="relative group w-full max-w-lg">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand-orange to-brand-blue rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative bg-white rounded-3xl p-12 border border-gray-100 shadow-xl flex flex-col items-center justify-center border-dashed border-2 hover:border-brand-orange transition-colors">
          {isParsing ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-16 h-16 text-brand-orange animate-spin mb-4" />
              <h3 className="font-bold text-gray-800">Reading your Resume...</h3>
              <p className="text-sm text-gray-500">Extracting details and setting up workspace</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-10 h-10 text-brand-blue" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Drop your PDF here</h3>
              <p className="text-sm text-gray-500 mb-6">Strictly .pdf format only</p>
              <label className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold cursor-pointer hover:bg-blue-800 transition shadow-lg">
                Browse Files
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep2Details = () => (
    <div className="max-w-3xl mx-auto py-4 animate-fade-in">
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FileText className="text-brand-orange w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold text-brand-blue">Verify your Details</h2>
              <p className="text-sm text-gray-500">We extracted this from your resume.</p>
            </div>
          </div>
          
          <Button 
            variant="outlined" 
            color="error" 
            startIcon={<RefreshCw size={16} />}
            onClick={() => setShowReuploadAlert(true)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 'bold' }}
          >
            Update Resume
          </Button>
        </div>

        <form onSubmit={submitStep2} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TextField label="Full Name" name="name" value={formData.name} onChange={handleInputChange} fullWidth required />
            <TextField label="Email Address" name="email" value={formData.email} onChange={handleInputChange} fullWidth required type="email" />
            
            <div className="flex flex-col gap-2">
              <TextField label="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} fullWidth required />
              <FormControlLabel 
                control={<Checkbox checked={formData.sameAsWhatsapp} onChange={(e) => setFormData(prev => ({ ...prev, sameAsWhatsapp: e.target.checked }))} sx={{ color: '#ed7f23', '&.Mui-checked': { color: '#ed7f23' } }} />} 
                label={<span className="text-sm font-medium text-gray-700">Same as WhatsApp number</span>} 
              />
            </div>
            
            {!formData.sameAsWhatsapp && (
              <TextField label="WhatsApp Number" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} fullWidth required />
            )}
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Program Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-2">Intent</p>
                <RadioGroup row name="intent" value={formData.intent} onChange={handleInputChange}>
                  <FormControlLabel value="work" control={<Radio sx={{color:'#1765a4'}}/>} label="I want to work for you" />
                  <FormControlLabel value="learn" control={<Radio sx={{color:'#1765a4'}}/>} label="I want to learn from you" />
                </RadioGroup>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-2">Program Type</p>
                <RadioGroup row name="type" value={formData.type} onChange={handleInputChange}>
                  <FormControlLabel value="internship" control={<Radio sx={{color:'#ed7f23'}}/>} label="Internship" />
                  <FormControlLabel value="training" control={<Radio sx={{color:'#ed7f23'}}/>} label="Training" />
                </RadioGroup>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
              <p className="text-sm font-bold text-gray-700 mb-2">Preferred Work Mode</p>
              <RadioGroup row name="mode" value={formData.mode} onChange={handleInputChange}>
                <FormControlLabel 
                  value="Remote" 
                  control={<Radio sx={{color:'#1765a4'}}/>} 
                  label={<span className="flex items-center gap-2"><MonitorPlay size={16}/> Remote (WFH)</span>} 
                />
                <FormControlLabel 
                  value="On-site" 
                  control={<Radio sx={{color:'#1765a4'}}/>} 
                  label={<span className="flex items-center gap-2"><Briefcase size={16}/> On-site (Office)</span>} 
                />
              </RadioGroup>
            </div>

            <div className="mb-8"> 
              <TextField label="Topic for Certificate" name="topic" value={formData.topic} onChange={handleInputChange} fullWidth required placeholder="e.g. MERN Stack Development" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
              <div className="w-full [&>div]:w-full">
                <FunDatePicker 
                  label="Start Date *"
                  value={formData.startDate} 
                  onChange={(newDate) => setFormData(prev => ({ ...prev, startDate: newDate || "" }))} 
                />
              </div>
              <div className="w-full [&>div]:w-full">
                <FunDatePicker 
                  label="End Date *"
                  value={formData.endDate} 
                  onChange={(newDate) => setFormData(prev => ({ ...prev, endDate: newDate || "" }))} 
                />
              </div>
            </div>

            {formData.days > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-brand-blue font-bold flex items-center gap-2"><Clock size={16}/> Duration Calculation</p>
                  <p className="text-xs text-gray-500 mt-1">This duration will be printed on your certificate.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-brand-blue">{formData.days} Days</p>
                  {formData.intent === "learn" && (
                    <p className="text-sm font-bold text-brand-orange flex items-center justify-end gap-1"><IndianRupee size={14}/> {formData.price} Total</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              disabled={isSubmitting}
              variant="contained" 
              endIcon={isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />} 
              sx={{ backgroundColor: '#1765a4', borderRadius: '12px', padding: '10px 30px', fontWeight: 'bold', textTransform: 'none' }}
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderStep3States = () => {
    if (status === 'pending') return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="bg-yellow-50 p-6 rounded-full mb-6 text-yellow-500"><Clock className="w-16 h-16" /></div>
        <h2 className="text-3xl font-display font-bold text-gray-800 mb-3">Application Under Review</h2>
        <p className="text-gray-500 max-w-md">Your request has been submitted successfully. Our admin team is reviewing your profile.</p>
      </div>
    );

    if (status === 'rejected') return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="bg-red-50 p-6 rounded-full mb-6 text-red-500"><AlertCircle className="w-16 h-16" /></div>
        <h2 className="text-3xl font-display font-bold text-gray-800 mb-3">Update on your Application</h2>
        <p className="text-gray-500 max-w-md mb-6">Unfortunately, we are unable to proceed with your application at this time.</p>
        <div className="bg-gray-100 px-6 py-3 rounded-full text-sm font-bold text-gray-600">You can re-apply after 30 Days.</div>
      </div>
    );

    return (
      <div className="max-w-3xl mx-auto py-4 animate-fade-in">
        <div className="bg-green-50 border border-green-200 p-6 rounded-3xl mb-8 flex items-start gap-4 shadow-sm">
          <CheckCircle className="text-green-500 w-8 h-8 shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-green-800 mb-1">Application Approved!</h3>
            <p className="text-green-700 text-sm">Please fill out this final feedback form <b>after</b> completing your tenure to unlock your certificate.</p>
          </div>
        </div>
        
        <form onSubmit={submitStep3} className="bg-white p-10 rounded-3xl border border-gray-100 shadow-xl">
          <h2 className="text-2xl font-bold text-brand-blue mb-8 border-b border-gray-100 pb-4">Completion Feedback</h2>
          
          <div className="flex flex-col gap-8">
            <div className="flex flex-col items-center p-6 bg-orange-50/50 rounded-2xl border border-orange-100">
              <Typography component="legend" sx={{ fontWeight: 'bold', color: '#ed7f23', mb: 2, fontSize: '1.1rem' }}>
                How was your overall experience? *
              </Typography>
              <Rating
                name="rating"
                value={formData.rating}
                onChange={(event, newValue) => {
                  setFormData(prev => ({ ...prev, rating: newValue || 5 }));
                }}
                size="large"
                sx={{ 
                  color: '#ed7f23', 
                  '& .MuiRating-icon': { fontSize: '3.5rem', mx: 0.5 },
                  '& .MuiRating-iconFilled': { filter: 'drop-shadow(0 2px 4px rgba(237, 127, 35, 0.3))' },
                  '& .MuiRating-iconHover': { transform: 'scale(1.15)', transition: 'transform 0.2s ease-in-out' }
                }}
              />
            </div>

            <TextField 
              label="Major Learnings (What did you learn?)" 
              name="majorLearnings" 
              value={formData.majorLearnings} 
              onChange={handleInputChange} 
              fullWidth 
              multiline 
              rows={3} 
              required 
            />
            
            <TextField 
              label="General Feedback (Any suggestions for us?)" 
              name="feedback" 
              value={formData.feedback} 
              onChange={handleInputChange} 
              fullWidth 
              multiline 
              rows={3} 
              required 
            />
            
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
              <p className="text-sm font-bold text-gray-700 mb-3">Would you be interested in a permanent role in the future?</p>
              <RadioGroup row name="futureInterest" value={formData.futureInterest} onChange={handleInputChange}>
                <FormControlLabel value="yes" control={<Radio sx={{color:'#1765a4'}}/>} label="Yes, definitely!" />
                <FormControlLabel value="maybe" control={<Radio sx={{color:'#1765a4'}}/>} label="Maybe later" />
                <FormControlLabel value="no" control={<Radio sx={{color:'#1765a4'}}/>} label="No, thanks" />
              </RadioGroup>
            </div>
            
          </div>

          <div className="flex justify-end pt-8 mt-4 border-t border-gray-100">
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              variant="contained" 
              sx={{ backgroundColor: '#ed7f23', borderRadius: '12px', padding: '12px 36px', fontSize: '1.05rem', fontWeight: 'bold', textTransform: 'none', boxShadow: '0 4px 14px rgba(237, 127, 35, 0.3)' }}
            >
              {isSubmitting ? "Saving..." : "Submit & Proceed"}
            </Button>
          </div>
        </form>
      </div>
    );
  };

  const renderStep4Certificate = () => {
    // 🚨 STATE 1: COMPLETED (With Dates & Blue Card Style)
    if (status === 'completed') {
      return (
        <div className="max-w-2xl mx-auto py-10 animate-fade-in text-center">
          <div className="bg-brand-blue p-1 rounded-3xl shadow-2xl">
            <div className="bg-white p-10 rounded-[22px] flex flex-col items-center">
              <div className="bg-green-50 p-6 rounded-full mb-6 text-green-500">
                <CheckCircle className="w-16 h-16" />
              </div>
              <h2 className="text-3xl font-display font-bold text-gray-800 mb-2">Certificate Issued! 🎉</h2>
              <p className="text-gray-500 max-w-md mb-6">
                Congratulations! Your official certificate has been generated and sent directly to your registered email address: <b>{formData.email}</b>.
              </p>
              
              <div className="w-full bg-gray-50 rounded-xl p-5 mb-8 text-left grid grid-cols-2 gap-4 border border-gray-100">
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">Awarded To</p>
                  <p className="text-lg font-bold text-brand-blue">{formData.name}</p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-400">Start Date</p>
                  <p className="font-bold text-gray-700">
                    {formData.startDate ? dayjs(formData.startDate).format("DD MMM YYYY") : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">End Date</p>
                  <p className="font-bold text-gray-700">
                    {formData.endDate ? dayjs(formData.endDate).format("DD MMM YYYY") : "N/A"}
                  </p>
                </div>

                <div className="col-span-2 border-t border-gray-200 pt-3 mt-1">
                  <p className="text-xs text-gray-400">Program Topic</p>
                  <p className="text-sm font-semibold text-gray-700">{formData.topic} ({formData.days} Days)</p>
                </div>
              </div>
              
              <div className="w-full">
                <Button 
                  onClick={handleStartNewApplication}
                  variant="outlined" 
                  fullWidth 
                  sx={{ borderRadius: '14px', padding: '12px', fontWeight: 'bold', textTransform: 'none', color: '#1765a4', borderColor: '#e2e8f0', '&:hover': { borderColor: '#1765a4', backgroundColor: '#f8fafc' } }}
                >
                  Apply for Another Program
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 🚨 STATE 2: FEEDBACK SUBMITTED (Pending Admin Certification)
    if (status === 'feedback_submitted') {
      return (
        <div className="max-w-2xl mx-auto py-12 animate-fade-in text-center">
          <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-xl flex flex-col items-center">
            <div className="bg-blue-50 p-6 rounded-full mb-6 text-brand-blue">
              <Clock className="w-16 h-16 animate-pulse" />
            </div>
            <h2 className="text-3xl font-display font-bold text-gray-800 mb-3">Certificate Request Pending</h2>
            <p className="text-gray-500 max-w-md mb-4">
              You have successfully verified your details! Our admin team is now assigning your roll number, grade, and issuing your official Certificate.
            </p>
            <p className="text-xs text-gray-400 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
              📧 An email containing your certificate attachment will be sent as soon as it's approved.
            </p>
          </div>
        </div>
      );
    }

    // 🚨 STATE 3: DEFAULT (APPROVED, Final Verification before Requesting Certificate)
    return (
      <div className="max-w-2xl mx-auto py-10 animate-fade-in text-center">
        <div className="bg-brand-blue p-1 rounded-3xl shadow-2xl">
          <div className="bg-white p-10 rounded-[22px] flex flex-col items-center">
            <ShieldCheck className="w-20 h-20 text-brand-orange mb-6" />
            <h2 className="text-3xl font-display font-black text-brand-blue mb-2">Final Verification</h2>
            <p className="text-gray-500 mb-8">Please double-check your details below before requesting your certificate.</p>
            
            <TextField 
              label="Certificate Name" 
              value={formData.name || "Fetching..."} 
              fullWidth 
              disabled 
              className="mb-8" 
              sx={{ "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "#1f2937", fontWeight: "bold", fontSize: "1.2rem", textAlign: "center" } }} 
            />
            
            <div className="w-full bg-gray-50 rounded-xl p-4 mb-8 text-left grid grid-cols-2 gap-4 border border-gray-100">
              <div>
                <p className="text-xs text-gray-400">Program</p>
                <p className="font-bold text-gray-700 capitalize">{formData.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Duration</p>
                <p className="font-bold text-gray-700">{formData.days} Days</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-400">Start Date</p>
                <p className="font-bold text-gray-700">
                  {formData.startDate ? dayjs(formData.startDate).format("DD MMM YYYY") : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">End Date</p>
                <p className="font-bold text-gray-700">
                  {formData.endDate ? dayjs(formData.endDate).format("DD MMM YYYY") : "N/A"}
                </p>
              </div>

              <div className="col-span-2 border-t border-gray-200 pt-3 mt-1">
                <p className="text-xs text-gray-400">Topic</p>
                <p className="font-bold text-brand-blue">{formData.topic}</p>
              </div>
            </div>

            <Button 
              onClick={handleRequestCertificate}
              disabled={isSubmitting}
              variant="contained" 
              fullWidth 
              sx={{ backgroundColor: '#1765a4', borderRadius: '14px', padding: '14px', fontSize: '1.1rem', fontWeight: 'black', textTransform: 'none' }}
            >
              {isSubmitting ? "Submitting..." : "Confirm & Request Certificate"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const stepTitles = [
    { id: 1, title: "Upload Resume" },
    { id: 2, title: "Verify Details" },
    { id: 3, title: "Review & Feedback" },
    { id: 4, title: "Certificate" }
  ];

  const StepperHeader = () => (
    <div className="max-w-4xl mx-auto mb-10 px-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-brand-orange rounded-full z-0 transition-all duration-500 ease-in-out"
          style={{ width: `${((step - 1) / (stepTitles.length - 1)) * 100}%` }}
        ></div>
        
        {stepTitles.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 ${
              step >= s.id ? "bg-brand-orange border-orange-100 text-white shadow-md scale-110" : "bg-white border-gray-100 text-gray-400"
            }`}>
              {step > s.id ? <CheckCircle size={18} /> : s.id}
            </div>
            <span className={`hidden md:block text-xs font-bold absolute -bottom-6 w-32 text-center ${
              step >= s.id ? "text-brand-blue" : "text-gray-400"
            }`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pt-28 px-4 pb-12">
      <StepperHeader />

      <AnimatePresence mode="wait">
        {step === 1 && <motion.div key="1" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>{renderStep1Upload()}</motion.div>}
        {step === 2 && <motion.div key="2" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>{renderStep2Details()}</motion.div>}
        {step === 3 && <motion.div key="3" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>{renderStep3States()}</motion.div>}
        {step === 4 && <motion.div key="4" initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}}>{renderStep4Certificate()}</motion.div>}
      </AnimatePresence>

      <Dialog 
        open={showGoogleReviewModal} 
        onClose={proceedToStep4} 
        slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px', maxWidth: '420px' } } }}
      >
        <div className="p-6 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-orange-50 text-brand-orange rounded-full flex items-center justify-center mb-5 relative">
            <Heart className="w-10 h-10 absolute animate-pulse opacity-20" size={60} />
            <Star className="w-10 h-10 fill-current" />
          </div>
          <h3 className="text-2xl font-display font-black text-brand-blue mb-3">You're Awesome!</h3>
          <p className="text-gray-500 mb-8 text-[15px] leading-relaxed">
            Your feedback has been saved! Before you request your certificate, would you mind taking 30 seconds to support us with a quick Google review? It helps us immensely!
          </p>
          
          <div className="w-full flex flex-col gap-3">
            <Button 
              onClick={handleLeaveGoogleReview}
              variant="contained" 
              fullWidth
              endIcon={<ExternalLink size={18} />}
              sx={{ backgroundColor: '#ed7f23', borderRadius: '12px', padding: '14px', fontWeight: 'bold', textTransform: 'none', fontSize: '1rem', boxShadow: '0 4px 14px rgba(237, 127, 35, 0.3)' }}
            >
              Leave a Google Review
            </Button>
            <Button 
              onClick={proceedToStep4}
              variant="text" 
              fullWidth
              sx={{ color: '#94a3b8', borderRadius: '12px', padding: '10px', fontWeight: 'bold', textTransform: 'none' }}
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog 
        open={showReuploadAlert} 
        onClose={() => setShowReuploadAlert(false)}
        slotProps={{ paper: { style: { borderRadius: '20px', padding: '10px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertCircle className="text-red-500" /> Warning
        </DialogTitle>
        <DialogContent>
          <Typography color="textSecondary">
            Are you sure you want to re-upload your resume? This will replace your currently uploaded document and reset the extracted details.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ padding: '0 24px 20px 24px' }}>
          <Button onClick={() => setShowReuploadAlert(false)} sx={{ color: '#6b7280', fontWeight: 'bold' }}>
            Cancel
          </Button>
          <Button onClick={handleConfirmReupload} variant="contained" color="error" sx={{ borderRadius: '10px', fontWeight: 'bold' }}>
            Yes, Re-upload
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={showOtpModal} 
        onClose={(event, reason) => { if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') setShowOtpModal(false); }}
        slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px' } } }}
      >
        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Email className="text-brand-blue" fontSize="large" />
          </div>
          <h3 className="text-2xl font-display font-bold text-brand-blue mb-2">Account Found!</h3>
          <p className="text-gray-500 mb-8 text-sm max-w-62.5">
            This email is already registered. We've sent a 4-digit code to securely log you in: <br/>
            <span className="font-bold text-gray-700">{tempExtractedData?.email}</span>
          </p>
          
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpValue[index] || ""}
                autoFocus={index === 0}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                  if (pasteData) {
                    setOtpValue(pasteData);
                    if (pasteData.length === 4) handleOtpSubmit(pasteData);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ""); 
                  if (!val && e.target.value !== "") return; 
                  
                  const otpArray = otpValue.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setOtpValue(newOtp);

                  if (val && index < 3) {
                    const nextInput = document.getElementById(`otp-input-${index + 1}`);
                    if (nextInput) nextInput.focus();
                  }

                  if (newOtp.length === 4) {
                    handleOtpSubmit(newOtp);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otpValue[index] && index > 0) {
                    const prevInput = document.getElementById(`otp-input-${index - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="w-14 h-14 text-center text-2xl font-black text-brand-blue bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:bg-blue-50 transition-all shadow-sm"
              />
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 w-full">
            {timer && timer > 0 ? (
              <p className="text-gray-400 text-sm font-body">
                Resend code in <span className="text-brand-blue font-bold">{timer}s</span>
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-500">Didn't receive the code?</p>
                <button 
                  type="button" 
                  onClick={() => tempExtractedData?.email && triggerOtpEmail(tempExtractedData.email)} 
                  disabled={isOtpSending} 
                  className="text-brand-orange font-bold hover:underline flex items-center gap-2"
                >
                  {isOtpSending && <div className="w-3 h-3 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>} 
                  Resend OTP
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowOtpModal(false)} 
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancel and upload a different resume
          </button>
        </div>
      </Dialog>

      <Dialog 
        open={showNewUserModal} 
        onClose={(event, reason) => { if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') setShowNewUserModal(false); }}
        slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px', maxWidth: '450px' } } }}
      >
        <div className="p-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-4">
            <Lock className="text-brand-orange w-8 h-8" />
          </div>
          <h3 className="text-2xl font-display font-bold text-brand-blue mb-2">Secure Your Account</h3>
          <p className="text-gray-500 mb-6 text-sm">
            We sent a verification code to <b>{formData.email}</b>. Enter it below and set a password to create your account!
          </p>
          
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={`new-user-otp-${index}`}
                id={`new-user-otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpValue[index] || ""}
                autoFocus={index === 0}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (!val && e.target.value !== "") return;
                  
                  const otpArray = otpValue.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setOtpValue(newOtp);

                  if (val && index < 3) {
                    const nextInput = document.getElementById(`new-user-otp-${index + 1}`);
                    if (nextInput) nextInput.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otpValue[index] && index > 0) {
                    const prevInput = document.getElementById(`new-user-otp-${index - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="w-12 h-12 md:w-14 md:h-14 text-center text-xl font-black text-brand-blue bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-brand-orange focus:bg-orange-50 transition-all shadow-sm"
              />
            ))}
          </div>

          <div className="w-full space-y-4 mb-6">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
              />
            </div>
          </div>

          <Button 
            onClick={handleNewUserSetupSubmit}
            variant="contained" 
            fullWidth
            sx={{ backgroundColor: '#ed7f23', borderRadius: '12px', padding: '12px', fontWeight: 'bold', textTransform: 'none', fontSize: '1rem' }}
          >
            Verify & Submit Application
          </Button>

          <div className="mt-4 w-full">
            {timer && timer > 0 ? (
              <p className="text-gray-400 text-sm">
                Resend code in <span className="text-brand-orange font-bold">{timer}s</span>
              </p>
            ) : (
              <button 
                type="button" 
                onClick={() => triggerOtpEmail(formData.email)} 
                disabled={isOtpSending} 
                className="text-sm text-brand-blue font-bold hover:underline"
              >
                {isOtpSending ? "Sending..." : "Resend Verification Code"}
              </button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default InternshipPortal;