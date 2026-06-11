import Property from "../models/Property.js";
import Inquiry from "../models/Inquiry.js";
import {
  getCloudinaryAssetUrl,
  getCloudinaryConfigErrorMessage,
  fetchCloudinaryRawBuffer,
  getCloudinaryPdfDeliveryUrl,
  isCloudinaryConfigured,
  parseCloudinaryRawAsset,
  uploadMulterFile,
  verifyCloudinaryPdfAccessible,
} from "../utils/cloudinary.js";
import { v2 as cloudinary } from "cloudinary";

const isOffPlanCategory = (value = "") => {
  const key = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  return key === "off_plan" || key === "offplan" || key.includes("off_plan");
};

const parseImageUrls = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (error) {
    // Fall back to comma/newline separated text
  }

  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * Amenities may arrive as JSON array string, repeated form fields (array),
 * or a single value like "gym" — never JSON.parse a bare token.
 */
function getMulterImageFiles(files) {
  if (!files) return [];
  if (Array.isArray(files)) return files;
  return files.images || [];
}

function getMulterPdfFile(files) {
  if (!files || Array.isArray(files)) return null;
  return files.documentPdf?.[0] || null;
}

async function uploadPropertyDocumentPdf(file) {
  if (!file) return null;

  if (!isCloudinaryConfigured()) {
    throw new Error(getCloudinaryConfigErrorMessage());
  }

  const result = await uploadMulterFile(file, "properties/documents", {
    resourceType: "raw",
  });

  const url = getCloudinaryAssetUrl(result);
  if (!url) {
    throw new Error(
      "Cloudinary did not return a URL for the property PDF. Verify your Cloudinary account allows raw/PDF uploads.",
    );
  }

  const storedPublicId = result.public_id
    ? result.folder
      ? `${result.folder}/${result.public_id}`
      : result.public_id
    : parseCloudinaryRawAsset(url)?.publicId || "";

  const canDownload = await verifyCloudinaryPdfAccessible(storedPublicId);
  if (!canDownload) {
    if (storedPublicId) {
      try {
        await cloudinary.uploader.destroy(storedPublicId, { resource_type: "raw" });
      } catch (destroyError) {
        console.error("Failed to remove invalid PDF upload:", destroyError.message);
      }
    }
    throw new Error(
      "PDF upload failed validation. Please upload a valid PDF file and try again.",
    );
  }

  const fileName = file.originalname || "property-brochure.pdf";
  const parsed = parseCloudinaryRawAsset(url);
  return {
    url,
    fileName,
    downloadUrl: getCloudinaryPdfDeliveryUrl(url),
    publicId: storedPublicId || parsed?.publicId || "",
  };
}

function resolveBrochureFileName(property) {
  const fromDoc = property.documentPdf?.fileName?.trim();
  if (fromDoc) {
    return fromDoc.toLowerCase().endsWith(".pdf") ? fromDoc : `${fromDoc}.pdf`;
  }
  const slug = (property.referenceNumber || property.title || "property")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
  return `${slug || "property-brochure"}.pdf`;
}

const parseBooleanField = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const parseNumberField = (value, fallback = 0) => {
  if (value === "" || value == null) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseExistingImages = (value) => {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((img) =>
        typeof img === "string"
          ? { url: img, isCover: false }
          : {
              url: img?.url || "",
              isCover: Boolean(img?.isCover),
            },
      )
      .filter((img) => img.url);
  } catch {
    return null;
  }
};

const parseAmenities = (amenities) => {
  if (amenities == null || amenities === "") return [];
  if (Array.isArray(amenities)) {
    return amenities.map((a) => String(a).trim()).filter(Boolean);
  }
  if (typeof amenities !== "string") return [];
  const trimmed = amenities.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (parsed != null && parsed !== "") return [String(parsed)];
  } catch {
    // Not JSON: single amenity key or comma-separated
  }
  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [trimmed];
};

