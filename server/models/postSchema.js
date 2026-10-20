const mongoose = require("mongoose");

// 1. Upgraded Reply Schema
const ReplySchema = new mongoose.Schema(
  {
    // Replaced 'name' and 'photo' with a direct User reference
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    replies: [this], // Infinite threading restored!
  },
  { timestamps: true }
);

// 2. Upgraded Comment Schema
const CommentSchema = new mongoose.Schema(
  {
    // Replaced 'name' and 'photo' with a direct User reference
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    // Change this in both ReplySchema and CommentSchema:
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    replies: [ReplySchema], // Replies array restored!
  },
  { timestamps: true }
);

// 3. Upgraded Post Schema (Formerly Blog)
const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  imageUrl: { type: String, default: "" }, // For the Instagram vibe!
  title: { type: String }, // Optional
  content: { type: String, required: true }, // The caption

  status: { type: String, enum: ["published", "scheduled"], default: "published" },
  scheduledFor: { type: Date, default: null },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  comments: [CommentSchema], // Threaded comments attached
  
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
  dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
});

const Post = mongoose.model("Post", postSchema);
module.exports = Post;