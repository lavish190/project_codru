import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Maximize, ChevronRight, ChevronDown, Move, Save, Settings2, X, Layout } from 'lucide-react';

// Widget Imports
import TasksWidget from './widgets/TasksWidget';
import PlanetWidget from './widgets/PlanetWidget';
import LeadsWidget from './widgets/LeadsWidget';
import UpcomingWidget from './widgets/UpcomingWidget';
import PostWidget from './widgets/PostWidget';
import SupportCircleWidget from './widgets/SupportCircleWidget';
import CourseWidget from './widgets/CourseWidget';
import SyllabusWidget from './widgets/SyllabusWidget';
import AuditWidget from './widgets/AuditWidget';
import UsersWidget from './widgets/UsersWidget';
import WhatsAppWidget from './widgets/WhatsAppWidget';
import StudentWidget from './widgets/StudentWidget';

const WIDGET_CONFIG: any = {
  tasks: { roles: ['cute_team', 'admin', 'verified_teacher'], component: TasksWidget },
  last_planet: { roles: ['student'], component: PlanetWidget },
  team_pipeline: { roles: ['cute_team', 'admin'], component: LeadsWidget },
  classes: { roles: ['user', 'student', 'parent', 'teacher', 'admin', 'cute_team', 'verified_teacher', 'verified_parent'], component: UpcomingWidget },
  feed: { roles: ['student', 'user', 'teacher', 'admin', 'parent', 'verified_teacher', 'verified_parent', 'cute_team'], component: PostWidget },
  support_circle: { roles: ['parent', 'verified_parent'], component: SupportCircleWidget },
  courses: { roles: ['student', 'teacher'], component: CourseWidget },
  syllabus: { roles: ['student', 'teacher'], component: SyllabusWidget },
  audit: { roles: ['admin'], component: AuditWidget },
  users: { roles: ['admin'], component: UsersWidget },
  whatsapp: { roles: ['admin'], component: WhatsAppWidget },
  student_roster: { roles: ['teacher', 'verified_teacher'], component: StudentWidget },
};

const getWidthClass = (w: number) => {
    if (w === 1) return 'w-full md:w-[calc(33.333%-1rem)]';
    if (w === 2) return 'w-full md:w-[calc(66.666%-0.5rem)]';
    return 'w-full';
};

const getHeightClass = (h: string) => {
    if (h === 'sm') return 'h-[300px]';
    if (h === 'lg') return 'h-[600px]';
    return 'h-[450px]'; 
};

