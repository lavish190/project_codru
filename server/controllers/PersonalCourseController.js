const CourseEnrollment = require("../models/courseEnrollmentSchema");
const User = require("../models/userSchema");


const MyCourses =  async (req, res) => {
  try {
    let targetUserId = req.user._id;
    

    if (req.query.username && req.user.role === 'Teacher') {
      const student = await User.findOne({ username: req.query.username });
      if (!student) return res.status(404).json({ error: "Student not found" });
      targetUserId = student._id;
    }

    const courses = await CourseEnrollment.find({ studentId: targetUserId })
      .populate("teacherId", "name photo username")
      .sort({ updatedAt: -1 });

    res.status(200).json(courses);
  } catch (err) {
    console.error("Fetch Courses Error:", err);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
}

const enrollCourse =  async (req, res) => {
  try {
    // 🚨 FIXED: Capital 'Teacher'
    if (req.user.role !== 'Teacher' && !req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const { studentUsername, courseName, level, projectName } = req.body;

    const student = await User.findOne({ username: studentUsername });
    if (!student) return res.status(404).json({ error: "Student not found" });

    const newEnrollment = new CourseEnrollment({
      studentId: student._id,
      teacherId: req.user._id, 
      courseName,
      level: level || "Level 1",
      projectName: projectName || "Brainstorming Phase..."
    });

    await newEnrollment.save();
    res.status(201).json({ message: "Student enrolled successfully!", course: newEnrollment });
  } catch (err) {
    console.error("Enrollment Error:", err);
    res.status(500).json({ error: "Failed to enroll student" });
  }
}

const updateCourseDetails =  async (req, res) => {
  try {
    const { courseId } = req.params;
    const { currentMilestone, mentorNote, projectName, status, portfolio, resources, endDate, studentAcceptedGraduation } = req.body;

    const updatedCourse = await CourseEnrollment.findByIdAndUpdate(
      courseId,
      {
        $set: {
          ...(currentMilestone && { currentMilestone }),
          ...(mentorNote && { mentorNote }),
          ...(projectName && { projectName }),
          ...(status && { status }),
          ...(portfolio && { portfolio }),
          ...(resources && { resources }),
          ...(endDate !== undefined && { endDate }),
          ...(studentAcceptedGraduation !== undefined && { studentAcceptedGraduation })
        }
      },
      { new: true } 
    );

    if (!updatedCourse) return res.status(404).json({ error: "Course not found" });

    res.status(200).json({ message: "Course updated!", course: updatedCourse });
  } catch (err) {
    console.error("Update Course Error:", err);
    res.status(500).json({ error: "Failed to update course" });
  }
}

module.exports = { MyCourses, enrollCourse, updateCourseDetails };