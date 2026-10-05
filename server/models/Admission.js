const mongoose = require("mongoose");

const admissionSchema = new mongoose.Schema({
  // ==========================================
  // 1. CORE RELATIONS & PIPELINE STATE
  // ==========================================
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true // One admission record per parent account
  },

  admissionStage: {
    type: Number,
    default: 1,
    min: 1,
    max: 6
  },

  assignedCounselor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  leadDetails: {
    childAge: { type: Number },
    currentSchooling: { type: String }
  },

  // ==========================================
  // STAGE 1: DISCOVERY CALL
  // ==========================================
  stage1_Discovery: {
    booking: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Booking" 
    },
    counselorSummary: { type: String, default: "" }, 
    completedAt: { type: Date }
  },

  // ==========================================
  // STAGE 2: STUDENT ASSESSMENT 
  // ==========================================
  stage2_Assessment: {
    assessmentRecord: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Assessment" 
    },
    status: { 
      type: String, 
      enum: ["pending", "questionnaire_done", "test_scheduled", "completed"], 
      default: "pending" 
    }
  },

  // ==========================================
  // STAGE 3: PERSONALIZED RECOMMENDATION
  // ==========================================
  stage3_Recommendation: {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
    status: { 
      type: String, 
      enum: ["pending", "call_scheduled", "call_completed", "completed"], 
      default: "pending" 
    },
    callDeadline: { type: Date },

    recommendedPathway: { type: String, default: "" },
    classEquivalent: { type: String, default: "" },
    classDuration: { type: String, default: "" },
    workingPlan: { type: String, default: "" },
    scholarshipPercent: { type: Number, default: 0 },

    suggestedSchedule: { type: String, default: "" },
    recommendedMentor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    presentationNotes: { type: String, default: "" }, 
    
    feePaid: { type: Boolean, default: false },
    transactionRef: { type: String, default: "" },
    
    approvedByParent: { type: Boolean, default: false },
    completedAt: { type: Date }
  },

  // ==========================================
  // STAGE 4: CLASSES BEGIN (5-Day Refund Window)
  // ==========================================
  stage4_ClassesBegin: {
    classesStartDate: { type: Date }, 
    assignedClassroomId: { type: String, default: "" },
    meetLink: { type: String, default: "" },
    
    // 🚨 UPGRADED: Granular 10-Day Tracking
    scheduledClasses: [{
      date: { type: Date },
      startTime: { type: String },
      endTime: { type: String },
      eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" }, // Links directly to Calendar
      status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
      // Individual Reschedule Requests
      rescheduleRequest: {
        isPending: { type: Boolean, default: false },
        reason: { type: String, default: "" },
        requestedDate: { type: Date },
        requestedStartTime: { type: String, default: "" }
      }
    }],
    
    // Parent Preferences
    studentName: { type: String, default: "" },
    preferredStartTime: { type: String, default: "" },
    preferredEndTime: { type: String, default: "" },
    additionalNotes: { type: String, default: "" },
    
    refundWindowEndsAt: { type: Date },
    refundRequested: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "started", "refund_requested", "completed"], default: "pending" }
  },

  // ==========================================
  // STAGE 5: ADMISSION CONFIRMATION
  // ==========================================
  stage5_Confirmation: {
    draftStudentDetails: {
      studentName: { type: String, default: "" },
      studentUsername: { type: String, default: "" },
      studentEmail: { type: String, default: "" },
      studentDob: { type: String, default: "" }
    },
    enrollmentFormCompleted: { type: Boolean, default: false },
    documentsVerified: { type: Boolean, default: false },
    studentProfileCreated: { type: Boolean, default: false },
    internalOnboardingDone: { type: Boolean, default: false },
    confirmedAt: { type: Date }
  },

  // ==========================================
  // STAGE 6: OBSERVATION & FEEDBACK (10 Classes)
  // ==========================================
  stage6_Observation: {
    observationEndDate: { type: Date }, 
    teacherBaselineNotes: { type: String, default: "" }, 
    firstParentReportGenerated: { type: Boolean, default: false },
    completedAt: { type: Date }
  }

}, { timestamps: true });

const Admission = mongoose.models.Admission || mongoose.model("Admission", admissionSchema);
module.exports = Admission;