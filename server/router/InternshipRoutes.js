const express = require("express");
const router = express.Router();
const multer = require("multer");
const { google } = require("googleapis");
const pdfParse = require("pdf-parse");
const { Readable } = require("stream");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Internship = require("../models/InternshipSchema");
const User = require("../models/userSchema");
const authenticate = require("../middleware/authenticate"); 
const OTP = require("../models/otpSchema"); 

const upload = multer({ storage: multer.memoryStorage() });
const jwt = require("jsonwebtoken");
const transporter = require('../utils/transporter'); 
const ProgramIndex = require("../models/ProgramIndex");
const { approvalEmailTemplate, rejectionEmailTemplate, generateOfferLetterPdf, generateCertificatePdf, completionEmailTemplate } = require('../utils/InternshipTemplates');

const pdfmake = require('pdfmake');

const fonts = {
  // Native font (No TTF needed)
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  },
  // Your Custom Cursive Font
  SegoePrint: {
    normal: path.join(__dirname, '..', 'fonts', 'segoepr.ttf'),
    bold: path.join(__dirname, '..', 'fonts', 'segoeprb.ttf'),
    italics: path.join(__dirname, '..', 'fonts', 'segoepr.ttf'), 
    bolditalics: path.join(__dirname, '..', 'fonts', 'segoeprb.ttf') 
  },
  ArialRoundedMTBold: {
    normal: path.join(__dirname,'..', 'fonts', 'ARLRDBD.TTF'),
    bold: path.join(__dirname, '..', 'fonts', 'ARLRDBD.TTF'), 
    italics: path.join(__dirname, '..', 'fonts', 'ARLRDBD.TTF'),
    bolditalics: path.join(__dirname, '..', 'fonts', 'ARLRDBD.TTF')
  },
  Inter: {
    normal: path.join(__dirname, '..', 'fonts', 'Inter_18pt-Regular.ttf'),
    bold: path.join(__dirname, '..', 'fonts', 'Inter_18pt-Bold.ttf'),
    italics: path.join(__dirname, '..', 'fonts', 'Inter_18pt-Italic.ttf'),
    bolditalics: path.join(__dirname, '..', 'fonts', 'Inter_18pt-BoldItalic.ttf')
  }
};

pdfmake.addFonts(fonts);

const getPdfBase64 = async (docDefinition) => {
  docDefinition.defaultStyle = docDefinition.defaultStyle || {};
  docDefinition.defaultStyle.font = 'Helvetica';
  
  // Pass the security policies directly into the options to silence the warnings!
  const options = {
    urlAccessPolicy: { enableAll: true },
    localAccessPolicy: { enableAll: true }
  };
  
  return await pdfmake.createPdf(docDefinition, options).getBase64();
};

// 2. Initialize Google APIs (Using your JWT Workspace Setup)
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive'],
  subject: 'admin@curiousteamlearning.com'
});
const drive = google.drive({ version: "v3", auth });

// 3. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const resumeSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, description: "Candidate's full name" },
    email: { type: SchemaType.STRING, description: "Candidate's email address" },
    phone: { type: SchemaType.STRING, description: "10-digit mobile number" }
  },
  required: ["name", "email", "phone"]
};

