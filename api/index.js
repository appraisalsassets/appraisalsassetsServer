import dotenv from "dotenv";

dotenv.config();

const allowedOrigins = [
  "https://appraisalsassets-client-g2nn-p31kdjqom.vercel.app",
  "https://appraisalsassets-client-delta-v2-s14b9q8i4.vercel.app",
  "https://appraisalsassets-client-delta.vercel.app",
  "https://www.assetsappraisals.com",
  "https://assetsappraisals.com",
  "http://localhost:3000",
  "http://localhost:3001",
  ...(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

let adminBootstrapped = false;

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const cleanOrigin = origin.replace(/\/$/, "");

  const allowedOrigin = allowedOrigins.includes(cleanOrigin)
    ? cleanOrigin
    : allowedOrigins[0];

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,Accept,Origin,X-Requested-With",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.MONGO_URI) {
    return res.status(503).json({
      success: false,
      message:
        "Database is not configured. Set MONGO_URI in Vercel environment variables and redeploy.",
    });
  }

  try {
    const { default: connectDB } = await import("../src/config/db.js");
    await connectDB();

    if (
      !adminBootstrapped &&
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD
    ) {
      const { createAdminIfNotExists } = await import(
        "../src/scripts/setupAdmin.js"
      );
      await createAdminIfNotExists();
      adminBootstrapped = true;
    }

    const { default: app } = await import("../app.js");
    return app(req, res);
  } catch (err) {
    console.error("CRASH:", err.message, err.stack);
    const isDbError =
      err.message?.includes("MONGO_URI") ||
      err.name === "MongoServerSelectionError" ||
      err.name === "MongooseServerSelectionError";

    return res.status(isDbError ? 503 : 500).json({
      success: false,
      message: isDbError
        ? "Database connection failed. Check MONGO_URI and MongoDB Atlas network access (allow 0.0.0.0/0 for Vercel)."
        : err.message || "Internal server error",
    });
  }
}
