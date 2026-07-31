const express = require('express');
const notificationController = require('../controllers/NotificationController');
const authenticate = require('../middleware/authenticate'); // Fixed import format to match your App.js
const { sendGlobalNotification } = require('../utils/SendGlobalNotification');
const router = express.Router();

// 1. Initialize Web Push 
// 1. Initialize Web Push SAFELY


// --- DEVICE SUBSCRIPTION ROUTES ---
router.post("/api/save-subscription", authenticate, notificationController.saveSubscription);

// --- NOTIFICATION INBOX ROUTES ---
router.get("/api/notifications", authenticate, notificationController.getNotifications);

router.put("/api/notifications/mark-read", authenticate, notificationController.markNotificationRead);

router.put("/api/notifications/mark-all-read", authenticate, notificationController.MarkAllNotificationsRead);

// --- UTILITY: GLOBAL NOTIFICATION SENDER ---


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