// ==========================================
// STEP 1: Upload to Drive & Parse with AI
// ==========================================
router.post("/parse-resume", upload.single("resume"), async (req, res) => {
  console.log("=== STARTING RESUME UPLOAD FLOW ===");
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

    // 1. Parse PDF Text
    const pdfData = await pdfParse(req.file.buffer);

    // 2. Extract Details with Gemini AI
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: resumeSchema,
      },
    });

    const prompt = `Extract candidate details from this resume text. If you cannot find a phone or email, return an empty string for that field.\n\n${pdfData.text}`;
    const result = await model.generateContent(prompt);
    const extractedData = JSON.parse(result.response.text());

    // ==========================================
    // 🚨 EXTRACT USER ID FROM TOKEN (IF IT EXISTS)
    // ==========================================
    let userId = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        userId = decoded._id; // Get the user ID from the token
      } catch (err) {
        console.log("Invalid token provided, treating as public user.", err.message);
      }
    }

    // ==========================================
    // 🚨 SECURITY GATE: Check Auth BEFORE Drive
    // ==========================================
    if (!userId) {
      const existingUser = await User.findOne({ email: extractedData.email.toLowerCase() });
      
      if (existingUser) {
        // User exists but isn't logged in! Halt and trigger OTP.
        return res.status(200).json({ 
          requireOtp: true, 
          email: extractedData.email,
          extractedData 
        });
      }
    }

    // ==========================================
    // 🚨 APPLICATION STATE & COOLDOWN ENFORCEMENT
    // ==========================================
    if (userId) {
      const lastApp = await Internship.findOne({ user_id: userId }).sort({ createdAt: -1 });
      
      if (lastApp) {
        if (lastApp.status === 'rejected') {
          // 30-day rejection cooldown
          const rejectionDate = new Date(lastApp.updatedAt);
          const diffDays = Math.ceil(Math.abs(new Date() - rejectionDate) / (1000 * 60 * 60 * 24)); 
          
          if (diffDays < 30) {
            return res.status(403).json({ error: `You are in a cooldown period. Please wait ${30 - diffDays} more days before re-applying.` });
          }
        } else if (lastApp.status === 'completed') {
          // 🌟 NEW: 15-day completion cooldown (Give them time to breathe!)
          const completionDate = new Date(lastApp.updatedAt);
          const diffDays = Math.ceil(Math.abs(new Date() - completionDate) / (1000 * 60 * 60 * 24)); 
          
          if (diffDays < 0) {   // Change this to number of days of cooldown you want (e.g., 15 days)
            return res.status(403).json({ error: `You just completed a program! Take a break. You can apply for a new one in ${15 - diffDays} days.` });
          }
          // If they pass the 15 days, it falls through and creates a brand new 'draft'!
          
        } else if (lastApp.status !== 'draft') {
          // 🚨 They have an active application (pending, approved, feedback_submitted)!
          return res.status(400).json({ 
            error: `Welcome back! You already have an active ${lastApp.status.replace('_', ' ')} application. Redirecting you to your portal...`,
            existingStatus: lastApp.status
          });
        }
      }
    }

    // ==========================================
    // 🚀 DRIVE UPLOAD (Happens for Logged In OR Brand New Users)
    // ==========================================
    const fileName = extractedData.name ? `${extractedData.name.trim()}.pdf` : `Resume_${Date.now()}.pdf`;

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    const driveResponse = await drive.files.create({
      requestBody: { name: fileName, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] },
      media: { mimeType: "application/pdf", body: bufferStream },
      fields: "id, webViewLink",
    });
    
    // ==========================================
    // 💾 SAVE DRAFT (Matches your exact Schema)
    // ==========================================
    if (userId) {
      await Internship.findOneAndUpdate(
        { user_id: userId, status: 'draft' },
        {
          user_id: userId,
          status: 'draft',
          resumeDriveId: driveResponse.data.id,
          resumeDriveLink: driveResponse.data.webViewLink,
          personalDetails: {
            name: extractedData.name ? extractedData.name.trim() : "",
            email: extractedData.email || "",
            phone: extractedData.phone || "",
          }
        },
        { upsert: true, new: true }
      );
    }

    // 5. Return data to Frontend
    res.status(200).json({
      success: true,
      extractedData,
      driveId: driveResponse.data.id,
      driveLink: driveResponse.data.webViewLink
    });

  } catch (error) {
    console.error("🚨 OVERALL CATCH ERROR:", error);
    res.status(500).json({ error: "Failed to process resume." });
  }
});

// ==========================================
// STEP 2: Verify Details & Submit Application
// ==========================================
router.post("/submit-application", async (req, res) => {
  try {
    const { formData, driveId, driveLink } = req.body;
    let userId = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        userId = decoded._id;
      } catch (err) {
        console.log("Invalid token during submission.");
      }
    }

    // 🚨 IF NO USER: Stop the process and tell frontend to verify them!
    if (!userId) {
      const existingUser = await User.findOne({ email: formData.email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: "This email is already registered. Please refresh the page to log in." });
      }
      return res.status(200).json({ requireNewUserSetup: true, email: formData.email });
    }

    // 3. Save the actual Internship Application to the database
    const application = await Internship.findOneAndUpdate(
      { user_id: userId, status: 'draft' },
      {
        user_id: userId,
        status: 'pending', // Move it out of draft status!
        resumeDriveId: driveId,
        resumeDriveLink: driveLink,
        personalDetails: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          sameAsWhatsapp: formData.sameAsWhatsapp
        },
        programDetails: {
          intent: formData.intent,
          type: formData.type,
          topic: formData.topic,
          startDate: formData.startDate,
          endDate: formData.endDate,
          durationDays: formData.days, // Mapped 'days' to 'durationDays'
          price: formData.price,
          mode: formData.mode || "Remote",
          offerLetterDate: formData.offerLetterDate ? formData.offerLetterDate : null
        }
      },
      { upsert: true, new: true }
    );

    // 4. Send success + the token (if a new account was made)
    res.status(200).json({ 
      success: true, 
      applicationId: application._id
    });

  } catch (error) {
    console.error("🚨 Submit App Error:", error);
    res.status(500).json({ error: "Failed to submit application." });
  }
});

