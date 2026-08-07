import React, { useState, useEffect, useCallback } from "react";
import { DataGrid, GridColDef, Toolbar, useGridApiContext } from "@mui/x-data-grid";
import { 
  Dialog, DialogContent, IconButton, Tooltip, FormControl, InputLabel, 
  Select, MenuItem, TextField, InputAdornment, Button, Snackbar, Alert, DialogTitle, DialogActions 
} from "@mui/material";
import { CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Visibility as VisibilityIcon } from "@mui/icons-material";
import { FileText, Search, Award, Calendar, AlertTriangle, Plus, Printer, CheckCheck, Loader2 } from "lucide-react";
import dayjs from "dayjs";

function AdminGridSearch() {
  const apiRef = useGridApiContext();
  return (
    <TextField
      placeholder="Search directory..." size="small" variant="outlined"
      onChange={(event) => {
        const searchWords = event.target.value.split(' ').filter((word) => word !== '');
        apiRef.current.setQuickFilterValues(searchWords);
      }}
      slotProps={{
        input: { startAdornment: ( <InputAdornment position="start"><Search size={16} className="text-gray-400" /></InputAdornment> ) }
      }}
      sx={{ 
        width: "100%", maxWidth: "300px",
        '& .MuiOutlinedInput-root': { borderRadius: '14px', bgcolor: 'white', marginRight: '8px', '& fieldset': { borderColor: '#e2e8f0' } } 
      }}
    />
  );
}

// 🚨 UPDATED INTERFACE: Synced completely with your MongoDB schema
interface Application {
  _id: string; status: string; resumeDriveLink: string; step: number; 
  printStatus: "Not Printed" | "Printed" | "Given";
  personalDetails: { name: string; email: string; phone: string; whatsapp?: string; sameAsWhatsapp?: boolean };
  programDetails: { type: string; topic: string; durationDays: number; startDate: string; endDate: string; intent?: string; mode?: string; price?: number };
  completionDetails?: { rollNo: string; programCode: string; projectTitle: string; projectDescription: string; grade: string; barcodeStr: string };
  feedback?: { rating: number; majorLearnings: string; generalFeedback: string; futureInterest: string };
  createdAt: string;
}

interface ProgramIndex {
  _id: string; topic: string; type: string; code: string;
}

