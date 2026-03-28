import { Router } from "express";
import { getPlans, getSubscription, createOrder, verifyPayment } from "../controllers/premium.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

// Get available plans
router.get("/plans", getPlans);

// Get current subscription
router.get("/my-subscription", getSubscription);

// Razorpay Payment Flow
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);

export default router;
