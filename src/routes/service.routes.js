import express from "express";
import * as service from "../controllers/service.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.get("/", service.getServicesPublic);
router.get(
  "/admin/all",
  adminAuth,
  requirePermission("content"),
  service.getServicesAdmin,
);
router.get("/:slug", service.getServiceBySlug);

router.post(
  "/",
  adminAuth,
  requirePermission("content"),
  upload.single("heroImage"),
  service.createService,
);

router.put(
  "/:id",
  adminAuth,
  requirePermission("content"),
  upload.single("heroImage"),
  service.updateService,
);

router.delete(
  "/:id",
  adminAuth,
  requirePermission("content"),
  service.deleteService,
);

export default router;
