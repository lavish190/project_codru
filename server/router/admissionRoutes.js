const express = require("express");
const router = express.Router();
const moment = require("moment-timezone");
const multer = require("multer");
const { Readable } = require("stream");
const { google } = require("googleapis");
const bcrypt = require("bcrypt");

// Import Mongoose Models
const User = require("../models/userSchema");
const Counselor = require("../models/counselorSchema"); 
const Booking = require("../models/bookingSchema");    
const Event = require("../models/eventSchema");       
const OTP = require("../models/otpSchema");           
const Admission = require("../models/Admission");
const Assessment = require("../models/Assessment"); 
const ConnectionRequest = require("../models/connectionRequestSchema");

const welcomeTemplate = require("../utils/welcomeTemplate"); // For consistent welcome emails
const transporter = require('../utils/transporter'); // Adjust the path if needed

// Import Middleware & Helpers
const authenticate = require("../middleware/authenticate"); 
const sendAutoNotification = require("../utils/notify"); 

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ==========================================
// 1. COUNSELOR: GET OWN SCHEDULE & BOOKINGS
// ==========================================
router.get("/api/counselor/schedule", authenticate, async (req, res) => {
  try {
    const counselor = await Counselor.findOne({ user: req.user._id });
    if (!counselor) return res.status(403).json({ error: "Not a counselor." });

    const upcomingBookings = await Booking.find({ 
      counselor: counselor.user, 
      date: { $gte: new Date(new Date().setHours(0,0,0,0)) },
      status: { $ne: "cancelled" }
    });

    const bookedSlotsMap = {};
    upcomingBookings.forEach(b => {
      const localMoment = moment(b.date).tz(counselor.timeZone || "Asia/Kolkata");
      const localDateStr = localMoment.format("YYYY-MM-DD");
      const localTimeStr = localMoment.format("HH:mm");

      if (!bookedSlotsMap[localDateStr]) bookedSlotsMap[localDateStr] = [];
      bookedSlotsMap[localDateStr].push(localTimeStr); 
    });

    const responseData = counselor.toObject();
    responseData.bookedSlots = bookedSlotsMap; 

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Schedule fetch error:", error);
    res.status(500).json({ error: "Failed to fetch schedule." });
  }
});
// ==========================================
// 2. PUBLIC: GET ALL AVAILABLE SLOTS (SMART FILTER)
// ==========================================
router.get("/api/available-slots", async (req, res) => {
  try {
    const activeCounselors = await Counselor.find({ isActive: true });
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const existingBookings = await Booking.find({
      date: { $gte: now,$lte: thirtyDaysFromNow },
      status: { $nin: ["cancelled", "missed"] }
    });

    const globalAvailableSlots = new Set();
    const nowUTC = moment.utc();

    for (let i = 0; i <= 30; i++) {
      activeCounselors.forEach(counselor => {
        const tz = counselor.timeZone || "Asia/Kolkata";
        const targetCounselorDate = moment().tz(tz).add(i, 'days');
        const localDateStr = targetCounselorDate.format("YYYY-MM-DD");
        const localDayOfWeek = targetCounselorDate.day();

        let availableTimeStrings = [];

        const override = counselor.dateOverrides?.find(o => o.date === localDateStr);
        if (override) {
          availableTimeStrings = override.slots; 
        } else {
          const baseDay = counselor.baseAvailability?.find(b => b.dayOfWeek === localDayOfWeek);
          if (baseDay) availableTimeStrings = baseDay.slots;
        }

        availableTimeStrings.forEach(timeStr => {
          const [hours, minutes] = timeStr.split(':');
          const localMoment = moment.tz(`${localDateStr} ${hours}:${minutes}`, "YYYY-MM-DD HH:mm", tz);
          
          if (localMoment.isAfter(nowUTC)) {
            const utcDate = localMoment.toDate();

            // 🚨 THE FIX: Check BOTH the Counselor ID and the underlying User ID to catch legacy database entries!
            const isBooked = existingBookings.some(booking => {
              const bookingCounselorId = booking.counselor.toString();
              return (
                bookingCounselorId === counselor.user.toString() || 
                bookingCounselorId === counselor._id.toString()
              ) && booking.date.getTime() === utcDate.getTime();
            });

            if (!isBooked) {
              globalAvailableSlots.add(utcDate.toISOString());
            }
          }
        });
      });
    }

    const sortedSlots = Array.from(globalAvailableSlots).sort();
    res.status(200).json(sortedSlots);

  } catch (error) {
    console.error("Error generating slots:", error);
    res.status(500).json({ error: "Failed to generate slots" });
  }
});

// ==========================================
// 3. START ADMISSION (GENERATE OTP)
// ==========================================
router.post("/api/start-admission", async (req, res) => {
  try {
    const { parentName, email, phone } = req.body;

    if (!email || !parentName || !phone) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: cleanEmail });

    const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await OTP.deleteMany({ email: cleanEmail });
    await OTP.create({ email: cleanEmail, otp: generatedOtp });

    if (req.transporter) {
      const mailOptions = {
        from: process.env.EMAIL,
        to: cleanEmail,
        subject: "Your Admission Verification Code - CuTe Learning",
        html: `<div style="font-family: Arial; padding: 20px;">
                 <h2>Welcome to CuTe Learning!</h2>
                 <p>Your verification code to schedule the discovery call is: <strong>${generatedOtp}</strong></p>
               </div>`,
      };
      req.transporter.sendMail(mailOptions, (error) => {
        if (error) console.error("Error sending Admission OTP:", error);
      });
    }

    res.status(200).json({ 
      success: true, 
      isExistingUser: !!existingUser 
    });

  } catch (error) {
    console.error("Admission Start Error:", error);
    res.status(500).json({ error: "Server error starting admission." });
  }
});

// ==========================================
// 4. CONFIRM DISCOVERY CALL (STAGE 1 BOOKING)
// ==========================================
router.post("/api/confirm-discovery-call", authenticate, async (req, res) => {
  try {
    const { date, description, title, parentName, phone, email, childAge, currentSchooling } = req.body; 
    const meetingDateUTC = new Date(date);
    const meetingEndDateUTC = new Date(meetingDateUTC.getTime() + 30 * 60 * 1000); 

    const activeCounselors = await Counselor.find({ isActive: true })
      .sort({ priority: 1 })
      .populate({ 
        path: "user", 
        model: User, 
        select: "name email username _id" 
      });
    
    let assignedCounselor = null;

    for (const counselor of activeCounselors) {
      if (!counselor.user) continue;
      const tz = counselor.timeZone || 'Asia/Kolkata';
      const localMoment = moment(meetingDateUTC).tz(tz);
      const localDateStr = localMoment.format("YYYY-MM-DD");
      const localTimeStr = localMoment.format("HH:mm");
      const dayOfWeek = localMoment.day();

      let isWorking = false;
      const override = counselor.dateOverrides?.find(o => o.date === localDateStr);
      
      if (override) {
        isWorking = override.slots.includes(localTimeStr);
      } else {
        const baseDay = counselor.baseAvailability?.find(b => b.dayOfWeek === dayOfWeek);
        if (baseDay) {
          isWorking = baseDay.slots.includes(localTimeStr);
        }
      }

      if (isWorking) {
        const existingBooking = await Booking.findOne({
          counselor: counselor.user._id,
          date: meetingDateUTC, 
          status: { $ne: "cancelled" }
        });

        if (!existingBooking) {
          assignedCounselor = counselor;
          break; 
        }
      }
    }

    if (!assignedCounselor) {
      return res.status(400).json({ error: "Sorry, this slot was just booked by someone else. Please select another time." });
    }

    // Google Calendar Integration
    let realMeetLink = "https://meet.google.com"; // Fallback
    let googleEventId = null;
    let googleHtmlLink = "";

    try {
      if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: 'admin@curiousteamlearning.com'
        });
        const calendar = google.calendar({ version: 'v3', auth });

        const googleEventReq = {
          summary: `[DISCOVERY CALL] ${parentName} & ${assignedCounselor.user.name}`,
          description: `**New Discovery Call Booked!**\n\n**Parent:** ${parentName}\n**Email:** ${email}\n**Phone:** ${phone}\n**Child's Age:** ${childAge}\n**Schooling:** ${currentSchooling}\n\n**Additional Notes:** ${description || 'None'}`,
          start: { dateTime: meetingDateUTC.toISOString(), timeZone: 'Asia/Kolkata' },
          end: { dateTime: meetingEndDateUTC.toISOString(), timeZone: 'Asia/Kolkata' },
          attendees: [
            { email: email },
            { email: assignedCounselor.user.email }
          ],
          conferenceData: {
            createRequest: {
              requestId: Math.random().toString(36).substring(7),
              conferenceSolutionKey: { type: "hangoutsMeet" }
            }
          }
        };

        const googleRes = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          resource: googleEventReq,
          sendUpdates: 'all', 
          conferenceDataVersion: 1 
        });

        realMeetLink = googleRes.data.hangoutLink || realMeetLink;
        googleEventId = googleRes.data.id;
        googleHtmlLink = googleRes.data.htmlLink;
      }
    } catch (gErr) {
      console.error("Google Calendar Insert Error (Continuing with local booking):", gErr);
    }

    // A. Save Booking Document (🚨 REMOVED lead data from here!)
    const newBooking = new Booking({
      parent: req.user._id, 
      counselor: assignedCounselor.user._id,
      date: meetingDateUTC,
      time: moment(meetingDateUTC).tz('Asia/Kolkata').format("HH:mm"), 
      title: title || `Discovery Call: ${parentName}`,
      description,
      meetLink: realMeetLink,
      status: "scheduled",
      type: "discovery_call" // 🚨 Explicitly flags this as a Discovery Call
    });
    await newBooking.save();

    // B. Sync Unified Admission Record (🚨 ADDED leadDetails here!)
    await Admission.findOneAndUpdate(
      { parent: req.user._id },
      {
        $set: {
          admissionStage: 1,
          assignedCounselor: assignedCounselor.user._id,
          "stage1_Discovery.booking": newBooking._id,
          "leadDetails.childAge": childAge,
          "leadDetails.currentSchooling": currentSchooling
        }
      },
      { upsert: true, new: true }
    );

    // C. Save Platform Calendar Event
    const newPlatformEvent = new Event({
      title: `Discovery Call: ${parentName}`, 
      date: meetingDateUTC, 
      type: "meeting", 
      color: "bg-brand-orange", 
      reminderMinutes: 10, 
      user: assignedCounselor.user._id, 
      googleEventId: googleEventId,
      meetLink: realMeetLink, 
      htmlLink: googleHtmlLink,
      guests: [req.user.username]
    });
    await newPlatformEvent.save();

    // D. In-App Notification
    if (req.app && req.app.get("io")) {
       await sendAutoNotification(
         req.app,
         assignedCounselor.user._id, 
         `📞 New Discovery Call! You have been matched with ${parentName}.`, 
         "schedule",
         "System"
       );
    }

    res.status(200).json({ message: "Booking confirmed", meetLink: realMeetLink });

  } catch (error) {
    console.error("Failed to assign counselor and create meet:", error);
    res.status(500).json({ error: "Internal server error during booking." });
  }
});

