import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  localFilePath,
  folder = "properties",
  options = {},
) => {
  try {
    // Check if Cloudinary is configured
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      console.warn(
        "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.",
      );
      return null;
    }

    if (!localFilePath) return null;

    const resourceType = options.resourceType || "auto";

    // Upload on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: resourceType,
      folder: folder,
    });

    // File has been uploaded successfully
    console.log("File is uploaded on cloudinary", response.url);

    // Remove the locally saved temporary file after successful upload
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    // Remove the locally saved temporary file as the upload operation failed
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    throw error;
  }
};

export const uploadOnCloudinary = uploadToCloudinary; // Backward compatibility
