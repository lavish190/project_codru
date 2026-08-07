import React, { useState, useRef, useEffect } from "react";
import { useNavigate, NavLink, useParams, useLocation } from "react-router-dom";
import { List, ListItem, ListItemButton, ListItemText, ListItemIcon } from "@mui/material";
import { 
  Loader2, Pen, CalendarClock, ListChecks, User, 
  Settings, LogOut, TrendingUp, Backpack, Rss, 
  Home, Users, Bookmark, Lock,
  GraduationCap,
  UserCog,
  ShieldAlert, 
  Bell,
  Heart, 
  MessageCircle,
  Menu,
  Rocket,
  MessageSquare,
  X,
  Briefcase,
  LayoutDashboard,
  UserCircle,
  Zap,
  Plus,
  Mail
} from "lucide-react";

// Components
import CRM from './CRM';
import Admin from "./Admin";
import PlanetryPath from "./PlanetryPath";
import MyPosts from "./MyPosts";
import SavedPosts from "./SavedPosts";
import Profile from "./Profile";
import SettingsPanel from "./SettingsPanel";
import StudentManagement from "./StudentManagement";
import Calendar from "./Calendar";
import { SyllabusTracker } from "./SyllabusTracker"; 
import Muialert from "./Muialert";
import { UserData } from "../App";
import MyCourses from "./MyCourses";
import BulkEmails from "./BulkEmails";
import AdminAuditLog from "./AdminAuditLog";
import Notification from "./Notification";
import ExpertConnect from "./ExpertConnect";
import HandshakeDrawer from "./HandshakeDrawer";
import WhatsAppChat from "./WhatsAppChat";
import { AnimatePresence, motion } from "framer-motion";
import Navprofile from "./Navprofile";
import Overview from './Overview';
import AdminInternship from "./AdminInternship";

interface DashboardProps {
  userData: UserData;
  setUserData: React.Dispatch<React.SetStateAction<UserData>>;
}

