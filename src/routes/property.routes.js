import express from "express";
import * as property from "../controllers/property.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { propertyUpload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.post(
  "/",
  adminAuth,
  requirePermission("properties"),
  propertyUpload,
  property.createProperty,
);

router.get("/", property.getProperties);
router.get("/form-options", property.getPropertyFormOptions);

router.get("/:id", property.getProperty);

router.put(
  "/:id",
  adminAuth,
  requirePermission("properties"),
  propertyUpload,
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
