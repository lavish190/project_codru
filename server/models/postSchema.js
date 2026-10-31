const mongoose = require("mongoose");

// 1. Upgraded Reply Schema
const ReplySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    replies: [this], 
  },
  { timestamps: true }
);

// 2. Upgraded Comment Schema
const CommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies: [ReplySchema], 
  },
  { timestamps: true }
);

// 🚨 NEW: Distribution Sub-Schema for multi-platform tracking
const DistributionSchema = new mongoose.Schema(
  {
    cute: {
      status: { type: String, enum: ['posted', 'scheduled', 'failed'], default: 'posted' },
      scheduledFor: { type: Date, default: null },
      publishedAt: { type: Date, default: null }
    },
    linkedin: {
      status: { type: String, enum: ['unselected', 'posted', 'scheduled', 'failed'], default: 'unselected' },
      scheduledFor: { type: Date, default: null },
      publishedAt: { type: Date, default: null },
      errorLog: { type: String, default: null } // Helpful for debugging expired tokens
    }
  },
  { _id: false } // Prevents Mongoose from creating a redundant ID for this sub-object
);

// 3. Upgraded Post Schema
const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  imageUrl: { type: String, default: "" }, 
  title: { type: String }, 
  content: { type: String, required: true }, 

  // LEGACY FIELDS: Kept here so existing database posts don't break
  status: { type: String, enum: ["published", "scheduled"], default: "published" },
  scheduledFor: { type: Date, default: null },
  
  // 🚨 NEW: Multi-platform distribution tracking
  distribution: {
    type: DistributionSchema,
    default: () => ({}) // This ensures Mongoose generates the default structure even for old posts!
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  comments: [CommentSchema], 
  
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
  dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
});

const Post = mongoose.model("Post", postSchema);
module.exports = Post;