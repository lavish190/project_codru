import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Search, Loader2, Hash, Users, LayoutList } from "lucide-react";
import PostCard from "./PostCard"; // Adjust path if needed

export default function Explore({ currentUser, userData }: any) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Accept either ?q= (from the search bar) or ?tag= (from clicking a hashtag)
  const initialQuery = searchParams.get("q") || searchParams.get("tag") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<"top" | "accounts" | "tags">("top");
  
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({ users: [], posts: [] });

  // Fetch results whenever the URL query changes
  useEffect(() => {
    if (!initialQuery) return;
    setQuery(initialQuery);
    
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}search?q=${encodeURIComponent(initialQuery)}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch (error) {
        console.error("Explore Search Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [initialQuery]);

  // Handle local search execution
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setSearchParams({ q: query.trim() });
  };

  return (
    <div className="max-w-2xl mx-auto pt-4 sm:pt-8 pb-24 px-4 sm:px-0 animate-in fade-in duration-500">
      
      {/* Mobile Search Bar (Since Navbar search might be hidden on tiny screens) */}
      <form onSubmit={handleSearch} className="md:hidden relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search CuTe..."
          className="w-full bg-white border border-gray-200 rounded-full py-3 pl-12 pr-4 shadow-sm focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
        />
      </form>

      {/* Tabs */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1 mb-6">
        <button onClick={() => setActiveTab("top")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "top" ? "bg-brand-blue/10 text-brand-blue" : "text-gray-500 hover:text-gray-900"}`}>
          <LayoutList className="w-4 h-4" /> Top
        </button>
        <button onClick={() => setActiveTab("accounts")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "accounts" ? "bg-brand-blue/10 text-brand-blue" : "text-gray-500 hover:text-gray-900"}`}>
          <Users className="w-4 h-4" /> Accounts
        </button>
        <button onClick={() => setActiveTab("tags")} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "tags" ? "bg-brand-blue/10 text-brand-blue" : "text-gray-500 hover:text-gray-900"}`}>
          <Hash className="w-4 h-4" /> Tags
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-brand-orange" />
        </div>
      )}

      {/* Results Content */}
      {!isLoading && (
        <div className="space-y-6">
          
          {/* ACCOUNTS VIEW (Or Top view with users) */}
          {(activeTab === "accounts" || activeTab === "top") && results.users.length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-800">People</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {results.users.map((u: any) => (
                  <Link key={u._id} to={`/profile/${u.username}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-brand-orange/10 shrink-0">
                      {u.photo ? <img src={u.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-orange font-bold">{u.name?.charAt(0)}</div>}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{u.name}</h4>
                      <p className="text-sm text-gray-500">@{u.username}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* POSTS / TAGS VIEW */}
          {(activeTab === "tags" || activeTab === "top") && results.posts.length > 0 && (
            <div className="space-y-4">
              {activeTab === "top" && <h3 className="font-bold text-gray-800 px-2 mt-4">Top Posts</h3>}
              {results.posts.map((post: any) => (
                <PostCard 
                  key={post._id} 
                  post={post} 
                  currentUser={currentUser} 
                  // Pass down your standard handlers here (onLike, onSave, etc)
                />
              ))}
            </div>
          )}

          {/* EMPTY STATE */}
          {!isLoading && results.users.length === 0 && results.posts.length === 0 && initialQuery && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No results found</h3>
              <p className="text-gray-500">We couldn't find anything matching "{initialQuery}".</p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}