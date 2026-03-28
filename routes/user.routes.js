import { Router } from "express";
import { getProfile, updateProfile, getRecommendations, getPublicProfile, getStatus } from "../controllers/user.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import validate from "../middlewares/validation.middleware.js";
import { profileSchema } from "../validations/user.validation.js";

const router = Router();

// Protect all routes
router.use(authenticate);

router.get("/profile", getProfile);
router.get("/profile/:id", getPublicProfile);
router.get("/recommendations", getRecommendations);
router.get("/status/:userId", getStatus);

// Update profile with image upload support and validation
// Note: Multer middleware must run BEFORE validation middleware because it parses the form-data body.
router.post("/profile", upload.single("photo"), validate(profileSchema), updateProfile);
router.put("/profile", upload.single("photo"), validate(profileSchema), updateProfile); // Support PUT as well

export default router;
