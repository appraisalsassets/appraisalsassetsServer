import express from "express";
import * as trustedPartner from "../controllers/trustedPartner.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.get("/", trustedPartner.getTrustedPartnersPublic);

router.get(
  "/admin/all",
  adminAuth,
  requirePermission("developers"),
  trustedPartner.getTrustedPartnersAdmin,
);

router.post(
  "/",
  adminAuth,
  requirePermission("developers"),
  upload.single("logo"),
  trustedPartner.createTrustedPartner,
);

router.put(
  "/:id",
  adminAuth,
  requirePermission("developers"),
  upload.single("logo"),
  trustedPartner.updateTrustedPartner,
);

router.delete(
  "/:id",
  adminAuth,
  requirePermission("developers"),
  trustedPartner.deleteTrustedPartner,
);

export default router;