const Dashboard = ({ userData, setUserData }: DashboardProps) => {
  const location = useLocation();
  const { section } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error">("success");
  const [isUploading, setIsUploading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [showProfile, setShowProfile] = useState(false);

  // State for the Freemium Modal
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 1. Define who gets to see what
  const isPremiumTeacher = userData.Role === "Teacher" && userData.isVerifiedStaff;
  const isUnverifiedTeacher = userData.Role === "Teacher" && !userData.isVerifiedStaff;
  const isParent = userData.Role === "Parent"; 
  const isVerifiedParent = isParent && userData.isVerifiedParent;
  const isUnverifiedParent = isParent && !userData.isVerifiedParent;
  
  // Global State for Teachers to select a student
  const [teacherStudents, setTeacherStudents] = useState<any[]>([]);
  const [selectedStudentUsername, setSelectedStudentUsername] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState(() => {
    return location.state?.targetView?.toLowerCase() || localStorage.getItem("currentView") || "Overview";
  });

  const todayDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  const [activeTab, setActiveTab] = useState(() => {
    const viewToTabMap: Record<string, string> = {
      Overview: "Overview", schedule: "Schedule", syllabus: "Syllabus Tracker", profile: "Profile",
      settings: "Settings", "my-posts": "My Posts", "saved-posts": "Saved Posts",
      report: "Report", management: "Management", "my-courses": "My Courses",
      "the-village": "The Village (Q&A)", "expert-connect": "Expert Connect",
      "whatsapp-crm": "WhatsApp Support","BulkEmails":"BulkEmails", "admin-internship":"Internship Management",
    };
    return viewToTabMap[currentView] || "Overview";
  });

  const [overviewStats, setOverviewStats] = useState<any>(null);

  // Inside Dashboard.tsx
  useEffect(() => {
    const syncViewWithStorage = () => {
      const savedView = localStorage.getItem("currentView");
      const savedTab = localStorage.getItem("activeTab");

      // Map 'Overview' to the correct case if necessary
      const normalizedView = savedView === "Overview" ? "Overview" : savedView?.toLowerCase();

      if (normalizedView && normalizedView !== currentView) {
        setCurrentView(normalizedView);
        if (savedTab) setActiveTab(savedTab);
      }
    };

    // Run whenever the URL changes (triggered by navigate('/dashboard') in the widget)
    syncViewWithStorage();
  }, [location]); 

  useEffect(() => {
      const fetchOverviewData = async () => {
          try {
              const token = localStorage.getItem("jwtoken");
              const res = await fetch(`${import.meta.env.VITE_API}dashboard-overview`, {
                  headers: { "Authorization": `Bearer ${token}` }
              });
              if (res.ok) {
                  const stats = await res.json();
                  setOverviewStats(stats);
              }
          } catch (err) {
              console.error("Overview fetch failed", err);
          }
      };
      fetchOverviewData();
  }, [userData.Role]); // Refetch if role changes

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      localStorage.setItem("jwtoken", urlToken);
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, []);

  useEffect(() => {
    const stateView = location.state?.targetView;
    const queryParams = new URLSearchParams(location.search);
    const queryView = queryParams.get("view");

    const finalTarget = stateView || queryView;
    if (finalTarget) setActiveTab(finalTarget);
  }, [location]);

  useEffect(() => {
    let target = location.state?.targetView?.toLowerCase();
    
    if (target) {
      if (target === "audit-log") target = "admin-audit-log";
      if (target === "village") target = "the-village";

      setCurrentView(target);
      
      const viewToTabMap: Record<string, string> = {
        Overview: "Overview",
        schedule: "Schedule", 
        syllabus: "Syllabus Tracker", 
        profile: "Profile",
        settings: "Settings", 
        "my-posts": "My Posts", 
        "saved-posts": "Saved Posts",
        report: "Report", 
        management: "Management", 
        "my-courses": "My Courses",
        "the-village": "The Village (Q&A)", 
        "expert-connect": "Expert Connect",
        "manage-users": "Manage Users",           
        "admin-audit-log": "Security Audit Log",
        "whatsapp-crm": "WhatsApp Support",
        "crm": "Management" ,
        "BulkEmails": "Bulk Emails",
        "admin-internship": "Internship Management"
      };

      setActiveTab(viewToTabMap[target] || "Dashboard"); 
      localStorage.setItem("currentView", target);
      localStorage.setItem("activeTab", viewToTabMap[target] || "Dashboard");
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, [location.state]);

  useEffect(() => {
    if (isPremiumTeacher) {
      const fetchRoster = async () => {
        try {
          const token = localStorage.getItem("jwtoken");
          const teacherUsername = localStorage.getItem("Username");
          const res = await fetch(`${import.meta.env.VITE_API}my-students/${teacherUsername}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setTeacherStudents(data);
          }
        } catch (error) {
          console.error("Failed to fetch teacher roster globally:", error);
        }
      };
      fetchRoster();
    }
  }, [isPremiumTeacher]);

  const handleNavigation = (path: string) => navigate(path);

  const handlePhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "cute_profiles"); 
      formData.append("cloud_name", "da6jhcsmm");       
      const cloudinaryRes = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { method: "POST", body: formData });
      if (!cloudinaryRes.ok) throw new Error("Failed to upload to Cloudinary");
      const cloudinaryData = await cloudinaryRes.json();
      const secureUrl = cloudinaryData.secure_url;
      const dbRes = await fetch(`${import.meta.env.VITE_API}profile-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: localStorage.getItem("Username"), photo: secureUrl }),
      });
      if (!dbRes.ok) throw new Error("Failed to update database");
      setUserData((prevData: any) => ({ ...prevData, Photo: secureUrl }));
      localStorage.setItem("Photo", secureUrl);
      setAlertSeverity("success");
      setAlertMessage("Profile picture updated!");
      setShowAlert(true);
    } catch (err: any) {
      setAlertSeverity("error");
      setAlertMessage(err.message || "Failed to update profile picture");
      setShowAlert(true);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const SignOut = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}signout`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        localStorage.removeItem("jwtoken"); 
        localStorage.removeItem("Username");
        localStorage.removeItem("Photo");
        navigate("/");
        window.location.reload(); // 🚨 Flushes all leftover React state from memory
      } else {
        const data = await res.json();
        setAlertSeverity("error"); 
        setAlertMessage(data.error || "Failed to log out"); 
        setShowAlert(true);
      }
    } catch (error) {
      // 🚨 Fallback if the server is down
      localStorage.removeItem("jwtoken"); 
      localStorage.removeItem("Username");
      localStorage.removeItem("Photo");
      navigate("/");
      window.location.reload();
    }
  };

  const handleRequestApproval = async () => {
    setIsRequesting(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}admin/request-staff-approval`, {
        method: "POST", 
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAlertSeverity("success"); 
        setAlertMessage(data.message); 
        setShowAlert(true);
        
        if (userData.Role === "Parent") {
          setUserData(prev => ({ ...prev, parentVerificationRequested: true }));
        } else {
          setUserData(prev => ({ ...prev, staffApprovalRequested: true }));
        }
        
        setTimeout(() => setShowUnlockModal(false), 2000); 
      } else {
        setAlertSeverity("error"); 
        setAlertMessage(data.error || "Failed to send request."); 
        setShowAlert(true);
      }
    } catch (error) {
      setAlertSeverity("error"); 
      setAlertMessage("Network error. Please try again later."); 
      setShowAlert(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const getDrawerContent = () => {
    const basicItems = [
      { text: "Home", icon: <Home size={22} />, path: "/", mobileHidden: true },
      { text: "Overview", icon: <LayoutDashboard size={22} />, view: "Overview" },
      { text: "Schedule", icon: <CalendarClock size={22} />, view: "schedule" },
      { text: "Profile", icon: <User size={22} />, view: "profile" },
      { text: "Settings", icon: <Settings size={22} />, view: "settings" },
      { text: "My Posts", icon: <Rss size={22} />, view: "my-posts" },
      { text: "Saved Posts", icon: <Bookmark size={22} />, view: "saved-posts" },
    ];

    const premiumItems = [];
    if (!isParent) {
      if (userData.Role === "Student" || isPremiumTeacher) {
        premiumItems.push({ text: "Syllabus Tracker", icon: <ListChecks size={22} />, view: "syllabus" });
        premiumItems.push({ text: "My Courses", icon: <Backpack size={22} />, view: "my-courses" });
      }
      if (userData.Role === "Student") premiumItems.push({ text: "Report", icon: <TrendingUp size={22} />, view: "report" });
      if (isPremiumTeacher) premiumItems.push({ text: "My students", icon: <GraduationCap size={22} />, view: "management" });
    }

    const parentItems = [];
    if (isParent) {
      parentItems.push({ text: "The Village", icon: <Heart size={22} />, view: "the-village" });
      parentItems.push({ text: "Expert Connect", icon: <MessageCircle size={22} />, view: "expert-connect", isLocked: isUnverifiedParent });
    }

    const adminItems = [];
    if (userData.isAdmin) {
      adminItems.push({ text: "Management", icon: <Briefcase size={22} />, view: "crm" });
      adminItems.push({ text: "WhatsApp CRM", icon: <MessageSquare size={22} />, view: "whatsapp-crm" });
      adminItems.push({ text: "Manage Users", icon: <UserCog size={22} />, view: "manage-users" });
      adminItems.push({ text: "Audit Log", icon: <ShieldAlert size={22} />, view: "admin-audit-log" });
      adminItems.push({ text: "Bulk Emails", icon: <Mail size={22} />, view: "bulk-emails" });
      adminItems.push({ text: "Internship Management", icon: <Zap size={22} />, view: "admin-internship" });
    }

    // --- 1. SINGLE LIST ITEM RENDERER (Used for both Desktop & Mobile) ---
    const renderListItem = (item: any) => {
      const isActive = activeTab === item.text;
      return (
        <ListItem 
          disablePadding 
          key={item.text} 
          className={`mb-1 ${item.mobileHidden ? 'hidden md:block' : ''}`}
          sx={{ display: item.mobileHidden ? { xs: 'none', md: 'block' } : 'block' }}
        >
          <ListItemButton
            onClick={() => {
              if (item.path) { handleNavigation(item.path); } 
              else {
                setCurrentView(item.view); 
                setActiveTab(item.text);
                localStorage.setItem("currentView", item.view);
                localStorage.setItem("activeTab", item.text);
              }
              // 🚨 THE FIX: Automatically close the sidebar on mobile when a link is clicked!
              setIsSidebarOpen(false); 
            }}
            sx={{
              borderRadius: "12px",
              background: item.isLocked ? "linear-gradient(to bottom right, #fb7185, #e11d48)" : (isActive ? "#fff7ed" : "transparent"),
              color: item.isLocked ? "#ffffff" : (isActive ? "#ed7f23" : "#64748b"),
              "&:hover": { background: item.isLocked ? "linear-gradient(to bottom right, #f43f5e, #be123c)" : (isActive ? "#ffedd5" : "#f1f5f9") },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: "40px" }}>{item.icon}</ListItemIcon>
            <ListItemText 
              primary={
                <div className="flex items-center gap-2">
                  <span>{item.text}</span>
                  {item.isLocked && <Lock size={16} strokeWidth={2.5} className="opacity-90" />}
                </div>
              } 
              slotProps={{ 
                primary: { 
                  sx: {
                    fontWeight: isActive || item.isLocked ? 700 : 500, 
                    fontFamily: '"Arimo", sans-serif' 
                  }
                } 
              }}
            />
          </ListItemButton>
        </ListItem>
      );
    };

    // --- 2. HELPER TO RENDER CATEGORY GROUPS ---
    const renderGroup = (title: string, items: any[], colorClass: string) => {
      if (items.length === 0) return null;
      return (
        <div className="mb-2">
          {title && (
            <div className="mt-4 mb-2 px-4 flex items-center gap-3">
              <p className={`text-[10px] font-black ${colorClass} uppercase tracking-widest whitespace-nowrap opacity-70`}>
                {title}
              </p>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>
          )}
          {items.map(renderListItem)}
        </div>
      );
    };

    // --- 3. RETURN THE UNIFIED LIST ---
    return (
      <List className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar flex flex-col">
        
        {/* Basic Items (No Header) */}
        {renderGroup("", basicItems, "")}
        
        {/* Category Headers */}
        {renderGroup("Guidance & Support", parentItems, "text-rose-400")}
        {renderGroup("Academy Tools", premiumItems, "text-slate-400")}
        {renderGroup("Admin Tools", adminItems, "text-brand-blue")}
        
        {/* Unverified Teacher Banner */}
        {isUnverifiedTeacher && (
          <div className="mt-6 mx-4 bg-linear-to-br from-brand-blue to-blue-600 rounded-2xl p-5 text-white text-center shadow-lg">
            <Lock className="mx-auto mb-2 opacity-80" size={24} />
            <p className="text-xs font-medium mb-3">Official educator tools</p>
            <button 
              onClick={() => { setShowUnlockModal(true); setIsSidebarOpen(false); }} 
              className="w-full bg-white text-brand-blue text-xs font-black py-2.5 rounded-xl active:scale-95 transition"
            >
              UNLOCK ACADEMY
            </button>
          </div>
        )}

        {/* Desktop Logout Button (Hidden on mobile because mobile users sign out from the Profile popup) */}
        <ListItem disablePadding className="mt-auto pt-8 mb-4 px-2 hidden md:block">
          <ListItemButton onClick={SignOut} sx={{ borderRadius: "12px", color: "#e11d48", "&:hover": { backgroundColor: "#fff1f2" } }}>
            <ListItemIcon sx={{ color: "inherit", minWidth: "40px" }}><LogOut size={22} /></ListItemIcon>
            <ListItemText 
              primary="Sign Out" 
              slotProps={{ 
                primary: { 
                  sx: { fontWeight: 700 } 
                } 
              }} 
            />
          </ListItemButton>
        </ListItem>
        
      </List>
    );
  };

  return (
    <div className="fixed inset-0 flex h-dvh w-full bg-slate-50 overflow-hidden font-body overscroll-none">
      
      {/* =========================================
          DESKTOP LEFT SIDEBAR (Hidden on Mobile) 
      ========================================= */}
      <div className="hidden md:flex relative w-72 bg-white border-r border-gray-100 flex-col shadow-lg shrink-0 z-110">
        <div className="h-20 flex items-center justify-center border-b border-gray-100">
          <NavLink to="/" className="cursor-pointer">
            <img src="/logo.svg" alt="CuTe Learning" className="w-26 drop-shadow-md transition transform hover:scale-105" draggable="false" />
          </NavLink>
        </div>

        <div className="flex flex-col items-center py-8 border-b border-gray-100 relative">
          <div className="relative group mx-auto w-20 h-20">
            {isUploading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-full shadow-md border-4 border-white">
                <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
              </div>
            )}
            {userData.Photo ? (
              <img src={userData.Photo} alt="Profile" className="w-20 h-20 rounded-full shadow-md border-4 border-white object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand-orange flex items-center justify-center text-white text-2xl font-bold shadow-md border-4 border-white">
                {userData.Name ? userData.Name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-brand-blue text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition transform hover:scale-110 z-20" title="Change Photo">
              <Pen className="w-3 h-3" />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handlePhotoInput} accept="image/*" />
          </div>
          <h2 className="mt-4 text-lg font-display font-bold text-brand-blue">Hi, {userData.Name ? userData.Name.split(' ')[0] : "Explorer"}!</h2>
          <p className="text-xs font-bold uppercase tracking-wider mt-1 text-gray-400">
            {userData.Role || "User"}
          </p>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col mt-4">
          {getDrawerContent()}
        </div>
      </div>

      {/* =========================================
          RIGHT AREA: MAIN CONTENT 
      ========================================= */}
      {/* Added pb-16 on mobile to make room for the new bottom nav bar */}
      <div className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col pb-16 md:pb-0">
        
        {/* 🌌 DYNAMIC DEEP SPACE HEADER */}
        <div className="h-48 md:h-56 bg-slate-900 absolute top-0 left-0 w-full rounded-b-[3rem] shadow-inner overflow-hidden z-0">
          <div className="absolute top-0 right-0 md:right-32 w-96 h-96 bg-brand-orange opacity-10 rounded-full blur-[80px] animate-nebula-drift" style={{ animationDelay: '0s' }}></div>
          <div className="absolute bottom-0 left-10 md:left-48 w-96 h-96 bg-brand-blue opacity-[0.15] rounded-full blur-[80px] animate-nebula-drift" style={{ animationDelay: '-20s', animationDirection: 'reverse' }}></div>
          <div className="absolute inset-0 opacity-30 pointer-events-none animate-star-pan" style={{
            backgroundImage: 'radial-gradient(1px 1px at 15% 25%, white, transparent), radial-gradient(1.5px 1.5px at 45% 65%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 75% 15%, rgba(255,255,255,0.4), transparent), radial-gradient(2px 2px at 85% 75%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 25% 85%, white, transparent)',
            backgroundSize: '130px 130px, 190px 190px, 230px 230px, 290px 290px, 110px 110px'
          }}></div>
          <div className="absolute z-10 animate-space-wander opacity-70">
            <Rocket size={32} className="text-white fill-white/5 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" strokeWidth={1} />
            <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-brand-orange rounded-full blur-md opacity-30 animate-thruster"></div>
          </div>

          <style>{`
            @keyframes star-pan {
              0% { background-position: 0px 0px; }
              100% { background-position: -500px 200px; }
            }
            .animate-star-pan {
              animation: star-pan 150s linear infinite;
            }

            @keyframes nebula-drift {
              0% { transform: translate(0, 0) scale(1); opacity: 0.08; }
              33% { transform: translate(40px, -40px) scale(1.1); opacity: 0.12; }
              66% { transform: translate(-30px, 30px) scale(0.95); opacity: 0.05; }
              100% { transform: translate(0, 0) scale(1); opacity: 0.08; }
            }
            .animate-nebula-drift {
              animation: nebula-drift 45s ease-in-out infinite;
            }

            @keyframes space-wander {
              0%   { transform: translate(5vw, 20px) rotate(15deg); }
              20%  { transform: translate(30vw, 80px) rotate(35deg); }
              40%  { transform: translate(65vw, 10px) rotate(5deg); }
              60%  { transform: translate(85vw, 90px) rotate(-15deg); }
              80%  { transform: translate(40vw, 50px) rotate(-5deg); }
              100% { transform: translate(5vw, 20px) rotate(15deg); }
            }
            .animate-space-wander {
              animation: space-wander 60s ease-in-out infinite;
            }

            @keyframes thruster {
              0%, 100% { transform: scale(1); opacity: 0.2; }
              50% { transform: scale(1.1); opacity: 0.4; }
            }
            .animate-thruster {
              animation: thruster 4s ease-in-out infinite;
            }
          `}</style>
        </div>

        {/* TOP BAR (Hamburger + Mobile Date) */}
        <div className="absolute top-4 md:top-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-90 flex items-center justify-between md:justify-center">
          
          {/* 🚨 NEW: Mobile Top-Left Hamburger Menu */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white shadow-lg hover:bg-white/20 active:scale-95 transition-all"
          >
            <Menu size={20} strokeWidth={2.5} />
          </button>

          {/* Mobile Date Pill */}
          <div className="md:hidden flex items-center bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full shadow-lg">
            <span className="text-[11px] font-bold tracking-wider text-white/90 drop-shadow-sm uppercase">
              {todayDate}
            </span>
          </div>

          {/* Invisible spacer to keep the Date perfectly centered on mobile */}
          <div className="w-10 md:hidden pointer-events-none"></div>

          {/* Desktop Date & Notif Pill (Unchanged) */}
          <div className="hidden md:flex items-center gap-4 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 px-6 py-2.5 rounded-full shadow-lg transition-all duration-300">
            <span className="text-sm font-medium text-white/90 tracking-wide drop-shadow-sm whitespace-nowrap">
              {todayDate}
            </span>
            <div className="w-px h-5 bg-white/30 rounded-full"></div>
            <button onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }} className="relative text-white hover:text-brand-orange hover:scale-110 transition-all" title="Notifications">
              <Bell size={20} className={unreadCount > 0 ? "animate-wiggle" : ""} />
              {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full shadow-sm border border-brand-orange">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          </div>
        </div>
        
        <div className="absolute top-0 left-0 w-full flex justify-center z-1000 pointer-events-none">
          <div className="pointer-events-auto">
            <Notification 
              showNotifications={showNotifications} 
              setShowNotifications={setShowNotifications}
              closeNotification={() => setShowNotifications(false)}
              setUnreadCount={setUnreadCount} 
              customClasses="fixed bottom-[76px] left-1/2 -translate-x-1/2 w-[92vw] max-w-sm rounded-2xl shadow-2xl md:absolute md:bottom-auto md:top-20 md:left-1/2 md:-translate-x-1/2 md:w-96" 
            />
          </div>
        </div>
        
        {/* MAIN CONTENT AREA */}
        <div className="relative z-0 px-0 pt-16 pb-0 md:p-8 max-w-7xl mx-auto w-full mt-2 md:mt-8 flex-1 flex flex-col min-h-0">
          
          {isPremiumTeacher && ["syllabus", "my-courses"].includes(currentView) && (
            <div className="mb-6 mx-4 md:mx-0 bg-white px-6 py-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 overflow-x-auto custom-scrollbar shrink-0">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Viewing:</span>
              
              <div className="flex items-center gap-2">
                
                {/* 1. Class Insights (Only relevant for Syllabus View) */}
                {currentView === "syllabus" && (
                  <button onClick={() => setSelectedStudentUsername(null)} className={`flex items-center gap-2 px-4 py-2 rounded-full border transition whitespace-nowrap ${selectedStudentUsername === null ? 'border-brand-orange text-brand-orange bg-orange-50 font-bold' : 'border-gray-200 text-gray-500 font-medium hover:border-brand-orange hover:bg-orange-50/50'}`}>
                    <Zap size={16} /> Class Insights
                  </button>
                )}

                {/* 2. Teacher's Own View (Me) */}
                <button 
                  onClick={() => setSelectedStudentUsername(localStorage.getItem("Username") || localStorage.getItem("username"))} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition whitespace-nowrap ${(selectedStudentUsername === (localStorage.getItem("Username") || localStorage.getItem("username"))) ? 'border-slate-900 text-slate-900 bg-slate-100 font-bold' : 'border-gray-200 text-gray-500 font-medium hover:border-slate-900 hover:bg-slate-50'}`}
                >
                  <UserCircle size={16} /> My {currentView === 'syllabus' ? 'Syllabus' : 'Courses'}
                </button>

                {/* Vertical Divider */}
                <div className="w-px h-6 bg-gray-200 mx-2 shrink-0" />

                {/* 3. Students List */}
                {teacherStudents.length === 0 ? (
                  <span className="text-sm text-gray-400 italic px-2 whitespace-nowrap">No students in roster</span>
                ) : (
                  teacherStudents.map(student => {
                    const isSelected = selectedStudentUsername === student.username;
                    return (
                      <button key={student.username} onClick={() => setSelectedStudentUsername(student.username)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition whitespace-nowrap ${isSelected ? 'border-brand-blue bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-brand-blue hover:bg-blue-50/50'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden ${isSelected ? 'bg-brand-blue text-white border-2 border-brand-blue' : 'bg-brand-blue/10 text-brand-blue'}`}>
                          {student.photo || student.Photo ? <img src={student.photo || student.Photo} alt={student.name} className="w-full h-full object-cover" /> : (student.name ? student.name.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <span className={`text-sm ${isSelected ? 'font-bold text-brand-blue' : 'font-medium text-gray-700'}`}>{student.name ? student.name.split(' ')[0] : student.username}</span>
                      </button>
                    );
                  })
                )}

                {/* 🚨 NEW: 4. Add Student Button */}
                <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />
                <button 
                  onClick={() => {
                    // Update state to render the StudentManagement component
                    setCurrentView("management");
                    setActiveTab("Management");
                    // Save to local storage so it persists on refresh
                    localStorage.setItem("currentView", "management");
                    localStorage.setItem("activeTab", "Management");
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:text-brand-blue hover:border-brand-blue hover:bg-blue-50 transition whitespace-nowrap"
                  title="Manage Students"
                >
                  <Plus size={16} />
                  <span className="text-sm font-bold">Add Student</span>
                </button>

              </div>
            </div>
          )}
        

          <div className={`relative flex-1 min-h-0 flex flex-col bg-white transition-all duration-300
              rounded-t-4xl md:rounded-4xl 
              border-t md:border border-gray-100 border-x-0 md:border-x
              shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] md:shadow-xl
              ${(currentView === "report" || currentView === "whatsapp-crm") 
                  ? "p-0 overflow-hidden" 
                  : "pt-4 px-4 md:pt-6 md:px-6 overflow-y-auto dashboard-content-scroll"}
          `}>
            <div className={`relative w-full ${(currentView === "report" || currentView === "whatsapp-crm") 
              ? "h-full" 
              : "min-h-full pb-8 md:pb-10"} rounded-lg
            `}>
              
              {/* COMPONENT RENDERING ROUTER */}
              {currentView === "Overview" && <Overview user={userData} data={overviewStats} />}
              {currentView === "profile" && <Profile />}
              {currentView === "schedule" && <Calendar role={userData.Role || "student"} currentUserId={userData._id} />}
              {currentView === "settings" && <SettingsPanel userData={userData} setUserData={setUserData} />}
              {currentView === "saved-posts" && <SavedPosts />}
              {currentView === "my-posts" && <MyPosts />}
              
              {currentView === "syllabus" && !isParent && <SyllabusTracker role={userData.Role || "student"} selectedStudentUsername={selectedStudentUsername} />}
              {currentView === "my-courses" && !isParent && <MyCourses role={userData.Role} selectedStudentUsername={selectedStudentUsername || undefined} />}
              {currentView === "report" && userData?.Role?.toLowerCase() === "student" && <PlanetryPath />}
              {currentView === "management" && isPremiumTeacher && <StudentManagement userData={userData} />}
              {currentView === "manage-users" && userData?.isAdmin && <Admin />}
              {currentView === "admin-audit-log" && userData?.isAdmin && <AdminAuditLog />}
              {currentView === "whatsapp-crm" && userData?.isAdmin && <WhatsAppChat />}
              {currentView === "crm" && userData?.isAdmin && <CRM />}
              {currentView === "bulk-emails" && userData?.isAdmin && <BulkEmails userData={userData} />}
              {currentView === "admin-internship" && userData?.isAdmin && <AdminInternship />}

              {currentView === "the-village" && isParent && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4">
                    <Heart size={48} />
                  </div>
                  <h2 className="text-3xl font-display font-bold text-gray-800">The Village</h2>
                  <p className="text-gray-500 mt-2 max-w-md mx-auto">An anonymous, safe space to ask parenting questions and receive guidance from experts and students.</p>
                  <p className="text-sm font-bold text-rose-500 mt-4 uppercase tracking-widest bg-rose-50 px-4 py-2 rounded-full">Coming Soon</p>
                </div>
              )}
              {currentView === "expert-connect" && isParent && (
                isVerifiedParent ? (
                  <ExpertConnect userData={userData} /> 
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-24 h-24 bg-rose-50 text-rose-300 rounded-full flex items-center justify-center mb-6">
                      <ShieldAlert size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Verification Required</h2>
                    <p className="text-gray-500 mt-3 max-w-md mx-auto leading-relaxed">
                      To protect our community and ensure a safe space, please request Admin Verification to unlock direct 1-on-1 messaging.
                    </p>
                    <button 
                      onClick={() => setShowUnlockModal(true)}
                      className="mt-8 px-8 py-3.5 bg-rose-500 text-white font-black tracking-wide rounded-full hover:bg-rose-600 transition shadow-lg shadow-rose-500/30 active:scale-95"
                    >
                      REQUEST VERIFICATION
                    </button>
                  </div>
                )
              )}
              

            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          📱 DASHBOARD NAVBAR (Focus Context)
      ========================================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white flex items-center z-1000 pb-safe 
        shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.1)] border-t border-gray-100">
        
        {/* ESCAPE HATCH TO SOCIAL FEED */}
        <button 
          onClick={() => navigate("/")} 
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-brand-orange transition-colors"
        >
          <Home size={24} strokeWidth={2} />
          <span className="text-[10px] font-bold mt-1">Home</span>
        </button>

        {/* ALERTS */}
        <button 
          onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); }}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-brand-orange transition-colors"
        >
          <div className="relative">
            <Bell size={24} strokeWidth={2} className={unreadCount > 0 ? "text-brand-orange" : ""} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </div>
          <span className="text-[10px] font-bold mt-1">Alerts</span>
        </button>

        {/* PROFILE */}
        <button 
          onClick={(e) => { e.stopPropagation(); setShowProfile(!showProfile); }}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${showProfile ? "text-brand-orange" : "text-gray-400 hover:text-brand-orange"}`}
        >
          <div className={`w-6 h-6 rounded-full flex items-center justify-center overflow-hidden border-[1.5px] ${showProfile ? "border-brand-orange" : "border-transparent"}`}>
            {userData?.Photo ? <img src={userData.Photo} alt="Profile" className="w-full h-full object-cover" /> : <User size={20} strokeWidth={2} className={showProfile ? "text-brand-orange" : "text-gray-400"} />}
          </div>
          <span className="text-[10px] font-bold mt-1">Profile</span>
        </button>
      </div>

      

      {/* =========================================
          MODALS & ALERTS
      ========================================= */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-999 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-4xl p-8 max-w-sm w-full text-center shadow-2xl relative animate-in zoom-in duration-200">
            <button onClick={() => setShowUnlockModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition">✕</button>
            
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isUnverifiedParent ? 'bg-rose-50' : 'bg-blue-50'}`}>
              {isUnverifiedParent ? <ShieldAlert className="text-rose-500 w-8 h-8" /> : <Lock className="text-brand-blue w-8 h-8" />}
            </div>
            
            <h3 className="text-xl font-black text-slate-800 mb-2">
              {isUnverifiedParent ? "Verify Your Account" : "Unlock Academy"}
            </h3>
            
            <p className="text-sm text-slate-500 mb-6 font-medium">
              {isUnverifiedParent 
                ? "Protecting our community is our top priority. Request verification to unlock direct messaging with our Verified Educators."
                : "Are you an official educator at Cute Learning? Request admin approval to access student management and syllabus tools."}
            </p>
            
            {(() => {
              const isPending = isUnverifiedParent 
                ? userData.parentVerificationRequested 
                : userData.staffApprovalRequested;

              return (
                <button 
                  onClick={handleRequestApproval}
                  disabled={isRequesting || isPending}
                  className={`w-full py-3.5 rounded-xl font-black transition active:scale-95 shadow-lg ${
                    isPending 
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none" 
                      : isUnverifiedParent 
                        ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20" 
                        : "bg-brand-orange text-white hover:bg-orange-600 shadow-orange-500/20"
                  }`}
                >
                  {isRequesting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> SENDING...
                    </span>
                  ) : isPending ? (
                    "REQUEST PENDING"
                  ) : isUnverifiedParent ? (
                    "REQUEST VERIFICATION"
                  ) : (
                    "REQUEST APPROVAL"
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      
      {/* 🚨 YOUR NAVPROFILE COMPONENT */}
      <Navprofile 
        setShowProfile={setShowProfile} 
        showProfile={showProfile} 
        closeNavProfile={() => setShowProfile(false)} 
        userData={userData} 
        setUserData={setUserData} 
      />

      {/* =========================================
          📱 MOBILE ONLY: SLIDE-OVER SIDEBAR
      ========================================= */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-2000" 
            />

            {/* Sidebar Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-[80%] max-w-75 bg-white z-2100 shadow-2xl flex flex-col"
            >
              {/* Header (Logo + Close Button) */}
              <div className="h-16 flex items-center justify-center border-b border-gray-100 relative shrink-0">
                <img src="/logo.svg" alt="CuTe Learning" className="w-22 drop-shadow-md" draggable="false" />
              </div>

              {/* Profile Overview (Mimics Desktop exactly) */}
              <div className="flex flex-col items-center py-6 border-b border-gray-100 relative shrink-0">
                <div className="w-20 h-20 rounded-full border-4 border-white shadow-md overflow-hidden bg-brand-orange text-white flex items-center justify-center text-2xl font-bold">
                  {userData.Photo ? <img src={userData.Photo} alt="Profile" className="w-full h-full object-cover" /> : (userData.Name?.charAt(0).toUpperCase() || "U")}
                </div>
                <h2 className="mt-4 text-lg font-display font-bold text-brand-blue">Hi, {userData.Name ? userData.Name.split(' ')[0] : "Explorer"}!</h2>
                <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-gray-400">
                  {userData.Role || "User"}
                </p>
              </div>

              {/* 🚨 THE MAGIC: Calls the exact same List items as Desktop! */}
              <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pt-2 pb-6">
                {getDrawerContent()} 
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <HandshakeDrawer />
      {showAlert && <Muialert message={alertMessage} severity={alertSeverity} onClose={() => setShowAlert(false)} />}
    </div>
  );
};

export default Dashboard;