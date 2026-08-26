const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const startCalendarCron = require('./utils/cronJobs');
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const { google } = require("googleapis");
const authenticate = require("./middleware/authenticate"); // Import it
const Post = require("./models/postSchema"); // Check if your path/filename is correct
const User = require("./models/userSchema");
const jwt = require("jsonwebtoken");
const http = require('http');
const sendAutoNotification = require("./utils/notify");
const welcomeTemplate = require("./utils/welcomeTemplate"); // For consistent welcome emails
const { contactUsTemplate } = require("./utils/contactUsTemplate"); // For consistent contact email formatting
const Event = require("./models/eventSchema");
const ConnectionRequest = require("./models/connectionRequestSchema");
const adminOtpTemplate = require("./utils/adminOtpTemplate");
const OTP = require("./models/otpSchema");
const transporter = require('./utils/transporter'); // Adjust the path if needed
const paymentRoutes = require("./router/paymentRoutes");
const { userBrochureTemplate, adminBrochureTemplate } = require("./utils/brochureTemplates");

dotenv.config({ path: "./config.env" });
const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => {
    res.status(200).send("OK - Server is alive");
});

const io = new Server(server, { 
  cors: { 
    origin: [
      process.env.FRONTEND_URL,
      "https://app.curiousteamlearning.com",
      "https://curiousteamlearning.com",       // 🚨 ADD THIS: Your naked domain
      "https://www.curiousteamlearning.com",   // 🚨 ADD THIS: Your www domain
      "http://localhost:5173",                 // React local dev
      "http://localhost:8788"               // Keeps local development working!
    ],
    credentials: true
  } 
});

io.on("connection", (socket) => {
  socket.on("join", (username) => {
    socket.join(username); 
    console.log(`User ${username} joined their notification room!`);
  });
});

// 2. THE SECRET SAUCE: Attach 'io' to the Express app!
app.set('io', io);

startCalendarCron(app);
// 1. Define the allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://app.curiousteamlearning.com",
  "http://localhost:5173"
];

// 2. The Smart CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin); // Dynamically echoes the exact frontend URL back!
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Now this is 100% legal and secure
}));
app.use(express.json());

const port = process.env.PORT || 8080;
// const HOST = "0.0.0.0";

app.use(express.json({ parameterLimit: "100000", limit: "500mb" }));
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);


// app.use(express.static(path.join(__dirname, "public")));

require("./db/conn.js");
const Enquiry = require("./models/enquirySchema.js");
const ContactInfo = require("./models/trainingSchema");
const BotEnroll = require("./models/botEnrollSchema");
const Blog = require("./models/postSchema.js");
const Course = require("./models/courseSchema");
const CourseEnrollment = require("./models/courseEnrollmentSchema");

app.use(require("./router/userauth.js"));
app.use(require("./router/postAuth.js"));
app.use(require("./router/courseauth.js"));
app.use(require("./router/training.js"));
app.use(require("./router/courseRoutes.js"));
app.use(require("./router/syllabusRoutes.js"));
app.use(require("./router/seedroute.js"));
app.use(require("./router/notification.js"));
app.use(require('./router/whatsapp'));
app.use(require('./router/crm')); 
app.use(require('./router/overview'));
app.use("/internship",require("./router/InternshipRoutes.js"));
app.use("/api/payment", paymentRoutes);

let notifications = {};

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ==========================================
// GOOGLE CALENDAR API (SERVICE ACCOUNT)
// ==========================================
// Global memory variables (place these outside your route so they persist)
let cachedEvents = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

app.post("/unlock-attachment", authenticate, async (req, res) => {
  try {
    // 🚨 Now we accept the specific fileId they clicked on!
    const { googleEventId, fileId } = req.body; 

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive' 
      ],
      subject: 'admin@curiousteamlearning.com'
    });

    const calendar = google.calendar({ version: 'v3', auth });
    const drive = google.drive({ version: 'v3', auth });

    // 1. Fetch the event
    const event = await calendar.events.get({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId: googleEventId
    });

    // 2. Security Check 1: Is the user invited?
    const attendees = event.data.attendees || [];
    const isInvited = attendees.some(
      guest => guest.email.toLowerCase() === req.user.email.toLowerCase()
    );

    if (!isInvited && req.user.email.toLowerCase() !== 'admin@curiousteamlearning.com') {
      return res.status(403).json({ error: "Unauthorized: You were not invited to this class." });
    }

    // 3. Security Check 2: Is this file actually attached to this event?
    const attachments = event.data.attachments || [];
    const validAttachment = attachments.find(att => att.fileId === fileId);
    
    if (!validAttachment) {
      return res.status(404).json({ error: "File not found in this event." });
    }

    // 4. Unlock the file!
    try {
      await drive.permissions.create({
        fileId: fileId,
        sendNotificationEmail: false, 
        requestBody: {
          role: 'reader',
          type: 'user',
          emailAddress: req.user.email 
        }
      });
    } catch (permError) {
      console.log("Permission note:", permError.message);
    }

    // Return the URL to the frontend
    res.status(200).json({ fileUrl: validAttachment.fileUrl });

  } catch (error) {
    console.error("Failed to unlock attachment:", error.message);
    res.status(500).json({ error: "Server error unlocking file" });
  }
});

// ==========================================
// GOOGLE CALENDAR API (FILTERED BY GUEST LIST)
// ==========================================
app.get("/calendar-events", authenticate, async (req, res) => {
  try {
    const currentTime = Date.now();
    
    // ==========================================
    // 1. REFRESH CACHE LOGIC (Google Calendar)
    // ==========================================
    if (currentTime - lastFetchTime > CACHE_DURATION) {
      console.log("Fetching fresh data from Google Calendar...");
      
      try {
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        });

        const calendar = google.calendar({ version: 'v3', auth });
        let allMappedEvents = [];
        let pageToken = null;
        const timeLimit = new Date();
        timeLimit.setMonth(timeLimit.getMonth() - 3); 

        do {
          const response = await calendar.events.list({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
            timeMin: timeLimit.toISOString(),
            conferenceDataVersion: 1, 
            pageToken: pageToken
          });

          const mappedBatch = response.data.items.map(event => {
            let meetLink = event.hangoutLink;
            if (!meetLink && event.conferenceData?.entryPoints) {
              const videoCall = event.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video');
              if (videoCall) meetLink = videoCall.uri;
            }

            return {
              id: event.id || Math.random().toString(),
              title: event.summary || 'Untitled Event',
              date: event.start?.dateTime || event.start?.date,
              meetLink: meetLink, 
              description: event.description || null,
              attendees: event.attendees ? event.attendees.map(a => a.email.toLowerCase()) : [],
              organizer: event.organizer?.email || "",
              attachments: event.attachments ? event.attachments.map(att => ({ 
                title: att.title,
                fileUrl: att.fileUrl,
                fileId: att.fileId,     // 🚨 ADD THIS: Needed for the unlock loading state
                mimeType: att.mimeType
              })) : []
            };
          });

          allMappedEvents.push(...mappedBatch);
          pageToken = response.data.nextPageToken; 
        } while (pageToken);

        cachedEvents = allMappedEvents;
        lastFetchTime = currentTime;
      } catch (googleErr) {
        console.error("Google Fetch Failed, using existing cache:", googleErr.message);
      }
    }

    // ==========================================
    // 2. MONGODB QUERY (Owners & Guests)
    // ==========================================
    const userRole = req.user.role?.toLowerCase() || req.user.Role?.toLowerCase() || 'student';
    const currentUsername = req.user.username || '';
    let targetEmail = req.user.email?.toLowerCase() || '';
    let localEvents = [];

    if (userRole === 'teacher' && req.query.username) {
      // Teacher viewing a specific student's calendar
      const targetStudent = await User.findOne({ username: req.query.username });
      if (targetStudent) {
        targetEmail = targetStudent.email.toLowerCase();
        localEvents = await Event.find({
          $or: [
            { user: targetStudent._id }, 
            { guests: targetStudent.username }
          ]
        });
      }
    } else {
      // Normal flow: Fetch events the user created OR was invited to as a guest
      const queryOr = [{ user: req.user._id }];
      if (currentUsername) queryOr.push({ guests: currentUsername });
      
      localEvents = await Event.find({ $or: queryOr });
    }

    // ==========================================
    // 3. ENHANCING MONGODB EVENTS & ID MAPPING
    // ==========================================
    const localGoogleIds = new Set();
    
    const enhancedLocalEvents = localEvents.map(localEvent => {
      const dbEvent = localEvent.toObject();
      if (dbEvent.googleEventId) localGoogleIds.add(dbEvent.googleEventId);
      
      const matchingGoogleEvent = cachedEvents.find(ge => ge.id === dbEvent.googleEventId);
      
      return {
        ...dbEvent,
        id: dbEvent._id.toString(), // Must be string for React
        creatorId: dbEvent.user ? dbEvent.user.toString() : null, // 🚨 Maps db 'user' to frontend 'creatorId'
        guests: dbEvent.guests || [],
        attachments: matchingGoogleEvent ? matchingGoogleEvent.attachments : (dbEvent.attachments || [])
      };
    });

    // ==========================================
    // 4. GOOGLE CALENDAR FILTERING
    // ==========================================
    const standaloneGoogleEvents = cachedEvents.filter(event => {
      // Skip if we already merged this event with a MongoDB record
      if (localGoogleIds.has(event.id)) return false;

      // 🚨 ADMIN/ORGANIZER FIX: The Workspace owner sees the entire Google Calendar
      if (targetEmail === 'admin@curiousteamlearning.com') return true;

      // For everyone else, they must be an explicit attendee or the organizer
      const isAttendee = event.attendees && Array.isArray(event.attendees) && event.attendees.includes(targetEmail);
      const isOrganizer = event.organizer && event.organizer.toLowerCase() === targetEmail;
      
      return isAttendee || isOrganizer;
    });

    // ==========================================
    // 5. SEND FINAL MERGED ARRAY
    // ==========================================
    res.status(200).json([...enhancedLocalEvents, ...standaloneGoogleEvents]);

  } catch (error) {
    console.error("Calendar fetch error:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

// --- DELETE EVENT ---
app.delete("/calendar-events/:id", authenticate, async (req, res) => {
  try {
    const eventId = req.params.id;

    // 1. Find the event in MongoDB
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found." });

    // 2. Security Check: Only the creator can delete
    if (!event.user || event.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized: You can only delete your own events." });
    }

    // 3. Delete from Google Calendar (if a Google Event exists)
    if (event.googleEventId) {
      try {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: 'admin@curiousteamlearning.com'
        });
        const calendar = google.calendar({ version: 'v3', auth });

        await calendar.events.delete({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          eventId: event.googleEventId,
          sendUpdates: 'all'
        });
      } catch (googleErr) {
        console.log("Note: Event already removed from Google Workspace or inaccessible.");
      }
    }

    // 4. Permanently delete from MongoDB
    await Event.findByIdAndDelete(eventId);

    const currentGuests = event.guests || [];
    if (currentGuests.length > 0) {
      const guestUsers = await User.find({ username: { $in: currentGuests } });
      
      for (const guest of guestUsers) {
        await sendAutoNotification(
          req.app,
          guest._id,
          `❌ Class Cancelled: "${event.title}" has been removed from the schedule.`,
          "schedule",
          req.user.username
        );
      }
    }

    lastFetchTime = 0; // Force refresh cache on next fetch
    
    res.status(200).json({ message: "Event successfully deleted from Database and Google Calendar." });

  } catch (error) {
    console.error("Delete operation failed:", error);
    res.status(500).json({ error: "Server error deleting event" });
  }
});

