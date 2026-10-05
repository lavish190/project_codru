import React, { useState, useEffect } from "react";
import { CheckCircle2, Video, VideoOff, CalendarDays, Globe, Hourglass, RefreshCw } from "lucide-react";

interface Props {
  meetLink: string;
  meetingDate: string; 
}

const BookingConfirmed: React.FC<Props> = ({ meetLink, meetingDate }) => {
  const [canJoin, setCanJoin] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [timeMessage, setTimeMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!meetingDate) return;

    const checkMeetingTime = () => {
      const now = new Date();
      const meetStart = new Date(meetingDate);
      const meetEnd = new Date(meetStart.getTime() + 30 * 60 * 1000);
      
      const windowOpens = new Date(meetStart.getTime() - 10 * 60 * 1000);

      if (now >= windowOpens && now <= meetEnd) {
        setCanJoin(true);
        setIsOver(false);
        setTimeMessage("The meeting room is open!");
      } else if (now > meetEnd) {
        setCanJoin(false);
        setIsOver(true); // 🚨 Triggers the "Limbo" state
      } else {
        setCanJoin(false);
        setIsOver(false);
        setTimeMessage("The Join button will unlock 10 minutes before the call.");
      }
    };

    checkMeetingTime(); 
    const interval = setInterval(checkMeetingTime, 60000); 
    return () => clearInterval(interval);
  }, [meetingDate]);

  const formattedDate = new Date(meetingDate).toLocaleString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Reloads the page to ping the database for Stage 2 status
    setTimeout(() => window.location.reload(), 800); 
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 text-center animate-fade-in-up">
      
      {/* Dynamic Header Icon */}
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isOver ? 'bg-orange-50' : 'bg-green-50'}`}>
        {isOver ? <Hourglass className="w-10 h-10 text-[#ed7f23] animate-pulse" /> : <CheckCircle2 className="w-12 h-12 text-green-600" />}
      </div>
      
      <h2 className="text-3xl font-display font-bold text-[#1765a4] mb-2">
        {isOver ? "Meeting Concluded" : "Call Scheduled!"}
      </h2>
      <p className="text-gray-600 mb-8">
        {isOver 
          ? "We are currently processing your discovery call notes. Step 2 will unlock automatically once your counselor reviews your profile."
          : "We have successfully secured your time slot and sent a calendar invite to your email."}
      </p>

      <div className="bg-[#fdf8f4] border border-[#ed7f23]/20 rounded-2xl p-6 mb-8 text-left inline-block w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[#ed7f23] font-bold">
            <CalendarDays className="w-5 h-5" />
            {isOver ? "Past Meeting Time" : "Scheduled Time"}
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <Globe size={12} /> {userTimeZone}
          </div>
        </div>
        <p className={`text-xl font-black ${isOver ? 'text-gray-400 line-through decoration-gray-300' : 'text-[#1765a4]'}`}>
          {formattedDate}
        </p>
      </div>

      <div className="flex flex-col items-center">
        {isOver ? (
          // 🚨 THE LIMBO STATE UI
          <div className="flex flex-col items-center w-full max-w-sm">
             <button 
                onClick={handleRefresh}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-bold text-lg bg-[#1765a4] text-white shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Check Status
              </button>
              <p className="mt-3 text-sm font-bold text-[#ed7f23]">
                Awaiting counselor approval...
              </p>
          </div>
        ) : (
          // STANDARD PRE-MEETING UI
          <>
            <a 
              href={canJoin ? meetLink : "#"} 
              target={canJoin ? "_blank" : "_self"}
              rel="noreferrer"
              className={`flex items-center justify-center gap-2 w-full max-w-sm py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                canJoin 
                  ? "bg-[#1765a4] text-white shadow-lg hover:-translate-y-1 hover:shadow-xl" 
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              onClick={(e) => {
                if (!canJoin) e.preventDefault();
              }}
            >
              {canJoin ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              Join Google Meet
            </a>
            <p className={`mt-3 text-sm font-bold ${canJoin ? 'text-green-600' : 'text-gray-400'}`}>
              {timeMessage}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default BookingConfirmed;