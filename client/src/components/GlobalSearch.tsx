import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { optimizeImage } from "../utils/image";

const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{users: any[], posts: any[]}>({ users: [], posts: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const navigate = useNavigate();
  const searchRef = useRef<HTMLFormElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch results as user types (Hitting our new unified search route!)
  useEffect(() => {
    const fetchSearch = async () => {
      if (query.length < 2) {
        setResults({ users: [], posts: [] });
        return;
      }
      setIsLoading(true);
      try {
        const token = localStorage.getItem("jwtoken");
        const res = await fetch(`${import.meta.env.VITE_API}search?q=${encodeURIComponent(query)}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchSearch, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  // Action 1: Click a specific user -> Go to their profile
  const handleUserSelect = (username: string) => {
    setQuery("");
    setIsOpen(false);
    navigate(`/profile/${username}`);
  };

  // Action 2: Hit Enter OR click "See all results" -> Go to Explore page
  const handleFullSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setIsOpen(false);
    navigate(`/explore?q=${encodeURIComponent(query.trim())}`);
    (document.activeElement as HTMLElement)?.blur();
  };

  return (
    <form ref={searchRef} onSubmit={handleFullSearch} className="relative w-full max-w-md mx-4 group">
      
      {/* Search Input */}
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isOpen ? 'text-brand-blue' : 'text-gray-400'}`} />
      <input
        type="text"
        placeholder="Search posts, #hashtags, or people..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length >= 2 && setIsOpen(true)}
        className="w-full pl-10 pr-10 py-2.5 bg-slate-100 border-none rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
      />
      
      {/* Clear Button */}
      {query && (
        <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Upgraded Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[1000]">
          {isLoading ? (
            <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-orange" /></div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto flex flex-col">
              
              {/* Quick People Results */}
              {results.users && results.users.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">People</div>
                  {results.users.slice(0, 4).map((user: any) => (
                    <div 
                      key={user._id}
                      onClick={() => handleUserSelect(user.username)}
                      className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-orange/10 flex items-center justify-center shrink-0">
                        {user.photo ? (
                          <img src={optimizeImage(user.photo)} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-brand-orange font-bold text-xs">{user.name?.charAt(0)}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 leading-tight">{user.name}</span>
                        <span className="text-xs text-gray-500">@{user.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* The "See All / Explore" Button */}
              <div 
                onClick={() => handleFullSearch()}
                className="mt-auto p-4 bg-gray-50 hover:bg-brand-blue/5 border-t border-gray-100 cursor-pointer flex items-center justify-between text-brand-blue transition-colors group"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Search for "{query}"</span>
                  <span className="text-xs text-gray-500 group-hover:text-brand-blue/70 transition-colors">See posts, hashtags, and all accounts</span>
                </div>
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
              </div>

            </div>
          )}
        </div>
      )}
    </form>
  );
};

export default GlobalSearch;