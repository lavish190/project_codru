import { useState, useEffect, useCallback } from "react";
import Muialert from "./Muialert";
import { Loader2, Edit3, X, Globe, Clock } from "lucide-react"; // 🚨 Added icons for edit modal
import { UserData } from "../App";
import PostCard from "./PostCard"; 
import RichTextEditor from "./RichTextEditor"; // 🚨 Needed for Edit modal

interface CuteFeedProps {
  userData: UserData;
  refreshTrigger?: number;
}

const toLocalDatetimeInput = (dateString: string) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

const CuteFeed = ({ userData, refreshTrigger }: CuteFeedProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);
  
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  // 🚨 EDIT MODAL STATES
  const [postToEdit, setPostToEdit] = useState<any | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editPostToLinkedIn, setEditPostToLinkedIn] = useState(false);
  const [editSyncTimes, setEditSyncTimes] = useState(true);
  const [editLinkedinSchedule, setEditLinkedinSchedule] = useState("");

  const currentUserId = localStorage.getItem("userId");
  const currentUsername = localStorage.getItem("Username");

  useEffect(() => {
    const fetchAllFeedData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("jwtoken");
        const headers = { "Authorization": `Bearer ${token}` };

        const [postsRes, savedRes, profileRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API}posts`, { headers }),
          fetch(`${import.meta.env.VITE_API}saved-posts/ids`, { headers }),
          fetch(`${import.meta.env.VITE_API}profile`, { headers })
        ]);

        if (!postsRes.ok) throw new Error("Failed to load feed");
        
        setPosts(await postsRes.json());
        if (savedRes.ok) setSavedPostIds(await savedRes.json());
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setFollowingUsernames(profileData.user.following.map((f: any) => f.username));
        }
      } catch (err: any) {
        setError(err.message || "Could not load posts.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllFeedData();
  }, [refreshTrigger]);

  const handleLike = async (postId: string) => { /* ...existing logic... */ };
  const handleSave = async (postId: string) => { /* ...existing logic... */ };
  const handleFollow = async (targetUsername: string) => { /* ...existing logic... */ };
  const handleDeletePost = async (postId: string) => { /* ...existing logic... */ };
  const handleCommentSubmit = useCallback(async (postId: string, text: string, parentId?: string) => { /* ...existing logic... */ }, [isSubmitting]);

  // 🚨 NEW: Handle Edit Click (Passed to PostCard)
  const handleEditClick = (post: any) => {
    setEditContent(post.content); 
    
    const cuteTime = post.distribution?.cute?.scheduledFor;
    const liTime = post.distribution?.linkedin?.scheduledFor;
    const isLiActive = post.distribution?.linkedin?.status && post.distribution?.linkedin?.status !== 'unselected';

    setEditSchedule(cuteTime ? toLocalDatetimeInput(cuteTime) : "");
    setEditLinkedinSchedule(liTime ? toLocalDatetimeInput(liTime) : "");
    setEditPostToLinkedIn(!!isLiActive);
    setEditSyncTimes(!liTime || cuteTime === liTime); 
    
    setPostToEdit(post); 
  };

  // 🚨 NEW: Save Edit to Server
  const saveEdit = async () => {
    if (!postToEdit) return;
    try {
      const token = localStorage.getItem("jwtoken");

      const distribution = {
        cute: {
          status: editSchedule && new Date(editSchedule) > new Date() ? 'scheduled' : 'posted',
          scheduledFor: editSchedule ? new Date(editSchedule).toISOString() : null
        },
        linkedin: editPostToLinkedIn ? {
          status: (editSyncTimes ? editSchedule : editLinkedinSchedule) && new Date(editSyncTimes ? editSchedule : editLinkedinSchedule) > new Date() ? 'scheduled' : 'posted',
          scheduledFor: editSyncTimes 
            ? (editSchedule ? new Date(editSchedule).toISOString() : null)
            : (editLinkedinSchedule ? new Date(editLinkedinSchedule).toISOString() : null)
        } : { status: 'unselected' }
      };

      const res = await fetch(`${import.meta.env.VITE_API}posts/${postToEdit._id}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: editContent,
          scheduledFor: editSchedule ? new Date(editSchedule).toISOString() : null,
          status: editSchedule && new Date(editSchedule) > new Date() ? "scheduled" : "published",
          distribution
        })
      });

      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(posts.map(p => p._id === postToEdit._id ? updatedPost : p));
        setPostToEdit(null); 
        setAlert({ show: true, message: "Post updated successfully", type: "success" });
      } else throw new Error("Failed to update post");
    } catch (error: any) { 
      setAlert({ show: true, message: "Failed to update post.", type: "error" }); 
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-64 text-brand-orange"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  if (error) return <div className="text-center text-red-500 font-medium py-10">{error}</div>;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-0 sm:space-y-6 py-0 sm:py-6 pb-20 sm:px-4 relative">
      {posts.length === 0 ? (
        <div className="text-center text-gray-400 py-10 font-display text-xl">No posts yet. Be the first to share something cute!</div>
      ) : (
        posts.map((post) => (
          <PostCard 
            key={post._id} 
            post={post} 
            currentUser={{ id: currentUserId, photo: userData?.Photo }} 
            isSingleView={false}
            onLike={handleLike} 
            onSave={handleSave} 
            onDelete={handleDeletePost}
            onEdit={handleEditClick} // 🚨 Pass edit handler to PostCard
            onFollow={handleFollow}
            savedPostIds={savedPostIds}
            followingUsernames={followingUsernames}
            onCommentSubmit={handleCommentSubmit}
          />
        ))
      )}
      
      {/* 🚨 RICH TEXT EDIT MODAL (Copied exactly from MyPosts) */}
      {postToEdit && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPostToEdit(null)}>
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95dvh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-base sm:text-lg font-display font-bold text-gray-800 flex items-center gap-2"><Edit3 size={18} className="text-brand-blue" /> Edit {postToEdit.status === "scheduled" ? "Scheduled Post" : "Post"}</h3>
              <button onClick={() => setPostToEdit(null)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="border border-brand-orange/50 rounded-xl overflow-hidden min-h-[250px] flex flex-col">
                <RichTextEditor value={editContent} onChange={(html) => setEditContent(html)} showToolbar={true} className="flex-1" />
              </div>
              {/* LINKEDIN TOGGLE & SYNC SETTINGS */}
              {postToEdit.status === "scheduled" && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#0A66C2] flex items-center gap-2">
                      <Globe className="w-4 h-4" /> Cross-post to LinkedIn
                    </span>
                    <input type="checkbox" checked={editPostToLinkedIn} onChange={(e) => setEditPostToLinkedIn(e.target.checked)} className="w-4 h-4 accent-[#0A66C2]" />
                  </div>
                  
                  {editPostToLinkedIn && (
                    <div className="flex items-center justify-between bg-blue-50/50 p-2 rounded-lg">
                      <span className="text-xs font-semibold text-gray-600">Same time for all platforms</span>
                      <input type="checkbox" checked={editSyncTimes} onChange={(e) => setEditSyncTimes(e.target.checked)} className="w-4 h-4 accent-brand-blue" />
                    </div>
                  )}
                </div>
              )}
              
              {/* DATE PICKERS */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4 shrink-0">
                <div>
                  <label className="block text-xs font-bold text-brand-blue uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Clock size={14}/> 
                    {postToEdit.status === "scheduled" 
                      ? `Reschedule CuTe Feed ${!editSyncTimes && editPostToLinkedIn ? "(Separate)" : ""}` 
                      : "Convert to Scheduled Post"}
                  </label>
                  <input type="datetime-local" value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} min={toLocalDatetimeInput(new Date().toISOString())} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue" />
                </div>

                {!editSyncTimes && editPostToLinkedIn && postToEdit.status === "scheduled" && (
                  <div>
                     <label className="block text-xs font-bold text-[#0A66C2] uppercase tracking-widest mb-2 flex items-center gap-2">
                       <Clock size={14}/> Reschedule LinkedIn
                     </label>
                     <input type="datetime-local" value={editLinkedinSchedule} onChange={(e) => setEditLinkedinSchedule(e.target.value)} min={toLocalDatetimeInput(new Date().toISOString())} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]" />
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setPostToEdit(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-200 transition">Cancel</button>
              <button onClick={saveEdit} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-blue hover:bg-blue-600 shadow-md shadow-blue-200 transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {alert.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1100]">
          <Muialert message={alert.message} severity={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
        </div>
      )}
    </div>
  );
};

export default CuteFeed;