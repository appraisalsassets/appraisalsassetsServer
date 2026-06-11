import Service from "../models/Service.js";
import { uploadMulterFile } from "../utils/cloudinary.js";

function toSlug(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function parseJsonField(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseFeatures(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function buildServicePayload(body) {
  return {
    name: body.name?.trim(),
    shortDescription: body.shortDescription?.trim() || "",
    overview: body.overview?.trim() || "",
    features: parseFeatures(body.features),
    icon: body.icon?.trim() || "building2",
    whyChooseTitle: body.whyChooseTitle?.trim() || "Why Choose Us",
    whyChooseSubtitle: body.whyChooseSubtitle?.trim() || "",
    whyChooseItems: parseJsonField(body.whyChooseItems),
    offeringsTitle: body.offeringsTitle?.trim() || "What We Offer",
    offeringsSubtitle: body.offeringsSubtitle?.trim() || "",
    offerings: parseJsonField(body.offerings),
    stepsTitle: body.stepsTitle?.trim() || "How We Handle It",
    stepsSubtitle: body.stepsSubtitle?.trim() || "",
    steps: parseJsonField(body.steps),
    coverageTitle: body.coverageTitle?.trim() || "Areas We Serve",
    coverageSubtitle: body.coverageSubtitle?.trim() || "",
    coverageAreas: parseJsonField(body.coverageAreas),
    pricingTitle: body.pricingTitle?.trim() || "Cost & Timeline",
    pricingSubtitle: body.pricingSubtitle?.trim() || "",
    pricingRows: parseJsonField(body.pricingRows),
    faqTitle: body.faqTitle?.trim() || "Common Questions",
    faqSubtitle: body.faqSubtitle?.trim() || "",
    faqs: parseJsonField(body.faqs),
    ctaTitle: body.ctaTitle?.trim() || "Get Started With Us Today",
    ctaDescription: body.ctaDescription?.trim() || "",
    ctaButtonText: body.ctaButtonText?.trim() || "Book a Free Consultation",
    consultationPhone: body.consultationPhone?.trim() || "",
    consultationEmail: body.consultationEmail?.trim() || "",
    displayOrder: Number(body.displayOrder) || 0,
    isActive: parseBoolean(body.isActive, true),
  };
}

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const filter = { slug };
    if (excludeId) filter._id = { $ne: excludeId };
    const existing = await Service.findOne(filter).select("_id");
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

export const getServicesPublic = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true })
      .select(
        "name slug shortDescription features icon heroImage displayOrder",
      )
      .sort({ displayOrder: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Services fetched successfully",
      services,
    });
  } catch (error) {
    console.error("Get services error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getServicesAdmin = async (req, res) => {
  try {
    const services = await Service.find({})
      .sort({
        displayOrder: 1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Admin services fetched successfully",
      services,
    });
  } catch (error) {
    console.error("Get admin services error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getServiceAdminById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service fetched successfully",
      service,
    });
  } catch (error) {
    console.error("Get admin service error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getServiceBySlug = async (req, res) => {
  try {
    const service = await Service.findOne({
      slug: req.params.slug,
      isActive: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service fetched successfully",
      service,
    });
  } catch (error) {
    console.error("Get service by slug error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createService = async (req, res) => {
  try {
    const payload = buildServicePayload(req.body);

    if (!payload.name) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    const baseSlug = toSlug(req.body.slug || payload.name);
    if (!baseSlug) {
      return res.status(400).json({
        success: false,
        message: "Could not generate a valid slug",
      });
    }

    payload.slug = await ensureUniqueSlug(baseSlug);
    payload.createdBy = req.admin._id;

    if (req.file) {
      const upload = await uploadMulterFile(req.file, "services");
      if (upload?.secure_url || upload?.url) {
        payload.heroImage = upload.secure_url || upload.url;
      }
    }

    const service = await Service.create(payload);

    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      service,
    });
  } catch (error) {
    console.error("Create service error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const payload = buildServicePayload(req.body);

    if (payload.name) {
      service.name = payload.name;
    }

    if (req.body.slug?.trim()) {
      const baseSlug = toSlug(req.body.slug);
      service.slug = await ensureUniqueSlug(baseSlug, service._id);
    } else if (payload.name && payload.name !== service.name) {
      const baseSlug = toSlug(payload.name);
      service.slug = await ensureUniqueSlug(baseSlug, service._id);
    }

    Object.assign(service, {
      shortDescription: payload.shortDescription,
      overview: payload.overview,
      features: payload.features,
      icon: payload.icon,
      whyChooseTitle: payload.whyChooseTitle,
      whyChooseSubtitle: payload.whyChooseSubtitle,
      whyChooseItems: payload.whyChooseItems,
      offeringsTitle: payload.offeringsTitle,
      offeringsSubtitle: payload.offeringsSubtitle,
      offerings: payload.offerings,
      stepsTitle: payload.stepsTitle,
      stepsSubtitle: payload.stepsSubtitle,
      steps: payload.steps,
      coverageTitle: payload.coverageTitle,
      coverageSubtitle: payload.coverageSubtitle,
      coverageAreas: payload.coverageAreas,
      pricingTitle: payload.pricingTitle,
      pricingSubtitle: payload.pricingSubtitle,
      pricingRows: payload.pricingRows,
      faqTitle: payload.faqTitle,
      faqSubtitle: payload.faqSubtitle,
      faqs: payload.faqs,
      ctaTitle: payload.ctaTitle,
      ctaDescription: payload.ctaDescription,
      ctaButtonText: payload.ctaButtonText,
      consultationPhone: payload.consultationPhone,
      consultationEmail: payload.consultationEmail,
      displayOrder: payload.displayOrder,
      isActive: payload.isActive,
    });

    if (req.file) {
      const upload = await uploadMulterFile(req.file, "services");
      if (upload?.secure_url || upload?.url) {
        service.heroImage = upload.secure_url || upload.url;
      }
    }

    await service.save();

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    console.error("Update service error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete service error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
