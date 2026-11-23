import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash2, Loader2, FileText, Calendar, Clock, CheckCircle2 } from "lucide-react";
import Muialert from "./Muialert";
import CreateBlog from "./CreateBlog";
import { UserData } from "../App";
import { optimizeImage } from "../utils/image";

interface ManageBlogsProps {
  userData: UserData;
}

type FilterType = "all" | "published" | "scheduled";

const ManageBlogs = ({ userData }: ManageBlogsProps) => {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });
  
  const [editingBlog, setEditingBlog] = useState<any | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const fetchBlogs = async () => {
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}blogs/manage`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) setBlogs(await res.json());
    } catch (error) {
      console.error("Failed to fetch blogs", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}blogs/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to delete blog");
      
      setAlert({ show: true, message: "Blog deleted. Cloudflare is rebuilding the site.", type: "success" });
      setBlogs(prev => prev.filter(b => b._id !== id));
    } catch (error: any) {
      setAlert({ show: true, message: error.message, type: "error" });
    }
  };

  // Derive filtered blogs safely (treating older blogs without a status as 'published')
  const filteredBlogs = blogs.filter(blog => {
    if (filter === "all") return true;
    const computedStatus = blog.status === "scheduled" ? "scheduled" : "published";
    return computedStatus === filter;
  });

  if (editingBlog) {
    return (
      <CreateBlog 
        userData={userData} 
        editBlogData={editingBlog} 
        onEditComplete={() => {
          setEditingBlog(null);
          fetchBlogs();
        }} 
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full pb-10 sm:px-4">
      
      {/* 🚨 HEADER & SEGMENTED TABS (APPLE STYLE) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 px-4 sm:px-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-gray-900">Manage Articles</h2>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-0.5">Marketing Blog</p>
          </div>
        </div>

        <div className="bg-gray-100/80 backdrop-blur-sm p-1 rounded-xl flex items-center shadow-inner self-start md:self-auto w-full md:w-auto">
          {(["all", "published", "scheduled"] as FilterType[]).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 md:flex-none capitalize px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                filter === type 
                  ? "bg-white text-brand-blue shadow-sm ring-1 ring-gray-900/5" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white md:rounded-3xl shadow-sm border-y md:border border-gray-100 overflow-hidden">
        
        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-brand-blue animate-spin" /></div>
        ) : filteredBlogs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No blogs found</h3>
            <p className="text-sm text-gray-500 mt-1">There are no {filter !== 'all' ? filter : ''} blogs to display here.</p>
          </div>
        ) : (
          <>
            {/* ==========================================
                1. DESKTOP VIEW (CLEAN TABLE)
            ========================================== */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-gray-100 text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="p-4 pl-6">Article</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Date & Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBlogs.map(blog => (
                    <tr key={blog._id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="p-4 pl-6 flex items-center gap-4">
                        <div className="w-20 h-14 rounded-xl overflow-hidden bg-gray-50 shrink-0 border border-gray-200 shadow-sm">
                          <img src={optimizeImage(blog.coverImage)} className="w-full h-full object-cover" alt="cover" />
                        </div>
                        <div className="min-w-0 max-w-sm">
                          <p className="font-bold text-gray-900 truncate mb-0.5">{blog.title}</p>
                          <p className="text-xs text-gray-500 truncate" dangerouslySetInnerHTML={{ __html: blog.summary }}></p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-block bg-blue-50 text-brand-blue text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                          {blog.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-900 font-bold mb-1">
                          {blog.status === "scheduled" ? (
                            <><Clock size={14} className="text-amber-500"/> {new Date(blog.scheduledFor).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</>
                          ) : (
                            <><Calendar size={14} className="text-brand-blue"/> {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString()}</>
                          )}
                        </div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                          {blog.status === "scheduled" ? (
                            <span className="text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">Scheduled</span>
                          ) : (
                            <span className="text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"><CheckCircle2 size={10}/> Published</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 pr-6">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingBlog(blog)} className="p-2 text-brand-blue bg-white border border-gray-200 hover:border-brand-blue hover:bg-blue-50 rounded-xl shadow-sm transition-all" title="Edit"><Edit size={16}/></button>
                          <button onClick={() => handleDelete(blog._id, blog.title)} className="p-2 text-red-500 bg-white border border-gray-200 hover:border-red-500 hover:bg-red-50 rounded-xl shadow-sm transition-all" title="Delete"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ==========================================
                2. MOBILE VIEW (STACKED CARDS)
            ========================================== */}
            <div className="md:hidden flex flex-col divide-y divide-gray-100 bg-slate-50">
              {filteredBlogs.map(blog => (
                <div key={blog._id} className="bg-white p-4 sm:p-5 flex flex-col gap-4 transition-colors hover:bg-gray-50/50">
                  
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0 shadow-sm">
                      <img src={optimizeImage(blog.coverImage)} className="w-full h-full object-cover" alt="cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-brand-orange uppercase tracking-widest truncate">{blog.category}</span>
                        {blog.status === "scheduled" && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                            <Clock size={10}/> Scheduled
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 text-sm">{blog.title}</h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-900 flex items-center gap-1">
                        <Calendar size={12} className={blog.status === "scheduled" ? "text-amber-500" : "text-brand-blue"}/> 
                        {blog.status === "scheduled" 
                          ? new Date(blog.scheduledFor).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                          : new Date(blog.publishedAt || blog.createdAt).toLocaleDateString()
                        }
                      </span>
                      <span className="text-[10px] font-medium text-gray-500 mt-0.5">{blog.authorName}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setEditingBlog(blog)} className="h-9 px-3 flex items-center justify-center text-brand-blue bg-blue-50 rounded-xl font-bold text-xs active:scale-95 transition-transform">
                        <Edit size={14} className="mr-1.5"/> Edit
                      </button>
                      <button onClick={() => handleDelete(blog._id, blog.title)} className="h-9 w-9 flex items-center justify-center text-red-500 bg-red-50 rounded-xl active:scale-95 transition-transform">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {alert.show && createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100000] w-full max-w-md px-4">
          <Muialert message={alert.message} severity={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
        </div>, document.body
      )}
    </div>
  );
};

export default ManageBlogs;