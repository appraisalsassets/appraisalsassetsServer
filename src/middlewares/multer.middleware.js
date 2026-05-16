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
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "documentPdf") {
    if (file.mimetype === "application/pdf") {
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

export const propertyUpload = upload.fields([
  { name: "images", maxCount: 20 },
  { name: "documentPdf", maxCount: 1 },
]);
