const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  // 1. Core Relations (Populate these to get the user's name/email/phone)
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  counselor: { type: mongoose.Schema.Types.ObjectId, ref: "Counselor", required: true },
  
  // 2. Scheduling Details
  date: { type: Date, required: true },
  time: { type: String, required: true }, 
  title: { type: String }, 
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled', 'no-show', 'missed'], 
    default: 'scheduled' 
  },
  
  // 3. Frontend UI Helpers
  type: { type: String, default: 'discovery_call' }, // Can be 'assessment_test'
  color: { type: String, default: 'bg-brand-orange' }, 
  
  // ==========================================
  // 4. Google Calendar Sync Fields
  // ==========================================
  googleEventId: { type: String }, 
  meetLink: { type: String },      
  htmlLink: { type: String },  
  description: { type: String },   
  guests: [{ type: String }],      
  
  // 5. Attachments & Notifications
  attachments: [{
    title: String,
    fileUrl: String,
    fileId: String,
    mimeType: String
  }],
  reminderMinutes: { type: Number, default: 15 }, 
  reminderSent: { type: Boolean, default: false },

  // ==========================================
  // 6. Counselor Admissions Desk Controls
  // ==========================================
  counselorNotes: { type: String, default: "" },
  callType: { 
    type: String, 
    enum: ["google_meet", "phone_call", "in_person"], 
    default: "google_meet" 
  },
  completedBy: { 
    type: String, 
    enum: ["auto_attendance", "counselor_manual", "none"], 
    default: "none" 
  }

}, { timestamps: true });

// Export the model safely
const Booking = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);
module.exports = Booking;