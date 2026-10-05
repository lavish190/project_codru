import { useState, useEffect, useCallback } from "react";
import {
  DataGrid,
  Toolbar,
  useGridApiContext, 
  GridColDef,
} from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import {
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  AddCircle as AddCircleIcon,
  RemoveCircle as RemoveCircleIcon,
  Shield as ShieldIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  WorkspacePremium as WorkspacePremiumIcon,
  SupportAgent as SupportAgentIcon
} from "@mui/icons-material";
import { Dialog, DialogContent, IconButton, TextField, Button, Tooltip, Switch, FormControlLabel, InputAdornment } from "@mui/material";

import { useTheme, alpha, lighten, darken } from "@mui/material/styles";

import { Loader2, Send, X, Megaphone, Link as LinkIcon, Search } from "lucide-react";

// Components
import Muialert from "./Muialert";

const BroadcastModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [data, setData] = useState({ title: "", message: "", link: "" });
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!data.title || !data.message) return alert("Please fill in the title and message!");
    
    const targetURL = `${import.meta.env.VITE_API}api/admin/broadcast`;

    setLoading(true);
    try {
      const res = await fetch(targetURL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` 
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        alert("Broadcast sent successfully!");
        onClose();
      }
    } catch (error) {
      console.error("🚨 Network Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      slotProps={{ 
        paper: { 
          style: { borderRadius: '24px', padding: '10px', maxWidth: '500px', width: '100%' } 
        } 
      }}
    >
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-brand-orange/10 p-2 rounded-xl">
              <Megaphone className="text-brand-orange w-6 h-6" />
            </div>
            <h2 className="text-2xl font-display font-bold text-brand-blue">Global Broadcast</h2>
          </div>
          <IconButton onClick={onClose}><X /></IconButton>
        </div>

        <div className="flex flex-col gap-4">
          <TextField label="Notification Title" placeholder="e.g., Site Maintenance" fullWidth value={data.title} onChange={(e) => setData({ ...data, title: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }} />
          <TextField label="Your Message" placeholder="Tell your users what's happening..." multiline rows={3} fullWidth value={data.message} onChange={(e) => setData({ ...data, message: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }} />
          <TextField 
            label="Redirect Link (Optional)" 
            placeholder="/dashboard or https://..." 
            fullWidth 
            value={data.link} 
            onChange={(e) => setData({ ...data, link: e.target.value })} 
            slotProps={{ 
              input: { 
                startAdornment: <LinkIcon size={18} className="mr-2 text-gray-400" /> 
              } 
            }} 
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px' } }} 
          />

          <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 mt-2">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Live Preview</p>
            <div className="flex gap-3 items-start">
               <img src="https://res.cloudinary.com/da6jhcsmm/image/upload/v1773202841/CuTe_Logo_dlmvw9.png" className="w-8 h-8 rounded-lg" alt="logo" />
               <div>
                  <p className="text-xs font-bold text-gray-800">{data.title || "Title Here"}</p>
                  <p className="text-[11px] text-gray-500 leading-tight">{data.message || "Your message will appear here..."}</p>
               </div>
            </div>
          </div>

          <Button variant="contained" disabled={loading} onClick={handleSend} sx={{ mt: 2, bgcolor: '#1765a4', borderRadius: '14px', py: 1.5, fontWeight: 'bold', textTransform: 'none', '&:hover': { bgcolor: '#124d7d' } }} startIcon={loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}>
            {loading ? "Transmitting..." : "Blast to All Devices"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

// 🚨 NEW: Custom Search Component to replace GridToolbarQuickFilter
function AdminGridSearch() {
  const apiRef = useGridApiContext();

  return (
    <TextField
      placeholder="Search directory..."
      size="small"
      variant="outlined"
      onChange={(event) => {
        const searchWords = event.target.value.split(' ').filter((word) => word !== '');
        apiRef.current.setQuickFilterValues(searchWords);
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search size={16} className="text-gray-400" />
            </InputAdornment>
          ),
        },
      }}
      sx={{ 
        width: "100%", 
        maxWidth: "300px",
        '& .MuiOutlinedInput-root': { 
          borderRadius: '14px', 
          bgcolor: 'white', 
          marginRight: '8px',
          '& fieldset': { borderColor: '#e2e8f0' }
        } 
      }}
    />
  );
}

// 🚨 FIX: Added empty props signature so TypeScript knows it accepts nothing
function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [godMode, setGodMode] = useState(false);

  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [pendingParents, setPendingParents] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [currentUsername, setCurrentUsername] = useState("");

  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error" | "info" | "warning">("info");
  const [showAlert, setShowAlert] = useState(false);
  const [waitingAlert, setWaitingAlert] = useState(false);

  const navigate = useNavigate();

  // THE V9 FIX: Polyfill directly on your real theme to prevent Context crashes!
  const theme = useTheme();
  if (theme && !(theme as any).alpha) {
    (theme as any).alpha = alpha || ((c: any) => c);
    (theme as any).lighten = lighten || ((c: any) => c);
    (theme as any).darken = darken || ((c: any) => c);
  }

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        setLoadingPending(true);
        const token = localStorage.getItem("jwtoken");
        const headers = {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        };

        const [userRes, pendingRes, pendingParentRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API}users`, { headers }),
          fetch(`${import.meta.env.VITE_API}admin/pending-teachers`, { headers }),
          fetch(`${import.meta.env.VITE_API}admin/pending-parents`, { headers })
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          const cleanUsers = userData.map((u: any) => ({ ...u, id: u._id.toString() }));
          setUsers(cleanUsers);
        }

        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingTeachers(pendingData);
        }

        if (pendingParentRes.ok) {
          const pendingParentData = await pendingParentRes.json();
          setPendingParents(pendingParentData);
        }
        
      } catch (error: any) {
        setAlertSeverity("error");
        setAlertMessage("Failed to load admin data.");
        setShowAlert(true);
      } finally {
        setLoading(false);
        setLoadingPending(false);
      }
    };
    fetchAdminData();
  }, []);

  const handleDrop = async (e: React.DragEvent, teacherUsername: string, teacherRole: string) => {
    e.preventDefault();
    const studentUsername = e.dataTransfer.getData("studentUsername");

    if (!godMode || teacherRole !== 'Teacher' || !studentUsername) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API}admin/assign-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ teacherUsername, studentUsername })
      });

      const data = await res.json();
      if (res.ok) {
        setAlertSeverity("success");
        setAlertMessage(data.message);
        setShowAlert(true);
        setUsers(prev => prev.map(u => u.username === studentUsername ? { ...u, assignedTeacher: teacherUsername } : u));
      } else {
        setAlertSeverity("error");
        setAlertMessage(data.error);
        setShowAlert(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleProcessRowUpdate = async (newRow: any, oldRow: any) => {
    if (JSON.stringify(newRow) === JSON.stringify(oldRow)) return oldRow;
    try {
      const response = await fetch(`${import.meta.env.VITE_API}admin/god-mode-edit/${newRow.id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}`, "Content-Type": "application/json" },
        body: JSON.stringify(newRow)
      });

      if (response.ok) {
        setAlertSeverity("success");
        setAlertMessage(`Updated ${newRow.username} successfully!`);
        setShowAlert(true);
        return newRow;
      } else {
        throw new Error("Failed to save changes.");
      }
    } catch (error) {
      setAlertSeverity("error");
      setAlertMessage("God Mode Edit Failed.");
      setShowAlert(true);
      return oldRow;
    }
  };

  const handleTeacherAction = async (id: string, action: "verify" | "reject") => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}admin/${action}-teacher/${id}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setPendingTeachers(prev => prev.filter(t => t._id !== id));
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isVerifiedStaff: action === 'verify' } : u));
        setAlertSeverity("success");
        setAlertMessage(`Teacher ${action === "verify" ? "approved" : "rejected"}.`);
        setShowAlert(true);
      }
    } catch (error) {
      setAlertSeverity("error");
      setShowAlert(true);
    }
  };

  const handleParentAction = async (id: string, action: "verify" | "reject") => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}admin/${action}-parent/${id}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setPendingParents(prev => prev.filter(p => p._id !== id));
        setUsers(prev => prev.map(u => u._id === id ? { ...u, isVerifiedParent: action === 'verify' } : u));
        setAlertSeverity("success");
        setAlertMessage(`Parent account ${action === "verify" ? "verified" : "rejected"}.`);
        setShowAlert(true);
      }
    } catch (error) {
      setAlertSeverity("error");
      setShowAlert(true);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!window.confirm(`Permanently delete @${username}?`)) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API}user/${username}`, { method: "DELETE" });
      if (response.ok) {
        setUsers(users.filter((u) => u.id !== id));
        setAlertSeverity("success");
        setAlertMessage("User deleted.");
        setShowAlert(true);
      }
    } catch (error) {
      setAlertSeverity("error");
      setShowAlert(true);
    }
  };

  const handleToggleTeam = async (username: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}user/toggle-team/${username}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertSeverity("success");
        setAlertMessage(data.message);
        setShowAlert(true);
        setUsers(prev => prev.map(u => u.username === username ? { ...u, isCuTeTeam: data.isCuTeTeam } : u));
      }
    } catch (err) {
      setAlertSeverity("error");
      setAlertMessage("Team toggle failed.");
      setShowAlert(true);
    }
  };

  const handleToggleCounselor = async (username: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}api/admin/toggle-counselor/${username}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertSeverity("success");
        setAlertMessage(data.message);
        setShowAlert(true);
        // Instantly update the UI without reloading
        setUsers(prev => prev.map(u => u.username === username ? { ...u, isCounselor: data.isCounselor } : u));
      }
    } catch (err) {
      setAlertSeverity("error");
      setAlertMessage("Counselor toggle failed.");
      setShowAlert(true);
    }
  };

  const handleToggleBan = async (username: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}user/toggle-ban/${username}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertSeverity("warning");
        setAlertMessage(data.message);
        setShowAlert(true);
        setUsers(prev => prev.map(u => u.username === username ? { ...u, isBanned: data.isBanned } : u));
      }
    } catch (err) {
      setAlertMessage("Ban toggle failed.");
      setShowAlert(true);
    }
  };

  const handleAdminToggleRequest = async (username: string, isAdmin: boolean) => {
    try {
      setWaitingAlert(true);
      const response = await fetch(`${import.meta.env.VITE_API}generate-otp-bro`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, isAdmin }),
      });
      setWaitingAlert(false);
      if (response.ok) {
        setCurrentUsername(username);
        setOtpValue("");
        setOpen(true);
      } else {
        const data = await response.json();
        setAlertMessage(data.message || "Failed to generate OTP.");
        setAlertSeverity("error");
        setShowAlert(true);
      }
    } catch (error) {
      setWaitingAlert(false);
      setAlertSeverity("error");
      setShowAlert(true);
    }
  };

  const handleOtpVerification = async (finalOtp: string) => {
    const token = localStorage.getItem("jwtoken");
    try {
      const res = await fetch(`${import.meta.env.VITE_API}verify-bigbro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ username: currentUsername, otp: finalOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        setOpen(false);
        setAlertSeverity("success");
        setAlertMessage(data.message);
        setShowAlert(true);
        setTimeout(() => window.location.reload(), 1500); 
      } else {
        setAlertSeverity("error");
        setAlertMessage(data.error || data.message || "Invalid OTP");
        setShowAlert(true);
      }
    } catch (err) {
      setAlertSeverity("error");
      setAlertMessage("Network error during verification");
      setShowAlert(true);
    }
  };

  const columns: GridColDef[] = [
    { field: "name", headerName: "Full Name", flex: 1.2, minWidth: 150, editable: godMode },
    { field: "username", headerName: "Username", flex: 1, minWidth: 120, editable: godMode },
    { field: "email", headerName: "Email", flex: 1.5, minWidth: 200, editable: godMode },
    { 
      field: "role", headerName: "Role", width: 120,
      renderCell: (params) => (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          params.value === 'Student' ? 'bg-blue-100 text-blue-700' : params.value === 'Parent' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {params.value || 'User'}
        </span>
      )
    },
    { 
    field: "statusInfo", headerName: "Verified / Assigned To", width: 220, 
    renderCell: (params) => {
      const isTeacher = params.row.role === 'Teacher';
      const isStudent = params.row.role === 'Student';
      const isParent = params.row.role === 'Parent'; 
      const isVerifiedStaff = params.row.isVerifiedStaff;
      const isVerifiedParent = params.row.isVerifiedParent; 
      const assignedTeacher = params.row.assignedTeacher;

      const toggleStaffVerification = async (e: any) => {
        e.stopPropagation();
        if (!godMode) return;
        const updatedRow = { ...params.row, isVerifiedStaff: !isVerifiedStaff };
        await handleProcessRowUpdate(updatedRow, params.row);
        setUsers(prev => prev.map(u => u._id === params.row._id ? updatedRow : u));
      };

      const toggleParentVerification = async (e: any) => {
        e.stopPropagation();
        if (!godMode) return;
        const updatedRow = { ...params.row, isVerifiedParent: !isVerifiedParent };
        await handleProcessRowUpdate(updatedRow, params.row);
        setUsers(prev => prev.map(u => u._id === params.row._id ? updatedRow : u));
      };

      const handleUnassign = async (e: any) => {
        e.stopPropagation();
        try {
          const res = await fetch(`${import.meta.env.VITE_API}admin/unassign-student/${params.row.username}`, {
            method: "PUT", headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
          });
          if (res.ok) {
            setUsers(prev => prev.map(u => u.username === params.row.username ? { ...u, assignedTeacher: "" } : u));
            setAlertSeverity("info");
            setAlertMessage(`Student @${params.row.username} is now unassigned.`);
            setShowAlert(true);
          }
        } catch (err) {
          console.error("Failed to unassign.");
        }
      };

      return (
        <div className="flex items-center gap-3 h-full w-full">
          {isTeacher && (
            <IconButton onClick={toggleStaffVerification} size="small" style={{ color: isVerifiedStaff ? '#10b981' : '#ef4444', opacity: godMode ? 1 : 0.4 }}>
              {isVerifiedStaff ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}
            </IconButton>
          )}

          {isParent && (
            <IconButton onClick={toggleParentVerification} size="small" style={{ color: isVerifiedParent ? '#10b981' : '#ef4444', opacity: godMode ? 1 : 0.4 }}>
              {isVerifiedParent ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}
            </IconButton>
          )}

          {isStudent && (
            <div className="flex items-center gap-2 group">
              <span className={`text-[11px] font-bold ${assignedTeacher ? 'text-brand-blue' : 'text-slate-300'}`}>
                {assignedTeacher ? `🎓 @${assignedTeacher}` : "—"}
              </span>
              
              {godMode && assignedTeacher && (
                <Tooltip title="Unassign Student">
                  <IconButton onClick={handleUnassign} size="small" sx={{ padding: '2px', color: '#94a3b8', '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' } }}>
                    <CancelIcon sx={{ fontSize: 14 }} /> 
                  </IconButton>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      );
    }
  },
    { field: "isAdmin", headerName: "Admin", width: 80, renderCell: (params) => params.value ? <ShieldIcon sx={{ fontSize: 18, color: '#10b981' }} /> : <span className="text-xs text-gray-300">NO</span> },
    { field: "isCuTeTeam", headerName: "Team", width: 80, renderCell: (params) => (<span className={`text-[10px] font-bold ${params.value ? 'text-brand-blue' : 'text-slate-300'}`}>{params.value ? "YES" : "NO"}</span>) },
   { field: "isCounselor", headerName: "Counselor", width: 90, renderCell: (params) => (<span className={`text-[10px] font-bold ${params.value ? 'text-[#ed7f23]' : 'text-slate-300'}`}>{params.value ? "YES" : "NO"}</span>) },
    { field: "isBanned", headerName: "Banned", width: 80, renderCell: (params) => (<span className={`text-[10px] font-bold ${params.value ? 'text-red-600' : 'text-green-600'}`}>{params.value ? "YES" : "NO"}</span>) },
    {
      field: "actions",
      headerName: "Actions",
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <div className="flex items-center gap-1 h-full">
          {params.row.role === "Student" && (
            <IconButton onClick={() => navigate(`/update-report/${params.row.username}`)} size="small" sx={{ color: '#1765a4' }}><AssignmentIcon fontSize="small" /></IconButton>
          )}
          <Tooltip title="Toggle Team Status"><IconButton onClick={() => handleToggleTeam(params.row.username)} size="small" sx={{ color: params.row.isCuTeTeam ? '#1765a4' : '#cbd5e1' }}><WorkspacePremiumIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Toggle Ban"><IconButton onClick={() => handleToggleBan(params.row.username)} size="small" sx={{ color: params.row.isBanned ? '#10b981' : '#ef4444' }}><BlockIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Toggle Counselor"><IconButton onClick={() => handleToggleCounselor(params.row.username)} size="small" sx={{ color: params.row.isCounselor ? '#ed7f23' : '#cbd5e1' }}><SupportAgentIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Toggle Admin"><IconButton onClick={() => handleAdminToggleRequest(params.row.username, params.row.isAdmin)} size="small" color={params.row.isAdmin ? "warning" : "success"}>{params.row.isAdmin ? <RemoveCircleIcon fontSize="small" /> : <AddCircleIcon fontSize="small" />}</IconButton></Tooltip>
          <Tooltip title="Delete User"><IconButton onClick={() => handleDelete(params.row.id, params.row.username)} size="small" color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </div>
      ),
    },
  ];

  // 🚨 THE V9 FIX: Passed props and wrapped in useCallback so the Search Bar doesn't lose focus!
  const CustomToolbar = useCallback((props: any) => {
    return (
      <Toolbar {...props} className="flex items-center px-10 py-6 border-b border-gray-100 bg-gray-50/50 w-full">
      
      {/* 1. LEFT: Title */}
      <div className="flex-1">
        <h2 className="text-2xl px-3 font-display font-bold text-brand-blue tracking-tight">
          User Management
        </h2>
      </div>

      {/* 2. MIDDLE: Controls with Gap and Pulse */}
      <div className="flex-1 flex justify-center items-center gap-8">
        <div 
          className={`px-4 py-1 rounded-full border-2 transition-all duration-500 flex items-center ${
            godMode ? 'god-pulse-active' : 'border-transparent bg-white/50'
          }`}
        >
          <FormControlLabel
            control={
              <Switch 
                checked={godMode} 
                onChange={(e) => setGodMode(e.target.checked)} 
                color="error" 
                size="small"
              />
            }
            label={
              <span className={`font-black tracking-widest text-[10px] ${godMode ? 'text-red-600' : 'text-slate-400'}`}>
                GOD MODE
              </span>
            }
            sx={{ margin: 0 }}
          />
        </div>

        <button 
          onClick={() => setIsBroadcastOpen(true)}
          className="bg-brand-orange text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-orange/10"
        >
          <Megaphone size={16} strokeWidth={3} />
          <span className="text-xs uppercase tracking-wider">Broadcast</span>
        </button>
      </div>

      {/* 3. RIGHT: Search */}
      <div className="flex-1 flex justify-end">
        <AdminGridSearch />
      </div>

    </Toolbar>
    );
  }, [godMode]);

  return (
    <div className="flex flex-col gap-6 h-full w-full">
      <style>{`
        @keyframes god-pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 0.5); background-color: rgba(239, 68, 68, 0.05); }
          70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 0.8); background-color: rgba(239, 68, 68, 0.1); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 0.5); background-color: rgba(239, 68, 68, 0.05); }
        }
        .god-pulse-active { animation: god-pulse 2s infinite !important; border-style: solid !important; }
      `}</style>

      {/* Pending TEACHER Approvals */}
      {(pendingTeachers.length > 0 || loadingPending) && (
        <div className="animate-fade-in-down bg-white shadow-xl border border-gray-100 rounded-3xl p-6">
          <h2 className="text-lg font-black text-brand-blue mb-4 flex items-center gap-2">
            <span className="bg-orange-100 text-brand-orange w-7 h-7 rounded-full flex items-center justify-center text-xs">{pendingTeachers.length}</span>
            Pending Staff Approvals
          </h2>
          {loadingPending ? <div className="flex justify-center p-4"><Loader2 className="animate-spin text-brand-orange" /></div> : (
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {pendingTeachers.map((teacher) => (
                <div key={teacher._id} className="min-w-70 flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src={teacher.photo || "https://via.placeholder.com/40"} className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-orange-100" alt="avatar" />
                    <div className="overflow-hidden">
                      <p className="font-bold text-brand-blue text-sm truncate">{teacher.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium truncate">@{teacher.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton onClick={() => handleTeacherAction(teacher._id, "reject")} size="small" color="error"><CancelIcon fontSize="small" /></IconButton>
                    <IconButton onClick={() => handleTeacherAction(teacher._id, "verify")} size="small" color="success"><CheckCircleIcon fontSize="small" /></IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending PARENT Approvals */}
      {(pendingParents.length > 0 || loadingPending) && (
        <div className="animate-fade-in-down bg-white shadow-xl border border-gray-100 rounded-3xl p-6">
          <h2 className="text-lg font-black text-rose-500 mb-4 flex items-center gap-2">
            <span className="bg-rose-100 text-rose-600 w-7 h-7 rounded-full flex items-center justify-center text-xs">{pendingParents.length}</span>
            Pending Parent Verifications
          </h2>
          {loadingPending ? <div className="flex justify-center p-4"><Loader2 className="animate-spin text-rose-500" /></div> : (
            <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
              {pendingParents.map((parent) => (
                <div key={parent._id} className="min-w-70 flex items-center justify-between p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                  <div className="flex items-center gap-3">
                    <img src={parent.photo || "https://via.placeholder.com/40"} className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-rose-200" alt="avatar" />
                    <div className="overflow-hidden">
                      <p className="font-bold text-rose-700 text-sm truncate">{parent.name}</p>
                      <p className="text-[10px] text-rose-400 font-medium truncate">@{parent.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton onClick={() => handleParentAction(parent._id, "reject")} size="small" sx={{ color: '#ef4444' }}><CancelIcon fontSize="small" /></IconButton>
                    <IconButton onClick={() => handleParentAction(parent._id, "verify")} size="small" sx={{ color: '#10b981' }}><CheckCircleIcon fontSize="small" /></IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="animate-fade-in-up h-[80vh] w-full bg-white shadow-xl border border-gray-100 rounded-3xl overflow-hidden flex flex-col">
        <DataGrid
          rows={users}
          columns={columns}
          loading={loading}
          getRowId={(row) => row._id} 
          disableRowSelectionOnClick
          
          
          slots={{ toolbar: CustomToolbar }}
          showToolbar
          
          processRowUpdate={handleProcessRowUpdate}
          getRowClassName={(params) => (godMode && params.row.role === 'Student' ? 'student-draggable' : '')}
          slotProps={{
            row: {
              draggable: godMode,
              onDragStart: (e: any) => {
                const rowId = e.currentTarget.dataset.id;
                const row = users.find(u => u._id === rowId);
                if (row?.role === 'Student') e.dataTransfer.setData("studentUsername", row.username);
              },
              onDragEnter: (e: any) => {
                const rowId = e.currentTarget.dataset.id;
                const row = users.find(u => u._id === rowId);
                if (godMode && row?.role === 'Teacher') e.currentTarget.classList.add('teacher-drop-zone');
              },
              onDragOver: (e: any) => e.preventDefault(),
              onDragLeave: (e: any) => e.currentTarget.classList.remove('teacher-drop-zone'),
              onDrop: (e: any) => {
                e.currentTarget.classList.remove('teacher-drop-zone');
                const rowId = e.currentTarget.dataset.id;
                const row = users.find(u => u._id === rowId);
                handleDrop(e, row?.username, row?.role);
              }
            }
          }}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8fafc', fontWeight: '900' } }}
        />
      </div>

      {/* OTP Dialog */}
      <Dialog 
        open={open} 
        onClose={(e, reason) => { if (reason !== "backdropClick") setOpen(false); }} 
        slotProps={{ paper: { style: { padding: "40px", borderRadius: "24px", textAlign: "center" } } }}
      >
        <DialogContent>
          <ShieldIcon sx={{ fontSize: 48, color: '#ef4444', mb: 2 }} />
          <h3 className="text-2xl font-display font-bold text-brand-blue mb-2">Security Verification</h3>
          <p className="text-sm text-gray-500 mb-8">Enter the code from your Admin Security Email to proceed.</p>
          
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                id={`otp-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpValue[index] || ""}
                autoFocus={index === 0}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
                  if (pasteData) {
                    setOtpValue(pasteData);
                    if (pasteData.length === 4) handleOtpVerification(pasteData);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ""); 
                  if (!val && e.target.value !== "") return; 
                  
                  const otpArray = otpValue.split("");
                  otpArray[index] = val;
                  const newOtp = otpArray.join("");
                  setOtpValue(newOtp);

                  if (val && index < 3) {
                    const nextInput = document.getElementById(`otp-input-${index + 1}`);
                    if (nextInput) nextInput.focus();
                  }

                  if (newOtp.length === 4) {
                    handleOtpVerification(newOtp);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otpValue[index] && index > 0) {
                    const prevInput = document.getElementById(`otp-input-${index - 1}`);
                    if (prevInput) prevInput.focus();
                  }
                }}
                className="w-14 h-14 text-center text-2xl font-black text-brand-blue bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-brand-blue focus:bg-blue-50 transition-all shadow-sm"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {showAlert && <Muialert message={alertMessage} severity={alertSeverity} onClose={() => setShowAlert(false)} />}
      {waitingAlert && <Muialert message="Sending OTP..." severity="info" onClose={() => setWaitingAlert(false)} />}

        <BroadcastModal 
          isOpen={isBroadcastOpen} 
          onClose={() => setIsBroadcastOpen(false)} 
        />
    </div>
  );
}

export default Admin;