const toLabel = (value) =>
  String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const categoryLabels = {
  for_sale: "For Sale",
  for_rent: "For Rent",
  off_plan: "Off-Plan",
  commercial: "Commercial",
};

const propertyTypeLabels = {
  apartment: "Apartment",
  villa: "Villa",
  townhouse: "Townhouse",
  penthouse: "Penthouse",
  office: "Office",
  retail: "Retail",
  warehouse: "Warehouse",
};

const statusLabels = {
  available: "Available",
  sold: "Sold",
  rented: "Rented",
  reserved: "Reserved",
};

const locationLabels = {
  dubai_marina: "Dubai Marina",
  downtown_dubai: "Downtown Dubai",
  bussiness_bay: "Business Bay",
  jvc: "JVC",
  palm_jumeirah: "Palm Jumeirah",
  dubai_hills: "Dubai Hills",
  arabian_ranches: "Arabian Ranches",
  emaar_beachfront: "Emaar Beachfront",
  blue_waters: "Bluewaters",
  city_walks: "City Walk",
};

const inquiryTypeLabels = {
  general: "General Inquiry",
  viewing: "Schedule Viewing",
  valuation: "Property Valuation",
  investment: "Investment Advisory",
};

// Default option values when schema has no enums (for form-options API consistency)
const DEFAULT_CATEGORIES = Object.keys(categoryLabels);
const DEFAULT_PROPERTY_TYPES = Object.keys(propertyTypeLabels);
const DEFAULT_STATUSES = Object.keys(statusLabels);
const DEFAULT_LOCATIONS = Object.keys(locationLabels);
const DEFAULT_AMENITIES = [
  "swimming_pool", "gym", "parking", "balcony", "sea_view", "city_view",
  "concierge", "security", "garden", "beach_access", "kids_play_area",
  "bbq_area", "sauna", "jacuzzi", "maid_room",
];

const enumValuesOrDefault = (path, fallback) => {
  const values = path?.enumValues;
  return values?.length ? values : fallback;
};

