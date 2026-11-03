import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import PostCard from "./PostCard";
import NotFound from "./NotFound";

const SinglePost = ({ userData }: any) => {
  const { postId } = useParams();
  const navigate = useNavigate();
  
  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  
  const currentUserId = localStorage.getItem("userId");
  const isLoggedIn = !!localStorage.getItem("jwtoken");

  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API}posts/single/${postId}`);
        if (!res.ok) throw new Error("Post not found");
        setPost(await res.json());

        if (isLoggedIn) {
          const token = localStorage.getItem("jwtoken");
          const savedRes = await fetch(`${import.meta.env.VITE_API}saved-posts/ids`, { headers: { "Authorization": `Bearer ${token}` } });
          if (savedRes.ok) setSavedPostIds(await savedRes.json());
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPostData();
  }, [postId, isLoggedIn]);

  // 🚨 OPTIMISTIC LIKES
  const handleLike = async () => {
    if (!isLoggedIn) return;
    setPost((prev: any) => {
      const isLiked = prev.likedBy?.some((u: any) => (u._id || u) === currentUserId);
      return {
        ...prev,
        likes: isLiked ? Math.max(0, prev.likes - 1) : prev.likes + 1,
        likedBy: isLiked ? prev.likedBy.filter((u: any) => (u._id || u) !== currentUserId) : [...(prev.likedBy || []), currentUserId]
      };
    });

    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}posts/${post._id}/like`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    } catch (error) {
      console.error("Failed to like", error);
    }
  };

  // 🚨 OPTIMISTIC SAVES
  const handleSave = async () => {
    if (!isLoggedIn) return;
    const isSaved = savedPostIds.includes(post._id);
    setSavedPostIds(prev => isSaved ? prev.filter(id => id !== post._id) : [...prev, post._id]);

    try {
      const token = localStorage.getItem("jwtoken");
      await fetch(`${import.meta.env.VITE_API}posts/${post._id}/save`, { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    } catch (error) {
      console.error("Failed to save", error);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) navigate("/");
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleCommentSubmit = async (postId: string, text: string) => {
    if (!text.trim() || !isLoggedIn) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        setPost({ ...post, comments: data.comments });
      }
    } catch (error) {
      console.error("Failed to post comment", error);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen text-brand-orange"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  if (error || !post) return <NotFound mode="404" />;

  return (
    <div className="w-full max-w-2xl mx-auto py-0 sm:py-8 pb-20 sm:px-4">
      <button onClick={() => navigate(-1)} className="hidden sm:flex items-center gap-2 text-gray-500 hover:text-brand-orange mb-6 font-semibold transition-colors">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <PostCard 
        post={post} 
        currentUser={{ id: currentUserId, photo: userData?.Photo }} 
        isSingleView={true}
        onLike={handleLike} 
        onSave={handleSave} 
        onDelete={handleDeletePost}
        savedPostIds={savedPostIds}
        onCommentSubmit={handleCommentSubmit}
      />
    </div>
  );
};

export default SinglePost;