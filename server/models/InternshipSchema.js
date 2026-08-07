const mongoose = require("mongoose");

const internshipSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["draft", "pending", "approved", "rejected", "feedback_submitted", "completed"], 
    default: "draft",
  },
  resumeDriveId: { type: String, required: true },
  resumeDriveLink: { type: String, required: true },

  personalDetails: {
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String },
    sameAsWhatsapp: { type: Boolean, default: true },
  },


  step: { 
    type: Number, 
    default: 1 
  },
  
  programDetails: {
    intent: { type: String, enum: ["work", "learn"] },
    type: { type: String, enum: ["internship", "training"] },
    topic: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    durationDays: { type: Number },
    price: { type: Number, default: 0 },
    mode: { 
      type: String, 
      enum: ["Remote", "On-site"], 
      default: "Remote" 
    },
  },

  completionDetails: {
    rollNo: { type: String },         // Maps to "S. No." in Excel
    programCode: { type: String },    // e.g., "T08"
    projectTitle: { type: String },   // Maps to "Project / Task"
    projectDescription: { type: String }, // Maps to "Description"
    grade: { type: String },
    barcodeStr: { type: String }      // Certificate Code
  },

  printStatus: { 
    type: String, 
    enum: ["Not Printed", "Printed", "Given"],
    default: "Not Printed" 
  },

  isAcknowledged: { type: Boolean, default: false },

  feedback: {
    rating: { type: Number, min: 1, max: 10 },
    majorLearnings: { type: String },
    generalFeedback: { type: String },
    futureInterest: { type: String, enum: ["yes", "maybe", "no"] },
  },
  rejectionDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Internship", internshipSchema);