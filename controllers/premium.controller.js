import db from "../models/index.js";
import sendResponse, { errorResponse } from "../utils/response.js";
import { Op } from "sequelize";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const { Subscription } = db;

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_placeholder",
});

console.log(process.env.RAZORPAY_KEY_ID,process.env.RAZORPAY_KEY_SECRET)

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
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return sendResponse(res, false, 400, {}, "Invalid Plan");

    const options = {
      amount: plan.price * 100, // In paise
      currency: "INR",
      receipt: `receipt_${req.user.id}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    return sendResponse(res, true, 201, { order, key_id: process.env.RAZORPAY_KEY_ID }, "Order created successfully");
  } catch (error) {
    return errorResponse(res, error.message, 500);
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
