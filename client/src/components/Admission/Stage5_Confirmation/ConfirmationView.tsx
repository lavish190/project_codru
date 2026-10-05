import React, { useState, useEffect } from "react";
import { 
  PartyPopper, CheckCircle2, BookOpen, ShieldCheck, 
  Loader2, Video, FileText, Clock, CalendarX2, X, MessageSquare, 
  User, Mail, Lock, FileSignature, AlertTriangle, XCircle, Info
} from "lucide-react";
import { Button, Dialog, TextField, InputAdornment, Checkbox } from "@mui/material";
import FunDatePicker from "../../FunDatePicker"; 

const ConfirmationView: React.FC<{ admissionData: any }> = ({ admissionData }) => {
  const stage4 = admissionData?.stage4_ClassesBegin || {};
  const scheduledClasses = stage4.scheduledClasses || [];
  const s5 = admissionData?.stage5_Confirmation || {};
  const draft = s5.draftStudentDetails || {};
  const pathway = admissionData?.stage3_Recommendation?.recommendedPathway || "Standard Pathway";

  // ==========================================
  // CUSTOM ALERT SYSTEM
  // ==========================================
  const [alertConfig, setAlertConfig] = useState({ open: false, title: "", message: "", type: "info" as "info" | "warning" | "error" });
  
  const showAlert = (title: string, message: string, type: "info" | "warning" | "error" = "info") => {
    setAlertConfig({ open: true, title, message, type });
  };

  // ==========================================
  // STUDENT ACCOUNT CREATION STATES
  // ==========================================
  const [studentName, setStudentName] = useState(draft.studentName || stage4.studentName || admissionData?.name || "");
  const [studentUsername, setStudentUsername] = useState(draft.studentUsername || "");
  const [studentEmail, setStudentEmail] = useState(draft.studentEmail || "");
  const [studentDob, setStudentDob] = useState(draft.studentDob || "");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentCpassword, setStudentCpassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [tcOpen, setTcOpen] = useState(false);

  // Auto-Save & Hydration States
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasEdited, setHasEdited] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Verification & Existing User States
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState<number | null>(null);
  
  // Track existing username to prevent "Taken" error on their own account
  const [existingLinkedUsername, setExistingLinkedUsername] = useState(""); 

  // ==========================================
  // RESCHEDULE REQUEST & RECORDINGS STATES
  // ==========================================
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [reqDate, setReqDate] = useState("");
  const [reqTime, setReqTime] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  const [pastRecordings, setPastRecordings] = useState<any[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  // ==========================================
  // EFFECTS
  // ==========================================
  
  // 1. Hydrate Initial Data
  useEffect(() => {
    if (admissionData && !isHydrated) {
      const d = admissionData.stage5_Confirmation?.draftStudentDetails || {};
      setStudentName(d.studentName || admissionData.stage4_ClassesBegin?.studentName || admissionData.name || "");
      setStudentUsername(d.studentUsername || "");
      setStudentEmail(d.studentEmail || "");
      setStudentDob(d.studentDob || "");
      setIsHydrated(true);
    }
  }, [admissionData, isHydrated]);

  // 2. Auto-Save Effect
  useEffect(() => {
    if (!hasEdited || s5.enrollmentFormCompleted) return;
    const delayTimer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/parent/stage5-draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
          body: JSON.stringify({ studentName, studentUsername, studentEmail, studentDob })
        });
        if (res.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else setSaveStatus("idle");
      } catch (err) { setSaveStatus("idle"); }
    }, 1500);
    return () => clearTimeout(delayTimer);
  }, [studentName, studentUsername, studentEmail, studentDob, hasEdited, s5.enrollmentFormCompleted]);

  // 3. Username Availability Checker
  useEffect(() => {
    const checkUsername = async () => {
      const currentUsername = studentUsername.trim();
      if (currentUsername.length === 0) return setUsernameStatus("idle");
      if (currentUsername.length < 4) return setUsernameStatus("invalid");

      // 🚨 Bypasses check if it matches the username fetched from their existing account
      if (existingLinkedUsername && currentUsername === existingLinkedUsername) {
        return setUsernameStatus("available");
      }

      setUsernameStatus("checking");
      try {
        const res = await fetch(`${import.meta.env.VITE_API}check-username`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUsername }),
        });
        const data = await res.json();
        setUsernameStatus(res.ok && data.available ? "available" : "taken");
      } catch (error) { setUsernameStatus("idle"); }
    };
    const delayDebounceFn = setTimeout(checkUsername, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [studentUsername, existingLinkedUsername]);

  // 4. OTP Timer Logic
  useEffect(() => {
    if (timer && timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setTimer(null);
    }
  }, [timer]);

  // 5. Fetch Past Recordings
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/parent/past-recordings`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) setPastRecordings(await res.json());
      } catch (err) {} finally { setIsLoadingRecordings(false); }
    };
    fetchRecordings();
  }, []);

  const activeMeetLink = stage4.meetLink || (pastRecordings.find(r => r.type === "class" && r.meetLink)?.meetLink) || "https://meet.google.com";

  // ==========================================
  // ACTION HANDLERS
  // ==========================================
  
  const handleEmailVerification = async () => {
    // 🚨 Strict Security Block
    const parentEmail = admissionData?.parent?.email || admissionData?.email || "";
    if (studentEmail.toLowerCase().trim() === parentEmail.toLowerCase().trim()) {
      return showAlert(
        "Security Notice", 
        "For security and direct classroom access, the student must have an email distinct from your Parent Account. Please provide a different email.", 
        "warning"
      );
    }

    setIsOtpSending(true);
    setOtp("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API}generate-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail }),
      });
      if (res.ok) {
        setOtpOpen(true);
        setTimer(60);
      } else {
        const data = await res.json();
        showAlert("OTP Error", data.error || "Failed to send OTP.", "error");
      }
    } catch (error) { showAlert("Network Error", "Could not send OTP.", "error"); } 
    finally { setIsOtpSending(false); }
  };

  const handleOtpComplete = async (finalValue: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: studentEmail, otp: finalValue }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setIsEmailVerified(true);
        setOtpOpen(false);

        // 🚨 SMART HYDRATION FOR EXISTING USERS
        if (data.existingUser && data.user) {
           setStudentName(data.user.name || studentName);
           setStudentUsername(data.user.username || studentUsername);
           setExistingLinkedUsername(data.user.username || ""); // Whitelists the username
           if (data.user.dob) setStudentDob(data.user.dob);
           
           showAlert(
             "Account Found!", 
             "We found an existing account linked to this email. We have loaded their profile. Please review the details, set a new secure password, and proceed to enroll.", 
             "info"
           );
        }
      } else {
        const data = await res.json();
        showAlert("Verification Failed", data.error || "Invalid OTP.", "error");
      }
    } catch (err) { showAlert("Network Error", "Failed to verify OTP.", "error"); }
  };

  const handleRescheduleSubmit = async () => {
    if (!reqDate || !reqTime || !reqReason) return showAlert("Missing Fields", "Please fill all required fields.", "warning");
    setIsSubmittingReschedule(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/parent/request-class-change/${selectedClass._id}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ requestedDate: reqDate, requestedStartTime: reqTime, reason: reqReason })
      });
      if (res.ok) {
        setRescheduleModalOpen(false);
        setReqReason("");
        showAlert("Request Sent", "Reschedule request submitted to your counselor successfully.", "info");
        setTimeout(() => window.location.reload(), 2000); 
      } else showAlert("Error", "Failed to submit request.", "error");
    } catch (err) { showAlert("Network Error", "Failed to connect to server.", "error"); }
    finally { setIsSubmittingReschedule(false); }
  };

  const handleStudentAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus !== "available") return showAlert("Invalid Username", "Please choose a valid and available username.", "warning");
    if (!isEmailVerified) return showAlert("Verification Required", "Please verify the student's email first.", "warning");
    if (studentPassword !== studentCpassword) return showAlert("Password Mismatch", "The passwords entered do not match.", "warning");
    
    setIsSubmittingEnrollment(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/parent/create-student-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({
          name: studentName,
          email: studentEmail,
          username: studentUsername,
          password: studentPassword,
          dob: studentDob
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setIsSubmittingEnrollment(false);
        return showAlert("Enrollment Failed", data.error || "Failed to finalize student account.", "error");
      }

      showAlert("Success!", "Student account has been securely generated and enrolled.", "info");
      setTimeout(() => window.location.reload(), 2000); 
    } catch (error) {
      showAlert("Network Error", "Failed to create student account due to a network error.", "error");
      setIsSubmittingEnrollment(false);
    }
  };

  // Checklist Progress Logic
  const checklist = [
    { key: "documentsVerified", label: "Academic & KYC Documents Verified" },
    { key: "enrollmentFormCompleted", label: "Final Enrollment Formalities Completed" },
    { key: "internalOnboardingDone", label: "Digital Classroom & Trackers Configured" },
    { key: "studentProfileCreated", label: "Official Student Profile & ID Generated" }
  ];
  const completedCount = checklist.filter(item => s5[item.key]).length;
  const progressPercent = (completedCount / checklist.length) * 100;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-10">
      
      {/* 🎉 CLEAN CELEBRATION HEADER WITH INLINE PROFILE INFO */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-8 md:p-12 rounded-3xl shadow-sm border border-blue-100 text-center relative overflow-hidden">
        <div className="absolute -left-10 -top-10 opacity-5">
          <PartyPopper size={200} />
        </div>
        
        <div className="w-20 h-20 bg-white shadow-md text-[#1765a4] rounded-full flex items-center justify-center mx-auto mb-4 relative z-10 border border-blue-50">
          <PartyPopper size={40} />
        </div>
        
        <h2 className="text-3xl md:text-4xl font-display font-black text-slate-800 relative z-10 mb-4">
          Enrollment Confirmed!
        </h2>
        <p className="text-slate-600 text-lg max-w-2xl mx-auto relative z-10 font-medium">
          Congratulations! You have successfully completed the 5-Day Guarantee phase. <b className="text-[#1765a4]">{studentName || "Your child"}</b> is now officially a part of the CuTe Learning family.
        </p>

        {/* 🎓 CLEAN INLINE PROFILE SNAPSHOT */}
        <div className="relative z-10 max-w-3xl mx-auto mt-8 pt-8 border-t border-blue-100/50 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12">
          <div className="flex flex-col items-center">
            <div className="p-2 mb-2 bg-orange-50/80 text-[#ed7f23] rounded-full"><User size={18} /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Enrolled Student</span>
            <p className="font-bold text-slate-800 text-base">{studentName || "Pending Setup"}</p>
          </div>

          <div className="hidden md:block w-px h-12 bg-blue-100/60"></div>

          <div className="flex flex-col items-center">
             <div className="p-2 mb-2 bg-blue-50/80 text-[#1765a4] rounded-full"><BookOpen size={18} /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Academic Pathway</span>
            <p className="font-bold text-[#1765a4] text-base">{pathway}</p>
          </div>

          <div className="hidden md:block w-px h-12 bg-blue-100/60"></div>

          <div className="flex flex-col items-center">
            <div className="p-2 mb-2 bg-emerald-50 text-emerald-500 rounded-full"><ShieldCheck size={18} /></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Account Status</span>
            <p className="font-bold text-emerald-700 text-base">Fully Verified</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* ========================================== */}
        {/* LEFT COLUMN: SETUP TRACKER & ACCOUNT CREATION */}
        {/* ========================================== */}
        <div className="flex flex-col gap-6">
          
          {!s5.enrollmentFormCompleted ? (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-[#1765a4]/20 relative">
              
              {/* 🚨 AUTO-SAVE INDICATOR */}
              <div className="absolute top-6 right-6">
                {saveStatus === "saving" && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-100"><Loader2 size={10} className="animate-spin"/> Auto-saving</span>}
                {saveStatus === "saved" && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100"><CheckCircle2 size={10}/> Saved</span>}
              </div>

              <h3 className="font-bold text-xl text-slate-800 mb-2 flex items-center gap-2">
                <FileSignature className="text-[#1765a4]" /> Create Student Profile
              </h3>
              <p className="text-sm text-slate-500 mb-6 pr-12">
                Please create the official student account. This will generate their unique ID and classroom credentials.
              </p>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                <Mail className="text-[#1765a4] shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-blue-900 leading-relaxed">
                  <span className="font-bold block mb-1">A formal Student Email ID is required.</span>
                  If your child does not have an email ID, kindly make one. It will be helpful for their future as well in today's world. You can control its access for now, but a proper formal email ID for the child is as necessary as any other government ID document.
                </div>
              </div>

              <form onSubmit={handleStudentAccountSubmit} className="flex flex-col gap-5 mb-6">
                <TextField 
                  fullWidth size="small" label="Student Full Name" value={studentName} required
                  onChange={(e) => { setHasEdited(true); setStudentName(e.target.value); }} 
                  slotProps={{ input: { startAdornment: (<InputAdornment position="start"><User size={16} className="text-slate-400" /></InputAdornment>) } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' } }} 
                />
                
                <TextField 
                  fullWidth size="small" label="Student Username" value={studentUsername} required
                  onChange={(e) => { setHasEdited(true); setStudentUsername(e.target.value.toLowerCase().replace(/\s/g, '')); }} 
                  error={usernameStatus === "taken" || usernameStatus === "invalid"}
                  helperText={
                    usernameStatus === "checking" ? "Checking availability..." :
                    usernameStatus === "invalid" ? "Must be at least 4 characters." :
                    usernameStatus === "taken" ? "Username is already taken." :
                    usernameStatus === "available" ? "Username is available!" : ""
                  }
                  slotProps={{
                    input: {
                      startAdornment: (<InputAdornment position="start"><span className="text-slate-400 font-bold">@</span></InputAdornment>),
                      endAdornment: (
                        <InputAdornment position="end">
                          {usernameStatus === "checking" && <div className="w-4 h-4 border-2 border-[#1765a4] border-t-transparent rounded-full animate-spin"></div>}
                          {usernameStatus === "available" && <CheckCircle2 size={16} className="text-emerald-500" />}
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{ 
                    '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' },
                    '& .MuiFormHelperText-root': { color: usernameStatus === 'available' ? '#10b981' : undefined, fontWeight: usernameStatus === 'available' ? 'bold' : 'normal' }
                  }} 
                />

                <TextField 
                  fullWidth size="small" type="email" label="Student Email ID" value={studentEmail} required
                  onChange={(e) => { setHasEdited(true); setStudentEmail(e.target.value); setIsEmailVerified(false); setExistingLinkedUsername(""); }} 
                  slotProps={{
                    input: {
                      startAdornment: (<InputAdornment position="start"><Mail size={16} className="text-slate-400" /></InputAdornment>),
                      endAdornment: (
                        <InputAdornment position="end">
                          {!isEmailVerified && studentEmail.length > 3 && studentEmail.includes("@") && (
                            <button 
                              type="button" onClick={handleEmailVerification} disabled={!!timer || isOtpSending}
                              className="flex items-center gap-2 text-xs font-bold text-[#ed7f23] hover:underline disabled:opacity-50 disabled:no-underline"
                            >
                              {isOtpSending ? <><div className="w-3 h-3 border-2 border-[#ed7f23] border-t-transparent rounded-full animate-spin"></div> Sending...</> : (timer ? `Resend in ${timer}s` : "Verify")}
                            </button>
                          )}
                          {isEmailVerified && <span className="text-emerald-500 font-bold flex items-center gap-1 text-xs"><CheckCircle2 size={14}/> Verified</span>}
                        </InputAdornment>
                      )
                    }
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' } }} 
                />

                <div className="w-full bg-white rounded-[10px]">
                  <FunDatePicker 
                    label="Date of Birth"
                    value={studentDob} 
                    onChange={(newDate) => { setHasEdited(true); setStudentDob(newDate || ""); }} 
                  />
                </div>

                {/* 🚨 ONLY SHOW PASSWORD FIELDS IF IT IS A BRAND NEW ACCOUNT */}
                {!existingLinkedUsername && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <TextField 
                      fullWidth size="small" type="password" label="Create Password" value={studentPassword} required
                      onChange={(e) => setStudentPassword(e.target.value)} 
                      slotProps={{ input: { startAdornment: (<InputAdornment position="start"><Lock size={16} className="text-slate-400" /></InputAdornment>) } }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' } }} 
                    />
                    <TextField 
                      fullWidth size="small" type="password" label="Confirm Password" value={studentCpassword} required
                      error={studentCpassword.length > 0 && studentPassword !== studentCpassword}
                      onChange={(e) => setStudentCpassword(e.target.value)} 
                      slotProps={{ input: { startAdornment: (<InputAdornment position="start"><Lock size={16} className="text-slate-400" /></InputAdornment>) } }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: 'white' } }} 
                    />
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                  <div className="flex items-start gap-2">
                    <Checkbox 
                      checked={termsAccepted} 
                      onChange={(e) => setTermsAccepted(e.target.checked)} 
                      sx={{ padding: 0, color: '#1765a4', '&.Mui-checked': { color: '#1765a4' } }} 
                    />
                    <p className="text-xs text-slate-600 font-medium pt-0.5 leading-relaxed">
                      I declare that the information provided is accurate. I have read and agree to the <span onClick={() => setTcOpen(true)} className="text-[#1765a4] font-bold underline cursor-pointer hover:text-blue-800">Terms & Conditions</span>.
                    </p>
                  </div>
                </div>

                <Button 
                  type="submit"
                  variant="contained" 
                  fullWidth 
                  // 🚨 STRICT DISABLE LOGIC: T&C is always required. Passwords are only required if it's a new account!
                  disabled={
                    !termsAccepted || 
                    !studentName || 
                    !studentUsername || 
                    !isEmailVerified || 
                    !studentDob || 
                    (!existingLinkedUsername && (!studentPassword || studentPassword !== studentCpassword)) || 
                    isSubmittingEnrollment
                  }
                  sx={{ mt: 1, bgcolor: '#ed7f23', borderRadius: '12px', py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '14px', boxShadow: 'none', "&:hover": { bgcolor: "#d96c1c" } }}
                >
                  {isSubmittingEnrollment ? <Loader2 size={18} className="animate-spin" /> : existingLinkedUsername ? "Link Existing Account & Enroll" : "Create Student Account & Enroll"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-emerald-200 relative overflow-hidden flex flex-col sm:flex-row items-start gap-5">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
              
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm mt-1">
                <CheckCircle2 size={24} />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 text-lg mb-1">
                  {studentName || draft.studentName || "Student"}'s Account Configured
                </h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-5">
                  The official credentials have been securely linked to this enrollment. They can access the digital classroom using the username <b className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">@{studentUsername || draft.studentUsername}</b>.
                </p>
                
                <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                  <Mail size={14} className="text-[#1765a4]" />
                  <span className="text-xs font-bold text-slate-700">
                    {studentEmail || draft.studentEmail || "Verified Account"}
                  </span>
                  <ShieldCheck size={14} className="text-emerald-500 ml-1" />
                </div>
              </div>
            </div>
          )}

          {/* SETUP TRACKER */}
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-xl text-slate-800 mb-2">Finalizing Setup</h3>
            <p className="text-sm text-slate-500 mb-6">
              Our administration is currently preparing the permanent digital workspace. You will automatically progress to Stage 6 once these are checked off.
            </p>

            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                 <span className="text-xs font-bold text-slate-700">Setup Progress</span>
                 <span className="text-xs font-black text-[#1765a4]">{Math.round(progressPercent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-[#1765a4] rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="space-y-3">
              {checklist.map((item, idx) => {
                const isChecked = s5[item.key];
                return (
                  <div key={idx} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${isChecked ? "bg-blue-50/50 border-blue-100" : "bg-slate-50 border-slate-100 opacity-70"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${isChecked ? "bg-[#1765a4] text-white shadow-md shadow-blue-500/20" : "bg-white border-2 border-slate-200 text-slate-300"}`}>
                      {isChecked ? <CheckCircle2 size={16} /> : <Loader2 size={14} className="animate-spin" />}
                    </div>
                    <div>
                      <span className={`block text-sm font-bold transition-colors duration-500 ${isChecked ? "text-[#1765a4]" : "text-slate-600"}`}>{item.label}</span>
                      <span className="block text-[10px] font-medium text-slate-400 mt-0.5">{isChecked ? "Completed by Administration" : "In Progress..."}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* RIGHT COLUMN: ACTIVE CLASSES & RECORDINGS */}
        {/* ========================================== */}
        <div className="flex flex-col gap-6">
          
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-full">
            <h3 className="font-bold text-2xl text-slate-800 mb-2 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" /> Classroom Ready
            </h3>
            <p className="text-sm text-slate-500 mb-4">Your induction schedule is active. Click any upcoming date below to request a change.</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
              {[...scheduledClasses]
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((cls: any, i: number) => {
                const d = new Date(cls.date);
                const isPending = cls.rescheduleRequest?.isPending;
                
                // 🚨 STOPS PAST DATES FROM BEING CLICKED
                const isPast = d.getTime() < new Date().setHours(0,0,0,0); 

                return (
                  <div 
                    key={cls._id || i} 
                    onClick={() => {
                      if (isPast) return; 
                      if (!isPending) {
                        setSelectedClass(cls);
                        setReqDate(d.toLocaleDateString('en-CA'));
                        setReqTime(cls.startTime);
                        setRescheduleModalOpen(true);
                      }
                    }}
                    className={`relative p-3 rounded-xl transition border text-left ${
                      isPast ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 
                      isPending ? 'bg-orange-50 border-orange-200 cursor-pointer' : 
                      'bg-slate-50 border-slate-200 hover:border-[#1765a4] cursor-pointer'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Day {i + 1}</span>
                      {isPending && !isPast && <Clock size={12} className="text-orange-500" />}
                    </div>
                    <span className="block text-sm font-bold text-slate-800">
                      {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="block text-[11px] font-bold text-[#1765a4] mt-0.5">
                      {cls.startTime} - {cls.endTime}
                    </span>
                    {isPending && !isPast && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl border border-orange-200">
                          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest text-center px-2">Counselor<br/>Reviewing</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <Button 
              variant="contained" fullWidth href={activeMeetLink} target="_blank" rel="noopener noreferrer"
              sx={{ bgcolor: '#1765a4', borderRadius: '14px', py: 2, fontWeight: 'bold', textTransform: 'none', fontSize: '1.1rem', boxShadow: 'none', mt: 'auto', "&:hover": { bgcolor: "#124f82" } }}
            >
              Join Digital Classroom
            </Button>
          </div>

          {/* 📼 RECORDINGS & RESOURCES CARD */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg text-slate-800 mb-1 flex items-center gap-2">
              <Video className="text-[#1765a4]" size={20} /> Class Recordings & Notes
            </h3>
            <p className="text-xs text-slate-500 mb-4 pb-3 border-b border-slate-100">Access past materials uploaded by your teachers.</p>

            {isLoadingRecordings ? (
               <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={24}/></div>
            ) : pastRecordings.length === 0 ? (
               <div className="text-center py-6 text-slate-400">
                 <FileText size={24} className="mx-auto mb-2 opacity-50" />
                 <p className="text-xs font-bold">No recordings available yet.</p>
               </div>
            ) : (
               <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
                 {pastRecordings.map((rec) => (
                   <div key={rec.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-slate-700 leading-tight">{rec.title}</span>
                        <span className="text-[10px] font-bold text-[#1765a4] shrink-0 bg-blue-50 px-2 py-0.5 rounded ml-2">
                          {new Date(rec.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      
                      {rec.attachments && rec.attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {rec.attachments.map((att: any, idx: number) => (
                            <a 
                              key={idx} href={att.fileUrl} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#ed7f23] bg-orange-50 border border-orange-100 px-2 py-1 rounded-md hover:bg-orange-100 transition"
                            >
                              <Video size={10}/> {att.title || "Recording Link"}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 font-medium italic">No files attached.</p>
                      )}
                   </div>
                 ))}
               </div>
            )}
          </div>

        </div>
      </div>

      {/* 🚨 CUSTOM ALERT DIALOG */}
      <Dialog 
        open={alertConfig.open} 
        onClose={() => setAlertConfig(prev => ({ ...prev, open: false }))} 
        sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '24px', maxWidth: '400px', width: '100%', textAlign: 'center' } }}
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          alertConfig.type === 'error' ? 'bg-red-50 text-red-500' : 
          alertConfig.type === 'warning' ? 'bg-orange-50 text-orange-500' : 
          'bg-blue-50 text-[#1765a4]'
        }`}>
          {alertConfig.type === 'error' ? <XCircle size={32} /> : 
           alertConfig.type === 'warning' ? <AlertTriangle size={32} /> : 
           <CheckCircle2 size={32} />}
        </div>
        <h3 className="text-xl font-display font-bold text-slate-800 mb-2">{alertConfig.title}</h3>
        <p className="text-sm text-slate-500 mb-6">{alertConfig.message}</p>
        <Button 
          onClick={() => setAlertConfig(prev => ({ ...prev, open: false }))} 
          variant="contained" fullWidth 
          sx={{ bgcolor: alertConfig.type === 'error' ? '#ef4444' : alertConfig.type === 'warning' ? '#f97316' : '#1765a4', borderRadius: '12px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}
        >
          Okay, Got It
        </Button>
      </Dialog>

      {/* 🚨 EMAIL OTP DIALOG */}
      <Dialog 
        open={otpOpen} 
        onClose={(event, reason) => { if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') setOtpOpen(false); }}
        sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '10px' } }}
      >
        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4"><Mail className="text-[#1765a4]" size={32} /></div>
          <h3 className="text-2xl font-display font-bold text-[#1765a4] mb-2">Verify Student Email</h3>
          <p className="text-gray-500 mb-8 text-sm max-w-62.5">We've sent a 4-digit code to <br/><span className="font-bold text-gray-700">{studentEmail}</span></p>
          
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otp[index] || ""}
                autoFocus={index === 0}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                  if (pasteData) {
                    setOtp(pasteData);
                    if (pasteData.length === 4) handleOtpComplete(pasteData);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ""); 
                  if (!val && e.target.value !== "") return; 
                  
                  const otpArray = otp.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setOtp(newOtp);

                  if (val && index < 3) {
                    const nextInput = document.getElementById(`otp-input-${index + 1}`);
                    if (nextInput) nextInput.focus();
                  }

                  if (newOtp.length === 4) handleOtpComplete(newOtp);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otp[index] && index > 0) {
                    const prevInput = document.getElementById(`otp-input-${index - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="w-14 h-14 text-center text-2xl font-black text-[#1765a4] bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-[#1765a4] focus:bg-blue-50 transition-all shadow-sm"
              />
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100 w-full">
            {timer && timer > 0 ? (
              <p className="text-gray-400 text-sm font-body">Resend code in <span className="text-[#1765a4] font-bold">{timer}s</span></p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-gray-500">Didn't receive the code?</p>
                <button type="button" onClick={handleEmailVerification} disabled={isOtpSending} className="text-[#ed7f23] font-bold hover:underline flex items-center gap-2">
                  {isOtpSending && <div className="w-3 h-3 border-2 border-[#ed7f23] border-t-transparent rounded-full animate-spin"></div>} Resend OTP
                </button>
              </div>
            )}
          </div>
          <button onClick={() => setOtpOpen(false)} className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline">Entered wrong email? Edit it</button>
        </div>
      </Dialog>

      {/* 🚨 DIALOG: RESCHEDULE SINGLE CLASS */}
      <Dialog open={rescheduleModalOpen} onClose={() => setRescheduleModalOpen(false)} sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '24px', maxWidth: '400px' } }}>
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 bg-orange-50 text-orange-500 rounded-lg"><CalendarX2 size={20}/></div>
           <h3 className="text-xl font-bold text-slate-800">Request Change</h3>
        </div>
        
        {selectedClass && (
          <p className="text-sm font-medium text-slate-500 mb-5 pb-4 border-b border-slate-100">
            Currently scheduled for <strong className="text-[#1765a4]">{new Date(selectedClass.date).toLocaleDateString()}</strong> at <strong className="text-[#1765a4]">{selectedClass.startTime}</strong>.
          </p>
        )}
        
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
             <TextField 
                type="date" label="New Requested Date" variant="outlined" fullWidth size="small" 
                value={reqDate} onChange={(e) => setReqDate(e.target.value)} 
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: new Date().toLocaleDateString('en-CA') } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
              />
              <TextField 
                type="time" label="New Time" variant="outlined" fullWidth size="small" 
                value={reqTime} onChange={(e) => setReqTime(e.target.value)} 
                slotProps={{ inputLabel: { shrink: true } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
              />
          </div>
          <TextField multiline rows={3} label="Reason (Holiday, Emergency, etc.)" fullWidth size="small" value={reqReason} onChange={(e) => setReqReason(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
        </div>
        
        <div className="flex gap-3">
          <Button onClick={() => setRescheduleModalOpen(false)} variant="outlined" fullWidth sx={{ borderRadius: '12px', color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={handleRescheduleSubmit} disabled={isSubmittingReschedule || !reqReason || !reqDate || !reqTime} variant="contained" fullWidth sx={{ bgcolor: '#ed7f23', borderRadius: '12px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}>
            {isSubmittingReschedule ? <Loader2 className="animate-spin" /> : "Submit to Counselor"}
          </Button>
        </div>
      </Dialog>

      {/* 🚨 TERMS AND CONDITIONS DIALOG */}
      <Dialog open={tcOpen} onClose={() => setTcOpen(false)} sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '24px', maxWidth: '500px' } }}>
        <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
          <div className="p-2 bg-blue-50 text-[#1765a4] rounded-lg"><FileSignature size={20} /></div>
          <h3 className="text-xl font-bold text-slate-800">Terms & Conditions</h3>
        </div>
        
        <div className="text-sm text-slate-600 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <p>Welcome to CuTe Learning. By finalizing your enrollment, you agree to adhere to our community guidelines.</p>
          <h4 className="font-bold text-slate-800">1. Code of Conduct</h4>
          <p>Students and parents are expected to maintain a respectful and collaborative environment during all digital sessions.</p>
          <h4 className="font-bold text-slate-800">2. Attendance & Rescheduling</h4>
          <p>We respect your time. Reschedule requests must be made via the portal at least 12 hours prior to the scheduled class.</p>
        </div>

        <Button onClick={() => setTcOpen(false)} variant="contained" fullWidth sx={{ mt: 4, bgcolor: '#1765a4', borderRadius: '12px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}>
          Close & Return
        </Button>
      </Dialog>

    </div>
  );
};

export default ConfirmationView;