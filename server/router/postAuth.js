const express = require("express");
const Post = require("../models/postSchema"); 
const Blog = require("../models/blogSchema");
const User = require("../models/userSchema");
const authenticate = require("../middleware/authenticate");
const SocialConnection = require('../models/SocialConnection');
const sendAutoNotification = require("../utils/notify");
const { formatHtmlForLinkedIn } = require('../utils/formatters');
const { uploadImageToLinkedIn } = require('../utils/linkedinHelper');
const router = express.Router();
const slugify = require('slugify');

// ==========================================
// 1. CREATE A POST (Supports Multi-Platform & Scheduling)
// ==========================================
router.post("/posts", authenticate, async (req, res) => {
  try {
    const { content, images, distribution } = req.body; 
    
    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({ error: "Post must contain text or an image." });
    }

    // --- 1. BACKWARDS COMPATIBILITY LOGIC ---
    let postStatus = "published";
    let parsedDate = null;
    const cuteSchedule = distribution?.cute?.scheduledFor;

    if (cuteSchedule) {
      parsedDate = new Date(cuteSchedule);
      if (parsedDate > new Date()) {
        postStatus = "scheduled";
      }
    }

    const plainText = content ? content.replace(/(<([^>]+)>)/gi, "").substring(0, 40) : "post";
    const baseSlug = slugify(plainText, { lower: true, strict: true });
    const uniqueId = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${uniqueId}`;

    // --- 2. CREATE POST ---
    const newPost = new Post({
      userId: req.userId,
      content: content || "",
      images: images || [],
      status: postStatus, 
      scheduledFor: parsedDate, 
      distribution: distribution || {},
      slug: slug 
    });

    await newPost.save();

    // --- 3. UPDATE USER ARRAY ---
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.posts.push(newPost._id);
    await user.save();

    // --- 4. LINKEDIN CROSS-POSTING LOGIC (Instant Post) ---
    if (distribution?.linkedin?.status === 'posted') {
      const connection = await SocialConnection.findOne({ userId: req.userId, provider: 'linkedin' });
      
      if (connection && connection.accessToken) {
        const plainTextContent = formatHtmlForLinkedIn(content);
        
        // 🚨 UPDATED PAYLOAD GENERATOR
        let specificContent = {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: plainTextContent },
            shareMediaCategory: "NONE" 
          }
        };

        try {
          // 🚨 NEW IMAGE PROCESSING LOGIC
          if (images && images.length > 0) {
            console.log(`Processing ${images.length} instant images for LinkedIn...`);
            const uploadPromises = images.map(url => uploadImageToLinkedIn(url, connection.accessToken, connection.providerAccountId));
            const assetUrns = await Promise.all(uploadPromises);

            specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE";
            specificContent["com.linkedin.ugc.ShareContent"].media = assetUrns.map(urn => ({
              status: "READY",
              media: urn
            }));
          }

          // 🚨 EXISTING POST LOGIC
          const linkedInRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${connection.accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0'
            },
            body: JSON.stringify({
              author: connection.providerAccountId,
              lifecycleState: 'PUBLISHED',
              specificContent: specificContent,
              visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
            })
          });

          if (!linkedInRes.ok) {
            const errData = await linkedInRes.json();
            console.error("LinkedIn Post Failed:", errData);
            
            newPost.distribution.linkedin.status = 'failed';
            newPost.distribution.linkedin.errorLog = errData.message || "API Error";
            await newPost.save();
          }
        } catch (linkedinErr) {
          console.error("Error communicating with LinkedIn API:", linkedinErr);
        }
      }
    }

    // 3. PING CLOUDFLARE IF INSTANTLY PUBLISHED
    if (postStatus === "published") {
      const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
      if (cloudflareWebhookUrl) {
        fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
      }
    }

    // --- 5. RESPOND TO FRONTEND ---
    res.status(201).json({ 
      message: postStatus === "scheduled" ? "Post scheduled successfully!" : "Post created successfully", 
      newPost 
    });
  } catch (err) {
    console.error("Post Creation Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. FETCH ALL POSTS (WITH NESTED REPLIES)
// ==========================================
// ==========================================
// 2. SCALABLE FEED (Pagination & DB Sorting)
// ==========================================
router.get("/posts", authenticate, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    
    // Pagination setup (Defaults to page 1, 20 posts per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; 
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(userId).select("following");
    const followingIds = currentUser.following || [];
    // Combine following IDs with the user's own ID so they see their own posts too
    const priorityUserIds = [...followingIds, userId]; 

    // 1. FAST DB QUERY: Fetch only 20 Followed/Own posts
    let followedPosts = await Post.find({ 
        status: { $ne: "scheduled" },
        userId: { $in: priorityUserIds } 
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "comments",
        populate: { path: "user replies.user", select: "name username photo" }
      })
      .populate("userId", "name username photo")
      .populate("likedBy", "name username photo");

    // 2. FAST DB QUERY: If they follow no one (or need more content), backfill with Global posts
    let globalPosts = [];
    if (followedPosts.length < limit) {
      const remainingLimit = limit - followedPosts.length;
      
      globalPosts = await Post.find({
          status: { $ne: "scheduled" },
          userId: { $nin: priorityUserIds } // Exclude the ones we just fetched
        })
        .sort({ createdAt: -1 })
        .skip(skip) // Keeps pagination accurate
        .limit(remainingLimit)
        .populate({
          path: "comments",
          populate: { path: "user replies.user", select: "name username photo" }
        })
        .populate("userId", "name username photo")
        .populate("likedBy", "name username photo");
    }

    // Combine them
    const feed = [...followedPosts, ...globalPosts];

    // 🚨 SEND RESPONSE IMMEDIATELY 🚨
    // The user gets their feed instantly without waiting for the auto-heal loop!
    res.status(200).json(feed);

    // ==========================================
    // ⚡ BACKGROUND PROCESS (Non-Blocking)
    // ==========================================
    // This runs AFTER the user already got their feed.
    (async () => {
      try {
        let dbUpdated = false;
        
        // We only loop through the 20 posts we just fetched, not the whole database!
        for (let post of feed) {
          if (!post.slug) {
            const plainText = post.content ? post.content.replace(/(<([^>]+)>)/gi, "").substring(0, 40) : "post";
            const baseSlug = slugify(plainText, { lower: true, strict: true });
            const uniqueId = Math.random().toString(36).substring(2, 6);
            
            // Because 'post' is a JSON object here, we must fetch the Mongoose document to save it
            await Post.updateOne(
              { _id: post._id }, 
              { $set: { slug: `${baseSlug}-${uniqueId}` } }
            );
            dbUpdated = true;
          }
        }

        if (dbUpdated) {
          const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
          if (cloudflareWebhookUrl) fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
        }
      } catch (bgErr) {
        console.error("Background Heal Error:", bgErr);
      }
    })(); // Immediately Invoked Async Function

  } catch (err) {
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
    
    // 🚨 THE FIX: Extract all editable fields
    const { content, status, scheduledFor } = req.body;
    
    const user = await User.findOne({ username: req.username });
    const post = await Post.findById(postId);
    
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Security check: Only the author can edit
    if (post.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized to edit this post" });
    }

    // 🚨 THE FIX: Update fields dynamically
    if (content !== undefined) post.content = content;
    if (status !== undefined) post.status = status;
    
    // Explicitly handle null for scheduledFor if they convert to published
    if (scheduledFor !== undefined) post.scheduledFor = scheduledFor;

    await post.save();
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. GET A SINGLE POST (Supports both ID and Slug!)
// ==========================================
router.get("/posts/single/:idOrSlug", async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    
    // 1. Check if the parameter is a valid MongoDB ID, otherwise assume it's an SEO slug
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrSlug);
    const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };
    
    // 2. Fetch the post and populate all the faces and names (Your original detailed populates!)
    const post = await Post.findOne(query)
      .populate({
        path: "comments",
        populate: { 
          path: "user replies.user",
          select: "name username photo" 
        }
      })
      .populate("userId", "name username photo")
      .populate("likedBy", "name username photo")
      .populate({ path: "comments.user", select: "name username photo" })
      .populate({ path: "comments.replies.user", select: "name username photo" });

    if (!post) return res.status(404).json({ message: "Post not found" });

    // 🚨 3. SECURE THE ROUTE: Block access to scheduled posts
    if (post.status === "scheduled") {
      return res.status(403).json({ message: "This post has not been published yet." });
    }

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

// ==========================================
// DELETE ORPHANED CLOUDINARY IMAGES
// ==========================================
router.delete("/posts/images", authenticate, async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || urls.length === 0) return res.status(400).json({ message: "No URLs provided" });

    const deletePromises = urls.map(async (url) => {
      // Cloudinary URLs look like: https://res.cloudinary.com/name/image/upload/v1234/folder/image.jpg
      // This regex extracts 'folder/image' (the exact public_id needed for deletion)
      const match = url.match(/\/v\d+\/(.+)\.[a-z]+$/i);
      if (match && match[1]) {
        return cloudinary.uploader.destroy(match[1]);
      }
    });

    await Promise.all(deletePromises);
    res.status(200).json({ message: "Images successfully purged from Cloudinary" });
  } catch (err) {
    console.error("Cloudinary Cleanup Error:", err);
    res.status(500).json({ error: "Failed to delete images" });
  }
});

// ==========================================
// EXPORT ALL POSTS FOR CLOUDFLARE PYTHON SCRIPT (WITH AUTO-HEALING)
// ==========================================
router.get("/export", async (req, res) => {
  try {
    const posts = await Post.find({ status: { $ne: "scheduled" } })
      .populate("userId", "name username photo")
      .sort({ createdAt: -1 });
    
    let dbUpdated = false;

    const formattedPosts = await Promise.all(posts.map(async (post) => {
      let currentSlug = post.slug;

      // 🚨 AUTO-HEALING: Use updateOne to prevent VersionErrors!
      if (!currentSlug) {
        const plainText = post.content ? post.content.replace(/(<([^>]+)>)/gi, "").substring(0, 40) : "post";
        const baseSlug = slugify(plainText, { lower: true, strict: true });
        const uniqueId = Math.random().toString(36).substring(2, 6);
        currentSlug = `${baseSlug}-${uniqueId}`;
        
        await Post.updateOne(
          { _id: post._id },
          { $set: { slug: currentSlug } }
        );
        dbUpdated = true;
      }

      return {
        id: post._id.toString(),
        slug: currentSlug,
        content: post.content,
        images: post.images?.length > 0 ? post.images : (post.imageUrl ? [post.imageUrl] : []),
        authorName: post.userId?.name,
        authorUsername: post.userId?.username,
        authorPhoto: post.userId?.photo,
        date: post.createdAt.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }),
        likes: post.likes
      };
    }));

    // Optional: If you want to know when it healed during export
    if (dbUpdated) console.log("✅ Auto-healed missing slugs during export!");

    res.status(200).json(formattedPosts);
  } catch (err) {
    console.error("Export Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. CREATE BLOG & TRIGGER CLOUDFLARE BUILD
// ==========================================
router.post("/blogs", authenticate, async (req, res) => {
  try {
    const { 
      title, summary, content, coverImage, category, authorName, cta, 
      isScheduled, scheduledFor, 
      promoteOnCute, promoteOnLinkedIn // 🚨 NEW: Promotion Toggles
    } = req.body;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. GENERATE SEO SLUG
    const baseSlug = slugify(title, { lower: true, strict: true });
    const uniqueId = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${uniqueId}`;
    
    const status = isScheduled ? "scheduled" : "published";
    const parsedDate = isScheduled && scheduledFor ? new Date(scheduledFor) : null;

    // 2. CREATE BLOG
    const newBlog = new Blog({
      title, slug, summary, content, coverImage, category,
      authorName: authorName || user.name,
      authorId: req.userId,
      cta, status, scheduledFor: parsedDate 
    });
    
    await newBlog.save();

    // 🚨 3. CROSS-PROMOTION LOGIC
    if (promoteOnCute || promoteOnLinkedIn) {
      const blogUrl = `https://curiousteamlearning.com/blog/${slug}`;
      // Creates a clean text post for the feeds
      const promoContent = `<p>Excited to share our latest article: <strong>${title}</strong></p><p>${summary}</p><p>Read the full article here: <a href="${blogUrl}">${blogUrl}</a></p>`;

      const newPost = new Post({
        userId: req.userId,
        content: promoContent,
        images: coverImage ? [coverImage] : [], // Use the blog cover as the social image!
        status: status, 
        scheduledFor: parsedDate, 
        distribution: {
          cute: promoteOnCute ? {
            status: status === "scheduled" ? "scheduled" : "posted",
            scheduledFor: parsedDate
          } : { status: 'unselected' },
          linkedin: promoteOnLinkedIn ? {
            status: status === "scheduled" ? "scheduled" : "posted",
            scheduledFor: parsedDate
          } : { status: 'unselected' }
        }
      });

      await newPost.save();
      user.posts.push(newPost._id);
      await user.save();

      // IF INSTANT LINKEDIN POST:
      if (promoteOnLinkedIn && status === "published") {
        const connection = await SocialConnection.findOne({ userId: req.userId, provider: 'linkedin' });
        if (connection && connection.accessToken) {
          try {
            let specificContent = {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: formatHtmlForLinkedIn(promoContent) },
                shareMediaCategory: "NONE" 
              }
            };

            if (coverImage) {
              const assetUrn = await uploadImageToLinkedIn(coverImage, connection.accessToken, connection.providerAccountId);
              specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory = "IMAGE";
              specificContent["com.linkedin.ugc.ShareContent"].media = [{ status: "READY", media: assetUrn }];
            }

            const linkedInRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${connection.accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
              },
              body: JSON.stringify({
                author: connection.providerAccountId,
                lifecycleState: 'PUBLISHED',
                specificContent: specificContent,
                visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
              })
            });

            if (!linkedInRes.ok) {
              const errData = await linkedInRes.json();
              newPost.distribution.linkedin.status = 'failed';
              newPost.distribution.linkedin.errorLog = errData.message;
              await newPost.save();
            }
          } catch (err) {
            console.error("LinkedIn Promotion Error:", err);
          }
        }
      }
    }

    // 4. CLOUDFLARE BUILD (If instant)
    if (status === "published") {
      const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
      if (cloudflareWebhookUrl) {
        fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
      }
    }

    res.status(201).json({ message: status === "scheduled" ? "Blog scheduled successfully!" : "Blog published!", newBlog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. EXPORT ALL BLOGS FOR CLOUDFLARE PYTHON SCRIPT
// ==========================================
router.get("/blogs/export", async (req, res) => {
  try {
    // 🚨 SECURE: Only fetch blogs that are actually 'published'
    const blogs = await Blog.find({ status: "published" }).sort({ publishedAt: -1 });
    
    const formattedBlogs = await Promise.all(blogs.map(async (blog) => {
      let currentSlug = blog.slug;
      if (!currentSlug) {
        const baseSlug = slugify(blog.title, { lower: true, strict: true });
        const uniqueId = Math.random().toString(36).substring(2, 6);
        currentSlug = `${baseSlug}-${uniqueId}`;
        blog.slug = currentSlug;
        await blog.save(); 
      }

      return {
        id: blog._id.toString(),
        slug: currentSlug,
        title: blog.title,
        summary: blog.summary,
        content: blog.content,
        image: blog.coverImage,
        date: blog.publishedAt.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }),
        author: blog.authorName,
        category: blog.category,
        cta: blog.cta 
      };
    }));

    res.status(200).json(formattedBlogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. GET ALL BLOGS FOR ADMIN MANAGEMENT
// ==========================================
router.get("/blogs/manage", authenticate, async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ publishedAt: -1 });
    res.status(200).json(blogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 14. DELETE A BLOG
// ==========================================
router.delete("/blogs/:id", authenticate, async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    
    const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
    if (cloudflareWebhookUrl) {
      fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
    }
    
    res.status(200).json({ message: "Blog deleted! Rebuilding site..." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 15. UPDATE/EDIT A BLOG
// ==========================================
router.put("/blogs/:id", authenticate, async (req, res) => {
  try {
    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
    if (cloudflareWebhookUrl) {
      fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
    }
    
    res.status(200).json({ message: "Blog updated! Rebuilding site...", updatedBlog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;