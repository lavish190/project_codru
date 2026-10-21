import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Trash2, Edit3, Image as ImageIcon, X, AlertTriangle, Eye, Clock, FileText, CheckCircle2 } from "lucide-react";
import PostRenderer from "./PostRenderer"; // 🚨 Reusing your universal renderer!
import RichTextEditor from "./RichTextEditor"; // 🚨 Reusing your universal editor!

interface MyPostsProps {
  preloadedPosts?: any[];
  isOwner?: boolean;
}

const MyPosts = ({ preloadedPosts, isOwner = true }: MyPostsProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem("userId");

  // --- NEW: TABS & DRAFTS ---
  const [activeTab, setActiveTab] = useState<"published" | "scheduled" | "drafts">("published");
  const [localDraft, setLocalDraft] = useState<string | null>(null);
  const [localDraftSchedule, setLocalDraftSchedule] = useState<string | null>(null);

  // --- NEW: MODAL STATES ---
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [postToPreview, setPostToPreview] = useState<any | null>(null);
  
  // Edit States
  const [postToEdit, setPostToEdit] = useState<any | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load local draft for this user
    if (currentUserId) {
      setLocalDraft(localStorage.getItem(`cute_post_draft_${currentUserId}`));
      setLocalDraftSchedule(localStorage.getItem(`cute_post_schedule_draft_${currentUserId}`));
    }

    if (preloadedPosts) {
      setPosts(preloadedPosts);
      setIsLoading(false);
    } else {
      const fetchDashboardPosts = async () => {
        try {
          const token = localStorage.getItem("jwtoken");
          const res = await fetch(`${import.meta.env.VITE_API}my-posts`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            const finalData = Array.isArray(data) ? data : (data.posts || data.blogs || []);
            setPosts(finalData);
          }
        } catch (error) {
          console.error("Dashboard error:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchDashboardPosts();
    }
  }, [preloadedPosts, currentUserId]);

  // Filter posts based on active tab
  const publishedPosts = posts.filter(p => p.status !== "scheduled");
  const scheduledPosts = posts.filter(p => p.status === "scheduled");

  // ==========================================
  // ACTIONS
  // ==========================================
  const confirmDelete = async () => {
    if (!postToDelete) return;
    const originalPosts = [...posts];
    setPosts(prev => prev.filter(p => p._id !== postToDelete));
    const targetId = postToDelete;
    setPostToDelete(null);

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${targetId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (error: any) {
      setErrorMsg("Failed to delete post. Please try again.");
      setPosts(originalPosts); 
    }
  };

  const saveEdit = async () => {
    if (!postToEdit) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postToEdit._id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: editContent,
          scheduledFor: editSchedule ? new Date(editSchedule).toISOString() : null,
          status: editSchedule && new Date(editSchedule) > new Date() ? "scheduled" : "published"
        })
      });

      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(prev => prev.map(p => p._id === postToEdit._id ? updatedPost : p));
        setPostToEdit(null); 
      } else {
        throw new Error("Failed to update post");
      }
    } catch (error: any) {
      setErrorMsg("Failed to update post.");
    }
  };

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-brand-orange" /></div>;

  return (
    <div className="w-full relative space-y-6">
      
      {/* 🚨 TABS NAVIGATION */}
      {isOwner && (
        <div className="flex gap-4 border-b border-gray-100 pb-4">
          <button onClick={() => setActiveTab("published")} className={`flex items-center gap-2 font-bold px-4 py-2 rounded-xl transition ${activeTab === "published" ? "bg-brand-blue text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <CheckCircle2 size={18} /> Published ({publishedPosts.length})
          </button>
          <button onClick={() => setActiveTab("scheduled")} className={`flex items-center gap-2 font-bold px-4 py-2 rounded-xl transition ${activeTab === "scheduled" ? "bg-brand-orange text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <Clock size={18} /> Scheduled ({scheduledPosts.length})
          </button>
          <button onClick={() => setActiveTab("drafts")} className={`flex items-center gap-2 font-bold px-4 py-2 rounded-xl transition ${activeTab === "drafts" ? "bg-slate-700 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <FileText size={18} /> Drafts ({localDraft ? 1 : 0})
          </button>
        </div>
      )}

      {/* 🚨 DRAFTS TAB */}
      {activeTab === "drafts" && isOwner && (
        localDraft ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText className="text-brand-orange" size={20}/> Unsaved Local Draft</h3>
              {localDraftSchedule && <span className="text-xs font-bold text-brand-blue bg-blue-50 px-3 py-1 rounded-full">Scheduled: {new Date(localDraftSchedule).toLocaleString()}</span>}
            </div>
            <div className="bg-slate-50 p-4 rounded-xl max-h-40 overflow-hidden relative">
              <PostRenderer content={localDraft} />
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-slate-50 to-transparent"></div>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => { localStorage.removeItem(`cute_post_draft_${currentUserId}`); setLocalDraft(null); }} className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition">Discard Draft</button>
              <button onClick={() => navigate("/")} className="px-4 py-2 text-sm font-bold bg-brand-orange text-white rounded-xl shadow-md hover:bg-orange-600 transition">Continue Editing in Feed</button>
            </div>
          </div>
        ) : (
          <div className="text-center p-10 text-gray-400 font-medium">No active drafts found on this device.</div>
        )
      )}

      {/* 🚨 PUBLISHED & SCHEDULED TABS */}
      {(activeTab === "published" || activeTab === "scheduled") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(activeTab === "published" ? publishedPosts : scheduledPosts).map((post: any) => (
            <div key={post._id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all overflow-hidden h-64 relative flex flex-col">
              
              {isOwner && (
                <div className="absolute top-3 right-3 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setPostToPreview(post)} className="p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-green-500 rounded-full shadow-md transition transform hover:scale-110" title="Preview Post">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => { setEditContent(post.content); setEditSchedule(post.scheduledFor ? new Date(post.scheduledFor).toISOString().slice(0, 16) : ""); setPostToEdit(post); }} className="p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-brand-blue rounded-full shadow-md transition transform hover:scale-110" title="Edit Post">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => setPostToDelete(post._id)} className="p-2 bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700 hover:text-red-500 rounded-full shadow-md transition transform hover:scale-110" title="Delete Post">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {post.imageUrl ? (
                <div className="flex-1 relative overflow-hidden bg-gray-100">
                  <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="post" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"></div>
                  <div className="absolute bottom-3 left-3 right-3 text-white text-sm font-medium line-clamp-2 drop-shadow-md">
                     <PostRenderer content={post.content} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-6 flex flex-col overflow-hidden bg-slate-50 relative pointer-events-none">
                  <div className="scale-75 origin-top-left w-[133%]">
                    <PostRenderer content={post.content} />
                  </div>
                </div>
              )}
              
              <div className="h-12 bg-white border-t border-gray-100 flex items-center justify-between px-4 text-xs font-bold text-gray-500 relative z-10">
                <span className={activeTab === "scheduled" ? "text-brand-orange" : ""}>
                  {activeTab === "scheduled" ? `⏳ ${new Date(post.scheduledFor).toLocaleString()}` : new Date(post.createdAt).toLocaleDateString()}
                </span>
                {activeTab === "published" && (
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1 hover:text-red-500 transition">❤️ {post.likes || 0}</span>
                    <span className="flex items-center gap-1 hover:text-brand-blue transition">💬 {post.comments?.length || 0}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================== */}
      {/* 🚨 PREVIEW MODAL */}
      {/* ========================================== */}
      {postToPreview && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPostToPreview(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Eye size={18} className="text-brand-blue"/> Feed Preview</h3>
              <button onClick={() => setPostToPreview(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"><X size={20} /></button>
            </div>
            
            {/* Feed-Card Replica */}
            <div className="p-6">
              <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                {postToPreview.imageUrl && (
                  <div className="w-full max-h-96 bg-gray-50 flex items-center justify-center overflow-hidden">
                    <img src={postToPreview.imageUrl} className="w-full h-full object-contain" alt="preview" />
                  </div>
                )}
                <div className="p-4">
                  <PostRenderer content={postToPreview.content} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 🚨 RICH TEXT EDIT MODAL */}
      {/* ========================================== */}
      {postToEdit && (
        <div className="fixed inset-0 z-150 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPostToEdit(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-display font-bold text-gray-800 flex items-center gap-2">
                <Edit3 size={18} className="text-brand-blue" /> Edit {postToEdit.status === "scheduled" ? "Scheduled Post" : "Post"}
              </h3>
              <button onClick={() => setPostToEdit(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* ⚠️ Replace this textarea with your extracted <RichTextEditor /> component! */}
             <div className="border border-brand-orange/50 rounded-2xl overflow-hidden h-64 bg-white flex flex-col">
                <RichTextEditor 
                  value={editContent} 
                  onChange={(html) => setEditContent(html)} 
                  showToolbar={true} 
                  className="h-full" 
                />
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <label className="block text-xs font-bold text-brand-blue uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Clock size={14}/> {postToEdit.status === "scheduled" ? "Reschedule Date" : "Convert to Scheduled Post"}
                </label>
                <input 
                  type="datetime-local" 
                  value={editSchedule} 
                  onChange={(e) => setEditSchedule(e.target.value)} 
                  min={new Date().toISOString().slice(0, 16)} 
                  className="w-full sm:w-auto bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue" 
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setPostToEdit(null)} className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition">Cancel</button>
              <button onClick={saveEdit} className="px-5 py-2.5 rounded-xl font-bold text-white bg-brand-blue hover:bg-blue-600 shadow-md shadow-blue-200 transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Error Modals remain unchanged... */}
    </div>
  );
};

export default MyPosts;