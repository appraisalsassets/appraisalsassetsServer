import express from "express";
import * as developer from "../controllers/developer.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

router.get("/", developer.getDevelopers);
router.get("/trusted-partners", developer.getTrustedPartners);
router.get(
  "/admin/all",
  adminAuth,
  requirePermission("developers"),
  developer.getDevelopersAdmin,
);
router.get("/:slug", developer.getDeveloperBySlug);

router.post(
  "/",
  adminAuth,
  requirePermission("developers"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "heroImage", maxCount: 1 },
  ]),
  developer.createDeveloper,
);

router.put(
  "/:id",
  adminAuth,
  requirePermission("developers"),
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "heroImage", maxCount: 1 },
  ]),
  developer.updateDeveloper,
);

router.delete(
  "/:id",
  adminAuth,
  requirePermission("developers"),
  developer.deleteDeveloper,
);

export default router;