// ==========================================
// 5. GET COUNSELOR DISCOVERY CALLS (DESK VIEW)
// ==========================================
router.get("/api/counselor/discovery-calls", authenticate, async (req, res) => {
  try {
    const { date } = req.query; 
    
    const counselor = await Counselor.findOne({ user: req.user._id });
    const tz = counselor ? counselor.timeZone : 'Asia/Kolkata';

    const targetMoment = date ? moment.tz(date, "YYYY-MM-DD", tz) : moment().tz(tz);
    const startOfDay = targetMoment.clone().startOf('day').toDate();
    const endOfDay = targetMoment.clone().endOf('day').toDate();

    const query = {
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" } // 🚨 FIX: This strictly hides cancelled meetings!
    };
    
    if (!req.user.isAdmin) {
      query.counselor = req.user._id; 
    }

    const bookings = await Booking.find(query)
      .populate({ 
        path: "parent", 
        model: User, 
        select: "name email phone" 
      })
      .populate({
        path: "counselor",
        model: User, 
        select: "name username"
      })
      .sort({ date: 1 });

    const parentIds = bookings.map(b => b.parent?._id).filter(Boolean);
    const admissions = await Admission.find({ parent: { $in: parentIds } }).select("parent admissionStage");
    const stageMap = new Map(admissions.map(a => [a.parent.toString(), a.admissionStage]));

    const enrichedBookings = bookings.map(b => {
      const obj = b.toObject();
      if (obj.parent) {
        obj.parent.admissionStage = stageMap.get(obj.parent._id.toString()) || 1;
      }
      return obj;
    });
    
    res.status(200).json(enrichedBookings);
  } catch (error) {
    console.error("Error fetching counselor discovery calls:", error);
    res.status(500).json({ error: "Failed to load calls." });
  }
});

// ==========================================
// 6. UPDATE DISCOVERY CALL STATUS (COUNSELOR DESK)
// ==========================================
router.put("/api/counselor/update-discovery-status/:bookingId", authenticate, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { action, counselorNotes, callType } = req.body; 

    const booking = await Booking.findById(bookingId).populate({
      path: "parent",
      model: User
    });
    if (!booking) return res.status(404).json({ error: "Booking record not found." });

    if (booking.counselor.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (counselorNotes !== undefined) booking.counselorNotes = counselorNotes;
    if (callType) booking.callType = callType;

    const parent = booking.parent;
    let targetStage = 1;

    if (action === "approve_step2") {
      booking.status = "completed";
      booking.completedBy = "counselor_manual";
      targetStage = 2;

      // Sync Admission Document
      await Admission.findOneAndUpdate(
        { parent: parent._id },
        {
          $set: {
            admissionStage: 2,
            assignedCounselor: req.user._id,
            "stage1_Discovery.completedAt": new Date()
          }
        },
        { upsert: true, new: true }
      );

      if (req.app && req.app.get("io")) {
        await sendAutoNotification(
          req.app, parent._id,
          `🎉 Great news! Your Discovery Call is complete. Stage 2: Assessment is unlocked.`,
          "admission-portal", req.user.username
        );
      }
    } else if (action === "mark_missed") {
      booking.status = "missed";
      
      if (req.app && req.app.get("io")) {
        await sendAutoNotification(
          req.app, parent._id,
          `📅 Your Discovery Call was marked as missed. Please reschedule from your portal.`,
          "admission-portal", req.user.username
        );
      }
    }

    // Schema Validation Safety Backfills
    if (!booking.email && parent?.email) booking.email = parent.email;
    if (!booking.phone && parent?.phone) booking.phone = parent.phone;
    if (!booking.time) {
      booking.time = new Date(booking.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    await booking.save();

    res.status(200).json({ 
      success: true, 
      message: "Status updated successfully!", 
      booking,
      currentParentStage: targetStage 
    });

  } catch (error) {
    console.error("Error updating discovery status:", error);
    res.status(500).json({ error: "Failed to update status." });
  }
});
// ==========================================
// 8. FETCH ADMISSION PROGRESS (PARENT PORTAL)
// ==========================================
router.get("/api/my-admission-progress", authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({ parent: req.user._id })
      .populate({
        path: "stage1_Discovery.booking",
        model: Booking,
        select: "meetLink date time status"
      })
      .populate({
        path: "stage3_Recommendation.booking",
        model: Booking,
        select: "meetLink date time status"
      });

    if (!admission) {
      return res.status(200).json({
        admissionStage: 1,
        meetLink: null,
        meetingDateISO: null
      });
    }

    res.status(200).json({
      admissionStage: admission.admissionStage,
      meetLink: admission.stage1_Discovery?.booking?.meetLink || null,
      meetingDateISO: admission.stage1_Discovery?.booking?.date || null,
      leadDetails: admission.leadDetails || null, // Added so frontend can fallback to student name
      stage2_Assessment: admission.stage2_Assessment || null,
      stage3_Recommendation: admission.stage3_Recommendation || null,
      stage4_ClassesBegin: admission.stage4_ClassesBegin || null,
      stage5_Confirmation: admission.stage5_Confirmation || null
    });

  } catch (error) {
    console.error("Error fetching admission progress:", error);
    res.status(500).json({ error: "Failed to load progress." });
  }
});
// ==========================================
// 9. FETCH PARENT'S ACTIVE DISCOVERY CALL
// ==========================================
router.get("/api/my-discovery-call", authenticate, async (req, res) => {
  try {
    const booking = await Booking.findOne({ 
      parent: req.user._id, 
      status: "scheduled" 
    }).sort({ createdAt: -1 });

    if (booking) {
      return res.status(200).json({ 
        hasBooking: true,
        meetLink: booking.meetLink, 
        meetingDateISO: booking.date 
      });
    }

    res.status(200).json({ hasBooking: false });
  } catch (error) {
    console.error("Error fetching discovery call:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ==========================================
// 10. FETCH BOOKED SLOTS
// ==========================================
router.get("/api/booked-slots", async (req, res) => {
  try {
    const today = new Date();
    const upcomingEvents = await Event.find({ 
      date: { $gte: today },
      type: "meeting"
    }).select("date"); 

    const bookedIsoStrings = upcomingEvents.map(event => event.date.toISOString());
    res.status(200).json(bookedIsoStrings);
  } catch (error) {
    console.error("Error fetching booked slots:", error);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// ==========================================
// 11. ADMIN: TOGGLE COUNSELOR PRIVILEGES
// ==========================================
router.put("/api/admin/toggle-counselor/:username", authenticate, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ error: "User not found" });

    let counselor = await Counselor.findOne({ user: user._id });
    let currentStatus = false;

    if (counselor) {
      counselor.isActive = !counselor.isActive;
      await counselor.save();
      currentStatus = counselor.isActive;
    } else {
      await Counselor.create({ 
        user: user._id, 
        isActive: true,
        priority: 1,
        timeZone: "Asia/Kolkata",
        baseAvailability: [],
        dateOverrides: []
      });
      currentStatus = true;
    }

    if (currentStatus === true) {
      await sendAutoNotification(
        req.app, 
        user._id, 
        `🎉 You are now an Admissions Counselor! Please set your weekly hours.`, 
        "counselor-schedule", 
        req.user.username
      );
    } else {
      await sendAutoNotification(
        req.app, 
        user._id, 
        `🛑 Your Admissions Counselor access has been temporarily revoked.`, 
        "settings", 
        req.user.username
      );
    }

    res.status(200).json({ 
      success: true, 
      message: `Counselor access ${currentStatus ? 'granted' : 'revoked'} for @${user.username}`,
      isCounselor: currentStatus 
    });

  } catch (error) {
    console.error("Toggle Counselor Error:", error);
    res.status(500).json({ error: "Failed to toggle counselor status" });
  }
});

// ==========================================
// STAGE 2: FETCH ASSESSMENT PROGRESS
// ==========================================
router.get("/api/assessment-progress", authenticate, async (req, res) => {
  try {
    let assessment = await Assessment.findOne({ parent: req.user._id })
      .populate("liveTest.booking");

    if (!assessment) {
      // Create a blank slate if they just entered Stage 2
      const admission = await Admission.findOne({ parent: req.user._id });
      if (!admission) return res.status(404).json({ error: "No admission record found." });

      assessment = new Assessment({ 
        parent: req.user._id,
        admission: admission._id,
        currentStep: 1
      });
      await assessment.save();

      // Link it to the Admission pipeline
      admission.stage2_Assessment.assessmentRecord = assessment._id;
      await admission.save();
    }

    res.status(200).json(assessment);
  } catch (error) {
    console.error("Fetch Assessment Error:", error);
    res.status(500).json({ error: "Failed to fetch assessment progress." });
  }
});

// ==========================================
// STAGE 2: AUTO-SAVE QUESTIONNAIRE & DOCS
// ==========================================
router.put("/api/assessment/auto-save", authenticate, async (req, res) => {
  try {
    const { currentStep, questionnaire, documents } = req.body;

    const assessment = await Assessment.findOneAndUpdate(
      { parent: req.user._id },
      { 
        $set: { 
          currentStep: currentStep || 1,
          ...(questionnaire && { questionnaire }),
          ...(documents && { documents })
        } 
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "Progress saved", assessment });
  } catch (error) {
    console.error("Auto-save Error:", error);
    res.status(500).json({ error: "Failed to auto-save." });
  }
});

// ==========================================
// STAGE 2: SUBMIT FORM & START 7-DAY TIMER
// ==========================================
router.post("/api/assessment/submit-form", authenticate, async (req, res) => {
  try {
    // 1. Set the deadline to exactly 7 days from right now
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 7);

    const assessment = await Assessment.findOneAndUpdate(
      { parent: req.user._id },
      { 
        $set: { 
          currentStep: 3, 
          "liveTest.deadline": deadlineDate 
        } 
      },
      { new: true }
    );

    // 2. Update pipeline status
    await Admission.findOneAndUpdate(
      { parent: req.user._id },
      { $set: { "stage2_Assessment.status": "questionnaire_done" } }
    );

    // 3. Notify the assigned Counselor (Optional)
    const admission = await Admission.findOne({ parent: req.user._id });
    if (admission?.assignedCounselor && req.app && req.app.get("io")) {
       await sendAutoNotification(
         req.app, admission.assignedCounselor, 
         `📝 Assessment Form submitted by ${req.user.name}. They have 7 days to book the live test.`, 
         "admissions-desk", req.user.username
       );
    }

    res.status(200).json({ message: "Form submitted. Timer started!", assessment });
  } catch (error) {
    console.error("Submit Form Error:", error);
    res.status(500).json({ error: "Failed to submit form." });
  }
});

// ==========================================
// STAGE 2: BOOK LIVE TEST (GOOGLE MEET)
// ==========================================
router.post("/api/assessment/book-live-test", authenticate, async (req, res) => {
  try {
    const { date } = req.body;
    const meetingDateUTC = new Date(date);
    const meetingEndDateUTC = new Date(meetingDateUTC.getTime() + 45 * 60 * 1000); // 45 min test

    // 1. Get their existing Admission & Counselor
    const admission = await Admission.findOne({ parent: req.user._id }).populate("assignedCounselor");
    if (!admission || !admission.assignedCounselor) {
      return res.status(400).json({ error: "No counselor assigned. Please contact support." });
    }
    
    // Check if they missed the 7-day deadline to click "book"
    const assessment = await Assessment.findOne({ parent: req.user._id });
    if (assessment.liveTest.deadline && new Date() > new Date(assessment.liveTest.deadline)) {
      return res.status(400).json({ error: "Your 7-day window has expired. Your application has been discarded. Please contact support." });
    }

    // 🚨 NEW: Check if the CHOSEN MEETING DATE is beyond the 7-day window
    if (assessment.liveTest.deadline && meetingDateUTC > new Date(assessment.liveTest.deadline)) {
      return res.status(400).json({ error: "The test date must be scheduled within your 7-day window." });
    }

    const assignedCounselorUser = await User.findById(admission.assignedCounselor);

    // 2. Double-check Counselor availability to prevent double-booking
    const existingBooking = await Booking.findOne({
      counselor: admission.assignedCounselor,
      date: meetingDateUTC,
      status: { $ne: "cancelled" }
    });

    if (existingBooking) {
      return res.status(400).json({ error: "This slot was just taken. Please select another." });
    }

    // 3. Create Google Meet (Same logic as Stage 1)
    let realMeetLink = "https://meet.google.com";
    let googleEventId = null;
    let googleHtmlLink = "";

    try {
      if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: 'admin@curiousteamlearning.com'
        });
        const calendar = google.calendar({ version: 'v3', auth });

        const googleRes = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          resource: {
            summary: `[LIVE TEST] ${req.user.name} & ${assignedCounselorUser.name}`,
            description: `**Stage 2 Live Baseline Test**\n\nParent: ${req.user.name}\nEmail: ${req.user.email}\nPhone: ${req.user.phone}`,
            start: { dateTime: meetingDateUTC.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: meetingEndDateUTC.toISOString(), timeZone: 'Asia/Kolkata' },
            attendees: [{ email: req.user.email }, { email: assignedCounselorUser.email }],
            conferenceData: { createRequest: { requestId: Math.random().toString(36).substring(7), conferenceSolutionKey: { type: "hangoutsMeet" } } }
          },
          sendUpdates: 'all', conferenceDataVersion: 1
        });
        realMeetLink = googleRes.data.hangoutLink || realMeetLink;
        googleEventId = googleRes.data.id;
        googleHtmlLink = googleRes.data.htmlLink;
      }
    } catch (gErr) { console.error("Google Meet Error:", gErr); }

    // 4. Save Booking (Notice type is "assessment_test")
    const newBooking = new Booking({
      parent: req.user._id,
      counselor: admission.assignedCounselor,
      date: meetingDateUTC,
      time: moment(meetingDateUTC).tz('Asia/Kolkata').format("HH:mm"),
      title: `Live Test: ${req.user.name}`,
      meetLink: realMeetLink,
      status: "scheduled",
      type: "assessment_test" // 🚨 Differentiates from Discovery Call
    });
    await newBooking.save();

    // 5. Update Assessment & Admission pipelines
    assessment.liveTest.booking = newBooking._id;
    assessment.liveTest.status = "scheduled";
    await assessment.save();

    admission.stage2_Assessment.status = "test_scheduled";
    await admission.save();

    // 6. Platform Calendar Event
    await Event.create({
      title: `Live Test: ${req.user.name}`,
      date: meetingDateUTC, type: "meeting", color: "bg-blue-500", // Blue for tests
      user: admission.assignedCounselor,
      googleEventId, meetLink: realMeetLink, htmlLink: googleHtmlLink, guests: [req.user.username]
    });

    res.status(200).json({ message: "Test Scheduled successfully!", meetLink: realMeetLink });

  } catch (error) {
    console.error("Test Booking Error:", error);
    res.status(500).json({ error: "Failed to book test." });
  }
});

