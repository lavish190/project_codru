import React, { useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, ArrowRight, CheckCheck, Loader2, AlertTriangle } from "lucide-react";
import {
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

// Components & Context
import Muialert from "./Muialert";
import Popup from "./Popup"; 
import { ThemeContext } from "../context/ThemeContext";

interface SettingsPanelProps {
  userData: any;
  setUserData: React.Dispatch<React.SetStateAction<any>>;
}

const username = localStorage.getItem("Username");

// --- 1. GENERAL SETTINGS ---
const GeneralSettings = () => {
  const { theme, toggleTheme } = useContext(ThemeContext) as { 
    theme: string | boolean; 
    toggleTheme: () => void 
  };

  return (
    <div className="animate-fade-in-up">
      <h3 className="text-xl font-display font-bold text-brand-blue mb-4">Appearance</h3>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <h4 className="font-bold text-gray-800">Theme Preference</h4>
          <p className="text-sm text-gray-500 font-body">Switch between Light and Dark mode.</p>
        </div>
        
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={theme === "dark" || theme === true} 
            onChange={toggleTheme} 
          />
          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-orange"></div>
        </label>
      </div>
    </div>
  );
};

// --- 2. ACCOUNT SETTINGS ---
const AccountSettings = ({ userData, setUserData }: SettingsPanelProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error" | "info" | "warning">("info");
  const [isChangingRole, setIsChangingRole] = useState(false);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigate = useNavigate();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API}change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 🚨 THIS SENDS THE COOKIE! 🚨
        body: JSON.stringify({ currentPassword, newPassword }), // username removed
      });

      if (response.ok) {
        setAlertSeverity("success");
        setAlertMessage("Password changed successfully!");
        setShowAlert(true);
        setCurrentPassword("");
        setNewPassword("");
      } else {
        // You can actually grab the exact error message from your backend now!
        const errorData = await response.json();
        setAlertSeverity("error");
        setAlertMessage(errorData.error || "Error changing password.");
        setShowAlert(true);
      }
    } catch (error) {
      setAlertSeverity("error");
      setAlertMessage("Network error.");
      setShowAlert(true);
    }
  };

  const confirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API}user/${username}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: userData.Role }),
      });
      if (response.ok) {
        localStorage.clear();
        navigate("/");
      } else {
        setAlertSeverity("error");
        setAlertMessage("Failed to delete account.");
        setShowAlert(true);
        setDeleteModalOpen(false);
      }
    } catch (error) {
      setAlertSeverity("error");
      setAlertMessage("Network error.");
      setShowAlert(true);
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h3 className="text-xl font-display font-bold text-brand-blue mb-4">Account Type</h3>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between mb-8">
        <div>
          <h4 className="font-bold text-gray-800">
            Current Role: <span className="text-brand-orange capitalize">{userData.Role || "User"}</span>
          </h4>
          <p className="text-sm text-gray-500 font-body mt-1">Change how you use the platform.</p>
        </div>
        <button onClick={() => setIsChangingRole(true)} className="bg-blue-50 text-brand-blue px-6 py-2.5 rounded-xl font-bold hover:bg-brand-blue hover:text-white transition-all">
          Change Role
        </button>
      </div>

      <h3 className="text-xl font-display font-bold text-brand-blue mb-4">Security</h3>
      <form onSubmit={handlePasswordChange} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-5">
        <TextField 
          label="Current Password" 
          type={showCurrentPassword ? "text" : "password"} 
          value={currentPassword} 
          onChange={(e) => setCurrentPassword(e.target.value)} 
          fullWidth 
          slotProps={{ 
            input: {
              endAdornment: ( 
                <InputAdornment position="end"> 
                  <IconButton onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                    {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton> 
                </InputAdornment> 
              ) 
            }
          }} 
        />
        
        <TextField 
          label="New Password" 
          type={showNewPassword ? "text" : "password"} 
          value={newPassword} 
          onChange={(e) => setNewPassword(e.target.value)} 
          fullWidth 
          slotProps={{
            input: {
              endAdornment: ( 
                <InputAdornment position="end"> 
                  <IconButton onClick={() => setShowNewPassword(!showNewPassword)}>
                    {showNewPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton> 
                </InputAdornment> 
              )
            }
          }} 
        />
        <div className="flex justify-end mt-2">
          <Button type="submit" variant="contained" sx={{ backgroundColor: '#1765a4', borderRadius: '10px', textTransform: 'none', fontWeight: 'bold', paddingX: 4 }}>Update Password</Button>
        </div>
      </form>

      <h3 className="text-xl font-display font-bold text-red-600 mb-4 mt-10">Danger Zone</h3>
      <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm flex items-center justify-between">
        <div>
          <h4 className="font-bold text-red-800">Delete Account</h4>
          <p className="text-sm text-red-600">All data will be wiped permanently.</p>
        </div>
        <button onClick={() => setDeleteModalOpen(true)} className="bg-red-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition">Delete Account</button>
      </div>

      <Popup isOpen={isChangingRole} onClose={() => setIsChangingRole(false)} onRoleSelected={(newRole) => { setUserData((prev: any) => ({ ...prev, Role: newRole })); setIsChangingRole(false); setAlertSeverity("success"); setAlertMessage(`Switched to ${newRole}!`); setShowAlert(true); }} />
      {showAlert && <Muialert message={alertMessage} severity={alertSeverity} onClose={() => setShowAlert(false)} />}

      {/* SLEEK DANGER MODAL */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <div className="p-6 bg-white rounded-3xl max-w-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-xl font-display font-bold text-gray-800">Delete Account?</h3>
          </div>
          <p className="text-sm text-gray-500 mb-8 pl-1">
            This action is permanent and cannot be undone. All your data, progress, and settings will be wiped instantly.
          </p>
          <div className="flex justify-end gap-3">
            <button 
              onClick={() => setDeleteModalOpen(false)} 
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button 
              onClick={confirmDeleteAccount} 
              disabled={isDeleting}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-md shadow-red-500/20 flex items-center gap-2"
            >
              {isDeleting ? <Loader2 className="animate-spin" size={16} /> : 'Yes, Delete'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

// --- 3. NOTIFICATION SETTINGS ---
const NotificationSettings = ({ userData, setUserData }: SettingsPanelProps) => {
  const [isPushEnabled, setIsPushEnabled] = useState(Notification.permission === "granted");
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "warning">("success");
  const [history, setHistory] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}notifications`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const recentNotifications = data.filter((notif: any) => {
            return new Date(notif.date) >= sevenDaysAgo;
          });

          setHistory(recentNotifications);
        }
      } catch (error) {
        console.error("Failed to fetch notification history", error);
      }
    };
    fetchHistory();
  }, []);

  const handleHistoryClick = async (notifId: string, link?: string) => {
  setHistory(prev => prev.map(n => n._id === notifId ? { ...n, isRead: true } : n));

  try {
    fetch(`${import.meta.env.VITE_API}notifications/mark-read`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`
      },
      body: JSON.stringify({ notifId })
    });
  } catch (error) { console.error(error); }

  if (link) {
    const absoluteLink = link.startsWith('/') ? link : `/${link}`;
    const pathWord = absoluteLink.replace('/', '').toLowerCase();
    
    const dashboardViews = [
      "schedule", "syllabus", "profile", "settings", "my-posts", 
      "saved-posts", "report", "management", "my-courses"
    ];
    if (pathWord.startsWith("portal")) {
        const parts = pathWord.split(":");
        const chatId = parts.length > 1 ? parts[1] : null;

        window.dispatchEvent(new CustomEvent('open-communication-portal', {
          detail: { connectionId: chatId } 
        }));

        return; 
      }
    
    if (dashboardViews.includes(pathWord)) {
      navigate("/dashboard", { state: { targetView: pathWord } }); 
    } else {
      navigate(absoluteLink); 
    }
  }
};

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  const handleMarkAllRead = async () => {
  setHistory(prev => prev.map(n => ({ ...n, isRead: true })));

  try {
    const token = localStorage.getItem("jwtoken");
    const res = await fetch(`${import.meta.env.VITE_API}notifications/mark-all-read`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      console.error("Server sync failed for Mark All Read");
    }
  } catch (error) {
    console.error("Failed to mark all as read:", error);
  }
};

  const handlePushToggle = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      if (isPushEnabled) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe(); 
        }
        setIsPushEnabled(false);
        setAlertSeverity("success");
        setAlertMessage("Notifications disabled.");
        setShowAlert(true);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setAlertSeverity("warning");
          setAlertMessage("Please enable notifications in your browser settings.");
          setShowAlert(true);
          return;
        }
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY)
        });

        const res = await fetch(`${import.meta.env.VITE_API}save-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
          body: JSON.stringify({ subscription })
        });

        if (res.ok) { 
          setIsPushEnabled(true); 
          setAlertSeverity("success");
          setAlertMessage("Notifications linked successfully!");
          setShowAlert(true); 
        }
      }
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="animate-fade-in-up">
      <h3 className="text-xl font-display font-bold text-brand-blue mb-4">Email & Alerts</h3>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <FormControlLabel 
              control={
                <Checkbox 
                  checked={isPushEnabled} 
                  onChange={handlePushToggle} 
                  disabled={loading}
                  sx={{ color: '#ed7f23', '&.Mui-checked': { color: '#ed7f23' } }} 
                />
              } 
              label={<span className="font-bold text-gray-800">Enable Push Notifications</span>} 
            />
            <p className="text-sm text-gray-500 ml-8">
              {isPushEnabled ? "🚀 System notifications are active." : "Receive real-time alerts even when the site is closed."}
            </p>
          </div>
          {loading && <Loader2 className="animate-spin text-brand-orange" />}
        </div>
      </div>
      
      {showAlert && <Muialert message={alertMessage} severity={alertSeverity} onClose={() => setShowAlert(false)} />}
      
      {/* --- 7-DAY NOTIFICATION HISTORY --- */}
      <div className="mt-8 animate-fade-in">
        <div className="flex items-center justify-between mb-4 px-1">
          <h4 className="font-bold text-gray-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-orange" />
            7-Day Notification History
          </h4>
          
          {history.some(n => !n.isRead) && (
            <button 
              onClick={handleMarkAllRead}
              className="text-[11px] font-bold text-brand-orange hover:bg-brand-orange/10 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 border border-brand-orange/20"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all as read
            </button>
          )}
        </div>

        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-2">
          {history.length > 0 ? (
            history.map((notif: any) => (
              <div 
                key={notif._id} 
                onClick={() => handleHistoryClick(notif._id, notif.link)}
                className={`group relative p-4 mb-2 rounded-xl border transition-all duration-300 cursor-pointer flex items-start gap-4 shadow-sm
                  ${notif.isRead 
                    ? "bg-white border-gray-100 opacity-70" 
                    : "bg-white border-brand-orange/20 ring-1 ring-brand-orange/5 hover:shadow-md"
                  }`}
              >
                {!notif.isRead && (
                  <div className="mt-1.5 flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-brand-orange opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-orange"></span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <span className={`text-sm block transition-colors ${
                    notif.isRead ? "text-gray-500 font-medium" : "text-gray-900 font-bold"
                  }`}>
                    {notif.message}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400 mt-2 block">
                    {new Date(notif.date).toLocaleDateString()} • {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className={`transition-transform duration-300 group-hover:translate-x-1 ${notif.isRead ? "text-gray-300" : "text-brand-orange"}`}>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-200/50 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
                <BellOff className="text-gray-400 w-6 h-6" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Your notification inbox is empty.</p>
              <p className="text-xs text-gray-400">New alerts will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 4. MAIN PARENT COMPONENT ---
const SettingsPanel = ({ userData, setUserData }: SettingsPanelProps) => {
  const tabs = ["general", "account", "notifications"];
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem("settingsActiveTab") || "general");
  const [direction, setDirection] = useState(0);

  const setTabWithDirection = (newTab: string) => {
    const newIndex = tabs.indexOf(newTab);
    const currentIndex = tabs.indexOf(activeTab);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  useEffect(() => {
    localStorage.setItem("settingsActiveTab", activeTab);
  }, [activeTab]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  const renderContent = () => {
    switch (activeTab) {
      case "general": return <GeneralSettings />;
      case "account": return <AccountSettings userData={userData} setUserData={setUserData} />;
      case "notifications": return <NotificationSettings userData={userData} setUserData={setUserData} />;
      default: return <GeneralSettings />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      
      {/* --- HEADING --- */}
      <div className="mb-6 md:mb-8 px-4 shrink-0">
        <h2 className="text-3xl font-display font-bold text-brand-blue text-center md:text-left">
          Settings
        </h2>
      </div>

      {/* --- TAB NAVIGATION --- */}
      <div className="sticky top-0 z-30 bg-white flex justify-center md:justify-start space-x-6 md:space-x-8 border-b border-gray-100 pt-2 pb-4 mb-6 hide-scrollbar px-4 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setTabWithDirection(tab)}
            className={`whitespace-nowrap text-[11px] md:text-sm font-bold uppercase tracking-widest transition-colors relative ${
              activeTab === tab ? "text-brand-orange" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="activeTabUnderline"
                className="absolute -bottom-4 left-0 right-0 h-0.5 bg-brand-orange rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* --- SWIPEABLE CONTENT AREA --- */}
      {/* 🚨 THE SCROLL FIX: Bounding the parent and making the child overflow-y-auto */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const swipeThreshold = 50;
              const velocityThreshold = 500; 

              if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                const nextIndex = tabs.indexOf(activeTab) + 1;
                if (nextIndex < tabs.length) setTabWithDirection(tabs[nextIndex]);
              } 
              else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                const prevIndex = tabs.indexOf(activeTab) - 1;
                if (prevIndex >= 0) setTabWithDirection(tabs[prevIndex]);
              }
            }}
            // 🚨 THE SCROLL FIX: h-full + overflow-y-auto keeps the scrolling neatly contained
            className="w-full h-full flex-1 overflow-y-auto custom-scrollbar px-4 md:px-0 pb-12 md:pb-6"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

export default SettingsPanel;