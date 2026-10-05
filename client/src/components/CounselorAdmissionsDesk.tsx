import React, { useState, useEffect, useRef, useMemo } from "react";
import FunDatePicker from "./FunDatePicker"; 
import { 
  Calendar as CalendarIcon, Clock, User, Phone, Mail, 
  CheckCircle2, XCircle, FileText, ChevronLeft, ChevronRight, 
  Loader2, Save, ArrowRight, Video, Filter, Edit3,
  BrainCircuit, Compass, Award, Rocket, CheckSquare, Eye, ExternalLink, RefreshCw, X, File, LayoutDashboard, Calculator, BookOpen, AlertTriangle, CalendarDays
} from "lucide-react";
import { Button, TextField, Chip, Drawer, IconButton, Tabs, Tab, MenuItem, Select, FormControl, Autocomplete, Dialog } from "@mui/material";

import RecommendationView from "./Admission/Stage3_Recommendation/RecommendationView";

// --- Interfaces ---
interface BookingRecord {
  _id: string;
  parentName: string;
  email?: string;
  phone?: string;
  childAge: number;
  currentSchooling: string;
  date: string;
  time?: string;
  status: string;
  type: string;
  meetLink?: string;
  counselorNotes?: string;
  attachments?: { title: string; fileUrl: string; fileId: string }[];
  parent?: any;
  counselor?: any;
}

interface AdmissionRecord {
  _id: string;
  admissionStage: number;
  leadDetails?: { childAge?: number; currentSchooling?: string };
  parent?: { _id: string; name: string; email: string; phone: string; username: string };
  assignedCounselor?: { _id: string; name: string; username: string };
  stage1_Discovery?: { booking?: any; counselorSummary?: string };
  stage2_Assessment?: {
    assessmentRecord?: {
      currentStep: number;
      questionnaire?: { learningStyle?: string; strengths?: string[]; struggles?: string; timeCommitment?: string; techReady?: string; internetConnection?: string };
      documents?: { title: string; fileUrl: string; driveFileId?: string }[];
      liveTest?: { deadline?: string; status: string; teacherBaselineNotes?: string };
    };
    status: string;
  };
  stage3_Recommendation?: { 
    status?: string;
    booking?: any;
    callDeadline?: string;
    recommendedPathway?: string; 
    classEquivalent?: string;
    classDuration?: string;
    workingPlan?: string;
    scholarshipPercent?: number;
    feePaid?: boolean; 
  };
  stage4_ClassesBegin?: {
    status?: string;
    assignedClassroomId?: string;
    classesStartDate?: string;
    refundWindowEndsAt?: string;
    refundRequested?: boolean;
    meetLink?: string;
    scheduledClasses?: any[];
    studentName?: string;
    preferredStartTime?: string;
    preferredEndTime?: string;
    additionalNotes?: string;
  };
  stage5_Confirmation?: {
    enrollmentFormCompleted?: boolean;
    documentsVerified?: boolean;
    studentProfileCreated?: boolean;
    internalOnboardingDone?: boolean;
    draftStudentDetails?: {
      studentName?: string;
      studentUsername?: string;
      studentEmail?: string;
      studentDob?: string;
    };
  };
}

const STAGE_METADATA = [
  { id: 1, name: "Stage 1: Discovery", icon: Compass },
  { id: 2, name: "Stage 2: Assessment", icon: BrainCircuit },
  { id: 3, name: "Stage 3: Recommendation", icon: Award },
  { id: 4, name: "Stage 4: Classes Start", icon: Rocket },
  { id: 5, name: "Stage 5: Confirmation", icon: CheckSquare },
  { id: 6, name: "Stage 6: Observation", icon: Eye },
];

const MAX_SCHOLARSHIP = 48;

