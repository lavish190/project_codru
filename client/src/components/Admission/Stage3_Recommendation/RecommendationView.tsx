import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Award, CalendarDays, Clock, Globe, ChevronLeft, ChevronRight, 
  Loader2, ArrowRight, Video, VideoOff, Hourglass, CheckCircle2, 
  BookOpen, ShieldCheck, Sparkles, CreditCard, RefreshCw, BrainCircuit, Phone, HeartHandshake, Compass
} from "lucide-react";
import { TextField, Button, Autocomplete } from "@mui/material";

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

// 🚨 Added previewMode prop
export interface RecommendationViewProps {
  admissionData: any;
  onComplete: () => void;
  previewMode?: boolean; 
}

const RecommendationView: React.FC<RecommendationViewProps> = ({ admissionData: initialData, onComplete, previewMode = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState<"monthly" | "yearly" | null>(null);
  const [localAdmissionData, setLocalAdmissionData] = useState(initialData);
  const [BASE_YEARLY_FEE, setBaseYearlyFee] = useState(700000); 

  const stage3Data = localAdmissionData?.stage3_Recommendation || {};
  const status = stage3Data.status || "pending";
  const deadline = stage3Data.callDeadline ? new Date(stage3Data.callDeadline) : null;
  const booking = stage3Data.booking;

  const [selectedTimeZone, setSelectedTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [viewDate, setViewDate] = useState(new Date());
  const [availableUTCSlots, setAvailableUTCSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotObj, setSelectedSlotObj] = useState<Date | null>(null);

  useEffect(() => {
    // 🚨 If in Presentation Mode, only fetch the price, do NOT try to authenticate as parent
    if (previewMode) {
      fetchPlanPriceOnly();
      setIsLoading(false);
      return;
    }

    refreshAdmissionState();
    if (status === "pending") fetchAvailableSlots();
  }, [previewMode]);

  const fetchPlanPriceOnly = async () => {
    try {
      const planRes = await fetch(`${import.meta.env.VITE_API}api/payment/active-plan`);
      if (planRes.ok) {
          const planData = await planRes.json();
          if (planData.plan) setBaseYearlyFee(planData.plan.baseYearlyFee);
      }
    } catch (err) { console.error(err); }
  };

  const refreshAdmissionState = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/my-admission-progress`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) setLocalAdmissionData(await res.json());

      fetchPlanPriceOnly();
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  };

  const fetchAvailableSlots = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/available-slots`);
      if (res.ok) setAvailableUTCSlots(await res.json() || []);
    } catch (error) { console.error(error); }
  };

  const handleBookCall = async () => {
    if (!selectedSlotObj) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/parent/book-recommendation-call`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ date: selectedSlotObj.toISOString() })
      });
      if (res.ok) {
        await refreshAdmissionState();
      } else {
        alert("Failed to book slot.");
      }
    } catch (err) { alert("Network error."); } finally { setIsSubmitting(false); }
  };

  const handleEnrollment = async (cycle: "monthly" | "yearly") => {
    if (previewMode) return; // Block clicks during presentation
    setSubmittingPlan(cycle);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/payment/create-order`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ billingCycle: cycle })
      });
      const data = await res.json();
      if (res.ok && data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        alert("Payment initialization failed.");
      }
    } catch (err) { alert("Network error."); } finally { setSubmittingPlan(null); }
  };

  const minSelectableDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const maxSelectableDate = useMemo(() => {
    const d = deadline ? new Date(deadline) : new Date();
    if (!deadline) d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 999); return d;
  }, [deadline]);

  const prevMonthDisabled = viewDate.getFullYear() < minSelectableDate.getFullYear() || (viewDate.getFullYear() === minSelectableDate.getFullYear() && viewDate.getMonth() <= minSelectableDate.getMonth());
  const nextMonthDisabled = viewDate.getFullYear() > maxSelectableDate.getFullYear() || (viewDate.getFullYear() === maxSelectableDate.getFullYear() && viewDate.getMonth() >= maxSelectableDate.getMonth());

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
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="w-8 h-8 md:w-10 md:h-10"></div>);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const isSelected = selectedDate === dateString;
      const isDisabled = dateObj < minSelectableDate || dateObj > maxSelectableDate || !availableLocalDatesSet.has(dateString);

      days.push(
        <button key={d} type="button" disabled={isDisabled} onClick={() => { setSelectedDate(dateString); setSelectedSlotObj(null); }}
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

  // 🚨 If previewMode is true, bypass VIEW 1 and VIEW 2 entirely!
  if (status === "pending" && !previewMode) {
    const daysLeft = Math.ceil((maxSelectableDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return (
      <div className="max-w-3xl mx-auto bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-gray-100 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-[#1765a4] rounded-full flex items-center justify-center mx-auto mb-4"><Award size={32} /></div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-slate-800">Your Evaluation is Complete!</h2>
          <p className="text-slate-500 mt-2">Our teachers have analyzed the baseline test and drafted a personalized learning pathway. Please schedule a call to review it with your counselor.</p>
          <div className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-bold ${daysLeft <= 2 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[#1765a4]'}`}>
            ⏱ Schedule within {daysLeft} days to reserve your spot.
          </div>
        </div>

        <div className="bg-[#f8fafc] p-6 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm w-full mb-6">
            <Globe size={16} className="text-[#1765a4] flex-shrink-0" />
            <Autocomplete value={TIMEZONE_OPTIONS.find(opt => opt.value === selectedTimeZone) || TIMEZONE_OPTIONS[0]} onChange={(e, newValue) => { if (newValue) { setSelectedTimeZone(newValue.value); setSelectedSlotObj(null); } }} options={TIMEZONE_OPTIONS} getOptionLabel={(option) => option.label} disableClearable renderInput={(params) => <TextField {...params} variant="standard" placeholder="Search timezone..." sx={{ '& .MuiInputBase-root': { fontSize: '0.85rem', fontWeight: 'bold' }, '& .MuiInput-underline:before': { borderBottom: 'none !important' }, '& .MuiInput-underline:after': { borderBottom: 'none !important' } }} />} sx={{ flex: 1 }} />
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex gap-2">
                <button type="button" disabled={prevMonthDisabled} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className={`p-1.5 rounded-lg transition ${prevMonthDisabled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}><ChevronLeft size={20} /></button>
                <button type="button" disabled={nextMonthDisabled} onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className={`p-1.5 rounded-lg transition ${nextMonthDisabled ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}><ChevronRight size={20} /></button>
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

          <Button onClick={handleBookCall} disabled={isSubmitting || !selectedDate || !selectedSlotObj} variant="contained" fullWidth endIcon={isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />} sx={{ backgroundColor: '#1765a4', borderRadius: '14px', padding: '14px', fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'none' }}>
            {isSubmitting ? "Processing..." : "Confirm & Schedule Call"}
          </Button>
        </div>
      </div>
    );
  }

  // 🚨 If previewMode is true, bypass VIEW 1 and VIEW 2 entirely!
  if (status === "call_scheduled" && !previewMode) {
    const meetDate = booking?.date ? new Date(booking.date) : new Date();
    const formattedDate = meetDate.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    
    const now = new Date();
    const isReadyToJoin = now >= new Date(meetDate.getTime() - 10 * 60 * 1000) && now <= new Date(meetDate.getTime() + 45 * 60 * 1000);
    const isPast = now > new Date(meetDate.getTime() + 45 * 60 * 1000);

    return (
      <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 text-center animate-fade-in-up">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          {isPast ? <Hourglass className="w-10 h-10 text-[#1765a4] animate-pulse" /> : <Award className="w-10 h-10 text-[#1765a4]" />}
        </div>
        
        <h2 className="text-3xl font-display font-bold text-[#1765a4] mb-2">{isPast ? "Plan Being Prepared" : "Call Scheduled!"}</h2>
        <p className="text-gray-600 mb-8 max-w-lg mx-auto">
          {isPast 
            ? "Your counselor is unlocking your enrollment contract and fee structure. Please refresh this page momentarily to view your child's personalized plan."
            : "We have secured your time. During this call, the counselor will reveal your child's personalized learning pathway, curriculum, and applicable scholarships."}
        </p>

        <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-6 mb-8 text-left inline-block w-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[#1765a4] font-bold"><CalendarDays className="w-5 h-5" /> {isPast ? "Past Call Time" : "Scheduled Call Time"}</div>
            <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider"><Globe size={12} /> {Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
          </div>
          <p className={`text-xl font-black ${isPast ? 'text-gray-400 line-through' : 'text-slate-800'}`}>{formattedDate}</p>
        </div>

        <div className="flex flex-col items-center">
          {isPast ? (
            <button onClick={() => refreshAdmissionState()} className="flex items-center justify-center gap-2 w-full max-w-sm py-4 rounded-xl font-bold text-lg bg-[#ed7f23] text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
              <RefreshCw className="w-5 h-5" /> Check If Plan is Unlocked
            </button>
          ) : (
            <a href={isReadyToJoin ? booking.meetLink : "#"} target={isReadyToJoin ? "_blank" : "_self"} onClick={(e) => { if (!isReadyToJoin) e.preventDefault(); }} className={`flex items-center justify-center gap-2 w-full max-w-sm py-4 rounded-xl font-bold text-lg transition-all duration-300 ${isReadyToJoin ? "bg-[#1765a4] text-white shadow-lg hover:-translate-y-1" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
              {isReadyToJoin ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />} Join Google Meet
            </a>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: THE REVEAL & PAYMENT 
  // ==========================================
  const scholarship = stage3Data.scholarshipPercent || 0;
  
  // Base values
  const baseMonthly = Math.round(BASE_YEARLY_FEE / 12);
  const scholarshipMonthly = Math.round(baseMonthly * (scholarship / 100));
  const finalMonthlyFee = Math.round((BASE_YEARLY_FEE * (1 - scholarship / 100)) / 12);
  
  const baseYearly = BASE_YEARLY_FEE;
  const scholarshipYearly = Math.round(BASE_YEARLY_FEE * (scholarship / 100));
  
  // Math Breakdown for the displays
  const totalYearlyIfMonthly = finalMonthlyFee * 12;
  const extraAnnualDiscount = finalMonthlyFee * 2; 
  const yearlyFee10Months = finalMonthlyFee * 10;
  const equivalentMonthlyIfYearly = Math.round(yearlyFee10Months / 12);

  const personalizedFeatures = [
    { icon: Clock, title: "Optimized Daily Schedule", desc: `Maximum ${stage3Data.classDuration || "3 Hours/Day"} of focused instruction, completely freeing up weekends for family and rest.` },
    { icon: BrainCircuit, title: "Targeted Skill Building", desc: `Custom problem sets curated to directly address the specific academic needs identified in the baseline test.` },
    { icon: Phone, title: "Direct Mentor Access", desc: `Skip the helpdesk. You get priority 1-on-1 chat with your child's assigned teacher directly through our app.` },
    { icon: Video, title: "24/7 Library Access", desc: `Every class is recorded and organized in a personal dashboard for easy revision anytime.` },
    { icon: HeartHandshake, title: "Holistic Development", desc: `A curriculum that actively fosters empathy, self-reliance, and emotional resilience alongside academics.` },
    { icon: Compass, title: "Future-Ready Mapping", desc: `We don't just teach for exams; we continuously map their progress toward a definitive, successful career path.` }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up pb-12">
      
      {/* Top Header */}
      <div className="text-center bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><Award size={32} /></div>
        <h2 className="text-3xl md:text-4xl font-display font-bold text-slate-800">Your Personalized Learning Plan</h2>
        <p className="text-slate-500 mt-3 max-w-2xl mx-auto text-lg">Based on the assessment, we have built a custom curriculum to ensure empathetic growth, self-confidence, and academic success.</p>
      </div>

      {/* Full Width: Academic Track & Strategy */}
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><BookOpen size={24} className="text-[#1765a4]"/> Academic Framework</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recommended Pathway</span>
              <span className="text-xl font-black text-[#1765a4]">{stage3Data.recommendedPathway || "Custom Track"}</span>
            </div>
            <Award size={32} className="text-blue-100" />
          </div>
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NCERT Class Equivalent</span>
              <span className="text-xl font-black text-[#1765a4]">{stage3Data.classEquivalent || "To be determined"}</span>
            </div>
            <ShieldCheck size={32} className="text-blue-100" />
          </div>
        </div>
        
        <h3 className="text-sm font-bold text-slate-800 mb-3">Our Core Strategy For Your Child</h3>
        <p className="text-base text-slate-700 bg-[#fdf8f4] p-6 rounded-2xl border border-orange-100 leading-relaxed font-medium whitespace-pre-wrap">
          {stage3Data.workingPlan || "A custom working plan will be provided by your counselor."}
        </p>
      </div>

      {/* Full Width: Redesigned Features Grid */}
      <div className="bg-gradient-to-br from-white to-slate-50 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Sparkles className="text-[#ed7f23]"/> Curated Program Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {personalizedFeatures.map((feature, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
              <div className="w-10 h-10 bg-blue-50 text-[#1765a4] rounded-xl flex items-center justify-center mb-4">
                <feature.icon size={20} />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">{feature.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full Width: Side-by-Side Pricing */}
      <div className="bg-white p-6 md:p-10 rounded-3xl shadow-xl border border-slate-200">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-display font-bold text-slate-800 flex items-center justify-center gap-2 mb-2">
            <CreditCard className="text-[#ed7f23]" /> Choose Your Billing Cycle
          </h3>
          <p className="text-slate-500 text-sm">Select the payment plan that works best for your family.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* EQUAL WEIGHT: Monthly Card */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition hover:border-[#1765a4]">
            <div className="mb-6 flex-1">
              <h4 className="text-xl font-bold text-slate-800 mb-6 text-center">Monthly Plan</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                  <span>Base Monthly Tuition</span>
                  <span>₹{baseMonthly.toLocaleString('en-IN')}</span>
                </div>
                {scholarship > 0 && (
                  <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                    <span>Scholarship (-{scholarship}%)</span>
                    <span>-₹{scholarshipMonthly.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm font-medium text-slate-400">
                  <span>Annual Bonus</span>
                  <span>Not applicable</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                  <span>Total cost for 1 Year</span>
                  <span>₹{totalYearlyIfMonthly.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-6 border-t border-slate-200 mb-6 text-center">
              <span className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">You Pay Today</span>
              <span className="text-3xl font-black text-[#1765a4]">₹{finalMonthlyFee.toLocaleString('en-IN')}</span>
              <span className="block text-xs font-bold text-slate-400 mt-1">/ month</span>
            </div>

            <Button 
              onClick={() => handleEnrollment("monthly")} 
              disabled={submittingPlan !== null || previewMode} 
              variant="contained" 
              fullWidth 
              sx={{ backgroundColor: previewMode ? '#94a3b8' : '#1765a4', borderRadius: '12px', padding: '14px', fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none', "&:hover": { backgroundColor: previewMode ? '#94a3b8' : "#124f82" } }}
            >
              {submittingPlan === "monthly" ? <Loader2 className="animate-spin mx-auto" /> : (previewMode ? "Awaiting Parent Payment" : `Pay ₹${finalMonthlyFee.toLocaleString('en-IN')} & Enroll`)}
            </Button>
          </div>

          {/* EQUAL WEIGHT: Yearly Card */}
          <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition hover:border-[#1765a4]">
            <div className="mb-6 flex-1">
              <h4 className="text-xl font-bold text-slate-800 mb-6 text-center">Annual Plan</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                  <span>Base Yearly Tuition</span>
                  <span>₹{baseYearly.toLocaleString('en-IN')}</span>
                </div>
                
                {scholarship > 0 && (
                  <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                    <span>Scholarship (-{scholarship}%)</span>
                    <span>-₹{scholarshipYearly.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                  <span>Pay 10 Months, Get 12</span>
                  <span>-₹{extraAnnualDiscount.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-bold text-[#1765a4] bg-blue-50 p-3 rounded-xl border border-blue-100 mt-2">
                  <span>Equivalent Monthly Cost</span>
                  <span>₹{equivalentMonthlyIfYearly.toLocaleString('en-IN')} /mo</span>
                </div>
              </div>
            </div>
              
            <div className="pt-6 border-t border-slate-200 mb-6 text-center">
              <span className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">You Pay Today</span>
              <span className="text-3xl font-black text-[#1765a4]">₹{yearlyFee10Months.toLocaleString('en-IN')}</span>
              <span className="block text-xs font-bold text-slate-400 mt-1">/ year</span>
            </div>

            <Button 
              onClick={() => handleEnrollment("yearly")} 
              disabled={submittingPlan !== null || previewMode} 
              variant="contained" 
              fullWidth 
              sx={{ backgroundColor: previewMode ? '#94a3b8' : '#1765a4', borderRadius: '12px', padding: '14px', fontSize: '1rem', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none', "&:hover": { backgroundColor: previewMode ? '#94a3b8' : "#124f82" } }}
            >
              {submittingPlan === "yearly" ? <Loader2 className="animate-spin mx-auto" /> : (previewMode ? "Awaiting Parent Payment" : `Pay ₹${yearlyFee10Months.toLocaleString('en-IN')} & Enroll`)}
            </Button>
          </div>

        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
          <ShieldCheck size={16} className="text-emerald-500"/> Includes our 5-Day Comfort Guarantee
        </div>
      </div>
    </div>
  );
};

export default RecommendationView;