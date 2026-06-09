import express from "express";
import * as property from "../controllers/property.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { propertyUpload } from "../middlewares/multer.middleware.js";

const router = express.Router();

function handlePropertyUpload(req, res, next) {
  propertyUpload(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "File too large. Each image or PDF must be under 15MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  });
}

router.post(
  "/",
  adminAuth,
  requirePermission("properties"),
  handlePropertyUpload,
  property.createProperty,
);

router.get("/", property.getProperties);
router.get("/form-options", property.getPropertyFormOptions);

router.get("/:id/brochure", property.downloadPropertyBrochure);
router.get("/:id", property.getProperty);

router.put(
  "/:id",
  adminAuth,
  requirePermission("properties"),
  handlePropertyUpload,
  property.updateProperty,
);

router.delete("/:id", adminAuth, requirePermission("properties"), property.deleteProperty);

router.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }
  return next();
});

export default router;
