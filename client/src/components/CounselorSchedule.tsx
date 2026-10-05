import React, { useState, useEffect } from "react";
import { Button, IconButton, TextField, Autocomplete, Tooltip } from "@mui/material";
import { 
  Save, Plus, Trash2, Globe, Calendar as CalendarIcon, 
  Loader2, Copy, ClipboardPaste, X, ChevronLeft, ChevronRight, Info, RotateCcw, Check, Lock
} from "lucide-react";
import Muialert from "./Muialert"; 

// --- HELPERS ---
const generateTimeOptions = () => {
  const times = [];
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 60; j += 30) {
      const hh = String(i).padStart(2, "0");
      const mm = String(j).padStart(2, "0");
      times.push(`${hh}:${mm}`);
    }
  }
  return times;
};
const TIME_OPTIONS = generateTimeOptions();
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const SUPPORTED_TIMEZONES = typeof (Intl as any).supportedValuesOf === "function" 
  ? (Intl as any).supportedValuesOf('timeZone') 
  : [Intl.DateTimeFormat().resolvedOptions().timeZone, 'Asia/Kolkata', 'America/New_York', 'Europe/London'];

const formatTimeDisplay = (time24: string, use24h: boolean) => {
  if (!time24) return "";
  if (use24h) return time24;
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m === 0 ? '00' : '30'} ${period}`;
};

const getNextSlot = (slots: string[]) => {
  if (!slots || slots.length === 0) return "10:00";
  const lastSlot = slots[slots.length - 1]; 
  const [hh, mm] = lastSlot.split(':').map(Number);
  let nextH = hh;
  let nextM = mm + 30;
  if (nextM >= 60) { nextM -= 60; nextH += 1; }
  if (nextH >= 24) return "23:30"; 
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
};

interface DayAvailability { dayOfWeek: number; slots: string[]; }
interface DateOverride { date: string; slots: string[]; }

const CounselorSchedule: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "", severity: "info" as any });

  const [activeTab, setActiveTab] = useState<"weekly" | "overrides">("weekly");
  const [is24Hour, setIs24Hour] = useState(false);
  
  // Settings State
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [baseAvailability, setBaseAvailability] = useState<DayAvailability[]>([]);
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({}); 
  
  // Local Staging State
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, string[]>>({});

  // UX State
  const [copiedSlots, setCopiedSlots] = useState<string[] | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedOverrideDate, setSelectedOverrideDate] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/counselor/schedule`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTimeZone(data.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
          setBaseAvailability(data.baseAvailability || []);
          setDateOverrides(data.dateOverrides || []);
          setBookedSlots(data.bookedSlots || {}); 
        }
      } catch (error) { console.error("Failed to load schedule"); } 
      finally { setLoading(false); }
    };
    fetchSchedule();
  }, []);

  const syncScheduleToBackend = async (base: DayAvailability[], overrides: DateOverride[]) => {
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ timeZone, baseAvailability: base, dateOverrides: overrides }) 
      });
      if (res.ok) {
        setAlert({ show: true, message: "Schedule saved successfully!", severity: "success" });
      } else {
        setAlert({ show: true, message: "Failed to save schedule.", severity: "error" });
      }
    } catch (error) { 
      setAlert({ show: true, message: "Network error.", severity: "error" }); 
    } finally { 
      setSaving(false); 
    }
  };

  const handleSaveWeekly = async () => {
    await syncScheduleToBackend(baseAvailability, dateOverrides);
  };

  // --- WEEKLY LOGIC ---
  const toggleDay = (dayIndex: number) => {
    const exists = baseAvailability.find(b => b.dayOfWeek === dayIndex);
    if (exists) setBaseAvailability(baseAvailability.filter(b => b.dayOfWeek !== dayIndex));
    else setBaseAvailability([...baseAvailability, { dayOfWeek: dayIndex, slots: ["10:00"] }]);
  };

  const updateSlot = (dayIndex: number, slotIndex: number, newTime: string) => {
    setBaseAvailability(prev => prev.map(day => {
      if (day.dayOfWeek === dayIndex) {
        const newSlots = [...day.slots];
        newSlots[slotIndex] = newTime;
        return { ...day, slots: newSlots.sort() };
      }
      return day;
    }));
  };

  const addSlot = (dayIndex: number) => {
    setBaseAvailability(prev => prev.map(day => {
      if (day.dayOfWeek === dayIndex) return { ...day, slots: [...day.slots, getNextSlot(day.slots)].sort() };
      return day;
    }));
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setBaseAvailability(prev => prev.map(day => {
      if (day.dayOfWeek === dayIndex) return { ...day, slots: day.slots.filter((_, i) => i !== slotIndex) };
      return day;
    }));
  };

  const copyDay = (slots: string[]) => setCopiedSlots([...slots]);
  const pasteDay = (dayIndex: number) => {
    if (!copiedSlots) return;
    setBaseAvailability(prev => {
      const exists = prev.find(b => b.dayOfWeek === dayIndex);
      if (exists) return prev.map(day => day.dayOfWeek === dayIndex ? { ...day, slots: [...copiedSlots] } : day);
      return [...prev, { dayOfWeek: dayIndex, slots: [...copiedSlots] }];
    });
  };

  // --- CALENDAR OVERRIDE LOGIC ---
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const getBaseSlotsForDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const baseDay = baseAvailability.find(b => b.dayOfWeek === dayOfWeek);
    return baseDay ? [...baseDay.slots] : [];
  };

  const getCurrentSlotsForDate = (dateStr: string) => {
    if (dateStr in stagedOverrides) return stagedOverrides[dateStr];
    const existingOverride = dateOverrides.find(o => o.date === dateStr);
    if (existingOverride) return existingOverride.slots;
    return getBaseSlotsForDate(dateStr);
  };

  const openOverrideEditor = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    if (dateObj < today) return; // Block past dates

    setSelectedOverrideDate(dateStr);
    
    if (!(dateStr in stagedOverrides)) {
      setStagedOverrides(prev => ({ ...prev, [dateStr]: getCurrentSlotsForDate(dateStr) }));
    }
  };

  const updateStagedSlots = (dateStr: string, newSlots: string[]) => {
    setStagedOverrides(prev => ({ ...prev, [dateStr]: newSlots }));
  };

  const isDateLocallyModified = (dateStr: string) => {
    if (!(dateStr in stagedOverrides)) return false;
    const staged = stagedOverrides[dateStr];
    const existingOverride = dateOverrides.find(o => o.date === dateStr);
    const baseline = existingOverride ? existingOverride.slots : getBaseSlotsForDate(dateStr);
    return JSON.stringify(staged) !== JSON.stringify(baseline);
  };

  const saveOverrideForDate = async (dateStr: string) => {
    const currentSlots = getCurrentSlotsForDate(dateStr);
    const baseSlots = getBaseSlotsForDate(dateStr);
    
    let updatedOverrides;
    if (JSON.stringify(currentSlots) === JSON.stringify(baseSlots)) {
      updatedOverrides = dateOverrides.filter(o => o.date !== dateStr);
    } else {
      updatedOverrides = [
        ...dateOverrides.filter(o => o.date !== dateStr),
        { date: dateStr, slots: currentSlots }
      ];
    }
    
    setDateOverrides(updatedOverrides);
    setStagedOverrides(prev => {
      const copy = { ...prev };
      delete copy[dateStr];
      return copy;
    });

    await syncScheduleToBackend(baseAvailability, updatedOverrides);
  };

  const revertToDefault = async (dateStr: string) => {
    const updatedOverrides = dateOverrides.filter(o => o.date !== dateStr);
    
    setDateOverrides(updatedOverrides);
    setStagedOverrides(prev => {
      const copy = { ...prev };
      delete copy[dateStr];
      return copy;
    });
    
    await syncScheduleToBackend(baseAvailability, updatedOverrides);
  };

  // 🚨 SMART TIME INPUT COMPONENT
  const TimeInput = ({ value, onChange, onRemove, locked }: { value: string, onChange: (val: string) => void, onRemove: () => void, locked?: boolean }) => (
    <div className={`flex items-center border rounded-xl shadow-sm transition-colors h-[42px] ${locked ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 focus-within:border-[#1765a4] hover:border-slate-300'}`}>
      <Autocomplete
        value={value}
        onChange={(e, newValue) => { if (newValue) onChange(newValue); }}
        options={TIME_OPTIONS}
        getOptionLabel={(option) => formatTimeDisplay(option, is24Hour)}
        disableClearable
        disabled={locked} 
        isOptionEqualToValue={(option, val) => option === val}
        sx={{ 
          width: is24Hour ? 90 : 110, 
          '& .MuiAutocomplete-inputRoot': { padding: '2px 8px !important' },
          '& .MuiAutocomplete-endAdornment': { display: 'none' } 
        }}
        renderInput={(params) => (
          <TextField
            {...params} variant="standard"
            sx={{
              '& .MuiInputBase-root': { fontSize: '0.875rem', fontWeight: 'bold', color: locked ? '#c2410c' : '#334155', marginTop: '2px' },
              '& .MuiInput-underline:before': { display: 'none' },
              '& .MuiInput-underline:after': { display: 'none' }
            }}
          />
        )}
      />
      <div className={`w-px h-6 ${locked ? 'bg-orange-200' : 'bg-slate-100'}`}></div>
      
      {locked ? (
        <Tooltip title="This slot is already booked! It cannot be deleted." placement="top">
          <div className="px-3 py-2 h-full text-brand-orange flex items-center justify-center cursor-not-allowed">
            <Lock size={14} />
          </div>
        </Tooltip>
      ) : (
        <button onClick={onRemove} className="px-3 py-2 h-full text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-r-xl transition-colors">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#1765a4]" /></div>;

  const currentStagedSlots = selectedOverrideDate ? getCurrentSlotsForDate(selectedOverrideDate) : [];
  const lockedSlotsForDate = selectedOverrideDate ? (bookedSlots[selectedOverrideDate] || []) : [];
  const futureOverridesCount = dateOverrides.filter(o => new Date(o.date) >= new Date(new Date().setHours(0,0,0,0))).length;

  return (
    <div className="w-full h-full flex flex-col pb-10">
      
      {/* SETTINGS BAR */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between mb-4 mt-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1765a4] flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Active Timezone</h2>
            <Autocomplete
              value={timeZone} onChange={(e, newValue) => newValue && setTimeZone(newValue)}
              options={SUPPORTED_TIMEZONES} disableClearable
              renderInput={(params) => <TextField {...params} variant="standard" sx={{ '& .MuiInputBase-root': { fontSize: '13px', fontWeight: '600', color: '#64748b' }, '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:after': { borderBottom: 'none' }, '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' } }} />}
              sx={{ width: 220 }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Format</span>
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/50">
            <button 
              onClick={() => setIs24Hour(false)} 
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-200 ${!is24Hour ? 'bg-white shadow-sm text-brand-blue scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              12h (am/pm)
            </button>
            <button 
              onClick={() => setIs24Hour(true)} 
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all duration-200 ${is24Hour ? 'bg-white shadow-sm text-brand-blue scale-[1.02]' : 'text-slate-500 hover:text-slate-700'}`}
            >
              24h
            </button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-200 gap-8 mb-6">
        <button 
          onClick={() => { setActiveTab("weekly"); setSelectedOverrideDate(null); }}
          className={`pb-4 text-sm font-black tracking-wide transition-all border-b-2 ${activeTab === 'weekly' ? 'border-[#1765a4] text-[#1765a4]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          STANDARD WEEKLY HOURS
        </button>
        <button 
          onClick={() => setActiveTab("overrides")}
          className={`pb-4 text-sm font-black tracking-wide transition-all border-b-2 flex items-center gap-2 ${activeTab === 'overrides' ? 'border-[#ed7f23] text-[#ed7f23]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          DATE OVERRIDES
          {futureOverridesCount > 0 && <span className="bg-[#ed7f23] text-white text-[10px] px-2 py-0.5 rounded-full">{futureOverridesCount}</span>}
        </button>
      </div>

      {/* TAB 1: WEEKLY HOURS */}
      {activeTab === "weekly" && (
        <div className="animate-fade-in flex-1">
          {copiedSlots && (
            <div className="mb-6 flex items-center gap-3 bg-orange-50 text-brand-orange px-4 py-3 rounded-xl text-sm font-bold border border-orange-100">
              <ClipboardPaste size={18} />
              Slots copied to clipboard! Click the paste icon on any other day to apply them.
              <button onClick={() => setCopiedSlots(null)} className="ml-auto text-orange-400 hover:text-orange-600"><X size={16}/></button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {WEEKDAYS.map((dayName, index) => {
              const dayData = baseAvailability.find(b => b.dayOfWeek === index);
              const isActive = !!dayData;

              return (
                <div key={dayName} className={`flex flex-col lg:flex-row lg:items-start gap-4 p-5 rounded-2xl transition-all border ${isActive ? 'border-slate-200 bg-white shadow-sm' : 'border-transparent bg-slate-50 opacity-60'}`}>
                  <div className="w-48 flex items-center justify-between shrink-0 mt-1">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={isActive} onChange={() => toggleDay(index)} className="w-5 h-5 rounded border-slate-300 text-[#1765a4] focus:ring-[#1765a4] cursor-pointer" />
                      <span className={`font-black tracking-wide ${isActive ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'}`}>{dayName}</span>
                    </label>
                    
                    <div className="flex gap-1">
                      {isActive && (
                        <IconButton onClick={() => copyDay(dayData.slots)} size="small" title="Copy these hours" sx={{ color: '#94a3b8', '&:hover': { color: '#1765a4', bgcolor: '#eff6ff' } }}>
                          <Copy size={16} />
                        </IconButton>
                      )}
                      {copiedSlots && (
                        <IconButton onClick={() => pasteDay(index)} size="small" title="Paste copied hours" sx={{ color: '#ed7f23', bgcolor: '#fff7ed', '&:hover': { bgcolor: '#ffedd5' } }}>
                          <ClipboardPaste size={16} />
                        </IconButton>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-wrap items-center gap-3">
                    {isActive ? (
                      <>
                        {dayData.slots.map((slot, slotIndex) => (
                          <TimeInput 
                            key={slotIndex} value={slot} 
                            onChange={(val) => updateSlot(index, slotIndex, val)}
                            onRemove={() => removeSlot(index, slotIndex)}
                            locked={false} // Weekly slots are just templates!
                          />
                        ))}
                        <button onClick={() => addSlot(index)} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-[#1765a4] hover:bg-blue-50 px-4 py-2 h-[42px] rounded-xl transition-all border border-dashed border-slate-300 hover:border-[#1765a4]">
                          <Plus size={16} />
                        </button>
                      </>
                    ) : (
                      <div className="text-slate-400 text-sm font-medium mt-1">Unavailable</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-3 text-brand-blue">
              <Info size={20} className="shrink-0" />
              <p className="text-xs font-medium"><b>Note:</b> Changes made here act as a template for future dates. They will <b>not</b> delete meetings that parents have already booked.</p>
            </div>
            <Button 
              variant="contained" onClick={handleSaveWeekly} disabled={saving}
              startIcon={saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              sx={{ bgcolor: '#1765a4', borderRadius: '12px', px: 4, py: 1.2, fontWeight: '900', textTransform: 'none', '&:hover': { bgcolor: '#124d7d' } }}
            >
              {saving ? "Saving..." : "Save Weekly Schedule"}
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: DATE OVERRIDES */}
      {activeTab === "overrides" && (
        <div className="animate-fade-in flex flex-col lg:flex-row gap-8 items-start flex-1">
          
          {/* Calendar UI */}
          <div className="w-full lg:w-[380px] shrink-0 border border-slate-200 rounded-3xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-800 text-xl tracking-wide">
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1">
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"><ChevronLeft size={20} /></button>
                <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"><ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS_SHORT.map(day => <div key={day} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">{day}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1 place-items-center">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="w-10 h-10"></div>)}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1);
                const today = new Date(new Date().setHours(0,0,0,0));
                const isPast = dateObj < today;
                
                const y = dateObj.getFullYear();
                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                const d = String(dateObj.getDate()).padStart(2, '0');
                const dateString = `${y}-${m}-${d}`;
                
                const hasSavedOverride = !isPast && dateOverrides.some(o => o.date === dateString);
                const isModified = !isPast && isDateLocallyModified(dateString);
                const isSelected = selectedOverrideDate === dateString;
                
                // 🚨 NEW: Show a lock icon directly on the calendar if a slot is booked that day!
                const hasBookings = (bookedSlots[dateString] || []).length > 0;
                
                return (
                  <button
                    key={i} disabled={isPast} onClick={() => openOverrideEditor(dateString)}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      isPast ? "text-slate-300 cursor-not-allowed bg-transparent" : 
                      isSelected ? "bg-[#1765a4] text-white shadow-md scale-110 z-10" :
                      isModified ? "border-2 border-amber-500 bg-amber-50 text-amber-700 animate-pulse" : 
                      hasSavedOverride ? "bg-orange-50 text-brand-orange border border-orange-200 hover:border-brand-orange" :
                      "text-slate-700 hover:bg-blue-50 hover:text-brand-blue"
                    }`}
                  >
                    {i + 1}
                    {hasBookings && <div className={`absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full shadow-sm ${isSelected ? 'bg-white text-[#1765a4]' : 'bg-brand-orange text-white'}`}><Lock size={10} /></div>}
                    {hasSavedOverride && !isSelected && !hasBookings && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-brand-orange rounded-full"></div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Override Editor Panel */}
          <div className="flex-1 w-full">
            {!selectedOverrideDate ? (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-brand-blue flex gap-4 items-start">
                <Info className="shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold mb-1">How date overrides work</h4>
                  <p className="text-sm opacity-90 leading-relaxed">Overrides let you change your hours for a specific date without affecting your standard weekly schedule. Click any future date on the calendar to edit its availability or mark it as a day off.</p>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-3xl p-6 bg-white shadow-sm animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-black text-xl text-slate-800 mb-1 flex items-center gap-2">
                      {new Date(selectedOverrideDate).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    <p className="text-sm text-slate-500">Edit your hours for this specific day.</p>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <button 
                      onClick={() => revertToDefault(selectedOverrideDate)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                      title="Revert to standard weekly hours"
                    >
                      <RotateCcw size={14} /> Revert to Default
                    </button>
                    <button 
                      // 🚨 SMART CLEAR: Only clears unbooked slots!
                      onClick={() => updateStagedSlots(selectedOverrideDate, [...lockedSlotsForDate])}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition border border-red-100"
                    >
                      {lockedSlotsForDate.length > 0 ? "Clear Unbooked" : "Take Day Off"}
                    </button>
                  </div>
                </div>
                
                {currentStagedSlots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                    <p className="text-slate-500 font-bold">You are taking this day off.</p>
                    <p className="text-slate-400 text-sm mt-1 mb-4">No discovery calls can be booked on this date.</p>
                    <button 
                      onClick={() => updateStagedSlots(selectedOverrideDate, ["10:00"])} 
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-blue bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition"
                    >
                      <Plus size={16} /> Add Custom Hours
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    {currentStagedSlots.map((slot, idx) => (
                      <TimeInput 
                        key={idx} value={slot} 
                        // 🚨 Passes the locked boolean down correctly based on exact string matching!
                        locked={lockedSlotsForDate.includes(slot)}
                        onChange={(val) => {
                          const newSlots = [...currentStagedSlots];
                          newSlots[idx] = val;
                          updateStagedSlots(selectedOverrideDate, newSlots.sort());
                        }}
                        onRemove={() => updateStagedSlots(selectedOverrideDate, currentStagedSlots.filter((_, i) => i !== idx))}
                      />
                    ))}
                    <button 
                      onClick={() => updateStagedSlots(selectedOverrideDate, [...currentStagedSlots, getNextSlot(currentStagedSlots)].sort())} 
                      className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-brand-blue hover:bg-blue-50 px-4 py-2 h-[42px] rounded-xl transition-all border border-dashed border-slate-300 hover:border-brand-blue"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}

                {/* DIRECT COMMIT ACTION BAR */}
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <Button onClick={() => setSelectedOverrideDate(null)} sx={{ color: '#64748b', fontWeight: 'bold' }}>Close</Button>
                  <Button 
                    variant="contained" 
                    onClick={() => saveOverrideForDate(selectedOverrideDate)} 
                    disabled={saving}
                    startIcon={saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                    sx={{ bgcolor: '#ed7f23', borderRadius: '10px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#d96c1c' } }}
                  >
                    {saving ? "Saving..." : "Save Override"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {alert.show && <Muialert message={alert.message} severity={alert.severity} onClose={() => setAlert({ ...alert, show: false })} />}
    </div>
  );
};

export default CounselorSchedule;