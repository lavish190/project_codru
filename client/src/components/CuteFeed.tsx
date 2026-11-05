import { useState, useEffect, useCallback } from "react";
import Muialert from "./Muialert";
import { Loader2 } from "lucide-react";
import { UserData } from "../App";
import PostCard from "./PostCard"; 

interface CuteFeedProps {
  userData: UserData;
  refreshTrigger?: number;
}

const CuteFeed = ({ userData, refreshTrigger }: CuteFeedProps) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);
  
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  const currentUserId = localStorage.getItem("userId");
  const currentUsername = localStorage.getItem("Username");

  useEffect(() => {
    // 🚨 BUNDLED FETCH: Wait for Posts, Saves, and Follows to ALL finish before dropping the loading spinner
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

  const handleLike = async (postId: string) => {
    setPosts(prevPosts => prevPosts.map(p => {
      if (p._id !== postId) return p;
      const isLiked = p.likedBy?.some((u: any) => (u._id || u) === currentUserId);
      return {
        ...p,
        likes: isLiked ? Math.max(0, p.likes - 1) : p.likes + 1,
        likedBy: isLiked ? p.likedBy.filter((u: any) => (u._id || u) !== currentUserId) : [...(p.likedBy || []), currentUserId]
      };
    }));

    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}posts/${postId}/like`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    } catch (error) {
      console.error("Failed to like post", error);
    }
  };

  const handleSave = async (postId: string) => {
    const isSaved = savedPostIds.includes(postId);
    setSavedPostIds(prev => isSaved ? prev.filter(id => id !== postId) : [...prev, postId]);

    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}posts/${postId}/save`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    } catch (error) {
      console.error("Failed to save post", error);
    }
  };

  const handleFollow = async (targetUsername: string) => {
    setFollowingUsernames(prev => [...prev, targetUsername]);
    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ currentUserId: currentUsername, targetUserId: targetUsername })
      });
    } catch (error) {
      setFollowingUsernames(prev => prev.filter(u => u !== targetUsername));
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    
    // 🚨 OPTIMISTIC UI: Remove it instantly, revert if server fails
    const originalPosts = [...posts];
    setPosts(prev => prev.filter(p => p._id !== postId));

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (err) {
      console.error("Failed to delete", err);
      setPosts(originalPosts); // Put it back if the server errored out
      setAlert({ show: true, message: "Failed to delete post", type: "error" });
    }
  };

  // 🚨 Wrapped in useCallback to prevent child re-renders
  const handleCommentSubmit = useCallback(async (postId: string, text: string, parentId?: string) => {
    if (!text.trim() || isSubmitting[postId]) return;
    setIsSubmitting(prev => ({ ...prev, [postId]: true }));

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ text, parentId })
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: data.comments } : p));
      }
    } catch (error) {
      setAlert({ show: true, message: "Failed to post comment", type: "error" });
    } finally {
      setIsSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  }, [isSubmitting]);

  if (isLoading) return <div className="flex justify-center items-center h-64 text-brand-orange"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  if (error) return <div className="text-center text-red-500 font-medium py-10">{error}</div>;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-0 sm:space-y-6 py-0 sm:py-6 pb-20 sm:px-4">
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
            onFollow={handleFollow}
            savedPostIds={savedPostIds}
            followingUsernames={followingUsernames}
            // 🚨 CLEAN REFERENCE: Much better for React's rendering engine
            onCommentSubmit={handleCommentSubmit}
          />
        ))
      )}
      
      {alert.show && <Muialert message={alert.message} severity={alert.type} onClose={() => setAlert({ ...alert, show: false })} />}
    </div>
  );
};

export default CuteFeed;