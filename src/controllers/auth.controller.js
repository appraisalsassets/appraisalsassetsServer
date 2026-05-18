import Admin from "../models/Admin.js";
import AppSettings from "../models/AppSettings.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendEmail } from "../config/mail.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import jwt from "jsonwebtoken";

// --- HELPERS ---

const getRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    // Fix: 'lax' is usually better for local dev to avoid cookie blocking
    sameSite: isProduction ? "none" : "lax", 
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};

const authDebug = (...args) => {
  console.log("[auth-debug]", ...args);
};

const getAccessTokenExpiry = async () => {
  try {
    const settings = await AppSettings.findOne({ singletonKey: "default" }).select(
      "security.sessionTimeoutMinutes",
    ).lean();
    const timeoutMinutes = Number(settings?.security?.sessionTimeoutMinutes);
    if (Number.isFinite(timeoutMinutes) && timeoutMinutes >= 5 && timeoutMinutes <= 1440) {
      return `${timeoutMinutes}m`;
    }
  } catch (error) {
    authDebug("Settings lookup failed:", error.message);
  }
  return process.env.JWT_ACCESS_SECRET_EXPIRY || "15m";
};

// --- CONTROLLERS ---

export const login = async (req, res) => {
  try {
    console.log("[auth-debug] Login attempt:", req.body?.email);
    console.log("[auth-debug] Request body:", JSON.stringify(req.body));
    
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide all fields" });
    }

    // 1. Find admin and explicitly include password
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select("+password");
    
    if (!admin) {
      console.log("[auth-debug] ERROR: Admin not found for email:", email);
      return res.status(401).json({ success: false, message: "Account not found" });
    }

    // 2. Check if verified & active
    authDebug("Admin found:", admin.email);
    authDebug("Admin has password:", !!admin.password);
    authDebug("isEmailVerified:", admin.isEmailVerified);
    authDebug("isActive:", admin.isActive);
    
    if (!admin.isEmailVerified) {
      return res.status(403).json({ success: false, message: "Please verify your email" });
    }
    if (admin.isActive === false) {
      return res.status(403).json({ success: false, message: "Account inactive" });
    }

    // 3. Check password
    authDebug("Comparing password for:", email);
    authDebug("Password provided:", password ? "yes" : "no");
    authDebug("Stored hash:", admin.password ? admin.password.substring(0, 20) + "..." : "missing");
    
    const isMatch = await comparePassword(password, admin.password);
    authDebug("Password match result:", isMatch);
    
    if (!isMatch) {
      console.log("[auth-debug] ERROR: Password mismatch for:", email);
      return res.status(401).json({ success: false, message: "Wrong password" });
    }

    // 4. Generate Tokens - Ensure these don't crash if secrets are missing
    const accessTokenExpiry = await getAccessTokenExpiry();
    
    if(!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
        console.error("CRITICAL ERROR: JWT Secrets missing in .env file");
        return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    const accessToken = generateAccessToken(admin, { expiresIn: accessTokenExpiry });
    const refreshToken = generateRefreshToken(admin);

    admin.refreshToken = refreshToken;
    await admin.save();

    res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    if (
      error.name === "MongoServerSelectionError" ||
      error.name === "MongooseServerSelectionError" ||
      error.message?.includes("buffering timed out")
    ) {
      return res.status(503).json({
        success: false,
        message:
          "Database unavailable. Check MONGO_URI on the server and MongoDB Atlas network access.",
      });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ success: false, message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const admin = await Admin.findById(decoded.id).lean();

    if (!admin) return res.status(401).json({ success: false, message: "Invalid token" });

    return res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        isEmailVerified: admin.isEmailVerified,
        accessLevel: admin.accessLevel || "full",
        permissions: admin.permissions || {
          dashboard: true, properties: true, inquiries: true, blog: true,
          testimonials: true, users: true, content: true, developers: true, settings: true
        },
        isActive: admin.isActive !== false,
      },
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: "Session expired" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const admin = await Admin.findById(decoded.id).select("+refreshToken");

    if (!admin || admin.refreshToken !== token) {
      return res.status(403).json({ success: false, message: "Invalid session" });
    }

    const accessTokenExpiry = await getAccessTokenExpiry();
    const newAccessToken = generateAccessToken(admin, { expiresIn: accessTokenExpiry });
    const newRefreshToken = generateRefreshToken(admin);

    admin.refreshToken = newRefreshToken;
    await admin.save();

    res.cookie("refreshToken", newRefreshToken, getRefreshCookieOptions());

    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Please log in again" });
  }
};

export const forgotPassword = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: "Forgot password is not yet implemented.",
  });
};

export const resetPassword = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: "Reset password is not yet implemented.",
  });
};

export const verifyEmail = async (req, res) => {
  return res.status(501).json({
    success: false,
    message: "Email verification is not yet implemented.",
  });
};

export const logout = async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};
