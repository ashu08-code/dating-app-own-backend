import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Op } from "sequelize";
import db from "../models/index.js";
import sendResponse, { errorResponse } from "../utils/response.js";
import sendEmail from "../utils/sendEmail.js";

import { OAuth2Client } from "google-auth-library" ;

const { Auth, UserProfile } = db;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// helper to generate JWT
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

/**
 * SIGNUP
 */
export const signup = async (req, res) => {
  try {
    const { name, email, contact, password } = req.body;


    // check existing user
    const existingUser = await Auth.findOne({ where: { email } });
    if (existingUser) {
      return sendResponse(res, false, 409, {}, "Email already exists");
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await Auth.create({
      name,
      email,
      contact,
      password: hashedPassword,
    });

    return sendResponse(
      res,
      true,
      201,
      {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      "Signup successful"
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * LOGIN
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // find user
    const user = await Auth.findOne({ where: { email } });
    if (!user) {
      return sendResponse(res, false, 401, {}, "Invalid email or password");
    }

    // compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, false, 401, {}, "Invalid email or password");
    }

    // create token (keep payload minimal)
    const token = generateToken({
      id: user.id,
      role: user.role || "user",
    });

    return sendResponse(
      res,
      true,
      200,
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          contact: user.contact,
        },
      },
      "Login successful"
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * FORGOT PASSWORD
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await Auth.findOne({ where: { email } });
    if (!user) {
      return sendResponse(res, false, 404, {}, "There is no user with that email");
    }

    // Generate OTP
    const otp = user.generateOtp();

    // Save user with OTP info
    await user.save();

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Your OTP is: \n\n ${otp} \n\n It will expire in 10 minutes.`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password Reset OTP",
        message,
      });

      return sendResponse(res, true, 200, {}, "Email sent with OTP");
    } catch (err) {
      console.log(err);
      user.otp = null;
      user.otpExpire = null;
      await user.save();

      return sendResponse(res, false, 500, {}, "Email could not be sent");
    }
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * VERIFY OTP
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await Auth.findOne({
      where: {
        email,
        otp,
        otpExpire: { [Op.gt]: Date.now() },
      },
    });

    if (!user) {
      return sendResponse(res, false, 400, {}, "Invalid OTP or OTP expired");
    }

    // Delete OTP logic to ensure it doesn't stay permanently
    user.otp = null;
    user.otpExpire = null;
    await user.save();

    // Create token so the user can reset the password using this token
    const token = generateToken({
      id: user.id,
      role: user.role || "user",
    });

    return sendResponse(
      res,
      true,
      200,
      { token },
      "OTP Verified Successfully"
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

/**
 * RESET PASSWORD
 */
export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    
    // User is extracted from authenticate middleware
    const userId = req.user.id;
    const user = await Auth.findByPk(userId);

    if (!user) {
      return sendResponse(res, false, 404, {}, "User not found");
    }

    // Set new password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    
    await user.save();

    return sendResponse(res, true, 200, {}, "Password updated successfully");
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
}

/**
 * GOOGLE LOGIN
 */
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await Auth.findOne({ where: { email } });

    if (user) {
      // If user exists but no googleId, link it
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      // Password is not needed for google users, but we made it nullable
      // Contact is nullable too
      user = await Auth.create({
        name,
        email,
        googleId,
        is_active: true,
      });

      // Create profile with picture
      await UserProfile.create({
        userId: user.id,
        photo: picture,
      });
    }

    // Generate JWT
    const authToken = generateToken({
      id: user.id,
      role: user.role || "user",
    });

    return sendResponse(
      res,
      true,
      200,
      {
        token: authToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          contact: user.contact,
          googleId: user.googleId,
          photo: picture,
        },
      },
      "Google login successful"
    );
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
