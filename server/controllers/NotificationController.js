const webpush = require('web-push');
const mongoose = require('mongoose');

// Models & Middleware
const User = require('../models/userSchema');

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

const saveSubscription = async (req, res) => {
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
}

const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("notifications");
    if (!user) return res.status(404).json({ error: "User not found" });
    const sortedNotifications = [...user.notifications].reverse();
    res.status(200).json(sortedNotifications);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching notifications" });
  }
}

const markNotificationRead =async (req, res) => {
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
}
const MarkAllNotificationsRead =  async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.userId },
      { "$set": { "notifications.$[].isRead": true } }
    );
    res.status(200).json({ message: "All notifications cleared" });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear notifications" });
  }
}

module.exports = {
  saveSubscription,
    getNotifications,
    markNotificationRead,
    MarkAllNotificationsRead,
};