// ==========================================
// STAGE 2: UPLOAD DOCUMENT TO PARENT DRIVE FOLDER
// ==========================================
router.post("/api/assessment/upload-document", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    // 1. Authenticate with Google Drive (Impersonating Admin)
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: 'admin@curiousteamlearning.com'
    });

    const drive = google.drive({ version: 'v3', auth });
    const mainFolderId = process.env.GOOGLE_DRIVE_ADMISSIONS_FOLDER_ID;
    const parentEmail = req.user.email.toLowerCase().trim();

    // 2. SEARCH: Check if a folder named after the parent's email already exists
    const searchRes = await drive.files.list({
      q: `'${mainFolderId}' in parents and name = '${parentEmail}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)'
    });

    let targetFolderId;

    if (searchRes.data.files.length > 0) {
      // Parent folder exists!
      targetFolderId = searchRes.data.files[0].id;
    } else {
      // 3. CREATE: Folder doesn't exist yet, make a new one named after parent's email
      const folderRes = await drive.files.create({
        requestBody: {
          name: parentEmail,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mainFolderId]
        },
        fields: 'id'
      });
      targetFolderId = folderRes.data.id;
    }

    // 4. STREAM FILE: Upload into the parent's specific folder
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    const fileName = `${req.file.originalname}`;

    const driveResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId] // 🚨 Uploads inside parent's email folder!
      },
      media: {
        mimeType: req.file.mimetype,
        body: bufferStream
      },
      fields: "id, webViewLink"
    });

    // 5. Make file viewable for counselors
    await drive.permissions.create({
      fileId: driveResponse.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    res.status(200).json({ 
      message: "File uploaded successfully", 
      fileId: driveResponse.data.id,
      fileUrl: driveResponse.data.webViewLink 
    });

  } catch (error) {
    console.error("Google Drive Upload Error:", error);
    res.status(500).json({ error: "Failed to upload document to Drive." });
  }
});

// ==========================================
// STAGE 2: DELETE DOCUMENT FROM GOOGLE DRIVE
// ==========================================
router.delete("/api/assessment/document/:fileId", authenticate, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // 1. Authenticate with Google (Impersonating Admin)
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: 'admin@curiousteamlearning.com'
    });
    
    const drive = google.drive({ version: 'v3', auth });

    // 2. Delete the file from Google Drive
    try {
      await drive.files.delete({ fileId: fileId });
    } catch (driveErr) {
      console.log("Drive file not found or already deleted:", driveErr.message);
      // We continue even if Drive fails, so we can clean up the MongoDB array!
    }

    // 3. Remove from MongoDB Assessment Document
    const updatedAssessment = await Assessment.findOneAndUpdate(
      { parent: req.user._id },
      { $pull: { documents: { driveFileId: fileId } } },
      { new: true }
    );

    res.status(200).json({ 
      message: "Document deleted successfully", 
      documents: updatedAssessment.documents 
    });

  } catch (error) {
    console.error("Delete Document Error:", error);
    res.status(500).json({ error: "Failed to delete document." });
  }
});

// ==========================================
// STAGE 2: UPLOAD TEST ANSWER SHEET
// ==========================================
router.post("/api/assessment/upload-test-answers", authenticate, upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Please select at least one file." });
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive'],
      subject: 'admin@curiousteamlearning.com'
    });

    const drive = google.drive({ version: 'v3', auth });
    const mainFolderId = process.env.GOOGLE_DRIVE_ADMISSIONS_FOLDER_ID;
    const parentEmail = req.user.email.toLowerCase().trim();

    // 1. Get or Create Parent's Drive Subfolder
    const searchRes = await drive.files.list({
      q: `'${mainFolderId}' in parents and name = '${parentEmail}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)'
    });

    let targetFolderId;
    if (searchRes.data.files.length > 0) {
      targetFolderId = searchRes.data.files[0].id;
    } else {
      const folderRes = await drive.files.create({
        requestBody: { name: parentEmail, mimeType: 'application/vnd.google-apps.folder', parents: [mainFolderId] },
        fields: 'id'
      });
      targetFolderId = folderRes.data.id;
    }

    // 2. Upload Answer Sheets
    const uploadedFiles = [];
    for (const file of req.files) {
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const driveRes = await drive.files.create({
        requestBody: {
          name: `[TEST-SHEET] - ${file.originalname}`,
          parents: [targetFolderId]
        },
        media: { mimeType: file.mimetype, body: bufferStream },
        fields: "id, webViewLink"
      });

      await drive.permissions.create({
        fileId: driveRes.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      uploadedFiles.push({
        title: file.originalname,
        fileUrl: driveRes.data.webViewLink,
        driveFileId: driveRes.data.id
      });
    }

    // 3. Save to Assessment Schema & Complete Stage 2
    const assessment = await Assessment.findOneAndUpdate(
      { parent: req.user._id },
      { 
        $push: { documents: { $each: uploadedFiles } },$set: { "liveTest.status": "completed" }
      },
      { new: true }
    );

    // Update Stage in Admission Pipeline
    await Admission.findOneAndUpdate(
      { parent: req.user._id },
      { $set: { "stage2_Assessment.status": "completed" } }
    );

    res.status(200).json({ message: "Answer sheets uploaded successfully!", assessment });

  } catch (error) {
    console.error("Test Sheet Upload Error:", error);
    res.status(500).json({ error: "Failed to upload test sheets." });
  }
});


