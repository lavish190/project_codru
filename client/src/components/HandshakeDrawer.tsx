import React, { useState, useEffect } from "react";
import { Loader2, Check, X, Calendar, Sparkles, ChevronRight, MessageCircleHeart } from "lucide-react";
import Muialert from "./Muialert";
import { socket } from '../socket';
import { optimizeImage } from "../utils/image";

const HandshakeDrawer = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alertInfo, setAlertInfo] = useState({ show: false, message: "", severity: "success" as any });
  const username = localStorage.getItem("Username");

  // Quietly check for requests in the background
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}inbox/requests`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRequests(data);
        }
      } catch (err) {
        console.error("Failed to fetch connection requests quietly.");
      }
    };
    
    // Initial fetch on load
    fetchRequests();
    
    // Fallback: Poll every 60 seconds
    const interval = setInterval(fetchRequests, 60000);

    // 🚨 SHARED SOCKET SETUP
    if (username) {
      socket.emit("join", username); // Make sure they are in their room

      const handleNewRequest = () => {
        console.log("⚡ Socket signal received! You have a new request.");
        fetchRequests(); // Instantly pull the new request from the DB!
      };

      socket.on("new-connection-request", handleNewRequest);

      // Cleanup when component unmounts
      return () => {
        clearInterval(interval);
        socket.off("new-connection-request", handleNewRequest); // 🚨 ONLY turn off listener, don't disconnect!
      };
    }

    return () => clearInterval(interval);
  }, [username]);

  const handleResponse = async (id: string, status: "accepted" | "declined") => {
    setActionLoading(id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}inbox/respond/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` 
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        // 1. Instantly hide the ribbon by filtering it out of your local state!
        // (Note: Change 'setRequests' to whatever you named your state variable, e.g., setPendingRequests)
        setRequests((prev) => prev.filter((req) => req._id !== id));

        // 2. 🚨 THE MAGIC SIGNAL: If accepted, tell the Chat Portal to wake up and fetch!
        if (status === "accepted") {
          window.dispatchEvent(new Event("refresh-communication-circle"));
        }
      } else {
        console.error("Backend refused to update status.");
      }
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      // 3. Turn off the loading spinner for this specific button
      setActionLoading(null);
    }
  };

  // 🚨 THE MAGIC: If there are no requests, render absolutely nothing!
  if (requests.length === 0) return null;

  return (
    <>
      {/* 1. THE SURPRISE PULL-TAB (Fixed to the right edge) */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-32 right-0 z-100 flex items-center gap-2 bg-linear-to-l from-brand-blue to-blue-600 text-white pl-4 pr-3 py-3 rounded-l-2xl shadow-[-8px_0_20px_rgba(23,101,164,0.3)] hover:pr-5 hover:bg-blue-700 transition-all duration-300 group ${isOpen ? 'translate-x-full' : 'translate-x-0'}`}
      >
        <div className="relative">
          <Sparkles size={20} className="animate-pulse" />
          <span className="absolute -top-2 -right-2 bg-brand-orange text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-blue-600">
            {requests.length}
          </span>
        </div>
        <span className="font-bold text-sm tracking-wide group-hover:pl-1 transition-all">New Request</span>
      </button>

      {/* 2. THE OVERLAY BACKDROP */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-101 transition-opacity"
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* 3. THE SLIDE-OUT DRAWER */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-102 border-l border-slate-100 flex flex-col transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center">
              <MessageCircleHeart size={20} />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-slate-800">Connection Requests</h2>
              <p className="text-xs text-slate-500 font-medium">{requests.length} community members waiting</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {requests.map((req) => (
            <div key={req._id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
              {/* Decorative accent line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-brand-orange to-brand-blue" />
              
              <div className="flex items-center gap-3 mb-4">
                <img src={optimizeImage(req.sender?.photo) || "https://via.placeholder.com/150"} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-100" />
                <div>
                  <h3 className="text-base font-bold text-slate-800 leading-tight">{req.sender?.name}</h3>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block ${
                    req.sender?.role === 'Teacher' ? 'bg-orange-50 text-brand-orange' :
                    req.sender?.role === 'Student' ? 'bg-blue-50 text-brand-blue' :
                    req.sender?.role === 'Parent' ? 'bg-rose-50 text-rose-500' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {req.sender?.role || "User"}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Their Message</p>
                <p className="text-slate-700 text-sm leading-relaxed italic">"{req.message}"</p>
              </div>

              {req.meetingDate && (
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-brand-blue bg-blue-50/50 py-2 px-3 rounded-xl">
                  <Calendar size={14} /> 
                  Proposed: {new Date(req.meetingDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}

              <div className="flex gap-2 mt-5">
                <button 
                  onClick={() => handleResponse(req._id, "declined")}
                  disabled={actionLoading === req._id}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 text-slate-500 bg-slate-100 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                >
                  <X size={16} /> Decline
                </button>
                <button 
                  onClick={() => handleResponse(req._id, "accepted")}
                  disabled={actionLoading === req._id}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 text-white bg-brand-blue hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all active:scale-95"
                >
                  {actionLoading === req._id ? <Loader2 className="animate-spin" size={16} /> : <><Check size={16} /> Accept</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {alertInfo.show && <Muialert message={alertInfo.message} severity={alertInfo.severity} onClose={() => setAlertInfo({ ...alertInfo, show: false })} />}
    </>
  );
};

export default HandshakeDrawer;