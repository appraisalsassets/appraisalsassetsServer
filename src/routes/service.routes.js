import express from "express";
import * as service from "../controllers/service.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { serviceUpload } from "../middlewares/multer.middleware.js";

const router = express.Router();

function handleServiceUpload(req, res, next) {
  serviceUpload(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Hero image too large. Maximum size is 15MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Hero image upload failed",
    });
  });
}

router.get("/", service.getServicesPublic);
router.get(
  "/admin/all",
  adminAuth,
  requirePermission("content"),
  service.getServicesAdmin,
);
router.get(
  "/admin/:id",
  adminAuth,
  requirePermission("content"),
  service.getServiceAdminById,
);
router.get("/:slug", service.getServiceBySlug);

router.post(
  "/",
  adminAuth,
  requirePermission("content"),
  handleServiceUpload,
  service.createService,
);

router.put(
  "/:id",
  adminAuth,
  requirePermission("content"),
  handleServiceUpload,
  service.updateService,
);

router.delete(
  "/:id",
  adminAuth,
  requirePermission("content"),
  service.deleteService,
);

export default router;