// ==========================================
// COUNSELOR: SAVE NOTES & ADVANCE TO STAGE 3
// ==========================================
router.post("/api/counselor/complete-stage2", authenticate, async (req, res) => {
  try {
    const { admissionId, teacherBaselineNotes, recommendedTrack } = req.body;

    // 1. Save Evaluation Notes to Assessment
    const assessment = await Assessment.findOneAndUpdate(
      { admission: admissionId },
      { 
        $set: { 
          "liveTest.teacherBaselineNotes": teacherBaselineNotes,
          "liveTest.status": "completed"
        } 
      },
      { new: true }
    );

    // 2. Advance Admission Stage to 3!
    const admission = await Admission.findByIdAndUpdate(
      admissionId,
      {
        $set: {
          admissionStage: 3,
          "stage2_Assessment.status": "completed",
          "stage3_Recommendation.recommendedPathway": recommendedTrack
        }
      },
      { new: true }
    );

    res.status(200).json({ message: "Stage 2 completed! Student moved to Stage 3.", admission });
  } catch (error) {
    console.error("Complete Stage 2 Error:", error);
    res.status(500).json({ error: "Failed to complete Stage 2." });
  }
});

/// ==========================================
// COUNSELOR: FETCH FULL STUDENT DOSSIER
// ==========================================
router.get("/api/counselor/dossier/:identifier", authenticate, async (req, res) => {
  try {
    const identifier = req.params.identifier;

    // 1. First, try to find the record assuming the ID is an Admission ID (Pipeline View)
    let admission = await Admission.findById(identifier)
      .populate({ path: "parent", select: "name email phone username photo", model: User })
      .populate({ path: "assignedCounselor", select: "name username", model: User })
      .populate({ path: "stage2_Assessment.assessmentRecord", model: Assessment });

    // 2. If it fails, try finding it assuming the ID is a Parent ID (Schedule View)
    if (!admission) {
      admission = await Admission.findOne({ parent: identifier })
        .populate({ path: "parent", select: "name email phone username photo", model: User })
        .populate({ path: "assignedCounselor", select: "name username", model: User })
        .populate({ path: "stage2_Assessment.assessmentRecord", model: Assessment });
    }

    // 3. If STILL not found, then it truly doesn't exist
    if (!admission) {
      return res.status(404).json({ error: "Admission record not found." });
    }

    const relatedBookings = await Booking.find({ parent: admission.parent._id })
      .sort({ date: -1, time: -1 }) 
      .populate({ path: "counselor", select: "name username", model: User });

    res.status(200).json({ 
      admission, 
      relatedBookings 
    });

  } catch (error) {
    console.error("Dossier Fetch Error:", error);
    res.status(500).json({ error: "Failed to load student dossier." });
  }
});

// ==========================================
// COUNSELOR: FETCH ADMISSIONS BY STAGE
// ==========================================
router.get("/api/counselor/admissions", authenticate, async (req, res) => {
  try {
    const stage = parseInt(req.query.stage) || 1;
    
    // 🚨 SECURITY FIX: Ensure normal counselors only see their own assigned leads!
    const query = { admissionStage: stage };
    if (!req.user.isAdmin) {
      query.assignedCounselor = req.user._id;
    }
    
    const admissions = await Admission.find(query)
      .populate({ path: "parent", select: "name email phone username photo", model: User })
      .populate({ path: "assignedCounselor", select: "name username", model: User })
      .populate({ path: "stage2_Assessment.assessmentRecord", model: Assessment })
      .sort({ updatedAt: -1 });

    res.status(200).json(admissions);
  } catch (error) {
    console.error("Fetch Stage Admissions Error:", error);
    res.status(500).json({ error: "Failed to fetch admissions for pipeline view." });
  }
});

// ==========================================
// COUNSELOR: GENERIC STAGE ADVANCEMENT
// ==========================================
router.put("/api/counselor/advance-stage/:admissionId", authenticate, async (req, res) => {
  try {
    const { nextStage, stageData } = req.body;

    const admission = await Admission.findByIdAndUpdate(
      req.params.admissionId,
      {
        $set: {
          admissionStage: nextStage,
          ...stageData
        }
      },
      { new: true }
    );

    res.status(200).json({ message: `Advanced to stage ${nextStage}`, admission });
  } catch (error) {
    console.error("Advance Stage Error:", error);
    res.status(500).json({ error: "Failed to advance stage." });
  }
});

// ==========================================
// COUNSELOR: AUTO-SAVE DOSSIER DRAFT (STAGE 3)
// ==========================================
router.put("/api/counselor/autosave-dossier/:admissionId", authenticate, async (req, res) => {
  try {
    const { 
      teacherBaselineNotes, 
      recommendedPathway, 
      classEquivalent, 
      classDuration, 
      workingPlan, 
      scholarshipPercent 
    } = req.body;

    // 1. Silent save to Assessment (Internal Notes)
    await Assessment.findOneAndUpdate(
      { admission: req.params.admissionId },
      { $set: { "liveTest.teacherBaselineNotes": teacherBaselineNotes } }
    );

    // 2. Silent save to Admission Pipeline Data
    const updatedAdmission = await Admission.findByIdAndUpdate(
      req.params.admissionId,
      {
        $set: {
          "stage3_Recommendation.recommendedPathway": recommendedPathway,
          "stage3_Recommendation.classEquivalent": classEquivalent,
          "stage3_Recommendation.classDuration": classDuration,
          "stage3_Recommendation.workingPlan": workingPlan,
          "stage3_Recommendation.scholarshipPercent": scholarshipPercent,
        }
      },
      { new: true }
    );

    res.status(200).json({ message: "Dossier autosaved securely.", admission: updatedAdmission });
  } catch (error) {
    console.error("Autosave Dossier Error:", error);
    res.status(500).json({ error: "Failed to autosave dossier." });
  }
});

// ==========================================
// COUNSELOR: SAVE NOTES & ADVANCE TO STAGE 3
// ==========================================
router.post("/api/counselor/complete-stage2", authenticate, async (req, res) => {
  try {
    const { 
      admissionId, 
      teacherBaselineNotes, 
      recommendedPathway,
      classEquivalent,
      classDuration,
      workingPlan,
      scholarshipPercent
    } = req.body;

    // 1. Save Evaluation Notes to Assessment Document
    const assessment = await Assessment.findOneAndUpdate(
      { admission: admissionId },
      { 
        $set: { 
          "liveTest.teacherBaselineNotes": teacherBaselineNotes,
          "liveTest.status": "completed"
        } 
      },
      { new: true }
    );

    // 2. Advance Admission Stage to 3 and save the entire custom plan!
    const admission = await Admission.findByIdAndUpdate(
      admissionId,
      {
        $set: {
          admissionStage: 3,
          "stage2_Assessment.status": "completed",
          // The new comprehensive Stage 3 Plan payload:
          "stage3_Recommendation.recommendedPathway": recommendedPathway,
          "stage3_Recommendation.classEquivalent": classEquivalent,
          "stage3_Recommendation.classDuration": classDuration,
          "stage3_Recommendation.workingPlan": workingPlan,
          "stage3_Recommendation.scholarshipPercent": scholarshipPercent,
          "stage3_Recommendation.feePaid": false
        }
      },
      { new: true }
    );

    res.status(200).json({ message: "Stage 2 completed! Student moved to Stage 3.", admission });
  } catch (error) {
    console.error("Complete Stage 2 Error:", error);
    res.status(500).json({ error: "Failed to complete Stage 2." });
  }
});

