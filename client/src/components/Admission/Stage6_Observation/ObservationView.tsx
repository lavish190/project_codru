import React, { useState, useEffect, useMemo } from "react";
import { 
  PartyPopper, BookOpen, ShieldCheck, Video, FileText, Clock, CheckCircle2, Rocket, CalendarDays,
  CalendarX2, User, Mail, LogOut, Loader2, AlertTriangle, UserPlus, PlayCircle
} from "lucide-react";
import { Button, Dialog, TextField } from "@mui/material";

const ObservationView: React.FC<{ admissionData: any }> = ({ admissionData }) => {
  const stage4 = admissionData?.stage4_ClassesBegin || {};
  const stage5 = admissionData?.stage5_Confirmation || {};
  const stage6 = admissionData?.stage6_Observation || {};
  const scheduledClasses = stage4.scheduledClasses || [];
  
  const studentName = stage5.draftStudentDetails?.studentName || stage4.studentName || admissionData.name;
  const studentUsername = stage5.draftStudentDetails?.studentUsername || "";
  const studentEmail = stage5.draftStudentDetails?.studentEmail || "";
  const pathway = admissionData?.stage3_Recommendation?.recommendedPathway || "Standard";

  // ==========================================
  // STATES
  // ==========================================
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [reqDate, setReqDate] = useState("");
  const [reqTime, setReqTime] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  const [pastRecordings, setPastRecordings] = useState<any[]>([]);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true);

  // ==========================================
  // CALCULATE REMAINING CLASSES (1 Hour Buffer)
  // ==========================================
  const { remainingClasses, daysLeft, isInductionFinished } = useMemo(() => {
    const now = new Date().getTime();
    let remaining = 0;
    let lastClassTime = 0;

    scheduledClasses.forEach((cls: any) => {
      const [endH, endM] = cls.endTime.split(":").map(Number);
      const classEnd = new Date(cls.date);
      classEnd.setHours(endH + 1, endM, 0, 0); // 🚨 End time + 1 hour buffer

      if (now < classEnd.getTime()) {
        remaining++;
        if (classEnd.getTime() > lastClassTime) lastClassTime = classEnd.getTime();
      }
    });

    const days = lastClassTime > now ? Math.ceil((lastClassTime - now) / (1000 * 60 * 60 * 24)) : 0;
    return { remainingClasses: remaining, daysLeft: days, isInductionFinished: remaining === 0 };
  }, [scheduledClasses]);

  // ==========================================
  // EFFECTS & HANDLERS
  // ==========================================
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

  const handleRescheduleSubmit = async () => {
    if (!reqDate || !reqTime || !reqReason) return alert("Please fill all fields.");
    setIsSubmittingReschedule(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/parent/request-class-change/${selectedClass._id}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ requestedDate: reqDate, requestedStartTime: reqTime, reason: reqReason })
      });
      if (res.ok) {
        setRescheduleModalOpen(false);
        setReqReason("");
        alert("Reschedule request submitted.");
        window.location.reload(); 
      } else alert("Failed to submit request.");
    } catch (err) { alert("Network error"); }
    finally { setIsSubmittingReschedule(false); }
  };

  const handleSwitchToStudent = () => {
    localStorage.clear();
    // Redirects to signin with the email as a query parameter so you can pre-fill it!
    window.location.href = `/signin?prefill=${encodeURIComponent(studentEmail)}`;
  };

  const handleEnrollAnother = () => {
    // Navigates to the discovery call booking page or restarts admission state
    window.location.href = "/admissions"; 
  };

  // ==========================================
  // 🚨 STAGE 7: FINAL "FULLY ENROLLED" VIEW
  // ==========================================
  if (admissionData.admissionStage > 6 || stage6.completedAt) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 rounded-3xl shadow-xl border border-emerald-100 text-center animate-fade-in-up mt-10">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none rounded-3xl opacity-10">
          <PartyPopper size={400} className="absolute -top-20 -left-20 text-emerald-500" />
          <PartyPopper size={400} className="absolute -bottom-20 -right-20 text-blue-500" />
        </div>
        
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30 relative z-10">
          <ShieldCheck className="w-12 h-12 text-white" />
        </div>
        
        <h2 className="text-4xl md:text-5xl font-display font-black text-slate-800 mb-4 relative z-10">Fully Enrolled!</h2>
        <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto relative z-10 font-medium">
          <b className="text-emerald-600">{studentName}</b> has officially completed the induction phase and is now a permanent student at CuTe Learning. 
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
          <Button variant="outlined" onClick={() => setLogoutConfirmOpen(true)} sx={{ borderRadius: '14px', py: 1.5, px: 4, fontWeight: 'bold', textTransform: 'none', borderColor: '#cbd5e1', color: '#475569', "&:hover": { bgcolor: "#f8fafc" } }}>
            Switch to Student Login
          </Button>
          <Button variant="contained" onClick={handleEnrollAnother} sx={{ bgcolor: '#1765a4', borderRadius: '14px', py: 1.5, px: 4, fontWeight: 'bold', textTransform: 'none', boxShadow: 'none', "&:hover": { bgcolor: "#124f82" } }}>
            <UserPlus size={18} className="mr-2" /> Enroll Another Student
          </Button>
        </div>
      </div>
    );
  }

  // ==========================================
  // STAGE 6: ACTIVE INDUCTION & OBSERVATION
  // ==========================================
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-10">
      
      {/* 🎓 TOP: STUDENT ACCOUNT SUMMARY & LOGIN SWITCH */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="w-16 h-16 bg-blue-50 text-[#1765a4] rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
            <User size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-display font-bold text-slate-800 truncate leading-tight mb-1">{studentName}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded truncate">@{studentUsername}</span>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded truncate">{pathway}</span>
            </div>
          </div>
        </div>
        
        <Button 
          variant="outlined" 
          onClick={() => setLogoutConfirmOpen(true)}
          sx={{ borderRadius: '12px', py: 1.5, px: 3, fontWeight: 'bold', textTransform: 'none', borderColor: '#1765a4', color: '#1765a4', shrink: 0, width: { xs: '100%', md: 'auto' }, "&:hover": { bgcolor: "#f0f9ff" } }}
        >
          <LogOut size={16} className="mr-2" /> Switch to Student Login
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* 📅 LEFT COLUMN: INDUCTION GRID */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-2xl text-slate-800 flex items-center gap-2 mb-1">
                <PlayCircle className="text-emerald-500" /> Induction Classes
              </h3>
              <p className="text-sm text-slate-500">The teacher is actively observing the student's learning style.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
            {[...scheduledClasses]
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((cls: any, i: number) => {
              const d = new Date(cls.date);
              const isPending = cls.rescheduleRequest?.isPending;
              
              // 🚨 Check if the class is completely over (Date + End Time + 1 Hour Buffer)
              const [endH, endM] = cls.endTime.split(":").map(Number);
              const classEnd = new Date(cls.date);
              classEnd.setHours(endH + 1, endM, 0, 0);
              const isPast = new Date().getTime() > classEnd.getTime(); 

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
                    isPast ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : 
                    isPending ? 'bg-orange-50 border-orange-200 cursor-pointer' : 
                    'bg-slate-50 border-slate-200 hover:border-[#1765a4] cursor-pointer'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Day {i + 1}</span>
                    {isPast ? <CheckCircle2 size={12} className="text-emerald-500" /> : isPending && <Clock size={12} className="text-orange-500" />}
                  </div>
                  <span className={`block text-sm font-bold ${isPast ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className={`block text-[11px] font-bold mt-0.5 ${isPast ? 'text-slate-400' : 'text-[#1765a4]'}`}>
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

        {/* 🛡️ RIGHT COLUMN: TIMER & RECORDINGS */}
        <div className="flex flex-col gap-6">
          
          {/* TIMER WIDGET */}
          <div className="bg-gradient-to-br from-emerald-50 to-white p-6 md:p-8 rounded-3xl shadow-sm border border-emerald-100 flex flex-col relative overflow-hidden">
            <div className="absolute -right-8 -top-8 opacity-10"><Clock size={160} className="text-emerald-500" /></div>
            
            <h3 className="font-bold text-xl text-emerald-900 mb-2 relative z-10">Observation Phase</h3>
            <p className="text-sm text-emerald-800 mb-6 relative z-10 font-medium">
              The teacher is generating a comprehensive progress report based on these initial classes.
            </p>
            
            <div className="bg-white rounded-2xl p-6 border border-emerald-100 relative z-10 shadow-sm text-center">
              {isInductionFinished ? (
                <div>
                  <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                  <span className="block text-lg font-black text-slate-800 mb-1">Induction Complete!</span>
                  <span className="text-xs text-slate-500 font-medium">Awaiting counselor's final report.</span>
                </div>
              ) : (
                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Remaining Induction</span>
                  <div className="flex justify-center items-end gap-2 text-[#ed7f23]">
                    <span className="text-4xl font-black leading-none">{remainingClasses}</span>
                    <span className="text-sm font-bold pb-1">Classes left</span>
                  </div>
                  <span className="block text-xs font-bold text-slate-500 mt-2 bg-slate-50 py-1.5 rounded-lg border border-slate-100">Over the next {daysLeft} days</span>
                </div>
              )}
            </div>
          </div>

          {/* 📼 RECORDINGS CARD */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex-1">
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
      
      {/* 🚨 DIALOG: LOGOUT WARNING */}
      <Dialog open={logoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '24px', maxWidth: '400px', textAlign: 'center' } }}>
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-[#1765a4]">
          <LogOut size={32} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Log out Parent Account?</h3>
        <p className="text-sm text-slate-500 mb-6 font-medium leading-relaxed">
          This will sign you out of your Parent Dashboard so the student can log in and access their digital classroom directly. Proceed?
        </p>
        <div className="flex gap-3">
          <Button onClick={() => setLogoutConfirmOpen(false)} variant="outlined" fullWidth sx={{ borderRadius: '12px', color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={handleSwitchToStudent} variant="contained" fullWidth sx={{ bgcolor: '#1765a4', borderRadius: '12px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}>
            Yes, Log Out
          </Button>
        </div>
      </Dialog>

    </div>
  );
};

export default ObservationView;