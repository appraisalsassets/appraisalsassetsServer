import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";

const tempDir = path.join(os.tmpdir(), "appraisalsassets-upload-temp");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);
    const suffix =
      ext || (file.fieldname === "documentPdf" ? ".pdf" : "");
    cb(null, `${Date.now()}-${base || "file"}${suffix}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "documentPdf") {
    const isPdf =
      file.mimetype === "application/pdf" ||
      /\.pdf$/i.test(file.originalname || "");
    if (isPdf) {
      return cb(null, true);
    }
    return cb(new Error("Property document must be a PDF file"), false);
  }

  if (file.fieldname === "images") {
    if (file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    return cb(new Error("Property images must be image files"), false);
  }

  return cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
});

/** Memory storage works on Vercel serverless (/tmp disk uploads often fail). */
const propertyStorage = multer.memoryStorage();

export const propertyUpload = multer({
  storage: propertyStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
}).fields([
  { name: "images", maxCount: 20 },
  { name: "documentPdf", maxCount: 1 },
]);

const serviceImageFilter = (req, file, cb) => {
  if (file.fieldname === "heroImage" && file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }
  return cb(new Error("Service hero image must be an image file"), false);
};

/** Memory storage for service hero images (Vercel/serverless safe). */
export const serviceUpload = multer({
  storage: propertyStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: serviceImageFilter,
}).single("heroImage");

const blogImageFilter = (req, file, cb) => {
  if (
    file.fieldname === "featuredImage" &&
    file.mimetype.startsWith("image/")
  ) {
    return cb(null, true);
  }
  return cb(new Error("Blog featured image must be an image file"), false);
};

/** Memory storage for blog featured images (Vercel/serverless safe). */
export const blogUpload = multer({
  storage: propertyStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: blogImageFilter,
}).single("featuredImage");
