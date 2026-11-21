import { useState, useEffect } from "react";
import { Info, CheckCircle2, ChevronDown, UserCircle, ExternalLink, Loader2 } from "lucide-react";
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

  const [isLoading, setIsLoading] = useState(true);
  const [connections, setConnections] = useState({ facebook: false, linkedin: false });
  const [socialProfiles, setSocialProfiles] = useState({
    facebookName: "", facebookPhoto: "", linkedinName: "", linkedinPhoto: ""
  });
  
  const [facebookPages, setFacebookPages] = useState<{id: string, name: string}[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}auth/connections`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConnections({ facebook: data.facebook, linkedin: data.linkedin });
          
          if (data.facebook && data.facebookPages) {
            setFacebookPages(data.facebookPages);
            setSelectedPageId(data.defaultFacebookPageId || (data.facebookPages[0]?.id || ""));
          }
          
          setSocialProfiles({
            facebookName: data.facebookProfileName || "Facebook User",
            facebookPhoto: data.facebookPhoto || "",
            linkedinName: data.linkedinProfileName || "LinkedIn Member",
            linkedinPhoto: data.linkedinPhoto || ""
          });
        }
      } catch (err) {
        console.error("Failed to fetch connections", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConnections();
  }, []);

  const handleConnect = async (provider: 'facebook' | 'linkedin') => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}auth/${provider}/connect`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url; 
    } catch (error) {
      console.error(`Failed to initiate ${provider} connection`, error);
    }
  };

  const handleDisconnect = async (provider: 'facebook' | 'linkedin') => {
    if (!window.confirm(`Are you sure you want to disconnect ${provider === 'facebook' ? 'Meta' : 'LinkedIn'}?`)) return;
    try {
      setConnections(prev => ({ ...prev, [provider]: false }));
    } catch (error) {
      console.error(`Failed to disconnect ${provider}`, error);
    }
  };

  const handlePageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageId = e.target.value;
    setSelectedPageId(newPageId);
    
    try {
      await fetch(`${import.meta.env.VITE_API}auth/facebook/default-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("jwtoken")}` },
        body: JSON.stringify({ pageId: newPageId })
      });
    } catch (error) {
      console.error("Failed to update default page", error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 flex justify-center items-center mb-6">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="p-6 border-b border-gray-100 bg-slate-50">
        <h2 className="text-xl font-display font-bold text-gray-900">Social Media Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">Manage connected accounts and view exactly how CuTe Learning uses your data.</p>
      </div>

      <div className="p-6 space-y-6">
        
        {/* FACEBOOK INTEGRATION */}
        <div className={`flex flex-col p-5 border rounded-2xl transition-all duration-300 ${connections.facebook ? 'border-[#1877F2]/20 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex gap-4 items-start w-full">
              <div className="w-12 h-12 shrink-0 rounded-full bg-[#1877F2] flex items-center justify-center shadow-md">
                <FacebookIcon className="w-6 h-6 text-white" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  Meta (Facebook Pages)
                  {connections.facebook && <CheckCircle2 className="w-4 h-4 text-[#1877F2]" />}
                </h3>
                
                {connections.facebook ? (
                  <div className="flex items-center gap-2 mt-1.5 mb-3 bg-white w-max px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                    {socialProfiles.facebookPhoto ? (
                      <img src={socialProfiles.facebookPhoto} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <UserCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">Connected as <span className="text-gray-900">{socialProfiles.facebookName}</span></span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3 mt-1">Cross-post your educational content directly to your Facebook Pages.</p>
                )}
                
                <div className="bg-white text-gray-600 text-[11px] p-3 rounded-xl border border-gray-200/60 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                  <div className="leading-relaxed">
                    <strong>Data Accessed:</strong> Name, Profile Picture, and Page Access Tokens. 
                    <br/>
                    <em>CuTe Learning only uses this data to publish posts you explicitly authorize. We never read your personal feed or messages. By connecting, you agree to Meta's Terms of Service and CuTe Learning's Privacy Policy.</em>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => connections.facebook ? handleDisconnect('facebook') : handleConnect('facebook')}
              className={`shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm transition-all w-full sm:w-auto ${
                connections.facebook 
                  ? "bg-white border border-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm" 
                  : "bg-[#1877F2] text-white shadow-md shadow-blue-200 hover:bg-blue-700"
              }`}
            >
              {connections.facebook ? "Disconnect" : "Connect"}
            </button>
          </div>

          {/* PAGE SELECTOR */}
          {connections.facebook && (
            <div className="mt-5 pt-5 border-t border-[#1877F2]/10 animate-in fade-in slide-in-from-top-2">
              <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">
                Posting Destination
              </label>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative w-full max-w-sm">
                  <select
                    value={selectedPageId || ""}
                    onChange={handlePageChange}
                    className="w-full appearance-none bg-white border border-gray-200 text-gray-800 text-sm font-semibold rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/50 hover:border-blue-200 transition-colors cursor-pointer shadow-sm"
                  >
                    <option value="" disabled>Select a Facebook Page...</option>
                    {facebookPages.map((page) => (
                      <option key={page.id} value={page.id}>{page.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                
                <button 
                  onClick={() => window.open("https://www.facebook.com/pages/create", "_blank")}
                  className="text-xs font-semibold text-[#1877F2] hover:text-blue-700 flex items-center gap-1 transition-colors"
                >
                  Create new page <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              
              <p className="text-[10px] text-gray-400 mt-2 font-medium">
                All Facebook posts created in CuTe Learning will be published to this active page.
              </p>
            </div>
          )}
        </div>

        {/* LINKEDIN INTEGRATION */}
        <div className={`flex flex-col p-5 border rounded-2xl transition-all duration-300 ${connections.linkedin ? 'border-[#0A66C2]/20 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            
            <div className="flex gap-4 items-start w-full">
              <div className="w-12 h-12 shrink-0 rounded-full bg-[#0A66C2] flex items-center justify-center shadow-md">
                <LinkedinIcon className="w-5 h-5 text-white" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  LinkedIn Profile
                  {connections.linkedin && <CheckCircle2 className="w-4 h-4 text-[#0A66C2]" />}
                </h3>
                
                {connections.linkedin ? (
                  <div className="flex items-center gap-2 mt-1.5 mb-3 bg-white w-max px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                    {socialProfiles.linkedinPhoto ? (
                      <img src={socialProfiles.linkedinPhoto} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <UserCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">Connected as <span className="text-gray-900">{socialProfiles.linkedinName}</span></span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3 mt-1">Share professional updates and insights directly with your network.</p>
                )}
                
                <div className="bg-white text-gray-600 text-[11px] p-3 rounded-xl border border-gray-200/60 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                  <div className="leading-relaxed">
                    <strong>Data Accessed:</strong> Name, Photo, and Publishing rights.
                    <br/>
                    <em>By connecting, you agree to LinkedIn's User Agreement and CuTe Learning's Privacy Policy.</em>
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => connections.linkedin ? handleDisconnect('linkedin') : handleConnect('linkedin')}
              className={`shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm transition-all w-full sm:w-auto ${
                connections.linkedin 
                  ? "bg-white border border-gray-200 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm" 
                  : "bg-[#0A66C2] text-white shadow-md shadow-blue-200 hover:bg-blue-700"
              }`}
            >
              {connections.linkedin ? "Disconnect" : "Connect"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}