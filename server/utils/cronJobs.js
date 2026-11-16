const cron = require('node-cron');
const { google } = require("googleapis");
const Event = require('../models/eventSchema'); 
const Booking = require("../models/bookingSchema");
const User = require("../models/userSchema");
const sendAutoNotification = require('./notify');
const Post = require('../models/postSchema');
const Blog = require('../models/blogSchema');

// 🚨 IMPORT YOUR NEW MODULAR PUBLISHERS HERE
const { publishToLinkedIn } = require('./publishers');

// ==========================================
// HELPER: MARK AS NO-SHOW
// ==========================================
const markAsNoShow = async (booking, app) => {
  booking.status = "missed";
  await booking.save();

  await sendAutoNotification(
    app, booking.parent._id,
    `📅 We missed you! Please reschedule your Discovery Call to continue admissions.`,
    "admission-portal", "System"
  );
};

// ==========================================
// TASK 1: GOOGLE MEET ATTENDANCE CHECKER
// ==========================================
const checkAttendanceAndUnlockStep2 = async (app) => {
  console.log("🕵️‍♂️ Running Google Meet Attendance Check...");

  try {
    const bufferTime = new Date(Date.now() - 45 * 60 * 1000); // 30 min meeting + 15 min API buffer
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000); 

    const pendingCalls = await Booking.find({
      status: "scheduled",
      date: { $lte: bufferTime, $gte: twoDaysAgo } 
    }).populate("parent").populate("counselor");

    if (pendingCalls.length === 0) return;

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/meetings.space.readonly'],
      subject: 'admin@curiousteamlearning.com'
    });
    
    const meet = google.meet({ version: 'v2', auth });

    for (const booking of pendingCalls) {
      if (!booking.meetLink) continue;
      const meetCode = booking.meetLink.split('.com/')[1];
      if (!meetCode) continue;

      try {
        const recordsRes = await meet.conferenceRecords.list({
          filter: `space='spaces/${meetCode}'`
        });

        const records = recordsRes.data.conferenceRecords || [];
        if (records.length === 0) {
          await markAsNoShow(booking, app);
          continue;
        }

        let parentAttended = false;

        for (const record of records) {
          const participantsRes = await meet.conferenceRecords.participants.list({
            parent: record.name
          });

          const participants = participantsRes.data.participants || [];
          
          for (const p of participants) {
            const guestEmail = p.signedinUser?.user?.email?.toLowerCase();
            const guestName = p.anonymousUser?.displayName?.toLowerCase();

            if (
              (guestEmail && booking.email && guestEmail === booking.email.toLowerCase()) ||
              (guestName && booking.parentName && guestName.includes(booking.parentName.toLowerCase()))
            ) {
              parentAttended = true;
              break;
            }
          }
          if (parentAttended) break;
        }

        if (parentAttended) {
          console.log(`✅ [ATTENDED] Parent ${booking.parentName} verified via Google Meet API.`);
          
          booking.status = "completed";
          await booking.save();

          const parent = booking.parent; 
          if (parent && parent.admissionStage === 1) {
            parent.admissionStage = 2;
            await parent.save();

            await sendAutoNotification(
              app, parent._id,
              `🎉 Discovery Call complete! Step 2: Assessment is now unlocked.`,
              "admission-portal", "System"
            );
          }
        } else {
          console.log(`❌ [NO-SHOW] Parent ${booking.parentName} did not join.`);
          await markAsNoShow(booking, app);
        }

      } catch (meetApiError) {
        console.error(`Error checking Meet API for booking ${booking._id}:`, meetApiError.message);
      }
    }
  } catch (error) {
    console.error("Attendance Cron Error:", error);
  }
};

