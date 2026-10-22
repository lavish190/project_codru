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
  }
}, { timestamps: true });

const Blog = mongoose.model("Blog", blogSchema);
module.exports = Blog;