// ==========================================
// STAGE 2 -> 3: COMPLETE TEST & UNLOCK STAGE 3 SCHEDULER
// ==========================================
router.post("/api/assessment/complete-test", authenticate, async (req, res) => {
  try {
    // 1. Lock the assessment test status to completed
    await Assessment.findOneAndUpdate(
      { parent: req.user._id },
      { $set: { "liveTest.status": "completed" } }
    );
    
    // 2. Set the Stage 3 scheduling deadline (7 days from now)
    const callDeadline = new Date();
    callDeadline.setDate(callDeadline.getDate() + 7);

    // 3. Advance the main admission pipeline directly to Stage 3!
    await Admission.findOneAndUpdate(
      { parent: req.user._id },
      { 
        $set: { 
          "stage2_Assessment.status": "completed",
          admissionStage: 3,
          "stage3_Recommendation.status": "pending",
          "stage3_Recommendation.callDeadline": callDeadline
        } 
      }
    );
    
    res.status(200).json({ message: "Test completed! Moving to Stage 3 scheduling." });
  } catch (error) {
    console.error("Complete Test Error:", error);
    res.status(500).json({ error: "Failed to complete test." });
  }
});
// ==========================================
// STAGE 3: PARENT SCHEDULES RECOMMENDATION CALL
// ==========================================
router.post("/api/parent/book-recommendation-call", authenticate, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: "Missing meeting date." });

    const meetingDateUTC = new Date(date);
    const meetingEndDateUTC = new Date(meetingDateUTC.getTime() + 45 * 60 * 1000); 

    const admission = await Admission.findOne({ parent: req.user._id }).populate({ 
      path: "assignedCounselor", model: User 
    });
    
    if (!admission || !admission.assignedCounselor) {
      return res.status(400).json({ error: "No counselor assigned." });
    }

    // 🚨 AUTO-HEAL: If you already booked a slot but the UI didn't update, this catches it and fixes the UI instantly!
    const orphanedBooking = await Booking.findOne({
      parent: req.user._id,
      type: "recommendation_call",
      status: "scheduled"
    }).sort({ createdAt: -1 });

    if (orphanedBooking) {
      console.log("🩹 Auto-healing triggered! Linking your hidden booking to the UI...");
      await Admission.findOneAndUpdate(
        { parent: req.user._id },
        { 
          $set: { 
            "stage3_Recommendation.booking": orphanedBooking._id,
            "stage3_Recommendation.status": "call_scheduled"
          } 
        }
      );
      return res.status(200).json({ message: "Call scheduled successfully! (Recovered)" });
    }

    const counselorId = admission.assignedCounselor._id || admission.assignedCounselor;
    const counselorName = admission.assignedCounselor.name || "Counselor";
    const counselorEmail = admission.assignedCounselor.email || "";

    // Check if the slot is taken
    const existingBooking = await Booking.findOne({
      counselor: counselorId,
      date: meetingDateUTC,
      status: { $ne: "cancelled" }
    });
    
    if (existingBooking) return res.status(400).json({ error: "This slot was just taken. Please select another." });

    let realMeetLink = "https://meet.google.com";
    let googleEventId = null;
    let googleHtmlLink = "";

    try {
      if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: 'admin@curiousteamlearning.com'
        });
        const calendar = google.calendar({ version: 'v3', auth });
        const googleRes = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          resource: {
            summary: `[PLAN REVIEW] ${req.user.name || 'Parent'} & ${counselorName}`,
            start: { dateTime: meetingDateUTC.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: meetingEndDateUTC.toISOString(), timeZone: 'Asia/Kolkata' },
            attendees: [{ email: req.user.email }, { email: counselorEmail }],
            conferenceData: { createRequest: { requestId: Math.random().toString(36).substring(7), conferenceSolutionKey: { type: "hangoutsMeet" } } }
          },
          sendUpdates: 'all',
          conferenceDataVersion: 1
        });
        if (googleRes.data.hangoutLink) realMeetLink = googleRes.data.hangoutLink;
        googleEventId = googleRes.data.id;
        googleHtmlLink = googleRes.data.htmlLink;
      }
    } catch (gErr) { console.error("Meet generation error:", gErr.message); }

    const newBooking = new Booking({
      parent: req.user._id, counselor: counselorId, date: meetingDateUTC,
      time: moment(meetingDateUTC).tz('Asia/Kolkata').format("HH:mm"),
      title: `Plan Review: ${req.user.name || 'Parent'}`,
      meetLink: realMeetLink, status: "scheduled", type: "recommendation_call" 
    });
    await newBooking.save();

    await Event.create({
      title: `Plan Review: ${req.user.name || 'Parent'}`,
      date: meetingDateUTC, type: "meeting", color: "bg-purple-500",
      user: counselorId, googleEventId, meetLink: realMeetLink, htmlLink: googleHtmlLink, guests: [req.user.username || 'Parent']
    });

    await Admission.findOneAndUpdate(
      { parent: req.user._id },
      { 
        $set: { 
          "stage3_Recommendation.booking": newBooking._id,
          "stage3_Recommendation.status": "call_scheduled"
        } 
      }
    );

    res.status(200).json({ message: "Call scheduled successfully!" });
  } catch (error) {
    console.error("Book Call Error (500):", error);
    res.status(500).json({ error: "Failed to book call." });
  }
});

// ==========================================
// STAGE 3: PARENT CONFIRMS ENROLLMENT & PAYS
// ==========================================
router.post("/api/parent/confirm-enrollment", authenticate, async (req, res) => {
  try {
    // 1. Find the parent's admission record
    const admission = await Admission.findOne({ parent: req.user._id });
    if (!admission || admission.admissionStage !== 3) {
      return res.status(400).json({ error: "Invalid admission stage." });
    }

    // 2. Mark fee as paid and advance to Stage 4 (Classes Begin)
    const updatedAdmission = await Admission.findOneAndUpdate(
      { parent: req.user._id },
      {
        $set: {
          admissionStage: 4,
          "stage3_Recommendation.feePaid": true,
          "stage3_Recommendation.approvedByParent": true,
          "stage3_Recommendation.completedAt": new Date(),
          "stage4_ClassesBegin.status": "pending",
          // Give them 5 extra days from right now for their comfort guarantee refund window
          "stage4_ClassesBegin.refundWindowEndsAt": new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000) 
        }
      },
      { new: true }
    );

    // 3. Notify the assigned Counselor that the parent enrolled!
    if (updatedAdmission.assignedCounselor && req.app && req.app.get("io")) {
      await sendAutoNotification(
        req.app, 
        updatedAdmission.assignedCounselor, 
        `🎉 ${req.user.name} has paid the enrollment fee! They are now in Stage 4.`, 
        "admissions-desk", 
        "System"
      );
    }

    res.status(200).json({ message: "Enrollment confirmed! Welcome to Stage 4.", admission: updatedAdmission });
  } catch (error) {
    console.error("Enrollment Confirmation Error:", error);
    res.status(500).json({ error: "Failed to process enrollment." });
  }
});

// ==========================================
// COUNSELOR: MARK STAGE 3 CALL COMPLETE (UNLOCKS PAYMENT FOR PARENT)
// ==========================================
router.put("/api/counselor/complete-stage3-call/:admissionId", authenticate, async (req, res) => {
  try {
    const admission = await Admission.findByIdAndUpdate(
      req.params.admissionId,
      {
        $set: { "stage3_Recommendation.status": "call_completed" }
      },
      { new: true }
    );

    // Optional: Update the specific Booking document to 'completed' as well
    if (admission.stage3_Recommendation.booking) {
      await Booking.findByIdAndUpdate(admission.stage3_Recommendation.booking, { status: "completed" });
    }

    res.status(200).json({ message: "Call marked complete. Plan revealed to parent!", admission });
  } catch (error) {
    console.error("Complete Stage 3 Call Error:", error);
    res.status(500).json({ error: "Failed to mark call as complete." });
  }
});

// ==========================================
// STAGE 4: PARENT REQUESTS REFUND (5-DAY GUARANTEE)
// ==========================================
router.post("/api/parent/request-refund", authenticate, async (req, res) => {
  try {
    const admission = await Admission.findOne({ parent: req.user._id });
    if (!admission || admission.admissionStage !== 4) return res.status(400).json({ error: "Invalid stage." });

    if (new Date() > new Date(admission.stage4_ClassesBegin.refundWindowEndsAt)) {
        return res.status(400).json({ error: "Comfort Guarantee window has expired." });
    }

    admission.stage4_ClassesBegin.refundRequested = true;
    admission.stage4_ClassesBegin.status = "refund_requested";
    await admission.save();

    if (admission.assignedCounselor && req.app && req.app.get("io")) {
        await sendAutoNotification(req.app, admission.assignedCounselor, `⚠️ Refund Requested by ${req.user.name} under the 5-Day Guarantee.`, "admissions-desk", "System");
    }

    res.status(200).json({ message: "Refund request submitted. Our team will contact you within 24 hours." });
  } catch (error) {
    res.status(500).json({ error: "Failed to process refund request." });
  }
});

