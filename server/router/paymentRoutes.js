require("dotenv").config();
const express = require("express");
const router = express.Router();

const User = require("../models/userSchema");
const Order = require("../models/orderSchema");
const Admission = require("../models/Admission"); 
const HomeschoolPlan = require("../models/HomeschoolPlan"); // 🚨 Added Plan Database
const authenticate = require("../middleware/authenticate");
const sendAutoNotification = require("../utils/notify"); 

const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest
} = require("phonepe-pg-sdk-node");

const phonepeClient = StandardCheckoutClient.getInstance(
  process.env.PHONEPE_CLIENT_ID,
  process.env.PHONEPE_CLIENT_SECRET,
  Number(process.env.PHONEPE_CLIENT_VERSION),
  process.env.PHONEPE_ENV === 'PROD' ? Env.PRODUCTION : Env.SANDBOX
);

// ==========================
// 1. GET ACTIVE PLAN (For React UI Calculation)
// ==========================
router.get("/active-plan", async (req, res) => {
  try {
    let plan = await HomeschoolPlan.findOne({ isActive: true });
    
    // Auto-seed the database if this is the first time running it
    if (!plan) {
      plan = await HomeschoolPlan.create({ 
        planName: "Complete Homeschooling Program", 
        baseYearlyFee: 700000 
      });
    }
    
    res.status(200).json({ success: true, plan });
  } catch (error) {
    console.error("Fetch Plan Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch active plan" });
  }
});

// ==========================
// 2. CREATE PAYMENT ORDER (Dynamic DB Pricing)
// ==========================
router.post("/create-order", authenticate, async (req, res) => {
  try {
    const { billingCycle } = req.body; 
    
    const admission = await Admission.findOne({ parent: req.user._id });
    if (!admission || admission.admissionStage !== 3) {
      return res.status(400).json({ success: false, message: "Invalid admission stage." });
    }

    // 🚨 Fetch Live Price from Database
    const planConfig = await HomeschoolPlan.findOne({ isActive: true });
    const BASE_YEARLY_FEE = planConfig ? planConfig.baseYearlyFee : 700000;

    const scholarship = admission.stage3_Recommendation.scholarshipPercent || 0;
    const finalMonthlyFee = Math.round((BASE_YEARLY_FEE * (1 - scholarship / 100)) / 12);
    
    let finalAmountToCharge = 0;
    let planIdString = "";

    if (billingCycle === "monthly") {
      finalAmountToCharge = finalMonthlyFee;
      planIdString = "ADMISSION_MONTHLY";
    } else {
      finalAmountToCharge = finalMonthlyFee * 10; 
      planIdString = "ADMISSION_YEARLY";
    }

    const merchantOrderId = "ORDER_" + Date.now();

    const newOrder = new Order({
      orderId: merchantOrderId,
      userId: req.user._id, 
      planId: planIdString,
      amount: finalAmountToCharge,
      studentName: req.user.name, 
      email: req.user.email,             
      phone: req.user.phone,             
      whatsapp: req.user.phone,       
      status: "PENDING"
    });
    await newOrder.save();

    const payRequest = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(finalAmountToCharge * 100) 
      .redirectUrl(`${process.env.FRONTEND_URL}/payment-status?id=${merchantOrderId}`)
      .message(`Enrollment: ${planIdString}`)
      .build();

    const response = await phonepeClient.pay(payRequest);

    res.status(200).json({
      success: true,
      redirectUrl: response.redirectUrl,
      orderId: merchantOrderId
    });

  } catch (error) {
    console.error("Payment Initialization Error:", error);
    res.status(500).json({ success: false, message: "Payment Initialization Failed" });
  }
});