// ==========================================
// VERIFY NEW USER, SET PASSWORD, & SUBMIT APP
// ==========================================
router.post("/verify-new-user-submit", async (req, res) => {
  try {
    const { formData, driveId, driveLink, otp, password } = req.body;
    const email = formData.email.toLowerCase();

    // 1. Verify OTP
    const record = await OTP.findOne({ email });
    if (!record || record.otp !== otp.toString()) {
      return res.status(401).json({ error: "Invalid or expired OTP." });
    }

    // 2. OTP is valid! Delete it.
    await OTP.deleteMany({ email });

    // 3. Auto-generate a unique username (they can change it later)
    const baseUsername = email.split('@')[0];
    const autoUsername = `${baseUsername}${Math.floor(Math.random() * 1000)}`;

    // 4. Create the User (Your pre-save hook will automatically hash this password!)
    const newUser = new User({
      name: formData.name,
      email: email,
      phone: formData.phone,
      username: autoUsername,
      password: password, 
      role: "Student", // Or whatever default role you want
    });
    await newUser.save();

    // 5. Generate JWT (Matching your /register route exact payload)
    const token = jwt.sign(
      { _id: newUser._id, username: newUser.username, role: newUser.role, isAdmin: newUser.isAdmin },
      process.env.TOKEN_SECRET,
      { expiresIn: "14d" }
    );

    // 6. Create the Internship Application
    const application = await Internship.create({
      user_id: newUser._id,
      status: 'pending',
      resumeDriveId: driveId,
      resumeDriveLink: driveLink,
      personalDetails: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        sameAsWhatsapp: formData.sameAsWhatsapp
      },
      programDetails: {
        intent: formData.intent,
        type: formData.type,
        topic: formData.topic,
        startDate: formData.startDate,
        endDate: formData.endDate,
        durationDays: formData.days,
        price: formData.price,
        mode: formData.mode || "Remote",
        offerLetterDate: formData.offerLetterDate ? formData.offerLetterDate : null
      }
    });

    res.status(200).json({ 
      success: true, 
      applicationId: application._id,
      token: token,
      user: { username: newUser.username }
    });

  } catch (error) {
    console.error("🚨 New User Setup Error:", error);
    res.status(500).json({ error: "Failed to create account and submit." });
  }
});


// ==========================================
// STEP 3: Submit Completion Feedback
// ==========================================
router.post("/submit-feedback/:id", authenticate, async (req, res) => {
  try {
    const application = await Internship.findOne({ _id: req.params.id, user_id: req.userId });
    
    if (!application || application.status !== "approved") {
      return res.status(400).json({ error: "Invalid application state for feedback." });
    }

    application.feedback = req.body.feedback;
    await application.save();

    res.status(200).json({ message: "Feedback saved successfully!" });

  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({ error: "Failed to submit feedback." });
  }
});

// ==========================================
// STEP 4: Confirm Details & Request Certificate
// ==========================================
router.post("/request-certificate/:id", authenticate, async (req, res) => {
  try {
    const application = await Internship.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId, status: "approved" },
      { status: "feedback_submitted" }, // 🚨 Triggers Admin 'Certify' button!
      { new: true }
    );

    if (!application) {
      return res.status(400).json({ error: "Unable to request certificate." });
    }

    res.status(200).json({ message: "Certificate requested! Sent to admin for approval." });

  } catch (error) {
    console.error("Request Certificate Error:", error);
    res.status(500).json({ error: "Failed to request certificate." });
  }
});

