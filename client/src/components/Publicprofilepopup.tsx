import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Search, Loader2, UserMinus, UserPlus } from "lucide-react";
import { optimizeImage } from "../utils/image";

const Publicprofilepopup = ({
  type,
  setType,
  onClose,
  setShowPopup,
  onUpdate,
  targetuser,
}: any) => {
  const [usersocialData, setUserSocialData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const currentUsername = localStorage.getItem("Username");

  useEffect(() => {
    const fetchSocialData = async () => {
      setLoading(true);
      try {
        // 1. Fetch current user's following list to show "Follow/Unfollow" buttons correctly
        const resMyProfile = await fetch(`${import.meta.env.VITE_API}profile/${currentUsername}`);
        const myData = await resMyProfile.json();
        setFollowingList(myData.user.following);

        // 2. Fetch the target user's followers/following
        const resTarget = await fetch(`${import.meta.env.VITE_API}profile/${targetuser}`);
        const targetData = await resTarget.json();
        
        const list = type === "Followers" ? targetData.user.followers : targetData.user.following;
        setUserSocialData(list);
        setFilteredData(list);
      } catch (error) {
        console.error("Error fetching social data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSocialData();
  }, [type, targetuser, currentUsername]);

  // Handle Search Filtering
  useEffect(() => {
    const results = usersocialData.filter(user =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredData(results);
  }, [searchTerm, usersocialData]);

  const handleAction = async (targetUsername: string, action: 'follow' | 'unfollow') => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API}${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentUserId: currentUsername,
          targetUserId: targetUsername,
        }),
      });

      if (res.ok) {
        // Refresh following list to update UI buttons
        const resMyProfile = await fetch(`${import.meta.env.VITE_API}profile/${currentUsername}`);
        const myData = await resMyProfile.json();
        setFollowingList(myData.user.following);
        onUpdate(); // Update counts on the profile page
      }
    } catch (error) {
      console.error(`Error during ${action}:`, error);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">{type}</h2>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Toggle Tabs */}
          <div className="flex gap-4 mb-4">
            {["Followers", "Following"].map((tab) => (
              <button
                key={tab}
                onClick={() => setType(tab)}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                  type === tab 
                  ? "bg-brand-blue text-white shadow-md shadow-brand-blue/20" 
                  : "bg-slate-50 text-gray-400 hover:bg-gray-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-blue/20 outline-none"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
              <p className="text-xs text-gray-400 font-medium">Fetching users...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              No users found.
            </div>
          ) : (
            filteredData.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors group">
                <div 
                  onClick={() => { navigate(`/profile/${user.username}`); onClose(); }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-100 bg-brand-orange/10 flex items-center justify-center">
                    {user.photo ? (
                      <img src={optimizeImage(user.photo)} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-brand-orange font-bold">{user.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">@{user.username}</h4>
                    <p className="text-xs text-gray-500">{user.name}</p>
                  </div>
                </div>

                {/* Action Button (Don't show for yourself) */}
                {user.username !== currentUsername && (
                  followingList.some(f => f.username === user.username) ? (
                    <button 
                      onClick={() => handleAction(user.username, 'unfollow')}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      title="Unfollow"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleAction(user.username, 'follow')}
                      className="p-2 text-brand-blue hover:bg-brand-blue/10 rounded-xl transition-all"
                      title="Follow"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Publicprofilepopup;