// ==========================
// 3. CHECK STATUS & ADVANCE PIPELINE
// ==========================
router.get("/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const statusResponse = await phonepeClient.getOrderStatus(orderId);
    const order = await Order.findOne({ orderId: orderId });

    if (order && order.status === "PENDING") {
      if (statusResponse.state === "COMPLETED") {
        order.status = "SUCCESS";
        
        const dataObj = statusResponse.data || statusResponse || {};
        const pDetails = dataObj.paymentDetails && dataObj.paymentDetails.length > 0 ? dataObj.paymentDetails[0] : {};
        const splitInst = pDetails.splitInstruments && pDetails.splitInstruments.length > 0 ? pDetails.splitInstruments[0] : {};
        const rail = splitInst.rail || {};
        const instrument = splitInst.instrument || dataObj.paymentInstrument || {};

        order.phonepeOrderId = dataObj.orderId || "N/A";
        order.phonepeTransactionId = pDetails.transactionId || dataObj.transactionId || "N/A";
        order.paymentMode = pDetails.paymentMode || instrument.type || "UNKNOWN";
        order.paymentInstrumentType = rail.type || instrument.type || "UNKNOWN";
        order.vpa = rail.vpa !== "<vpa>" ? rail.vpa : "N/A";
        order.accountType = instrument.accountType || "N/A";
        order.ifsc = instrument.ifsc || "N/A";
        
        let extractedUtr = rail.utr || rail.bankTransactionId || instrument.utr || instrument.bankTransactionId || order.phonepeTransactionId;
        order.bankReference = extractedUtr;

        await order.save();

        // Advance to Stage 4
        const updatedAdmission = await Admission.findOneAndUpdate(
          { parent: order.userId },
          {
            $set: {
              admissionStage: 4,
              "stage3_Recommendation.feePaid": true,
              "stage3_Recommendation.transactionRef": order.orderId,
              "stage3_Recommendation.approvedByParent": true,
              "stage3_Recommendation.completedAt": new Date(),
              "stage4_ClassesBegin.status": "pending",
            }
          },
          { new: true }
        );

        if (updatedAdmission && updatedAdmission.assignedCounselor && req.app && req.app.get("io")) {
            await sendAutoNotification(
              req.app, updatedAdmission.assignedCounselor, 
              `🎉 Payment Received! ${order.studentName} has enrolled and entered Stage 4.`, 
              "admissions-desk", "System"
            );
        }

      } else if (statusResponse.state === "FAILED") {
        order.status = "FAILED";
        await order.save();
      }
    }

    res.json({ success: true, state: statusResponse.state || order.status, order });
  } catch (error) {
    console.error("Status Check Error:", error);
    res.status(500).json({ success: false, message: "Status Check Failed" });
  }
});

// ==========================
// 4. WEBHOOK (Bulletproof Background Fallback)
// ==========================
router.post("/webhook", async (req, res) => {
  try {
    const payloadBase64 = req.body.response; 
    let payload;

    if (payloadBase64) {
        const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        payload = JSON.parse(decodedPayload).data || JSON.parse(decodedPayload).payload;
    } else {
        payload = req.body.payload || req.body;
    }

    if (!payload || !payload.merchantOrderId) return res.status(400).send("Invalid Payload");

    const order = await Order.findOne({ orderId: payload.merchantOrderId });

    if (order && order.status === "PENDING") {
      if (payload.state === "COMPLETED" || payload.code === "PAYMENT_SUCCESS") {
        order.status = "SUCCESS";
        
        order.phonepeOrderId = payload.orderId || "N/A";
        const pDetails = payload.paymentDetails && payload.paymentDetails.length > 0 ? payload.paymentDetails[0] : {};
        order.paymentMode = pDetails.paymentMode || "UNKNOWN";
        order.phonepeTransactionId = pDetails.transactionId || payload.transactionId || "N/A";

        const splitInst = pDetails.splitInstruments && pDetails.splitInstruments.length > 0 ? pDetails.splitInstruments[0] : {};
        const rail = splitInst.rail || {};
        const instrument = splitInst.instrument || {};

        order.paymentInstrumentType = rail.type || instrument.type || "UNKNOWN";
        order.vpa = rail.vpa !== "<vpa>" ? rail.vpa : "N/A";
        order.accountType = instrument.accountType || "N/A";
        order.ifsc = instrument.ifsc || "N/A";

        let extractedUtr = rail.utr || rail.bankTransactionId || instrument.bankTransactionId || "N/A";
        if (extractedUtr === "<utr>") extractedUtr = order.phonepeTransactionId; 
        order.bankReference = extractedUtr;

        await order.save();

        const updatedAdmission = await Admission.findOneAndUpdate(
          { parent: order.userId },
          {
            $set: {
              admissionStage: 4,
              "stage3_Recommendation.feePaid": true,
              "stage3_Recommendation.transactionRef": order.orderId,
              "stage3_Recommendation.approvedByParent": true,
              "stage3_Recommendation.completedAt": new Date(),
              "stage4_ClassesBegin.status": "pending",
              "stage4_ClassesBegin.refundWindowEndsAt": new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000) 
            }
          },
          { new: true }
        );

        if (updatedAdmission && updatedAdmission.assignedCounselor && req.app && req.app.get("io")) {
            await sendAutoNotification(
              req.app, updatedAdmission.assignedCounselor, 
              `🎉 Payment Received (Background Sync)! ${order.studentName} has enrolled and entered Stage 4.`, 
              "admissions-desk", "System"
            );
        }
      } else {
        order.status = "FAILED";
        await order.save();
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Webhook Processing Error");
  }
});

// ==========================
// 5. GET ALL PAYMENTS (Admin Dashboard)
// ==========================
router.get("/all-payments", async (req, res) => {
  try {
    const payments = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email');
    res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
});

module.exports = router;