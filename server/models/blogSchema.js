const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  summary: { 
    type: String, 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  coverImage: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  // Keeps legacy text names (e.g., "Lavish Sharma") intact
  authorName: { 
    type: String, 
    required: true 
  }, 
  // Links future blogs directly to the registered user who wrote them
  authorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    default: null 
  }, 
  publishedAt: { 
    type: Date, 
    default: Date.now 
  },
  cta: {
    enabled: { type: Boolean, default: false },
    text: { type: String },
    link: { type: String },
    color: { type: String, default: "bg-brand-orange" }, // e.g., bg-brand-orange or bg-brand-blue
    size: { type: String, default: "md" }, // sm, md, lg
    alignment: { type: String, default: "center" }, // left, center, right
    width: { type: String, default: "auto" }, // auto, full
    radius: { type: String, default: "full" }, // sm, md, lg, full (pill)
    iconUrl: { type: String },
    textColor: { type: String, default: "text-white" }
  }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);
module.exports = Blog;
