import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Loader2, ArrowLeft } from "lucide-react";
import PostRenderer from "./PostRenderer"; // 🚨 NEW: Import the rich text renderer
import RichTextEditor from "./RichTextEditor"; // 🚨 NEW: Import the rich text editor

// Assuming you have this exported from App.tsx or your types file
interface SinglePostProps {
  userData?: any; 
}

const SinglePost = ({ userData }: SinglePostProps) => {
  const { postId } = useParams();
  const navigate = useNavigate();
  
  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Interactive States
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [showLikesModal, setShowLikesModal] = useState<any[] | null>(null);
  
  // Comment & Edit States
  const [commentInput, setCommentInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  // Auth Checks
  const currentUserId = localStorage.getItem("userId");
  const isLoggedIn = !!localStorage.getItem("jwtoken");

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchPostData = async () => {
      try {
        // 1. Fetch the actual post (No auth required)
        const res = await fetch(`${import.meta.env.VITE_API}posts/single/${postId}`);
        if (!res.ok) throw new Error("Post not found");
        const data = await res.json();
        setPost(data);

        // 2. If logged in, fetch their saved bookmarks!
        if (isLoggedIn) {
          const token = localStorage.getItem("jwtoken");
          const savedRes = await fetch(`${import.meta.env.VITE_API}saved-posts/ids`, { 
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (savedRes.ok) {
            const savedData = await savedRes.json();
            setSavedPostIds(savedData); 
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPostData();
  }, [postId, isLoggedIn]);

  // --- INTERACTION HANDLERS ---
  const handleLike = async () => {
    if (!isLoggedIn) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const updatedPost = await res.json();
        // THE FIX: Only update the likes and likedBy arrays! Leave the author and comments alone.
        setPost((prev: any) => ({ 
          ...prev, 
          likes: updatedPost.likes, 
          likedBy: updatedPost.likedBy 
        }));
      }
    } catch (error) {
      console.error("Failed to like", error);
    }
  };

  const handleSave = async () => {
    if (!isLoggedIn) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}/save`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setSavedPostIds(prev => 
          prev.includes(post._id) ? prev.filter(id => id !== post._id) : [...prev, post._id]
        );
      }
    } catch (error) {
      console.error("Failed to save", error);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("🔗 Link copied to clipboard!");
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !isLoggedIn) return;

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ text: commentInput, parentId: replyTarget || undefined })
      });
      
      if (res.ok) {
        const data = await res.json();
        setPost({ ...post, comments: data.comments });
        setCommentInput("");
        setReplyTarget(null);
      }
    } catch (error) {
      console.error("Failed to post comment", error);
    }
  };

  const handleEditSubmit = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ content: editContent })
      });
      if (res.ok) {
        setPost({ ...post, content: editContent });
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to edit", err);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${post._id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        navigate("/"); // Send them back to the feed after deleting!
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  // Helper for @mentions in plain-text comments
  const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? <span key={i} className="text-brand-orange font-semibold cursor-pointer hover:underline">{part}</span> : <span key={i}>{part}</span>
    );
  };

  // --- RENDERING FALLBACKS ---
  if (isLoading) return <div className="flex justify-center items-center h-screen text-brand-orange"><Loader2 className="w-12 h-12 animate-spin" /></div>;
  if (error || !post) return <div className="text-center py-20"><h2 className="text-2xl font-bold">Oops!</h2><p className="text-gray-500 mt-2">{error || "Post deleted."}</p><button onClick={() => navigate("/")} className="mt-4 text-brand-blue hover:underline">Go back home</button></div>;

  const isLikedByMe = post.likedBy?.some((u: any) => (u._id || u) === currentUserId);
  const isSavedByMe = savedPostIds.includes(post._id);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-0 pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-brand-orange mb-6 font-semibold transition-colors">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <article className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Author Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100">
              {post.userId?.photo ? <img src={post.userId.photo} alt="user" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange/20 flex items-center justify-center font-bold text-brand-orange">{post.userId?.name?.charAt(0) || "U"}</div>}
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{post.userId?.name}</h3>
              <p className="text-xs text-gray-400">@{post.userId?.username}</p>
            </div>
          </div>

          {/* 3-Dots Menu (Only if logged in AND it's their post) */}
          {isLoggedIn && post.userId?._id === currentUserId && (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="text-gray-400 hover:text-brand-blue p-2 rounded-full hover:bg-gray-50">
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-10">
                  <button onClick={() => { setIsEditing(true); setEditContent(post.content); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit Post</button>
                  <button onClick={handleDeletePost} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">Delete</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Post Image */}
        {post.imageUrl && (
          <div className="w-full max-h-150 overflow-hidden bg-gray-50 flex items-center justify-center">
            <img src={post.imageUrl} alt="Post content" className="w-full h-full object-contain" />
          </div>
        )}

        {/* Post Content */}
        <div className="p-6">
          {isEditing ? (
            <div className="space-y-2">
              <div className="border border-brand-orange/50 rounded-xl overflow-hidden bg-white flex flex-col h-40">
                <RichTextEditor 
                  value={editContent} 
                  onChange={(html) => setEditContent(html)} 
                  showToolbar={true} 
                  className="h-full"
                />
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => setIsEditing(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                <button onClick={() => handleEditSubmit()} disabled={!editContent.trim()} className="text-xs font-bold bg-brand-orange text-white px-3 py-1.5 rounded-full">Save</button>
              </div>
            </div>
          ) : (
            // 🚨 CHANGED: Rendering Tiptap HTML content using the reusable PostRenderer
            <PostRenderer content={post.content} />
          )}
        </div>

        {/* INTERACTIVE ACTION BAR (Only shown if logged in!) */}
        {isLoggedIn && (
          <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button onClick={handleLike} className={`flex items-center gap-2 transition-colors group ${isLikedByMe ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}>
                <Heart className="w-6 h-6 group-active:scale-75 transition-transform" fill={isLikedByMe ? "currentColor" : "none"} />
              </button>
              <button onClick={() => document.getElementById("comment-input")?.focus()} className="flex items-center gap-2 text-gray-500 hover:text-brand-blue transition-colors group">
                <MessageCircle className="w-6 h-6 group-active:scale-75 transition-transform" />
              </button>
              <button onClick={handleShare} className="flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors group">
                <Share2 className="w-5 h-5 group-active:scale-75 transition-transform" />
              </button>
            </div>
            <button onClick={handleSave} className={`transition-colors group ${isSavedByMe ? "text-brand-orange" : "text-gray-500 hover:text-brand-orange"}`}>
              <Bookmark className="w-6 h-6 group-active:scale-75 transition-transform" fill={isSavedByMe ? "currentColor" : "none"} />
            </button>
          </div>
        )}

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-50 text-sm text-gray-500 flex gap-4">
          <span onClick={() => setShowLikesModal(post.likedBy)} className="cursor-pointer hover:underline hover:text-gray-800 font-medium">❤️ {post.likes} Likes</span>
          <span>💬 {post.comments?.length || 0} Comments</span>
        </div>

        {/* The Comments Section */}
        <div className="p-6 pt-2 bg-slate-50 border-t border-gray-100">
          <div className="space-y-4 mb-4">
            {post.comments?.length === 0 ? (
              <p className="text-sm text-gray-400">No comments yet.</p>
            ) : (
              post.comments.map((comment: any, index: number) => (
                <div key={index} className="flex flex-col gap-2">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                      {comment.user?.photo ? <img src={comment.user.photo} alt="user" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-blue/20 flex items-center justify-center text-xs font-bold">{comment.user?.name?.charAt(0) || "U"}</div>}
                    </div>
                    <div className="flex-1">
                      <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 inline-block">
                        <p className="text-xs font-bold text-gray-800">{comment.user?.name}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{renderTextWithMentions(comment.text)}</p>
                      </div>
                      {/* Reply button (only if logged in) */}
                      {isLoggedIn && (
                        <button onClick={() => { setReplyTarget(comment._id); setCommentInput(`@${comment.user?.username} `); document.getElementById("comment-input")?.focus(); }} className="text-[11px] font-bold text-gray-400 hover:text-brand-orange ml-2 mt-1">Reply</button>
                      )}
                    </div>
                  </div>

                  {/* Nested Replies */}
                  {comment.replies?.map((reply: any, rIndex: number) => (
                    <div key={rIndex} className="flex gap-3 ml-10 mt-2">
                      {/* 1. The Avatar Circle */}
                      <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-gray-200 bg-brand-orange text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                        {reply.user?.photo ? (
                          <img src={reply.user.photo} alt="user" className="w-full h-full object-cover" />
                        ) : (
                          reply.user?.name?.charAt(0).toUpperCase() || "U"
                        )}
                      </div>
                      
                      {/* 2. The Chat Bubble Wrapper */}
                      <div className="bg-gray-50 px-3 py-2 rounded-2xl rounded-tl-none border border-gray-100 inline-block">
                        <p className="text-[11px] font-bold text-gray-800">{reply.user?.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{renderTextWithMentions(reply.text)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Comment Input (Only shown if logged in) */}
          {isLoggedIn && (
            <form onSubmit={handleCommentSubmit} className="mt-4 flex gap-2 items-center border-t border-gray-100 pt-4">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                {userData?.Photo ? <img src={userData.Photo} alt="You" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center text-xs font-bold">{userData?.Name?.charAt(0) || "U"}</div>}
              </div>
              <input id="comment-input" type="text" placeholder="Add a cute comment..." value={commentInput} onChange={(e) => setCommentInput(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50" />
              <button type="submit" disabled={!commentInput.trim()} className="text-brand-blue font-bold text-sm px-2 disabled:opacity-50 hover:text-brand-orange">Post</button>
            </form>
          )}
        </div>
      </article>

      {/* --- LIKES MODAL --- */}
      {showLikesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Likes</h3>
              <button onClick={() => setShowLikesModal(null)} className="text-gray-400 hover:text-gray-800 font-bold px-2 text-xl">&times;</button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {showLikesModal.length === 0 ? (
                <p className="text-center text-gray-500 py-6 text-sm">No likes yet.</p>
              ) : (
                showLikesModal.map((user: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100">
                      {user.photo ? <img src={user.photo} alt={user.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold">{user.name?.charAt(0) || "U"}</div>}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{user.name}</p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SinglePost;