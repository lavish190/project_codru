const express = require("express");
const Post = require("../models/postSchema"); // Make sure this points to the new schema!
const User = require("../models/userSchema");
const authenticate = require("../middleware/authenticate");
const sendAutoNotification = require("../utils/notify");
const router = express.Router();

// ==========================================
// 1. CREATE A POST (Supports Scheduling)
// ==========================================
router.post("/posts", authenticate, async (req, res) => {
  try {
    const { content, imageUrl, scheduledFor } = req.body; 
    
    if (!content && !imageUrl) {
      return res.status(400).json({ error: "Post must contain text or an image." });
    }

    let postStatus = "published";
    let parsedDate = null;

    if (scheduledFor) {
      parsedDate = new Date(scheduledFor);
      if (parsedDate > new Date()) {
        postStatus = "scheduled";
      }
    }

    const newPost = new Post({
      userId: req.userId,
      content: content || "",
      imageUrl: imageUrl || "",
      status: postStatus,
      scheduledFor: parsedDate
    });

    await newPost.save();

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.posts.push(newPost._id);
    await user.save();

    res.status(201).json({ 
      message: postStatus === "scheduled" ? "Post scheduled successfully!" : "Post created successfully", 
      newPost 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. FETCH ALL POSTS (WITH NESTED REPLIES)
// ==========================================
router.get("/posts", authenticate, async (req, res) => {
  try {
    // 1. Get the current user to find out who they are following
    const userId = req.userId || req.user._id;
    const currentUser = await User.findById(userId).select("following");
    
    // Convert ObjectIds to strings for easy comparison
    const followingIds = currentUser.following.map(id => id.toString());

    // 2 This ensures all old posts (with no status field) stay visible!
    const allPosts = await Post.find({ status: { $ne: "scheduled" } })
      .populate({
        path: "comments",
        populate: { 
          path: "user replies.user", 
          select: "name username photo" 
        }
      })
      .populate("userId", "name username photo")
      .populate("likedBy", "name username photo")
      .sort({ createdAt: -1 });

    // 3. The Sorting Magic: Split into "Followed" and "Global"
    const followedPosts = [];
    const globalPosts = [];

    allPosts.forEach(post => {
      // Safety check in case a user was deleted but their post remains
      if (!post.userId) return; 

      const postAuthorId = post.userId._id.toString();

      // If the user follows the author, OR if it's the user's own post, put it at the top!
      if (followingIds.includes(postAuthorId) || postAuthorId === userId.toString()) {
        followedPosts.push(post);
      } else {
        globalPosts.push(post);
      }
    });

    // 4. Combine them: Followed/Own posts first, then everyone else's!
    const personalizedFeed = [...followedPosts, ...globalPosts];

    return res.status(200).json(personalizedFeed);
  } catch (err) {
    console.error("Feed Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. DELETE A POST
// ==========================================
router.delete("/posts/:postId", authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId);
    
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Security check: Only the author can delete it
    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Unauthorized to delete this post" });
    }

    await Post.findByIdAndDelete(postId);
    
    // Remove from user's posts array
    const user = await User.findById(req.userId);
    if (user) {
      user.posts = user.posts.filter((id) => id.toString() !== postId);
      await user.save();
    }
    
    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// 4. LIKE / UNLIKE A POST (THE SECURE ID METHOD)
// ==========================================
// 🚨 Ensure sendAutoNotification is imported at the top!

router.post("/posts/:postId/like", authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    
    // 1. Get the exact User ID (The person clicking the heart)
    const user = await User.findOne({ username: req.username });
    if (!user) return res.status(404).json({ error: "User not found" });
    const userId = user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // 2. Safe Comparison
    const hasLiked = post.likedBy.some((id) => id.toString() === userId.toString());

    if (hasLiked) {
      post.likes = Math.max(0, post.likes - 1);
      post.likedBy.pull(userId);
    } else {
      post.likes++;
      post.likedBy.push(userId);
    }

    await post.save();
    
    // 3. 🚨 TRIGGER THE CENTRALIZED NOTIFICATION
    // Only notify if they LIKED it AND they aren't liking their own post
    if (!hasLiked && post.userId.toString() !== userId.toString()) {
      
      // We pass req.app so the helper can access the 'io' instance!
      await sendAutoNotification(
        req.app,                            // 1. The App instance for Socket.io
        post.userId,                        // 2. Recipient (Post Owner)
        `❤️ ${user.name} liked your post!`,    // 3. Message
        `post/${postId}`,                  // 4. Link for teleportation
        user.username                       // 5. Audit Log: The trigger person
      );

      // 🧹 NO MANUAL SOCKET CODE NEEDED HERE ANYMORE!
      // The helper just handled the save, the audit, and the live ping.
    }

    // 4. THE CRITICAL FIX: Re-fetch and populate
    const populatedPost = await Post.findById(postId).populate("likedBy", "name username photo");
    
    res.status(200).json(populatedPost);
  } catch (err) {
    console.error("Like Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SAVE / UNSAVE A POST (THE SECURE ID METHOD)
// ==========================================
router.post("/posts/:postId/save", authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    
    // 1. Get the user
    const user = await User.findOne({ username: req.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const postExists = await Post.findById(postId);
    if (!postExists) return res.status(404).json({ message: "Post not found" });

    // 2. Safe Comparison
    const hasSaved = user.savedPosts.some((id) => id.toString() === postId.toString());

    if (hasSaved) {
      // UNSAVE
      user.savedPosts.pull(postId);
      await user.save();
      return res.status(200).json({ message: "Post unsaved successfully", saved: false });
    } else {
      // SAVE
      user.savedPosts.push(postId);
      await user.save();
      return res.status(200).json({ message: "Post saved successfully", saved: true });
    }
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ==========================================
// 5.5. GET USER'S SAVED POST IDs (For UI loading)
// ==========================================
router.get("/saved-posts/ids", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.username });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user.savedPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ADD COMMENT OR NESTED REPLY
// ==========================================
router.post("/posts/:postId/comments", authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text, parentId } = req.body; 

    if (!text) return res.status(400).json({ error: "Text is required" });

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    // We need the sender for both the notification message and the Audit Log
    const sender = await User.findById(req.userId);
    if (!sender) return res.status(404).json({ error: "User not found" });

    const newComment = {
      user: req.userId,
      text: text,
      likes: 0,
      dislikes: 0,
      likedBy: [],
      dislikedBy: [],
      replies: []
    };

    let recipientId = null;
    let notificationMessage = "";

    if (parentId) {
      // 1. Handle REPLIES (Recursive Search)
      const findAndPush = (comments) => {
        for (let comment of comments) {
          if (comment._id.toString() === parentId.toString()) {
            comment.replies.push(newComment);
            return comment; 
          }
          if (comment.replies && comment.replies.length > 0) {
            const found = findAndPush(comment.replies);
            if (found) return found;
          }
        }
        return null;
      };

      const parentComment = findAndPush(post.comments);
      if (!parentComment) return res.status(404).json({ error: "Parent comment not found" });

      recipientId = parentComment.user;
      notificationMessage = `💬 ${sender.name} replied to your comment!`;

    } else {
      // 2. Handle TOP-LEVEL COMMENTS
      post.comments.push(newComment);
      
      recipientId = post.userId;
      notificationMessage = `📝 ${sender.name} commented on your post!`;
    }

    post.markModified('comments');
    await post.save();

    // 3. 🚨 TRIGGER THE STANDARDIZED NOTIFICATION
    // Notify only if there's a recipient AND they aren't notifying themselves
    if (recipientId && recipientId.toString() !== req.userId.toString()) {
      
      await sendAutoNotification(
        req.app,               // Socket.io instance
        recipientId,           // Who gets it? (Post owner or Comment owner)
        notificationMessage,   // Dynamic message
        `posts/${postId}`,     // Link to the post
        sender.username        // 🕵️‍♂️ Audit Log: Who triggered the comment?
      );

      // Cleaned up: No more manual push or manual io.emit here!
    }

    // 4. DEEP POPULATE
    const updatedPost = await Post.findById(postId).populate({
      path: 'comments',
      populate: {
        path: 'user replies.user',
        select: 'name username photo'
      }
    });

    res.status(201).json({ message: "Success", comments: updatedPost.comments });
    
  } catch (err) {
    console.error("COMMENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. EDIT A POST
// ==========================================
router.put("/posts/:postId", authenticate, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    const user = await User.findOne({ username: req.username });
    const post = await Post.findById(postId);
    
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Security check: Only the author can edit
    if (post.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to edit this post" });
    }

    post.content = content;
    await post.save();
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. GET A SINGLE POST BY ID (For Sharing!)
// ==========================================
router.get("/posts/single/:postId", async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Fetch the post and populate all the faces and names!
    const post = await Post.findById(postId)
    .populate({
        path: "comments",
        populate: { 
          path: "user replies.user", // Level 0 and Level 1
          select: "name username photo" 
        }
      })
      .populate("userId", "name username photo")
      .populate("likedBy", "name username photo")
      .populate({ path: "comments.user", select: "name username photo" })
      .populate({ path: "comments.replies.user", select: "name username photo" });

    if (!post) return res.status(404).json({ message: "Post not found" });

    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. GET "MY POSTS" (For Dashboard)
// ==========================================
router.get("/my-posts", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Find all posts where the author is the logged-in user
    const myPosts = await Post.find({ userId: user._id })
      .populate("userId", "name username photo")
      .sort({ createdAt: -1 }); // Newest first

    res.status(200).json(myPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. GET "SAVED POSTS" (For Dashboard)
// ==========================================
router.get("/saved-posts", authenticate, async (req, res) => {
  try {
    // Find the user and populate their entire savedPosts array with the post data!
    const user = await User.findOne({ username: req.username }).populate({
      path: "savedPosts",
      populate: { path: "userId", select: "name username photo" } // Get the author's face too!
    });
    
    if (!user) return res.status(404).json({ message: "User not found" });

    // Reverse the array so the most recently saved posts show up first
    const savedPosts = user.savedPosts.reverse();
    res.status(200).json(savedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example for Comment Like/Dislike Toggle
// ==========================================
// LIKE / UNLIKE A COMMENT
// ==========================================
router.post("/comment/:commentId/vote", authenticate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId; // Securely get ID from the token

    // 1. Find the post containing this comment
    const post = await Post.findOne({
      $or: [
        { "comments._id": commentId },
        { "comments.replies._id": commentId }
      ]
    });

    if (!post) return res.status(404).json({ error: "Comment not found" });

    // 2. Recursive finder to locate the exact comment
    const findComment = (list) => {
      for (let c of list) {
        if (c._id.toString() === commentId) return c;
        if (c.replies && c.replies.length > 0) {
          const found = findComment(c.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const target = findComment(post.comments);
    if (!target) return res.status(404).json({ error: "Target comment not found" });

    // 3. THE FIX: Safe Comparison for ObjectIds
    // This correctly checks if the user has already liked it
    const hasLiked = target.likedBy.some(id => id.toString() === userId.toString());

    if (hasLiked) {
      // UNLIKE: Filter the user out of the array
      target.likedBy = target.likedBy.filter(id => id.toString() !== userId.toString());
    } else {
      // LIKE: Add the user to the array
      target.likedBy.push(userId);
    }

    // 4. Update the actual number counter!
    target.likes = target.likedBy.length;

    // 5. Force Mongoose to save the nested data
    post.markModified('comments');
    await post.save();

    // Send back the updated numbers
    res.status(200).json({ 
      likes: target.likes, 
      likedBy: target.likedBy 
    });
    
  } catch (err) {
    console.error("VOTE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE A COMMENT OR REPLY
// ==========================================
router.delete("/posts/:postId/comments/:commentId", authenticate, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const requestUserId = req.userId.toString();

    // Recursive function to find and remove the comment
    const findAndRemove = (list) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i]._id.toString() === commentId) {
          
          // THE FIX: Safely extract IDs whether they are populated objects or raw ObjectIds
          const commentAuthorId = list[i].user._id ? list[i].user._id.toString() : list[i].user.toString();
          const postAuthorId = post.userId._id ? post.userId._id.toString() : post.userId.toString();

          // Security check: Only the comment author or the POST author can delete it
          if (commentAuthorId === requestUserId || postAuthorId === requestUserId) {
            list.splice(i, 1);
            return true;
          }
          
          throw new Error("You are not authorized to delete this comment.");
        }
        
        // Check nested replies
        if (list[i].replies && findAndRemove(list[i].replies)) return true;
      }
      return false;
    };

    try {
      const removed = findAndRemove(post.comments);
      if (!removed) return res.status(404).json({ error: "Comment not found" });
    } catch (e) {
      return res.status(403).json({ error: e.message }); // This is what threw the 403!
    }

    // Save the changes
    post.markModified('comments');
    await post.save();
    
    // Return populated comments so the UI updates with photos intact
    const updatedPost = await Post.findById(postId).populate({
      path: 'comments',
      populate: { path: 'user replies.user', select: 'name username photo' }
    });

    res.status(200).json({ comments: updatedPost.comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;