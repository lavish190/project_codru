const User = require("../models/userSchema");
const Lead = require('../models/Lead');
const Task = require('../models/Task');

const toggleTeamStatus =  async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ error: "User not found" });

        user.isCuTeTeam = !user.isCuTeTeam;
        await user.save();

        res.status(200).json({ 
            message: `${user.username} is ${user.isCuTeTeam ? 'now' : 'no longer'} on the team!`,
            isCuTeTeam: user.isCuTeTeam 
        });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}

const getTeamMembers = async (req, res) => {
    try {
        const team = await User.find({ isCuTeTeam: true }).select('name username photo _id');
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch team members." });
    }
}

const getLeads = async (req, res) => { // 🚨 Added authenticate
    try {
        // 🚨 SECURITY: Block normal students/parents from fetching CRM leads!
        if (!req.user.isAdmin && !req.user.isCuTeTeam) {
            return res.status(403).json({ error: "Access denied. Staff only." });
        }

        const leads = await Lead.find()
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'name username photo');
        res.status(200).json(leads);
    } catch (error) {
        console.error("🚨 KANBAN LEADS CRASH:", error); 
        res.status(500).json({ error: "Failed to fetch leads." });
    }
}

const getTasksReordered =  async (req, res) => {
    try {
        const { taskIds } = req.body; // Array of IDs in the new order
        
        // Update the sortOrder field for each task concurrently
        const updatePromises = taskIds.map((id, index) => 
            Task.findByIdAndUpdate(id, { $set: { sortOrder: index } })
        );
        
        await Promise.all(updatePromises);
        res.status(200).json({ message: "Tasks reordered" });
    } catch (error) {
        console.error("Task Reorder Error:", error);
        res.status(500).json({ error: "Failed to reorder tasks." });
    }
}

const editTask = async (req, res) => { // 🚨 Added authenticate middleware
    try {
        // 🚨 Added assignedTo and leadId to the destructuring
        const { title, description, dueDate, priority, assignedTo, leadId } = req.body;
        
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { 
                $set: { 
                    title, 
                    description, 
                    dueDate, 
                    priority,
                    assignedTo, // 🚨 Now team members will actually save!
                    leadId      // 🚨 Now linked leads will actually save!
                } 
            }, 
            { new: true }
        ).populate('leadId', 'name phoneNumber').populate('assignedTo', 'name username photo');

        res.status(200).json(updatedTask);
    } catch (error) {
        console.error("Task Edit Error:", error);
        res.status(500).json({ error: "Failed to edit task." });
    }
}

const getTasks =  async (req, res) => {
    try {
        // Default: Only show tasks where the logged-in user is in the assignedTo array
        let dbQuery = { assignedTo: req.user._id }; 

        // 🚨 THE MAGIC: If the CRM asks for all tasks, AND the user is Staff...
        if (req.query.scope === 'all' && (req.user.isAdmin || req.user.isCuTeTeam)) {
            dbQuery = {}; // Erase the filter, fetch the whole database!
        }

        const tasks = await Task.find(dbQuery)
            .sort({ sortOrder: 1, dueDate: 1 })
            .populate('leadId', 'name phoneNumber')
            .populate('assignedTo', 'name username photo');
            
        res.status(200).json(tasks);
    } catch (error) {
        console.error("🚨 TASKS CRASH:", error); 
        res.status(500).json({ error: "Failed to fetch tasks." });
    }
}

const editTaskStatus =  async (req, res) => {
    try {
        const { status } = req.body;
        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { $set: { status: status } },
            { new: true }
        );
        res.status(200).json(updatedTask);
    } catch (error) {
        res.status(500).json({ error: "Failed to update task." });
    }
}
const deleteTask =  async (req, res) => {
    try {
        await Task.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete task." });
    }
}
const createManualLead =  async (req, res) => {
    try {
        const { name, phoneNumber, status, description, assignedStaff } = req.body;
        const cleanNum = String(phoneNumber).replace(/\D/g, "");
        
        // 🚨 NEW: Look up the Users by username to get their IDs
        let assignedUserIds = [];
        if (assignedStaff && assignedStaff.length > 0) {
            const users = await User.find({ username: { $in: assignedStaff } });
            assignedUserIds = users.map(u => u._id);
        }
        
        const newLead = await Lead.create({
            name: name || cleanNum,
            phoneNumber: cleanNum,
            status: status || 'New',
            description: description || "",
            contactId: `manual_${Date.now()}`,
            assignedTo: assignedUserIds // 🚨 Save it to the database!
        });
        
        res.status(201).json(newLead);
    } catch (error) {
        console.error("Manual Lead Error:", error);
        res.status(500).json({ error: "Failed to create lead." });
    }
}
module.exports = {
    toggleTeamStatus,
    getTeamMembers,
    getLeads,
    getTasksReordered,
    editTask,
    getTasks,
    editTaskStatus,
    deleteTask,
    createManualLead
}