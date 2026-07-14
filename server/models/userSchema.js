const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  // ==========================================
  // 1. CORE IDENTITY & CONTACT
  // ==========================================
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  authProvider: { type: String, default: "local" }, // Can be "local" or "google"
  googleId: { type: String }, // Stores their unique Google ID if they use it
  password: { type: String }, 
  photo: { type: String, default: "" },
  dob: { type: String }, 
  gender: { type: String, default: "male" },
  phone: { type: String },
  altPhone: { type: String },
  address: { type: String },
  declaration: { type: Boolean, default: false },

  // System Flags
  isEmailVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  role: { type: String, default: "User" }, 
  isBanned: { type: Boolean, default: false },

  // ==========================================
  // 2. SOCIAL & COMMUNITY 
  // ==========================================
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
// 1. IN-APP HISTORY (The "Bell" Icon)
  notifications: [{
    message: { type: String, required: true },
    link: { type: String, default: "" }, // 🚨 NEW: For clickability
    type: { type: String, default: "info" }, // 🚨 NEW: To style icons (like/handshake/alert)
    date: { type: String },
    isRead: { type: Boolean, default: false },
    triggeredBy: { type: String, default: "System" },
    actionType: { type: String }
  }],

  // 2. DEVICE ADDRESSES (The "Push" System)
  pushSubscriptions: [
    {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
      }
    }
  ],

  // ==========================================
  // 3. ACADEMIC DETAILS
  // ==========================================
  classSemester: { type: String },
  schoolCollege: { type: String },
  subjects: [{ type: String }],
  
  // Student-Specific Task Tracking
  syllabus: [{
    itemId: { type: String },
    subject: String,
    topicName: String,
    status: { type: String, default: "not_started" }, // 'not_started', 'completed', 'completed_with_doubt'
    hasDoubt: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }],
  activeSyllabuses: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Syllabus" 
  }],
  activePlans: [{ type: String }], // Stores planIds like 'doubt-session'
  
  tasks: [{
    week: String,
    question: String,
    answer: String,
    link: String,
  }],
  
  // ==========================================
  // 4. GUARDIAN DETAILS
  // ==========================================
  fatherName: { type: String },
  fatherOcc: { type: String },
  motherName: { type: String },
  motherOcc: { type: String },

  // ==========================================
  // 5. TEACHER-SPECIFIC DATA
  // ==========================================
  createdCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  qualifications: { type: String },
  assignedTeacher: {
    type: String, // You can store the teacher's username or _id here
    default: ""
  },
  isVerifiedStaff: { type: Boolean, default: false },
  staffApprovalRequested: { type: Boolean, default: false },

  isVerifiedParent: { 
    type: Boolean, 
    default: false 
  },
  parentVerificationRequested: { 
    type: Boolean, 
    default: false 
  }, 

  isCuTeTeam: { 
    type: Boolean, 
    default: false 
  },

  dashboardLayout: [
    {
      id: { type: String, required: true }, // e.g., 'tasks', 'syllabus'
      w: { type: Number, default: 1 },      // Width: 1 (33%), 2 (66%), or 3 (100%)
      h: { type: String, default: 'md' }    // Height: 'sm', 'md', or 'lg'
    }
  ]


}, { timestamps: true });

// 🚨 PRE-SAVE HOOK FOR PASSWORD HASHING 🚨
userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
});

const User = mongoose.model("User", userSchema);
module.exports = User;