// ==========================================
// MASTER SCHEDULER EXPORT
// ==========================================
const startAllCronJobs = (app) => {
  console.log("⏰ Master Cron Scheduler Initialized");

  // 1. EVENT REMINDERS (Runs every 1 minute)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const upcomingEvents = await Event.find({ 
        reminderSent: false,
        date: { $gte: now } 
      });

      for (const event of upcomingEvents) {
        const reminderTime = new Date(event.date.getTime() - (event.reminderMinutes * 60000));

        if (now >= reminderTime) {
          let message = `Reminder: "${event.title}" starts in ${event.reminderMinutes} minutes!`;
          if (event.reminderMinutes === 0) {
            message = `"${event.title}" is starting right now!`;
          }

          await sendAutoNotification(
            app, 
            event.user, 
            message, 
            '/dashboard?view=schedule', 
            'System'
          );

          event.reminderSent = true;
          await event.save();
        }
      }
    } catch (error) {
      console.error("Calendar Cron Job Error:", error);
    }
  });

  // 2. ATTENDANCE CHECKER (Runs every 30 minutes)
  cron.schedule('*/30 * * * *', () => {
    checkAttendanceAndUnlockStep2(app);
  });

  // 3. POST PUBLISHER (Runs every 1 minute)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const duePosts = await Post.find({
        $or: [
          { status: "scheduled", scheduledFor: { $lte: now } },
          { "distribution.linkedin.status": "scheduled", "distribution.linkedin.scheduledFor": { $lte: now } },
          { "distribution.facebook.status": "scheduled", "distribution.facebook.scheduledFor": { $lte: now } }
        ]
      });

      for (const post of duePosts) {
        let modified = false;
        const apiTasks = []; // Holds all external API calls for this post

        // --- A. HANDLE LINKEDIN PUBLISHING ---
        if (post.distribution?.linkedin?.status === "scheduled" && new Date(post.distribution.linkedin.scheduledFor) <= now) {
          apiTasks.push(
            publishToLinkedIn(post)
              .then(() => { post.distribution.linkedin.status = "posted"; })
              .catch((err) => {
                post.distribution.linkedin.status = "failed";
                post.distribution.linkedin.errorLog = err.message;
              })
          );
          modified = true;
        }

        // --- B. HANDLE FACEBOOK PUBLISHING ---
        if (post.distribution?.facebook?.status === "scheduled" && new Date(post.distribution.facebook.scheduledFor) <= now) {
          apiTasks.push(
            publishToFacebook(post)
              .then(() => { post.distribution.facebook.status = "posted"; })
              .catch((err) => {
                post.distribution.facebook.status = "failed";
                post.distribution.facebook.errorLog = err.message;
              })
          );
          modified = true;
        }

        // --- C. HANDLE CUTE FEED PUBLISHING ---
        if (post.status === "scheduled" && post.scheduledFor && new Date(post.scheduledFor) <= now) {
          post.status = "published";
          if (post.distribution?.cute) post.distribution.cute.status = "posted";
          post.createdAt = now; 
          modified = true;

          const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
          if (cloudflareWebhookUrl) {
            fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
          }
        }

        // Wait for all external APIs to process for this post concurrently
        if (apiTasks.length > 0) {
          await Promise.allSettled(apiTasks);
        }

        if (modified) {
          await post.save();
          console.log(`✅ Processed auto-publishing for scheduled post: ${post._id}`);
        }
      }

      // --- D. HANDLE BLOG PUBLISHING ---
      const dueBlogs = await Blog.find({ 
        status: "scheduled", 
        scheduledFor: { $lte: now } 
      });

      let triggeredBlogWebhook = false;

      for (const blog of dueBlogs) {
        blog.status = "published";
        blog.publishedAt = now; // Update the date so it shows today's date on the website!
        await blog.save();
        triggeredBlogWebhook = true;
        console.log(`✅ Auto-published scheduled blog: ${blog._id}`);
      }

      // If at least one blog was published, trigger the Cloudflare build ONCE
      if (triggeredBlogWebhook) {
        const cloudflareWebhookUrl = process.env.CLOUDFLARE_DEPLOY_WEBHOOK;
        if (cloudflareWebhookUrl) {
          fetch(cloudflareWebhookUrl, { method: "POST" }).catch(console.error);
          console.log("🚀 Pinged Cloudflare Webhook for new scheduled blogs");
        }
      }

    } catch (error) {
      console.error("Scheduled Post Cron Error:", error);
    }
  });
};

module.exports = startAllCronJobs;