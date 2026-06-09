import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { fileURLToPath } from "url";
import "./src/config/google.js";
import authRoutes from "./src/routes/auth.routes.js";
import propertyRoutes from "./src/routes/property.routes.js";
import dashboardRoutes from "./src/routes/dashboard.routes.js";
import testimonialRoutes from "./src/routes/testimonial.routes.js";
import inquiryRoutes from "./src/routes/inquiry.routes.js";
import blogRoutes from "./src/routes/blog.routes.js";
import contentRoutes from "./src/routes/content.routes.js";
import subscriberRoutes from "./src/routes/subscriber.routes.js";
import developerRoutes from "./src/routes/developer.routes.js";
import trustedPartnerRoutes from "./src/routes/trustedPartner.routes.js";
import serviceRoutes from "./src/routes/service.routes.js";
import settingsRoutes from "./src/routes/settings.routes.js";
import connectDB from "./src/config/db.js";
import mongoose from "mongoose";

const app = express();

const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : defaultOrigins;

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middlewares
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.get("/", (req, res) => res.status(200).json({ success: true, message: "API is working" }));

app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const readyState = mongoose.connection.readyState;
  res.status(readyState === 1 ? 200 : 503).json({
    success: readyState === 1,
    database: states[readyState] || "unknown",
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasJwtSecrets: Boolean(
      process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET,
    ),
    hasAdminCredentials: Boolean(
      process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD,
    ),
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/testimonials", testimonialRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/subscribers", subscriberRoutes);
app.use("/api/developers", developerRoutes);
app.use("/api/trusted-partners", trustedPartnerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/settings", settingsRoutes);

// Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    success: false, 
    message: err.message || "Internal Server Error" 
  });
});

// Local development
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const PORT = process.env.PORT || 4001;
  connectDB()
    .then(() =>
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`)),
    )
    .catch((error) => {
      console.error("Failed to start server:", error.message);
      process.exit(1);
    });
}

export default app;