const Overview = ({ user, data }: { user: any, data?: any }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);

  const API_URL = (import.meta.env.VITE_API || "").replace(/\/$/, "");

  // 🚨 SYNCHRONOUS STATE INITIALIZATION: Calculates layout instantly on frame 1
  const [layout, setLayout] = useState<any[]>(() => {
    if (!user) return [];

    const baseRole = user?.Role?.toLowerCase() || user?.role?.toLowerCase() || "user";
    const userRoles = [baseRole];
    if (user?.isAdmin) userRoles.push('admin');
    if (user?.isCuTeTeam) userRoles.push('cute_team');
    if (baseRole === 'teacher' && user?.isVerifiedStaff) userRoles.push('verified_teacher');
    if (baseRole === 'parent' && user?.isVerifiedParent) userRoles.push('verified_parent');

    const allowedKeys = Object.keys(WIDGET_CONFIG).filter(key => 
      WIDGET_CONFIG[key].roles.some((r: string) => userRoles.includes(r))
    );

    if (user?.dashboardLayout && user.dashboardLayout.length > 0) {
      let syncedLayout = user.dashboardLayout.filter((item: any) => allowedKeys.includes(item.id));
      
      allowedKeys.forEach(key => {
        if (!syncedLayout.find((item: any) => item.id === key)) {
          syncedLayout.push({ id: key, w: 1, h: 'md' });
        }
      });
      return syncedLayout;
    } else {
      return allowedKeys.map(key => ({ id: key, w: 1, h: 'md' }));
    }
  });

  
  // 2. PERSISTENT SAVE
  const saveLayoutToDB = async (finalLayout: any[]) => {
    setIsSavingLayout(true);
    try {
      const token = localStorage.getItem("jwtoken");
      const res = await fetch(`${API_URL}/user/dashboard-layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ layout: finalLayout })
      });
      if (res.ok) console.log("✨ Layout saved to cloud");
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSavingLayout(false);
    }
  };

  const updateWidget = (id: string, key: 'w' | 'h') => {
    const newLayout = layout.map(item => {
      if (item.id === id) {
        if (key === 'w') {
            const nextW = item.w >= 3 ? 1 : item.w + 1;
            return { ...item, w: nextW };
        } else {
            const sizes = ['sm', 'md', 'lg'];
            const nextH = sizes[(sizes.indexOf(item.h) + 1) % sizes.length];
            return { ...item, h: nextH };
        }
      }
      return item;
    });
    setLayout(newLayout);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return e.preventDefault();
    e.dataTransfer.setData("draggedIdx", index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const dragIdx = parseInt(e.dataTransfer.getData("draggedIdx"));
    if (isNaN(dragIdx) || dragIdx === dropIdx) return;

    const newLayout = [...layout];
    const draggedItem = newLayout[dragIdx];
    newLayout.splice(dragIdx, 1);
    newLayout.splice(dropIdx, 0, draggedItem);
    setLayout(newLayout);
  };

  // Prevent flicker before data is ready
  if (!data ) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-brand-blue" /></div>;

  return (
    <div className="w-full pb-20">
      <div className="flex justify-between items-center mb-8 px-2">
        <div>
           <h2 className="text-2xl font-black text-slate-800 tracking-tight">COMMAND CENTER</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Personalized Workspace</p>
        </div>
        <button 
          onClick={() => {
            if (isEditMode) saveLayoutToDB(layout);
            setIsEditMode(!isEditMode);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${isEditMode ? 'bg-brand-blue text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-blue'}`}
        >
          {isEditMode ? <><Save size={16} /> SAVE LAYOUT</> : <><Settings2 size={16} /> CUSTOMIZE</>}
        </button>
      </div>

      <div className="flex flex-wrap gap-6 items-start">
        {layout.map((item, index) => {
          const config = WIDGET_CONFIG[item.id];
          if (!config) return null;
          const WidgetComponent = config.component;

          return (
            <div 
              key={item.id} 
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, index)}
              className={`
                ${getWidthClass(item.w)} ${getHeightClass(item.h)} 
                bg-white rounded-4xl shadow-sm border transition-all duration-300 relative flex flex-col overflow-hidden
                ${isEditMode ? 'ring-2 ring-brand-blue border-transparent cursor-move' : 'border-slate-100 hover:shadow-xl'}
              `}
            >
              {isEditMode && (
                <div className="absolute top-3 right-3 z-60 flex gap-1">
                  <button onClick={() => updateWidget(item.id, 'w')} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-brand-blue transition-colors">
                    <Layout size={14} />
                  </button>
                  <button onClick={() => updateWidget(item.id, 'h')} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-brand-blue transition-colors">
                    <Maximize size={14} />
                  </button>
                  <div className="p-2 bg-brand-blue text-white rounded-xl cursor-grab"><Move size={14} /></div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
                <WidgetComponent data={data[item.id]} rawData={data} user={user} />
                {isEditMode && <div className="absolute inset-0 bg-brand-blue/5 pointer-events-none" />}
              </div>
            </div>
          );
        })}
      </div>

      {isSavingLayout && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl z-200">
            <Loader2 size={16} className="animate-spin text-brand-blue" />
            <span className="text-xs font-bold tracking-widest uppercase">Saving Workspace...</span>
        </div>
      )}
    </div>
  );
};

export default Overview;