// --- EDIT EVENT ---
app.put("/calendar-events/:id", authenticate, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { title, date, type, color, reminderMinutes, guests } = req.body;

    // 1. Find the event in MongoDB
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: "Event not found." });

    // 2. Security Check: Only the creator can edit
    if (!event.user || event.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized: You can only edit your own events." });
    }

    const updatedDate = new Date(date); // Parsed from frontend ISO string
    const endDate = new Date(updatedDate.getTime() + 60 * 60 * 1000); // Default to 1 hour duration

    // 3. Update Google Calendar (if a Google Event exists)
    if (event.googleEventId) {
      try {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: 'admin@curiousteamlearning.com'
        });
        const calendar = google.calendar({ version: 'v3', auth });

        // Using patch so we don't accidentally wipe out the Meet link or attachments
        await calendar.events.patch({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          eventId: event.googleEventId,
          sendUpdates: 'all',
          requestBody: {
            summary: title,
            start: { dateTime: updatedDate.toISOString() },
            end: { dateTime: endDate.toISOString() }
            // Note: We don't update attendees here yet unless you specifically want to sync guests to Google
          }
        });
      } catch (googleErr) {
        console.error("Google sync failed during edit:", googleErr.message);
        // We continue anyway so the local DB at least gets updated
      }
    }

    // 4. Update Local MongoDB
    event.title = title || event.title;
    event.date = updatedDate;
    if (type) event.type = type;
    if (color) event.color = color;
    if (reminderMinutes !== undefined) event.reminderMinutes = reminderMinutes;
    if (guests !== undefined) event.guests = guests;

    await event.save();

    const currentGuests = event.guests || [];
    if (currentGuests.length > 0) {
      const guestUsers = await User.find({ username: { $in: currentGuests } });
      
      for (const guest of guestUsers) {
        await sendAutoNotification(
          req.app,
          guest._id,
          `✏️ Class Updated: Details for "${event.title}" have changed.`,
          "schedule",
          req.user.username
        );
      }
    }

    res.status(200).json({ message: "Event successfully updated.", event });

  } catch (error) {
    console.error("Edit operation failed:", error);
    res.status(500).json({ error: "Server error updating event" });
  }
});

app.get("/auth/google", (req, res) => {
  const callbackPort = req.query.callbackPort || "";
  const source = req.query.source || ""; // Catch the desktop source
  const returnTo = req.query.returnTo || req.query.state || "/";

  // Encode callbackPort, source, and returnTo into a base64 state string
  const stateData = JSON.stringify({ callbackPort, source, returnTo });

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account", // Forces account selection (good for desktop!)
    scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"],
    state: Buffer.from(stateData).toString("base64"),
  });
  res.redirect(url);
});

// ==========================================
// CREATE NEW EVENT (Hybrid: MongoDB + Google Calendar)
// ==========================================
app.post("/calendar-events", authenticate, async (req, res) => {
  try {
    const { title, date, type, color, reminderMinutes, guests, addMeet, description } = req.body;

    if (!title || !date) return res.status(400).json({ error: "Title and Date are required" });

    const eventDate = new Date(date);
    const eventEndDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    // 1. Convert Usernames to Emails for Google
    const googleAttendees = [{ email: req.user.email }];
    if (guests && guests.length > 0) {
      const guestUsers = await User.find({ username: { $in: guests } });
      guestUsers.forEach(user => {
        if (user.email.toLowerCase() !== req.user.email.toLowerCase()) {
          googleAttendees.push({ email: user.email.toLowerCase() });
        }
      });
    }

    // 2. Configure Google Meet
    let conferenceData = undefined;
    if (addMeet) {
      conferenceData = {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      };
    }

    // 3. Authenticate with Google
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: 'admin@curiousteamlearning.com'
    });
    const calendar = google.calendar({ version: 'v3', auth });

    // 4. Create in Google FIRST
    const googleEventReq = {
      summary: `[${type.toUpperCase()}] ${title}`,
      description: description || `Created via Platform by @${req.user.username || 'User'}`,
      start: { dateTime: eventDate.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: eventEndDate.toISOString(), timeZone: 'Asia/Kolkata' },
      attendees: googleAttendees,
      conferenceData: conferenceData 
    };

    const googleRes = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: googleEventReq,
      sendUpdates: 'all', 
      conferenceDataVersion: 1 
    });

    // 5. NOW save to MongoDB, including all the generated Google links!
    const newEvent = new Event({
      title, 
      date: eventDate, 
      type, 
      color, 
      reminderMinutes, 
      user: req.user._id,
      googleEventId: googleRes.data.id,               // 🚨 Saved for deleting later
      meetLink: googleRes.data.hangoutLink || null,   // 🚨 The Google Meet Video URL
      htmlLink: googleRes.data.htmlLink,              // 🚨 The Google Calendar URL
      guests: guests || []
    });

    await newEvent.save();

    if (guests && guests.length > 0) {
      const guestUsers = await User.find({ username: { $in: guests } });
      
      // 3. Send your custom system notification to every guest!
      for (const guest of guestUsers) {
        await sendAutoNotification(
          req.app,               // Socket.io instance
          guest._id,             // Receiver's ID
          `📅 New Class: You've been scheduled for "${title}"`, // Message
          "schedule",            // The view link (your sw.js will parse this perfectly!)
          req.user.username      // Audit: Who created it
        );
      }
    }

    lastFetchTime = 0;
    res.status(201).json(newEvent);

  } catch (error) {
    console.error("Failed to save event:", error);
    res.status(500).json({ error: "Server error creating event" });
  }
});
// 🚨 Ensure sendAutoNotification and transporter are imported at the top!