// GET FORM OPTIONS
export const getPropertyFormOptions = async (req, res) => {
  try {
    const categoryEnum = enumValuesOrDefault(
      Property.schema.path("category"),
      DEFAULT_CATEGORIES,
    );
    const propertyTypeEnum = enumValuesOrDefault(
      Property.schema.path("propertyType"),
      DEFAULT_PROPERTY_TYPES,
    );
    const statusEnum = enumValuesOrDefault(
      Property.schema.path("status"),
      DEFAULT_STATUSES,
    );
    const amenitiesPath = Property.schema.path("amenities");
    const amenitiesEnum = enumValuesOrDefault(
      amenitiesPath?.embeddedSchemaType || amenitiesPath?.caster,
      DEFAULT_AMENITIES,
    );
    const locationEnum = enumValuesOrDefault(
      Property.schema.path("location"),
      DEFAULT_LOCATIONS,
    );
    const inquiryTypeEnum = enumValuesOrDefault(
      Inquiry.schema.path("inquiry_type"),
      Object.keys(inquiryTypeLabels),
    );

    return res.status(200).json({
      success: true,
      data: {
        categories: categoryEnum.map((value) => ({
          value,
          label: categoryLabels[value] || toLabel(value),
        })),
        propertyTypes: propertyTypeEnum.map((value) => ({
          value,
          label: propertyTypeLabels[value] || toLabel(value),
        })),
        statuses: statusEnum.map((value) => ({
          value,
          label: statusLabels[value] || toLabel(value),
        })),
        amenities: amenitiesEnum.map((value) => ({
          value,
          label: toLabel(value),
        })),
        locations: locationEnum.map((value) => ({
          value,
          label: locationLabels[value] || toLabel(value),
        })),
        inquiryTypes: inquiryTypeEnum.map((value) => ({
          value,
          label: inquiryTypeLabels[value] || toLabel(value),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch form options",
      error: error.message,
    });
  }
};

// CREATE PROPERTY
export const createProperty = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      propertyType,
      status,
      price,
      sizeSqft,
      referenceNumber,
      bedrooms,
      bathrooms,
      amenities,
      imageUrls,
      location,
      phone,
      whatsAppNumber,
      contactEmail,
      developerName,
      developerSlug,
      isFeatured,
      isActive,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !propertyType ||
      !price ||
      !sizeSqft ||
      !location ||
      !phone ||
      !whatsAppNumber
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Handle image uploads
    let images = [];
    const imageFiles = getMulterImageFiles(req.files);
    if (imageFiles.length > 0) {
      try {
        const uploadPromises = imageFiles.map((file) =>
          uploadMulterFile(file, "properties", { resourceType: "image" }),
        );
        const uploadResults = await Promise.all(uploadPromises);
        images = uploadResults
          .filter((result) => result?.secure_url)
          .map((result, index) => ({
            url: result.secure_url,
            isCover: index === 0,
          }));
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload images",
          error: uploadError.message || uploadError,
        });
      }
    }

    let documentPdf = { url: "", fileName: "" };
    const pdfFile = getMulterPdfFile(req.files);
    if (pdfFile) {
      try {
        documentPdf = await uploadPropertyDocumentPdf(pdfFile);
      } catch (uploadError) {
        console.error("Property PDF upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message:
            uploadError.message ||
            "Failed to upload property PDF. Check Cloudinary configuration.",
          error: uploadError.message || String(uploadError),
        });
      }
    }

    // Merge direct image URLs from admin form
    const directImageUrls = parseImageUrls(imageUrls);
    if (directImageUrls.length > 0) {
      const urlImages = directImageUrls.map((url) => ({ url, isCover: false }));
      images = [...images, ...urlImages];
      if (images.length > 0 && !images.some((img) => img.isCover)) {
        images[0].isCover = true;
      }
    }

    // Auto-generate reference number if not provided
    const finalReferenceNumber =
      referenceNumber ||
      `LUX-${propertyType.substring(0, 2).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const parsedAmenities = parseAmenities(amenities);

    const property = await Property.create({
      title,
      description,
      category: category || "for_sale",
      propertyType,
      status: status || "available",
      price: {
        amount: parseFloat(price),
        currency: "AED",
      },
      sizeSqft: parseFloat(sizeSqft),
      referenceNumber: finalReferenceNumber,
      bedrooms: bedrooms ? parseInt(bedrooms) : 0,
      bathrooms: bathrooms ? parseInt(bathrooms) : 0,
      amenities: parsedAmenities,
      images,
      documentPdf,
      location,
      phone,
      whatsAppNumber,
      contactEmail: contactEmail || "",
      developerName: isOffPlanCategory(category) ? developerName || "" : "",
      developerSlug: isOffPlanCategory(category) ? developerSlug || "" : "",
      isFeatured: isFeatured === "true" || isFeatured === true,
      isActive: isActive === "true" || isActive === true,
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: "Property created successfully",
      property,
    });
  } catch (error) {
    console.error("Create property error:", error);
    if (error.code === 11000) {
      const key = error.keyPattern
        ? Object.keys(error.keyPattern).join(", ")
        : "field";
      const dropHints = {
        phone: "db.properties.dropIndex('phone_1')",
        whatsAppNumber: "db.properties.dropIndex('whatsAppNumber_1')",
      };
      const hint = dropHints[key];
      return res.status(409).json({
        success: false,
        message: hint
          ? `Duplicate ${key} on database. Restart the server once to drop the legacy unique index, or run: ${hint}`
          : `Duplicate value for unique field: ${key}`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// GET ALL PROPERTIES
export const getProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      category,
      status,
      location,
      isFeatured,
      developerSlug,
      activeOnly,
    } = req.query;

    console.log("Get properties query:", req.query);

    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (location) filter.location = location;
    if (isFeatured) filter.isFeatured = isFeatured === "true";
    if (developerSlug) filter.developerSlug = developerSlug;
    // Public/developer listings: only active unless admin passes activeOnly=false
    if (activeOnly === "true" || activeOnly === true) {
      filter.isActive = true;
    }

    console.log("Built filter:", filter);
    console.log(
      "MongoDB:",
      Property.db?.name || "unknown",
      "properties in DB:",
      await Property.countDocuments({}),
    );

    const properties = await Property.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email");

    console.log("Found properties:", properties.length);

    const total = await Property.countDocuments(filter);
    console.log("Total properties:", total);

    return res.status(200).json({
      success: true,
      message: "Properties fetched successfully",
      properties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get properties error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET PROPERTY BROCHURE PDF (correct filename + Content-Disposition)
export const downloadPropertyBrochure = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).select(
      "documentPdf title referenceNumber",
    );

    if (!property?.documentPdf?.url?.trim()) {
      return res.status(404).json({
        success: false,
        message: "No brochure PDF available for this property",
      });
    }

    const fileName = resolveBrochureFileName(property);
    const sourceUrl = getCloudinaryPdfDeliveryUrl(
      property.documentPdf.url?.trim() ||
        property.documentPdf.downloadUrl?.trim() ||
        "",
    );

    if (!sourceUrl) {
      return res.status(404).json({
        success: false,
        message: "No brochure PDF available for this property",
      });
    }

    let buffer;
    try {
      const storedPublicId = property.documentPdf.publicId?.trim();
      buffer = storedPublicId
        ? await fetchCloudinaryRawBuffer(sourceUrl, storedPublicId)
        : await fetchCloudinaryRawBuffer(sourceUrl);
    } catch (fetchError) {
      console.error("Brochure fetch failed:", fetchError.message, sourceUrl);
      return res.status(502).json({
        success: false,
        message: "Failed to retrieve PDF from storage. Try uploading the brochure again in admin.",
      });
    }
    const isPdf =
      buffer.length >= 4 && buffer.subarray(0, 4).toString("utf8") === "%PDF";
    if (!isPdf) {
      console.error(
        "Brochure is not a PDF:",
        sourceUrl,
        buffer.subarray(0, 32).toString("utf8"),
      );
      return res.status(502).json({
        success: false,
        message: "Stored brochure file is not a valid PDF",
      });
    }

    const safeName = fileName.replace(/"/g, "");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    res.setHeader("Cache-Control", "private, max-age=3600");

    return res.send(buffer);
  } catch (error) {
    console.error("Download brochure error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download brochure",
    });
  }
};

// GET SINGLE PROPERTY
export const getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const payload = property.toObject();
    if (payload.documentPdf?.url?.trim()) {
      const fileName = resolveBrochureFileName(payload);
      payload.documentPdf.fileName = fileName;
      payload.documentPdf.downloadUrl = getCloudinaryPdfDeliveryUrl(
        payload.documentPdf.url,
      );
    }

    return res.status(200).json({
      success: true,
      message: "Property fetched successfully",
      property: payload,
    });
  } catch (error) {
    console.error("Get property error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE PROPERTY
export const updateProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    const {
      title,
      description,
      category,
      propertyType,
      status,
      price,
      sizeSqft,
      referenceNumber,
      bedrooms,
      bathrooms,
      amenities,
      location,
      phone,
      whatsAppNumber,
      contactEmail,
      developerName,
      developerSlug,
      isFeatured,
      isActive,
      imageUrls,
      removeDocumentPdf,
    } = req.body;

    let images =
      parseExistingImages(req.body.existingImages) ||
      property.images.map((img) => ({
        url: img.url,
        isCover: Boolean(img.isCover),
      }));

    const imageFiles = getMulterImageFiles(req.files);
    if (imageFiles.length > 0) {
      try {
        const uploadPromises = imageFiles.map((file) =>
          uploadMulterFile(file, "properties", { resourceType: "image" }),
        );
        const uploadResults = await Promise.all(uploadPromises);
        const newImages = uploadResults
          .filter((result) => result?.secure_url)
          .map((result) => ({
            url: result.secure_url,
            isCover: false,
          }));
        images = [...images, ...newImages];
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload images",
          error: uploadError.message || uploadError,
        });
      }
    }

    const directImageUrls = parseImageUrls(imageUrls);
    if (directImageUrls.length > 0) {
      const urlImages = directImageUrls.map((url) => ({ url, isCover: false }));
      images = [...images, ...urlImages];
    }

    if (images.length > 0 && !images.some((img) => img.isCover)) {
      images[0].isCover = true;
    }

    let documentPdf = {
      url: property.documentPdf?.url || "",
      fileName: property.documentPdf?.fileName || "",
      downloadUrl: property.documentPdf?.downloadUrl || "",
      publicId: property.documentPdf?.publicId || "",
    };

    if (removeDocumentPdf === "true") {
      documentPdf = {
        url: "",
        fileName: "",
        downloadUrl: "",
        publicId: "",
      };
    }

    const pdfFile = getMulterPdfFile(req.files);
    if (pdfFile) {
      try {
        documentPdf = await uploadPropertyDocumentPdf(pdfFile);
      } catch (uploadError) {
        console.error("Property PDF upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message:
            uploadError.message ||
            "Failed to upload property PDF. Check Cloudinary configuration.",
          error: uploadError.message || String(uploadError),
        });
      }
    }

    const nextCategory = category || property.category;
    const updateData = {
      title: title ?? property.title,
      description: description ?? property.description,
      category: nextCategory,
      propertyType: propertyType ?? property.propertyType,
      status: status || property.status || "available",
      price: {
        amount: parseNumberField(price, property.price?.amount ?? 0),
        currency: "AED",
      },
      sizeSqft: parseNumberField(sizeSqft, property.sizeSqft ?? 0),
      referenceNumber: referenceNumber || property.referenceNumber,
      bedrooms: parseNumberField(bedrooms, property.bedrooms ?? 0),
      bathrooms: parseNumberField(bathrooms, property.bathrooms ?? 0),
      amenities:
        amenities != null ? parseAmenities(amenities) : property.amenities,
      images,
      documentPdf,
      location: location ?? property.location,
      phone: phone ?? property.phone,
      whatsAppNumber: whatsAppNumber ?? property.whatsAppNumber,
      contactEmail: contactEmail ?? property.contactEmail ?? "",
      developerName: isOffPlanCategory(nextCategory) ? developerName || "" : "",
      developerSlug: isOffPlanCategory(nextCategory) ? developerSlug || "" : "",
      isFeatured: parseBooleanField(isFeatured, Boolean(property.isFeatured)),
      isActive: parseBooleanField(
        isActive,
        property.isActive !== false,
      ),
    };

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).populate("createdBy", "name email");

    return res.status(200).json({
      success: true,
      message: "Property updated successfully",
      property: updatedProperty,
    });
  } catch (error) {
    console.error("Update property error:", error);
    if (error.code === 11000) {
      const key = error.keyPattern
        ? Object.keys(error.keyPattern).join(", ")
        : "field";
      const dropHints = {
        phone: "db.properties.dropIndex('phone_1')",
        whatsAppNumber: "db.properties.dropIndex('whatsAppNumber_1')",
      };
      const hint = dropHints[key];
      return res.status(409).json({
        success: false,
        message: hint
          ? `Duplicate ${key}. Restart server to drop legacy index, or: ${hint}`
          : `Duplicate value for unique field: ${key}`,
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// DELETE PROPERTY
export const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    await Property.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully",
    });
  } catch (error) {
    console.error("Delete property error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
