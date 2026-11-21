import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, UserPlus, Trash2, Edit2, ChevronLeft, ChevronRight } from "lucide-react";
import PostRenderer from "./PostRenderer";
import CommentItem from "./CommentItem";
import { optimizeImage } from "../utils/image";

export default function PostCard({ 
  post, 
  currentUser,
  isSingleView = false,
  onLike, 
  onSave, 
  onDelete, 
  onEdit, // 🚨 Added onEdit prop
  onFollow,
  savedPostIds = [],
  followingUsernames = [],
  onCommentSubmit,
  onCommentVote,
  onCommentReply,
  onCommentDelete
}: any) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null); // 🚨 Ref for outside click detection

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showComments, setShowComments] = useState(isSingleView);
  const [commentText, setCommentText] = useState("");

  const isLikedByMe = post.likedBy?.some((u: any) => (u._id || u) === currentUser?.id);
  const isSavedByMe = savedPostIds.includes(post._id);
  const isMyPost = post.userId?._id === currentUser?.id;
  const timeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return "Just now";
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    
    const weeks = Math.floor(days / 7);
    if (weeks < 52) return `${weeks}w`;
    
    const years = Math.floor(weeks / 52);
    return `${years}y`;
  };

  const images = post.images?.length > 0 ? post.images : (post.imageUrl ? [post.imageUrl] : []);

  // 🚨 Handle clicking outside the 3-dot menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  return (
    <article className={`bg-white sm:rounded-3xl shadow-sm sm:border border-y border-gray-100 overflow-hidden mb-2 sm:mb-6 ${isSingleView ? "w-full border-x" : "-mx-4 sm:mx-0"}`}>
      
      {/* 1. Header */}
      <div className="flex items-center justify-between p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.userId?.username}`} className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 shrink-0">
            {post.userId?.photo ? <img src={optimizeImage(post.userId.photo)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center font-bold">{post.userId?.name?.charAt(0)}</div>}
          </Link>
          <div className="leading-tight">
            <Link to={`/profile/${post.userId?.username}`} className="font-bold text-gray-900 text-sm hover:underline">{post.userId?.name}</Link>
            <div className="flex items-center text-xs text-gray-500 gap-1">
              <span>@{post.userId?.username}</span>
              <span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isMyPost && !followingUsernames.includes(post.userId?.username) && (
             <button onClick={() => onFollow(post.userId?.username)} className="hidden sm:flex items-center gap-1 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors">
               <UserPlus className="w-3.5 h-3.5" /> Follow
             </button>
          )}
          {isMyPost && (
            <div className="relative" ref={menuRef}>
              <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="text-gray-400 p-2 rounded-full hover:bg-gray-50"><MoreHorizontal className="w-5 h-5" /></button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 z-20 overflow-hidden">
                  {/* 🚨 Added Edit Button */}
                  {onEdit && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowMenu(false); 
                        onEdit(post); 
                      }} 
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Post
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(post._id);
                    }} 
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 font-medium"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Content */}
      <div className="px-3 sm:px-4 pb-2">
        <PostRenderer content={post.content} />
      </div>

      {/* 3. Media Carousel */}
      {images.length > 0 && (
        <div className="relative w-full bg-gray-50 flex items-center justify-center group border-y border-gray-50">
          <img src={optimizeImage(images[activeImageIndex])} alt="Post media" className="w-full h-auto max-h-[70vh] object-contain" />
          
          {images.length > 1 && (
            <>
              <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-md">
                {activeImageIndex + 1}/{images.length}
              </div>
              {activeImageIndex > 0 && (
                <button onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => prev - 1); }} className="absolute left-2 p-1.5 bg-white/80 hover:bg-white rounded-full shadow-sm opacity-0 sm:group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-5 h-5 text-gray-800" /></button>
              )}
              {activeImageIndex < images.length - 1 && (
                <button onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => prev + 1); }} className="absolute right-2 p-1.5 bg-white/80 hover:bg-white rounded-full shadow-sm opacity-0 sm:group-hover:opacity-100 transition-opacity"><ChevronRight className="w-5 h-5 text-gray-800" /></button>
              )}
            </>
          )}
        </div>
      )}

      {/* 4. Action Bar */}
      <div className="px-3 sm:px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5 sm:gap-6">
          <button onClick={() => onLike(post._id)} className={`flex items-center gap-1.5 transition-colors group ${isLikedByMe ? "text-red-500" : "text-gray-600 hover:text-red-500"}`}>
            <Heart className="w-6 h-6 sm:w-7 sm:h-7 group-active:scale-75 transition-transform" fill={isLikedByMe ? "currentColor" : "none"} strokeWidth={1.5} />
            <span className="text-sm font-semibold">{post.likes || 0}</span>
          </button>
          
          <button onClick={() => isSingleView ? document.getElementById("comment-input")?.focus() : setShowComments(!showComments)} className="flex items-center gap-1.5 text-gray-600 hover:text-brand-blue transition-colors group">
            <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 group-active:scale-75 transition-transform" strokeWidth={1.5} />
            <span className="text-sm font-semibold">{post.comments?.length || 0}</span>
          </button>

          <button onClick={() => { navigator.clipboard.writeText(`https://curiousteamlearning.com/post/${post.slug || post._id}.html`); alert("Link copied!");}} className="text-gray-600 hover:text-green-500 transition-colors group">
            <Share2 className="w-5 h-5 sm:w-6 sm:h-6 group-active:scale-75 transition-transform" strokeWidth={1.5} />
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex gap-1.5 absolute left-1/2 -translate-x-1/2 mt-1">
            {images.map((_, idx) => (
              <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === activeImageIndex ? 'bg-brand-blue' : 'bg-gray-300'}`} />
            ))}
          </div>
        )}

        <button onClick={() => onSave(post._id)} className={`transition-colors group ${isSavedByMe ? "text-brand-orange" : "text-gray-600 hover:text-brand-orange"}`}>
          <Bookmark className="w-6 h-6 sm:w-7 sm:h-7 group-active:scale-75 transition-transform" fill={isSavedByMe ? "currentColor" : "none"} strokeWidth={1.5} />
        </button>
      </div>

      {/* 5. Comments Section */}
      {(showComments || isSingleView) && (
        <div className="px-3 sm:px-4 pb-4 bg-slate-50/50 border-t border-gray-50">
          
          <form onSubmit={(e) => { e.preventDefault(); onCommentSubmit(post._id, commentText); setCommentText(""); }} className="mt-4 flex gap-2 items-center">
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200 hidden sm:block">
              {currentUser?.photo ? <img src={optimizeImage(currentUser.photo)} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-brand-orange text-white flex items-center justify-center text-xs font-bold">U</div>}
            </div>
            <input id="comment-input" type="text" placeholder="Add a cute comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50" />
            <button type="submit" disabled={!commentText.trim()} className="text-brand-blue font-bold text-sm px-2 disabled:opacity-50">Post</button>
          </form>
        </div>
      )}
    </article>
  );
}