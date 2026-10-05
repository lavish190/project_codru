const mongoose = require("mongoose");

const homeschoolPlanSchema = new mongoose.Schema({
  planName: { type: String, default: "Complete Homeschooling Program" },
  baseYearlyFee: { type: Number, required: true, default: 700000 },
  maxScholarshipAllowed: { type: Number, default: 48 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("HomeschoolPlan", homeschoolPlanSchema);