// ==========================================
// GET APPLICATION STATUS
// ==========================================
router.get("/status", async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;

    // Decode token securely
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        userId = decoded._id;
      } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    if (!userId) {
      return res.status(200).json({ status: "new" });
    }

    const lastApp = await Internship.findOne({ user_id: userId }).sort({ createdAt: -1 });

    if (!lastApp || (lastApp.status === "completed" && lastApp.isAcknowledged)) {
      return res.status(200).json({ status: "new" });
    }

    // Return the status and data so frontend knows exactly which step to show
    res.status(200).json({
      status: lastApp.status,
      applicationId: lastApp._id,
      savedData: lastApp
    });

  } catch (error) {
    console.error("Status fetch error:", error);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

// ==========================================
// ADMIN: APPROVE & SEND OFFER LETTER (WITH PDF)
// ==========================================
router.post("/admin/approve/:id", authenticate, async (req, res) => {
  try {
    // 1. Fetch first, DO NOT update status yet!
    const app = await Internship.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found." });

    // 2. Generate the PDF Offer Letter
    const docDefinition = await generateOfferLetterPdf(app);
    const pdfBase64 = await getPdfBase64(docDefinition);

    // 3. Send the Email with Attachment
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: app.personalDetails.email,
      subject: `Offer Letter: ${app.programDetails.topic} at Curious Team Learning 🚀`,
      html: approvalEmailTemplate(app.personalDetails.name, app.programDetails.topic, app.programDetails.type),
      attachments: [{
        filename: `Offer_Letter_${app.personalDetails.name.replace(/\s+/g, '_')}.pdf`,
        content: pdfBase64,
        encoding: 'base64'
      }]
    });

    // 4. IF AND ONLY IF PDF and Email succeed, update the database!
    app.status = "approved";
    await app.save();

    res.status(200).json({ message: "Approved and Offer Letter PDF sent!", application: app });
  } catch (error) {
    console.error("🚨 Admin Approve Error:", error);
    res.status(500).json({ error: "Failed to approve application. Database was NOT changed." });
  }
});

// ==========================================
// ADMIN: COMPLETE & SEND CERTIFICATE
// ==========================================
router.post("/admin/complete/:id", authenticate, async (req, res) => {
  try {
    const { grade, rollNo, programCode, projectTitle, projectDescription, barcodeStr } = req.body;
    
    // 1. Fetch Application (DO NOT UPDATE YET)
    const app = await Internship.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found." });

    // 2. Inject completion details temporarily into memory for PDF generation
    app.completionDetails = { grade, rollNo, programCode, projectTitle, projectDescription, barcodeStr };

    // 3. Build PDF (Base64) - If this crashes, the catch block triggers and DB is safe!
    const docDefinition = await generateCertificatePdf(app);
    const pdfBase64 = await getPdfBase64(docDefinition);

    // 4. Email it out - If SMTP fails, catch block triggers and DB is safe!
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: app.personalDetails.email,
      subject: `Your Certificate of Completion: ${app.programDetails.topic}`,
      html: completionEmailTemplate(app),
      attachments: [{
        filename: `${app.personalDetails.name.replace(/\s+/g, '_')}_Certificate.pdf`,
        content: pdfBase64,
        encoding: 'base64'
      }]
    });

    // 5. SUCCESS! Everything worked. Now save it to the database permanently.
    app.status = "completed";
    await app.save();

    res.status(200).json({ message: "Certificate generated & sent successfully!", application: app });
  } catch (error) {
    console.error("🚨 Admin Complete Error:", error);
    res.status(500).json({ error: "Failed to process completion. Database was NOT changed." });
  }
});

// ==========================================
// ADMIN: REJECT & SEND NOTIFICATION
// ==========================================
router.post("/admin/reject/:id", authenticate, async (req, res) => {
  try {
    const { reason } = req.body; // 🚨 Capture the custom reason!

    const app = await Internship.findByIdAndUpdate(
      req.params.id,
      { 
        status: "rejected",
        rejectionDate: new Date() // Triggers the 30-day cooldown
      },
      { new: true }
    );

    if (!app) return res.status(404).json({ error: "Application not found." });

    // Send Rejection Email WITH the custom reason parameter
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: app.personalDetails.email,
      subject: "Update on your Curious Team Learning Application",
      html: rejectionEmailTemplate(app.personalDetails.name, app.programDetails.topic, reason)
    });

    res.status(200).json({ message: "Rejected and email sent.", application: app });
  } catch (error) {
    console.error("🚨 Admin Reject Error:", error);
    res.status(500).json({ error: "Failed to reject application." });
  }
});

