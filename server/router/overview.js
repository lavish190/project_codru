const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');

const User = require('../models/userSchema');
const Task = require('../models/Task'); 
const Lead = require('../models/Lead'); 
const ConnectionRequest = require('../models/connectionRequestSchema'); 
const Event = require('../models/eventSchema'); 
const Post = require('../models/postSchema'); 
const Syllabus = require('../models/syllabusSchema');

// const CourseEnrollment = require('../models/courseEnrollmentSchema'); // Uncomment if active

router.get('/dashboard-overview', authenticate, async (req, res) => {
    try {
        const userId = req.userId || req.user._id;
        const username = req.user.username;
        const baseRole = req.user.role ? req.user.role.toLowerCase() : (req.user.Role ? req.user.Role.toLowerCase() : 'user');
        const isAdmin = req.user.isAdmin === true; 
        
        // DERIVED ROLES ENGINE
        const userRoles = [baseRole];
        if (isAdmin) userRoles.push('admin');
        if (req.user.isCuTeTeam) userRoles.push('cute_team');
        if (baseRole === 'teacher' && req.user.isVerifiedStaff) userRoles.push('verified_teacher');
        if (baseRole === 'parent' && req.user.isVerifiedParent) userRoles.push('verified_parent');

        const hasRole = (allowedRoles) => allowedRoles.some(r => userRoles.includes(r));

        let responseData = {};
        const dataPromises = [];

        // ==========================================
        // 1. TASKS (Admins, CuTe Team, Verified Teachers)
        // ==========================================
        if (hasRole(['admin', 'cute_team', 'verified_teacher'])) {
            dataPromises.push((async () => {
                
                // 1. Fetch ALL Active/Pending Tasks (NO LIMIT)
                const activeTasks = await Task.find({ 
                    assignedTo: userId, 
                    status: { $ne: 'Completed' } 
                }).sort({ dueDate: 1 }); 

                // 2. Fetch the 15 most recently Completed Tasks
                // (This keeps your "Completed" section populated without lagging the dashboard)
                const completedTasks = await Task.find({
                    assignedTo: userId,
                    status: 'Completed'
                }).sort({ updatedAt: -1 }).limit(15); 

                // Combine them
                const allTasks = [...activeTasks, ...completedTasks];
                
                // Send all necessary fields to the widget (Including dueDate for sorting!)
                responseData.tasks = allTasks.map(t => ({ 
                    _id: t._id, 
                    title: t.title, 
                    description: t.description, 
                    priority: t.priority || 'Medium', 
                    status: t.status,
                    dueDate: t.dueDate 
                }));
            })());
        }

        // ==========================================
        // 2. CUTE TEAM PIPELINE (Team Members & Admins)
        // ==========================================
        if (hasRole(['admin', 'cute_team'])) {
            dataPromises.push((async () => {
                // Fetch the actual active leads instead of just counting them!
                const activeLeads = await Lead.find({ 
                    assignedTo: userId, 
                    status: { $nin: ['Converted', 'Lost'] } 
                }).sort({ createdAt: -1 }); // Newest first

                // Send the crucial data to the widget
                responseData.team_pipeline = activeLeads.map(l => ({
                    _id: l._id,
                    name: l.name,
                    status: l.status || 'New',
                    phoneNumber: l.phoneNumber,
                    date: l.createdAt,
                    description: l.description
                }));
            })());
        }

        // 3. AUDIT LOG (SAFE DATE PARSING)
        if (hasRole(['admin'])) {
            dataPromises.push((async () => {
                const users = await User.find({}, "username notifications").lean();
                let platformLogs = [];
                
                users.forEach(u => {
                    if (!u.notifications) return;
                    u.notifications.forEach(notif => {
                        // 🚨 FIX: Ensure date is valid, or fallback to current time
                        const safeDate = notif.date ? new Date(notif.date) : new Date();
                        if (!isNaN(safeDate.getTime())) {
                            platformLogs.push({
                                user: notif.triggeredBy || "System", 
                                action: notif.message,               
                                timeObj: safeDate                    
                            });
                        }
                    });
                });

                platformLogs.sort((a, b) => b.timeObj - a.timeObj);
                
                responseData.audit_log = platformLogs.slice(0, 10).map(log => {
                    const diffMins = Math.floor((new Date() - log.timeObj) / 60000);
                    let timeStr = diffMins < 60 ? `${Math.max(diffMins, 1)}m` : 
                                  diffMins < 1440 ? `${Math.floor(diffMins/60)}h` : 
                                  `${Math.floor(diffMins/1440)}d`;
                    return { user: log.user, action: log.action, time: timeStr };
                });
            })());
        }

        // 4. SYLLABUS, ACTIVE PROJECT & LAST PLANET (Students)
        if (hasRole(['student'])) {
            dataPromises.push((async () => {
                
                // ... (Keep your existing Syllabus and skill_track logic here) ...

                // 🚨 NEW: LAST PLANET LOGIC
                const userTasks = req.user.tasks || [];
                // Get the last item in the array (the most recent planet)
                const lastTask = userTasks.length > 0 ? userTasks[userTasks.length - 1] : null;
                
                responseData.last_planet = lastTask ? {
                    planet: lastTask.week,
                    question: lastTask.question,
                    answer: lastTask.answer,
                    link: lastTask.link
                } : null;

            })());
        }

        // 4. SYLLABUS & ACTIVE PROJECT
        if (hasRole(['student'])) {
            dataPromises.push((async () => {
                // A. TRUE SYLLABUS TOTALS
                let subjectMap = {};
                
                try {
                    const targetClass = req.user.classSemester;
                    if (targetClass) {
                        const syllabusDocs = await Syllabus.find({ classSemester: targetClass }).lean();
                        
                        // Calculate master totals
                        syllabusDocs.forEach(syllabus => {
                            if (!syllabus.subjects) return;
                            syllabus.subjects.forEach(subject => {
                                const subjName = subject.title || "General";
                                if (!subjectMap[subjName]) subjectMap[subjName] = { total: 0, completed: 0 };
                                
                                // Flatten and count leaf nodes
                                if (subject.chapters) {
                                    subject.chapters.forEach(chapter => {
                                        if (chapter.topics) {
                                            chapter.topics.forEach(topic => {
                                                if (topic.subtopics && topic.subtopics.length > 0) {
                                                    topic.subtopics.forEach(sub => {
                                                        if (sub.subSubtopics && sub.subSubtopics.length > 0) {
                                                            subjectMap[subjName].total += sub.subSubtopics.length;
                                                        } else {
                                                            subjectMap[subjName].total++;
                                                        }
                                                    });
                                                } else {
                                                    subjectMap[subjName].total++;
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        });
                    }

                    // Map user progress
                    if (req.user.syllabus && req.user.syllabus.length > 0) {
                        req.user.syllabus.forEach(item => {
                            const subj = item.subject ? item.subject : "General";
                            // Safely check if status contains completed
                            if (item.status && item.status.toLowerCase().includes('completed')) {
                                if (!subjectMap[subj]) subjectMap[subj] = { total: 1, completed: 0 };
                                subjectMap[subj].completed++;
                            }
                        });
                    }

                    const topSubjects = Object.keys(subjectMap)
                        .filter(key => subjectMap[key].total > 0)
                        .map(key => ({
                            name: key,
                            percentage: Math.min(Math.round((subjectMap[key].completed / subjectMap[key].total) * 100), 100)
                        }))
                        .sort((a, b) => b.percentage - a.percentage) // Sort by highest completion
                        .slice(0, 3);

                    responseData.syllabus = topSubjects;
                } catch (e) {
                    console.error("Syllabus tracking failed:", e);
                    responseData.syllabus = [];
                }

                // B. PROJECT ROADMAP
                // Fallback logic until CourseEnrollment is fully active
                const completedTasks = req.user.tasks ? req.user.tasks.length : 0;
                if (completedTasks > 0) {
                    responseData.skill_track = {
                        courseName: "Skill Track",
                        projectName: "Planetary Path",
                        currentStage: Math.min(completedTasks, 4)
                    };
                } else {
                    responseData.skill_track = null;
                }
            })());
        }

        // 5. EXPERT CONNECT
        if (hasRole(['verified_parent'])) {
            dataPromises.push((async () => {
                const connections = await ConnectionRequest.find({
                    $or: [{ sender: userId }, { receiver: userId }],
                    status: "accepted"
                }).populate("sender receiver", "name username role specialty");

                responseData.expert_connect = connections.map(conn => {
                    const isSender = conn.sender._id.toString() === userId.toString();
                    const expert = isSender ? conn.receiver : conn.sender;
                    return {
                        name: expert.name || expert.username,
                        subject: expert.specialty || "Educator",
                        status: 'online'
                    };
                }).slice(0, 4); 
            })());
        }


        // 7. POST STATS
        if (hasRole(['admin', 'cute_team', 'teacher', 'verified_teacher'])) {
            dataPromises.push((async () => {
                const userPosts = await Post.find({ userId: userId }).select("likes");
                const totalLikes = userPosts.reduce((acc, post) => acc + (post.likes || 0), 0);
                responseData.post_stats = { views: totalLikes.toString() };
            })());
        }

        await Promise.all(dataPromises);
        res.status(200).json(responseData);

    } catch (error) {
        console.error("Dashboard Overview Error:", error);
        res.status(500).json({ error: "Failed to assemble dashboard data." });
    }
});


// ==========================================
// 🚨 NEW: SAVE DASHBOARD LAYOUT SIZE & ORDER
// ==========================================
router.put('/user/dashboard-layout', authenticate, async (req, res) => {
    try {
        const { layout } = req.body;
        
        // Use the ID from the authenticate middleware
        const userId = req.user._id; 

        // Update the user document
        const updatedUser = await User.findByIdAndUpdate(
            userId, 
            { $set: { dashboardLayout: layout } },
            { new: true } // Returns the updated document
        );

        res.status(200).json({ message: "Layout persistent!", layout: updatedUser.dashboardLayout });
    } catch (error) {
        console.error("Persistence Error:", error);
        res.status(500).json({ error: "Failed to save to database." });
    }
});

module.exports = router;