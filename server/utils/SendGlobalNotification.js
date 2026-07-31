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

module.exports = {
    sendGlobalNotification
};