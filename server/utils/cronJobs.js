const cron = require('node-cron');
const { google } = require("googleapis");
const Event = require('../models/eventSchema'); 
const Booking = require("../models/bookingSchema");
const User = require("../models/userSchema");
const sendAutoNotification = require('./notify');
const Post = require('../models/postSchema');
const SocialConnection = require('../models/SocialConnection');
// Destructure the function from the formatters.js file
const { formatHtmlForLinkedIn } = require('./formatters');

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
      date: { $lte: bufferTime, $gte: twoDaysAgo } // Swapped oneHourAgo for bufferTime
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

      // Find ANY posts that have a scheduled action due right now
      const duePosts = await Post.find({
        $or: [
          { status: "scheduled", scheduledFor: { $lte: now } },
          { "distribution.linkedin.status": "scheduled", "distribution.linkedin.scheduledFor": { $lte: now } }
        ]
      });

      for (const post of duePosts) {
        let modified = false;

        // --- A. HANDLE LINKEDIN PUBLISHING ---
        if (post.distribution?.linkedin?.status === "scheduled" && new Date(post.distribution.linkedin.scheduledFor) <= now) {
          
          const connection = await SocialConnection.findOne({ userId: post.userId, provider: 'linkedin' });
          
          if (connection && connection.accessToken) {
            const plainTextContent = formatHtmlForLinkedIn(post.content || '');
            
            try {
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
                  specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                      shareCommentary: { text: plainTextContent },
                      shareMediaCategory: 'NONE' // Text only (Image support to come!)
                    }
                  },
                  visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
                })
              });

              if (linkedInRes.ok) {
                post.distribution.linkedin.status = "posted";
              } else {
                const errData = await linkedInRes.json();
                post.distribution.linkedin.status = "failed";
                post.distribution.linkedin.errorLog = errData.message;
              }
            } catch (err) {
              post.distribution.linkedin.status = "failed";
              post.distribution.linkedin.errorLog = err.message;
            }
          } else {
            post.distribution.linkedin.status = "failed";
            post.distribution.linkedin.errorLog = "LinkedIn token not found or expired.";
          }
          modified = true;
        }

        // --- B. HANDLE CUTE FEED PUBLISHING ---
        if (post.status === "scheduled" && post.scheduledFor && new Date(post.scheduledFor) <= now) {
          post.status = "published";
          if (post.distribution?.cute) post.distribution.cute.status = "posted";
          post.createdAt = now; // 🚨 Resets the timestamp so it goes to the top of the feed!
          modified = true;
        }

        // Save the updated statuses to MongoDB
        if (modified) {
          await post.save();
          console.log(`✅ Processed auto-publishing for scheduled post: ${post._id}`);
        }
      }
    } catch (error) {
      console.error("Scheduled Post Cron Error:", error);
    }
  });
};

module.exports = startAllCronJobs;