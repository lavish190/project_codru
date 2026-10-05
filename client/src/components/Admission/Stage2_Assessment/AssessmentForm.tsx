import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Compass, UploadCloud, ChevronRight, ChevronLeft, 
  CheckCircle2, Loader2, Calendar as CalendarIcon, Clock, Globe, 
  FileText, X, ArrowRight, Video, VideoOff, CalendarDays, Hourglass, RefreshCw 
} from "lucide-react";
import { TextField, Button, Autocomplete } from "@mui/material";

interface Stage2Props {
  admissionData: any | null;
  onComplete: () => void;
}

const SUPPORTED_TIMEZONES = typeof (Intl as any).supportedValuesOf === "function" 
  ? (Intl as any).supportedValuesOf('timeZone') 
  : [Intl.DateTimeFormat().resolvedOptions().timeZone, 'Asia/Kolkata', 'America/New_York', 'Europe/London'];

const formatTimeZone = (tz: string) => {
  try {
    const formatter = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' });
    const offset = formatter.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
    return `${offset} - ${city}`;
  } catch { return tz; }
};

const TIMEZONE_OPTIONS = SUPPORTED_TIMEZONES.map(tz => ({ value: tz, label: formatTimeZone(tz) }));
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const AssessmentForm: React.FC<Stage2Props> = ({ admissionData, onComplete }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [isTestScheduled, setIsTestScheduled] = useState(false);
  const [deadline, setDeadline] = useState<Date | null>(null);
  
  const [meetLink, setMeetLink] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [liveTestStatus, setLiveTestStatus] = useState("scheduled"); 

  const [formData, setFormData] = useState({
    learningStyle: "", strengths: [] as string[], struggles: "", timeCommitment: "", techReady: "", internetConnection: "" 
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false); 

  const [selectedTimeZone, setSelectedTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [viewDate, setViewDate] = useState(new Date());
  const [availableUTCSlots, setAvailableUTCSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotObj, setSelectedSlotObj] = useState<Date | null>(null);
  
  const [documents, setDocuments] = useState<{ title: string; fileUrl: string; driveFileId?: string }[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchAssessmentProgress();
    fetchAvailableSlots();
  }, []);

  useEffect(() => {
    if (!isDataLoaded || isFormSubmitted) return; 
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const token = localStorage.getItem("jwtoken");
        await fetch(`${import.meta.env.VITE_API}api/assessment/auto-save`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ questionnaire: formData, currentStep: step }) 
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) { setSaveStatus("idle"); }
    }, 1000); 
    return () => clearTimeout(timer);
  }, [formData, step, isDataLoaded, isFormSubmitted]); 

  const fetchAssessmentProgress = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}api/assessment-progress`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      
      if (res.ok && data) {
        if (data.liveTest?.deadline) { setIsFormSubmitted(true); setDeadline(new Date(data.liveTest.deadline)); } 
        else if (data.currentStep) { setStep(data.currentStep); }

        if (data.liveTest?.status) {
          setLiveTestStatus(data.liveTest.status);
          if (data.liveTest.status === "scheduled" || data.liveTest.status === "completed") {
            setIsTestScheduled(true);
            if (data.liveTest.booking) { setMeetLink(data.liveTest.booking.meetLink); setMeetingDate(data.liveTest.booking.date); }
          }
        }

        if (data.questionnaire) {
          setFormData({
            learningStyle: data.questionnaire.learningStyle || "", strengths: data.questionnaire.strengths || [], struggles: data.questionnaire.struggles || "",
            timeCommitment: data.questionnaire.timeCommitment || "", techReady: data.questionnaire.techReady || "", internetConnection: data.questionnaire.internetConnection || ""
          });
        }
        if (data.documents) setDocuments(data.documents);
      }
    } catch (err) { console.error(err); } finally { setIsDataLoaded(true); setIsLoading(false); }
  };

  const fetchAvailableSlots = async () => {
    try {
      // 🚨 FIX: Pass the token to ensure we only get the assigned counselor's slots!
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}api/available-slots`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setAvailableUTCSlots(await res.json() || []);
    } catch (error) { console.error(error); }
  };

  const toggleStrength = (val: string) => setFormData(prev => ({ ...prev, strengths: prev.strengths.includes(val) ? prev.strengths.filter(i => i !== val) : [...prev.strengths, val] }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesToUpload = Array.from(e.target.files);
    
    if (documents.length + filesToUpload.length > 10) { alert("Max 10 documents allowed."); e.target.value = ""; return; }
    if (filesToUpload.some(f => f.size > 5 * 1024 * 1024)) { alert("One or more files exceed 5MB."); e.target.value = ""; return; }
    
    setUploadingDoc(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const successfulUploads: { title: string; fileUrl: string; driveFileId: string }[] = [];

      await Promise.all(filesToUpload.map(async (file) => {
        const uploadData = new FormData(); uploadData.append("file", file);
        const res = await fetch(`${import.meta.env.VITE_API}api/assessment/upload-document`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: uploadData });
        if (res.ok) {
          const data = await res.json();
          successfulUploads.push({ title: file.name, fileUrl: data.fileUrl, driveFileId: data.fileId });
        }
      }));

      if (successfulUploads.length > 0) {
        const updatedDocs = [...documents, ...successfulUploads];
        setDocuments(updatedDocs);
        await fetch(`${import.meta.env.VITE_API}api/assessment/auto-save`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ documents: updatedDocs, currentStep: step }) });
      }
    } catch (err) { alert("Network error during upload."); } finally { setUploadingDoc(false); e.target.value = ""; }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}api/assessment/auto-save`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ questionnaire: formData, currentStep: 3 }) });
      const res = await fetch(`${import.meta.env.VITE_API}api/assessment/submit-form`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setIsFormSubmitted(true); 
        if (data.assessment.liveTest.deadline) setDeadline(new Date(data.assessment.liveTest.deadline));
      }
    } catch (error) { alert("Failed to submit."); } finally { setIsSubmitting(false); }
  };

  const removeDocument = async (driveFileId: string | undefined, index: number) => {
    if (!driveFileId) return; 
    setIsDeleting(driveFileId);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}api/assessment/document/${driveFileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setDocuments(data.documents); } else alert("Failed to delete.");
    } catch (err) { alert("Network error."); } finally { setIsDeleting(null); }
  };

  const handleBookLiveTest = async () => {
    if (!selectedSlotObj) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/assessment/book-live-test`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ date: selectedSlotObj.toISOString() })
      });
      if (res.ok) {
        const data = await res.json();
        setMeetLink(data.meetLink); setMeetingDate(selectedSlotObj.toISOString()); 
        setLiveTestStatus("scheduled"); setIsTestScheduled(true);
      } else {
        const data = await res.json(); alert(data.error || "Failed to book slot.");
      }
    } catch (err) { alert("Network error."); } finally { setIsSubmitting(false); }
  };

  const validGlobalSlots = useMemo(() => availableUTCSlots.map(iso => new Date(iso)), [availableUTCSlots]);
  const availableLocalDatesSet = useMemo(() => {
    const validDates = new Set<string>();
    validGlobalSlots.forEach(slotObj => {
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: selectedTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      validDates.add(formatter.format(slotObj)); 
    });
    return validDates;
  }, [validGlobalSlots, selectedTimeZone]);

  const localSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return validGlobalSlots.filter(dateObj => {
       const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: selectedTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
       return formatter.format(dateObj) === selectedDate;
    });
  }, [selectedDate, selectedTimeZone, validGlobalSlots]);

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date(); today.setHours(0,0,0,0);
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="w-8 h-8 md:w-10 md:h-10"></div>);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const isPast = dateObj < today;
      const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      const isSelected = selectedDate === dateString;
      const endOfDay = new Date(dateObj); endOfDay.setHours(23, 59, 59, 999);
      const isAfterDeadline = deadline ? endOfDay > deadline : false;
      const isDisabled = isPast || isAfterDeadline || !availableLocalDatesSet.has(dateString);

      days.push(
        <button
          key={d} type="button" disabled={isDisabled} onClick={() => { setSelectedDate(dateString); setSelectedSlotObj(null); }}
          className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
            isSelected ? "bg-[#1765a4] text-white shadow-md scale-110" :
            isDisabled ? "text-gray-300 cursor-not-allowed bg-gray-50/50" : "text-gray-700 hover:bg-blue-50 hover:text-[#1765a4]"
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-[#1765a4] animate-spin" /></div>;

  if (isTestScheduled) {
    return (
      <LiveTestConfirmed 
        meetLink={meetLink} meetingDate={meetingDate} status={liveTestStatus} 
        onAnswersUploaded={() => setLiveTestStatus("completed")} documents={documents} uploadingDoc={uploadingDoc}
        isDeleting={isDeleting} handleFileUpload={handleFileUpload} removeDocument={removeDocument}
      />
    );
  }

  if (isFormSubmitted) {
    const daysLeft = deadline ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 7;
    return (
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-50 text-[#ed7f23] rounded-full flex items-center justify-center mx-auto mb-4"><CalendarIcon size={32} /></div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-800">Schedule Live Test</h2>
          <p className="text-slate-500 mt-2">Your questionnaire is saved! Please pick a slot for the 45-minute baseline test.</p>
          <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-bold ${daysLeft <= 2 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[#1765a4]'}`}>
            ⏱ You have {daysLeft} days left to schedule.
          </div>
        </div>

        <div className="bg-[#fdf8f4] p-6 rounded-2xl border border-orange-100">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-orange-100 shadow-sm w-full mb-6">
            <Globe size={16} className="text-[#ed7f23] flex-shrink-0" />
            <Autocomplete value={TIMEZONE_OPTIONS.find(opt => opt.value === selectedTimeZone) || TIMEZONE_OPTIONS[0]} onChange={(e, newValue) => { if (newValue) { setSelectedTimeZone(newValue.value); setSelectedSlotObj(null); } }} options={TIMEZONE_OPTIONS} getOptionLabel={(option) => option.label} disableClearable renderInput={(params) => <TextField {...params} variant="standard" placeholder="Search timezone..." sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem', fontWeight: 'bold' }, '& .MuiInput-underline:before': { borderBottom: 'none !important' }, '& .MuiInput-underline:after': { borderBottom: 'none !important' } }} />} sx={{ flex: 1 }} />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex gap-2">
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={20} /></button>
                <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={20} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">{WEEKDAYS.map(day => <div key={day} className="text-center text-xs font-bold text-gray-400">{day}</div>)}</div>
            <div className="grid grid-cols-7 gap-1 place-items-center">{renderCalendarDays()}</div>
          </div>

          <AnimatePresence mode="wait">
            {selectedDate && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mb-6">
                  <p className="text-sm font-bold text-gray-500 mb-3">Available slots for {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {localSlotsForSelectedDate.length > 0 ? localSlotsForSelectedDate.map((slotObj) => (
                      <button key={slotObj.getTime()} type="button" onClick={() => setSelectedSlotObj(slotObj)} className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border font-bold text-sm transition-all ${selectedSlotObj?.getTime() === slotObj.getTime() ? 'bg-[#1765a4] text-white border-[#1765a4] shadow-md scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1765a4]'}`}>
                        <Clock size={14} className={selectedSlotObj?.getTime() === slotObj.getTime() ? "text-white" : "text-gray-400"} />
                        {slotObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: selectedTimeZone })}
                      </button>
                    )) : <p className="col-span-3 text-sm text-gray-400">No slots available.</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={handleBookLiveTest} disabled={isSubmitting || !selectedDate || !selectedSlotObj} variant="contained" fullWidth endIcon={isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />} sx={{ backgroundColor: '#ed7f23', borderRadius: '14px', padding: '14px', fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'none' }}>
            {isSubmitting ? "Processing..." : "Confirm & Book Slot"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100 relative">
      <div className="absolute top-6 right-6 md:top-8 md:right-8">
        {saveStatus === "saving" && <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Saving...</span>}
        {saveStatus === "saved" && <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={12}/> Saved</span>}
      </div>

      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-50 text-[#1765a4] rounded-full flex items-center justify-center mx-auto mb-4"><Brain size={32} /></div>
        <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-800">Child Assessment</h2>
        <p className="text-slate-500 mt-2">Help us understand your child's unique needs so we can build the perfect learning path.</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((i) => <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-[#ed7f23]' : 'bg-slate-100'}`} />)}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Compass className="text-[#1765a4]" size={20} /> How does your child learn best?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {["Visual (Images & Videos)", "Auditory (Listening & Speaking)", "Kinesthetic (Hands-on & Movement)", "Not Sure Yet"].map(style => (
                <button key={style} onClick={() => setFormData(prev => ({ ...prev, learningStyle: style }))} className={`p-4 rounded-xl border-2 text-left font-bold transition-all ${formData.learningStyle === style ? 'border-[#1765a4] bg-blue-50 text-[#1765a4]' : 'border-slate-100 text-slate-600 hover:border-blue-200'}`}>
                  {style}
                </button>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4">What are their current interests/strengths? (Select all that apply)</h3>
            <div className="flex flex-wrap gap-2 mb-8">
              {["Math & Logic", "Science & Discovery", "Art & Creativity", "Reading & Storytelling", "Technology & Coding", "Nature & Outdoors", "Not Sure Yet"].map(trait => (
                <button key={trait} onClick={() => toggleStrength(trait)} className={`px-4 py-2 rounded-full border text-sm font-bold transition-all ${formData.strengths.includes(trait) ? 'border-[#ed7f23] bg-orange-50 text-[#ed7f23]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                  {trait}
                </button>
              ))}
            </div>
            <ButtonRow onNext={() => setStep(2)} nextDisabled={!formData.learningStyle || formData.strengths.length === 0} />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">How much time can a parent/guardian commit to assisting daily?</h3>
            <div className="space-y-3 mb-6">
              {["1-2 Hours (Needs highly independent work)", "3-4 Hours (Moderate involvement)", "5+ Hours (Full hands-on homeschooling)"].map(time => (
                <button key={time} onClick={() => setFormData(prev => ({ ...prev, timeCommitment: time }))} className={`w-full p-4 rounded-xl border-2 text-left font-bold transition-all ${formData.timeCommitment === time ? 'border-[#1765a4] bg-blue-50 text-[#1765a4]' : 'border-slate-100 text-slate-600 hover:border-blue-200'}`}>
                  {time}
                </button>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4">Tech Readiness</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {["Dedicated Laptop/Tablet", "Shared Family Computer", "Requires Device Assistance"].map(tech => (
                <button key={tech} onClick={() => setFormData(prev => ({ ...prev, techReady: tech }))} className={`p-4 rounded-xl border-2 text-left font-bold transition-all ${formData.techReady === tech ? 'border-[#ed7f23] bg-orange-50 text-[#ed7f23]' : 'border-slate-100 text-slate-600 hover:border-orange-200'}`}>
                  {tech}
                </button>
              ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Globe className="text-[#1765a4]" size={20} /> Internet Connection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {["High-Speed Fiber / Broadband", "Mobile Data / Hotspot", "Unreliable / Needs Upgrade", "Not Sure"].map(conn => (
                <button key={conn} onClick={() => setFormData(prev => ({ ...prev, internetConnection: conn }))} className={`p-4 rounded-xl border-2 text-left font-bold transition-all ${formData.internetConnection === conn ? 'border-[#1765a4] bg-blue-50 text-[#1765a4]' : 'border-slate-100 text-slate-600 hover:border-blue-200'}`}>
                  {conn}
                </button>
              ))}
            </div>
            <ButtonRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!formData.timeCommitment || !formData.techReady || !formData.internetConnection} />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Any current academic struggles?</h3>
            <p className="text-xs text-slate-500 mb-4">E.g., Math anxiety, attention span, reading comprehension (Optional)</p>
            <textarea value={formData.struggles} onChange={(e) => setFormData(prev => ({ ...prev, struggles: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-medium outline-none focus:border-[#1765a4] min-h-[100px] mb-6" placeholder="Tell us what challenges they face..." />

            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><UploadCloud className="text-[#ed7f23]" size={20} /> Upload Documents (Optional)</h3>
            <label className="block border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50 mb-4 hover:bg-slate-100 transition cursor-pointer">
              {uploadingDoc ? (
                <div className="flex flex-col items-center justify-center text-[#1765a4]"><Loader2 className="animate-spin mb-2" size={24} /><p className="text-sm font-bold">Uploading to secure Drive...</p></div>
              ) : (
                <><input type="file" multiple className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} /><p className="text-sm font-bold text-slate-500">Click to upload past report cards or portfolios</p><p className="text-xs text-slate-400 mt-1">PDF, JPG, or PNG (Max 5MB)</p></>
              )}
            </label>

            {documents.length > 0 && (
              <div className="space-y-2 mb-8">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="text-[#1765a4] flex-shrink-0" size={18} />
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-sm text-slate-700 hover:text-[#1765a4] hover:underline truncate">{doc.title}</a>
                    </div>
                    <button type="button" onClick={() => removeDocument(doc.driveFileId, idx)} disabled={isDeleting === doc.driveFileId} className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50">
                      {isDeleting === doc.driveFileId ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">Back</button>
              <button onClick={handleSubmit} disabled={isSubmitting || saveStatus === "saving"} className="flex-1 flex items-center justify-center gap-2 bg-[#1765a4] text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> Submit & Schedule Test</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ButtonRow = ({ onBack, onNext, nextDisabled }: any) => (
  <div className="flex gap-3 pt-4 border-t border-slate-100">
    {onBack && <button onClick={onBack} className="px-6 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition">Back</button>}
    <button onClick={onNext} disabled={nextDisabled} className="flex-1 flex items-center justify-center gap-2 bg-[#1765a4] text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition disabled:opacity-50">
      Continue <ChevronRight size={18} />
    </button>
  </div>
);

interface LiveTestProps {
  meetLink: string; meetingDate: string; status: string;
  onAnswersUploaded: () => void;
  documents: { title: string; fileUrl: string; driveFileId?: string }[];
  uploadingDoc: boolean; isDeleting: string | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeDocument: (id: string | undefined, index: number) => Promise<void>;
}

const LiveTestConfirmed: React.FC<LiveTestProps> = ({ 
  meetLink, meetingDate, status, onAnswersUploaded, 
  documents, uploadingDoc, isDeleting, handleFileUpload, removeDocument 
}) => {
  const [canJoin, setCanJoin] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [timeMessage, setTimeMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!meetingDate) return;
    const checkMeetingTime = () => {
      const now = new Date();
      const meetStart = new Date(meetingDate);
      const meetEnd = new Date(meetStart.getTime() + 45 * 60 * 1000); 
      const windowOpens = new Date(meetStart.getTime() - 10 * 60 * 1000); 

      if (now >= windowOpens && now <= meetEnd) {
        setCanJoin(true); setIsOver(false); setTimeMessage("The testing room is open!");
      } else if (now > meetEnd) {
        setCanJoin(false); setIsOver(true);
      } else {
        setCanJoin(false); setIsOver(false); setTimeMessage("The Join button will unlock 10 minutes before the test.");
      }
    };

    checkMeetingTime(); 
    const interval = setInterval(checkMeetingTime, 60000); 
    return () => clearInterval(interval);
  }, [meetingDate]);

  const formattedDate = new Date(meetingDate).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const handleSubmitAnswers = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}api/assessment/complete-test`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { onAnswersUploaded(); } else { alert("Failed to submit answers."); }
    } catch (err) { alert("Network error."); } finally { setIsSubmitting(false); }
  };

  if (status === "completed") {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 text-center animate-fade-in-up">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Hourglass className="w-10 h-10 text-[#ed7f23] animate-pulse" />
        </div>
        <h2 className="text-3xl font-display font-bold text-[#1765a4] mb-2">Answers Submitted!</h2>
        <p className="text-gray-600 mb-8 max-w-lg mx-auto">
          The teacher is currently reviewing your child's baseline performance and written answers. Stage 3 will unlock automatically once they finalize the recommended track.
        </p>
        <button 
          onClick={() => { setIsRefreshing(true); setTimeout(() => window.location.reload(), 800); }}
          className="inline-flex items-center justify-center gap-2 py-4 px-8 rounded-xl font-bold text-lg bg-[#1765a4] text-white shadow-lg hover:-translate-y-1 transition-all duration-300"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} /> Check Teacher Approval
        </button>
      </div>
    );
  }

  const showUploadBox = canJoin || isOver;

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 text-center animate-fade-in-up">
      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
      </div>
      
      <h2 className="text-3xl font-display font-bold text-[#1765a4] mb-2">{isOver ? "Live Test Concluded" : "Live Test Scheduled!"}</h2>
      <p className="text-gray-600 mb-8 max-w-lg mx-auto">
        {isOver 
          ? "The test time has concluded. Please upload your child's written answer sheets below and click Submit."
          : "We have secured your testing slot. Please ensure your child is ready with their device and some blank paper for the test."}
      </p>

      <div className="bg-[#fdf8f4] border border-[#ed7f23]/20 rounded-2xl p-6 mb-8 text-left inline-block w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[#ed7f23] font-bold"><CalendarDays className="w-5 h-5" />{isOver ? "Past Test Time" : "Scheduled Time"}</div>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider"><Globe size={12} /> {userTimeZone}</div>
        </div>
        <p className={`text-xl font-black ${isOver ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#1765a4]'}`}>{formattedDate}</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {!isOver && (
          <>
            <a href={canJoin ? meetLink : "#"} target={canJoin ? "_blank" : "_self"} rel="noreferrer" onClick={(e) => { if (!canJoin) e.preventDefault(); }} className={`flex items-center justify-center gap-2 w-full max-w-sm py-4 rounded-xl font-bold text-lg transition-all duration-300 ${canJoin ? "bg-[#1765a4] text-white shadow-lg hover:-translate-y-1 hover:shadow-xl" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
              {canJoin ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />} Join Google Meet Test
            </a>
            <p className={`text-sm font-bold ${canJoin ? 'text-green-600' : 'text-gray-400'}`}>{timeMessage}</p>
          </>
        )}

        {showUploadBox && (
          <div className="w-full mt-4 border-t border-slate-100 pt-6">
            <h4 className="font-bold text-slate-800 mb-3 flex items-center justify-center gap-2"><UploadCloud size={20} className="text-[#ed7f23]" /> {canJoin ? "Finished Early? Upload Answers" : "Upload Test Answers"}</h4>
            
            <label className="block border-2 border-dashed border-[#1765a4]/30 rounded-2xl p-6 text-center bg-blue-50 hover:bg-blue-100 transition cursor-pointer mb-4">
              {uploadingDoc ? (
                <div className="flex flex-col items-center justify-center text-[#1765a4]"><Loader2 className="animate-spin mb-2" size={24} /><p className="text-sm font-bold">Uploading securely...</p></div>
              ) : (
                <><input type="file" multiple className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} /><p className="text-sm font-bold text-[#1765a4]">Click to upload photos/PDFs</p><p className="text-xs text-slate-500 mt-1">Select all answer pages</p></>
              )}
            </label>

            {documents.length > 0 && (
              <div className="space-y-2 mb-6">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-left">
                    <div className="flex items-center gap-3 overflow-hidden"><FileText className="text-[#1765a4] flex-shrink-0" size={18} /><a href={doc.fileUrl} target="_blank" rel="noreferrer" className="font-medium text-sm text-slate-700 hover:text-[#1765a4] hover:underline truncate">{doc.title}</a></div>
                    <button type="button" onClick={() => removeDocument(doc.driveFileId, idx)} disabled={isDeleting === doc.driveFileId} className="p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50">{isDeleting === doc.driveFileId ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}</button>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={handleSubmitAnswers} disabled={isSubmitting || documents.length === 0} variant="contained" fullWidth endIcon={isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} sx={{ backgroundColor: '#1765a4', borderRadius: '12px', padding: '12px', fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}>
              {isSubmitting ? "Submitting..." : "Submit All Answers"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentForm;