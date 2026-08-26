const mongoose = require("mongoose");

const planLeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    whatsapp: { type: String, required: true },
    is_whatsapp: { type: Boolean, default: true },
    plan_interest: { type: String, required: true },
    
    // Links to an existing user if they are already registered on the platform!
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    
    // We will save the unique tracking URL here for your records
    trackingUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("PlanLead", planLeadSchema);