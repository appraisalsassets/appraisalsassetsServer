import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import Admin from "../models/Admin.js";
import { hashPassword } from "../utils/hash.js";
import { generateOtp } from "../utils/generateOtp.js";

dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await createAdminIfNotExists();
  } catch (error) {
    console.error("❌ Error creating admin:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

export const createAdminIfNotExists = async () => {
  try {
    // Validate environment variables
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.error(
        "❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file",
      );
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL.toLowerCase().trim();

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      // Hash new password
      const hashedPassword = await hashPassword(process.env.ADMIN_PASSWORD);

      // Update existing admin with new credentials
      await Admin.updateOne(
        { email: adminEmail },
        {
          name: process.env.ADMIN_NAME || "System Administrator",
          password: hashedPassword,
          isEmailVerified: true,
          authProvider: "local",
          accessLevel: "full",
          isActive: true,
        },
      );
      console.log(`✅ Admin updated: ${adminEmail}`);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(process.env.ADMIN_PASSWORD);

    // Create admin with email verified (skip OTP for initial setup)
    await Admin.create({
      name: process.env.ADMIN_NAME || "System Administrator",
      email: adminEmail,
      password: hashedPassword,
      isEmailVerified: true, // Auto-verify for initial admin
      authProvider: "local",
      accessLevel: "full",
      isActive: true,
    });
    console.log(`✅ Admin created: ${adminEmail}`);
  } catch (error) {
    console.error("❌ Error creating/updating admin:", error.message);
  }
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// Handle command line arguments - only run script if called directly
if (isDirectRun) {
  const args = process.argv.slice(2);
  const forceCreate = args.includes("--force") || args.includes("-f");

  if (forceCreate) {
    console.log("🔄 Force mode enabled - will recreate admin if exists");
    // Delete existing admin first
    Admin.deleteOne({ email: process.env.ADMIN_EMAIL })
      .then(() => {
        console.log("🗑️  Existing admin deleted (if existed)");
        createAdmin();
      })
      .catch((error) => {
        console.error("❌ Error deleting existing admin:", error.message);
        process.exit(1);
      });
  } else {
    createAdmin();
  }
}