export default function AdminInternships() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [programIndexes, setProgramIndexes] = useState<ProgramIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const [certModalOpen, setCertModalOpen] = useState(false);
  const [grade, setGrade] = useState("A");
  const [rollNo, setRollNo] = useState(""); 
  const [programCode, setProgramCode] = useState(""); 
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [newIndexData, setNewIndexData] = useState({ topic: "", type: "Internship", code: "" });

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" as "success"|"error"|"warning"|"info" });
  const [confirmConfig, setConfirmConfig] = useState({ open: false, title: "", message: "", onConfirm: () => {} });

  const showMessage = (message: string, severity: "success"|"error"|"warning"|"info" = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const sortApplications = (apps: Application[]) => {
    return [...apps].sort((a, b) => {
      const getPriority = (status: string) => {
        if (status === "feedback_submitted") return 1; 
        if (status === "pending") return 2;
        if (status === "approved") return 3;
        return 4; 
      };
      
      const priorityDiff = getPriority(a.status) - getPriority(b.status);
      if (priorityDiff !== 0) return priorityDiff;
      return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
    });
  };

  useEffect(() => { 
    fetchApplications(); 
    fetchIndexes();
  }, []);

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/all`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setApplications(sortApplications(data));
    } catch (error) { 
      showMessage("Failed to fetch applications", "error"); 
    } 
    finally { setLoading(false); }
  };

  const fetchIndexes = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/program-indexes`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setProgramIndexes(data);
    } catch (error) { console.error(error); }
  };

  const createNewIndex = async () => {
    if (!newIndexData.topic || !newIndexData.code) return showMessage("Fill all index fields!", "warning");
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/program-indexes`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newIndexData)
      });
      const data = await res.json();
      if (res.ok) {
        setProgramIndexes([...programIndexes, data]);
        setProgramCode(data.code);
        setIsCreatingIndex(false);
        setNewIndexData({ topic: "", type: "Internship", code: "" });
        showMessage("New index code created successfully!", "success");
      } else showMessage(data.error, "error");
    } catch (error) { showMessage("Network error while creating index", "error"); }
  };

  const triggerApprove = (id: string) => {
    setConfirmConfig({
      open: true,
      title: "Approve Applicant",
      message: "Are you sure you want to APPROVE this applicant and send the Offer Letter?",
      onConfirm: () => executeApprove(id)
    });
  };

  const executeApprove = async (id: string) => {
    setConfirmConfig({ ...confirmConfig, open: false });
    setProcessingId(id);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/approve/${id}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      
      if (res.ok) {
        setApplications((prev) => sortApplications(prev.map((app) => app._id === id ? { ...app, status: "approved" } : app)));
        showMessage("Approved and Offer Letter sent!", "success");
      } else {
        showMessage(data.error || "Failed to approve application", "error");
      }
    } catch (error) { 
      showMessage("Network error. Database was NOT changed.", "error"); 
    } 
    finally { setProcessingId(null); }
  };

  const triggerReject = (id: string) => {
    const app = applications.find(a => a._id === id);
    if (app) {
      setSelectedApp(app);
      setRejectionReason("");
      setRejectModalOpen(true);
    }
  };

  const submitRejection = async () => {
    if (!selectedApp) return;
    setProcessingId(selectedApp._id);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/reject/${selectedApp._id}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: rejectionReason })
      });
      const data = await res.json();
      
      if (res.ok) {
        setApplications((prev) => sortApplications(prev.map((app) => app._id === selectedApp._id ? { ...app, status: "rejected" } : app)));
        setRejectModalOpen(false);
        showMessage("Applicant rejected successfully.", "info");
      } else {
        showMessage(data.error || "Failed to reject", "error");
      }
    } catch (error) { 
      showMessage("Network error.", "error"); 
    } 
    finally { setProcessingId(null); }
  };

  const handleTogglePrintStatus = async (id: string, currentStatus: string) => {
    let nextStatus = "Printed";
    if (currentStatus === "Printed") nextStatus = "Given";
    if (currentStatus === "Given") nextStatus = "Not Printed";

    setProcessingId(id);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/update-print-status/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ printStatus: nextStatus })
      });
      
      const data = await res.json();
      if (res.ok) {
        setApplications((prev) => prev.map((app) => app._id === id ? { ...app, printStatus: nextStatus as any } : app));
        showMessage(`Status updated to ${nextStatus}`, "success");
      } else {
        showMessage(data.error || "Failed to update print status", "error");
      }
    } catch (error) {
      showMessage("Network error.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const generateBarcodeString = (app: Application | null) => {
    if (!app || !rollNo || !programCode) return "FILL_FIELDS";
    return `${dayjs(app.programDetails.startDate).format("DDMM")}-${rollNo}${app.programDetails.durationDays}-${programCode}${grade}-${dayjs(app.programDetails.endDate).format("YY")}`;
  };

  const triggerCompletion = () => {
    if (!selectedApp || !rollNo || !programCode || !projectTitle) {
      return showMessage("Please fill S.No, Code, and Project Title.", "warning");
    }
    const barcodeStr = generateBarcodeString(selectedApp);
    
    setConfirmConfig({
      open: true,
      title: "Generate Certificate",
      message: `Generate and email the certificate with Barcode: ${barcodeStr}?`,
      onConfirm: () => executeCompletion(barcodeStr)
    });
  };

  const executeCompletion = async (barcodeStr: string) => {
    setConfirmConfig({ ...confirmConfig, open: false });
    if (!selectedApp) return;
    setProcessingId(selectedApp._id);
    
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}internship/admin/complete/${selectedApp._id}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ grade, rollNo, programCode, projectTitle, projectDescription, barcodeStr })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setApplications((prev) => sortApplications(prev.map((app) => app._id === selectedApp._id ? { ...app, status: "completed" } : app)));
        setCertModalOpen(false);
        showMessage("Certificate Generated and Sent! 🎉", "success");
      } else {
        showMessage(`Failed: ${data.error || "Internal Server Error"}`, "error");
      }
    } catch (error) { 
      showMessage("Network connection dropped. Database was NOT changed.", "error"); 
    } 
    finally { setProcessingId(null); }
  };

  const columns: GridColDef[] = [
    { 
      field: "applicant", headerName: "Applicant Info", flex: 1.5, minWidth: 200,
      valueGetter: (paramsOrValue: any, row: any) => `${row?.personalDetails?.name || ''} ${row?.personalDetails?.email || ''} ${row?.personalDetails?.phone || ''}`,
      renderCell: (params) => (
        <div className="flex flex-col justify-start py-3 h-full">
          <span className="font-bold text-gray-800 leading-tight">{params.row.personalDetails?.name}</span>
          <span className="text-xs text-gray-500 mt-1">{params.row.personalDetails?.email}</span>
          <span className="text-[11px] text-gray-400 mt-1">{params.row.personalDetails?.phone}</span>
        </div>
      )
    },
    { 
      field: "program", headerName: "Program", flex: 1.2, minWidth: 150,
      valueGetter: (paramsOrValue: any, row: any) => row?.programDetails?.topic || "",
      renderCell: (params) => (
        <div className="flex flex-col justify-start py-3 h-full">
          <span className="font-semibold text-brand-blue capitalize leading-tight">{params.row.programDetails?.topic}</span>
        </div>
      )
    },
    { 
      field: "startDate", headerName: "Timeline", flex: 1.2, minWidth: 160,
      valueGetter: (paramsOrValue: any, row: any) => row?.programDetails?.startDate || "",
      renderCell: (params) => {
        const start = params.row.programDetails?.startDate;
        const days = params.row.programDetails?.durationDays;
        const type = params.row.programDetails?.type;
        return (
          <div className="flex flex-col justify-start py-3 h-full">
            <span className="font-bold text-gray-700 flex items-center gap-1.5 leading-tight">
              <Calendar size={14} className="text-brand-orange" />
              {start ? dayjs(start).format("DD MMM YYYY") : "N/A"}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 mt-1.5">
              {days} Days • <span className={type?.toLowerCase() === 'training' ? 'text-blue-500' : 'text-purple-500'}>{type}</span>
            </span>
          </div>
        )
      }
    },
    { 
      field: "status", headerName: "Status", width: 220,
      renderCell: (params) => {
        const s = params.row.status;
        const ps = params.row.printStatus || "Not Printed";

        return (
          <div className="flex flex-wrap items-center gap-1.5 h-full py-3">
            {s === 'approved' && <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase shadow-sm">Approved</span>}
            {s === 'feedback_submitted' && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase shadow-sm animate-pulse">Feedback Submitted</span>}
            {s === 'rejected' && <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase shadow-sm">Rejected</span>}
            {s === 'completed' && <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-black uppercase shadow-sm">Completed</span>}
            {s === 'pending' && <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase shadow-sm">Pending</span>}
            
            {ps === "Printed" && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase flex items-center gap-1 border border-blue-200">
                <Printer size={10} /> Printed
              </span>
            )}
            {ps === "Given" && (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase flex items-center gap-1 border border-emerald-200">
                <CheckCheck size={10} strokeWidth={3} /> Given
              </span>
            )}
          </div>
        );
      }
    },
    {
      field: "actions", headerName: "Actions", width: 220, sortable: false,
      renderCell: (params) => {
        const isProcessing = processingId === params.row._id;
        
        const currentPrintStatus = params.row.printStatus || "Not Printed";
        let nextStatus = "Printed";
        if (currentPrintStatus === "Printed") nextStatus = "Given";
        if (currentPrintStatus === "Given") nextStatus = "Not Printed";

        return (
          <div className="flex items-center gap-2 h-full">
            <Tooltip title="View All Details">
              <IconButton 
                onClick={() => { setSelectedApp(params.row); setDetailsModalOpen(true); }} 
                size="small" 
                sx={{ color: '#64748b', bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a' } }}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {params.row.status === "pending" && (
              <>
                <Tooltip title="Approve & Send Offer">
                  <IconButton onClick={() => triggerApprove(params.row._id)} disabled={isProcessing} size="small" sx={{ color: '#10b981', bgcolor: '#ecfdf5', '&:hover': { bgcolor: '#d1fae5' } }}>
                    {isProcessing ? <Loader2 size={16} className="animate-spin text-green-500" /> : <CheckCircleIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reject & Cooldown">
                  <IconButton onClick={() => triggerReject(params.row._id)} disabled={isProcessing} size="small" sx={{ color: '#ef4444', bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}>
                    <CancelIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            
            {(params.row.status === "approved" || params.row.status === "feedback_submitted") && (
              <Tooltip title={params.row.status === "approved" ? "Waiting for student to submit feedback..." : "Student requested certificate! Click to certify."}>
                <span>
                  <button 
                    onClick={() => { 
                      setSelectedApp(params.row); 
                      
                      // 🚨 NEW: Count ONLY completed applications and add 1
                      const completedCount = applications.filter(a => a.status === "completed").length;
                      setRollNo((completedCount + 1).toString());
                      
                      setCertModalOpen(true); 
                    }} 
                    disabled={isProcessing || params.row.status === "approved"} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-md ${
                      params.row.status === "feedback_submitted" 
                        ? 'bg-purple-600 text-white hover:bg-purple-700 ring-2 ring-purple-300 animate-pulse' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Award size={14} /> Certify
                  </button>
                </span>
              </Tooltip>
            )}

            {params.row.status === "completed" && (
              <Tooltip title={`Current: ${currentPrintStatus} (Click to mark as ${nextStatus})`}>
                <IconButton 
                  onClick={() => handleTogglePrintStatus(params.row._id, currentPrintStatus)} 
                  disabled={isProcessing}
                  size="small" 
                  sx={{ 
                    color: currentPrintStatus === 'Given' ? '#10b981' : currentPrintStatus === 'Printed' ? '#2563eb' : '#94a3b8', 
                    bgcolor: currentPrintStatus === 'Given' ? '#ecfdf5' : currentPrintStatus === 'Printed' ? '#eff6ff' : '#f1f5f9', 
                    '&:hover': { bgcolor: currentPrintStatus === 'Given' ? '#d1fae5' : currentPrintStatus === 'Printed' ? '#dbeafe' : '#e2e8f0' } 
                  }}
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin text-gray-400" /> : currentPrintStatus === 'Given' ? <CheckCheck size={16} strokeWidth={3} /> : <Printer size={16} />}
                </IconButton>
              </Tooltip>
            )}

            {params.row.status === "rejected" && (
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rejected</span>
            )}
          </div>
        );
      },
    },
  ];

  const CustomToolbar = useCallback((props: any) => {
    return (
      <Toolbar {...props} className="flex items-center px-10 py-6 border-b border-gray-100 bg-gray-50/50 w-full">
        <div className="flex-1"><h2 className="text-2xl px-3 font-display font-bold text-brand-blue tracking-tight">Internship Applications</h2></div>
        <div className="flex-1 flex justify-center items-center gap-8"></div>
        <div className="flex-1 flex justify-end"><AdminGridSearch /></div>
      </Toolbar>
    );
  }, []);

  return (
    <div className="flex flex-col gap-6 h-full w-full">
      <div className="animate-fade-in-up h-[80vh] w-full bg-white shadow-xl border border-gray-100 rounded-3xl overflow-hidden flex flex-col">
        <DataGrid
          rows={applications} columns={columns} loading={loading} getRowId={(row) => row._id} disableRowSelectionOnClick
          slots={{ toolbar: CustomToolbar }} showToolbar getRowHeight={() => 'auto'} getEstimatedRowHeight={() => 100}
          getRowClassName={(params) => (params.row.status === 'rejected' || params.row.status === 'completed') ? 'opacity-60 bg-slate-50 grayscale-[20%]' : ''}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#f8fafc', fontWeight: '900' } }}
        />
      </div>

      {/* 🚨 UPDATED DETAILS MODAL: Fully Synced with Database fields */}
      <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="md" fullWidth slotProps={{ paper: { style: { borderRadius: '24px', padding: '24px', backgroundColor: '#f8fafc' } } }}>
        <DialogContent>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-display font-bold text-gray-800">Application Record</h3>
              <p className="text-sm text-gray-500 mt-1">ID: <span className="font-mono text-xs">{selectedApp?._id}</span></p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${selectedApp?.status === 'completed' ? 'bg-purple-100 text-purple-700' : selectedApp?.status === 'approved' ? 'bg-green-100 text-green-700' : selectedApp?.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {selectedApp?.status?.replace('_', ' ')}
              </span>
              {selectedApp?.printStatus === "Printed" && <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-black uppercase flex items-center gap-1 border border-blue-200"><Printer size={12} /> Printed</span>}
              {selectedApp?.printStatus === "Given" && <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black uppercase flex items-center gap-1 border border-emerald-200"><CheckCheck size={14} strokeWidth={3} /> Given</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Personal Details</h4>
              <div className="space-y-3 text-sm">
                <p><span className="text-gray-500 w-24 inline-block">Name:</span> <span className="font-semibold text-gray-800">{selectedApp?.personalDetails?.name || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Email:</span> <span className="font-semibold text-gray-800">{selectedApp?.personalDetails?.email || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Phone:</span> <span className="font-semibold text-gray-800">{selectedApp?.personalDetails?.phone || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">WhatsApp:</span> <span className="font-semibold text-gray-800">{selectedApp?.personalDetails?.sameAsWhatsapp ? "Same as phone" : selectedApp?.personalDetails?.whatsapp || "—"}</span></p>
                <p className="pt-2">
                  <a href={selectedApp?.resumeDriveLink} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline flex items-center gap-1"><FileText size={14}/> View Original Resume PDF</a>
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Program Details</h4>
              <div className="space-y-3 text-sm">
                <p><span className="text-gray-500 w-24 inline-block">Type:</span> <span className="font-semibold text-gray-800 capitalize">{selectedApp?.programDetails?.type || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Topic:</span> <span className="font-semibold text-brand-blue">{selectedApp?.programDetails?.topic || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Intent:</span> <span className="font-semibold text-gray-800 capitalize">{selectedApp?.programDetails?.intent || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Mode:</span> <span className="font-semibold text-gray-800">{selectedApp?.programDetails?.mode || "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Price:</span> <span className="font-semibold text-gray-800">₹{selectedApp?.programDetails?.price || 0}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Duration:</span> <span className="font-semibold text-gray-800">{selectedApp?.programDetails?.durationDays ? `${selectedApp.programDetails.durationDays} Days` : "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">Start Date:</span> <span className="font-semibold text-gray-800">{selectedApp?.programDetails?.startDate ? dayjs(selectedApp.programDetails.startDate).format("DD MMM YYYY") : "—"}</span></p>
                <p><span className="text-gray-500 w-24 inline-block">End Date:</span> <span className="font-semibold text-gray-800">{selectedApp?.programDetails?.endDate ? dayjs(selectedApp.programDetails.endDate).format("DD MMM YYYY") : "—"}</span></p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Completion & Certificate Data</h4>
              {selectedApp?.completionDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <p><span className="text-gray-500 w-28 inline-block">S.No / Roll:</span> <span className="font-semibold text-gray-800">{selectedApp.completionDetails.rollNo || "—"}</span></p>
                  <p><span className="text-gray-500 w-28 inline-block">Program Code:</span> <span className="font-semibold text-gray-800">{selectedApp.completionDetails.programCode || "—"}</span></p>
                  <p><span className="text-gray-500 w-28 inline-block">Grade:</span> <span className="font-black text-brand-orange">{selectedApp.completionDetails.grade || "—"}</span></p>
                  <p><span className="text-gray-500 w-28 inline-block">Barcode:</span> <span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{selectedApp.completionDetails.barcodeStr || "—"}</span></p>
                  <div className="md:col-span-2 pt-2 border-t border-gray-50 mt-2">
                    <p><span className="text-gray-500 block mb-1">Project Title:</span> <span className="font-semibold text-gray-800 block p-2 bg-gray-50 rounded-lg">{selectedApp.completionDetails.projectTitle || "—"}</span></p>
                    <p className="mt-3"><span className="text-gray-500 block mb-1">Project Description:</span> <span className="text-gray-700 block p-2 bg-gray-50 rounded-lg text-xs leading-relaxed">{selectedApp.completionDetails.projectDescription || "—"}</span></p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">No completion data generated yet.</p>
              )}
            </div>
            
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 md:col-span-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Student Feedback</h4>
              {selectedApp?.feedback ? (
                <div className="text-sm space-y-3">
                  <p><span className="text-gray-500 w-32 inline-block">Rating:</span> <span className="font-bold text-yellow-500">{selectedApp.feedback.rating}/10</span></p>
                  <p><span className="text-gray-500 w-32 inline-block">Future Interest:</span> <span className="font-semibold text-gray-800 capitalize">{selectedApp.feedback.futureInterest || "—"}</span></p>
                  <div>
                    <span className="text-gray-500 block mb-1">Major Learnings:</span>
                    <span className="text-gray-700 block p-3 bg-gray-50 rounded-lg text-xs leading-relaxed">{selectedApp.feedback.majorLearnings || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">General Feedback:</span>
                    <span className="text-gray-700 block p-3 bg-gray-50 rounded-lg text-xs leading-relaxed">{selectedApp.feedback.generalFeedback || "—"}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic text-center py-4">No feedback provided.</p>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="contained" onClick={() => setDetailsModalOpen(false)} sx={{ borderRadius: '12px', bgcolor: '#64748b', '&:hover': { bgcolor: '#475569' }, textTransform: 'none', fontWeight: 'bold' }}>Close Details</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { style: { borderRadius: '24px', padding: '10px' } } }}>
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1f2937', pb: 1 }}>Reject Application</DialogTitle>
        <DialogContent>
          <p className="text-sm text-gray-500 mb-4">Please provide a reason for rejection. This will be emailed to the student.</p>
          <TextField 
            fullWidth multiline rows={4} variant="outlined" 
            placeholder="E.g., Missing requirements, capacity reached..." 
            value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setRejectModalOpen(false)} sx={{ color: '#64748b', fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={submitRejection} variant="contained" color="error" disabled={processingId === selectedApp?._id || !rejectionReason} sx={{ borderRadius: '10px', fontWeight: 'bold' }}>
            {processingId === selectedApp?._id ? <Loader2 size={16} className="animate-spin" /> : "Confirm Rejection"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🚨 UPDATED CERTIFY MODAL: Better Spacing for form fields */}
      <Dialog open={certModalOpen} onClose={() => !processingId && setCertModalOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { style: { borderRadius: '24px', padding: '20px' } } }}>
        <DialogContent>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4"><Award className="text-purple-600 w-8 h-8" /></div>
            <h3 className="text-2xl font-display font-bold text-gray-800">Complete Internship</h3>
            <p className="text-sm text-gray-500 mt-1">Fill in the project details and generate certificate.</p>
          </div>
          
          {selectedApp && (
            <div className="flex flex-col gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm mb-1">
                <p><strong>Student:</strong> {selectedApp.personalDetails.name}</p>
                <p><strong>Topic:</strong> {selectedApp.programDetails.topic} ({selectedApp.programDetails.type})</p>
                <p><strong>Dates:</strong> {dayjs(selectedApp.programDetails.startDate).format("DD MMM YYYY")} - {dayjs(selectedApp.programDetails.endDate).format("DD MMM YYYY")}</p>
              </div>

              <TextField label="Project / Task Title" variant="outlined" size="small" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} fullWidth disabled={processingId === selectedApp._id} />
              <TextField label="Description (Optional)" variant="outlined" size="small" multiline rows={2} value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} fullWidth disabled={processingId === selectedApp._id} />

              <div className="grid grid-cols-3 gap-4">
                <TextField label="S. No / Roll No." variant="outlined" size="small" value={rollNo} onChange={(e) => setRollNo(e.target.value)} fullWidth disabled={processingId === selectedApp._id} />
                
                <FormControl size="small" fullWidth disabled={processingId === selectedApp._id}>
                  <InputLabel>Program Code</InputLabel>
                  <Select value={programCode} label="Program Code" onChange={(e) => {
                    if (e.target.value === "ADD_NEW") setIsCreatingIndex(true);
                    else setProgramCode(e.target.value as string);
                  }}>
                    {programIndexes
                      
                      .filter(idx => {
                        const appType = selectedApp?.programDetails?.type?.toLowerCase() || "";
                        if (appType === "training") return idx.code.toUpperCase().startsWith("T");
                        if (appType === "internship") return idx.code.toUpperCase().startsWith("I");
                        return true; 
                      })
                      .map(idx => (
                        <MenuItem key={idx._id} value={idx.code}>{idx.code} - {idx.topic}</MenuItem>
                      ))
                    }
                    <MenuItem value="ADD_NEW" sx={{ color: '#1765a4', fontWeight: 'bold' }}>
                      <Plus size={16} className="mr-2"/> Create New Code...
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth disabled={processingId === selectedApp._id}>
                  <InputLabel>Grade</InputLabel>
                  <Select value={grade} label="Grade" onChange={(e) => setGrade(e.target.value as string)}>
                    <MenuItem value="A">A</MenuItem><MenuItem value="B">B</MenuItem><MenuItem value="C">C</MenuItem><MenuItem value="D">D</MenuItem>
                  </Select>
                </FormControl>
              </div>

              {isCreatingIndex && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mt-2 space-y-3">
                  <p className="text-xs font-bold text-brand-blue uppercase">Create New Index Code</p>
                  <div className="flex gap-2">
                    <TextField label="Topic (e.g. Data Science)" size="small" fullWidth value={newIndexData.topic} onChange={e => setNewIndexData({...newIndexData, topic: e.target.value})} disabled={processingId === selectedApp._id} />
                    <TextField label="Code (e.g. T09)" size="small" fullWidth value={newIndexData.code} onChange={e => setNewIndexData({...newIndexData, code: e.target.value})} disabled={processingId === selectedApp._id} />
                  </div>
                  <FormControl size="small" fullWidth disabled={processingId === selectedApp._id}>
                    <Select value={newIndexData.type} onChange={e => setNewIndexData({...newIndexData, type: e.target.value})}>
                      <MenuItem value="Internship">Internship</MenuItem><MenuItem value="Training">Training</MenuItem>
                    </Select>
                  </FormControl>
                  <div className="flex gap-2 justify-end">
                    <Button size="small" onClick={() => setIsCreatingIndex(false)} disabled={processingId === selectedApp._id}>Cancel</Button>
                    <Button size="small" variant="contained" onClick={createNewIndex} disabled={processingId === selectedApp._id}>Save Code</Button>
                  </div>
                </div>
              )}

              <div className="mt-2 p-4 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1">Generated Barcode String</p>
                <p className="text-xl font-mono font-black text-gray-800 tracking-widest">{generateBarcodeString(selectedApp)}</p>
              </div>

              <button 
                onClick={triggerCompletion} 
                disabled={processingId === selectedApp._id || !rollNo || !programCode || !projectTitle} 
                className="w-full mt-2 bg-brand-orange text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600"
              >
                {processingId === selectedApp._id ? (
                  <><Loader2 size={18} className="animate-spin mr-2" /> Generating & Sending...</>
                ) : (
                  "Generate Certificate"
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog 
        open={confirmConfig.open} 
        onClose={() => setConfirmConfig({ ...confirmConfig, open: false })}
        slotProps={{ paper: { style: { borderRadius: '20px', padding: '10px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: 1 }}>
          <AlertTriangle className="text-brand-orange" /> {confirmConfig.title}
        </DialogTitle>
        <DialogContent>
          <p className="text-gray-600">{confirmConfig.message}</p>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setConfirmConfig({ ...confirmConfig, open: false })} sx={{ color: '#64748b', fontWeight: 'bold' }}>Cancel</Button>
          <Button onClick={confirmConfig.onConfirm} variant="contained" sx={{ bgcolor: '#ed7f23', '&:hover': { bgcolor: '#d97420' }, borderRadius: '10px', fontWeight: 'bold' }}>
            Confirm Action
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: '100%', borderRadius: '12px', fontWeight: 'bold' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

    </div>
  );
}