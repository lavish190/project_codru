import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash2, Loader2, FileText, Calendar } from "lucide-react";
import Muialert from "./Muialert";
import CreateBlog from "./CreateBlog"; // 🚨 IMPORT THE UNIFIED COMPONENT
import { UserData } from "../App";

interface ManageBlogsProps {
  userData: UserData;
}

const ManageBlogs = ({ userData }: ManageBlogsProps) => {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: "", type: "success" as "success" | "error" });
  
  // Edit Mode State
  const [editingBlog, setEditingBlog] = useState<any | null>(null);

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

  // 🚨 IF EDITING, RENDER THE UNIFIED COMPONENT
  if (editingBlog) {
    return (
      <CreateBlog 
        userData={userData} 
        editBlogData={editingBlog} 
        onEditComplete={() => {
          setEditingBlog(null); // Close edit view
          fetchBlogs();         // Refresh the table with new data
        }} 
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full pb-10">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-slate-50 flex items-center gap-3">
          <FileText className="text-brand-blue w-6 h-6" />
          <h2 className="text-xl font-display font-bold text-gray-800">Manage Published Blogs</h2>
        </div>

        {isLoading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 text-brand-blue animate-spin" /></div>
        ) : blogs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 font-bold">No blogs published yet.</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-4 pl-6">Article</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Date & Author</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {blogs.map(blog => (
                  <tr key={blog._id} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4 pl-6 flex items-center gap-4">
                      <div className="w-16 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                        <img src={blog.coverImage} className="w-full h-full object-cover" alt="cover" />
                      </div>
                      <div className="min-w-0 max-w-xs md:max-w-md">
                        <p className="font-bold text-gray-800 truncate">{blog.title}</p>
                        <p className="text-xs text-gray-500 truncate" dangerouslySetInnerHTML={{ __html: blog.summary }}></p>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-brand-orange">{blog.category}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1"><Calendar size={12}/> {new Date(blog.publishedAt).toLocaleDateString()}</div>
                      <div className="text-sm font-bold text-gray-700">{blog.authorName}</div>
                    </td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingBlog(blog)} className="p-2 text-brand-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition" title="Edit"><Edit size={16}/></button>
                        <button onClick={() => handleDelete(blog._id, blog.title)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition" title="Delete"><Trash2 size={16}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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