const mongoose = require("mongoose");

const counselorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "USER", required: true },
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 1 }, 
  timeZone: { type: String, default: "Asia/Kolkata" },
  
  // 1. The Standard Weekly Schedule (0 = Sunday, 1 = Monday, etc.)
  baseAvailability: [{
    dayOfWeek: { type: Number, required: true },
    slots: [{ type: String }] // e.g., ["10:00", "10:30"] in their LOCAL time
  }],

  // 2. The Exceptions (Vacations, sick days, or extra shifts)
  dateOverrides: [{
    date: { type: String, required: true }, // Format: "YYYY-MM-DD"
    slots: [{ type: String }] // If empty [], it means they took the whole day off!
  }]

}, { timestamps: true });

const Counselor = mongoose.model("COUNSELOR", counselorSchema);
module.exports = Counselor;