const mongoose = require("mongoose");

const ProgramIndexSchema = new mongoose.Schema({
  topic: { type: String, required: true }, // e.g., "Web Development"
  type: { type: String, required: true },  // "Internship" or "Training"
  code: { type: String, required: true, unique: true } // e.g., "T01" or "I01"
});

module.exports = mongoose.model("ProgramIndex", ProgramIndexSchema);