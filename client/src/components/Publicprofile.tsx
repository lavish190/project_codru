import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Grid } from "lucide-react";
import Publicprofilepopup from "./Publicprofilepopup";
import MyPosts from "./MyPosts";
import { optimizeImage } from "../utils/image";

function Publicprofile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [type, setType] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);

  const currentUsername = localStorage.getItem("Username");

  useEffect(() => {
    const checkFollower = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API}checkfollowing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUsername: username,
            currentUsername: currentUsername,
          }),
        });

        if (!response.ok) throw new Error("Failed to check following status");
        
        const jsonData = await response.json();
        setIsFollowing(jsonData.following);
      } catch (error) {
        console.error("Fetch operation problem:", error);
      }
    };
    
    if (currentUsername) checkFollower();
  }, [username, currentUsername]);

  const fetchUserData = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}profile/${username}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const jsonData = await res.json();
      setUser(jsonData.user);
    } catch (error) {
      console.error("Fetch operation problem:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  const handleShowPopup = (popupType: string) => {
    setType(popupType);
    setShowPopup(true);
  };

  const handleFollow = async () => {
    if (!currentUsername) {
      setLoginPromptOpen(true);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API}${isFollowing ? "unfollow" : "follow"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentUserId: currentUsername,
          targetUserId: username,
        }),
      });

      if (!res.ok) throw new Error(`Failed to ${isFollowing ? "unfollow" : "follow"} the user`);

      setIsFollowing(!isFollowing);
      fetchUserData(); // Refresh to update follower counts instantly
    } catch (error: any) {
      console.error("Follow operation problem:", error);
      alert(`There was a problem: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-brand-orange" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-gray-800">User not found</h2>
        <button onClick={() => navigate("/")} className="mt-4 text-brand-blue hover:underline">
          Go back home
        </button>
      </div>
    );
  }

  // Fallback to check either user.blogs or user.posts depending on your database schema
  const postCount = user.posts?.length || user.blogs?.length || 0;

  return (
    <div className="relative min-h-screen">
    <div className={`max-w-4xl mx-auto py-8 px-4 sm:px-0 transition-all ${showPopup ? "blur-sm" : ""}`}>
      
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center sm:items-start gap-8">
        
        {/* Avatar */}
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-white shadow-lg shrink-0 bg-brand-orange/10 flex items-center justify-center">
          {user.photo ? (
            <img src={optimizeImage(user.photo)} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl font-bold text-brand-orange">{user.name?.charAt(0).toUpperCase()}</span>
          )}
        </div>

        {/* User Info & Actions */}
        <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left w-full">
          
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-gray-800">{user.name}</h1>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-1.5">
                <p className="text-brand-blue font-medium">@{user.username}</p>
                
                {/* 🚨 UPDATED: User Type Badge with "User" fallback 🚨 */}
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  user.role?.toLowerCase() === 'teacher' ? 'bg-orange-50 text-brand-orange border-orange-100' : 
                  user.role?.toLowerCase() === 'student' ? 'bg-blue-50 text-brand-blue border-blue-100' : 
                  user.role?.toLowerCase() === 'parent' ? 'bg-rose-50 text-rose-500 border-rose-100' :
                  'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {user.role || 'User'}
                </span>

              </div>
            </div>
            
            {/* Action Button */}
            <div className="mt-4 sm:mt-0">
              {user.username !== currentUsername ? (
                <button 
                  onClick={handleFollow}
                  className={`px-8 py-2.5 rounded-full font-bold transition-all shadow-sm active:scale-95 ${
                    isFollowing 
                      ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                      : "bg-brand-orange text-white hover:bg-orange-600"
                  }`}
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
              ) : (
                <button 
                  onClick={() => {
                    navigate("/dashboard", { state: { targetView: "profile" } });
                  }}// Or wherever your edit profile page is
                  className="px-6 py-2.5 rounded-full font-bold bg-slate-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-8 mt-6 w-full justify-center sm:justify-start">
            <div className="text-center sm:text-left">
              <span className="block font-bold text-xl text-gray-800">{postCount}</span>
              <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Posts</span>
            </div>
            <div 
              onClick={() => handleShowPopup("Followers")}
              className="text-center sm:text-left cursor-pointer hover:opacity-75 transition-opacity"
            >
              <span className="block font-bold text-xl text-gray-800">{user.followers?.length || 0}</span>
              <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Followers</span>
            </div>
            <div 
              onClick={() => handleShowPopup("Following")}
              className="text-center sm:text-left cursor-pointer hover:opacity-75 transition-opacity"
            >
              <span className="block font-bold text-xl text-gray-800">{user.following?.length || 0}</span>
              <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Following</span>
            </div>
          </div>
          
        </div>
      </div>

      {/* Posts Section Divider */}
      <div className="mt-12 mb-6 flex items-center justify-center gap-2 text-gray-800">
        <Grid className="w-5 h-5" />
        <h2 className="text-xl font-bold font-display uppercase tracking-widest">Posts</h2>
      </div>
    
      {/* The beautiful Posts Grid! */}
      <div className="w-full mt-4">
        <MyPosts 
          preloadedPosts={user.posts} 
          isOwner={currentUsername === user.username} 
        />
      </div>

      </div>

      {/* Followers/Following Modal */}
      {showPopup && (
        <Publicprofilepopup
          onClose={() => setShowPopup(false)}
          showPopup={showPopup}
          setShowPopup={setShowPopup}
          type={type}
          setType={setType}
          onUpdate={fetchUserData}
          targetuser={username}
        />
      )}
      <Dialog 
        open={loginPromptOpen} 
        onClose={() => setLoginPromptOpen(false)}
        slotProps={{ paper: { style: { borderRadius: '24px', padding: '8px' } } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: '#1765a4', textAlign: 'center', fontSize: '1.5rem' }}>
          Hold on there, Explorer! 🚀
        </DialogTitle>
        <DialogContent>
          <p className="text-gray-600 text-center mt-2">
            You need to be logged in to follow <strong>@{username}</strong> and see their latest updates in your feed.
          </p>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2, gap: 2 }}>
          <Button 
            onClick={() => setLoginPromptOpen(false)} 
            color="inherit" 
            sx={{ fontWeight: 'bold', borderRadius: '12px' }}
          >
            Maybe Later
          </Button>
          <Button 
            onClick={() => navigate("/signin")} // Adjust this route if your login page is something else like "/login"
            variant="contained" 
            sx={{ bgcolor: '#ed7f23', fontWeight: 'bold', borderRadius: '12px', '&:hover': { bgcolor: '#ea580c' } }}
          >
            Log In Now
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Publicprofile;