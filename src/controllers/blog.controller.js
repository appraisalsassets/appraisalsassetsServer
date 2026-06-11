import BlogPost from "../models/BlogPost.js";
import {
  getCloudinaryAssetUrl,
  uploadMulterFile,
} from "../utils/cloudinary.js";

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(slug, excludeId = null) {
  let uniqueSlug = slug;
  let counter = 1;
  while (true) {
    const query = { slug: uniqueSlug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await BlogPost.findOne(query);
    if (!existing) return uniqueSlug;
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
}

function isAdminRequest(req) {
  const authHeader = req.headers.authorization;
  return Boolean(authHeader && authHeader.startsWith("Bearer "));
}

function normalizeStatus(status) {
  const value = String(status || "draft").trim().toLowerCase();
  return value === "published" ? "published" : "draft";
}

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean);
  }
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

async function uploadFeaturedImage(file) {
  if (!file) return "";
  try {
    const uploadResult = await uploadMulterFile(file, "blog", {
      resourceType: "image",
    });
    return getCloudinaryAssetUrl(uploadResult);
  } catch (uploadError) {
    console.error("Image upload error:", uploadError);
    return "";
  }
}

// CREATE BLOG POST
export const createBlogPost = async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, tags, status, isFeatured } =
      req.body;

    if (!title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        message: "Please provide title, excerpt, and content",
      });
    }

    const finalSlug = await ensureUniqueSlug(
      slug && slug.trim() ? generateSlug(slug) : generateSlug(title),
    );

    const imageUrl = await uploadFeaturedImage(req.file);
    const normalizedStatus = normalizeStatus(status);

    const blogPost = new BlogPost({
      title: String(title).trim(),
      slug: finalSlug,
      excerpt: String(excerpt).trim(),
      content,
      featuredImage: imageUrl,
      category: category || "dubai_real_estate_news",
      tags: parseTags(tags),
      status: normalizedStatus,
      publishedAt: normalizedStatus === "published" ? new Date() : null,
      isFeatured: parseBoolean(isFeatured),
      createdBy: req.admin._id,
    });

    await blogPost.save();

    res.status(201).json({
      success: true,
      message: "Blog post created successfully",
      data: blogPost,
    });
  } catch (error) {
    console.error("Create blog post error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating blog post",
      error: error.message,
    });
  }
};

// GET ALL BLOG POSTS
export const getBlogPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      category,
      featured,
      search,
    } = req.query;

    const query = {};
    const adminRequest = isAdminRequest(req);

    if (adminRequest) {
      if (status) query.status = normalizeStatus(status);
    } else {
      query.status = "published";
      query.isActive = true;
    }

    if (category) query.category = category;
    if (featured !== undefined) query.isFeatured = featured === "true";

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const sortOptions = {};
    const effectiveSortBy =
      !adminRequest && sortBy === "createdAt" ? "publishedAt" : sortBy;
    sortOptions[effectiveSortBy] = sortOrder === "desc" ? -1 : 1;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const blogPosts = await BlogPost.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .populate("createdBy", "name email")
      .exec();

    const total = await BlogPost.countDocuments(query);

    res.status(200).json({
      success: true,
      message: "Blog posts retrieved successfully",
      data: blogPosts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
    });
  } catch (error) {
    console.error("Get blog posts error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving blog posts",
      error: error.message,
    });
  }
};

// GET SINGLE BLOG POST BY ID OR SLUG
export const getBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const adminRequest = isAdminRequest(req);

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const blogPost = isObjectId
      ? await BlogPost.findById(id).populate("createdBy", "name email")
      : await BlogPost.findOne({ slug: id }).populate("createdBy", "name email");

    if (!blogPost) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    if (
      !adminRequest &&
      (blogPost.status !== "published" || blogPost.isActive === false)
    ) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog post retrieved successfully",
      data: blogPost,
    });
  } catch (error) {
    console.error("Get blog post error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving blog post",
      error: error.message,
    });
  }
};

// UPDATE BLOG POST
export const updateBlogPost = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      excerpt,
      content,
      category,
      tags,
      status,
      isFeatured,
    } = req.body;

    const existingPost = await BlogPost.findById(id);
    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    const updateData = {};

    if (title !== undefined) updateData.title = String(title).trim();
    if (excerpt !== undefined) updateData.excerpt = String(excerpt).trim();
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;

    if (slug !== undefined && String(slug).trim()) {
      updateData.slug = await ensureUniqueSlug(generateSlug(slug), id);
    } else if (title !== undefined && String(title).trim()) {
      updateData.slug = await ensureUniqueSlug(generateSlug(title), id);
    }

    if (tags !== undefined) {
      updateData.tags = parseTags(tags);
    }

    if (isFeatured !== undefined) {
      updateData.isFeatured = parseBoolean(isFeatured);
    }

    if (status !== undefined) {
      const normalizedStatus = normalizeStatus(status);
      updateData.status = normalizedStatus;
      if (
        normalizedStatus === "published" &&
        existingPost.status !== "published"
      ) {
        updateData.publishedAt = new Date();
      }
    }

    if (req.file) {
      const imageUrl = await uploadFeaturedImage(req.file);
      if (imageUrl) {
        updateData.featuredImage = imageUrl;
      }
    }

    const blogPost = await BlogPost.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Blog post updated successfully",
      data: blogPost,
    });
  } catch (error) {
    console.error("Update blog post error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating blog post",
      error: error.message,
    });
  }
};

// DELETE BLOG POST
export const deleteBlogPost = async (req, res) => {
  try {
    const { id } = req.params;

    const blogPost = await BlogPost.findByIdAndDelete(id);

    if (!blogPost) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Blog post deleted successfully",
      data: blogPost,
    });
  } catch (error) {
    console.error("Delete blog post error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting blog post",
      error: error.message,
    });
  }
};

// TOGGLE BLOG POST STATUS (draft/published)
export const toggleBlogPostStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const normalizedStatus = normalizeStatus(status);

    if (!["draft", "published"].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'draft' or 'published'",
      });
    }

    const updateData = { status: normalizedStatus };
    if (normalizedStatus === "published") {
      const existing = await BlogPost.findById(id);
      if (existing && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const blogPost = await BlogPost.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!blogPost) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Blog post ${normalizedStatus === "published" ? "published" : "moved to draft"} successfully`,
      data: blogPost,
    });
  } catch (error) {
    console.error("Toggle blog post status error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling blog post status",
      error: error.message,
    });
  }
};

// TOGGLE FEATURED
export const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;

    const blogPost = await BlogPost.findByIdAndUpdate(
      id,
      { isFeatured: parseBoolean(isFeatured) },
      { new: true },
    );

    if (!blogPost) {
      return res.status(404).json({
        success: false,
        message: "Blog post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Blog post ${isFeatured ? "marked as featured" : "removed from featured"} successfully`,
      data: blogPost,
    });
  } catch (error) {
    console.error("Toggle featured error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling featured status",
      error: error.message,
    });
  }
};
