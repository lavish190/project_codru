const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema({
  // Core Links
  admission: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Admission", 
    required: true 
  },
  parent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  // 🚨 Form State Tracking (Allows Parent to resume later)
  currentStep: { type: Number, default: 1 }, // 1: Questionnaire, 2: Documents, 3: Live Test Booking
  
  // ==========================================
  // STEP 1: QUESTIONNAIRE (Auto-saved)
  // ==========================================
  questionnaire: {
    learningStyle: { type: String, default: "" },
    strengths: [{ type: String }],
    struggles: { type: String, default: "" },
    timeCommitment: { type: String, default: "" },
    techReady: { type: String, default: "" },
    internetConnection: { type: String, default: "" }
  },

  // ==========================================
  // STEP 2: DOCUMENTS (Google Drive / Cloudinary)
  // ==========================================
  documents: [{
    title: { type: String, required: true }, // e.g., "Previous Report Card"
    fileUrl: { type: String, required: true },
    driveFileId: { type: String }, // If uploaded directly to Google Drive
    uploadedAt: { type: Date, default: Date.now }
  }],

  // ==========================================
  // STEP 3: LIVE TEST (Google Meet)
  // ==========================================
  liveTest: {
    // The 1-week timer limit (Starts when Step 2 is submitted)
    deadline: { type: Date }, 
    
    // Links right back to the Booking system for Calendar invites!
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    
    status: { 
      type: String, 
      enum: ["pending", "scheduled", "completed"], 
      default: "pending" 
    },
    
    // Internal counselor/teacher notes after taking the Meet test
    teacherBaselineNotes: { type: String, default: "" }
  }

}, { timestamps: true });

// Export the model safely
const Assessment = mongoose.models.Assessment || mongoose.model("Assessment", assessmentSchema);
module.exports = Assessment;