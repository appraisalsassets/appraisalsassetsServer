import TrustedPartner from "../models/TrustedPartner.js";
import {
  getCloudinaryAssetUrl,
  getCloudinaryConfigErrorMessage,
  isCloudinaryConfigured,
  uploadMulterFile,
} from "../utils/cloudinary.js";

async function uploadPartnerLogo(file) {
  if (!file) return "";
  if (!isCloudinaryConfigured()) {
    throw new Error(getCloudinaryConfigErrorMessage());
  }
  const result = await uploadMulterFile(file, "trusted-partners", {
    resourceType: "image",
  });
  return getCloudinaryAssetUrl(result) || "";
}

export const getTrustedPartnersPublic = async (req, res) => {
  try {
    const partners = await TrustedPartner.find({ isActive: true })
      .select("name logo websiteUrl displayOrder")
      .sort({ displayOrder: 1, name: 1 });

    return res.status(200).json({
      success: true,
      message: "Trusted partners fetched successfully",
      partners: partners.filter((p) => p.logo?.trim()),
    });
  } catch (error) {
    console.error("Get trusted partners error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getTrustedPartnersAdmin = async (req, res) => {
  try {
    const partners = await TrustedPartner.find({}).sort({
      displayOrder: 1,
      createdAt: -1,
    });
    return res.status(200).json({
      success: true,
      message: "Trusted partners fetched successfully",
      partners,
    });
  } catch (error) {
    console.error("Get admin trusted partners error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createTrustedPartner = async (req, res) => {
  try {
    const { name, websiteUrl, displayOrder, isActive } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Partner name is required",
      });
    }

    const logoFile = req.file;
    if (!logoFile) {
      return res.status(400).json({
        success: false,
        message: "Logo image is required",
      });
    }

    const logo = await uploadPartnerLogo(logoFile);
    if (!logo) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload logo",
      });
    }

    const partner = await TrustedPartner.create({
      name: name.trim(),
      logo,
      websiteUrl: websiteUrl?.trim() || "",
      displayOrder: Number(displayOrder || 0),
      isActive: isActive === "false" ? false : true,
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: "Trusted partner created successfully",
      partner,
    });
  } catch (error) {
    console.error("Create trusted partner error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateTrustedPartner = async (req, res) => {
  try {
    const partner = await TrustedPartner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Trusted partner not found",
      });
    }

    const { name, websiteUrl, displayOrder, isActive } = req.body;
    if (name?.trim()) partner.name = name.trim();
    if (websiteUrl !== undefined) partner.websiteUrl = String(websiteUrl).trim();
    if (displayOrder !== undefined) partner.displayOrder = Number(displayOrder || 0);
    if (isActive !== undefined) partner.isActive = isActive !== "false";

    if (req.file) {
      const logo = await uploadPartnerLogo(req.file);
      if (logo) partner.logo = logo;
    }

    await partner.save();

    return res.status(200).json({
      success: true,
      message: "Trusted partner updated successfully",
      partner,
    });
  } catch (error) {
    console.error("Update trusted partner error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteTrustedPartner = async (req, res) => {
  try {
    const partner = await TrustedPartner.findByIdAndDelete(req.params.id);
    if (!partner) {
      return res.status(404).json({
        success: false,
        message: "Trusted partner not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Trusted partner deleted successfully",
    });
  } catch (error) {
    console.error("Delete trusted partner error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
