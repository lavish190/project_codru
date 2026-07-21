const express = require('express');
const webpush = require('web-push');
const mongoose = require('mongoose');

// Models & Middleware
const User = require('../models/userSchema');
const authenticate = require('../middleware/authenticate'); // Fixed import format to match your App.js

const router = express.Router();

// 1. Initialize Web Push 
try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@cutelearning.com',
      process.env.VAPID_PUBLIC_KEY.trim(),
      process.env.VAPID_PRIVATE_KEY.trim()
    );
  } else {
    console.warn("⚠️ VAPID keys missing in notification.js - Push disabled.");
  }
} catch (error) {
  console.error("❌ Web-Push Setup Failed in notification.js:", error.message);
}

// --- DEVICE SUBSCRIPTION ROUTES ---
router.post("/api/save-subscription", authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: "No subscription provided" });

    const user = await User.findById(req.userId);
    const isAlreadySubscribed = user.pushSubscriptions.some(
      (sub) => sub.endpoint === subscription.endpoint
    );

    if (!isAlreadySubscribed) {
      user.pushSubscriptions.push(subscription);
      user.markModified('pushSubscriptions'); 
      await user.save();
    }
    res.status(200).json({ message: "Device linked successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to sync device." });
  }
});

// --- NOTIFICATION INBOX ROUTES ---
router.get("/api/notifications", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("notifications");
    if (!user) return res.status(404).json({ error: "User not found" });
    const sortedNotifications = [...user.notifications].reverse();
    res.status(200).json(sortedNotifications);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching notifications" });
  }
});

router.put("/api/notifications/mark-read", authenticate, async (req, res) => {
  try {
    const { index } = req.body; 
    const user = await User.findById(req.userId);
    if (user.notifications[index]) {
      user.notifications[index].isRead = true;
      user.markModified('notifications'); 
      await user.save();
      res.status(200).json({ message: "Marked as read" });
    } else {
      res.status(404).json({ error: "Notification not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error updating notification" });
  }
});

router.put("/api/notifications/mark-all-read", authenticate, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { "$set": { "notifications.$[].isRead": true } }
    );
    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

// --- UTILITY: GLOBAL NOTIFICATION SENDER ---
const sendGlobalNotification = async (username, title, message, link) => {
  try {
    const user = await User.findOne({ username });
    if (!user) return;

    const newNotif = {
      message: message,
      link: link || "",
      date: new Date().toISOString(),
      isRead: false
    };
    user.notifications.push(newNotif);
    await user.save();

    const payload = JSON.stringify({ title, body: message, link });
    const pushPromises = user.pushSubscriptions.map(sub => 
      webpush.sendNotification(sub, payload).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          return User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
        }
      })
    );
    await Promise.all(pushPromises);
  } catch (err) {
    console.error("Global Notify Error:", err);
  }
};

// --- ADMIN GLOBAL BROADCAST ROUTE ---
// 🚨 Notice this is router.post now, not app.post!
router.post("/api/admin/broadcast", authenticate, async (req, res) => {
  const { title, message, link } = req.body;

  try {
    const adminUser = await User.findById(req.userId);
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "Unauthorized access to broadcast." });
    }

    const allUsers = await User.find({});
    const broadcastPromises = allUsers.map(async (user) => {
      const newNotif = { message, link: link || "/dashboard", date: new Date().toISOString(), isRead: false };
      user.notifications.push(newNotif);
      if (user.notifications.length > 50) user.notifications.shift(); 
      await user.save();

      if (user.pushSubscriptions && user.pushSubscriptions.length > 0) {
        const payload = JSON.stringify({ title: title || "CuTe Learning Alert!", body: message, link: link || "/dashboard" });
        const devicePushes = user.pushSubscriptions.map(sub => 
          webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              return User.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
            }
          })
        );
        return Promise.all(devicePushes);
      }
    });

    await Promise.all(broadcastPromises);
    res.status(200).json({ message: `Broadcast sent to ${allUsers.length} users!` });
  } catch (error) {
    res.status(500).json({ error: "Broadcast operation failed." });
  }
});

// 🚨 THIS IS THE MOST IMPORTANT LINE: Export the router so App.js can use it!
module.exports = router;