import express from "express";
import * as blog from "../controllers/blog.controller.js";
import { adminAuth, requirePermission } from "../middlewares/auth.middleware.js";
import { blogUpload } from "../middlewares/multer.middleware.js";

const router = express.Router();

function handleBlogUpload(req, res, next) {
  blogUpload(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        message: "Featured image too large. Maximum size is 15MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message || "Featured image upload failed",
    });
  });
}

// Public routes
router.get("/", blog.getBlogPosts);
router.get("/:id", blog.getBlogPost);

// Admin only routes
router.post(
  "/",
  adminAuth,
  requirePermission("blog"),
  handleBlogUpload,
  blog.createBlogPost,
);
router.put(
  "/:id",
  adminAuth,
  requirePermission("blog"),
  handleBlogUpload,
  blog.updateBlogPost,
);
router.delete("/:id", adminAuth, requirePermission("blog"), blog.deleteBlogPost);

// Toggle endpoints
router.patch(
  "/:id/toggle-status",
  adminAuth,
  requirePermission("blog"),
  blog.toggleBlogPostStatus,
);
router.patch(
  "/:id/toggle-featured",
  adminAuth,
  requirePermission("blog"),
  blog.toggleFeatured,
);

export default router;
