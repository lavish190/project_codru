import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, Clock, BookOpen, AlertTriangle, Loader2, X, MessageSquare,
  CheckCircle2, CalendarDays, CalendarX2, Video, FileText 
} from "lucide-react";
import { Button, Dialog, TextField, Chip } from "@mui/material";

const ClassesBeginView: React.FC<{ admissionData: any }> = ({ admissionData }) => {
  const stage4 = admissionData?.stage4_ClassesBegin || {};
  const status = stage4.status || "pending";
  const scheduledClasses = stage4.scheduledClasses || [];
  
  // 1. Timer States
  const [timeLeft, setTimeLeft] = useState("");
  const [timerState, setTimerState] = useState<"AWAITING_SCHEDULE" | "WAITING_TO_START" | "TICKING" | "EXPIRED">("AWAITING_SCHEDULE");
  
  // 2. Preferences States (Before classes are scheduled)
  const [studentName, setStudentName] = useState("");
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasEdited, setHasEdited] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // 3. Reschedule Request States (After classes are scheduled)
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [reqDate, setReqDate] = useState("");
  const [reqTime, setReqTime] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  // 4. Refund States
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // 5. Recordings & Auto-Heal State
  const [pastRecordings, setPastRecordings] = useState<any[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  const [showChatGuide, setShowChatGuide] = useState(false);

  // 🚨 ADD THIS: Guide Effect
  useEffect(() => {
    // Only show if classes are scheduled and they haven't seen it yet
    if (timerState !== "AWAITING_SCHEDULE") {
      const hasSeen = localStorage.getItem("hasSeenTeacherChatGuide");
      if (!hasSeen) {
        setTimeout(() => setShowChatGuide(true), 1500); // Slight delay for nice entrance
      }
    }
  }, [timerState]);

  const dismissGuide = () => {
    setShowChatGuide(false);
    localStorage.setItem("hasSeenTeacherChatGuide", "true");
  };

  // ==========================================
  // FETCH PAST RECORDINGS & AUTO-HEAL
  // ==========================================
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/parent/past-recordings`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPastRecordings(data);
        }
      } catch (err) {
        console.error("Failed to fetch recordings", err);
      } finally {
        setIsLoadingRecordings(false);
      }
    };
    fetchRecordings();
  }, []);

  // Determine the active Meet Link (Auto-heals if admission object is missing it)
  const activeMeetLink = stage4.meetLink || (pastRecordings.find(r => r.type === "class" && r.meetLink)?.meetLink) || "https://meet.google.com";

  // ==========================================
  // HYDRATION & AUTO-SAVE (PREFERENCES)
  // ==========================================
  useEffect(() => {
    if (stage4 && !isHydrated) {
      setStudentName(stage4.studentName || admissionData?.leadDetails?.studentName || "");
      setPreferredStartTime(stage4.preferredStartTime || "");
      setPreferredEndTime(stage4.preferredEndTime || "");
      setAdditionalNotes(stage4.additionalNotes || "");
      setIsHydrated(true); 
    }
  }, [admissionData, isHydrated, stage4]); 

  useEffect(() => {
    if (!hasEdited || timerState !== "AWAITING_SCHEDULE") return;
    
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/parent/stage4-preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
          body: JSON.stringify({ studentName, preferredStartTime, preferredEndTime, additionalNotes })
        });
        
        if (res.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("idle");
        }
      } catch (err) { 
        setSaveStatus("idle"); 
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [studentName, preferredStartTime, preferredEndTime, additionalNotes, hasEdited, timerState]); 

  // ==========================================
  // GUARANTEE TIMER LOGIC
  // ==========================================
  useEffect(() => {
    if (status === "pending" || !stage4.classesStartDate || !stage4.refundWindowEndsAt) {
      setTimerState("AWAITING_SCHEDULE");
      return;
    }

    const startDate = new Date(stage4.classesStartDate).getTime();
    const refundEndDate = new Date(stage4.refundWindowEndsAt).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      if (now < startDate) {
        setTimerState("WAITING_TO_START");
        setTimeLeft("Starts on Day 1");
      } else if (now > refundEndDate) {
        setTimerState("EXPIRED");
        setTimeLeft("Guarantee Window Closed");
        clearInterval(interval);
      } else {
        setTimerState("TICKING");
        const distance = refundEndDate - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        setTimeLeft(`${days}d ${hours}h remaining`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [stage4.classesStartDate, stage4.refundWindowEndsAt, status]);

  // ==========================================
  // ACTION HANDLERS
  // ==========================================
  const handleRefundRequest = async () => {
    setIsSubmittingRefund(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/parent/request-refund`, {
        method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) window.location.reload();
      else alert("Failed to submit refund request.");
    } catch (err) { alert("Network error"); }
    finally { setIsSubmittingRefund(false); }
  };

  const handleRescheduleSubmit = async () => {
    if (!reqDate || !reqTime || !reqReason) return alert("Please fill all fields.");
    setIsSubmittingReschedule(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/parent/request-class-change/${selectedClass._id}`, {
        method: "POST", 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ requestedDate: reqDate, requestedStartTime: reqTime, reason: reqReason })
      });
      if (res.ok) {
        setRescheduleModalOpen(false);
        setReqReason("");
        alert("Reschedule request submitted to your counselor.");
        window.location.reload(); 
      } else {
        alert("Failed to submit reschedule request.");
      }
    } catch (err) { alert("Network error"); }
    finally { setIsSubmittingReschedule(false); }
  };

  // ==========================================
  // RENDER: REFUND STATE
  // ==========================================
  if (status === "refund_requested" || stage4.refundRequested) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-red-100 text-center animate-fade-in-up">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-3xl font-display font-bold text-slate-800 mb-2">Refund Processing</h2>
        <p className="text-gray-600 mb-6">You have exercised your 5-Day Comfort Guarantee. A counselor will call you within 24 hours to process your 100% refund.</p>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN DASHBOARD
  // ==========================================
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* 🧭 WELCOME HEADER */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="absolute -left-4 -top-4 opacity-5"><BookOpen size={120} /></div>
        <div className="w-16 h-16 bg-blue-50 text-[#1765a4] rounded-full flex items-center justify-center mx-auto mb-4 relative z-10">
          <BookOpen size={32} />
        </div>
        <h2 className="text-3xl font-display font-bold text-slate-800 relative z-10">Welcome to Stage 4: Classes Begin</h2>
        <p className="text-slate-500 mt-2 max-w-xl mx-auto relative z-10">Your enrollment is officially complete. We are now preparing your digital classroom.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* 📅 LEFT CARD: PREFERENCES OR ACTIVE SCHEDULE */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col relative">
          
          {timerState === "AWAITING_SCHEDULE" ? (
            <>
              {/* Auto-Save Indicator */}
              <div className="absolute top-6 right-6">
                {saveStatus === "saving" && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-100"><Loader2 size={10} className="animate-spin"/> Auto-saving</span>}
                {saveStatus === "saved" && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100"><CheckCircle2 size={10}/> Saved</span>}
              </div>

              <h3 className="font-bold text-xl text-slate-800 mb-2">Schedule Preferences</h3>
              <p className="text-sm text-slate-500 mb-6">While our team configures your classroom, please share your schedule preferences. <br/><span className="text-xs font-bold text-[#1765a4]">Updates auto-save instantly. Change them as often as you like!</span></p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Student's Preferred Name</label>
                  <TextField fullWidth size="small" placeholder="What should the teacher call them?" value={studentName} onChange={(e) => { setHasEdited(true); setStudentName(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Preferred Start Time</label>
                    <TextField type="time" fullWidth size="small" value={preferredStartTime} onChange={(e) => { setHasEdited(true); setPreferredStartTime(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Preferred End Time</label>
                    <TextField type="time" fullWidth size="small" value={preferredEndTime} onChange={(e) => { setHasEdited(true); setPreferredEndTime(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Anything else we should know?</label>
                  <TextField fullWidth multiline rows={2} placeholder="Any specific schedule constraints or notes for the teacher..." value={additionalNotes} onChange={(e) => { setHasEdited(true); setAdditionalNotes(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                </div>
              </div>

              {/* Working Days Explanation */}
              <div className="bg-[#fdf8f4] p-4 rounded-xl border border-orange-100 mt-auto">
                <div className="flex items-start gap-2">
                  <Clock className="text-[#ed7f23] w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-sm font-bold text-slate-800 mb-1">Processing Timeline</span>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Your schedule will be updated here within 1-2 working days. <br/>
                      <span className="text-[#ed7f23] font-bold">Note: We reserve weekends for rest! If you enrolled on a Friday, your schedule will be ready by Tuesday.</span>
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col">
              <h3 className="font-bold text-2xl text-slate-800 mb-2 flex items-center gap-2">
                <CheckCircle2 className="text-emerald-500" /> Classroom Ready
              </h3>
              <p className="text-sm text-slate-500 mb-4">Your induction schedule is active. Click any date below to request a time change or holiday.</p>
              
              {/* 🚨 10-DAY FULL SCHEDULE GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
                
                {[...scheduledClasses]
                  .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((cls: any, i: number) => {
                  const d = new Date(cls.date);
                  const isPending = cls.rescheduleRequest?.isPending;

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
                      className={`relative p-3 rounded-xl cursor-pointer transition border text-left ${
                        isPending ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200 hover:border-[#1765a4]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Day {i + 1}</span>
                        {isPending && <Clock size={12} className="text-orange-500" />}
                      </div>
                      <span className="block text-sm font-bold text-slate-800">
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="block text-[11px] font-bold text-[#1765a4] mt-0.5">
                        {cls.startTime} - {cls.endTime}
                      </span>
                      {isPending && !isPast &&(
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl border border-orange-200">
                           <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest text-center px-2">Counselor<br/>Reviewing</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* 🚨 DIRECT GOOGLE MEET BUTTON */}
              <Button 
                variant="contained" 
                fullWidth 
                href={activeMeetLink} 
                target="_blank" 
                rel="noopener noreferrer"
                sx={{ bgcolor: '#1765a4', borderRadius: '14px', py: 2, fontWeight: 'bold', textTransform: 'none', fontSize: '1.1rem', boxShadow: 'none', mt: 'auto', "&:hover": { bgcolor: "#124f82" } }}
              >
                Join Digital Classroom
              </Button>
            </div>
          )}
        </div>

        {/* 🛡️ RIGHT SIDE: GUARANTEE TRACKER & PAST RECORDINGS */}
        <div className="flex flex-col gap-6">
          
          {/* GUARANTEE CARD */}
          <div className="bg-gradient-to-br from-emerald-50 to-white p-6 md:p-8 rounded-3xl shadow-sm border border-emerald-100 flex flex-col relative overflow-hidden">
            <div className="absolute -right-8 -top-8 opacity-10"><ShieldCheck size={160} className="text-emerald-500" /></div>
            
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 relative z-10">
               <ShieldCheck size={24} />
            </div>
            <h3 className="font-bold text-2xl text-emerald-900 mb-2 relative z-10">5-Day Guarantee</h3>
            
            <p className="text-sm text-emerald-800 mb-5 relative z-10 font-medium">
              We want you to feel completely confident. You have 5 working days from your <b className="text-emerald-900">first day of class</b> to evaluate our teaching.
            </p>
            
            <div className="space-y-3 mb-8 relative z-10">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-700 font-medium leading-tight">Evaluated on actual classes, not just demos.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-700 font-medium leading-tight">100% no-questions-asked refund policy.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-700 font-medium leading-tight">Freeze classes instantly directly from this portal.</span>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 border border-emerald-100 mt-auto relative z-10 shadow-sm">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Guarantee Timer</span>
              
              <span className={`text-2xl font-black flex items-center gap-2 ${
                timerState === "AWAITING_SCHEDULE" || timerState === "WAITING_TO_START" ? "text-slate-500" : 
                timerState === "EXPIRED" ? "text-slate-400" : "text-[#ed7f23]"
              }`}>
                <Clock size={24} /> 
                {timerState === "AWAITING_SCHEDULE" ? "Awaiting Start Date" : timeLeft}
              </span>
              
              {timerState === "WAITING_TO_START" && stage4.classesStartDate && (
                <span className="block text-xs text-slate-500 mt-3 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                  Timer activates automatically on {new Date(stage4.classesStartDate).toLocaleDateString()}.
                </span>
              )}
            </div>

            {(timerState === "TICKING" || timerState === "WAITING_TO_START") && (
              <button 
                onClick={() => setRefundConfirmOpen(true)} 
                className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-red-500 bg-red-50/80 border border-red-100 hover:bg-red-500 hover:text-white hover:shadow-md hover:shadow-red-500/20 transition-all duration-300 relative z-10"
              >
                <AlertTriangle size={16} className="shrink-0" /> 
                I am not satisfied. Request a refund.
              </button>
            )}
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
                              key={idx} 
                              href={att.fileUrl} 
                              target="_blank" 
                              rel="noreferrer"
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
                type="date" 
                label="New Requested Date" 
                variant="outlined"
                fullWidth 
                size="small" 
                value={reqDate} 
                onChange={(e) => setReqDate(e.target.value)} 
                slotProps={{ 
                  inputLabel: { shrink: true },
                  htmlInput: { min: new Date().toLocaleDateString('en-CA') }
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
              />
              <TextField 
                type="time" 
                label="New Time" 
                variant="outlined"
                fullWidth 
                size="small" 
                value={reqTime} 
                onChange={(e) => setReqTime(e.target.value)} 
                slotProps={{ inputLabel: { shrink: true } }} 
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
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
      
      {/* 🚨 DIALOG: REFUND CONFIRMATION */}
      <Dialog open={refundConfirmOpen} onClose={() => setRefundConfirmOpen(false)} sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '24px', maxWidth: '400px' } }}>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Are you sure?</h3>
        <p className="text-sm text-slate-500 mb-6">This will freeze your child's classroom access and initiate the 100% refund process.</p>
        <div className="flex gap-3">
          <Button onClick={() => setRefundConfirmOpen(false)} variant="outlined" fullWidth sx={{ borderRadius: '12px', color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={handleRefundRequest} disabled={isSubmittingRefund} variant="contained" fullWidth color="error" sx={{ borderRadius: '12px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}>
            {isSubmittingRefund ? <Loader2 className="animate-spin" /> : "Confirm Refund"}
          </Button>
        </div>
      </Dialog>

      {/* 🚨 ADD THIS: The Floating Chat Guide */}
      {showChatGuide && (
        <div className="fixed bottom-24 right-6 z-[999] animate-bounce flex flex-col items-end pointer-events-auto">
          <div className="bg-[#1765a4] text-white p-4 rounded-2xl shadow-2xl max-w-xs border border-blue-400 relative">
            <button 
              onClick={dismissGuide} 
              className="absolute -top-2 -right-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full p-1 shadow-md transition"
            >
              <X size={14}/>
            </button>
            <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-full shrink-0">
                <MessageSquare size={20} className="text-white" />
              </div>
              <p className="text-sm font-bold leading-tight">
                You are now connected to your teacher! Click the chat bubble below to say hello.
              </p>
            </div>
            {/* The little down arrow pointing to the widget */}
            <div className="absolute -bottom-2 right-5 w-4 h-4 bg-[#1765a4] border-b border-r border-blue-400 rotate-45"></div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClassesBeginView;