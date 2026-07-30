const express = require("express");
 // Double check this path!
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const { MyCourses, enrollCourse, updateCourseDetails } = require("../controllers/PersonalCourseController");

// ==========================================
// 1. GET ALL COURSES FOR A SPECIFIC STUDENT
// ==========================================
router.get("/my-courses", authenticate,MyCourses);

// ==========================================
// 2. TEACHER: ENROLL A STUDENT IN A NEW COURSE
// ==========================================
router.post("/enroll-course", authenticate,enrollCourse);

// ==========================================
// 3. TEACHER: UPDATE COURSE DETAILS
// ==========================================
router.put("/course/:courseId", authenticate, updateCourseDetails);

// 🚨 CRITICAL FIX: You MUST export the router so app.js can use it!
module.exports = router;