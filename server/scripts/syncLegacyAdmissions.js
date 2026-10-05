require("dotenv").config();
const mongoose = require("mongoose");

// 🚨 Import your existing DB connection module
// Adjust this relative path if your connection file is located elsewhere (e.g., ../db/conn)
require("../db/conn"); 

// Models
const User = require("../models/userSchema");
const Booking = require("../models/bookingSchema");
const Admission = require("../models/Admission");

const syncLegacyAdmissions = async () => {
  try {
    console.log("Connecting to Database...");

    // Wait for the mongoose connection to be ready
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once("open", resolve));
    }
    
    console.log("Connected successfully! Starting sync...");

    // 1. Fetch all bookings that are not cancelled
    const bookings = await Booking.find({ status: { $ne: "cancelled" } });
    console.log(`Found ${bookings.length} valid bookings to process.`);

    let syncedCount = 0;

    for (const booking of bookings) {
      if (!booking.parent) {
        console.warn(`Skipping Booking ${booking._id}: Missing parent ID.`);
        continue;
      }

      // Determine stage: Completed calls unlock Stage 2; scheduled calls sit in Stage 1
      const defaultStage = booking.status === "completed" ? 2 : 1;

      // Upsert into Admission collection
      await Admission.findOneAndUpdate(
        { parent: booking.parent },
        {
          $set: {
            assignedCounselor: booking.counselor,
            "stage1_Discovery.booking": booking._id,
            ...(booking.status === "completed" && { "stage1_Discovery.completedAt": booking.updatedAt || new Date() })
          },
          $setOnInsert: {
            admissionStage: defaultStage
          }
        },
        { upsert: true, new: true }
      );

      syncedCount++;
    }

    console.log(`✅ Migration Complete! Successfully synced ${syncedCount} admission records.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Sync failed with error:", error);
    process.exit(1);
  }
};

syncLegacyAdmissions();