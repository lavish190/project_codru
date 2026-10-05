import React, { useState, useMemo, useEffect, useRef } from "react";
import { TextField, Button, Dialog, Autocomplete } from "@mui/material";
import { UserCheck, Calendar as CalendarIcon, Clock, Loader2, ArrowRight, Lock, Mail, Globe, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import BookingConfirmed from "./BookingConfirmed";
import { AdmissionData } from "../AdmissionPortal";

interface Props {
  admissionData: AdmissionData | null;
}

// 🌍 Get Browser Timezones safely
const SUPPORTED_TIMEZONES = typeof (Intl as any).supportedValuesOf === "function" 
  ? (Intl as any).supportedValuesOf('timeZone') 
  : [Intl.DateTimeFormat().resolvedOptions().timeZone, 'Asia/Kolkata', 'America/New_York', 'Europe/London', 'Australia/Sydney'];

const formatTimeZone = (tz: string) => {
  try {
    const formatter = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' });
    const offset = formatter.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
    return `${offset} - ${city}`;
  } catch { return tz; }
};

const getExtendedSearchTerms = (tz: string) => {
  const lower = tz.toLowerCase();
  const terms = [tz.replace(/_/g, " ")];
  if (lower.includes("kolkata") || lower.includes("calcutta")) terms.push("india", "bharat", "in");
  if (lower.includes("new_york") || lower.includes("chicago") || lower.includes("los_angeles")) terms.push("usa", "us", "united states", "america");
  if (lower.includes("london")) terms.push("uk", "united kingdom", "england", "great britain");
  if (lower.includes("dubai")) terms.push("uae", "united arab emirates", "middle east");
  if (lower.includes("sydney") || lower.includes("melbourne")) terms.push("australia", "au");
  if (lower.includes("toronto")) terms.push("canada", "ca");
  if (lower.includes("berlin")) terms.push("germany", "de");
  return terms.join(" ");
};

const TIMEZONE_OPTIONS = SUPPORTED_TIMEZONES.map(tz => ({
  value: tz,
  label: formatTimeZone(tz),
  searchString: `${tz.replace(/_/g, " ")} ${formatTimeZone(tz)} ${getExtendedSearchTerms(tz)}`.toLowerCase()
}));

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const DiscoveryOrchestrator: React.FC<Props> = ({ admissionData }) => {
  const [isConfirmed, setIsConfirmed] = useState(!!admissionData?.meetLink);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  
  // 🚨 NEW: Override Warning State
  const [showOverrideWarning, setShowOverrideWarning] = useState(false);

  const [otpValue, setOtpValue] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [selectedTimeZone, setSelectedTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [viewDate, setViewDate] = useState(new Date());

  const slotsContainerRef = useRef<HTMLDivElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const [availableUTCSlots, setAvailableUTCSlots] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    parentName: admissionData?.name || "",
    email: admissionData?.email || "",
    phone: admissionData?.phone || "",
    childAge: admissionData?.childAge || "",
    currentSchooling: admissionData?.currentSchooling || "",
    selectedDate: "",
    selectedSlotObj: null as Date | null,
    meetLink: admissionData?.meetLink || "",
    meetingDateISO: admissionData?.meetingDateISO || ""
  });

  const handleInputChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

  useEffect(() => {
    if (admissionData?.meetLink) {
      setIsConfirmed(true);
      setFormData(prev => ({
        ...prev,
        meetLink: admissionData.meetLink,
        meetingDateISO: admissionData.meetingDateISO
      }));
    }
  }, [admissionData]);

  useEffect(() => {
    const fetchDynamicSlots = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/available-slots`);
        if (res.ok) {
          const data = await res.json();
          setAvailableUTCSlots(data || []); 
        }
      } catch (error) {
        console.error("Failed to load availability", error);
      } finally {
        setIsLoadingSlots(false);
      }
    };
    fetchDynamicSlots();
  }, []);

  const validGlobalSlots = useMemo(() => {
    return availableUTCSlots.map(isoString => new Date(isoString));
  }, [availableUTCSlots]);

  const availableLocalDatesSet = useMemo(() => {
    const validDates = new Set<string>();
    validGlobalSlots.forEach(slotObj => {
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: selectedTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      validDates.add(formatter.format(slotObj)); 
    });
    return validDates;
  }, [validGlobalSlots, selectedTimeZone]);

  const localSlotsForSelectedDate = useMemo(() => {
    if (!formData.selectedDate) return [];
    return validGlobalSlots.filter(dateObj => {
       const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: selectedTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
       return formatter.format(dateObj) === formData.selectedDate;
    });
  }, [formData.selectedDate, selectedTimeZone, validGlobalSlots]);

  useEffect(() => {
    if (formData.selectedDate && submitButtonRef.current) {
      setTimeout(() => {
        const rect = submitButtonRef.current?.getBoundingClientRect();
        if (rect) {
          const isFullyVisible = rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
          if (!isFullyVisible) {
            submitButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      }, 300); 
    }
  }, [formData.selectedDate]);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const renderCalendarDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8 md:w-10 md:h-10"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
      const isPast = dateObj < today;
      
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateString = `${y}-${m}-${day}`;
      
      const isSelected = formData.selectedDate === dateString;
      const isDisabled = isPast || !availableLocalDatesSet.has(dateString);

      days.push(
        <button
          key={d}
          type="button"
          disabled={isDisabled}
          onClick={() => setFormData({ ...formData, selectedDate: dateString, selectedSlotObj: null })}
          className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
            isSelected ? "bg-[#1765a4] text-white shadow-md scale-110" :
            isDisabled ? "text-gray-300 cursor-not-allowed bg-gray-50/50" : 
            "text-gray-700 hover:bg-blue-50 hover:text-[#1765a4]"
          }`}
        >
          {d}
        </button>
      );
    }
    return days;
  };

  // 🚨 NEW: Intercepts the form submission to check for conflicting emails!
  const handleBookingSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.selectedDate || !formData.selectedSlotObj) return alert("Select a date and time slot.");
    
    // Safety Net: Are they logged in, but trying to book with a NEW email?
    if (admissionData?.email && admissionData.email.toLowerCase() !== formData.email.toLowerCase().trim()) {
      setShowOverrideWarning(true);
      return; 
    }

    // If emails match or they aren't logged in, proceed normally!
    executeBookingFlow();
  };

  // 🚨 NEW: Moved the actual API logic into its own function so the modal can trigger it
  const executeBookingFlow = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/start-admission`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isExistingUser) setShowOtpModal(true);
        else setShowNewUserModal(true);
      } else alert(data.error || "Failed to process details.");
    } catch (error) { alert("Network error."); } 
    finally { setIsSubmitting(false); }
  };

  const executeBooking = async (token: string) => {
    setIsSubmitting(true);
    try {
      const startDateTime = formData.selectedSlotObj!;
      const res = await fetch(`${import.meta.env.VITE_API}api/confirm-discovery-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          title: `Discovery Call: ${formData.parentName}`,
          date: startDateTime.toISOString(), 
          description: `Age: ${formData.childAge}\nSchooling: ${formData.currentSchooling}`,
          parentName: formData.parentName,
          phone: formData.phone,
          email: formData.email,
          childAge: formData.childAge,
          currentSchooling: formData.currentSchooling
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFormData(prev => ({ ...prev, meetLink: data.meetLink, meetingDateISO: startDateTime.toISOString() }));
        setShowOtpModal(false);
        setShowNewUserModal(false);
        setIsConfirmed(true);
      } else alert("Failed to book slot. It may have just been taken!");
    } catch (error) { alert("Booking error."); } 
    finally { setIsSubmitting(false); }
  };

  const handleExistingUserOtp = async (finalOtp: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-otp-login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: formData.email, otp: finalOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("jwtoken", data.token);
        executeBooking(data.token);
      } else alert("Invalid OTP.");
    } catch (error) { alert("Verification failed."); }
  };

  const handleNewUserSubmit = async () => {
    if (otpValue.length !== 4 || newPassword.length < 6) return alert("Check OTP and Password.");
    try {
      const otpRes = await fetch(`${import.meta.env.VITE_API}verify-email`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: formData.email, otp: otpValue }),
      });
      if (!otpRes.ok) return alert("Invalid OTP.");
      const regRes = await fetch(`${import.meta.env.VITE_API}register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.parentName, email: formData.email, username: formData.email.split("@")[0] + Math.floor(Math.random() * 100),
          phone: formData.phone, password: newPassword, cpassword: newPassword, role: "Parent"
        }),
      });
      const regData = await regRes.json();
      if (regRes.ok) {
        localStorage.setItem("jwtoken", regData.token);
        executeBooking(regData.token);
      } else alert(regData.error || "Registration failed.");
    } catch (error) { alert("Verification failed."); }
  };

  if (isConfirmed) {
    return <BookingConfirmed meetLink={formData.meetLink} meetingDate={formData.meetingDateISO} />;
  }

  return (
    <div className="max-w-[1200px] mx-auto relative">
      <form onSubmit={handleBookingSubmit} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col lg:flex-row">
        
        <div className="flex-1 p-8 md:p-12 lg:border-r border-gray-100 bg-white">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-[#1765a4]" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-[#1765a4]">Family Details</h2>
              <p className="text-sm text-gray-500">Tell us about your child.</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <TextField label="Parent's Full Name" name="parentName" value={formData.parentName} onChange={handleInputChange} fullWidth required sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            <div className="flex flex-col md:flex-row gap-6">
              <TextField label="Email Address" type="email" name="email" value={formData.email} onChange={handleInputChange} fullWidth required sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              <TextField label="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} fullWidth required sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            </div>
            <TextField label="Child's Age" type="number" name="childAge" value={formData.childAge} onChange={handleInputChange} fullWidth required sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            <TextField label="Current Schooling Situation" name="currentSchooling" placeholder="e.g., Traditional School, Unschooling..." value={formData.currentSchooling} onChange={handleInputChange} fullWidth multiline rows={3} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          </div>
        </div>

        <div className="flex-1 p-8 md:p-12 bg-[#fdf8f4]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                <CalendarIcon className="w-6 h-6 text-[#ed7f23]" />
              </div>
              <h2 className="text-2xl font-display font-bold text-[#1765a4]">Schedule Call</h2>
            </div>
            
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-orange-100 shadow-sm w-full xl:w-64">
              <Globe size={16} className="text-[#ed7f23] flex-shrink-0" />
              <Autocomplete
                value={TIMEZONE_OPTIONS.find(opt => opt.value === selectedTimeZone) || TIMEZONE_OPTIONS[0]}
                onChange={(event, newValue) => {
                  if (newValue) {
                    setSelectedTimeZone(newValue.value);
                    setFormData({ ...formData, selectedSlotObj: null }); 
                  }
                }}
                options={TIMEZONE_OPTIONS}
                getOptionLabel={(option) => option.label}
                filterOptions={(options, { inputValue }) => {
                  const searchStr = inputValue.toLowerCase();
                  return options.filter(opt => opt.searchString.includes(searchStr));
                }}
                disableClearable
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    variant="standard"
                    placeholder="Search timezone..."
                    sx={{
                      '& .MuiInputBase-root': { fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', padding: 0 },
                      '& .MuiInput-underline:before': { borderBottom: 'none !important' },
                      '& .MuiInput-underline:after': { borderBottom: 'none !important' },
                      '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none !important' }
                    }}
                  />
                )}
                sx={{ flex: 1, '& .MuiAutocomplete-endAdornment': { top: 'calc(50% - 10px)' }, '& .MuiSvgIcon-root': { width: '0.8em', height: '0.8em' } }}
              />
            </div>
          </div>
          
          <div className="bg-transparent flex items-center justify-center text-sm text-gray-400 rounded-2xl pb-4 h-6">
            {isLoadingSlots ? "Loading counselor schedules..." : "Click a date to view available time slots."}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-lg">
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-2">
                <button type="button" onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft size={20} /></button>
                <button type="button" onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight size={20} /></button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map(day => <div key={day} className="text-center text-xs font-bold text-gray-400">{day}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1 place-items-center relative">
              {isLoadingSlots && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#1765a4] animate-spin" />
                </div>
              )}
              {renderCalendarDays()}
            </div>
          </div>

          <div ref={slotsContainerRef}>
            <AnimatePresence mode="wait">
              {formData.selectedDate && (
                <motion.div
                  key="slots-container"
                  initial={{ height: 0, opacity: 0, overflow: "hidden" }}
                  animate={{ height: "auto", opacity: 1, overflow: "visible" }}
                  exit={{ height: 0, opacity: 0, overflow: "hidden" }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  {localSlotsForSelectedDate.length > 0 ? (
                    <div className="mb-6">
                      <p className="text-sm font-bold text-gray-500 mb-3">Available time slots for {new Date(formData.selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {localSlotsForSelectedDate.map((slotObj) => {
                          const timeString = slotObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: selectedTimeZone });
                          const isSelected = formData.selectedSlotObj?.getTime() === slotObj.getTime();
                          return (
                            <button
                              key={slotObj.getTime()} type="button" onClick={() => setFormData({ ...formData, selectedSlotObj: slotObj })}
                              className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border font-bold text-sm transition-all ${
                                isSelected ? 'bg-[#1765a4] text-white border-[#1765a4] shadow-md scale-[1.02]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1765a4]'
                              }`}
                            >
                              <Clock size={14} className={isSelected ? "text-white" : "text-gray-400"} />
                              {timeString}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 text-center text-sm text-gray-500 mb-6">
                      <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      No open slots available on this date.
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button 
            ref={submitButtonRef}
            type="submit" disabled={isSubmitting || !formData.selectedDate || !formData.selectedSlotObj} variant="contained" fullWidth
            endIcon={isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowRight />} 
            sx={{ backgroundColor: '#ed7f23', borderRadius: '14px', padding: '14px', fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'none', mt: formData.selectedDate ? 0 : 2 }}
          >
            {isSubmitting ? "Processing..." : "Confirm & Book Slot"}
          </Button>
        </div>
      </form>
      
      {/* 🚨 NEW: Account Override Warning Modal */}
      <AnimatePresence>
        {showOverrideWarning && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              
              <h3 className="text-2xl font-display font-bold text-slate-800 mb-2">Wait a second!</h3>
              
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                You are currently logged in as <strong className="text-slate-800">{admissionData?.email}</strong>. 
                If you proceed with <strong className="text-[#1765a4]">{formData.email}</strong>, you will be logged out of the current account. 
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowOverrideWarning(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setShowOverrideWarning(false);
                    // 🚨 Safely flush the old account to prevent cross-contamination
                    localStorage.removeItem("jwtoken"); 
                    executeBookingFlow(); 
                  }}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition active:scale-95"
                >
                  Log Out & Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showOtpModal} onClose={() => setShowOtpModal(false)} slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px' } } }}>
        <div className="p-8 text-center flex flex-col items-center">
          <Mail className="w-12 h-12 text-[#1765a4] mb-4" />
          <h3 className="text-2xl font-display font-bold text-[#1765a4] mb-2">Welcome Back!</h3>
          <p className="text-gray-500 mb-6 text-sm">Enter the code sent to <b>{formData.email}</b> to verify and book.</p>
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <input key={index} id={`otp-${index}`} type="text" maxLength={1} value={otpValue[index] || ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  const otpArray = otpValue.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setOtpValue(newOtp);
                  if (val && index < 3) document.getElementById(`otp-${index + 1}`)?.focus();
                  if (newOtp.length === 4) handleExistingUserOtp(newOtp);
                }}
                className="w-14 h-14 text-center text-2xl font-black text-[#1765a4] bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-[#1765a4]"
              />
            ))}
          </div>
        </div>
      </Dialog>

      <Dialog open={showNewUserModal} onClose={() => setShowNewUserModal(false)} slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px' } } }}>
        <div className="p-8 text-center flex flex-col items-center w-full max-w-sm">
          <Lock className="w-12 h-12 text-[#ed7f23] mb-4" />
          <h3 className="text-2xl font-display font-bold text-[#1765a4] mb-2">Create Parent Account</h3>
          <p className="text-gray-500 mb-6 text-sm">Enter the code sent to <b>{formData.email}</b> and set a password.</p>
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <input key={`new-${index}`} id={`new-otp-${index}`} type="text" maxLength={1} value={otpValue[index] || ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  const otpArray = otpValue.split("");
                  otpArray[index] = val;
                  setOtpValue(otpArray.join(""));
                  if (val && index < 3) document.getElementById(`new-otp-${index + 1}`)?.focus();
                }}
                className="w-12 h-12 text-center text-xl font-black text-[#1765a4] bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-[#ed7f23]"
              />
            ))}
          </div>
          <input type="password" placeholder="Create Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            className="w-full pl-4 py-3 mb-6 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#1765a4]" />
          <Button onClick={handleNewUserSubmit} variant="contained" fullWidth sx={{ backgroundColor: '#ed7f23', borderRadius: '12px', padding: '12px', fontWeight: 'bold', textTransform: 'none' }}>
            Verify & Book Call
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

export default DiscoveryOrchestrator;