const CounselorAdmissionsDesk: React.FC<{ userData: any }> = ({ userData }) => {
  const [viewMode, setViewMode] = useState<"schedule" | "pipeline">("schedule");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [activeTabStage, setActiveTabStage] = useState<number>(1);
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const sliderRef = useRef<HTMLDivElement>(null);

  const [filterCounselor, setFilterCounselor] = useState<string>("all");
  const [showOnlyMyCalls, setShowOnlyMyCalls] = useState<boolean>(!userData?.isAdmin);

  const [dossierOpen, setDossierOpen] = useState(false);
  const [activeDossierData, setActiveDossierData] = useState<{ admission: AdmissionRecord, relatedBookings: BookingRecord[] } | null>(null);
  const [dossierTab, setDossierTab] = useState(0);
  const [s4MeetLink, setS4MeetLink] = useState("");
  
  // Stage 3 Builder States
  const [evaluationNotes, setEvaluationNotes] = useState<string>("");
  const [recommendedPathway, setRecommendedPathway] = useState<string>("NIOS");
  const [classEquivalent, setClassEquivalent] = useState<string>("");
  const [classDuration, setClassDuration] = useState<string>("2 Hours/Day");
  const [workingPlan, setWorkingPlan] = useState<string>("");
  const [scholarshipPercent, setScholarshipPercent] = useState<number>(0);
  const [monthlyFeeInput, setMonthlyFeeInput] = useState<string>("");
  const [feeWarning, setFeeWarning] = useState<string>("");

  // 🚨 STAGE 4 BUILDER STATES (Smart Schedule Generator)
  const [classesStartDate, setClassesStartDate] = useState<string>("");
  const [classTime, setClassTime] = useState<string>("10:00"); 
  const [holidays, setHolidays] = useState<string[]>([]);
  
  // Global Teacher Search States
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherSearchResults, setTeacherSearchResults] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);

  const [dossierSaveStatus, setDossierSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hasEditedDossier, setHasEditedDossier] = useState(false);

  const [BASE_YEARLY_FEE, setBaseYearlyFee] = useState(700000);
  const [previewAdmission, setPreviewAdmission] = useState<any>(null);

  const [editClassModalOpen, setEditClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");

  // Stage 6 Builder States
  const [reportNotes, setReportNotes] = useState<string>("");

  const dossierBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dossierOpen && dossierTab === 1 && activeDossierData) {
      // Small timeout allows the Drawer animation to finish and DOM to paint
      const timeout = setTimeout(() => {
        dossierBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [dossierOpen, dossierTab, activeDossierData]);

  // --- 🚨 GLOBAL TEACHER SEARCH DEBOUNCE ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (teacherSearch.trim().length > 1) {
        try {
          const token = localStorage.getItem("jwtoken");
          const res = await fetch(`${import.meta.env.VITE_API}search-users?q=${teacherSearch}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            // Filter to only show users who are Teachers or Admins
            setTeacherSearchResults(data.filter((u: any) => u.role === "Teacher" || u.isAdmin));
          }
        } catch (error) {
          console.error("Teacher search failed:", error);
        }
      } else {
        setTeacherSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [teacherSearch]);

  // --- 🚨 10-DAY SCHEDULE COMPUTER ---
  const computedSchedule = useMemo(() => {
    if (!classesStartDate) return [];
    const schedule: Date[] = [];
    let currentDate = new Date(classesStartDate);
    
    while (schedule.length < 10) {
      const day = currentDate.getDay();
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Skip Weekends (0 = Sun, 6 = Sat) AND any explicitly marked holidays
      if (day !== 0 && day !== 6 && !holidays.includes(dateString)) {
        schedule.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return schedule;
  }, [classesStartDate, holidays]);

  const handleAddHoliday = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    if (!holidays.includes(dStr)) setHolidays([...holidays, dStr]);
  };

  const handleRemoveHoliday = (dStr: string) => {
    setHolidays(holidays.filter(h => h !== dStr));
  };


  useEffect(() => {
    const fetchPlanPrice = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}api/payment/active-plan`);
        if (res.ok) {
          const data = await res.json();
          if (data.plan) setBaseYearlyFee(data.plan.baseYearlyFee);
        }
      } catch (err) { console.error(err); }
    };
    fetchPlanPrice();
  }, []);

  // 🚨 STAGE 4 AUTO-SAVE
  useEffect(() => {
    if (!activeDossierData || !hasEditedDossier || activeDossierData.admission.admissionStage < 4) return;
    if (activeDossierData.admission.stage4_ClassesBegin?.status !== "started") return;

    const timer = setTimeout(async () => {
      setDossierSaveStatus("saving");
      try {
        await fetch(`${import.meta.env.VITE_API}api/counselor/autosave-stage4/${activeDossierData.admission._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
          body: JSON.stringify({ classesStartDate, meetLink: s4MeetLink })
        });
        setDossierSaveStatus("saved");
        setTimeout(() => setDossierSaveStatus("idle"), 2000);
      } catch (err) { setDossierSaveStatus("idle"); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [classesStartDate, s4MeetLink]);

  const handleScholarshipChange = (val: string) => {
    setHasEditedDossier(true);
    if (val === "") {
      setScholarshipPercent(0);
      setMonthlyFeeInput(Math.round(BASE_YEARLY_FEE / 12).toString());
      setFeeWarning("");
      return;
    }
    
    let num = parseFloat(val);
    if (num > MAX_SCHOLARSHIP) {
      num = MAX_SCHOLARSHIP;
      setFeeWarning(`Capped at ${MAX_SCHOLARSHIP}% maximum.`);
      setTimeout(() => setFeeWarning(""), 3000);
    } else {
      setFeeWarning("");
    }
    
    setScholarshipPercent(num);
    const monthly = (BASE_YEARLY_FEE * (1 - num / 100)) / 12;
    setMonthlyFeeInput(Math.round(monthly).toString());
  };

  const handleMonthlyFeeType = (val: string) => {
    setHasEditedDossier(true);
    setMonthlyFeeInput(val);
    
    if (val !== "") {
      const fee = parseFloat(val);
      const computedPct = (1 - ((fee * 12) / BASE_YEARLY_FEE)) * 100;
      
      if (computedPct > MAX_SCHOLARSHIP) {
        setFeeWarning(`Fee is too low! Max scholarship is ${MAX_SCHOLARSHIP}%.`);
      } else {
        setFeeWarning("");
      }
      setScholarshipPercent(parseFloat(Math.max(0, computedPct).toFixed(2)));
    } else {
      setScholarshipPercent(0);
      setFeeWarning("");
    }
  };

  const handleMonthlyFeeBlur = () => {
    let fee = parseFloat(monthlyFeeInput);
    if (!fee || isNaN(fee)) fee = Math.round(BASE_YEARLY_FEE / 12);
    
    const dynamicMinFee = Math.ceil((BASE_YEARLY_FEE * (1 - (MAX_SCHOLARSHIP / 100))) / 12);
    
    if (fee < dynamicMinFee) {
      fee = dynamicMinFee; 
      setFeeWarning(`Auto-adjusted to maximum allowed discount.`);
      setTimeout(() => setFeeWarning(""), 3000);
    }
    
    setMonthlyFeeInput(Math.round(fee).toString());
    const computedPct = (1 - ((fee * 12) / BASE_YEARLY_FEE)) * 100;
    setScholarshipPercent(parseFloat(Math.max(0, computedPct).toFixed(2)));
  };

  useEffect(() => {
    if (!activeDossierData || !hasEditedDossier) return;
    const timer = setTimeout(async () => {
      setDossierSaveStatus("saving");
      try {
        await fetch(`${import.meta.env.VITE_API}api/counselor/autosave-dossier/${activeDossierData.admission._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
          body: JSON.stringify({ teacherBaselineNotes: evaluationNotes, recommendedPathway, classEquivalent, classDuration, workingPlan, scholarshipPercent })
        });
        setDossierSaveStatus("saved");
        
        setActiveDossierData(prev => prev ? ({
          ...prev, admission: {
            ...prev.admission, stage3_Recommendation: {
              ...prev.admission.stage3_Recommendation, recommendedPathway, classEquivalent, classDuration, workingPlan, scholarshipPercent
            }
          }
        }) : prev);

        setTimeout(() => setDossierSaveStatus("idle"), 2000);
      } catch (err) { setDossierSaveStatus("idle"); }
    }, 1200);
    return () => clearTimeout(timer);
  }, [evaluationNotes, recommendedPathway, classEquivalent, classDuration, workingPlan, scholarshipPercent]);


  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/discovery-calls?date=${dateStr}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }});
      if (res.ok) setBookings(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/admissions?stage=${activeTabStage}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }});
      if (res.ok) setAdmissions(await res.json());
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (viewMode === "schedule") fetchSchedule();
    else fetchPipeline();
  }, [viewMode, selectedDate, activeTabStage]);

  const handleUpdateSingleClass = async () => {
    if (!editingClass) return;
    setSavingId(editingClass._id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/update-single-class/${activeDossierData!.admission._id}/${editingClass._id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ newDate: editDate, newStartTime: editStartTime, newEndTime: editEndTime })
      });
      if (res.ok) {
        setEditClassModalOpen(false);
        openDossier(activeDossierData!.admission._id, "admission"); // Refresh dossier
      }
    } catch (err) { alert("Failed to update class"); }
    finally { setSavingId(null); }
  };

  const handleToggleStage5Checklist = async (admissionId: string, field: string, currentValue: boolean) => {
    try {
      // Optimistic UI update
      setActiveDossierData(prev => prev ? {
        ...prev, admission: {
          ...prev.admission, stage5_Confirmation: {
            ...prev.admission.stage5_Confirmation,
            [field]: !currentValue
          }
        }
      } : prev);

      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/stage5-checklist/${admissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ field, value: !currentValue })
      });

      if (!res.ok) fetchPipeline(); // Revert if failed
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteStage5 = async (admissionId: string) => {
    setSavingId(admissionId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/complete-stage5/${admissionId}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        setDossierOpen(false);
        fetchPipeline();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to complete Stage 5.");
      }
    } catch (err) { alert("Network error."); }
    finally { setSavingId(null); }
  };

  const handleCompleteStage6 = async (admissionId: string) => {
    if (!reportNotes) return alert("Please add the observation report notes.");
    setSavingId(admissionId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/complete-stage6/${admissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ teacherBaselineNotes: reportNotes }) 
      });
      if (res.ok) {
        setDossierOpen(false);
        viewMode === "pipeline" ? fetchPipeline() : fetchSchedule();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to complete Stage 6.");
      }
    } catch (err) { alert("Network error."); }
    finally { setSavingId(null); }
  };

  const openDossier = async (recordId: string, type: "booking" | "admission") => {
    setDossierOpen(true);
    setActiveDossierData(null); 
    setDossierTab(1); 
    
    try {
      const admissionId = type === "admission" ? recordId : bookings.find(b => b._id === recordId)?.parent?._id; 
      if (!admissionId) return;

      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/dossier/${admissionId}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` } });
      if (res.ok) {
        const data = await res.json();
        setActiveDossierData(data); 
     
        setReportNotes(data.admission.stage6_Observation?.teacherBaselineNotes || "");
        
        setEvaluationNotes(data.admission.stage2_Assessment?.assessmentRecord?.liveTest?.teacherBaselineNotes || "");
        setRecommendedPathway(data.admission.stage3_Recommendation?.recommendedPathway || "NIOS");
        setClassEquivalent(data.admission.stage3_Recommendation?.classEquivalent || "");
        setClassDuration(data.admission.stage3_Recommendation?.classDuration || "2 Hours/Day");
        setWorkingPlan(data.admission.stage3_Recommendation?.workingPlan || "");
        
        const pct = data.admission.stage3_Recommendation?.scholarshipPercent || 0;
        setScholarshipPercent(pct);
        setMonthlyFeeInput(Math.round((BASE_YEARLY_FEE * (1 - pct/100)) / 12).toString());
        
        // Reset Stage 4 Generator states on open
        setTeacherSearch("");
        setSelectedTeacher(null);
        setHolidays([]);
        if (data.admission.stage4_ClassesBegin?.classesStartDate) {
          const d = new Date(data.admission.stage4_ClassesBegin.classesStartDate);
          setClassesStartDate(d.toISOString().split('T')[0]); 
        } else {
          setClassesStartDate("");
        }
        
        // 🚨 HYDRATE THE CLASS TIME FROM PARENT'S PREFERENCES
        setClassTime(data.admission.stage4_ClassesBegin?.preferredStartTime || "10:00");
        setS4MeetLink(data.admission.stage4_ClassesBegin?.meetLink || "");
        setFeeWarning("");
        setHasEditedDossier(false); 
      }
    } catch (err) { console.error("Failed to load dossier", err); }
  };

  const handleCompleteStage2 = async (admissionId: string) => {
    if (scholarshipPercent > 48) { alert("Scholarship cannot exceed 48%"); return; }
    setSavingId(admissionId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/complete-stage2`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ admissionId, teacherBaselineNotes: evaluationNotes, recommendedPathway, classEquivalent, classDuration, workingPlan, scholarshipPercent })
      });
      if (res.ok) {
        setDossierOpen(false);
        viewMode === "pipeline" ? fetchPipeline() : fetchSchedule();
      }
    } catch (err) { alert("Failed to complete stage."); } finally { setSavingId(null); }
  };

  const handleCompleteStage3Call = async (admissionId: string) => {
    setSavingId(admissionId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/complete-stage3-call/${admissionId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        setDossierOpen(false);
        viewMode === "pipeline" ? fetchPipeline() : fetchSchedule();
      }
    } catch (err) { alert("Failed to complete call."); }
    finally { setSavingId(null); }
  };

  const handleCompleteStage4 = async (admissionId: string) => {
    setSavingId(admissionId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/complete-stage4/${admissionId}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        setDossierOpen(false);
        viewMode === "pipeline" ? fetchPipeline() : fetchSchedule();
      } else {
        alert("Failed to confirm admission.");
      }
    } catch (err) { 
      alert("Network error."); 
    } finally { 
      setSavingId(null); 
    }
  };

  // 🚨 STAGE 4: ASSIGN & GENERATE SMART 10-DAY SCHEDULE
  const handleAssignClassroom = async (admissionId: string) => {
    if (!selectedTeacher || !classesStartDate || !classTime) {
      alert("Please select a Teacher, Start Date, and Time.");
      return;
    }
    setSavingId(admissionId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/counselor/generate-induction-schedule/${admissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ 
           startDate: classesStartDate,
           startTime: classTime,
           holidays: holidays,
           teacherUsername: selectedTeacher.username
        })
      });
      if (res.ok) {
        openDossier(admissionId, "admission"); // Instantly refresh the dossier
      } else {
        alert("Failed to generate schedule.");
      }
    } catch (err) { 
      alert("Network error."); 
    } finally { 
      setSavingId(null); 
    }
  };

  const scrollSlider = (dir: "left" | "right") => sliderRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });

  const filteredData = (dataArray: any[]) => {
    return dataArray.filter(item => {
      const counselorObj = viewMode === "schedule" ? item.counselor : item.assignedCounselor;
      const myId = userData?._id || userData?.id;
      const myUsername = (userData?.Username || userData?.username || "").toLowerCase();
      const counselorId = counselorObj?._id;
      const counselorUsername = (counselorObj?.username || "").toLowerCase();

      if (showOnlyMyCalls && counselorId !== myId && counselorUsername !== myUsername) return false;
      if (!showOnlyMyCalls && filterCounselor !== "all" && counselorUsername !== filterCounselor.toLowerCase()) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const parentName = item.parentName || item.parent?.name || "";
        const email = item.email || item.parent?.email || "";
        return parentName.toLowerCase().includes(q) || email.toLowerCase().includes(q);
      }
      return true;
    });
  };

  const uniqueCounselors = useMemo(() => {
    const map = new Map();
    const sourceArray = viewMode === "schedule" ? bookings : admissions;
    sourceArray.forEach(a => {
      const c = viewMode === "schedule" ? a.counselor : a.assignedCounselor;
      if (c) map.set(c.username, c.name || c.username);
    });
    return Array.from(map.entries());
  }, [bookings, admissions, viewMode]);

  const activeFilteredBookings = filteredData(bookings);
  const activeFilteredAdmissions = filteredData(admissions);

  return (
    <div className="max-w-7xl mx-auto p-3 md:p-5 space-y-4">
      {/* 🧭 DESK HEADER */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-[#1765a4] rounded-xl"><LayoutDashboard size={24} /></div>
            <div>
              <h1 className="text-xl font-display font-bold text-slate-800">Admissions Desk</h1>
              <p className="text-xs text-slate-500">Manage schedules and student pipelines.</p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode("schedule")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === "schedule" ? "bg-white text-[#1765a4] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><CalendarIcon size={16} /> Daily Schedule</button>
            <button onClick={() => setViewMode("pipeline")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === "pipeline" ? "bg-white text-[#1765a4] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Compass size={16} /> Stage Pipeline</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <TextField size="small" placeholder="Search parent/email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', height: '36px', fontSize: '12px', minWidth: '200px' } }} />
          {userData?.isAdmin && (
            <>
              <button onClick={() => { setShowOnlyMyCalls(!showOnlyMyCalls); if (!showOnlyMyCalls) setFilterCounselor("all"); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${showOnlyMyCalls ? "bg-[#1765a4] text-white border-[#1765a4]" : "bg-slate-50 text-slate-600 border-slate-200"}`}>My Assignments</button>
              <select value={filterCounselor} onChange={(e) => { setFilterCounselor(e.target.value); if (e.target.value !== "all") setShowOnlyMyCalls(false); }} disabled={showOnlyMyCalls} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none disabled:opacity-50">
                <option value="all">All Counselors</option>
                {uniqueCounselors.map(([user, name]) => <option key={user} value={user}>{name}</option>)}
              </select>
            </>
          )}
          <button onClick={() => viewMode === "schedule" ? fetchSchedule() : fetchPipeline()} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition ml-auto"><RefreshCw size={16} /></button>
        </div>
      </div>

      {/* 📅 MODE A: SCHEDULE VIEW */}
      {viewMode === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => scrollSlider("left")} className="p-1 hover:bg-slate-100 rounded-lg shrink-0"><ChevronLeft size={18} className="text-slate-600" /></button>
            <div ref={sliderRef} className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 py-1">
              {Array.from({ length: 21 }).map((_, i) => { 
                const d = new Date(); d.setDate(d.getDate() - 7 + i); 
                return (
                <button key={d.toISOString()} onClick={() => setSelectedDate(d)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 border ${d.toDateString() === selectedDate.toDateString() ? "bg-[#1765a4] text-white border-[#1765a4] shadow-sm" : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"}`}>
                  <span className="uppercase opacity-80">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="font-black text-sm">{d.getDate()}</span>
                </button>
              )})}
            </div>
            <button onClick={() => scrollSlider("right")} className="p-1 hover:bg-slate-100 rounded-lg shrink-0"><ChevronRight size={18} className="text-slate-600" /></button>
          </div>

          {loading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#1765a4]" size={32} /></div> : 
           activeFilteredBookings.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 shadow-sm">
              <CalendarIcon size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-bold text-slate-600 text-sm">No calls scheduled for this view.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
              {activeFilteredBookings.map(b => (
                <div key={b._id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col h-full hover:border-blue-200 transition overflow-hidden min-w-0">
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-start mb-3 gap-2 w-full">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="font-bold text-slate-800 text-base truncate">{b.parentName || b.parent?.name || "Student"}</h3>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {b.type === "assessment_test" ? "Stage 2: Live Test" : 
                           b.type === "recommendation_call" ? "Stage 3: Plan Review" : "Stage 1: Discovery Call"}
                        </p>
                      </div>
                      <Chip label={b.time} size="small" className="shrink-0" sx={{ bgcolor: '#fdf8f4', color: '#ed7f23', fontWeight: 'bold' }} icon={<Clock size={12}/>} />
                    </div>
                    {b.meetLink && <a href={b.meetLink} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#1765a4] text-xs font-bold rounded-lg transition shrink-0"><Video size={14}/> Join Google Meet</a>}
                  </div>
                  <Button fullWidth onClick={() => openDossier(b._id, "booking")} sx={{ mt: 3, textTransform: 'none', fontWeight: 'bold', fontSize: '11px', border: '1px solid #e2e8f0', color: '#475569', "&:hover": { bgcolor: "#f8fafc" } }} className="mt-auto shrink-0">Open Student Dossier</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 📊 MODE B: PIPELINE VIEW */}
      {viewMode === "pipeline" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {STAGE_METADATA.map(meta => (
              <button key={meta.id} onClick={() => setActiveTabStage(meta.id)} className={`p-3 rounded-xl border text-[11px] font-bold text-left transition flex flex-col gap-1 ${activeTabStage === meta.id ? "bg-[#1765a4] text-white border-[#1765a4] shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                <meta.icon size={16} className={activeTabStage === meta.id ? "text-white" : "text-[#1765a4]"} />
                {meta.name}
              </button>
            ))}
          </div>

          {loading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#1765a4]" size={32} /></div> : 
           activeFilteredAdmissions.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 shadow-sm">
              <Compass size={40} className="mx-auto mb-3 opacity-40" />
              <p className="font-bold text-slate-600 text-sm">No applicants currently in Stage {activeTabStage}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
              {activeFilteredAdmissions.map(adm => (
                <div key={adm._id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col h-full hover:border-blue-200 transition overflow-hidden min-w-0">
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-start mb-3 gap-2 w-full">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="font-bold text-slate-800 text-base truncate">{adm.parent?.name}</h3>
                        <p className="text-[11px] text-slate-500 truncate">{adm.parent?.email}</p>
                      </div>
                      <Chip label={`Stage ${adm.admissionStage}`} size="small" className="shrink-0" sx={{ bgcolor: '#1765a4', color: 'white', fontWeight: 'bold', fontSize: '10px' }} />
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl text-xs text-slate-600 mb-3 w-full shrink-0">
                      <p className="truncate"><strong>Child:</strong> Age {adm.leadDetails?.childAge || "?"} • {adm.leadDetails?.currentSchooling || "Standard"}</p>
                    </div>
                  </div>
                  <Button fullWidth variant="contained" onClick={() => openDossier(adm._id, "admission")} sx={{ bgcolor: '#ed7f23', textTransform: 'none', fontWeight: 'bold', fontSize: '11px', boxShadow: 'none' }} className="mt-auto shrink-0">Open Student Dossier</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 📂 THE UNIFIED STUDENT DOSSIER DRAWER */}
      <Drawer anchor="right" open={dossierOpen} onClose={() => setDossierOpen(false)} slotProps={{ paper: { sx: { width: 500, maxWidth: '100%', borderTopLeftRadius: { sm: '24px' }, borderBottomLeftRadius: { sm: '24px' }, overflow: 'hidden' } } }}>
        {activeDossierData ? (
          <div className="h-full flex flex-col bg-slate-50 w-full overflow-hidden relative">
            <div className="absolute top-4 right-14 z-50">
              {dossierSaveStatus === "saving" && <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full"><Loader2 size={10} className="animate-spin"/> Saving</span>}
              {dossierSaveStatus === "saved" && <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full"><CheckCircle2 size={10}/> Saved</span>}
            </div>

            {/* Drawer Header */}
            <div className="bg-white p-5 border-b border-slate-200 flex justify-between items-start shrink-0">
              <div className="flex-1 min-w-0 overflow-hidden pr-3">
                <h2 className="text-xl font-display font-bold text-slate-800 truncate">{activeDossierData.admission.parent?.name}</h2>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 w-full overflow-hidden"><Mail size={12} className="shrink-0"/><span className="truncate">{activeDossierData.admission.parent?.email}</span></p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 w-full overflow-hidden"><Phone size={12} className="shrink-0"/><span className="truncate">{activeDossierData.admission.parent?.phone || "No phone"}</span></p>
              </div>
              <IconButton onClick={() => setDossierOpen(false)} size="small" sx={{ bgcolor: '#f1f5f9', shrink: 0 }}><X size={18} /></IconButton>
            </div>

            <Tabs value={dossierTab} onChange={(e, v) => setDossierTab(v)} variant="fullWidth" sx={{ bgcolor: 'white', borderBottom: '1px solid #e2e8f0', minHeight: '44px', shrink: 0 }}>
              <Tab icon={<CalendarIcon size={16}/>} iconPosition="start" label="Meetings" sx={{ textTransform: 'none', minHeight: '44px', fontWeight: 'bold', fontSize: '13px' }} />
              <Tab icon={<FileText size={16}/>} iconPosition="start" label="Info" sx={{ textTransform: 'none', minHeight: '44px', fontWeight: 'bold', fontSize: '13px' }} />
              <Tab icon={<File size={16}/>} iconPosition="start" label="Drive Docs" sx={{ textTransform: 'none', minHeight: '44px', fontWeight: 'bold', fontSize: '13px' }} />
            </Tabs>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
              
              {/* TAB 0: MEETINGS */}
              {dossierTab === 0 && (
                <div className="space-y-3">
                  {activeDossierData.relatedBookings.map(b => (
                    <div key={b._id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm overflow-hidden">
                      <div className="flex justify-between font-bold text-slate-800 mb-1">
                        <span className="truncate">
                          {b.type === "discovery_call" ? "Stage 1: Discovery Call" : 
                           b.type === "assessment_test" ? "Stage 2: Live Test" : "Stage 3: Plan Review"}
                        </span>
                        <span className="text-[#1765a4] shrink-0 ml-2">{new Date(b.date).toLocaleDateString()} at {b.time}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3 flex items-center gap-2">Status: <span className="uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{b.status}</span></p>
                      <div className="flex flex-wrap gap-2">
                        {b.meetLink && <a href={b.meetLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1765a4] bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 truncate max-w-full"><Video size={14} className="shrink-0"/> <span className="truncate">Join Meet</span></a>}
                        {b.attachments && b.attachments.length > 0 && b.attachments.map((att, i) => (
                          <a key={i} href={att.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ed7f23] bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 truncate max-w-full"><FileText size={14} className="shrink-0"/> <span className="truncate">{att.title || "Attachment"}</span></a>
                        ))}
                      </div>
                    </div>
                  ))}
                  {activeDossierData.relatedBookings.length === 0 && <div className="text-center text-slate-400 py-10"><CalendarIcon size={32} className="mx-auto mb-2 opacity-50" /><p className="text-sm font-bold">No meetings scheduled.</p></div>}
                </div>
              )}

              {/* TAB 1: STAGE 3 BUILDER */}
              {dossierTab === 1 && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm overflow-hidden">
                    <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2"><BrainCircuit size={16} className="text-[#1765a4]"/> Parent Questionnaire</h4>
                    {activeDossierData.admission.stage2_Assessment?.assessmentRecord?.questionnaire ? (
                      <div className="space-y-3 text-xs text-slate-600">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="overflow-hidden"><span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Learning Style</span><span className="font-bold text-slate-800 block truncate">{activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.learningStyle || "N/A"}</span></div>
                          <div className="overflow-hidden"><span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Internet</span><span className="font-bold text-slate-800 block truncate">{activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.internetConnection || "N/A"}</span></div>
                          <div className="overflow-hidden"><span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Tech Readiness</span><span className="font-bold text-slate-800 block truncate">{activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.techReady || "N/A"}</span></div>
                          <div className="overflow-hidden"><span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Time Commitment</span><span className="font-bold text-slate-800 block truncate">{activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.timeCommitment || "N/A"}</span></div>
                        </div>
                        <div className="pt-2 border-t border-slate-100"><span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Strengths / Interests</span><span className="font-bold text-slate-800">{activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.strengths?.join(", ") || "None listed"}</span></div>
                        {activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.struggles && (
                          <div className="pt-2 border-t border-slate-100"><span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Academic Struggles</span><span className="font-medium text-slate-700 break-words whitespace-pre-wrap">{activeDossierData.admission.stage2_Assessment.assessmentRecord.questionnaire.struggles}</span></div>
                        )}
                      </div>
                    ) : <p className="text-xs text-slate-400 font-medium">Questionnaire not submitted yet.</p>}
                  </div>

                  {activeDossierData.admission.admissionStage >= 2 && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm shadow-sm">
                      <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2"><BookOpen size={16} className="text-[#ed7f23]"/> Build Stage 3 Plan</h4>
                      <p className="text-[11px] text-slate-500 mb-4 pb-3 border-b border-slate-100">This data generates the parent's final enrollment contract and fee structure.</p>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Teacher Baseline Notes (Internal)</label>
                          <TextField fullWidth multiline rows={2} placeholder="Observations..." value={evaluationNotes} onChange={(e) => { setHasEditedDossier(true); setEvaluationNotes(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px' } }} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pathway</label>
                            <Autocomplete
                              freeSolo
                              options={["NIOS", "IGCSE"]}
                              value={recommendedPathway}
                              onInputChange={(e, newValue) => { setHasEditedDossier(true); setRecommendedPathway(newValue || ""); }}
                              renderInput={(params) => <TextField {...params} size="small" placeholder="Type or Select..." sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', height: '40px', padding: '0 14px' } }} />}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">NCERT Class Equiv.</label>
                            <TextField fullWidth size="small" placeholder="e.g. Class 5" value={classEquivalent} onChange={(e) => { setHasEditedDossier(true); setClassEquivalent(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', height: '40px' } }} />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Class Duration</label>
                          <FormControl fullWidth size="small">
                            <Select value={classDuration} onChange={(e) => { setHasEditedDossier(true); setClassDuration(e.target.value as string); }} sx={{ borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', height: '40px' }}>
                              <MenuItem value="1 Hour/Day">1 Hour/Day</MenuItem>
                              <MenuItem value="2 Hours/Day">2 Hours/Day</MenuItem>
                              <MenuItem value="3 Hours/Day">3 Hours/Day (Max)</MenuItem>
                            </Select>
                          </FormControl>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Custom Working Plan (Visible to Parent)</label>
                          <TextField fullWidth multiline rows={4} placeholder="Write a paragraph explaining how we will tackle the child's specific problems..." value={workingPlan} onChange={(e) => { setHasEditedDossier(true); setWorkingPlan(e.target.value); }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px', backgroundColor: '#fdf8f4' } }} />
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 flex-wrap">
                            <Calculator size={12}/> Live Fee Configuration
                            {feeWarning && <span className="text-red-500 flex items-center gap-1 ml-auto normal-case tracking-normal"><AlertTriangle size={12}/> {feeWarning}</span>}
                          </div>
                          
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-medium">Base Yearly Fee:</span>
                            <span className="font-bold text-slate-800">₹{BASE_YEARLY_FEE.toLocaleString('en-IN')}</span>
                          </div>

                          {scholarshipPercent > 0 && (
                            <div className="flex justify-between text-xs text-emerald-600">
                              <span className="font-medium">Scholarship (-{scholarshipPercent}%):</span>
                              <span className="font-bold">-₹{Math.round((BASE_YEARLY_FEE * (scholarshipPercent/100))).toLocaleString('en-IN')}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 mt-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Scholarship %</label>
                              <TextField 
                                fullWidth size="small" type="number" placeholder="0"
                                value={scholarshipPercent === 0 ? '' : scholarshipPercent} 
                                onChange={(e) => handleScholarshipChange(e.target.value)} 
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', height: '40px' } }} 
                              />
                            </div>
                            
                            <div>
                              <label className="block text-[10px] font-bold text-[#1765a4] uppercase tracking-wider mb-1">Final Monthly Fee (₹)</label>
                              <TextField 
                                fullWidth size="small" type="number" 
                                value={monthlyFeeInput} 
                                onChange={(e) => handleMonthlyFeeType(e.target.value)} 
                                onBlur={handleMonthlyFeeBlur}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '13px', fontWeight: 'black', color: '#1765a4', height: '40px' } }} 
                              />
                            </div>
                          </div>

                          <Button 
                            variant="outlined" 
                            fullWidth 
                            onClick={() => setPreviewAdmission(activeDossierData.admission)}
                            sx={{ mt: 2, borderColor: '#1765a4', color: '#1765a4', fontWeight: 'bold', textTransform: 'none', borderRadius: '10px' }}
                          >
                            <Eye size={16} className="mr-2"/> Preview Plan (Screen Share Mode)
                          </Button>

                        </div>
                      </div>
                    </div>
                  )}

              {/* ========================================== */}
              {/* 🚨 PERMANENT STAGE 4: PARENT PREFERENCES */}
              {/* ========================================== */}
              {activeDossierData.admission.admissionStage >= 4 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm shadow-sm mt-4">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <BookOpen size={16} className="text-[#ed7f23]"/> Stage 4: Parent Preferences
                  </h4>
                  <div className="bg-[#fdf8f4] p-3 rounded-lg border border-orange-100 text-xs text-slate-700">
                    <p><strong>Preferred Student Name:</strong> {activeDossierData.admission.stage4_ClassesBegin?.studentName || activeDossierData.admission.parent?.name}</p>
                    <p className="mt-1"><strong>Requested Schedule:</strong> {activeDossierData.admission.stage4_ClassesBegin?.preferredStartTime || "Not set"} - {activeDossierData.admission.stage4_ClassesBegin?.preferredEndTime || "Not set"}</p>
                    {activeDossierData.admission.stage4_ClassesBegin?.additionalNotes && (
                      <div className="mt-2 pt-2 border-t border-orange-200">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Additional Notes</span>
                        <p className="text-slate-600 font-medium italic">"{activeDossierData.admission.stage4_ClassesBegin.additionalNotes}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* 🚨 STAGE 4: GENERATOR (Only if no classes exist) */}
              {/* ========================================== */}
              {activeDossierData.admission.admissionStage >= 4 && (!activeDossierData.admission.stage4_ClassesBegin?.scheduledClasses || activeDossierData.admission.stage4_ClassesBegin.scheduledClasses.length === 0) && (
                <div className="space-y-4 bg-blue-50 p-5 rounded-xl border border-blue-100 mt-4">
                  <h4 className="text-sm font-bold text-[#1765a4] flex items-center gap-2">
                    <CalendarDays size={16}/> Generate 10-Day Induction
                  </h4>
                  
                  {/* Teacher Global Search */}
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Assign Teacher</label>
                    {!selectedTeacher ? (
                      <>
                        <TextField 
                          fullWidth size="small" 
                          placeholder="Search teacher by name or @username..." 
                          value={teacherSearch} 
                          onChange={(e) => setTeacherSearch(e.target.value)} 
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'white', fontSize: '13px' } }} 
                        />
                        {teacherSearchResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto p-1">
                            {teacherSearchResults.map((u: any) => (
                              <div key={u.username} onClick={() => { setSelectedTeacher(u); setTeacherSearch(""); setTeacherSearchResults([]); }} className="p-2 hover:bg-slate-50 cursor-pointer flex items-center gap-3 rounded-lg transition">
                                <img src={u.photo || 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                <div>
                                  <p className="text-sm font-bold text-slate-700 leading-tight">{u.name}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">@{u.username}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-blue-200 shadow-sm">
                        <div className="flex items-center gap-3">
                          <img src={selectedTeacher.photo || 'https://via.placeholder.com/40'} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{selectedTeacher.name}</p>
                            <p className="text-[10px] font-medium text-slate-400">@{selectedTeacher.username}</p>
                          </div>
                        </div>
                        <IconButton size="small" onClick={() => setSelectedTeacher(null)} sx={{ color: '#ef4444', bgcolor: '#fef2f2' }}><X size={14}/></IconButton>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Class Start Date</label>
                      <FunDatePicker 
                        value={classesStartDate || null} 
                        placeholder="Start date..."
                        borderRadius="10px"
                        backgroundColor="#ffffff"
                        textColor="#1e293b"
                        fontSize="13px"
                        height="36px"
                        borderColor="#e2e8f0"
                        onChange={(newDate) => {
                          if (newDate) setClassesStartDate(newDate.split("T")[0]);
                          else setClassesStartDate("");
                        }} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Daily Class Time</label>
                      <TextField 
                        type="time" 
                        fullWidth 
                        size="small" 
                        value={classTime} 
                        onChange={(e) => setClassTime(e.target.value)} 
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', height: '36px', bgcolor: 'white' } }} 
                      />
                    </div>
                  </div>

                  {/* Smart 10-Day Preview Grid */}
                  {classesStartDate && (
                    <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm">
                       <p className="text-[11px] font-bold text-slate-700 mb-2.5 flex items-center gap-1.5"><Clock size={12}/> Live Preview (Weekends Auto-Skipped)</p>
                       <div className="grid grid-cols-5 gap-1.5">
                         {computedSchedule.map((d, i) => (
                           <div key={i} onClick={() => handleAddHoliday(d)} className="group relative bg-slate-50 border border-slate-200 rounded-lg p-2 text-center cursor-pointer hover:border-red-300 hover:bg-red-50 transition overflow-hidden">
                              <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider group-hover:opacity-0 transition">Day {i+1}</span>
                              <span className="block text-[11px] font-bold text-slate-700 group-hover:opacity-0 transition mt-0.5">
                                {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition">
                                <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1"><XCircle size={12}/> Skip</span>
                              </div>
                           </div>
                         ))}
                       </div>
                       
                       {/* Un-skip Holidays Section */}
                       {holidays.length > 0 && (
                         <div className="mt-3 pt-3 border-t border-slate-100">
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Marked Holidays (Click to restore)</p>
                           <div className="flex flex-wrap gap-1.5">
                             {holidays.map(h => (
                               <Chip 
                                 key={h} 
                                 label={new Date(h).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                 size="small" 
                                 onDelete={() => handleRemoveHoliday(h)} 
                                 sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 'bold', fontSize: '10px', height: '22px', '& .MuiChip-deleteIcon': { color: '#dc2626', fontSize: '14px' } }} 
                               />
                             ))}
                           </div>
                         </div>
                       )}
                    </div>
                  )}

                  <Button fullWidth variant="contained" onClick={() => handleAssignClassroom(activeDossierData.admission._id)} disabled={savingId === activeDossierData.admission._id || !selectedTeacher || !classesStartDate || !classTime} sx={{ bgcolor: '#1765a4', borderRadius: '10px', py: 1.5, fontWeight: 'bold', textTransform: 'none', boxShadow: 'none', mt: 2 }}>
                    {savingId === activeDossierData.admission._id ? <Loader2 size={18} className="animate-spin" /> : "Generate Google Meet & 10-Day Schedule"}
                  </Button>
                </div>
              )}

              
              {/* ========================================== */}
              {/* 🚨 STAGE 4: LIVE EDITOR (Once classes start) */}
              {/* ========================================== */}
              {activeDossierData.admission.admissionStage >= 4 && activeDossierData.admission.stage4_ClassesBegin?.scheduledClasses && activeDossierData.admission.stage4_ClassesBegin.scheduledClasses.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm shadow-sm mt-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Rocket size={16} className="text-[#10b981]"/> Live 10-Day Schedule</h4>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">Teacher: @{activeDossierData.admission.stage4_ClassesBegin.assignedClassroomId}</span>
                  </div>

                  {/* INDIVIDUAL CLASSES GRID */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    
                    {[...(activeDossierData.admission.stage4_ClassesBegin.scheduledClasses || [])]
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((cls: any, i: number) => {
                      const isPending = cls.rescheduleRequest?.isPending;
                      return (
                        <div 
                          key={cls._id} 
                          onClick={() => {
                            setEditingClass(cls);
                            
                            if (isPending) {
                              // 1. Pre-fill with parent's requested date and start time
                              setEditDate(new Date(cls.rescheduleRequest.requestedDate).toLocaleDateString('en-CA'));
                              setEditStartTime(cls.rescheduleRequest.requestedStartTime);
                              
                              // 2. Smart auto-calculate the new end time based on the original class duration
                              const [origH, origM] = cls.startTime.split(":").map(Number);
                              const [endH, endM] = cls.endTime.split(":").map(Number);
                              const durationMins = (endH * 60 + endM) - (origH * 60 + origM);
                              
                              const [reqH, reqM] = cls.rescheduleRequest.requestedStartTime.split(":").map(Number);
                              const totalNewMins = reqH * 60 + reqM + durationMins;
                              
                              const newEndH = Math.floor(totalNewMins / 60) % 24;
                              const newEndM = totalNewMins % 60;
                              setEditEndTime(`${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}`);
                            } else {
                              // Default: Pre-fill with current scheduled date and time
                              setEditDate(new Date(cls.date).toLocaleDateString('en-CA'));
                              setEditStartTime(cls.startTime);
                              setEditEndTime(cls.endTime);
                            }
                            
                            setEditClassModalOpen(true);
                          }}
                          className={`relative p-2.5 rounded-xl border cursor-pointer hover:shadow-sm transition ${isPending ? 'bg-orange-50 border-orange-300' : 'bg-slate-50 border-slate-200 hover:border-[#1765a4]'}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase">Day {i + 1}</span>
                            {isPending && <span className="text-[8px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded uppercase">Parent Request</span>}
                          </div>
                          <span className="block text-xs font-bold text-slate-800">{new Date(cls.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span className="block text-[10px] font-bold text-[#1765a4]">{cls.startTime} - {cls.endTime}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* ========================================== */}
              {/* 🚨 STAGE 5: FINAL ONBOARDING CHECKLIST */}
              {/* ========================================== */}
              {activeDossierData.admission.admissionStage >= 5 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm shadow-sm mt-4">
                  <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <CheckSquare size={16} className="text-[#1765a4]"/> Stage 5: Final Onboarding
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-4 pb-3 border-b border-slate-100">Ensure all administrative tasks are completed before moving to active observation.</p>
                  
                  <div className="space-y-2">
                    {[
                      { key: "documentsVerified", label: "All KYC & Past Academic Documents Verified" },
                      { key: "enrollmentFormCompleted", label: "Final Enrollment Form Signed & Submitted" },
                      { key: "internalOnboardingDone", label: "Internal Drive Folders & Tracker Setup" },
                      { key: "studentProfileCreated", label: "Official Student Profile & ID Generated" }
                    ].map((item) => {
                      const isChecked = activeDossierData.admission.stage5_Confirmation?.[item.key] || false;
                      const isReadOnly = activeDossierData.admission.admissionStage > 5;
                      return (
                        <div 
                          key={item.key} 
                          onClick={() => !isReadOnly && handleToggleStage5Checklist(activeDossierData.admission._id, item.key, isChecked)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                            isChecked ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
                          } ${!isReadOnly ? "cursor-pointer hover:border-[#1765a4]" : "opacity-80"}`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition ${
                            isChecked ? "bg-[#1765a4] text-white" : "bg-white border-2 border-slate-300"
                          }`}>
                            {isChecked && <CheckCircle2 size={14} />}
                          </div>
                          <span className={`text-xs font-bold ${isChecked ? "text-[#1765a4]" : "text-slate-600"}`}>
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* 🚨 STAGE 6: OBSERVATION & REPORT */}
              {/* ========================================== */}
              {activeDossierData.admission.admissionStage >= 6 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm shadow-sm mt-4">
                  <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                    <Eye size={16} className="text-[#1765a4]"/> Stage 6: Observation & Report
                  </h4>
                  <p className="text-[11px] text-slate-500 mb-4 pb-3 border-b border-slate-100">Student is currently attending induction classes. Summarize their learning style below.</p>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="Summarize the student's learning style, strengths, and behavior during the induction phase. This will be visible to the parent."
                    value={reportNotes}
                    onChange={(e) => { setHasEditedDossier(true); setReportNotes(e.target.value); }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px', backgroundColor: 'white', fontSize: '13px' } }}
                    disabled={activeDossierData.admission.admissionStage > 6}
                  />
                </div>
              )}
                  <div ref={dossierBottomRef} className="h-1" />
                </div>
              )}

              {/* TAB 2: DRIVE FILES */}
              {dossierTab === 2 && (
                <div className="space-y-2">
                  {activeDossierData.admission.stage2_Assessment?.assessmentRecord?.documents?.map((doc, idx) => (
                    <a key={idx} href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-[#1765a4] transition text-slate-700 group w-full overflow-hidden">
                      <FileText size={18} className="text-[#1765a4] shrink-0" /> 
                      <div className="flex-1 overflow-hidden min-w-0"><span className="block truncate text-sm font-bold group-hover:text-[#1765a4] w-full">{doc.title}</span></div>
                      <ExternalLink size={14} className="text-slate-400 shrink-0" />
                    </a>
                  ))}
                  {(!activeDossierData.admission.stage2_Assessment?.assessmentRecord?.documents || activeDossierData.admission.stage2_Assessment.assessmentRecord.documents.length === 0) && (
                    <div className="text-center text-slate-400 py-10"><File size={32} className="mx-auto mb-2 opacity-50" /><p className="text-sm font-bold">No documents uploaded to Drive.</p></div>
                  )}
                </div>
              )}
            </div>

            

            {/* Action Footer */}
            <div className="bg-white p-4 border-t border-slate-200 shrink-0 space-y-4">
              
              {/* STAGE 2 -> STAGE 3 APPROVAL */}
              {activeDossierData.admission.admissionStage === 2 && (
                <Button fullWidth variant="contained" onClick={() => handleCompleteStage2(activeDossierData.admission._id)} disabled={savingId === activeDossierData.admission._id || scholarshipPercent > 48} sx={{ bgcolor: '#ed7f23', borderRadius: '12px', py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '14px', boxShadow: 'none', "&:hover": { bgcolor: "#d96c1c" } }}>
                  {savingId === activeDossierData.admission._id ? <Loader2 size={18} className="animate-spin" /> : "Approve Stage 2 & Generate Plan"}
                </Button>
              )}

              {/* STAGE 3 CALL COMPLETION */}
              {activeDossierData.admission.admissionStage === 3 && activeDossierData.admission.stage3_Recommendation?.status === "call_scheduled" && (
                <Button fullWidth variant="contained" onClick={() => handleCompleteStage3Call(activeDossierData.admission._id)} disabled={savingId === activeDossierData.admission._id} sx={{ bgcolor: '#1765a4', borderRadius: '12px', py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '14px', boxShadow: 'none' }}>
                  {savingId === activeDossierData.admission._id ? <Loader2 size={18} className="animate-spin" /> : "Mark Presentation Call Complete & Reveal Plan"}
                </Button>
              )}

              {/* STAGE 3 AWAITING PAYMENT */}
              {activeDossierData.admission.admissionStage === 3 && activeDossierData.admission.stage3_Recommendation?.status === "call_completed" && !activeDossierData.admission.stage3_Recommendation?.feePaid && (
                 <div className="text-center text-xs font-bold text-slate-500 bg-slate-100 py-3 rounded-xl border border-slate-200">
                    Plan revealed! Awaiting parent to review the contract and pay the initial fee.
                 </div>
              )}

              {/* STAGE 4 MONITORING & ADVANCEMENT */}
              {activeDossierData.admission.admissionStage === 4 && activeDossierData.admission.stage4_ClassesBegin?.status === "started" && (
                 <div className="space-y-3">
                   <div className="text-center text-xs font-bold text-emerald-700 bg-emerald-50 py-3 rounded-xl border border-emerald-100">
                      Classes have started. Monitoring the 5-day comfort guarantee.
                   </div>
                   <Button 
                     fullWidth 
                     variant="contained" 
                     onClick={() => handleCompleteStage4(activeDossierData.admission._id)} 
                     disabled={savingId === activeDossierData.admission._id} 
                     sx={{ bgcolor: '#10b981', borderRadius: '12px', py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '14px', boxShadow: 'none', "&:hover": { bgcolor: "#059669" } }}
                   >
                     {savingId === activeDossierData.admission._id ? <Loader2 size={18} className="animate-spin" /> : "Close Guarantee Window & Move to Stage 5"}
                   </Button>
                 </div>
              )}
              {/* STAGE 5 ADVANCEMENT */}
              {activeDossierData.admission.admissionStage === 5 && (
                 <Button 
                   fullWidth 
                   variant="contained" 
                   onClick={() => handleCompleteStage5(activeDossierData.admission._id)} 
                   disabled={
                     savingId === activeDossierData.admission._id || 
                     !activeDossierData.admission.stage5_Confirmation?.documentsVerified ||
                     !activeDossierData.admission.stage5_Confirmation?.enrollmentFormCompleted ||
                     !activeDossierData.admission.stage5_Confirmation?.internalOnboardingDone ||
                     !activeDossierData.admission.stage5_Confirmation?.studentProfileCreated
                   } 
                   sx={{ bgcolor: '#1765a4', borderRadius: '12px', py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '14px', boxShadow: 'none' }}
                 >
                   {savingId === activeDossierData.admission._id ? <Loader2 size={18} className="animate-spin" /> : "Complete Onboarding & Move to Stage 6"}
                 </Button>
              )}
              {/* STAGE 6 ADVANCEMENT */}
              {activeDossierData.admission.admissionStage === 6 && (
                 <Button 
                   fullWidth 
                   variant="contained" 
                   onClick={() => handleCompleteStage6(activeDossierData.admission._id)} 
                   disabled={savingId === activeDossierData.admission._id || !reportNotes} 
                   sx={{ bgcolor: '#10b981', borderRadius: '12px', py: 1.5, fontWeight: 'bold', textTransform: 'none', fontSize: '14px', boxShadow: 'none', "&:hover": { bgcolor: "#059669" } }}
                 >
                   {savingId === activeDossierData.admission._id ? <Loader2 size={18} className="animate-spin" /> : "Generate Report & Finalize Enrollment"}
                 </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-[#1765a4]" size={36} /></div>
        )}
      </Drawer>

      {/* SCREEN SHARE PREVIEW MODAL */}
      <Dialog fullScreen open={Boolean(previewAdmission)} onClose={() => setPreviewAdmission(null)}>
        <div className="bg-slate-800 flex justify-between items-center p-4 shadow-md sticky top-0 z-50">
          <div className="flex items-center gap-2 text-white">
            <Eye size={20} className="text-emerald-400" />
            <h3 className="font-bold">Screen Share Mode: Presenting to Parent</h3>
          </div>
          <Button variant="contained" color="error" size="small" onClick={() => setPreviewAdmission(null)} startIcon={<X size={16}/>} sx={{ textTransform: 'none', fontWeight: 'bold' }}>
            Close Presentation
          </Button>
        </div>
        <div className="bg-slate-50 min-h-screen pt-8 overflow-y-auto">
          {previewAdmission && (
            <RecommendationView
              admissionData={previewAdmission}
              onComplete={() => {}}
              previewMode={true}
            />
          )}
        </div>
      </Dialog>

      {/* 🚨 COUNSELOR CLASS EDITOR DIALOG */}
      <Dialog open={editClassModalOpen} onClose={() => setEditClassModalOpen(false)} sx={{ '& .MuiDialog-paper': { borderRadius: '24px', padding: '24px', maxWidth: '400px', width: '100%' } }}>
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit3 size={20} className="text-[#1765a4]"/> Edit Class Schedule</h3>
        
        {editingClass?.rescheduleRequest?.isPending && (
          <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 mb-5 text-sm">
            <span className="block text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Parent Request</span>
            <p className="text-slate-700 font-medium mb-1"><strong>Reason:</strong> {editingClass.rescheduleRequest.reason}</p>
            <p className="text-[#ed7f23] font-bold">Requested: {new Date(editingClass.rescheduleRequest.requestedDate).toLocaleDateString()} at {editingClass.rescheduleRequest.requestedStartTime}</p>
          </div>
        )}

        {editStartTime && editEndTime && (parseInt(editEndTime.replace(":", "")) <= parseInt(editStartTime.replace(":", ""))) && (
          <div className="bg-red-50 text-red-600 text-xs font-bold p-2 rounded-lg mb-3 flex items-center gap-2">
            <AlertTriangle size={14}/> End time must be after start time.
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          <TextField 
            type="date" 
            label="Class Date" 
            variant="outlined"
            fullWidth 
            size="small" 
            value={editDate} 
            onChange={(e) => setEditDate(e.target.value)} 
            slotProps={{ 
              inputLabel: { shrink: true },
              htmlInput: { min: new Date().toLocaleDateString('en-CA') }
            }} 
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
          />
          <div className="grid grid-cols-2 gap-4">
             <TextField 
               type="time" 
               label="Start Time" 
               variant="outlined"
               fullWidth 
               size="small" 
               value={editStartTime} 
               onChange={(e) => {
                 const newStart = e.target.value;
                 setEditStartTime(newStart);
                 
                 // 🚨 Auto-Calculate End Time based on duration
                 if (newStart) {
                   const durationStr = activeDossierData?.admission?.stage3_Recommendation?.classDuration || "1 Hour";
                   const durationHours = parseInt(durationStr.match(/\d+/)?.[0] || "1");
                   const [h, m] = newStart.split(":").map(Number);
                   const newEndH = (h + durationHours) % 24;
                   setEditEndTime(`${String(newEndH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                 }
               }} 
               slotProps={{ inputLabel: { shrink: true } }} 
               sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
             />
             <TextField 
               type="time" 
               label="End Time" 
               variant="outlined"
               fullWidth 
               size="small" 
               value={editEndTime} 
               onChange={(e) => setEditEndTime(e.target.value)} 
               /* 🚨 Visual error state if invalid */
               error={editStartTime && editEndTime ? parseInt(editEndTime.replace(":", "")) <= parseInt(editStartTime.replace(":", "")) : false}
               slotProps={{ inputLabel: { shrink: true } }} 
               sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} 
             />
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={() => setEditClassModalOpen(false)} variant="outlined" fullWidth sx={{ borderRadius: '12px', color: '#64748b', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 'bold' }}>Cancel</Button>
          <Button 
            onClick={handleUpdateSingleClass} 
            /* 🚨 Disable if saving OR if time logic is mathematically backwards/equal */
            disabled={savingId === editingClass?._id || !editStartTime || !editEndTime || parseInt(editEndTime.replace(":", "")) <= parseInt(editStartTime.replace(":", ""))} 
            variant="contained" 
            fullWidth 
            sx={{ bgcolor: '#1765a4', borderRadius: '12px', fontWeight: 'bold', textTransform: 'none', boxShadow: 'none' }}
          >
            {savingId === editingClass?._id ? <Loader2 className="animate-spin" /> : "Save & Sync to Calendar"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

export default CounselorAdmissionsDesk;