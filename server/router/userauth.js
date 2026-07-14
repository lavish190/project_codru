const bcrypt = require("bcrypt");
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const router = express.Router();
const dotenv = require("dotenv");
// dotenv.config({ path: "./config.env" });
dotenv.config();

const jwt = require("jsonwebtoken");
router.use(express.json());
router.use(bodyParser.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());
const User = require("../models/userSchema");
const OTP = require("../models/otpSchema");
const Syllabus = require("../models/syllabusSchema");
const authenticate = require("../middleware/authenticate");
const { resetPasswordTemplate } = require("../utils/resetPasswordTemplate");
const otpTemplate = require("../utils/otpTemplate"); // Ensure this path is correct
const actionTemplate = require("../utils/actionTemplate"); // Ensure this path is correct
const sendAutoNotification = require("../utils/notify");
const welcomeTemplate = require("../utils/welcomeTemplate"); // For consistent welcome emails
const transporter = require('../utils/transporter'); // Adjust the path if needed

// ==========================================
// UPDATE SYLLABUS PROGRESS (Checkmark or Doubt)
// ==========================================
// 🚨 Ensure the route parameter matches your fetch URL (/:topicId)
router.put("/dashboard/syllabus/:itemId", authenticate, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status, hasDoubt, topicName, subject } = req.body;
    
    // Safely grab the user ID from your auth middleware
    const userId = req.userId || req.userID || req.user._id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. Check if the topic exists
    const existingIndex = user.syllabus.findIndex(
      (item) => (item.itemId && item.itemId.toString() === itemId) || (item._id && item._id.toString() === itemId)
    );

    let isNewDoubt = false; // We will use this to track if they just raised their hand!

    if (existingIndex > -1) {
      // 2. Update existing progress
      if (status !== undefined) user.syllabus[existingIndex].status = status;
      if (hasDoubt !== undefined) {
        // Check if they are turning the doubt ON (and it wasn't already on)
        if (hasDoubt === true && user.syllabus[existingIndex].hasDoubt !== true) {
          isNewDoubt = true;
        }
        user.syllabus[existingIndex].hasDoubt = hasDoubt;
      }
      user.syllabus[existingIndex].lastUpdated = Date.now();
    } else {
      // 3. First-time creation for this student
      if (hasDoubt === true) isNewDoubt = true; // If they create it with a doubt immediately
      
      user.syllabus.push({
        itemId: itemId.toString(),
        topicName: topicName, 
        subject: subject,    
        status: status || 'not_started',
        hasDoubt: hasDoubt || false,
        lastUpdated: Date.now()
      });
    }

    // 4. Force Mongoose to recognize the array changed
    user.markModified('syllabus');
    await user.save();
    
    // 5. 🚨 THE "RAISED HAND" AUTO-TRIGGER!
    // If the student just marked "hasDoubt" as true, AND they have a teacher...
    if (isNewDoubt && user.assignedTeacher) {
      const teacher = await User.findOne({ username: user.assignedTeacher });
      
      if (teacher) {
        // Fallback names just in case the frontend didn't send them
        const safeTopic = topicName || "a syllabus topic";
        const safeSubject = subject || "their course";
        const studentName = user.name || user.username;

        await sendAutoNotification(
          req.app,              // Socket.io instance
          teacher._id, 
          `🙋‍♂️ ${studentName} raised a doubt in ${safeSubject}: ${safeTopic}.`, 
          "syllabus", // Teleports the teacher straight to the syllabus tab!
          user.username
        );
      }
    }

    res.status(200).json({ message: "Progress saved!" });
  } catch (err) {
    console.error("Syllabus PUT Error:", err);
    res.status(500).json({ error: err.message });
  }
});
// 🚨 Make sure your Syllabus model is imported at the top of the file!
// const Syllabus = require("../models/syllabusSchema");

