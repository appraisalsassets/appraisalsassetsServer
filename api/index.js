import dotenv from "dotenv";
import { applyCorsHeaders } from "../src/config/cors.js";

dotenv.config();

let adminBootstrapped = false;

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (!applyCorsHeaders(res, origin)) {
    return res.status(403).json({
      success: false,
      message: "CORS blocked for this origin",
    });
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

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
