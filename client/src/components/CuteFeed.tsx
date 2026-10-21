import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import CommentItem from "./CommentItem";
import Muialert from "./Muialert";
import RichTextEditor from "./RichTextEditor"; // 🚨 NEW: Import the rich text editor
import PostRenderer from "./PostRenderer"; // 🚨 NEW: Import the rich text renderer
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  MoreHorizontal, 
  Loader2, 
  ThumbsDown, 
  Reply,      
  MessageSquare,
  UserPlus 
} from "lucide-react";
import { UserData } from "../App";

interface CuteFeedProps {
  userData: UserData;
  refreshTrigger?: number;
}

interface PostAuthor {
  _id: string;
  name: string;
  username: string;
  photo: string;
}

interface Post {
  _id: string;
  userId: PostAuthor;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: any[];
  createdAt: string;
  likedBy: string[];
}

const CuteFeed = ({ userData, refreshTrigger }: CuteFeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null); 
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [showLikesModal, setShowLikesModal] = useState<any[] | null>(null);  
  const [replyTargets, setReplyTargets] = useState<Record<string, string | null>>({});
  
  const currentUsername = localStorage.getItem("Username");
  const currentUserId = localStorage.getItem("userId");
  
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"success" | "error" | "info" | "warning">("success");
  const [followingUsernames, setFollowingUsernames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPosts();
    fetchFollowingList(); 
  }, [refreshTrigger]);

  const fetchFollowingList = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const fList = data.user.following.map((f: any) => f.username);
        setFollowingUsernames(fList);
      }
    } catch (err) {
      console.error("Failed to fetch following list", err);
    }
  };

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwtoken");
      
      const res = await fetch(`${import.meta.env.VITE_API}posts`, { 
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load feed");
      const data = await res.json();
      setPosts(data);

      const savedRes = await fetch(`${import.meta.env.VITE_API}saved-posts/ids`, { 
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (savedRes.ok) {
        const savedData = await savedRes.json();
        setSavedPostIds(savedData); 
      }
    } catch (err: any) {
      setError(err.message || "Could not load posts.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async (targetUsername: string) => {
    try {
      const token = localStorage.getItem("jwtoken");
      setFollowingUsernames(prev => [...prev, targetUsername]);

      const res = await fetch(`${import.meta.env.VITE_API}follow`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          currentUserId: currentUsername, 
          targetUserId: targetUsername 
        })
      });

      if (!res.ok) {
        setFollowingUsernames(prev => prev.filter(u => u !== targetUsername));
      }
    } catch (error) {
      console.error("Follow failed", error);
      setFollowingUsernames(prev => prev.filter(u => u !== targetUsername));
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(posts.map(p => p._id === postId ? { ...p, likes: updatedPost.likes, likedBy: updatedPost.likedBy } : p));
      }
    } catch (error) {
      console.error("Failed to like post", error);
    }
  };

  const handleSave = async (postId: string) => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}/save`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        if (savedPostIds.includes(postId)) {
          setSavedPostIds(savedPostIds.filter(id => id !== postId));
        } else {
          setSavedPostIds(prev => [...prev, postId]);
        }
      }
    } catch (error) {
      console.error("Failed to save post", error);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleCommentSubmit = async (postId: string, e?: React.FormEvent, parentId?: string, manualText?: string) => {
    if (e) e.preventDefault();
    
    const text = manualText || commentInputs[postId];
    if (!text?.trim() || isSubmitting[postId]) return;

    setIsSubmitting(prev => ({ ...prev, [postId]: true }));

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ text, parentId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setPosts(prevPosts => prevPosts.map(p => p._id === postId ? { ...p, comments: data.comments } : p));
        setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      }
    } catch (error) {
      console.error("Failed to post comment", error);
      setAlertMessage("Failed to post comment");
      setAlertSeverity("error");
      setShowAlert(true);
    } finally {
      setIsSubmitting(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleCommentDelete = async (postId: string, commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setPosts((prevPosts) => 
          prevPosts.map(p => p._id === postId ? { ...p, comments: data.comments } : p)
        );
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to delete comment");
      }
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-brand-orange">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 font-medium py-10">{error}</div>;
  }

  const renderTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => 
      part.startsWith('@') ? (
        <span key={i} className="text-brand-orange font-semibold cursor-pointer hover:underline">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setPosts(posts.filter(p => p._id !== postId));
      }
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleEditSubmit = async (postId: string) => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ content: editContent })
      });
      if (res.ok) {
        setPosts(posts.map(p => p._id === postId ? { ...p, content: editContent } : p));
        setEditingPostId(null);
      }
    } catch (err) {
      console.error("Failed to edit", err);
    }
  };

  const handleShare = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url);
    setAlertMessage("🔗 Link copied to clipboard!");
    setAlertSeverity("success");
    setShowAlert(true);
  };

  const handleCommentVote = async (postId: string, commentId: string) => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}comment/${commentId}/vote`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
      });

      if (res.ok) {
        const updatedData = await res.json(); 
        
        setPosts((prevPosts) => prevPosts.map((post) => {
          if (post._id !== postId) return post;

          const updateRecursive = (comments: any[]): any[] => {
            return comments.map((c) => {
              if (c._id === commentId) {
                return { ...c, likes: updatedData.likes, likedBy: updatedData.likedBy };
              }
              if (c.replies) return { ...c, replies: updateRecursive(c.replies) };
              return c;
            });
          };

          return { ...post, comments: updateRecursive(post.comments) };
        }));
      }
    } catch (error) {
      console.error("Vote failed", error);
    }
  };

  const handleCommentReply = async (postId: string, parentId: string, text: string) => {
    if (!text.trim() || isSubmitting[parentId]) return;
    setIsSubmitting(prev => ({ ...prev, [parentId]: true }));

    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}posts/${postId}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          text: text,
          parentId: parentId 
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(posts.map(p => p._id === postId ? { ...p, comments: data.comments } : p));
      }
    } catch (error) {
      console.error("Failed to post reply", error);
    } finally {
      setIsSubmitting(prev => ({ ...prev, [parentId]: false }));
    }
  };

  return (
    <>
      <style>
        {`
          /* Tiptap HTML Content Styling */
          .tiptap-content ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 0.5rem; }
          .tiptap-content p { margin-bottom: 0.5rem; }
          .tiptap-content p:last-child { margin-bottom: 0; }
          .tiptap-content strong { font-weight: bold; }
          .tiptap-content em { font-style: italic; }
          .tiptap-content s { text-decoration: line-through; }
          /* Mention & Hashtag styling matching CreatePost */
          .tiptap-content [data-type="mention"] { color: #f97316; font-weight: bold; background-color: #fff7ed; padding: 0.125rem 0.25rem; border-radius: 0.375rem; cursor: pointer; }
          .tiptap-content [data-type="hashtag"] { color: #3b82f6; font-weight: bold; background-color: #eff6ff; padding: 0.125rem 0.25rem; border-radius: 0.375rem; cursor: pointer; }
        `}
      </style>
      <div className="max-w-2xl mx-auto space-y-8 py-6 pb-20 hide-scrollbar">
        {posts.length === 0 ? (
          <div className="text-center text-gray-400 py-10 font-display text-xl">
            No posts yet. Be the first to share something cute!
          </div>
        ) : (
          posts.map((post) => (
            <article 
              key={post._id} 
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300"
            >
              {/* Post Header */}
              <div className="flex items-center justify-between p-4">
                
                <div className="flex items-center gap-3">
                  <Link to={`/profile/${post.userId?.username}`} className="flex items-center gap-3 group cursor-pointer">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 transform group-hover:scale-105 transition-transform">
                      {post.userId?.photo ? (
                        <img src={post.userId.photo} alt={post.userId.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-orange/20 text-brand-orange flex items-center justify-center font-bold">
                          {post.userId?.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm group-hover:text-brand-orange transition-colors">
                        {post.userId?.name || "Unknown User"}
                      </h3>
                      <div className="flex items-center text-xs text-gray-400 gap-1">
                        <span className="group-hover:text-brand-blue transition-colors">@{post.userId?.username || "user"}</span>
                        <span>•</span>
                        <span>{timeAgo(post.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  
                  {post.userId._id === currentUserId ? (
                    <div className="relative">
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === post._id ? null : post._id)}
                        className="text-gray-400 hover:text-brand-blue p-2 rounded-full hover:bg-gray-50 transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      
                      {openMenuId === post._id && (
                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-10">
                          <button 
                            onClick={() => { setEditingPostId(post._id); setEditContent(post.content); setOpenMenuId(null); }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            Edit Post
                          </button>
                          <button 
                            onClick={() => handleDeletePost(post._id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    post.userId.username && !followingUsernames.includes(post.userId.username) && (
                      <button 
                        onClick={() => handleFollow(post.userId.username)}
                        className="flex items-center gap-1.5 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                      >
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </button>
                    )
                  )}
                </div>

              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <div className="w-full max-h-150 overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img 
                    src={post.imageUrl} 
                    alt="Post content"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Post Content */}
              <div className="p-4">
                {editingPostId === post._id ? (
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
                      <button onClick={() => setEditingPostId(null)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                      <button onClick={() => handleEditSubmit(post._id)} disabled={!editContent.trim()} className="text-xs font-bold bg-brand-orange text-white px-3 py-1.5 rounded-full">Save</button>
                    </div>
                  </div>
                ) : (
                  <PostRenderer content={post.content} />
                )}
              </div>

              {/* Action Bar */}
              <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleLike(post._id)}
                      className={`transition-colors group ${
                        post.likedBy?.some((u: any) => (u._id || u) === currentUserId) 
                          ? "text-red-500" 
                          : "text-gray-500 hover:text-red-500"
                      }`}
                    >
                      <Heart 
                        className="w-6 h-6 group-active:scale-75 transition-transform" 
                        fill={post.likedBy?.some((u: any) => (u._id || u) === currentUserId) ? "currentColor" : "none"} 
                      />
                    </button>
                    <span 
                      onClick={() => setShowLikesModal(post.likedBy)}
                      className="text-sm font-semibold text-gray-500 hover:underline cursor-pointer"
                    >
                      {post.likes || 0}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => toggleComments(post._id)}
                    className="flex items-center gap-2 text-gray-500 hover:text-brand-blue transition-colors group"
                  >
                    <MessageCircle className="w-6 h-6 group-active:scale-75 transition-transform" />
                    <span className="text-sm font-semibold">{post.comments?.length || 0}</span>
                  </button>

                  <button 
                    onClick={() => handleShare(post._id)}
                    className="flex items-center gap-2 text-gray-500 hover:text-green-500 transition-colors group"
                  >
                    <Share2 className="w-5 h-5 group-active:scale-75 transition-transform" />
                  </button>
                </div>

                <button 
                  onClick={() => handleSave(post._id)}
                  className={`transition-colors group ${
                    savedPostIds.includes(post._id) 
                      ? "text-brand-orange" 
                      : "text-gray-500 hover:text-brand-orange"
                  }`}
                >
                  <Bookmark 
                    className="w-6 h-6 group-active:scale-75 transition-transform" 
                    fill={savedPostIds.includes(post._id) ? "currentColor" : "none"}
                  />
                </button>
              </div>

              {/* Comments Section */}
              {expandedComments[post._id] && (
              <div className="px-4 pb-4 border-t border-gray-50 bg-slate-50/50">
                <div className="max-h-96 overflow-y-auto custom-scrollbar py-3">
                  {(!post.comments || post.comments.length === 0) ? (
                    <p className="text-xs text-center text-gray-400 py-4">No comments yet. ✨</p>
                  ) : (
                    post.comments.map((comment: any) => (
                      <CommentItem 
                        key={comment._id} 
                        comment={comment} 
                        postId={post._id}
                        currentUserId={currentUserId}
                        onVote={handleCommentVote}
                        onReply={handleCommentReply}
                        onDelete={handleCommentDelete}
                        isSubmitting={isSubmitting}
                      />
                    ))
                  )}
                  </div>
                  <form 
                    onSubmit={(e) => handleCommentSubmit(post._id, e)} 
                    className="mt-2 flex gap-2 items-center"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                      {userData?.Photo ? (
                        <img src={userData.Photo} alt="You" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center text-xs font-bold">
                          {userData?.Name?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Add a cute comment..."
                      value={commentInputs[post._id] || ""}
                      onChange={(e) => setCommentInputs({ ...commentInputs, [post._id]: e.target.value })}
                      className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                    />
                    <button 
                      type="submit"
                      disabled={!commentInputs[post._id]?.trim() || isSubmitting[post._id]}
                      className="text-brand-blue font-bold text-sm px-2 disabled:opacity-50 hover:text-brand-orange transition-colors"
                    >
                      {isSubmitting[post._id] ? "Posting..." : "Post"}
                    </button>
                  </form>
                </div>
              )}
            </article>
          ))
        )}

        {/* Likes Modal */}
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
        {showAlert && (
          <Muialert 
            message={alertMessage} 
            severity={alertSeverity} 
            onClose={() => setShowAlert(false)} 
          />
        )}
      </div>
    </>
  );
};

export default CuteFeed;