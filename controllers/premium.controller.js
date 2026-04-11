import db from "../models/index.js";
import sendResponse, { errorResponse } from "../utils/response.js";
import { Op } from "sequelize";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

// Razorpay is initialized directly in the functions to ensure fresh environment variables
const { Subscription } = db;

const PLANS = [
  { 
    id: "1_month", 
    name: "1 Month", 
    price: 39, 
    durationInMonths: 1,
    features: ["See who likes you", "Unlimited likes", "Priority messaging"]
  },
  { 
    id: "3_months", 
    name: "3 Months", 
    price: 99, 
    durationInMonths: 3,
    features: ["See who likes you", "Unlimited likes", "Priority messaging"]
  },
  { 
    id: "6_months", 
    name: "6 Months", 
    price: 179, 
    durationInMonths: 6,
    features: ["See who likes you", "Unlimited likes", "Priority messaging"]
  },
];

/**
 * Handle Order Creation
 */
export const createOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error("CRITICAL: Razorpay keys are missing from environment variables!");
      return sendResponse(res, false, 500, {}, "Payment system configuration error");
    }

    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return sendResponse(res, false, 400, {}, "Invalid Plan");

    const options = {
      amount: Math.round(plan.price * 100), // Ensure it's an integer
      currency: "INR",
      receipt: `ord_${Date.now()}`,
    };

    console.log("Attempting to create Razorpay Order with ID:", planId, "Options:", options);

    // Ensure we use the latest env vars
    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpayInstance.orders.create(options);
    console.log("Razorpay Order Created Successfully:", order.id);
    
    return sendResponse(res, true, 201, { order, key_id: process.env.RAZORPAY_KEY_ID }, "Order created successfully");
  } catch (error) {
    console.error("Razorpay Order Creation Error Full:", error);
    // Extract most useful message
    const errorMessage = error.error?.description || error.message || "Something went wrong while creating order";
    return errorResponse(res, errorMessage, 500);
  }
};

/**
 * Verify Payment and Update Subscription
 */
export const verifyPayment = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
    const userId = req.user.id;

    if (!razorpay_signature) {
       return sendResponse(res, false, 400, {}, "Payment signature missing");
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return sendResponse(res, false, 400, {}, "Invalid Signature");
    }

    const plan = PLANS.find(p => p.id === planId);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.durationInMonths);

    // Expire old ones if any
    await Subscription.update({ status: 'expired' }, { where: { userId, status: 'active' }, transaction: t });

    const newSub = await Subscription.create({
      userId,
      planType: planId,
      amount: plan.price,
      startDate,
      endDate,
      status: "active"
    }, { transaction: t });

    await t.commit();
    return sendResponse(res, true, 200, newSub, "Subscription active now! Enjoy Premium ✨");
  } catch (error) {
    await t.rollback();
    return errorResponse(res, error.message, 500);
  }
};

export const getPlans = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSubscription = await Subscription.findOne({
      where: {
        userId,
        status: "active",
        endDate: { [Op.gt]: new Date() },
      },
    });

    return sendResponse(res, true, 200, {
      plans: PLANS,
      currentSubscription: currentSubscription || null,
    }, "Plans fetched successfully");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

export const getSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentSubscription = await Subscription.findOne({
      where: {
        userId,
        status: "active",
        endDate: { [Op.gt]: new Date() },
      },
    });

    return sendResponse(res, true, 200, {
      subscription: currentSubscription,
    }, "Subscription info fetched");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
