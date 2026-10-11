import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Video, Users, UserMinus, ArrowLeft, Send, Loader2, CalendarPlus, Link as LinkIcon, User } from "lucide-react";
import { socket } from '../socket';

const currentUserId = localStorage.getItem("userId"); 
const username = localStorage.getItem("Username");

const CommunicationPortal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [circle, setCircle] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Controls the Profile Slide-over
  const [showProfile, setShowProfile] = useState(false);

  // Messaging States
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scheduling States
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [meetDate, setMeetDate] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [chatHistory]);

  // Listen for notifications telling the portal to open!
  useEffect(() => {
    const handleOpenPortal = (e: any) => {
      setIsOpen(true); 
      
      if (e.detail && e.detail.connectionId) {
        setCircle((currentCircle) => {
          const targetUser = currentCircle.find(u => u.connectionId === e.detail.connectionId);
          if (targetUser) setActiveChat(targetUser);
          return currentCircle;
        });
      }
    };

    window.addEventListener('open-communication-portal', handleOpenPortal);
    return () => window.removeEventListener('open-communication-portal', handleOpenPortal);
  }, []);

  // Fetch Circle
  const fetchCircle = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}expert-connect/my-circle`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) setCircle(await res.json());
    } catch (err) { console.error(err); }
  };
  useEffect(() => { fetchCircle(); }, [isOpen]);

  // THE UNIFIED LISTENER (Local + Socket)
  useEffect(() => {
    const handleRefreshCircle = () => {
      console.log("🔄 Refreshing communication circle...");
      fetchCircle(); 
    };

    window.addEventListener('refresh-communication-circle', handleRefreshCircle);

    if (username) {
      socket.emit("join", username); 

      const handleSocketSignal = () => {
        console.log("⚡ Socket signal received! Updating chat list.");
        handleRefreshCircle();
        setIsOpen(true);
      };

      socket.on("force-refresh-circle", handleSocketSignal);

      return () => {
        window.removeEventListener('refresh-communication-circle', handleRefreshCircle);
        socket.off("force-refresh-circle", handleSocketSignal); 
      };
    }

    return () => {
      window.removeEventListener('refresh-communication-circle', handleRefreshCircle);
    };
  }, [username]);

  // Fetch Chat History
  const fetchMessages = async () => {
    if (!activeChat) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API}expert-connect/messages/${activeChat.connectionId}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      if (res.ok) setChatHistory(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); 
    return () => clearInterval(interval);
  }, [activeChat]);

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageText.trim() || !activeChat) return;

    setIsSending(true);
    const textToSend = messageText;
    setMessageText(""); 

    try {
      await fetch(`${import.meta.env.VITE_API}expert-connect/message/${activeChat.connectionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ text: textToSend })
      });
      await fetchMessages(); 
    } catch (error) { console.error(error); } finally { setIsSending(false); }
  };

  // Schedule Meet
  const handleScheduleMeet = async () => {
    if (!meetDate) return;
    setIsScheduling(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API}expert-connect/schedule/${activeChat.connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ meetingDate: meetDate })
      });
      
      if (res.ok) {
        const data = await res.json(); 
        
        setShowScheduleMenu(false);
        setMeetDate("");
        await fetchMessages(); 
        await fetchCircle(); 
        
        setActiveChat({ 
          ...activeChat, 
          meetingDate: data.meetingDate, 
          meetingLink: data.meetingLink 
        });
      }
    } catch (error) { console.error(error); } finally { setIsScheduling(false); }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    if (!activeChat || !window.confirm(`Are you sure you want to disconnect with ${activeChat.name}?`)) return;
    
    const safeConnectionId = typeof activeChat.connectionId === "object" 
      ? (activeChat.connectionId._id || activeChat.connectionId.toString()) 
      : activeChat.connectionId;

    setIsDisconnecting(true);
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API}expert-connect/disconnect/${safeConnectionId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` }
      });
      
      if (res.ok) {
        setCircle(prev => prev.filter(c => c.connectionId !== safeConnectionId && c.connectionId?._id !== safeConnectionId));
        window.dispatchEvent(new Event('refresh-communication-circle'));
        setActiveChat(null); 
        setShowProfile(false);
        if (circle.length === 1) setIsOpen(false); 
      } else {
        console.error("Backend refused the disconnect request.");
      }
    } catch (error) { 
      console.error("Disconnect Error:", error); 
    } finally { 
      setIsDisconnecting(false); 
    }
  };

  if (circle.length === 0 && !isOpen) return null;

  let isMeetingActive = false;
  
  if (activeChat?.meetingDate) {
    const meetTime = new Date(activeChat.meetingDate).getTime();
    const currentTime = new Date().getTime();
    
    if (!isNaN(meetTime) && (meetTime + (60 * 60 * 1000) > currentTime)) {
      isMeetingActive = true;
    }
  }

  if (circle.length === 0 && !isOpen) return null;

  return (
    <>
      {/* 🚨 MOBILE RESPONSIVE TRIGGER BUTTON (z-[1050] to beat navbar, bottom-24 to float above it) */}
      <button onClick={() => setIsOpen(true)} className={`fixed bottom-24 md:bottom-8 right-4 md:right-8 z-[1050] bg-gradient-to-br from-brand-blue to-blue-600 text-white p-4 rounded-full shadow-xl shadow-blue-500/30 hover:scale-110 transition-all duration-300 ${isOpen ? 'opacity-0 pointer-events-none scale-50' : 'opacity-100 scale-100'}`}>
        <div className="relative">
          <MessageSquare size={24} className="text-white drop-shadow-sm" />
          <span className="absolute -top-2 -right-2 bg-brand-orange text-white text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-brand-blue shadow-sm">{circle.length}</span>
        </div>
      </button>

      {/* 🚨 MOBILE RESPONSIVE PORTAL OVERLAY (left-4 right-4 for centering, z-[1050]) */}
      <div className={`fixed bottom-[5.5rem] md:bottom-24 right-4 left-4 md:left-auto md:right-8 z-[1050] w-auto md:w-96 bg-white rounded-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col transition-all duration-500 origin-bottom md:origin-bottom-right ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-50 pointer-events-none translate-y-10'}`} style={{ height: '600px', maxHeight: 'calc(100dvh - 7rem)' }}>
        
        {/* DYNAMIC HEADER */}
        <div className="bg-gradient-to-r from-brand-blue to-blue-600 text-white p-5 flex items-center justify-between shadow-sm z-20">
          {activeChat ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { 
                  if (showProfile) { setShowProfile(false); } 
                  else { setActiveChat(null); setShowScheduleMenu(false); } 
                }} 
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              
              <div 
                onClick={() => setShowProfile(true)} 
                className="flex items-center gap-3 cursor-pointer group transition-all"
                title="View Profile"
              >
                <img src={activeChat.photo || "https://via.placeholder.com/150"} className="w-8 h-8 rounded-full object-cover border border-white/20 group-hover:ring-2 ring-white/50 transition-all" />
                <div className="leading-tight">
                  <h3 className="font-bold text-sm tracking-wide group-hover:underline decoration-white/50 underline-offset-2">{activeChat.name}</h3>
                  <p className="text-[9px] font-black uppercase text-blue-100 tracking-widest">{activeChat.role}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-inner"><Users size={16} /></div>
              <h3 className="font-display font-bold text-lg tracking-wide drop-shadow-sm">Active Connections</h3>
            </div>
          )}
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80 hover:text-white"><X size={18} /></button>
        </div>

        {/* VIEW 1: THE LIST */}
        {!activeChat && (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3 custom-scrollbar">
            {circle.map(user => (
              <div key={user.connectionId} onClick={() => setActiveChat(user)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 hover:border-brand-blue cursor-pointer transition-all hover:shadow-md group">
                <img src={user.photo || "https://via.placeholder.com/150"} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-50" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{user.name}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-blue truncate mt-0.5">{user.role}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><MessageSquare size={14} /></div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 2: PROFILE OVERLAY */}
        {activeChat && showProfile && (
          <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col items-center text-center animate-in slide-in-from-right-4 custom-scrollbar">
            <div className="w-24 h-24 rounded-full p-1 border-2 border-brand-blue/20 mb-4">
              <img src={activeChat.photo || "https://via.placeholder.com/150"} className="w-full h-full rounded-full object-cover" />
            </div>
            <h2 className="text-2xl font-display font-bold text-slate-800">{activeChat.name}</h2>
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-blue-50 text-brand-blue mt-2 mb-6 inline-block">
              {activeChat.specialty || activeChat.role}
            </span>
            
            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6 flex items-center justify-center divide-x divide-slate-200">
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xl font-black text-slate-800">
                  {activeChat.followers?.length || activeChat.followers || 0}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Followers
                </span>
              </div>
              <div className="flex-1 flex flex-col items-center">
                <span className="text-xl font-black text-slate-800">
                  {activeChat.following?.length || activeChat.following || 0}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Following
                </span>
              </div>
            </div>

            {activeChat.email && (
               <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6 flex items-center justify-between">
                 <div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-left">Contact</p>
                   <p className="text-sm text-slate-800 font-medium">{activeChat.email}</p>
                 </div>
               </div>
            )}

            {activeChat.username && (
              <a 
                href={`/profile/${activeChat.username}`} 
                target="_blank" 
                rel="noreferrer"
                className="w-full bg-slate-50 text-brand-blue font-bold py-3 rounded-xl border border-slate-200 hover:bg-brand-blue hover:text-white hover:border-brand-blue transition-colors flex items-center justify-center mb-3"
              >
                View Full Public Profile
              </a>
            )}

            <button onClick={() => setShowProfile(false)} className="mt-auto w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
              <MessageSquare size={16} /> Back to Chat
            </button>
          </div>
        )}

        {/* VIEW 3: ACTIVE CHAT */}
        {activeChat && !showProfile && (
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
            
            <div className="bg-white border-b border-slate-100 p-3 flex gap-2 shadow-sm z-20 relative">
              
              {isMeetingActive ? (
                <a href={activeChat.meetingLink !== "TBD" ? activeChat.meetingLink : "#"} target="_blank" rel="noreferrer" className="flex-1 bg-brand-blue text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">
                    <Video size={14} /> Join Scheduled Meet
                </a>
              ) : (
                <button 
                  onClick={() => setShowScheduleMenu(!showScheduleMenu)} 
                  className="flex-1 bg-blue-50 text-brand-blue text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-brand-blue hover:text-white transition-colors"
                >
                  <Video size={14} /> {showScheduleMenu ? "Cancel" : "Schedule Meet"}
                </button>
              )}

              <button onClick={handleDisconnect} disabled={isDisconnecting} className="flex-1 bg-rose-50 text-rose-500 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-rose-500 hover:text-white transition-colors">
                {isDisconnecting ? <Loader2 size={14} className="animate-spin" /> : <><UserMinus size={14} /> Disconnect</>}
              </button>

              {!(activeChat.meetingDate && new Date(activeChat.meetingDate) > new Date()) && showScheduleMenu && (
                <div className="absolute top-full left-3 right-3 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in slide-in-from-top-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3">Set Meeting Time</h4>
                  <div className="space-y-3">
                    <input 
                      type="datetime-local" 
                      value={meetDate} onChange={(e) => setMeetDate(e.target.value)}
                      className="w-full text-sm px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-blue"
                    />
                    <button 
                      onClick={handleScheduleMeet} disabled={!meetDate || isScheduling}
                      className="w-full bg-brand-blue text-white text-sm font-bold py-2.5 rounded-xl flex justify-center items-center shadow-md shadow-blue-500/20 disabled:opacity-50"
                    >
                      {isScheduling ? <Loader2 size={16} className="animate-spin" /> : "Auto-Generate Meet & Save"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
              
              {activeChat.meetingDate && new Date(activeChat.meetingDate) > new Date() && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 p-4 shadow-sm text-center z-10 shrink-0">
                  <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">Upcoming Meeting</p>
                  <p className="text-sm font-bold text-slate-800">
                    {new Date(activeChat.meetingDate).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex justify-center mt-3">
                    {activeChat.meetingLink && activeChat.meetingLink !== "TBD" && (
                      <a href={activeChat.meetingLink} target="_blank" rel="noreferrer" className="bg-brand-blue text-white text-xs font-bold py-2 px-6 rounded-xl flex items-center gap-2 shadow-md hover:bg-blue-700 transition-all">
                        <Video size={14} /> Join Google Meet
                      </a>
                    )}
                  </div>
                </div>
              )}

              {chatHistory.map((msg) => {
                const isMe = msg.sender?._id === currentUserId || msg.sender === currentUserId;
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'bg-brand-blue text-white rounded-br-sm shadow-md' : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm shadow-sm'}`}>
                      <p className="leading-relaxed">{msg.text}</p>
                      <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl focus-within:ring-2 focus-within:ring-brand-blue/20 focus-within:border-brand-blue transition-all">
                <input 
                  type="text" placeholder="Type a message..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm px-3 text-slate-700"
                  value={messageText} onChange={(e) => setMessageText(e.target.value)} disabled={isSending}
                />
                <button type="submit" disabled={isSending || !messageText.trim()} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${messageText.trim() ? 'bg-brand-blue text-white shadow-sm hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-ml-1 mt-0.5" />}
                </button>
              </form>
            </div>

          </div>
        )}
      </div>
    </>
  );
};

export default CommunicationPortal;