// ==========================================
// 1. GENERATE RECURRING 10-DAY INDUCTION SCHEDULE
// ==========================================
router.put("/api/counselor/generate-induction-schedule/:admissionId", authenticate, async (req, res) => {
  try {
    const { startDate, startTime, holidays, teacherUsername } = req.body;
    
    if (!startDate || !startTime || !teacherUsername) {
      return res.status(400).json({ error: "Start Date, Time, and Teacher required." });
    }

    const admission = await Admission.findById(req.params.admissionId).populate("parent");
    const teacher = await User.findOne({ username: teacherUsername });
    const parent = admission.parent;
    
    const [hours, minutes] = startTime.split(":");
    const durationStr = admission.stage3_Recommendation?.classDuration || "1 Hour";
    const durationHours = parseInt(durationStr.match(/\d+/)?.[0] || "1");
    const endHours = Number(hours) + durationHours;
    const endTimeString = `${String(endHours).padStart(2, '0')}:${minutes}`;

    // 1. Compute exact valid 10 dates strictly in IST to prevent server shift
    const validDates = [];
    const holidayExDates = [];
    let currentMoment = moment.tz(startDate, "YYYY-MM-DD", "Asia/Kolkata");

    while (validDates.length < 10) {
      const day = currentMoment.day();
      const dateStr = currentMoment.format("YYYY-MM-DD");
      
      // Set the exact local hour/minute
      const classMoment = currentMoment.clone().hours(hours).minutes(minutes).seconds(0);
      
      if (day !== 0 && day !== 6 && (!holidays || !holidays.includes(dateStr))) {
        validDates.push(classMoment.toDate());
      } else if (holidays && holidays.includes(dateStr)) {
        // EXDATE expects local time format YYYYMMDDTHHmmss (NO 'Z')
        holidayExDates.push(classMoment.format("YYYYMMDDTHHmmss"));
      }
      currentMoment.add(1, 'days');
    }

    const firstClass = validDates[0];
    const untilDateUTC = moment(validDates[9]).utc().format("YYYYMMDDTHHmmss[Z]");

    // 2. Generate Google Calendar Recurring Event (RRULE)
    let sharedMeetLink = "https://meet.google.com"; 
    let googleEventId = null;
    let htmlLink = "";
    const className = admission.stage3_Recommendation?.classEquivalent || "Induction Class";

    try {
      if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const auth = new google.auth.JWT({
          email: process.env.GOOGLE_CLIENT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: 'admin@curiousteamlearning.com'
        });
        const calendar = google.calendar({ version: 'v3', auth });
        
        // Build Recurrence Rule: Daily, skip weekends, stop after the 10th valid class
        let recurrenceRule = [`RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${untilDateUTC}`];
        if (holidayExDates.length > 0) {
          recurrenceRule.push(`EXDATE;TZID=Asia/Kolkata:${holidayExDates.join(",")}`);
        }

        // 🚨 THE FIX: Format strictly as local times without 'Z'
        const startLocal = moment(firstClass).tz('Asia/Kolkata').format("YYYY-MM-DDTHH:mm:ss");
        const endLocal = moment(firstClass).add(durationHours, 'hours').tz('Asia/Kolkata').format("YYYY-MM-DDTHH:mm:ss");

        const eventPayload = {
          summary: `[CLASS] ${className} - ${parent.name}`,
          description: `**10-Day Induction Phase**\n\nStudent: ${admission.stage4_ClassesBegin?.studentName || parent.name}\nTeacher: ${teacher.name}\nPathway: ${admission.stage3_Recommendation?.recommendedPathway || "Standard"}`,
          start: { dateTime: startLocal, timeZone: 'Asia/Kolkata' },
          end: { dateTime: endLocal, timeZone: 'Asia/Kolkata' },
          recurrence: recurrenceRule,
          attendees: [{ email: parent.email }, { email: teacher.email }],
          conferenceData: { createRequest: { requestId: Math.random().toString(36).substring(7), conferenceSolutionKey: { type: "hangoutsMeet" } } }
        };

        const googleRes = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          resource: eventPayload,
          sendUpdates: 'all',
          conferenceDataVersion: 1
        });
        
        if (googleRes.data.hangoutLink) sharedMeetLink = googleRes.data.hangoutLink;
        googleEventId = googleRes.data.id;
        htmlLink = googleRes.data.htmlLink;
      }
    } catch (gErr) {
      console.error("GCal Recurring Event Error:", gErr.message || gErr);
    }

    const newMasterEvent = new Event({
      title: `${className} - ${parent.name}`,
      date: firstClass,
      type: "class",
      color: "bg-brand-blue",
      user: teacher._id,
      googleEventId: googleEventId,
      meetLink: sharedMeetLink,
      htmlLink: htmlLink,
      guests: [parent.username]
    });
    await newMasterEvent.save();

    // 3. Since your system syncs natively from Google Calendar, we ONLY track status in Admission
    admission.stage4_ClassesBegin.assignedClassroomId = teacherUsername; 
    admission.stage4_ClassesBegin.classesStartDate = validDates[0];
    // Map the 10 dates to local schema just so the UI has them immediately before sync finishes
    admission.stage4_ClassesBegin.scheduledClasses = validDates.map(d => ({
      date: d, startTime: startTime, endTime: endTimeString, status: "scheduled"
    }));
    admission.stage4_ClassesBegin.refundWindowEndsAt = validDates[4]; // 5th Day
    admission.stage4_ClassesBegin.status = "started";
    admission.stage4_ClassesBegin.meetLink = sharedMeetLink; 

    admission.stage4_ClassesBegin.scheduledClasses = validDates.map(d => ({
      date: d, 
      startTime: startTime, 
      endTime: endTimeString, 
      status: "scheduled",
      eventId: newMasterEvent._id 
    }));
    
    await admission.save();
    
    // ==========================================
    // 🚨 EXPERT-CONNECT: AUTO-LINK PARENT & TEACHER
    // ==========================================
    try {
      // 1. Verify the parent so they have full access to the Community Hub
      if (!parent.isVerifiedParent) {
        parent.isVerifiedParent = true;
        await parent.save();
      }

      // 2. Check if any previous connection exists (in either direction) to prevent duplicate key crashes
      let chatConnection = await ConnectionRequest.findOne({
        $or: [
          { sender: parent._id, receiver: teacher._id },
          { sender: teacher._id, receiver: parent._id }
        ]
      });

      const welcomeMessage = {
        sender: teacher._id, // Make it look like the teacher sent the first message!
        text: `👋 Hello ${parent.name}! I will be your teacher for the upcoming induction classes. Feel free to message me here if you have any questions before we begin!`
      };

      if (chatConnection) {
        // Resurrect and force-approve existing connection
        chatConnection.status = "accepted";
        chatConnection.messages.push(welcomeMessage);
        await chatConnection.save();
      } else {
        // Create a brand new active connection
        chatConnection = new ConnectionRequest({
          sender: parent._id,
          receiver: teacher._id,
          status: "accepted",
          message: "Automated connection established for your upcoming induction classes.",
          messages: [welcomeMessage]
        });
        await chatConnection.save();
      }

      // 3. Silently trigger their UI to update so the chat bubble appears instantly
      if (req.app && req.app.get("io")) {
        req.app.get("io").to(parent.username).emit("force-refresh-circle");
        req.app.get("io").to(teacher.username).emit("force-refresh-circle");
      }
    } catch (chatErr) {
      console.error("Auto-Connect Error (Non-Fatal):", chatErr.message);
      // We log it but don't crash the schedule generation!
    }

    res.status(200).json({ message: "Recurring schedule successfully pushed to Google Calendar!", admission });
  } catch (error) {
    console.error("Schedule generation failed:", error);
    res.status(500).json({ error: "Failed to generate schedule." });
  }
});