app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;

  // 1. Decode state (from File 2)
  let callbackPort = "";
  let source = "";
  let returnTo = "/";
  try {
    const stateRaw = req.query.state;
    if (stateRaw) {
      const parsed = JSON.parse(Buffer.from(stateRaw, "base64").toString("utf8"));
      callbackPort = parsed.callbackPort || "";
      source = parsed.source || "";
      returnTo = parsed.returnTo || "/";
    }
  } catch (e) {
    returnTo = req.query.state || "/";
  }

  if (!code) return res.status(400).json({ error: "Code missing from Google" });

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: "v2" });
    const { data } = await oauth2.userinfo.get(); 

    let user = await User.findOne({ email: data.email });
    let isFirstTime = false; 

    if (!user) {
      // BRAND NEW USER VIA GOOGLE (From File 1)
      let baseUsername = data.email.split('@')[0]; 
      isFirstTime = true;
      
      user = new User({
        name: data.name,
        email: data.email,
        username: baseUsername,
        photo: data.picture,
        isEmailVerified: true,
        role: "User",
        googleId: data.id,           
        authProvider: "google"       
      });

      try {
        await user.save();
      } catch (saveError) {
        user.username = `${baseUsername}${Math.floor(Math.random() * 10000)}`;
        await user.save();
      }

      // NEW USER HANDSHAKE (Admin Notification + Welcome Email)
      if (isFirstTime) {
        try {
          const admins = await User.find({ isAdmin: true });
          const notifyPromises = admins.map((admin) => 
            sendAutoNotification(
              req.app,
              admin._id,
              `🌐 New Google Sign-up: ${user.name} (@${user.username}) just joined!`,
              "manage-users",
              user.username
            )
          );
          await Promise.all(notifyPromises);
        } catch (err) { console.error("Admin notify error:", err); }

        const welcomeHtml = welcomeTemplate(user.name || user.username);
        const mailOptions = {
          from: process.env.EMAIL,
          to: user.email,
          subject: "Welcome to Curious Team Learning! 🚀",
          html: welcomeHtml 
        };
  
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) console.error("Failed to send welcome email:", error);
        });
      }
    } 
    else {
      // 🚨 ACCOUNT LINKING MAGIC 🚨 (Kept from File 1!)
      if (!user.googleId) {
        user.googleId = data.id;
        user.authProvider = "google-linked";
        if (!user.photo && data.picture) {
            user.photo = data.picture;
        }
        await user.save();
      }
    }

    // Generate Token
    const token = jwt.sign(
      { 
        _id: user._id, 
        username: user.username, 
        role: user.role, 
        isAdmin: user.isAdmin 
      }, 
      process.env.TOKEN_SECRET, 
      { expiresIn: "14d" }
    );

    // 🚨 DESKTOP APP DEEP LINK REDIRECT
    if (source === "desktop") {
      const safeName = encodeURIComponent(user.name || "");
      const safePhoto = encodeURIComponent(user.photo || "");
      const safeRole = encodeURIComponent(user.role || "User");
      const isAdminStr = user.isAdmin ? "true" : "false";

      let callbackUrl = `cutelearning://auth-callback?token=${token}&username=${user.username}&name=${safeName}&photo=${safePhoto}&role=${safeRole}&isAdmin=${isAdminStr}`;
      if (isFirstTime) callbackUrl += "&new=true";
      
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Login Successful</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px; background: #f4f7f6;">
          <h2 style="color: #2e7d32;">✅ Login Successful!</h2>
          <p style="color: #555;">Redirecting you back to the CuTe Learning App...</p>
          <script>
            window.location.href = "${callbackUrl}";
            setTimeout(() => {
              document.body.innerHTML += '<p style="margin-top:20px; color:#666;">If nothing happens, <a href="${callbackUrl}" style="color:#007bff; text-decoration:none; font-weight:bold;">Click Here</a>.</p>';
            }, 2500);
          </script>
        </body>
        </html>
      `);
    }

    // LEGACY LOCALHOST PORT REDIRECT (From File 2)
    if (callbackPort) {
      let callbackUrl = `http://127.0.0.1:${callbackPort}/auth-callback?token=${token}`;
      if (isFirstTime) callbackUrl += "&new=true";
      return res.redirect(callbackUrl);
    }

    // WEB REDIRECT WITH COOKIE (Kept from File 1!)
    const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000; 
    const cookieExpire = process.env.COOKIEEXPIRE ? Number(process.env.COOKIEEXPIRE) : fourteenDaysInMs;
    
    const options = {
      expires: new Date(Date.now() + cookieExpire), 
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", 
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    };

    const baseURL = process.env.FRONTEND_URL.replace(/\/$/, ""); 
    const safeReturnTo = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
    const finalUrl = new URL(safeReturnTo, baseURL);
    
    finalUrl.searchParams.append("token", token);
    if (isFirstTime) {
      finalUrl.searchParams.append("new", "true");
    }

    res.cookie("token", token, options).redirect(finalUrl.toString());
    
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/signin?error=auth_failed`);
  }
});

app.post('/botenroll', async (req, res) => {
  const formData = req.body;

  // Validate required fields
  if (!formData.name || !formData.age || !formData.email || !formData.countryCode || !formData.phone || !formData.course || !formData.duration) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  try {
    // Save the form data to the database
    const newEnrollment = new BotEnroll({
      name: formData.name,
      age: formData.age,
      email: formData.email,
      countryCode: formData.countryCode,
      phone: formData.phone,
      course: formData.course,
      duration: formData.duration,
      idea: formData.idea, // Optional field
    });

    await newEnrollment.save(); // Save to the database
    console.log("Bot enrollment saved successfully");

    // Send an email notification
    const mailOptions = {
      from: process.env.EMAIL,
      replyTo: formData.email,
      to: process.env.EMAIL,
      subject: `Bot Enrollment Form Submission from ${formData.name}`,
      text: `
        New Enrollment in Robotics Course. Please check:

        Name: ${formData.name}
        Age: ${formData.age}
        Email: ${formData.email}
        CountryCode: ${formData.countryCode}
        Phone: ${formData.phone}
        Course: ${formData.course}
        Duration: ${formData.duration}
        Idea: ${formData.idea || "No additional message provided"}
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ error: "Error sending email notification" });
      } else {
        console.log("Email sent: " + info.response);
        return res.status(200).json({ message: "Enrollment saved and email sent successfully" });
      }
    });
  } catch (error) {
    console.error("Error saving bot enrollment:", error);
    return res.status(500).json({ error: "Error saving bot enrollment" });
  }
});
app.post("/contactus", async (req, res) => {
  try {
    // 1. Extract the exact fields from your frontend form
    // (Removed 'subject', added 'countryCode' and 'phone')
    const { name, email, countryCode, phone, city, message } = req.body;

    // 2. Validate all required fields based on your Schema
    if (!name || !email || !countryCode || !phone || !message) {
      return res.status(400).json({ error: "Please fill in all required fields." });
    }

    // 3. Save to MongoDB First
    const newEnquiry = new Enquiry({
        name,
        email,
        countryCode,
        phone,
        city: city || "", // City is optional in your schema
        message 
    });
    
    await newEnquiry.save(); 

    // 4. Prepare HTML for the Email
    // Since 'subject' is gone, we just pass a hardcoded title to your template
    const emailTitle = "New Website Enquiry"; 
    const supportEmailHtml = contactUsTemplate(name, email, countryCode, phone, message);

    // 5. Send Email to Admin/Support Team
    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.EMAIL, 
      replyTo: email,
      // Added the phone number to the email subject line so you see it instantly!
      subject: `📩 Enquiry from ${name} (${countryCode} ${phone})`,
      html: supportEmailHtml
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) console.error("Contact Email Error:", error);
    });

    // 6. Notify All Admins (In-App + Real-time)
    try {
      const admins = await User.find({ isAdmin: true });
      
      const notifyPromises = admins.map((admin) => 
        sendAutoNotification(
          req.app, 
          admin._id, 
          `📩 New Website Enquiry from ${name}`, 
          "admin/messages", 
          name 
        )
      );
      
      await Promise.all(notifyPromises);
    } catch (err) {
      console.error("Admin Notification Error:", err);
    }

    res.status(200).json({ success: true, message: "Your message has been sent and saved!" });
  } catch (error) {
    console.error("Contact Form Error:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// ==========================================
// GET Notifications (With 7-Day Auto-Cleanup)
app.get("/notifications", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. Calculate the date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 2. Filter out anything older than 7 days
    const originalLength = user.notifications.length;
    user.notifications = user.notifications.filter(notif => {
      return new Date(notif.date) >= sevenDaysAgo;
    });

    // 3. If we deleted old ones, save the database
    if (user.notifications.length !== originalLength) {
      await user.save();
    }

    // 4. Reverse so newest is on top, and send to frontend
    const sortedNotifications = [...user.notifications].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json(sortedNotifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT Mark ALL Notifications as Read
app.put("/notifications/mark-all-read", authenticate, async (req, res) => {
  try {
    // The $[] operator tells MongoDB to update EVERY item in the array
    await User.updateOne(
      { _id: req.userId },
      { $set: { "notifications.$[].isRead": true } } 
    );
    res.status(200).json({ message: "All marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Server error updating notifications" });
  }
});

// PUT Mark Notification as Read
app.put("/notifications/mark-read", authenticate, async (req, res) => {
  try {
    const { notifId } = req.body; 
    
    // Find the user and update the specific notification's isRead status using MongoDB's $ set
    await User.updateOne(
      { _id: req.userId, "notifications._id": notifId },
      { $set: { "notifications.$.isRead": true } }
    );

    res.status(200).json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Server error updating notification" });
  }
});

// ==========================================
// PUSH NOTIFICATION (Permanent DB Version)
// ==========================================
// Line 389: Updated to use the Helper
app.post("/notifications/push", authenticate, async (req, res) => {
  const { usernames, message } = req.body;

  try {
    const users = await User.find({ username: { $in: usernames } });
    if (!users || users.length === 0) return res.json({ error: "Users not found" });

    // Loop through found users and use the helper for Real-time + DB Save
    const notifyPromises = users.map(user => 
      sendAutoNotification(
        req.app, 
        user._id, 
        message, 
        "profile",        // Default link
        req.user.username   // 🕵️‍♂️ Audit: Which admin sent the broadcast?
      )
    );

    await Promise.all(notifyPromises);

    res.status(201).json({ message: "Broadcast sent successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/count", async (req, res) => {
  try {
    const userCount = await User.countDocuments();

    res.json({
      userCount: userCount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error occurred" });
  }
});

app.post("/save-subscription", authenticate, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.userId || req.user._id;
    
    // 🧹 STEP 1: THE MASS CLEANUP
    // This finds ANY existing subscription with this exact device endpoint and deletes it.
    // If they have 27 clones from the old bug, this wipes out all 27 instantly!
    await User.findByIdAndUpdate(
      userId,
      { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } }
    );

    // 🛡️ STEP 2: THE SAFE ADD
    // Now that the array is perfectly scrubbed of this device, we add exactly ONE fresh copy back.
    await User.findByIdAndUpdate(
      userId,
      { $push: { pushSubscriptions: subscription } } 
    );

    res.status(200).json({ message: "Subscription saved and deduplicated." });
  } catch (error) {
    console.error("Save subscription error:", error);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// Route to get all users for the Admin Dashboard
app.get("/users", authenticate, async (req, res) => {
  try {
    // 🚨 Check if requester is actually an Admin
    const adminUser = await User.findById(req.userId);
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    // Find all users but exclude passwords for security
    const allUsers = await User.find({}).select("-password");
    
    res.status(200).json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error while fetching users." });
  }
});

app.delete("/user/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Find the user first so we have their exact _id, name, and email!
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User doesn't exist." });
    }

    const userId = user._id;

    // 🚨 2. CASCADE DELETES: Clean up their mess! 🚨
    
    // A. Delete every post authored by this user
    await Post.deleteMany({ userId: userId });

    // B. Remove this user from everyone else's followers/following arrays
    await User.updateMany(
      { $or: [{ followers: userId }, { following: userId }] },
      { $pull: { followers: userId, following: userId } }
    );

    // C. (Optional) If you have a Course schema, delete their courses too!
    // await Course.deleteMany({ creator: userId });

    // 3. Finally, delete the user document itself
    const deleted = await User.deleteOne({ _id: userId });

    if (deleted.deletedCount === 0) {
      return res.status(500).json({ error: "Failed to delete user." });
    }

    // 4. 🚨 EMAIL THE DELETED USER
    // We do this after deletion is confirmed, using the data we saved in step 1
    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Account Deleted - CuTe Learning",
      text: `Hi ${user.name || user.username},\n\nYour account on Curious Team Learning has been permanently deleted, along with all associated data.\n\nWe are sorry to see you go! If you ever wish to return, you are always welcome to create a new account.\n\nBest,\nCurious Team Learning`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) console.error("Failed to send account deletion email:", error);
    });

    // 5. 🚨 IN-APP NOTIFICATION TO ALL ADMINS
    // Create an audit trail for the leadership team
    try {
      const admins = await User.find({ isAdmin: true });
      
      const notifyPromises = admins.map((admin) => 
        sendAutoNotification(
          req.app,
          admin._id,
          `🗑️ Deletion Alert: The account for ${user.name} (@${user.username}) was permanently deleted.`,
          "manage-users", // Drops them in the user grid
          user.username // Audit: Who was deleted?
        )
      );
      
      await Promise.all(notifyPromises);
    } catch (notifyErr) {
      console.error("❌ Failed to notify admins of deletion:", notifyErr);
    }

    return res.status(200).json({ message: "User and all associated data deleted successfully." });
  } catch (error) {
    console.error("Deletion Error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});
// ==========================================
// BIG BRO: GENERATE ADMIN OTP
// ==========================================
app.post("/generate-otp-bro", async (req, res) => {
  try {
    const { username, isAdmin } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // Generate OTP
    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // 🚨 THE FIX: Save to DB! 
    // Since this goes to the Master Admin, we save it under the Admin's email
    await OTP.deleteMany({ email: process.env.EMAIL });
    await OTP.create({ email: process.env.EMAIL, otp: generatedOtp });

    // Define the specific action for the email
    const actionText = !isAdmin
      ? `Granting Admin privileges to ${user.name} (@${user.username})`
      : `Revoking Admin privileges from ${user.name} (@${user.username})`;

    const mailOptions = {
      from: process.env.EMAIL,
      to: process.env.EMAIL, // Sending to yourself/admin email
      subject: "🚨 ACTION REQUIRED: Admin Privilege Toggle Request",
      html: adminOtpTemplate(generatedOtp, actionText, user.name),
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).send({ message: "Failed to send OTP" });
      } else {
        res.status(200).send({ message: "OTP sent successfully" });
      }
    });
  } catch (error) {
    console.error("Error in OTP generation:", error);
    res.status(500).send({ message: "Server error" });
  }
});

// ==========================================
// BIG BRO: VERIFY & TOGGLE ADMIN (Added 'authenticate' middleware!)
// ==========================================
app.post("/verify-bigbro", authenticate, async (req, res) => {
  try {
    const { otp, username } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    // 🚨 THE FIX: Look up the Master Admin OTP in the database
    const record = await OTP.findOne({ email: process.env.EMAIL });

    if (!record) {
      return res.status(401).send({ message: "OTP expired or not found. Please request a new one." });
    }

    // Check if OTP matches
    if (record.otp === otp.toString()) {
      
      // 🚨 Clear the OTP from DB so it can't be reused!
      await OTP.deleteMany({ email: process.env.EMAIL });

      // 1. Toggle the Admin Status
      user.isAdmin = !user.isAdmin;
      await user.save();

      // 2. 🚨 DYNAMIC MESSAGING
      const isNowAdmin = user.isAdmin;
      
      const appMessage = isNowAdmin 
        ? "🛡️ God Mode Activated: You are now an Administrator." 
        : "🛡️ Admin rights relinquished. You are back to standard access.";
        
      const emailSubject = isNowAdmin 
        ? "Security Alert: Admin Privileges Granted - CuTe Learning" 
        : "Security Alert: Admin Privileges Revoked - CuTe Learning";
        
      const emailBody = isNowAdmin
        ? `Hi ${user.name || user.username},\n\nGod Mode has been activated on your account. You now have full Administrator privileges on Curious Team Learning.\n\nIf you did not authorize this action, please lock down your account immediately.\n\nWith great power comes great responsibility!`
        : `Hi ${user.name || user.username},\n\nYour Administrator privileges on Curious Team Learning have been deactivated. You are now browsing as a standard user.`;

      // 3. 🚨 IN-APP NOTIFICATION
      // (Added safe fallback `req.user?.username || "System"` just in case)
      await sendAutoNotification(
        req.app,
        user._id, 
        appMessage, 
        "settings", 
        req.user?.username || "System" 
      );

      // 4. 🚨 EMAIL NOTIFICATION
      const mailOptions = {
        from: process.env.EMAIL,
        to: user.email,
        subject: emailSubject,
        text: emailBody,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error("Failed to send Big Bro security email:", error);
      });

      res.status(200).send({ message: "SUCCESS", isAdmin: user.isAdmin });
    } else {
      res.status(401).send({ message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error in verification:", error);
    res.status(500).send({ message: "Server error" });
  }
});

app.put("/update-report/:username", authenticate, async (req, res) => {
  try {
    console.log("--- STARTING UPDATE REPORT ---");
    console.log("Target Username:", req.params.username);
    console.log("Admin Triggering:", req.user.username);

    // 1. Update the student
    const student = await User.findOneAndUpdate(
      { username: req.params.username },
      {
        $push: {
          tasks: {
            week: req.body.week,
            question: req.body.question,
            answer: req.body.answer,
            link: req.body.link,
          },
        },
      },
      { new: true } 
    );

    if (!student) {
      console.log("❌ Update failed: Student not found in DB");
      return res.status(404).json({ error: "Student not found." });
    }

    console.log("✅ DB Updated. Sending notification to ID:", student._id);

    // 2. Trigger Notification
    // Ensure req.app is definitely passed first
    await sendAutoNotification(
      req.app,
      student._id, 
      `📝 Congratulations! A new planet ${req.body.week} has been added to your report.`, 
      "report",
      req.user.username 
    );

    console.log("🚀 Notification Helper Completed");

    res.status(200).json({ message: "Task assigned successfully." });
  } catch (error) {
    console.error("🚨 ROUTE CRASHED:", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/get-user-details", authenticate, (req, res) => {
  // req.user was already populated by your middleware!
  res.status(200).json({
    name: req.user.name,
    email: req.user.email,
    photo: req.user.photo,
    role: req.user.role,
    isAdmin: req.user.isAdmin
  });
});

app.put("/update-profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updates = req.body;

    // We can now update everything naturally because it's just one Schema!
    for (const key in updates) {
      if (key !== '_id' && key !== 'email' && key !== 'isAdmin' && key !== 'username') {
        user[key] = updates[key];
      }
    }

    const updatedUser = await user.save();

    res.status(200).json({ message: "Profile updated successfully!", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Add 'authenticate' middleware here!
app.get("/get-tasks", authenticate, async (req, res) => {
  try {
    // Because of 'authenticate', req.user is already the fully loaded student document!
    const user = req.user;

    // Send the tasks array directly back to React
    // (Assuming 'tasks' is the array field in your database)
    res.status(200).json(user.tasks || []);
    
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to load tasks" });
  }
});

const cleanupOldNotifications = () => {
  const oneDay = 24 * 60 * 60 * 1000;
  const now = Date.now().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

  for (const username in notifications) {
    notifications[username] = notifications[username].filter((notification) => {
      const notificationDate = new Date(notification.date).getTime();
      return now - notificationDate < oneDay;
    });

    if (notifications[username].length === 0) {
      delete notifications[username];
    }
  }
};

setInterval(cleanupOldNotifications, 60 * 60 * 1000);

// Import your middleware if you haven't already at the top
// const authenticate = require("./middleware/authenticate");

app.get("/get-user-profile", authenticate, async (req, res) => {
  try {
    // req.user is the full document fetched by your authenticate middleware.
    // Because of discriminators, if they are a Student, this already contains 
    // fatherName, subjects, address, etc.
    
    // We send the entire user object back to React!
    res.status(200).json(req.user);
    
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Fetch all students for the Admin Dashboard
app.get("/all-students", authenticate, async (req, res) => {
  try {
    // We only want users whose role is exactly "Student"
    const students = await User.find({ role: "Student" })
      .select("-password") // Don't send passwords to the frontend!
      .lean(); // Makes the query faster and returns plain objects

    res.status(200).json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: "Failed to fetch students from the database." });
  }
});

// Get a specific user's report history (Tasks)
app.get("/user-report/:username", authenticate, async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Find the user by their unique username
    // Using .lean() because we just need to read the data, making it faster
    const targetUser = await User.findOne({ username }).lean();

    // 2. If they don't exist, send a 404
    if (!targetUser) {
      return res.status(404).json({ error: "Student not found in the database." });
    }

    // 3. Send back their tasks array. 
    // If they have no tasks yet, send an empty array so the frontend doesn't crash.
    const userTasks = targetUser.tasks || [];

    res.status(200).json({ 
      message: "Report history fetched successfully",
      tasks: userTasks 
    });

  } catch (error) {
    console.error("Error fetching user report:", error);
    res.status(500).json({ error: "Internal server error while fetching report." });
  }
});

// DELETE and Re-index route
app.delete("/delete-report-task/:username/:weekNumber", authenticate, async (req, res) => {
  try {
    const { username, weekNumber } = req.params;
    const deletedWeek = parseInt(weekNumber);

    // 1. Find the user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. THE DELETE FIX: Use parseInt() so "3" === 3 becomes TRUE!
    const taskToDelete = user.tasks.find(t => parseInt(t.week) === deletedWeek);
    if (taskToDelete) {
      user.tasks.pull(taskToDelete._id); 
    }

    // 3. THE RE-INDEX FIX: Safely parse to number before doing math
    user.tasks.forEach(task => {
      const currentWeek = parseInt(task.week);
      if (currentWeek > deletedWeek) {
        task.week = currentWeek - 1; 
      }
    });

    // 4. Lock in the changes
    user.markModified('tasks');
    await user.save();

    // 5. 🚨 THE AUTO-TRIGGER!
    // Let the student know their path was modified
    await sendAutoNotification(
      req.app,
      user._id, 
      `🔄 Your report path was updated (Planet ${deletedWeek} removed).`, 
      "report" ,
      req.user.username // Indicates who made the change
    );

    res.status(200).json({ message: "Task deleted and path re-indexed successfully." });
  } catch (error) {
    console.error("Error deleting and re-indexing:", error);
    res.status(500).json({ error: "Failed to delete and re-index tasks." });
  }
});

// EDIT route (Standard update)
app.put("/edit-report-task/:username/:taskId", authenticate, async (req, res) => {
  try {
    const { username, taskId } = req.params;
    const { question, answer, link } = req.body;

    // 1. Find the user first so we have their secure _id for the notification
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // 2. Update the task
    await User.updateOne(
      { _id: user._id, "tasks._id": taskId },
      { $set: { "tasks.$.question": question, "tasks.$.answer": answer, "tasks.$.link": link } }
    );

    // 3. 🚨 THE AUTO-TRIGGER!
    await sendAutoNotification(
      req.app,
      user._id, 
      `✏️ A task in your Planetary Path has been updated.`, 
      "report", // Teleports them to the report panel!
      req.user.username // Indicates who updated the task
    );

    res.status(200).json({ message: "Task updated successfully." });
  } catch (error) {
    console.error("Error editing task:", error);
    res.status(500).json({ error: "Failed to edit task." });
  }
});

// Check Username Availability
app.post("/check-username", async (req, res) => {
  try {
    const { username } = req.body;
    
    // Case-insensitive search for exact match
    const existingUser = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, "i") } 
    });

    if (existingUser) {
      return res.status(200).json({ available: false });
    }
    
    res.status(200).json({ available: true });
  } catch (error) {
    console.error("Error checking username:", error);
    res.status(500).json({ error: "Server error checking username" });
  }
});

// ASSIGN STUDENT TO TEACHER (Used by both Admin and Teachers)
app.put("/assign-teacher", authenticate, async (req, res) => {
  try {
    const { studentUsername, teacherUsername } = req.body;

    // 1. Find the student
    const student = await User.findOne({ username: studentUsername });
    
    if (!student) {
      return res.status(404).json({ error: "Student not found. Check the username." });
    }

    if (student.role !== "Student" && student.role !== "student" && student.Role !== "Student" && student.Role !== "student") {
        return res.status(400).json({ error: "This user is not a student." });
    }

    // 2. Assign the teacher and save
    student.assignedTeacher = teacherUsername;
    await student.save();

    // 3. 🚨 AUTO-TRIGGER #1: Notify the Student
    await sendAutoNotification(
      req.app,
      student._id, 
      `👨‍🏫 You have been assigned a new mentor: ${teacherUsername}.`, 
      `profile/${teacherUsername}` // Teleports student to their profile to see their new status
    );

    // 4. 🚨 AUTO-TRIGGER #2: Notify the Teacher!
    // We just need to quickly look up the teacher's _id using their username
    const teacher = await User.findOne({ username: teacherUsername });
    if (teacher) {
      await sendAutoNotification(
        req.app,
        teacher._id, 
        `🎓 A new student (${student.name || studentUsername}) has been assigned to you!`, 
        "management", // Teleports the teacher straight to their roster!
        req.user.username // Indicates that the Admin triggered this change
      );
    }

    res.status(200).json({ 
        message: `Successfully assigned ${student.name} to Teacher: ${teacherUsername}`,
        student: student 
    });

  } catch (error) {
    console.error("Error assigning teacher:", error);
    res.status(500).json({ error: "Failed to assign student." });
  }
});

// UNASSIGN STUDENT FROM TEACHER
app.put("/unassign-student", authenticate, async (req, res) => {
  try {
    const { studentUsername } = req.body;

    // 1. Find the student by username
    const student = await User.findOne({ username: studentUsername });
    
    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }

    // 🚨 Store the teacher's username BEFORE we erase it so we can ping them!
    const oldTeacherUsername = student.assignedTeacher;

    // 2. Clear the assignedTeacher field
    student.assignedTeacher = ""; 
    await student.save();

    // 3. 🚨 AUTO-TRIGGER #1: Notify the Student
    await sendAutoNotification(
      req.app,
      student._id, 
      `ℹ️ You have been unassigned from your current mentor.`, 
      `profile/${oldTeacherUsername}` // Drops them at their profile
    );

    // 4. 🚨 AUTO-TRIGGER #2: Notify the old Teacher (if they existed)
    if (oldTeacherUsername) {
      const teacher = await User.findOne({ username: oldTeacherUsername });
      if (teacher) {
        await sendAutoNotification(
          req.app,
          teacher._id, 
          `ℹ️ A student (${student.name || studentUsername}) has been removed from your roster.`, 
          "management", // Drops the teacher at their management roster
          req.user.username // Indicates that the Admin triggered this change
        );
      }
    }

    res.status(200).json({ 
      message: `Successfully unassigned ${student.name} from their teacher.`,
      student: student 
    });

  } catch (error) {
    console.error("Error unassigning student:", error);
    res.status(500).json({ error: "Internal server error while unassigning student." });
  }
});

// GET TEACHER'S SPECIFIC ROSTER
app.get("/my-students/:teacherUsername", authenticate, async (req, res) => {
  try {
    const { teacherUsername } = req.params;

    // Only find students who have this teacher's username in their assignedTeacher field
    const myStudents = await User.find({ 
        $or: [{ role: "Student" }, { role: "student" }, { Role: "Student" }, { Role: "student" }],
        assignedTeacher: teacherUsername 
    });

    res.status(200).json(myStudents);
  } catch (error) {
    console.error("Error fetching roster:", error);
    res.status(500).json({ error: "Failed to fetch your students." });
  }
});

// 🚨 GOD MODE: Direct Inline Edit
app.put("/admin/god-mode-edit/:id", authenticate, async (req, res) => {
  try {
    // 1. Hard Security Check
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Access Denied. You are not a God here." });
    }

    const userId = req.params.id;
    const updates = req.body;

    // 2. Data Protection: Prevent manual editing of sensitive/internal fields
    const protectedFields = ["_id", "__v", "password"];
    protectedFields.forEach((field) => delete updates[field]);

    // 3. Perform the Update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates }, 
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User no longer exists in database." });
    }

    console.log(`[GOD MODE] Admin ${req.user.username} updated user ${updatedUser.username}`);

    // 4. 🚨 THE SMART AUTO-TRIGGER!
    // Get a list of the fields that were actually changed (e.g., ["Role", "Name"])
    const changedFields = Object.keys(updates);
    
    if (changedFields.length > 0) {
      // Turn the array into a nice comma-separated string for the message
      const fieldsString = changedFields.join(", ");
      
      // Decide where to teleport them based on what was changed
      let targetLink = "profile"; // Default to profile for Name, Phone, etc.
      
      if (
        changedFields.includes("Role") || 
        changedFields.includes("role") || 
        changedFields.includes("isAdmin") || 
        changedFields.includes("isVerifiedStaff")
      ) {
        targetLink = "settings"; // Override to settings if it's a structural account change
      }

      // Send the dynamic notification!
      await sendAutoNotification(
        req.app,
        updatedUser._id, 
        `⚙️ An admin has updated your: ${fieldsString}.`, 
        targetLink,
        req.user.username
      );
    }

    res.status(200).json({ 
      message: "Database updated successfully!", 
      user: updatedUser 
    });

  } catch (error) {
    console.error("God Mode Error:", error);
    res.status(500).json({ error: "Database rejected the change. Check your data types." });
  }
});

// Example: Your existing Admin Assignment Route
app.post("/admin/assign-student", authenticate, async (req, res) => {
  const { teacherUsername, studentUsername } = req.body;

  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Access denied" });

    // 1. Update the Student in the Database
    const student = await User.findOneAndUpdate(
      { username: studentUsername },
      { assignedTeacher: teacherUsername },
      { new: true }
    );

    if (!student) return res.status(404).json({ error: "Student not found" });

    // 2. 🚨 AUTO-TRIGGER: Notify the Student
    // (Notice we use student._id here!)
    await sendAutoNotification(
      req.app,
      student._id,                   
      `👨‍🏫 The Admin has assigned you a new mentor: @${teacherUsername}.`, 
      "profile", // Teleports student to their profile
      req.user.username // Indicates that the Admin triggered this change

    );

    // 3. 🚨 AUTO-TRIGGER: Notify the Teacher
    // We need to look up the teacher's _id using the username from req.body
    const teacher = await User.findOne({ username: teacherUsername });
    if (teacher) {
      await sendAutoNotification(
        teacher._id,                   
        `🎓 The Admin has added a new student (@${studentUsername}) to your roster!`, 
        "management" // Teleports teacher to the management panel
      );
    }

    res.status(200).json({ message: `Successfully assigned ${studentUsername} to ${teacherUsername}` });
  } catch (error) {
    res.status(500).json({ error: "Assignment failed" });
  }
});
app.put("/admin/unassign-student/:username", authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Unauthorized" });

    // 1. Find the student FIRST to get the old teacher's name
    const studentToUpdate = await User.findOne({ username: req.params.username });
    if (!studentToUpdate) return res.status(404).json({ error: "Student not found." });

    const oldTeacherUsername = studentToUpdate.assignedTeacher;

    // 2. Update the student (Reset to empty string)
    const student = await User.findOneAndUpdate(
      { username: req.params.username },
      { assignedTeacher: "" }, 
      { new: true }
    );

    // 3. 🚨 AUTO-TRIGGER: Notify Student
    await sendAutoNotification(
      req.app,
      student._id,
      `ℹ️ The Admin has unassigned your current mentor.`,
      "profile",
      req.user.username // Indicates that the Admin triggered this change
    );

    // 4. 🚨 AUTO-TRIGGER: Notify Old Teacher
    if (oldTeacherUsername) {
      const teacher = await User.findOne({ username: oldTeacherUsername });
      if (teacher) {
        await sendAutoNotification(
          req.app,
          teacher._id,
          `ℹ️ The Admin has removed student @${student.username} from your roster.`,
          "management",
          req.user.username // Indicates that the Admin triggered this change
        );
      }
    }

    res.status(200).json({ message: `Unassigned ${student.name || student.username} successfully.` });
  } catch (error) {
    res.status(500).json({ error: "Failed to unassign student." });
  }
});

app.post("/admin/request-staff-approval", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Route the request based on their role
    if (user.role === "Parent") {
      user.parentVerificationRequested = true;
      await user.save();
      return res.status(200).json({ 
        message: "Verification request sent to Admin successfully!",
        type: "parent" 
      });
    } else if (user.role === "Teacher") {
      user.staffApprovalRequested = true;
      await user.save();
      return res.status(200).json({ 
        message: "Staff approval request sent successfully!",
        type: "teacher" 
      });
    } else {
      return res.status(403).json({ error: "Your role does not require verification." });
    }
  } catch (error) {
    console.error("Error requesting approval:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET PENDING TEACHERS
app.get("/admin/pending-teachers", authenticate, async (req, res) => {
  try {
    // 1. Security Check: Ensure the person asking is actually an Admin
    const adminUser = await User.findById(req.userId || req.user._id);
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    // 2. Fetch all teachers who have the requested flag set to true
    const pendingTeachers = await User.find({
      role: "Teacher",
      staffApprovalRequested: true
    }).select("name username email photo role staffApprovalRequested isVerifiedStaff"); // Send only necessary info

    res.status(200).json(pendingTeachers);
  } catch (error) {
    console.error("Error fetching pending teachers:", error);
    res.status(500).json({ error: "Failed to fetch pending teachers" });
  }
});

// GET PENDING PARENTS
app.get("/admin/pending-parents", authenticate, async (req, res) => {
  try {
    // 1. Security Check
    const adminUser = await User.findById(req.userId || req.user._id);
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    // 2. Fetch all parents who have the requested flag set to true
    const pendingParents = await User.find({
      role: "Parent",
      parentVerificationRequested: true
    }).select("name username email photo role parentVerificationRequested isVerifiedParent");

    res.status(200).json(pendingParents);
  } catch (error) {
    console.error("Error fetching pending parents:", error);
    res.status(500).json({ error: "Failed to fetch pending parents" });
  }
});

// 1. GET DEFAULT VIEW: Fetch all Admins
app.get("/expert-connect/admins", authenticate, async (req, res) => {
  try {
    const admins = await User.find({ isAdmin: true })
      .select("name username photo role specialty bio"); // Only send public info
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admins." });
  }
});

// 3. SEND HANDSHAKE: The Core Logic
app.post("/expert-connect/request", authenticate, async (req, res) => {
  try {
    const { receiverId, message, meetingDate } = req.body;

    if (!receiverId) return res.status(400).json({ error: "Missing receiver ID." });

    const sender = await User.findById(req.userId || req.user._id);
    if (!sender) return res.status(404).json({ error: "Sender not found." });

    // 1. Security Check: ONLY Verified Parents can initiate!
    if (sender.role !== "Parent" || !sender.isVerifiedParent) {
      return res.status(403).json({ error: "Only Verified Parents can send requests." });
    }

    if (sender._id.toString() === receiverId.toString()) {
      return res.status(400).json({ error: "You cannot send a connection request to yourself." });
    }

    // 2. The 3-User Limit Check (Total limit)
    const activeRequestsCount = await ConnectionRequest.countDocuments({
      sender: sender._id,
      status: { $in: ["pending", "accepted"] }
    });

    if (activeRequestsCount >= 3) {
      return res.status(403).json({ error: "Limit Reached: You can only connect with up to 3 people at a time." });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ error: "Receiver not found." });

    // 3. 🚨 THE DUPLICATE & RESURRECTION CHECK
    const existingRequest = await ConnectionRequest.findOne({
      sender: sender._id,
      receiver: receiverId
    });

    if (existingRequest) {
      // Block if they are already actively connected or pending
      if (existingRequest.status === "pending" || existingRequest.status === "accepted") {
        return res.status(409).json({ error: "You already have a pending or active connection with this user." });
      }

      // Check 7-day cooldown if rejected
      if (existingRequest.status === "rejected") {
        const cooldownPeriod = 7 * 24 * 60 * 60 * 1000;
        const timeSinceRejection = new Date().getTime() - new Date(existingRequest.updatedAt).getTime();

        if (timeSinceRejection < cooldownPeriod) {
          const daysLeft = Math.ceil((cooldownPeriod - timeSinceRejection) / (1000 * 60 * 60 * 24));
          return res.status(403).json({ error: `This user recently declined your request. Please wait ${daysLeft} more day(s) before trying again.` });
        }
      }

      // 🚨 RESURRECTION MAGIC: If disconnected (or if the 7-day rejected cooldown passed), bring it back to life!
      existingRequest.status = "pending";
      existingRequest.message = message; // Update their intro message
      existingRequest.meetingDate = meetingDate; // Update the new date
      
      // Add a nice system message to their saved chat history!
      existingRequest.messages.push({
        sender: sender._id,
        text: "🔄 A new connection request was sent."
      });

      await existingRequest.save();

      // Fire Notification
      await sendAutoNotification(
        req.app, receiver._id,
        `🤝 Connection Request: ${sender.name || sender.username} wants to reconnect!`,
        "management", sender.username
      );

      return res.status(200).json({ message: "Request sent successfully! (Reconnected)" });
    }

    // 4. Create a BRAND NEW Handshake (Only runs if they have NEVER connected before)
    const newRequest = new ConnectionRequest({
      sender: sender._id,
      receiver: receiver._id,
      message,
      meetingDate,
      status: "pending"
    });
    
    await newRequest.save();

    const io = req.app.get("io");
    if (io && receiver.username) {
      // Tell the specific expert to refresh their drawer instantly
      io.to(receiver.username).emit("new-connection-request"); 
    }

    await sendAutoNotification(
      req.app, receiver._id,
      `🤝 Connection Request: ${sender.name || sender.username} sent you a message!`,
      "management", sender.username
    );

    res.status(201).json({ message: "Request sent successfully!" });

  } catch (error) {
    console.error("Request Error:", error);
    res.status(500).json({ error: "Failed to send request." });
  }
});

// ==========================================
// CONNECTION INBOX ROUTES
// ==========================================

// 1. GET PENDING INBOX REQUESTS
app.get("/inbox/requests", authenticate, async (req, res) => {
  try {
    // Find all pending requests where the logged-in user is the receiver
    const requests = await ConnectionRequest.find({ 
      receiver: req.userId || req.user._id,
      status: "pending"
    })
    .populate("sender", "name username photo role") // Pull in the sender's profile info!
    .sort({ createdAt: -1 }); // Newest first
    
    res.status(200).json(requests);
  } catch (error) {
    console.error("🚨 INBOX FETCH ERROR:", error);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

// 2. RESPOND TO REQUEST (Accept/Decline)
app.put("/inbox/respond/:id", authenticate, async (req, res) => {
  try {
    const { status } = req.body; // Expects "accepted" or "declined"

    if (!["accepted", "rejected", "declined"].includes(status)) {
      return res.status(400).json({ error: "Invalid status update." });
    }
    const finalStatus = status === "declined" ? "rejected" : status;

    const request = await ConnectionRequest.findById(req.params.id).populate("sender");
    
    if (!request) return res.status(404).json({ error: "Request not found" });
    
    // Security Check: Only the actual receiver can respond to this!
    if (request.receiver.toString() !== (req.userId || req.user._id).toString()) {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    request.status = status;
    await request.save();

    if (status === "accepted") {
      const io = req.app.get("io"); // Grab the Socket.io instance we attached earlier
      // Send a secret signal ONLY to the Parent who sent the request
      io.to(request.sender.username).emit("force-refresh-circle");
    }

    // Notify the Parent who sent it!
    const receiver = await User.findById(req.userId || req.user._id);
    const message = status === "accepted" 
      ? `✅ ${receiver.name} accepted your connection request! Check your messages.` 
      : `ℹ️ ${receiver.name} politely declined your connection request at this time.`;

    await sendAutoNotification(
      req.app,
      request.sender._id,
      message,
      "expert-connect", // Send the parent back to the community hub
      receiver.username
    );

    res.status(200).json({ message: `Request successfully ${status}!` });
  } catch (error) {
    res.status(500).json({ error: "Failed to update request" });
  }
});

// GET /expert-connect/my-circle
app.get("/expert-connect/my-circle", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId || req.user._id);

    // Find handshakes where the user is either sender or receiver and status is 'accepted'
    let query = ConnectionRequest.find({
      $or: [{ sender: user._id }, { receiver: user._id }],
      status: "accepted"
    })
    .populate("sender", "name username photo role specialty bio")
    .populate("receiver", "name username photo role specialty bio")
    .sort({ updatedAt: -1 }); // Put most recently active connections at the top

    // 🚨 Only enforce the 3-expert limit if the user is a Parent!
    if (user.role === "Parent") {
      query = query.limit(3);
    }

    const connections = await query;

    const circle = connections.map(conn => {
      // We also inject the connection ID so we can use it later for messages/disconnecting!
      const otherPerson = conn.sender._id.toString() === user._id.toString() ? conn.receiver.toObject() : conn.sender.toObject();
      
      otherPerson.connectionId = conn._id; 
      
      // NEW: INJECT THE MISSING MEETING DATA HERE!
      otherPerson.meetingDate = conn.meetingDate;
      otherPerson.meetingLink = conn.meetingLink;

      return otherPerson;
    });

    res.status(200).json(circle);
  } catch (error) {
    console.error("Circle fetch error:", error);
    res.status(500).json({ error: "Failed to fetch your circle." });
  }
});

// ==========================================
// DISCONNECT RELATIONSHIP
// ==========================================
// ==========================================
// DISCONNECT RELATIONSHIP (Soft Delete)
// ==========================================
app.delete("/expert-connect/disconnect/:id", authenticate, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const connection = await ConnectionRequest.findById(req.params.id);
    
    if (!connection) return res.status(404).json({ error: "Connection not found" });

    // Security check: Only the sender or receiver can disconnect this!
    if (connection.sender.toString() !== userId.toString() && connection.receiver.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Unauthorized to disconnect this relationship." });
    }

    // 🚨 THE FIX: Change status instead of deleting the document!
    connection.status = "disconnected";
    
    // 💡 BONUS UX: Drop an automated message into the chat history
    connection.messages.push({
      sender: userId, // The person who clicked disconnect
      text: "🚫 This connection has been closed. You can no longer send messages to each other."
    });

    // Clear any upcoming meetings just to be safe
    connection.meetingDate = null;
    connection.meetingLink = "";

    await connection.save();

    res.status(200).json({ message: "Disconnected successfully. Chat history archived." });
  } catch (error) {
    console.error("Disconnect Error:", error);
    res.status(500).json({ error: "Failed to disconnect." });
  }
});

// ==========================================
// PORTAL MESSAGING ROUTES
// ==========================================

// 1. GET CHAT HISTORY
app.get("/expert-connect/messages/:connectionId", authenticate, async (req, res) => {
  try {
    const connection = await ConnectionRequest.findById(req.params.connectionId)
      .populate("messages.sender", "name photo"); // Get sender details for each message

    if (!connection) return res.status(404).json({ error: "Connection not found" });

    // Ensure the user asking is actually part of this connection!
    const userId = (req.userId || req.user._id).toString();
    if (connection.sender.toString() !== userId && connection.receiver.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.status(200).json(connection.messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to load messages." });
  }
});

// 2. SEND A MESSAGE
app.post("/expert-connect/message/:connectionId", authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.userId || req.user._id;

    // 1. Prevent empty ghost messages
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    // Prevent massive essay spam
    if (text.length > 500) {
      return res.status(400).json({ error: "Message is too long. Please keep it under 500 characters." });
    }

    const connection = await ConnectionRequest.findById(req.params.connectionId);
    if (!connection) return res.status(404).json({ error: "Connection not found" });

    // 2. 🚨 SECURITY: Ensure the user is actually part of this private chat!
    const isSender = connection.sender.toString() === userId.toString();
    const isReceiver = connection.receiver.toString() === userId.toString();
    
    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: "Unauthorized. You are not part of this chat." });
    }

    // 3. Ensure they are officially connected before chatting
    if (connection.status !== "accepted") {
      return res.status(403).json({ error: "You can only send messages in accepted connections." });
    }

    // Add the message to the array
    const newMessage = { sender: userId, text: text.trim() }; // .trim() cleans up extra spaces
    connection.messages.push(newMessage);
    await connection.save();

    // Figure out who the "other" person is to notify them
    const receiverId = isSender ? connection.receiver : connection.sender;
    const senderData = await User.findById(userId);

    // Fire the Notification!
    await sendAutoNotification(
      req.app,
      receiverId,
      `💬 New message from ${senderData.name}: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
      "portal:" + req.params.connectionId, 
      senderData.username
    );

    // Send back the newly created message
    const savedMessage = connection.messages[connection.messages.length - 1];
    res.status(201).json(savedMessage);
    
  } catch (error) {
    console.error("Message Error:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// ==========================================
// SCHEDULE MEETING (WITH GOOGLE CALENDAR & MEET INTEGRATION)
// ==========================================
app.put("/expert-connect/schedule/:connectionId", authenticate, async (req, res) => {
  try {
    const { meetingDate } = req.body; // Only date comes from the frontend now

    if (meetingDate) {
      const parsedDate = new Date(meetingDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "Invalid meeting date format." });
      }
      if (parsedDate < new Date()) {
        return res.status(400).json({ error: "Meeting date must be in the future." });
      }
    }

    const userId = req.userId || req.user._id;

    // 1. Fetch the connection and populate both users to get their emails for Google
    const connection = await ConnectionRequest.findById(req.params.connectionId)
      .populate("sender", "username email name")
      .populate("receiver", "username email name");

    if (!connection) return res.status(404).json({ error: "Connection not found" });

    if (connection.status !== "accepted") {
      return res.status(403).json({ error: "You can only schedule meetings for accepted connections." });
    }

    // Figure out who is scheduling (me) and who is the guest
    const isSender = connection.sender._id.toString() === userId.toString();
    const me = isSender ? connection.sender : connection.receiver;
    const guest = isSender ? connection.receiver : connection.sender;

    const eventDate = new Date(meetingDate);
    const eventEndDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    if (!me.email || !guest.email) {
      return res.status(400).json({ error: "Both users must have a registered email address to schedule a Google Meet." });
    }

    // 2. Authenticate with Google (Using your exact Service Account logic)
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: 'admin@curiousteamlearning.com'
    });
    const calendar = google.calendar({ version: 'v3', auth });

    // 3. Create the Event in Google Calendar WITH a Meet Link
    const googleEventReq = {
      summary: `[CONSULT] ${me.name} & ${guest.name}`,
      description: `Expert Connect Consultation scheduled via Platform.`,
      start: { dateTime: eventDate.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: eventEndDate.toISOString(), timeZone: 'Asia/Kolkata' },
      attendees: [{ email: me.email }, { email: guest.email }],
      conferenceData: {
        createRequest: {
          requestId: Math.random().toString(36).substring(7),
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    };

    const googleRes = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: googleEventReq,
      sendUpdates: 'all', // This will email the guest an invite automatically!
      conferenceDataVersion: 1 
    });

    const generatedMeetLink = googleRes.data.hangoutLink;

    // 4. Save to your Platform's Global Calendar (Event Collection)
    // This ensures it shows up on their main dashboard calendar!
    const newEvent = new Event({
      title: `Consultation with ${guest.name}`, 
      date: eventDate, 
      type: "meeting", 
      color: "bg-brand-blue", // Assuming your calendar parses colors
      reminderMinutes: 10, 
      user: me._id,
      googleEventId: googleRes.data.id,
      meetLink: generatedMeetLink, 
      htmlLink: googleRes.data.htmlLink,
      guests: [guest.username]
    });
    await newEvent.save();

    // 5. Update the Chat Portal Contract
    connection.meetingDate = eventDate;
    connection.meetingLink = generatedMeetLink;

    // Drop an automated message into the chat so the user sees it instantly
    const automatedMessage = {
      sender: me._id,
      text: `📅 I have scheduled a Google Meet for ${eventDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`
    };
    connection.messages.push(automatedMessage);
    await connection.save();

    // 6. Send the Native Platform Notification
    await sendAutoNotification(
      req.app,
      guest._id,
      `📅 ${me.name} scheduled a Google Meet with you!`,
      "portal", // Assuming this triggers the portal to open
      me.username
    );

    res.status(200).json({ 
      message: "Meeting scheduled via Google Service Account!",
      meetingLink: generatedMeetLink,
      meetingDate: eventDate
    });

  } catch (error) {
    console.error("Failed to schedule meeting:", error);
    res.status(500).json({ error: "Failed to schedule meeting." });
  }
});

// ==========================================
// PROGRAM PLAN LEADS (Secured Sales Funnel)
// ==========================================

// 🛡️ ANTI-SPAM: In-memory Rate Limiter (No extra npm packages needed!)
const leadSpamCache = new Map();
const SPAM_LIMIT = 3; // Max requests
const SPAM_WINDOW = 15 * 60 * 1000; // 15 minutes

app.post("/get-plan-details", async (req, res) => {
  try {
    const { name, email, phone, whatsapp, is_whatsapp, plan_interest } = req.body;

    // 1. Basic Validation
    if (!name || !email || !phone || !plan_interest) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const spamKey = `${clientIp}_${cleanEmail}`;

    // 2. 🛡️ ANTI-SPAM CHECK
    const now = Date.now();
    const spamRecord = leadSpamCache.get(spamKey);

    if (spamRecord) {
      if (now - spamRecord.firstRequest < SPAM_WINDOW) {
        if (spamRecord.count >= SPAM_LIMIT) {
          return res.status(429).json({ error: "Too many requests. Please check your email or try again later." });
        }
        spamRecord.count += 1;
      } else {
        // Window expired, reset
        leadSpamCache.set(spamKey, { count: 1, firstRequest: now });
      }
    } else {
      leadSpamCache.set(spamKey, { count: 1, firstRequest: now });
    }

    // 3. 🛡️ DE-DUPLICATION CHECK
    // Did they already ask for THIS SPECIFIC plan?
    let lead = await PlanLead.findOne({ email: cleanEmail, plan_interest: plan_interest });
    const existingUser = await User.findOne({ email: cleanEmail });

    let customTrackingUrl = "";

    if (lead) {
      // ✅ They already asked for this! Just reuse their existing link.
      customTrackingUrl = lead.trackingUrl;
      console.log(`[Lead] Re-sending existing brochure to ${cleanEmail}`);
    } else {
      // ✅ Brand new request! Create it.
      lead = new PlanLead({
        name,
        email: cleanEmail,
        phone,
        whatsapp: whatsapp || phone,
        is_whatsapp,
        plan_interest,
        userId: existingUser ? existingUser._id : null
      });

      await lead.save();

      // Generate and save the Custom Secure Tracking URL
      const frontendBaseUrl = process.env.FRONTEND_URL || "https://app.curiousteamlearning.com";
      customTrackingUrl = `${frontendBaseUrl}/plan-details/${lead._id}`;
      
      lead.trackingUrl = customTrackingUrl;
      await lead.save();
    }


    // ----------------------------------------------------
    // COMMUNICATION BLOCK
    // ----------------------------------------------------

    // 4A. EMAIL TO THE USER
    const userMailOptions = {
      from: process.env.EMAIL,
      to: lead.email,
      subject: `Your Details for the ${plan_interest} - CuTe Learning`,
      html: userBrochureTemplate(name, plan_interest, customTrackingUrl)
    };
    transporter.sendMail(userMailOptions, (err) => { if (err) console.error("User Email Error:", err); });

    // 4B. EMAIL TO ADMIN
    const adminMailOptions = {
      from: process.env.EMAIL,
      to: process.env.EMAIL,
      subject: `🔥 ${lead.isNew ? 'NEW LEAD' : 'REPEAT REQUEST'}: ${plan_interest} (${name})`,
      html: adminBrochureTemplate(name, plan_interest, phone, lead.whatsapp, lead.email, !!existingUser, customTrackingUrl)
    };
    transporter.sendMail(adminMailOptions, (err) => { if (err) console.error("Admin Email Error:", err); });

    // 4C. IN-APP NOTIFICATIONS TO ADMINS
    try {
      const admins = await User.find({ isAdmin: true });
      const notifyPromises = admins.map(admin => 
        sendAutoNotification(
          req.app, 
          admin._id, 
          `🔥 Lead Alert: ${name} requested the ${plan_interest}!`, 
          "crm", 
          "Sales Bot"
        )
      );
      await Promise.all(notifyPromises);
    } catch (notifErr) {
      console.error("Admin App Notification Error:", notifErr);
    }

    // 4D. WHATSAPP MESSAGE
    try {
      const botNumberId = process.env.PHONE_NUMBER_ID || "1049944734868137"; 
      
      const waPayload = {
        messaging_product: "whatsapp",
        to: lead.whatsapp.replace(/\D/g, ""), // Strips out symbols
        type: "template",
        template: {
          name: "plan_details", // 🚨 Updated template name
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: name },          
                { type: "text", text: plan_interest }  
              ]
            },
            {
              type: "button",
              sub_type: "url",
              index: "0", 
              parameters: [
                { type: "text", text: lead._id.toString() } 
              ]
            }
          ]
        }
      };

      await axios.post(
        `https://graph.facebook.com/v19.0/${botNumberId}/messages`,
        waPayload,
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
      );
    } catch (waErr) {
      console.error("WhatsApp Send Error:", waErr.response?.data || waErr.message);
    }

    // 5. FINISH
    res.status(200).json({ success: true, message: "Details sent successfully!" });

  } catch (error) {
    console.error("Plan Lead Capture Error:", error);
    res.status(500).json({ error: "Failed to process your request. Please try again." });
  }
});

// 🧹 CRON JOB: Clean up the anti-spam memory cache every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (let [key, value] of leadSpamCache.entries()) {
    if (now - value.firstRequest > SPAM_WINDOW) {
      leadSpamCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});