import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Edit, Trash2, ExternalLink, X, Loader2, Image as ImageIcon, FileText, Calendar } from "lucide-react";
import Muialert from "./Muialert";
import RichTextEditor from "./RichTextEditor";
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
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditingBlog({ ...editingBlog, coverImage: reader.result as string, newImageFile: file });
      reader.readAsDataURL(file);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalImageUrl = editingBlog.coverImage;

      // Upload new image if one was selected
      if (editingBlog.newImageFile) {
        const formData = new FormData();
        formData.append("file", editingBlog.newImageFile);
        formData.append("upload_preset", "cute_profiles"); 
        formData.append("cloud_name", "da6jhcsmm");       

        const cloudinaryRes = await fetch("https://api.cloudinary.com/v1_1/da6jhcsmm/image/upload", { 
          method: "POST", body: formData 
        });
        if (!cloudinaryRes.ok) throw new Error("Failed to upload cover image");
        const cloudinaryData = await cloudinaryRes.json();
        finalImageUrl = cloudinaryData.secure_url;
      }

      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${import.meta.env.VITE_API}blogs/${editingBlog._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          title: editingBlog.title,
          summary: editingBlog.summary,
          content: editingBlog.content,
          coverImage: finalImageUrl,
          category: editingBlog.category,
          authorName: editingBlog.authorName
        })
      });

      if (!res.ok) throw new Error("Failed to update blog");

      setAlert({ show: true, message: "Blog updated! Site is rebuilding.", type: "success" });
      setEditingBlog(null);
      fetchBlogs(); // Refresh list

    } catch (error: any) {
      setAlert({ show: true, message: error.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (editingBlog) {
    return (
      <div className=" w-full pb-10">
        <form onSubmit={handleEditSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-gray-800">Edit Blog Post</h2>
            <button type="button" onClick={() => setEditingBlog(null)} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
          </div>
            
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Blog Title</label>
                <input type="text" value={editingBlog.title} onChange={e => setEditingBlog({...editingBlog, title: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Category</label>
                <input type="text" value={editingBlog.category} onChange={e => setEditingBlog({...editingBlog, category: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Summary</label>
              <textarea value={editingBlog.summary} onChange={e => setEditingBlog({...editingBlog, summary: e.target.value})} className="w-full h-24 bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 resize-none custom-scrollbar" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cover Image</label>
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 max-h-64 flex justify-center group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <img src={editingBlog.coverImage} alt="Cover" className="object-contain w-full h-full group-hover:opacity-50 transition" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition font-bold text-gray-900 drop-shadow-md">Click to Change Image</div>
              </div>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Main Content</label>
              <div className="border border-brand-orange/50 rounded-2xl overflow-hidden bg-white flex flex-col min-h-[400px]">
                <RichTextEditor value={editingBlog.content} onChange={(html) => setEditingBlog({...editingBlog, content: html})} showToolbar={true} className="min-h-[400px] text-lg" />
              </div>
            </div>
            
            <div className="space-y-2 md:w-1/2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Author Name</label>
              <input type="text" value={editingBlog.authorName} onChange={e => setEditingBlog({...editingBlog, authorName: e.target.value})} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800" />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-gray-100 flex items-center justify-end gap-4">
            <button type="button" onClick={() => setEditingBlog(null)} className="px-6 py-2.5 rounded-full font-bold text-gray-500 hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex items-center gap-2 bg-brand-orange text-white px-8 py-2.5 rounded-full font-bold shadow-md hover:bg-orange-600 transition-all disabled:opacity-50">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
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
