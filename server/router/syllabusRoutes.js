const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const authenticate = require("../middleware/authenticate"); // Adjust path as needed
const { MasterNode, UserNode } = require("../models/syllabusNodeSchema"); // Adjust path as needed
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 1. GET USER COURSES (Top Level Tabs)
// ==========================================
router.get("/dashboard/tracker/courses", authenticate, async (req, res) => {
  try {
    // 🚨 FIX: Check if a specific student's username was requested in the query.
    // If not, fall back to the logged-in user.
    const targetUsername = req.query.username || req.user.username;

    // Use the targetUsername to find distinct courses
    const courses = await UserNode.distinct("course", { username: targetUsername });
    
    res.status(200).json(courses);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 2. GET USER SYLLABUS TREE 
// ==========================================
router.get("/dashboard/tracker/nodes", authenticate, async (req, res) => {
  try {
    const { course, username: queryUsername } = req.query;
    
    // Build a dynamic query
    const targetUsername = queryUsername || req.user.username;
    const query = { username: targetUsername };
    
    // 🚨 FIX: Only filter by course if it was explicitly requested!
    if (course) {
      query.course = course;
    }

    const nodes = await UserNode.find(query).sort({ level: 1, order: 1 });
    res.status(200).json(nodes);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 3. UPDATE PROGRESS (Independent Nodes)
// ==========================================
// Updates completion or doubt status on ANY node (Parent or Child!)
router.put("/dashboard/tracker/progress", authenticate, async (req, res) => {
  try {
    const { nodeId, status, hasDoubt } = req.body;

    const targetUsername = req.body.username || req.query.username || req.user.username;
    
    const node = await UserNode.findOne({ _id: nodeId, username: targetUsername });
    if (!node) return res.status(404).json({ error: "Node not found" });

    if (status !== undefined) node.status = status;
    if (hasDoubt !== undefined) node.hasDoubt = hasDoubt;

    await node.save();
    res.status(200).json({ message: "Progress updated", node });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 4. SUBSCRIBE TO COURSE (The Cloning Magic)
// ==========================================
router.post("/dashboard/tracker/subscribe", authenticate, async (req, res) => {
  try {
    const { courseName } = req.body;
    // Define the target clearly
    const targetUsername = req.body.username || req.query.username || req.user.username;

    // 1. Check if user already subscribed to prevent duplicates (🚨 Fixed variable here)
    const existing = await UserNode.findOne({ username: targetUsername, course: courseName });
    if (existing) return res.status(400).json({ error: "Already subscribed to this course." });

    // 2. Fetch Master Blueprint
    const masterNodes = await MasterNode.find({ course: courseName });
    if (masterNodes.length === 0) return res.status(404).json({ error: "Course not found in master database." });

    // 3. Prepare the ID Mapping dictionary
    const idMap = new Map(); 
    const userNodesData = masterNodes.map(mn => {
      const newId = new mongoose.Types.ObjectId();
      idMap.set(mn._id.toString(), newId);
      
      return {
        _id: newId,
        username: targetUsername, // 🚨 Fixed variable here
        course: mn.course,
        title: mn.title,
        order: mn.order,
        level: mn.level,
        isCustom: false,
        status: 'not_started',
        hasDoubt: false,
        _originalParentId: mn.parentId ? mn.parentId.toString() : null
      };
    });

    // 4. Second Pass: Connect the new children to the new parents
    userNodesData.forEach(un => {
      if (un._originalParentId && idMap.has(un._originalParentId)) {
        un.parentId = idMap.get(un._originalParentId);
      } else {
        un.parentId = null;
      }
      delete un._originalParentId;
    });

    // 5. Bulk Insert
    await UserNode.insertMany(userNodesData);
    res.status(201).json({ message: `Successfully subscribed to ${courseName}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 5. GET AVAILABLE CATALOG COURSES
// ==========================================
router.get("/dashboard/tracker/available-courses", authenticate, async (req, res) => {
  try {
    // Looks through all Master nodes and grabs the unique 'course' names
    const courses = await MasterNode.distinct("course");
    res.status(200).json(courses);
  } catch (err) {
    console.error("Error fetching available courses:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// CREATE NEW NODE (Subject, Chapter, or Topic)
// ==========================================
router.post("/dashboard/tracker/nodes", authenticate, async (req, res) => {
  try {
    const { title, parentId, course, username } = req.body;
    
    // 🚨 1. Determine exactly whose syllabus we are editing
    const targetUsername = username || req.user.username;

    if (!title || !course) {
      return res.status(400).json({ error: "Title and Course are required" });
    }

    // 🚨 2. Calculate the depth (level) dynamically
    let level = 1; // Default to 1 (Root Subject)
    if (parentId) {
      const parentNode = await UserNode.findById(parentId);
      if (!parentNode) {
        return res.status(404).json({ error: "Parent node not found" });
      }
      level = parentNode.level + 1; // Make it a child of the parent
    }

    // 🚨 3. Calculate the order (put it at the bottom of its siblings)
    const siblingCount = await UserNode.countDocuments({ 
      username: targetUsername, 
      course: course, 
      parentId: parentId || null 
    });

    // 4. Create and Save the Node
    const newNode = new UserNode({
      username: targetUsername,
      title: title.trim(),
      course: course.trim(),
      parentId: parentId || null,
      level: level,
      order: siblingCount, // It goes to the end of the list
      isCustom: true,
      status: 'not_started',
      hasDoubt: false
    });

    await newNode.save();
    
    res.status(201).json(newNode);
  } catch (err) {
    console.error("Error creating new syllabus node:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// DELETE NODE (And all its sub-topics)
// ==========================================
router.delete("/dashboard/tracker/nodes/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Identify exactly whose syllabus we are editing (Teacher editing student vs self)
    const targetUsername = req.query.username || req.user.username;

    // 2. Verify the target node exists
    const nodeToDelete = await UserNode.findOne({ _id: id, username: targetUsername });
    if (!nodeToDelete) {
      return res.status(404).json({ error: "Node not found" });
    }

    // 🚨 3. The Magic: Gather ALL descendant IDs (Children, Grandchildren, etc.)
    let idsToDelete = [id]; // Start with the node we clicked
    let currentLevelIds = [id]; // Array to track the current depth we are searching

    // Keep digging deeper until we find no more children
    while (currentLevelIds.length > 0) {
      // Find any nodes whose parentId is in our current level
      const children = await UserNode.find({ parentId: { $in: currentLevelIds } }, '_id');
      const childIds = children.map(child => child._id.toString());
      
      if (childIds.length > 0) {
        idsToDelete.push(...childIds); // Add them to our master kill list
        currentLevelIds = childIds;    // Set them as the new parents to search under
      } else {
        currentLevelIds = []; // No more children found, stop the loop
      }
    }

    // 4. Delete the node and EVERY descendant in one clean sweep
    await UserNode.deleteMany({ _id: { $in: idsToDelete }, username: targetUsername });

    res.status(200).json({ 
      message: "Deleted successfully", 
      nodesRemoved: idsToDelete.length 
    });

  } catch (err) {
    console.error("Error deleting node:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 8. REORDER NODES (Swapping Order Numbers)
// ==========================================
router.put("/dashboard/tracker/reorder", authenticate, async (req, res) => {
  try {
    const { updates } = req.body; 
    // 🚨 FIX: Dynamically identify the user
    const targetUsername = req.body.username || req.user.username;

    const updatePromises = updates.map(update => {
      return UserNode.updateOne(
        { _id: update.id, username: targetUsername }, // 🚨 Updated query
        { $set: { order: update.order } }
      );
    });

    await Promise.all(updatePromises);
    res.status(200).json({ message: "Reordered successfully" });
  } catch (err) {
    console.error("Error reordering:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 9. PREVIEW MASTER BLUEPRINT
// ==========================================
// Fetches the global course structure so users can browse before subscribing
router.get("/dashboard/tracker/blueprint", authenticate, async (req, res) => {
  try {
    const { course } = req.query;
    if (!course) return res.status(400).json({ error: "Course name required" });

    // Fetch directly from the Master collection, sorted mathematically
    const blueprintNodes = await MasterNode.find({ course }).sort({ level: 1, order: 1 });
    
    res.status(200).json(blueprintNodes);
  } catch (err) {
    console.error("Error fetching blueprint:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 10. RENAME / EDIT CUSTOM NODE
// ==========================================
router.put("/dashboard/tracker/nodes/:id", authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    const targetId = req.params.id;
    // 🚨 FIX: Dynamically identify the user
    const targetUsername = req.body.username || req.user.username;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }

    const node = await UserNode.findOne({ _id: targetId, username: targetUsername }); // 🚨 Updated query
    if (!node) return res.status(404).json({ error: "Node not found" });

    node.title = title.trim();
    await node.save();

    res.status(200).json({ message: "Node renamed successfully", node });
  } catch (err) {
    console.error("Error renaming node:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 11. UNSUBSCRIBE FROM COURSE
// ==========================================
router.delete("/dashboard/tracker/courses/:courseName", authenticate, async (req, res) => {
  try {
    const courseName = req.params.courseName;
    // 🚨 FIX: Accept query param from frontend (since it's a DELETE request)
    const targetUsername = req.query.username || req.user.username;

    const result = await UserNode.deleteMany({ username: targetUsername, course: courseName });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Course not found in tracker" });
    }

    res.status(200).json({ message: `Successfully unsubscribed from ${courseName}. Removed ${result.deletedCount} items.` });
  } catch (err) {
    console.error("Error dropping course:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.post("/dashboard/tracker/nodes/master", authenticate, async (req, res) => {
    try {
        if (!req.user.isAdmin) return res.status(403).json({ error: "Unauthorized" });
        // Same logic as POST /nodes, but use the MasterNode model
        const newNode = new MasterNode({ ...req.body }); 
        await newNode.save();
        res.status(201).json(newNode);
    } catch (err) { res.status(500).send("Error"); }
});

// ==========================================
// 12. CLONE CUSTOM PATH (Community Sharing & Bulk Teacher Push)
// ==========================================
router.post("/dashboard/tracker/clone-path", authenticate, async (req, res) => {
  try {
    // 🚨 Now expects targetUsernames (Array) instead of targetUsername (String)
    const { sourceUsername, targetUsernames, courseName } = req.body;
    
    // Backwards compatibility just in case
    const targets = targetUsernames || (req.body.targetUsername ? [req.body.targetUsername] : []);
    if (targets.length === 0) return res.status(400).json({error: "No target users provided."});

    let query = { username: sourceUsername };
    if (courseName && courseName !== 'ALL') {
      query.course = courseName;
    }

    const sourceNodes = await UserNode.find(query);
    if (sourceNodes.length === 0) {
      return res.status(404).json({ error: "No syllabus data found to copy." });
    }

    let allClonedNodes = [];

    // 🚨 THE MAGIC: Loop through every selected student and duplicate the tree
    for (const targetUser of targets) {
      const idMap = new Map();
      const userClones = sourceNodes.map(sn => {
        const newId = new mongoose.Types.ObjectId();
        idMap.set(sn._id.toString(), newId);
        
        return {
          _id: newId,
          username: targetUser, // Assigning to THIS specific student in the loop
          course: sn.course,
          title: sn.title,
          order: sn.order,
          level: sn.level,
          isCustom: sn.isCustom,
          status: 'not_started',
          hasDoubt: false,
          _originalParentId: sn.parentId ? sn.parentId.toString() : null
        };
      });

      // Connect children to new parents
      userClones.forEach(cn => {
        if (cn._originalParentId && idMap.has(cn._originalParentId)) {
          cn.parentId = idMap.get(cn._originalParentId);
        } else {
          cn.parentId = null;
        }
        delete cn._originalParentId;
      });

      allClonedNodes = allClonedNodes.concat(userClones);
    }

    // Bulk Insert EVERYTHING at once for maximum speed
    await UserNode.insertMany(allClonedNodes);
    res.status(201).json({ message: `Successfully copied to ${targets.length} users!` });

  } catch (err) {
    console.error("Cloning Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

router.post('/api/extract-syllabus', async (req, res) => {
    try {
        const { images } = req.body; // Expecting an array of { mimeType, data }

        if (!images || images.length === 0) {
            return res.status(400).json({ error: "No images provided" });
        }

        // 1. Format the images exactly how Gemini likes them
        const imageParts = images.map(img => ({
            inlineData: {
                data: img.data,
                mimeType: img.mimeType
            }
        }));

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            You are an expert educational data extractor. 
            I have provided images of a textbook's Table of Contents / Index.
            
            Extract the syllabus hierarchy from these images and output it STRICTLY as a JSON array matching this exact format:
            [
              {
                "subjectName": "Detected Subject Name (e.g., Mathematics)",
                "tree": [
                  {
                    "title": "Chapter 1 Name",
                    "children": [
                      {
                        "title": "Topic 1.1 Name",
                        "children": [
                           { "title": "Sub-Topic 1.1.1 Name", "children": [] }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]

            Rules:
            1. Ignore page numbers, author names, or publisher info.
            2. Keep the numbering in the title (e.g., "3.1 Introduction").
            3. Do NOT wrap the response in markdown blocks like \`\`\`json. Return ONLY the raw JSON array.
            4. If multiple subjects are detected, create a separate object for each in the array.
        `;

        // 2. Call Gemini
        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();
        
        // 3. Clean the response
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith("```json")) {
            cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        const parsedData = JSON.parse(cleanJson);
        res.status(200).json(parsedData);

    } catch (error) {
        console.error("Gemini Extraction Error:", error);
        res.status(500).json({ error: "Failed to process images" });
    }
});

module.exports = router;