// ==========================================
// 2. FETCH PAST MEETINGS & RECORDINGS FOR PARENT
// ==========================================
router.get("/api/parent/past-recordings", authenticate, async (req, res) => {
  try {
    const parentUsername = req.user.username;
    
    // Fetch Meetings from Booking schema
    const pastBookings = await Booking.find({ 
      parent: req.user._id,
      $or: [ { status: "completed" }, { "attachments.0": { $exists: true } } ]
    }).sort({ date: -1 }).limit(10);

    // Fetch Classes from Event schema (where parent is a guest)
    const pastEvents = await Event.find({
      guests: parentUsername,
      $or: [ { date: {$lt: new Date() } }, { "attachments.0": { $exists: true } } ]
    }).sort({ date: -1 }).limit(10);

    // Merge and format
    const allRecords = [
      ...pastBookings.map(b => ({ id: b._id, title: b.title, date: b.date, type: b.type, attachments: b.attachments || [] })),
      ...pastEvents.map(e => ({ id: e._id, title: e.title, date: e.date, type: e.type, attachments: e.attachments || [] }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json(allRecords);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch recordings." });
  }
});

// ==========================================
// 2. PARENT REQUESTS TIME/DATE CHANGE (PER CLASS)
// ==========================================
router.post("/api/parent/request-class-change/:classId", authenticate, async (req, res) => {
  try {
    const { requestedDate, requestedStartTime, reason } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reqDateObj = new Date(requestedDate);
    if (reqDateObj < today) {
      return res.status(400).json({ error: "Cannot request a date in the past." });
    }
    
    const admission = await Admission.findOneAndUpdate(
      { "stage4_ClassesBegin.scheduledClasses._id": req.params.classId, parent: req.user._id },
      {
        $set: {
          "stage4_ClassesBegin.scheduledClasses.$.rescheduleRequest": {
            isPending: true,
            requestedDate: new Date(requestedDate),
            requestedStartTime: requestedStartTime,
            reason: reason
          }
        }
      },
      { new: true }
    );

    // 🚨 Notify Counselor
    if (admission.assignedCounselor && req.app && req.app.get("io")) {
      await sendAutoNotification(
        req.app, admission.assignedCounselor, 
        `🗓️ Reschedule Request: ${req.user.name} requested a schedule change.`, 
        "admissions-desk", req.user.username
      );
    }

    res.status(200).json({ message: "Reschedule request submitted to counselor." });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit request." });
  }
});

// ==========================================
// 3. COUNSELOR UPDATES INDIVIDUAL CLASS (SYNC TO GCAL)
// ==========================================
router.put("/api/counselor/update-single-class/:admissionId/:classId", authenticate, async (req, res) => {
  try {
    const { newDate, newStartTime, newEndTime } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const finalDate = new Date(newDate);
    finalDate.setHours(0, 0, 0, 0); // Ignore time for the date check
    
    if (finalDate < today) {
      return res.status(400).json({ error: "Cannot schedule classes in the past." });
    }

    const [startH, startM] = newStartTime.split(":").map(Number);
    const [endH, endM] = newEndTime.split(":").map(Number);
    if ((endH * 60 + endM) <= (startH * 60 + startM)) {
      return res.status(400).json({ error: "End time must be after start time." });
    }

    // Now re-apply the actual hours/minutes for saving
    finalDate.setHours(startH, startM, 0, 0);

    const [endHours, endMinutes] = newEndTime.split(":");
    const finalEndDate = new Date(newDate);
    finalEndDate.setHours(Number(endHours), Number(endMinutes), 0, 0);

    const admissionBeforeUpdate = await Admission.findOne({ _id: req.params.admissionId });
    if (!admissionBeforeUpdate) return res.status(404).json({ error: "Admission not found." });
    
    const oldClass = admissionBeforeUpdate.stage4_ClassesBegin.scheduledClasses.find(c => c._id.toString() === req.params.classId);
    if (!oldClass) return res.status(404).json({ error: "Class not found." });
    
    const oldDateUTC = oldClass.date; 

    // 3. Update Admission subdocument & Clear Pending Request
    let admission = await Admission.findOneAndUpdate(
      { _id: req.params.admissionId, "stage4_ClassesBegin.scheduledClasses._id": req.params.classId },
      {
        $set: {
          "stage4_ClassesBegin.scheduledClasses.$.date": finalDate,
          "stage4_ClassesBegin.scheduledClasses.$.startTime": newStartTime,
          "stage4_ClassesBegin.scheduledClasses.$.endTime": newEndTime,
          "stage4_ClassesBegin.scheduledClasses.$.rescheduleRequest.isPending": false 
        }
      },
      { new: true }
    ).populate("parent");

    // 🚨 NEW: Re-sort the classes chronologically in the database
    admission.stage4_ClassesBegin.scheduledClasses.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // 🚨 NEW: Auto-adjust the Start Date (Day 1) and Guarantee Window (Day 5) based on the new order
    if (admission.stage4_ClassesBegin.scheduledClasses.length > 0) {
      admission.stage4_ClassesBegin.classesStartDate = admission.stage4_ClassesBegin.scheduledClasses[0].date;
      if (admission.stage4_ClassesBegin.scheduledClasses.length >= 5) {
         admission.stage4_ClassesBegin.refundWindowEndsAt = admission.stage4_ClassesBegin.scheduledClasses[4].date;
      }
    }
    
    // Save the freshly sorted and adjusted array back to MongoDB
    admission.markModified("stage4_ClassesBegin.scheduledClasses");
    await admission.save();

    // 🚨 This will now work because `eventId` exists!
    if (oldClass.eventId) {
      const masterEvent = await Event.findById(oldClass.eventId);
      
      if (masterEvent && masterEvent.googleEventId) {
        try {
          if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            const auth = new google.auth.JWT({
              email: process.env.GOOGLE_CLIENT_EMAIL,
              key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              scopes: ['https://www.googleapis.com/auth/calendar'],
              subject: 'admin@curiousteamlearning.com'
            });
            const calendar = google.calendar({ version: 'v3', auth });
            
            const instancesRes = await calendar.events.instances({
              calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
              eventId: masterEvent.googleEventId,
            });

            const instanceToUpdate = instancesRes.data.items.find(inst => {
              // 🚨 FIX: Match the CURRENT start time of the instance, ignoring historical original times
              const instStart = inst.start?.dateTime || inst.start?.date; 
              return new Date(instStart).getTime() === new Date(oldDateUTC).getTime();
            });

            if (instanceToUpdate) {
              const newStartStr = moment(finalDate).tz('Asia/Kolkata').format("YYYY-MM-DDTHH:mm:ss");
              const newEndStr = moment(finalEndDate).tz('Asia/Kolkata').format("YYYY-MM-DDTHH:mm:ss");

              await calendar.events.update({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                eventId: instanceToUpdate.id,
                resource: {
                  ...instanceToUpdate,
                  start: { dateTime: newStartStr, timeZone: 'Asia/Kolkata' },
                  end: { dateTime: newEndStr, timeZone: 'Asia/Kolkata' }
                }
              });
            }
          }
        } catch (gErr) {
          console.error("GCal Update Error:", gErr.message || gErr);
        }
      }
    }

    if (req.app && req.app.get("io") && admission.parent) {
      await sendAutoNotification(
        req.app, admission.parent._id, 
        `✅ Schedule Update: Your class has been moved to ${finalDate.toLocaleDateString()} at ${newStartTime}.`, 
        "admission-portal", "System"
      );
    }

    if (req.transporter && admission.parent?.email) {
      const mailOptions = {
        from: process.env.EMAIL,
        to: admission.parent.email,
        subject: "Class Schedule Updated - CuTe Learning",
        html: `<div style="font-family: Arial; padding: 20px;">
                 <h2>Class Schedule Update</h2>
                 <p>Hello ${admission.parent.name},</p>
                 <p>Your induction class schedule has been updated. Here are your new class details:</p>
                 <div style="background-color: #f8fafc; padding: 15px; border-radius: 10px; margin: 15px 0;">
                   <p style="margin: 0 0 10px 0;"><strong>New Date:</strong> ${finalDate.toLocaleDateString()}</p>
                   <p style="margin: 0;"><strong>New Time:</strong> ${newStartTime} - ${newEndTime}</p>
                 </div>
               </div>`,
      };
      req.transporter.sendMail(mailOptions, (err) => {
        if (err) console.error("Failed to send schedule update email:", err);
      });
    }

    res.status(200).json({ message: "Class updated and synced with calendar!", admission });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update class." });
  }
});

// ==========================================
// STAGE 4: COUNSELOR ADVANCES TO STAGE 5
// ==========================================
router.put("/api/counselor/complete-stage4/:admissionId", authenticate, async (req, res) => {
    try {
        const admission = await Admission.findByIdAndUpdate(req.params.admissionId, 
            { $set: { admissionStage: 5, "stage4_ClassesBegin.status": "completed" } },
            { new: true }
        );
        res.status(200).json({ message: "Moved to Stage 5: Confirmation!", admission });
    } catch (error) {
        res.status(500).json({ error: "Failed to complete Stage 4." });
    }
});

// ==========================================
// STAGE 4: PARENT AUTOSAVES PREFERENCES
// ==========================================
router.put("/api/parent/stage4-preferences", authenticate, async (req, res) => {
  try {
    const { studentName, preferredStartTime, preferredEndTime, additionalNotes } = req.body;
    
    await Admission.findOneAndUpdate(
      { parent: req.user._id },
      {
        $set: {
          "stage4_ClassesBegin.studentName": studentName,
          "stage4_ClassesBegin.preferredStartTime": preferredStartTime,
          "stage4_ClassesBegin.preferredEndTime": preferredEndTime,
          "stage4_ClassesBegin.additionalNotes": additionalNotes
        }
      }
    );
    res.status(200).json({ message: "Preferences auto-saved" });
  } catch (error) {
    console.error("Autosave Error:", error);
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

// ==========================================
// COUNSELOR: AUTO-SAVE STAGE 4 EDITS
// ==========================================
router.put("/api/counselor/autosave-stage4/:admissionId", authenticate, async (req, res) => {
  try {
    const { classesStartDate, meetLink } = req.body;
    
    const admission = await Admission.findByIdAndUpdate(
      req.params.admissionId,
      {
        $set: {
          "stage4_ClassesBegin.classesStartDate": classesStartDate ? new Date(classesStartDate) : undefined,
          "stage4_ClassesBegin.meetLink": meetLink
        }
      },
      { new: true }
    );
    res.status(200).json({ message: "Stage 4 autosaved securely." });
  } catch (error) {
    res.status(500).json({ error: "Failed to autosave stage 4." });
  }
});

// ==========================================
// 🛠️ BROWSER DEBUGGER: GCAL SYNC
// URL FORMAT: http://localhost:5000/api/debug/calendar-sync/ADMISSION_ID/CLASS_ID
// ==========================================
router.get("/api/debug/calendar-sync/:admissionId/:classId", async (req, res) => {
  const logs = [];
  const log = (msg, data = null) => {
    const text = data ? `${msg}\n${JSON.stringify(data, null, 2)}` : msg;
    logs.push(text);
    console.log(text);
  };

  try {
    log(`🚀 STARTING GCAL SYNC DEBUGGER...`);
    log(`Admission ID: ${req.params.admissionId}`);
    log(`Class ID: ${req.params.classId}`);

    // 1. Fetch Admission
    const admission = await Admission.findById(req.params.admissionId);
    if (!admission) return res.send(`<pre>${logs.join("\n\n")}</pre>`);
    log(`✅ Found Admission. Parent ID: ${admission.parent}`);

    // 2. Find Class
    const targetClass = admission.stage4_ClassesBegin.scheduledClasses.find(c => c._id.toString() === req.params.classId);
    if (!targetClass) {
        log(`❌ Target class not found in admission record.`);
        return res.send(`<pre>${logs.join("\n\n")}</pre>`);
    }
    log(`✅ Found Class in DB. Current DB Date: ${targetClass.date}`);

    // 3. Find Master Event
    if (!targetClass.eventId) {
        log(`❌ Class has no eventId linked! Cannot sync to GCal.`);
        return res.send(`<pre>${logs.join("\n\n")}</pre>`);
    }
    const masterEvent = await Event.findById(targetClass.eventId);
    if (!masterEvent || !masterEvent.googleEventId) {
        log(`❌ Master Event not found or missing googleEventId.`);
        return res.send(`<pre>${logs.join("\n\n")}</pre>`);
    }
    log(`✅ Found Master Event. Google Event ID: ${masterEvent.googleEventId}`);

    // 4. Connect to Google
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
      subject: 'admin@curiousteamlearning.com'
    });
    const calendar = google.calendar({ version: 'v3', auth });
    log(`✅ Authenticated with Google API.`);

    // 5. Fetch Instances
    const instancesRes = await calendar.events.instances({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      eventId: masterEvent.googleEventId,
    });
    
    const instances = instancesRes.data.items || [];
    log(`✅ Fetched ${instances.length} instances from Google Calendar.`);

    // Log what Google has so you can see it in the browser
    const instanceLog = instances.map(inst => ({
        id: inst.id,
        originalStart: inst.originalStartTime?.dateTime,
        currentStart: inst.start?.dateTime,
        status: inst.status
    }));
    log(`🔍 GOOGLE CALENDAR INSTANCES:`, instanceLog);

    // 6. Match Logic Test
    const dbDateMs = new Date(targetClass.date).getTime();
    log(`🎯 Target DB Date (ms): ${dbDateMs} (${new Date(targetClass.date).toISOString()})`);

    let matchedInstance = null;
    for (const inst of instances) {
        const instStart = inst.originalStartTime?.dateTime || inst.start?.dateTime;
        const instDateMs = new Date(instStart).getTime();
        
        if (instDateMs === dbDateMs) {
            matchedInstance = inst;
            log(`✅ MATCH FOUND! Google Calendar Instance ID: ${inst.id}`);
            break;
        }
    }

    if (!matchedInstance) {
        log(`❌ NO EXACT MATCH FOUND.\nThe date in your database does not perfectly match any originalStartTime in Google Calendar.`);
        
        // Find the closest one to help you debug timezone shifts
        const closest = instances.map(inst => {
            const ms = new Date(inst.originalStartTime?.dateTime || inst.start?.dateTime).getTime();
            return { id: inst.id, diffHours: (ms - dbDateMs) / (1000 * 60 * 60) };
        }).sort((a,b) => Math.abs(a.diffHours) - Math.abs(b.diffHours))[0];
        
        log(`ℹ️ Closest instance is off by ${closest?.diffHours} hours.`);
    } else {
        // 7. Dummy Update to Test Google Write Permissions
        log(`🔧 Testing Write Permission to Google Calendar...`);
        
        const newStartMs = new Date(matchedInstance.start.dateTime).getTime() + 60000; // Shift by 1 minute
        const newStartStr = moment(newStartMs).tz('Asia/Kolkata').format("YYYY-MM-DDTHH:mm:ss");
        
        try {
            await calendar.events.update({
                calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
                eventId: matchedInstance.id,
                resource: {
                    ...matchedInstance,
                    start: { dateTime: newStartStr, timeZone: 'Asia/Kolkata' },
                }
            });
            log(`✅ SUCCESS! We successfully executed a test update on Google Calendar.`);
        } catch (updateErr) {
            log(`❌ Failed to update instance in Google Calendar: ${updateErr.message}`);
        }
    }

    // Render output looking like a terminal
    res.send(`<pre style="font-family: monospace; font-size: 14px; background: #1e1e1e; color: #4ade80; padding: 20px; border-radius: 8px; line-height: 1.5; white-space: pre-wrap;">${logs.join("\n\n")}</pre>`);

  } catch (error) {
    log(`💥 FATAL ERROR: ${error.message}`);
    res.status(500).send(`<pre style="font-family: monospace; font-size: 14px; background: #1e1e1e; color: #ef4444; padding: 20px; border-radius: 8px; line-height: 1.5; white-space: pre-wrap;">${logs.join("\n\n")}</pre>`);
  }
});

// ==========================================
// STAGE 5: TOGGLE ONBOARDING CHECKLIST
// ==========================================
router.put("/api/counselor/stage5-checklist/:admissionId", authenticate, async (req, res) => {
  try {
    const { field, value } = req.body;
    
    // Allowed fields to prevent unauthorized schema modifications
    const allowedFields = [
      "documentsVerified", 
      "enrollmentFormCompleted", 
      "internalOnboardingDone", 
      "studentProfileCreated",
      "feePaid"
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: "Invalid checklist field." });
    }

    const updatePath = `stage5_Confirmation.${field}`;
    const admission = await Admission.findByIdAndUpdate(
      req.params.admissionId,
      { $set: { [updatePath]: value } },
      { new: true }
    );

    res.status(200).json({ message: "Checklist updated securely.", admission });
  } catch (error) {
    console.error("Checklist Update Error:", error);
    res.status(500).json({ error: "Failed to update checklist." });
  }
});

// ==========================================
// STAGE 5: ADVANCE TO STAGE 6 (OBSERVATION)
// ==========================================
router.put("/api/counselor/complete-stage5/:admissionId", authenticate, async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.admissionId);
    
    // Ensure all checklist items are true before allowing advancement
    const s5 = admission.stage5_Confirmation;
    if (!s5.documentsVerified || !s5.enrollmentFormCompleted || !s5.internalOnboardingDone || !s5.studentProfileCreated) {
      return res.status(400).json({ error: "Please complete all onboarding checklist items first." });
    }

    admission.admissionStage = 6;
    await admission.save();

    if (req.app && req.app.get("io") && admission.parent) {
      await sendAutoNotification(
        req.app, admission.parent, 
        `🎓 Official Enrollment Complete! Welcome to the CuTe Learning family.`, 
        "admission-portal", "System"
      );
    }

    res.status(200).json({ message: "Student officially enrolled! Moved to Stage 6.", admission });
  } catch (error) {
    console.error("Complete Stage 5 Error:", error);
    res.status(500).json({ error: "Failed to complete onboarding." });
  }
});