// ==========================================
// ADMIN: FETCH ALL APPLICATIONS
// ==========================================
router.get("/admin/all", authenticate, async (req, res) => {
  try {
    // Optionally: check if req.headers.authorization contains a valid admin token here
    
    // Find all applications and sort by newest first
    const applications = await Internship.find().sort({ createdAt: -1 });

    res.status(200).json(applications);
  } catch (error) {
    console.error("🚨 Admin Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch applications." });
  }
});

// ==========================================
// ADMIN: FETCH PROGRAM INDEXES
// ==========================================
router.get("/admin/program-indexes", authenticate, async (req, res) => {
  try {
    const indexes = await ProgramIndex.find().sort({ type: 1, code: 1 });
    res.status(200).json(indexes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch program indexes." });
  }
});

// ==========================================
// ADMIN: CREATE NEW PROGRAM INDEX
// ==========================================
router.post("/admin/program-indexes", authenticate, async (req, res) => {
  try {
    const { topic, type, code } = req.body;
    
    // Check if code already exists
    const exists = await ProgramIndex.findOne({ code });
    if (exists) return res.status(400).json({ error: "Code already exists!" });

    const newIndex = await ProgramIndex.create({ topic, type, code });
    res.status(201).json(newIndex);
  } catch (error) {
    res.status(500).json({ error: "Failed to create program index." });
  }
});

// ==========================================
// ADMIN: UPDATE PRINT STATUS
// ==========================================
router.put("/admin/update-print-status/:id", authenticate, async (req, res) => {
  try {
    const { printStatus } = req.body; // Expecting the exact string from frontend

    const app = await Internship.findByIdAndUpdate(
      req.params.id,
      { printStatus: printStatus },
      { new: true }
    );

    if (!app) return res.status(404).json({ error: "Application not found." });

    res.status(200).json({ message: `Status updated to ${printStatus}`, printStatus: app.printStatus });
  } catch (error) {
    console.error("🚨 Admin Print Status Error:", error);
    res.status(500).json({ error: "Failed to update print status." });
  }
});

// ==========================================
// STUDENT: ACKNOWLEDGE COMPLETED CERTIFICATE
// ==========================================
router.post("/acknowledge-certificate/:id", authenticate, async (req, res) => {
  try {
    await Internship.findOneAndUpdate(
      { _id: req.params.id, user_id: req.userId },
      { isAcknowledged: true }
    );
    res.status(200).json({ message: "Certificate acknowledged." });
  } catch (error) {
    res.status(500).json({ error: "Failed to acknowledge." });
  }
});


// router.post("/admin/import-excel", upload.single("excelFile"), async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: "No file uploaded." });

//     // 1. WIPE THE EXISTING DATABASE (Clean Slate)
//     await Internship.deleteMany({});
//     await ProgramIndex.deleteMany({});
//     console.log("🧹 Database wiped successfully.");

//     // 2. Load Workbook using ExcelJS
//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.load(req.file.buffer);

//     let indexesAdded = 0;
//     let studentsAdded = 0;
//     let usersMatched = 0; // Keep track of how many users we successfully linked!

//     const getCellValue = (row, colIndex) => {
//       if (!colIndex) return "";
//       const cell = row.getCell(colIndex);
//       if (!cell || cell.value === null) return "";
//       if (typeof cell.value === 'object' && cell.value.result !== undefined) {
//         return cell.value.result;
//       }
//       return cell.value;
//     };

//     // 3. Process Indexes
//     const indexSheets = ['Internship Index', 'Training Index'];
//     for (const sheetName of indexSheets) {
//       const sheet = workbook.getWorksheet(sheetName);
//       if (sheet) {
//         let headers = {};
//         sheet.getRow(1).eachCell((cell, colNum) => {
//           headers[cell.value.toString().trim()] = colNum;
//         });

//         const indexPromises = [];
//         sheet.eachRow((row, rowNumber) => {
//           if (rowNumber === 1) return;
//           const code = getCellValue(row, headers['Code']);
//           const topic = getCellValue(row, headers['Certified Program']);
//           const category = getCellValue(row, headers['Category']);

//           if (code && topic && category) {
//             indexPromises.push(
//               ProgramIndex.create({ code: String(code).trim(), topic: String(topic).trim(), type: String(category).trim() })
//             );
//             indexesAdded++;
//           }
//         });
//         await Promise.all(indexPromises);
//       }
//     }

//     // 4. Process Students
//     const studentSheet = workbook.getWorksheet('Students');
//     if (studentSheet) {
//       let headers = {};
//       studentSheet.getRow(1).eachCell((cell, colNum) => {
//         const headerText = cell.value.toString().replace(/\n/g, '').trim();
//         headers[headerText] = colNum;
//       });

//       const colSno = headers['S. No.'];
//       const colName = headers['Student Name'];
//       const colEmail = headers['E-mail'];
//       const colCategory = headers['Category'];
//       const colProgram = headers['Program'];
//       const colCode = headers['Code'];
//       const colStart = headers['Start Date'];
//       const colEnd = headers['End Date'];
//       const colDuration = headers['Duration (In Days)'];
//       const colProject = headers['Project /  Task'] || headers['Project / Task'];
//       const colDesc = headers['Description'];
//       const colGrade = headers['Grade'];
//       const colCertCode = headers['Certificate Code'];
//       const colStatus = headers['Status'];

//       // Extract all valid rows first so we can use async/await
//       const rowsToProcess = [];
//       studentSheet.eachRow((row, rowNumber) => {
//         if (rowNumber > 1 && getCellValue(row, colName)) {
//           rowsToProcess.push(row);
//         }
//       });

//       const internshipPromises = [];

//       // Loop through sequentially to query the User database
//       for (const row of rowsToProcess) {
//         const studentName = getCellValue(row, colName);
//         const rollNo = getCellValue(row, colSno);
        
//         let email = getCellValue(row, colEmail);
//         if (!email || typeof email !== 'string' || email.trim() === "") {
//           email = `student${rollNo}@curiousteam.com`;
//         } else {
//           email = email.trim();
//         }

//         // 🚨 NEW: Find the User by Email
//         const existingUser = await User.findOne({ email: email });
//         let assignedUserId = "000000000000000000000000"; // Fallback Dummy ID
        
//         if (existingUser) {
//           assignedUserId = existingUser._id;
//           usersMatched++;
//         }

//         const statusVal = String(getCellValue(row, colStatus)).toLowerCase();
//         let printStatus = "Not Printed";
//         if (statusVal.includes('given')) printStatus = "Given";
//         else if (statusVal.includes('print')) printStatus = "Printed";

//         let startDate = getCellValue(row, colStart);
//         let endDate = getCellValue(row, colEnd);
//         if (!(startDate instanceof Date)) startDate = new Date();
//         if (!(endDate instanceof Date)) endDate = new Date();

//         internshipPromises.push(
//           Internship.create({
//             // Pass the matched real User ID, or the dummy one
//             user_id: assignedUserId, 
//             resumeDriveLink: "IMPORTED_FROM_EXCEL", 
//             resumeDriveId: "IMPORTED_FROM_EXCEL",

//             status: "completed",
//             step: 5,
//             printStatus: printStatus,
//             personalDetails: {
//               name: String(studentName).trim(),
//               email: email,
//               phone: "N/A"
//             },
//             programDetails: {
//               type: String(getCellValue(row, colProgram)).trim().toLowerCase(), // Prevents enum crash!
//               topic: String(getCellValue(row, colCategory)).trim(),
//               durationDays: parseInt(getCellValue(row, colDuration)) || 0,
//               startDate: startDate,
//               endDate: endDate
//             },
//             completionDetails: {
//               rollNo: String(rollNo).trim(),
//               programCode: String(getCellValue(row, colCode)).trim(),
//               projectTitle: String(getCellValue(row, colProject) || "").trim(),
//               projectDescription: String(getCellValue(row, colDesc) || "").trim(),
//               grade: String(getCellValue(row, colGrade) || "A").trim(),
//               barcodeStr: String(getCellValue(row, colCertCode)).trim() 
//             }
//           })
//         );
//         studentsAdded++;
//       }

//       await Promise.all(internshipPromises);
//     }

//     res.status(200).json({ 
//       message: "Database Wiped & Excel Imported Successfully! ✅", 
//       indexesProcessed: indexesAdded, 
//       studentsProcessed: studentsAdded,
//       usersSuccessfullyLinked: usersMatched // Tells you how many existing users it found!
//     });

//   } catch (error) {
//     console.error("🚨 Excel Import Error:", error);
//     res.status(500).json({ error: "Failed to import Excel data. Check backend console." });
//   }
// });

module.exports = router;