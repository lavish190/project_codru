import { useState, useEffect } from "react";
import { Info, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { UserData } from "../App";

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.6 6.029-5.056 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z"/>
  </svg>
);

interface IntegrationsProps {
  userData: UserData;
}

export default function SocialIntegrations({ userData }: IntegrationsProps) {
  const isStudent = userData?.Role?.toLowerCase() === "student";
  const hasAdminOverride = (userData as any)?.socialOverride === true; 
  
  if (isStudent && !hasAdminOverride) return null;

  const [connections, setConnections] = useState({
    facebook: true, // Set to true for previewing the dropdown
    linkedin: true
  });

  // 🚨 NEW: Facebook Page Selection State
  const [facebookPages, setFacebookPages] = useState<{id: string, name: string}[]>([
    { id: "12345", name: "CuTe Learning Official" },
    { id: "67890", name: "My Personal Teaching Page" }
  ]);
  const [selectedPageId, setSelectedPageId] = useState<string>("12345");

  // In production, you would fetch the pages from your backend here:
  /*
  useEffect(() => {
    if (connections.facebook) {
      fetch('/api/auth/facebook/pages', { headers: { Authorization: `Bearer ${localStorage.getItem('jwtoken')}` } })
        .then(res => res.json())
        .then(data => setFacebookPages(data.pages));
    }
  }, [connections.facebook]);
  */

  const handlePageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageId = e.target.value;
    setSelectedPageId(newPageId);
    
    // Save their default page preference to your backend
    try {
      await fetch(`${import.meta.env.VITE_API}auth/facebook/default-page`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` 
        },
        body: JSON.stringify({ pageId: newPageId })
      });
    } catch (error) {
      console.error("Failed to update default page", error);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100 bg-slate-50">
        <h2 className="text-xl font-display font-bold text-gray-900">Social Media Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">Manage connected accounts and view exactly how CuTe Learning uses your data.</p>
      </div>

      <div className="p-6 space-y-6">
        
        {/* FACEBOOK INTEGRATION */}
        <div className="flex flex-col p-4 border border-gray-200 rounded-2xl bg-white hover:border-blue-200 transition-colors">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-md">
                <FacebookIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  Facebook Pages
                  {connections.facebook && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </h3>
                <p className="text-sm text-gray-500 mb-2">Cross-post your educational content directly to your Facebook Pages.</p>
                
                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl border border-blue-100 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Data Accessed:</strong> Name, Profile Picture (public_profile), and Page Access Tokens (pages_manage_posts, pages_show_list). 
                    <br className="mb-1"/>
                    <em>CuTe Learning only uses this data to publish posts you explicitly authorize. We never read your personal feed or messages.</em>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setConnections(prev => ({ ...prev, facebook: !prev.facebook }))}
              className={`shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm transition-all w-full sm:w-auto ${
                connections.facebook 
                  ? "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600" 
                  : "bg-[#1877F2] text-white shadow-md shadow-blue-200 hover:bg-blue-700"
              }`}
            >
              {connections.facebook ? "Disconnect" : "Connect"}
            </button>
          </div>

          {/* 🚨 THE PAGE SELECTOR (Only shows if connected) */}
          {connections.facebook && facebookPages.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                Posting Destination
              </label>
              <div className="relative max-w-sm">
                <select
                  value={selectedPageId}
                  onChange={handlePageChange}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-800 text-sm font-semibold rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/50 hover:border-blue-200 transition-colors cursor-pointer"
                >
                  {facebookPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">
                All Facebook posts created in CuTe Learning will be published to this active page.
              </p>
            </div>
          )}
        </div>

        {/* LINKEDIN INTEGRATION */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-gray-200 rounded-2xl bg-white hover:border-blue-200 transition-colors">
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 shrink-0 rounded-full bg-[#0A66C2] flex items-center justify-center shadow-md">
              <LinkedinIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                LinkedIn Profile
                {connections.linkedin && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </h3>
              <p className="text-sm text-gray-500 mb-2">Share professional updates and insights with your network.</p>
              
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl border border-blue-100 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Data Accessed:</strong> Name, Photo (r_liteprofile), and Publishing rights (w_member_social).
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setConnections(prev => ({ ...prev, linkedin: !prev.linkedin }))}
            className={`shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm transition-all w-full sm:w-auto ${
              connections.linkedin 
                ? "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600" 
                : "bg-[#0A66C2] text-white shadow-md shadow-blue-200 hover:bg-blue-700"
            }`}
          >
            {connections.linkedin ? "Disconnect" : "Connect"}
          </button>
        </div>

      </div>
    </div>
  );
}