// ==========================================
// STAGE 5: AUTO-SAVE STUDENT ENROLLMENT DRAFT
// ==========================================
router.put("/api/parent/stage5-draft", authenticate, async (req, res) => {
  try {
    const { studentName, studentUsername, studentEmail, studentDob } = req.body;
    const parentId = req.userId || req.user._id;

    const admission = await Admission.findOneAndUpdate(
      { parent: parentId },
      {
        $set: {
          "stage5_Confirmation.draftStudentDetails.studentName": studentName,
          "stage5_Confirmation.draftStudentDetails.studentUsername": studentUsername,
          "stage5_Confirmation.draftStudentDetails.studentEmail": studentEmail,
          "stage5_Confirmation.draftStudentDetails.studentDob": studentDob,
        }
      },
      { new: true }
    );

    if (!admission) return res.status(404).json({ error: "Admission record not found." });
    res.status(200).json({ message: "Draft saved.", admission });
  } catch (error) {
    console.error("Stage 5 Draft Save Error:", error);
    res.status(500).json({ error: "Failed to save draft." });
  }
});

// ==========================================
// STAGE 5: PARENT CREATES STUDENT ACCOUNT (WITH SMART LINKING & CALENDAR INVITE)
// ==========================================
router.post("/api/parent/create-student-account", authenticate, async (req, res) => {
  const { name, username, email, password, dob } = req.body;
  const parentId = req.userId || req.user._id;

  if (!email) return res.status(400).json({ error: "Email is required." });

  try {
    const parentUser = await User.findById(parentId);
    if (email.toLowerCase() === parentUser.email.toLowerCase()) {
       return res.status(400).json({ error: "Please use an email distinct from your Parent account." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existingStudent = await User.findOne({ email: cleanEmail });

    // 1 & 2. Handle Smart Link or Create New User
    if (existingStudent) {
      if (!existingStudent.role.includes("Student")) {
         existingStudent.role = "Student"; 
         await existingStudent.save();
      }
    } else {
      const usernameExist = await User.findOne({ username });
      if (usernameExist) return res.status(401).json({ error: "Username already exists." });

      const newStudent = new User({
        name, username, email: cleanEmail, password, dob, role: "Student", isEmailVerified: true
      });
      await newStudent.save();

      try {
        const admins = await User.find({ isAdmin: true });
        const notifyPromises = admins.map((admin) => 
          sendAutoNotification(req.app, admin._id, `🎓 New Student Enrolled: ${newStudent.name} (@${newStudent.username})`, "manage-users", newStudent.username)
        );
        await Promise.all(notifyPromises);
      } catch (err) {}

      try {
        const welcomeHtml = welcomeTemplate(newStudent.name || newStudent.username);
        transporter.sendMail({
          from: process.env.EMAIL,
          to: newStudent.email,
          subject: "Welcome to Curious Team Learning! 🚀 Your Student Account is Ready",
          html: welcomeHtml 
        });
      } catch (err) {}
    }

    // 3. Update Admission Stage 5 Checklist AND populate the Stage 4 Classes
    const admission = await Admission.findOneAndUpdate(
      { parent: parentId },
      { 
        $set: { 
          "stage5_Confirmation.enrollmentFormCompleted": true,
          "stage5_Confirmation.studentProfileCreated": true
        } 
      },
      { new: true }
    ).populate("stage4_ClassesBegin.scheduledClasses.eventId"); // 🚨 Populates the event to get the Google Calendar ID

    // ==========================================
    // 🚨 NEW: GOOGLE CALENDAR INVITATION LOGIC (Using your JWT Auth)
    // ==========================================
    try {
      if (admission?.stage4_ClassesBegin?.scheduledClasses?.length > 0) {
        
        if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
          // 🚨 EXACT SAME AUTH METHOD YOU USED EARLIER
          const auth = new google.auth.JWT({
            email: process.env.GOOGLE_CLIENT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/calendar'],
            subject: 'admin@curiousteamlearning.com'
          });
          const calendar = google.calendar({ version: 'v3', auth }); 

          // Extract unique Google Event IDs
          const googleEventIds = [...new Set(
            admission.stage4_ClassesBegin.scheduledClasses
              .map(cls => cls.eventId?.googleEventId || cls.googleEventId)
              .filter(Boolean)
          )];

          const invitePromises = googleEventIds.map(async (gEventId) => {
            // 1. Fetch current event to preserve existing attendees
            const event = await calendar.events.get({
              calendarId: "primary", 
              eventId: gEventId,
            });

            const currentAttendees = event.data.attendees || [];
            
            // 2. Check if student is already in the list to prevent duplicates
            const alreadyInvited = currentAttendees.some(a => a.email === cleanEmail);
            
            if (!alreadyInvited) {
              currentAttendees.push({ email: cleanEmail });
              
              // 3. Patch the event with the new attendees list
              return calendar.events.patch({
                calendarId: "primary",
                eventId: gEventId,
                sendUpdates: "all", // 🚨 Triggers Google to email the student!
                requestBody: {
                  attendees: currentAttendees,
                },
              });
            }
          });

          await Promise.all(invitePromises);
          console.log(`Successfully synced ${cleanEmail} to Google Calendar events.`);
        }
      }
    } catch (gcalError) {
      console.error("Google Calendar Sync Error (Non-Fatal):", gcalError.message || gcalError);
    }

    // 4. Return Final Success
    return res.status(201).json({ 
      message: existingStudent ? "Existing student account found and securely linked!" : "Student account created and linked successfully.",
      admission 
    });

  } catch (error) {
    console.error("Create/Link Student Error:", error);
    res.status(500).json({ error: "Failed to process student account." });
  }
});

router.put("/api/counselor/complete-stage6/:admissionId", authenticate, async (req, res) => {
    try {
        const { teacherBaselineNotes } = req.body; // 🚨 Extract the notes!
        
        const admission = await Admission.findByIdAndUpdate(req.params.admissionId, 
            { 
              $set: { 
                admissionStage: 7, 
                "stage6_Observation.completedAt": new Date(),
                "stage6_Observation.firstParentReportGenerated": true,
                "stage6_Observation.teacherBaselineNotes": teacherBaselineNotes // 🚨 Save them!
              } 
            },
            { new: true }
        );
        res.status(200).json({ message: "Induction complete! Student is fully enrolled.", admission });
    } catch (error) {
        res.status(500).json({ error: "Failed to complete Stage 6." });
    }
});

module.exports = router;