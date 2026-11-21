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

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
      if (res.ok) navigate("/"); // Go home after deleting a single post
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen text-brand-orange"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  if (error || !post) return <NotFound mode="404" />;

  return (
    <div className="w-full max-w-2xl mx-auto py-0 sm:py-8 pb-20 sm:px-4">
      <button onClick={() => navigate(-1)} className="hidden sm:flex items-center gap-2 text-gray-500 hover:text-brand-orange mb-6 font-semibold transition-colors">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      {/* 🚨 Clean Smart Component Call */}
      <PostCard 
        post={post} 
        isSingleView={true}
        defaultIsSaved={savedPostIds.includes(post._id)}
        followingUsernames={[post.userId?.username]}
        onDelete={handleDeletePost}
      />
    </div>
  );
};

export default SinglePost;