router.get("/dashboard/syllabus", authenticate, async (req, res) => {
  try {
    let targetUser = req.query.username 
      ? await User.findOne({ username: req.query.username }) 
      : req.user;

    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const targetClass = targetUser.classSemester;

    if (!targetClass) {
      return res.status(200).json([]);
    }

    const syllabusDocs = await Syllabus.find({ classSemester: targetClass });

    if (!syllabusDocs || syllabusDocs.length === 0) return res.status(200).json([]);

    // 🚨 THIS WAS MISSING! This loop actually gathers the IDs to save your data!
    const validIds = new Set();
    syllabusDocs.forEach(syllabus => {
      if (!syllabus.subjects) return;
      syllabus.subjects.forEach(subject => {
        if (!subject.chapters) return;
        subject.chapters.forEach(chapter => {
          if (!chapter.topics) return;
          chapter.topics.forEach(topic => {
            if (topic._id) validIds.add(topic._id.toString());
            
            if (topic.subtopics) {
              topic.subtopics.forEach(sub => {
                if (sub._id) validIds.add(sub._id.toString());
                
                if (sub.subSubtopics) {
                  sub.subSubtopics.forEach(subSub => {
                    if (subSub._id) validIds.add(subSub._id.toString());
                  });
                }
              });
            }
          });
        });
      });
    });
    // 🚨 END OF MISSING SECTION
    
    // Clean database (This will now work perfectly because validIds is full of your Master Syllabus IDs!)
    const originalLength = (targetUser.syllabus || []).length;
    targetUser.syllabus = (targetUser.syllabus || []).filter(item => item.isCustom || validIds.has((item.itemId || item._id)?.toString()));
    
    if (targetUser.syllabus.length !== originalLength) {
        await targetUser.save();
    }

    const progressMap = new Map();
    targetUser.syllabus.forEach(item => progressMap.set((item.itemId || item._id).toString(), item));

    const flattenedTopics = [];
    
    syllabusDocs.forEach(syllabus => {
      if (!syllabus.subjects) return;
      syllabus.subjects.forEach(subject => {
        if (!subject.chapters) return;
        subject.chapters.forEach(chapter => {
          if (!chapter.topics) return;
          chapter.topics.forEach(topic => {
            
            const mergeProgress = (item, pathArray) => {
              if (!item || !item._id) return null;
              const progress = progressMap.get(item._id.toString());
              return {
                _id: item._id, 
                id: item._id,
                subject: subject.title || "General",
                topicName: [...pathArray, item.title].join(' > '), 
                path: pathArray,      
                leafName: item.title, 
                status: progress ? progress.status : 'not_started',
                hasDoubt: progress ? !!progress.hasDoubt : false,
                lastUpdated: progress ? progress.lastUpdated : null
              };
            };

            if (topic.subtopics && topic.subtopics.length > 0) {
              topic.subtopics.forEach(sub => {
                if (sub.subSubtopics && sub.subSubtopics.length > 0) {
                  sub.subSubtopics.forEach(subSub => {
                    const merged = mergeProgress(subSub, [chapter.title, topic.title, sub.title]);
                    if (merged) flattenedTopics.push(merged);
                  });
                } else {
                  const merged = mergeProgress(sub, [chapter.title, topic.title]);
                  if (merged) flattenedTopics.push(merged);
                }
              });
            } else {
              const merged = mergeProgress(topic, [chapter.title]);
              if (merged) flattenedTopics.push(merged);
            }
          });
        });
      });
    });

    // 🚨 Add this right before sending the response in GET /dashboard/syllabus!
    targetUser.syllabus.forEach(item => {
      if (item.isCustom && !item.isHidden) {
        const pathArray = item.topicName ? item.topicName.split(' > ') : [];
        const leafName = pathArray.length > 0 ? pathArray.pop() : item.topicName;
        
        flattenedTopics.push({
          _id: item._id || item.itemId, 
          id: item._id || item.itemId,
          subject: item.subject || "General",
          topicName: item.topicName,
          path: pathArray,      
          leafName: leafName, 
          status: item.status || 'not_started',
          hasDoubt: !!item.hasDoubt,
          lastUpdated: item.lastUpdated,
          isCustom: true
        });
      }
    });

    res.status(200).json(flattenedTopics);
  } catch (err) {
    console.error("Syllabus GET Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 1. ADD A CUSTOM TOPIC OR SUBJECT
router.post("/dashboard/syllabus/add-custom", authenticate, async (req, res) => {
  try {
    const { username, subject, topicName } = req.body;
    
    // Find the target user (teacher adding for student, or student adding for self)
    const targetUser = await User.findOne({ username });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    // Push the custom topic directly into their personal progress array
    targetUser.syllabus.push({
      subject: subject,
      topicName: topicName,
      status: "not_started",
      hasDoubt: false,
      isCustom: true,  // 🚨 Tags it as custom so your GET route doesn't delete it!
      isHidden: false,
      lastUpdated: Date.now()
    });

    await targetUser.save();
    res.status(200).json({ message: "Custom topic added successfully!" });
  } catch (err) {
    console.error("Add Custom Topic Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. HIDE GLOBAL TOPIC OR DELETE CUSTOM TOPIC
router.delete("/dashboard/syllabus/remove", authenticate, async (req, res) => {
  try {
    const { username, topicId, isCustom } = req.body;
    const targetUser = await User.findOne({ username });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    if (isCustom) {
      // It's a custom topic, so we can safely delete it permanently from their profile
      targetUser.syllabus = targetUser.syllabus.filter(item => item._id.toString() !== topicId);
    } else {
      // It's a GLOBAL topic! We cannot delete it, so we just "hide" it for this user.
      const existingItem = targetUser.syllabus.find(i => 
        (i.itemId && i.itemId.toString() === topicId) || 
        (i._id && i._id.toString() === topicId)
      );

      if (existingItem) {
        existingItem.isHidden = true; // Mark existing progress as hidden
      } else {
        // If they never interacted with it, it's not in their array yet. 
        // We MUST add it just to flag it as hidden!
        targetUser.syllabus.push({
          itemId: topicId,
          isHidden: true
        });
      }
    }

    await targetUser.save();
    res.status(200).json({ message: "Topic removed from view!" });
  } catch (err) {
    console.error("Remove Topic Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/dashboard/syllabus/available-courses", authenticate, async (req, res) => {
  try {
    // Finds all unique 'classSemester' strings in your global Syllabus collection!
    const courses = await Syllabus.distinct("classSemester");
    res.status(200).json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/dashboard/syllabus/subscribe", authenticate, async (req, res) => {
  try {
    const { username, courseName } = req.body;
    const targetUser = await User.findOne({ username });
    
    // Add the course name to their active list if it isn't there already
    if (!targetUser.activeSyllabuses) targetUser.activeSyllabuses = [];
    if (!targetUser.activeSyllabuses.includes(courseName)) {
      targetUser.activeSyllabuses.push(courseName);
      await targetUser.save();
    }
    
    res.status(200).json({ message: "Subscribed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🚨 NEW: SAFE READ-ONLY PREVIEW ROUTE
router.get("/dashboard/syllabus/blueprint", authenticate, async (req, res) => {
  try {
    const { course } = req.query;
    if (!course) return res.status(400).json({ error: "Course name required" });

    // 1. Fetch the master document for this course
    const syllabusDocs = await Syllabus.find({ classSemester: course });
    if (!syllabusDocs || syllabusDocs.length === 0) return res.status(200).json([]);

    const flattenedTopics = [];

    // 2. Flatten it exactly how the frontend likes it (without checking user progress)
    syllabusDocs.forEach(syllabus => {
      if (!syllabus.subjects) return;
      syllabus.subjects.forEach(subject => {
        if (!subject.chapters) return;
        subject.chapters.forEach(chapter => {
          if (!chapter.topics) return;
          chapter.topics.forEach(topic => {
            
            // Helper to push formatted topics
            const pushTopic = (item, pathArray) => {
              if (!item || !item._id) return;
              flattenedTopics.push({
                _id: item._id.toString(),
                id: item._id.toString(),
                subject: subject.title || "General",
                topicName: [...pathArray, item.title].join(' > '), 
                path: pathArray,      
                leafName: item.title, 
                status: 'not_started', // Preview is always unstarted
                hasDoubt: false
              });
            };

            if (topic.subtopics && topic.subtopics.length > 0) {
              topic.subtopics.forEach(sub => {
                if (sub.subSubtopics && sub.subSubtopics.length > 0) {
                  sub.subSubtopics.forEach(subSub => pushTopic(subSub, [chapter.title, topic.title, sub.title]));
                } else {
                  pushTopic(sub, [chapter.title, topic.title]);
                }
              });
            } else {
              pushTopic(topic, [chapter.title]);
            }
          });
        });
      });
    });

    res.status(200).json(flattenedTopics);
  } catch (err) {
    console.error("Blueprint GET Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🚨 NEW REORDER ROUTE
router.put("/dashboard/syllabus/reorder", authenticate, async (req, res) => {
  try {
    const { username, updates } = req.body; // Expects: [{ id: "...", order: 1 }, ...]
    const targetUser = await User.findOne({ username });
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    updates.forEach(u => {
      // Finds the specific topic by its _id or original itemId
      const item = targetUser.syllabus.find(s => 
        (s._id && s._id.toString() === u.id) || 
        (s.itemId && s.itemId.toString() === u.id)
      );
      if (item) item.order = u.order;
    });

    await targetUser.save();
    res.status(200).json({ message: "Order updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Registration route
router.post("/register", async (req, res) => {
  const {
    photo,
    name,
    username,
    email,
    password,
    cpassword,
    dob,
    phone,
    declaration,
    role,
    ...rest
  } = req.body;

  if (!name || !email || !password || !cpassword || !username) {
    return res.status(400).json({ error: "Empty field(s)." });
  }

  try {
    const usernameExist = await User.findOne({ username });

    if (usernameExist) {
      return res.status(401).json({ error: "User already exists." });
    } else if (password !== cpassword) {
      return res.status(402).json({ error: "Passwords didn't match." });
    } else {
      
      const user = new User({
        photo,
        name,
        username,
        email,
        password,
        dob,
        phone,
        declaration,
        role: role || "User",
        ...rest,
      });

      await user.save();
      
      // 1. 🚨 NOTIFY ADMINS (In-App)
      try {
        const admins = await User.find({ isAdmin: true });
        const notifyPromises = admins.map((admin) => 
          sendAutoNotification(
            req.app,              // Socket.io instance
            admin._id,
            `🎉 New Registration: ${user.name} (@${user.username}) has joined!`,
            "manage-users",
            user.username // 🕵️‍♂️ Audit: Who is this new user?
          )
        );
        await Promise.all(notifyPromises);
      } catch (err) { console.error("Admin notify error:", err); }

      // 2. 🚨 SEND WELCOME/INVITATION EMAIL TO USER
      const welcomeHtml = welcomeTemplate(user.name || user.username);

      const mailOptions = {
        from: process.env.EMAIL,
        to: user.email,
        subject: "Welcome to Curious Team Learning! 🚀",
        // 🚨 Swap 'text' for 'html'
        html: welcomeHtml 
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Failed to send welcome email:", error);
        } else {
          console.log("Welcome email sent: " + info.response);
        }
      });
      
      // 3. Generate Token and Respond
      const token = jwt.sign(
        { _id: user._id, username: user.username, role: user.role },
        process.env.TOKEN_SECRET,
        { expiresIn: "14d" }
      );
      
      res.status(201).json({ 
        message: "Registration successful", 
        token,
        role: user.role,
        username: user.username,
        photo: user.photo,
        name: user.name,
        isAdmin: user.isAdmin,
        isNewUser: true 
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Signin route
// router.post("/signin", async (req, res) => {
//   try {
//     const { username, password } = req.body;
    
//     if (!username || !password) {
//       return res.status(400).json({ error: "Empty field(s)" });
//     }

//     const user = await User.findOne({ username }).select("+password");

//     // 1. Check if user actually exists FIRST
//     if (!user) {
//       return res.status(400).json({ error: "Wrong Credentials" });
//     }

//     // 2. Now it's safe to check if they are banned
//     if (user.isBanned) {
//       return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
//     }

//     // 3. Check the password
//     const isMatched = await bcrypt.compare(password, user.password);

//     if (!isMatched) {
//       return res.status(400).json({ error: "Wrong Credentials" });
//     }

//     // 4. Generate Token (Make sure TOKEN_SECRET is in your Vercel Env Vars!)
//     const token = jwt.sign(
//       {
//         _id: user._id,
//         username: user.username,
//         role: user.role,
//         isAdmin: user.isAdmin,
//       },
//       process.env.TOKEN_SECRET,
//       { expiresIn: "14d" }
//     );

//     // Ensure the cookie expiration is treated as a Number to prevent weird Date bugs
//     const cookieExpire = process.env.COOKIEEXPIRE ? Number(process.env.COOKIEEXPIRE) : 24 * 60 * 60 * 1000;
//     const options = {
//       expires: new Date(Date.now() + cookieExpire), 
//       httpOnly: true,
//     };

//     res.status(200).cookie("token", token, options).json({
//       message: "You are in",
//       role: user.role,
//       username: user.username,
//       token,
//       photo: user.photo,
//       name: user.name,
//       isAdmin: user.isAdmin,
//     });
    
//   } catch (err) {
//     console.error("Sign In Error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

router.post("/signin", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Empty field(s)" });
    }

    const user = await User.findOne({ username }).select("+password");

    // 1. Check if user actually exists FIRST
    if (!user) {
      return res.status(400).json({ error: "Wrong Credentials" });
    }

    // 2. Now it's safe to check if they are banned
    if (user.isBanned) {
      return res.status(403).json({ error: "Your account has been suspended. Please contact support." });
    }

    if (!user.password) {
      return res.status(400).json({ 
        error: "You originally signed up with Google! Please click 'Sign in with Google' or use 'Forgot Password' to create a manual password." 
      });
    }

    // 3. Check the password
    const isMatched = await bcrypt.compare(password, user.password);

    if (!isMatched) {
      return res.status(400).json({ error: "Wrong Credentials" });
    }

    // 4. Generate Token (Set to 14 days)
    const token = jwt.sign(
      {
        _id: user._id,
        username: user.username,
        role: user.role,
        isAdmin: user.isAdmin,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "14d" }
    );

    // 🚨 FIX: Change cookie fallback lifespan to match 14 days in milliseconds
    const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000; 
    const cookieExpire = process.env.COOKIEEXPIRE ? Number(process.env.COOKIEEXPIRE) : fourteenDaysInMs;
    
    const options = {
      expires: new Date(Date.now() + cookieExpire), 
      httpOnly: true,
      // 🚨 CRITICAL PRODUCTION FLAGS: Required for cross-domain cookies (Vercel client -> Render backend)
      secure: process.env.NODE_ENV === "production", 
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    };

    res.status(200).cookie("token", token, options).json({
      message: "You are in",
      role: user.role,
      username: user.username,
      token,
      photo: user.photo,
      name: user.name,
      isAdmin: user.isAdmin,
    });
    
  } catch (err) {
    console.error("Sign In Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST route for admission form submission
router.post("/admission/:username", async (req, res) => {
  const username = req.params.username;
  try {
    const {
      name,
      email,
      dob,
      address,
      userphoto,
      usersign,
      userparentsign,
      gender,
      phone,
      altphone,
      adddeclaration,
      classorsem,
      chosensubs,
      schoolorcollege,
      semorclg,
      fatherName,
      fatherOcc,
      motherName,
      motherOcc,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !email ||
      !dob ||
      !address ||
      !gender ||
      !phone ||
      (classorsem === "13" && !semorclg) ||
      !adddeclaration ||
      !classorsem ||
      !chosensubs.length ||
      !schoolorcollege ||
      !fatherName ||
      !fatherOcc ||
      !motherName ||
      !motherOcc
    ) {
      return res.status(400).json({ error: "Empty field(s) or invalid data." });
    }

    // Check if the student already exists
    let existingStudent = await User.findOne({ username });

    if (existingStudent) {
      // Update existing student record
      existingStudent.email = email;
      existingStudent.dob = dob;
      existingStudent.address = address;
      existingStudent.userphoto = userphoto;
      existingStudent.usersign = usersign;
      existingStudent.userparentsign = userparentsign;
      existingStudent.gender = gender;
      existingStudent.phone = phone;
      existingStudent.altphone = altphone;
      existingStudent.adddeclaration = adddeclaration;
      existingStudent.classorsem = classorsem;
      existingStudent.chosensubs = chosensubs;
      existingStudent.schoolorcollege = schoolorcollege;
      existingStudent.semorclg = semorclg;
      existingStudent.fatherName = fatherName;
      existingStudent.fatherOcc = fatherOcc;
      existingStudent.motherName = motherName;
      existingStudent.motherOcc = motherOcc;

      await existingStudent.save();
      return res
        .status(200)
        .json({ message: "Student record updated successfully" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET student data by username
// router.get("/students/:username", async (req, res) => {
//   const username = req.params.username;

//   try {
//     // Find student by username in the database
//     const student = await User.findOne({ username, role: "Student" });

//     if (!student) {
//       return res.status(404).json({ error: "Student not found" });
//     }

//     res.status(200).json(student);
//   } catch (error) {
//     console.error("Error fetching student:", error);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// 🚨 ADD 'authenticate' middleware here to protect the route!
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    const userId = req.user._id; 
    let user = await User.findById(userId);
    
    if (!user) return res.status(400).json({ error: "User not found" });

    // 🚨 SMART CHECK: Only verify currentPassword if they actually have one!
    if (user.password) {
      if (!currentPassword) {
         return res.status(400).json({ error: "Please enter your current password to change it." });
      }
      const isMatched = await bcrypt.compare(currentPassword, user.password);
      if (!isMatched) {
        return res.status(400).json({ error: "Wrong current password" });
      }
    }

    // 1. Update Password (Your pre-save hook handles the hashing)
    user.password = newPassword;
    await user.save();

    // 2. IN-APP NOTIFICATION
    await sendAutoNotification(
      req.app,
      user._id,
      "🔒 Security Alert: Your password was successfully updated.",
      "settings",
      req.user.username 
    );

    // 3. EMAIL NOTIFICATION
    const emailHtml = actionTemplate(
      user.name || user.username,
      "Security Alert: Password Updated",
      "Your account password was successfully set/updated. You can now use this to log in.",
      "#f59e0b" 
    );

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Password Updated Successfully",
      html: emailHtml
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Failed to send password change email:", error);
    });

    res.status(200).json({ message: "Password updated successfully!" });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { username } = req.body;
    let user = await User.findOne({ username });

    if (!user) return res.status(400).json({ error: "User not found" });
    if (!user.email) return res.status(400).json({ error: "No email associated with this user." });

    // 1. Generate link (Ensure process.env.TOKEN_SECRET exists in your .env file!)
    const token = jwt.sign({ userId: user._id }, process.env.TOKEN_SECRET, { expiresIn: "1h" });
    
    // Pro-tip: Use an env variable for the frontend URL so it works in production too!
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/forget-password/${token}`; // Match your React Route path!

    // 2. Generate HTML
    // 🚨 WARNING: Ensure 'resetPasswordTemplate' is required at the top of this file!
    const resetHtml = resetPasswordTemplate(user.name || user.username, resetLink);

    // 3. Send Email
    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Password Reset Request - CuTe Learning",
      html: resetHtml 
    };

    // 🚨 WARNING: Ensure 'transporter' (Nodemailer) is defined/imported in this file!
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("🔥 Nodemailer Error:", error);
        return res.status(500).json({ error: "Failed to send email. Check server logs." });
      }
      res.status(200).json({ message: "Password reset link sent to your email" });
    });
    
  } catch (error) {
    // 🚨 THIS LOG WILL TELL YOU EXACTLY WHAT CRASHED!
    console.error("🔥 Crash in /reset-password route:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Add this in your backend routes file
router.get("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    // Just try to verify it. If it's expired, it will jump to the catch block.
    jwt.verify(token, process.env.TOKEN_SECRET);
    res.status(200).json({ valid: true });
  } catch (error) {
    res.status(400).json({ error: "Invalid or expired link" });
  }
});
// Reset password confirmation route
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    // 1. SAFELY VERIFY JWT 
    // (If it's expired/invalid, we catch it here and send a 400 instead of a 500 crash)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.TOKEN_SECRET);
    } catch (jwtError) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
    }

    const userId = decoded.userId;

    // 2. MANUALLY HASH THE PASSWORD
    // By hashing it here, we don't have to rely on Mongoose pre-save hooks which can be finicky.
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. USE `updateOne` INSTEAD OF `user.save()`
    // This safely updates ONLY the password and ignores all other strict schema validations!
    const result = await User.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );

    if (result.matchedCount === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    res.status(200).json({ message: "Password has been reset successfully" });
    
  } catch (error) {
    console.error("🔥 Server error during password reset:", error);
    res.status(500).json({ error: "An unexpected server error occurred." });
  }
});

// ==========================================
// 1. GENERATE OTP ROUTE (Signup Proof)
// ==========================================
router.post("/generate-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Generate a 4-digit OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Delete any old OTPs for this email so they don't clash
    await OTP.deleteMany({ email: email });

    // Save the new OTP to our temporary database collection
    await OTP.create({ email: email, otp: generatedOtp });

    // Send the Email
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: "Email Verification - CuTe Learning",
      html: otpTemplate(generatedOtp),
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        res.status(500).send({ error: "Failed to send OTP" });
      } else {
        res.status(200).send({ message: "OTP sent successfully" });
      }
    });
  } catch (err) {
    console.error("OTP Gen Error:", err);
    res.status(500).send({ error: "Server error" });
  }
});

// ==========================================
// 2. VERIFY OTP ROUTE (Signup Proof)
// ==========================================
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body; 

    // Look inside our temporary OTP collection
    const record = await OTP.findOne({ email: email });

    if (!record) {
      return res.status(401).send({ error: "OTP expired or not found. Please resend." });
    }

    // Check if it matches exactly
    if (record.otp === otp.toString()) {
      
      // Success! Delete it so it can't be used twice
      await OTP.deleteMany({ email: email });

      res.status(200).send({ message: "Verification successful" });
    } else {
      res.status(401).send({ error: "Invalid OTP" });
    }
  } catch (err) {
    console.error("OTP Verify Error:", err);
    res.status(500).send({ error: "Server error" });
  }
});

// Profile edit route
router.post("/profile-edit", async (req, res) => {
  try {
    const { username, phone, altphone, address, photo } = req.body;

    let user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    user.photo = photo || user.photo;
    user.phone = phone || user.phone;
    user.altphone = altphone || user.altphone;
    user.address = address || user.address;

    await user.save();

    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Profile retrieval route
router.get("/profile",authenticate,async (req, res) => {
  try {
    const username = req.username; // Get username from authenticated user
    let user = await User.findById(req.userId).populate({
      path: "posts followers following", 
    });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    res.status(200).json({ message: "Profile retrieved", user });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

//userlist for sending follow request
router.get("/userlist", authenticate, async (req, res) => {
  try {
    const users = await User.find().select("_id username name ");
    res.status(200).json({success:true, message:" users fatches successfully",users});
  } catch (error) {
    console.error("Error fetching user list:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Sign out route
router.post("/signout", (req, res) => {
  try {
    res.clearCookie("token");
    res.status(200).json({ message: "Signed out successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

//gapi
router.get("", (req, res) => {
  try {
  } catch (error) {}
});

// Route to get a user's public profile
router.get("/profile/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username }).populate({
      path: "followers following"})
      .populate({
        path: "posts", // IMPORTANT: Change this to "posts" if you renamed it in your userSchema.js!
        options: { sort: { createdAt: -1 } }
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      user: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 1. CHECK IF FOLLOWING
// ==========================================
router.post("/checkfollowing", async (req, res) => {
  try {
    const { currentUsername, targetUsername } = req.body;
    
    // If nobody is logged in, they obviously aren't following!
    if (!currentUsername || !targetUsername) {
      return res.status(200).json({ following: false });
    }

    const targetUser = await User.findOne({ username: targetUsername });
    const currentUser = await User.findOne({ username: currentUsername });

    if (!targetUser || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Safe Comparison: Check if current user's ID is inside target's followers array
    const isFollowing = targetUser.followers.some(
      (id) => id.toString() === currentUser._id.toString()
    );

    res.status(200).json({ following: isFollowing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. FOLLOW A USER
// ==========================================
router.post("/follow", async (req, res) => {
  try {
    const { currentUserId: currentUsername, targetUserId: targetUsername } = req.body;

    const currentUser = await User.findOne({ username: currentUsername });
    const targetUser = await User.findOne({ username: targetUsername });

    if (!currentUser || !targetUser) return res.status(404).json({ message: "User not found" });

    // Prevent following yourself!
    if (currentUser._id.toString() === targetUser._id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    // Add target to my following, and add me to target's followers
    if (!currentUser.following.includes(targetUser._id)) {
      currentUser.following.push(targetUser._id);
      targetUser.followers.push(currentUser._id);

      await currentUser.save();
      await targetUser.save();

      // 🚨 THE AUTO-TRIGGER!
      // Send a ping to the user who just gained a follower
      await sendAutoNotification(
          req.app,              // Socket.io instance
        targetUser._id, 
        `👋 ${currentUser.name || currentUser.username} started following you!`, 
        `profile/${currentUser.username}`, // Teleports them straight to the follower's profile!
        currentUser.username
      );
    }

    res.status(200).json({ success: true, message: "Successfully followed" });
  } catch (err) {
    console.error("Follow route error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. UNFOLLOW A USER
// ==========================================
router.post("/unfollow", async (req, res) => {
  try {
    const { currentUserId: currentUsername, targetUserId: targetUsername } = req.body;

    const currentUser = await User.findOne({ username: currentUsername });
    const targetUser = await User.findOne({ username: targetUsername });

    if (!currentUser || !targetUser) return res.status(404).json({ message: "User not found" });

    // Safely pull the ObjectIds out of the arrays
    currentUser.following.pull(targetUser._id);
    targetUser.followers.pull(currentUser._id);

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ success: true, message: "Successfully unfollowed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GLOBAL USER SEARCH
// ==========================================
router.get("/search-users", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(200).json([]);

    // Finds users where username OR name matches the query (case-insensitive)
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { name: { $regex: query, $options: "i" } }
      ]
    })
    .select("name username photo role") // Only send what we need for the search results
    .limit(8);

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Search available students by name or username
router.get("/search-students", authenticate, async (req, res) => {
  try {
    const searchQuery = req.query.q;
    
    // If the input is empty, return nothing
    if (!searchQuery) return res.status(200).json([]);

    // Search MongoDB using a case-insensitive regex
    const students = await User.find({
      role: "Student", // Only search for students
      $or: [
        { name: { $regex: searchQuery, $options: "i" } },
        { username: { $regex: searchQuery, $options: "i" } }
      ]
    })
    .limit(5) // Only return top 5 results to keep the dropdown clean
    .select("name username _id"); // Only send necessary data

    res.status(200).json(students);
  } catch (err) {
    console.error("Student Search Error:", err);
    res.status(500).json({ error: "Failed to search students" });
  }
});

// Toggle Ban Status Route
router.put("/user/toggle-ban/:username", authenticate, async (req, res) => {
  try {
    // 1. Check if the person making the request is an Admin
    const requester = await User.findById(req.userId || req.user._id);
    if (!requester || !requester.isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Admins only." });
    }

    // 2. Find and update the target user
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Flip the status
    user.isBanned = !user.isBanned; 
    await user.save();

    // 3. 🚨 DYNAMIC NOTIFICATION MESSAGES
    const isNowBanned = user.isBanned;
    
    const appMessage = isNowBanned 
      ? "🚫 Your account has been suspended by an Administrator." 
      : "✅ Your account suspension has been lifted. Welcome back!";
      
    const emailSubject = isNowBanned 
      ? "Account Suspension Notice - CuTe Learning" 
      : "Account Restored - CuTe Learning";
      
    const emailBody = isNowBanned
      ? `Hi ${user.name || user.username},\n\nYour account on Curious Team Learning has been suspended by an Administrator. If you believe this is a mistake, please reply to this email to contact our support team.`
      : `Hi ${user.name || user.username},\n\nGood news! Your account suspension on Curious Team Learning has been lifted. You may now log in and resume using the platform.`;

    // 4. 🚨 IN-APP NOTIFICATION (For the audit trail / when they return)
    await sendAutoNotification(
        req.app,              // Socket.io instance
      user._id, 
      appMessage, 
      "settings", // Teleports them to settings if they click it after an unban
      req.user.username // Indicates who triggered the notification

    );

    // 5. 🚨 EMAIL NOTIFICATION
    const emailHtml = actionTemplate(
      user.name || user.username,
      isNowBanned ? "Account Suspension Notice" : "Account Restored",
      isNowBanned 
        ? "Your account on Curious Team Learning has been suspended by an Administrator. If you believe this is a mistake, please contact our support team."
        : "Good news! Your account suspension has been lifted. You may now log in and resume using the platform.",
      isNowBanned ? "#991b1b" : "#10b981" // Red for Ban, Green for Restore
    );

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: isNowBanned ? "Account Suspension - CuTe Learning" : "Account Restored - CuTe Learning",
      html: emailHtml
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Failed to send ban toggle email:", error);
    });

    res.status(200).json({ 
      message: `User ${isNowBanned ? 'banned' : 'unbanned'} successfully.`, 
      isBanned: user.isBanned 
    });
  } catch (error) {
    console.error("Ban Toggle Error:", error);
    res.status(500).json({ error: "Failed to toggle ban status." });
  }
});

// 1. GET: Fetch all teachers waiting for approval

router.put("/admin/verify-teacher/:id", authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Nice try. Admins only." });

    const teacherId = req.params.id;
    const updatedTeacher = await User.findByIdAndUpdate(
      teacherId,
      { 
        isVerifiedStaff: true,
        staffApprovalRequested: false // 🚨 Clears them from the waiting list
      },
      { new: true } // Returns the updated document so we have their email!
    );

    if (!updatedTeacher) {
      return res.status(404).json({ error: "Teacher not found." });
    }

    // 1. 🚨 IN-APP NOTIFICATION (You confirmed this works!)
    await sendAutoNotification(
        req.app,              // Socket.io instance
      updatedTeacher._id,
      "🎉 Congratulations! Your request for Verified Staff status has been approved.",
      "profile", // Teleports them to their profile to see their shiny new status!
      req.user.username // Indicates who triggered the notification
    );

    // 2. 🚨 EMAIL NOTIFICATION (Wrapped safely so we can see errors!)
    try {
      // If actionTemplate is not imported at the top of your file, this will crash right here!
      const emailHtml = actionTemplate(
        updatedTeacher.name || updatedTeacher.username,
        "Application Approved! 🍎",
        "Great news! Your application for Verified Staff status on Curious Team Learning has been officially approved. You now have full access to our teacher tools and management panels.",
        "#10b981" // Success Green
      );

      const mailOptions = {
        from: process.env.EMAIL,
        to: updatedTeacher.email,
        subject: "Application Approved! Welcome to the Team 🍎",
        html: emailHtml 
      };

      // Changed to await so the server doesn't skip it
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ MAIL SENT SUCCESSFULLY:", info.response);

    } catch (emailError) {
      // 🚨 THIS WILL FINALLY TELL US WHY THE EMAIL IS FAILING
      console.error("❌ EMAIL SYSTEM FAILED:", emailError.message);
    }

    res.status(200).json({ message: "Teacher approved successfully!" });
  } catch (err) {
    // 🚨 Added console.error so future bugs aren't invisible
    console.error("🚨 CRITICAL ROUTE ERROR:", err);
    res.status(500).json({ error: "Server error approving teacher." });
  }
});

router.put("/admin/reject-teacher/:id", authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admins only." });

    const teacherId = req.params.id;
    const updatedTeacher = await User.findByIdAndUpdate(
      teacherId,
      { 
        staffApprovalRequested: false // 🚨 Just clears the flag, doesn't verify them
      },
      { new: true } // 🚨 Added this so we can grab their email for the notification!
    );

    if (!updatedTeacher) {
      return res.status(404).json({ error: "Teacher not found." });
    }

    // 1. 🚨 IN-APP NOTIFICATION
    await sendAutoNotification(
        req.app,              // Socket.io instance
      updatedTeacher._id,
      "ℹ️ Your request for Verified Staff status was reviewed and declined at this time.",
      "settings", // Teleports them to settings 
      req.user.username // Indicates that the Admin triggered this change
    );

    // 2. 🚨 EMAIL NOTIFICATION
    const mailOptions = {
      from: process.env.EMAIL,
      to: updatedTeacher.email,
      subject: "Update on your Staff Application",
      text: `Hi ${updatedTeacher.name || updatedTeacher.username},\n\nThank you for applying for Verified Staff status on Curious Team Learning. After review, we are unable to approve your request at this time.\n\nIf you believe you are missing required profile information, you may update your profile and try again later, or contact our support team for more details.\n\nBest,\nCurious Team Learning`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Failed to send teacher rejection email:", error);
    });

    res.status(200).json({ message: "Teacher request rejected." });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject teacher." });
  }
});

// ✅ VERIFY PARENT (With Socket.io + Email)
router.put("/admin/verify-parent/:id", authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Unauthorized access." });

    const parentId = req.params.id;
    const updatedParent = await User.findByIdAndUpdate(
      parentId,
      { 
        isVerifiedParent: true,
        parentVerificationRequested: false 
      },
      { new: true } 
    );

    if (!updatedParent) {
      return res.status(404).json({ error: "Parent not found." });
    }

    // 1. 🚨 IN-APP NOTIFICATION (Socket + DB)
    await sendAutoNotification(
      req.app,               
      updatedParent._id,
      "🛡️ Welcome to Expert Connect! Your Parent Verification has been approved.",
      "expert-connect", // 🚀 Teleports them straight to the messaging panel!
      req.user.username 
    );

    // 2. 🚨 EMAIL NOTIFICATION
    const emailHtml = actionTemplate(
      updatedParent.name || updatedParent.username,
      "Verification Approved! ❤️",
      "We are happy to inform you that your Parent Verification has been officially approved. You now have full access to Expert Connect, where you can consult with our verified educators directly.",
      "#f43f5e" // Rose-500 for the Love/Parent vibe
    );

    const mailOptions = {
      from: process.env.EMAIL,
      to: updatedParent.email,
      subject: "Your Account is Now Verified! ❤️",
      html: emailHtml
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Failed to send parent approval email:", error);
      else console.log("✅ MAIL SENT:", info.response);
    });

    res.status(200).json({ message: "Parent verified successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Server error approving parent." });
  }
});

// ❌ REJECT PARENT (With Socket.io + Email)
router.put("/admin/reject-parent/:id", authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admins only." });

    const parentId = req.params.id;
    const updatedParent = await User.findByIdAndUpdate(
      parentId,
      { parentVerificationRequested: false },
      { new: true }
    );

    if (!updatedParent) {
      return res.status(404).json({ error: "Parent not found." });
    }

    // 1. 🚨 IN-APP NOTIFICATION
    await sendAutoNotification(
      req.app,               
      updatedParent._id,
      "ℹ️ Your Parent Verification request was reviewed and declined at this time.",
      "settings", 
      req.user.username 
    );

    // 2. 🚨 EMAIL NOTIFICATION
    const mailOptions = {
      from: process.env.EMAIL,
      to: updatedParent.email,
      subject: "Update on your Parent Verification",
      text: `Hi ${updatedParent.name || updatedParent.username},\n\nThank you for requesting verification on Curious Team Learning. After review, we are unable to approve your request at this time.\n\nPlease ensure your profile information is complete before requesting again. If you have questions, please reach out to our admin team.\n\nBest,\nCurious Team Learning`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Failed to send parent rejection email:", error);
    });

    res.status(200).json({ message: "Parent request rejected." });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject parent." });
  }
});

// GET Master Security Audit Log (Admins Only)
router.get("/admin/audit-log", authenticate, async (req, res) => {
  try {
    // 1. Hard Security Check
    const admin = await User.findById(req.userId);
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: "Access Denied. Admins only." });

    // 2. Fetch all users, but ONLY their usernames and notifications array (keeps it fast)
    const users = await User.find({}, "username notifications");

    // 3. Flatten into a single timeline
    let platformLogs = [];
    users.forEach(user => {
      user.notifications.forEach(notif => {
        platformLogs.push({
          id: notif._id,
          recipient: user.username,
          triggeredBy: notif.triggeredBy || "System",
          action: notif.message,
          timestamp: notif.date,
          link: notif.link,
          isRead: notif.isRead
        });
      });
    });

    // 4. Sort: Newest first
    platformLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 5. Send the latest 200 events so the browser doesn't lag
    res.status(200).json(platformLogs.slice(0, 200));

  } catch (error) {
    console.error("Audit Log Error:", error);
    res.status(500).json({ error: "Failed to generate audit log" });
  }
});

module.exports = router;
