const express = require("express");
const router = express.Router();
const { toggleTeamStatus, getTeamMembers, getLeads, getTasksReordered, editTask, getTasks,editTaskStatus, deleteTask , createManualLead} = require("../controllers/CrmController");
const authenticate = require('../middleware/authenticate');

// Toggle CuTe Team Status
router.put('/user/toggle-team/:username', toggleTeamStatus);

// Fetch all CuTe Team Members
router.get('/team', getTeamMembers);

// ==========================================
// GET: FETCH LEADS (SECURED FOR STAFF ONLY)
// ==========================================
router.get('/leads', authenticate, getLeads);


// ==========================================
// PUT: REORDER TASKS
// ==========================================
router.put('/tasks/reorder', getTasksReordered);

// ==========================================
// PUT: EDIT EXISTING TASK
// ==========================================
router.put('/tasks/:id', authenticate, editTask);

// ==========================================
// GET: FETCH TASKS (SMART ROUTE)
// ==========================================
router.get('/tasks', authenticate,);

// ==========================================
// PUT: TOGGLE TASK STATUS
// ==========================================
router.put('/tasks/:id/status', authenticate, editTaskStatus);

// ==========================================
// DELETE: REMOVE A TASK
// ==========================================
router.delete('/tasks/:id', authenticate, deleteTask);

// ==========================================
// POST: MANUAL LEAD CREATION
// ==========================================
router.post('/leads/manual',createManualLead);

router.delete('/leads/:id', async (req, res) => {
    try {
        await Lead.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Lead deleted" });
    } catch (error) { res.status(500).json({ error: "Failed" }); }
});

router.put('/leads/:id', async (req, res) => {
    try {
        const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true })
                               .populate('assignedTo', 'name username photo');
        res.status(200).json(lead);
    } catch (error) { res.status(500).json({ error: "Failed" }); }
});

module.exports = router;