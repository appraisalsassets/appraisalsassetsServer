import Developer from "../models/Developer.js";
import Property from "../models/Property.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

function toSlug(value = "") {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function parseCommunities(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function withPropertyCounts(developers) {
  const list = Array.isArray(developers) ? developers : [developers];
  const enriched = await Promise.all(
    list.map(async (developer) => {
      const projectsCount = await Property.countDocuments({
        isActive: true,
        developerSlug: developer.slug,
      });
      return { ...developer.toJSON(), projectsCount };
    }),
  );
  return Array.isArray(developers) ? enriched : enriched[0];
}

export const getDevelopers = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const filter = { isActive: true };
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const developers = await Developer.find(filter).sort({
      displayOrder: 1,
      createdAt: -1,
    });
    const data = await withPropertyCounts(developers);

    return res.status(200).json({
      success: true,
      message: "Developers fetched successfully",
      developers: data,
    });
  } catch (error) {
    console.error("Get developers error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDevelopersAdmin = async (req, res) => {
  try {
    const developers = await Developer.find({}).sort({
      displayOrder: 1,
      createdAt: -1,
    });
    const data = await withPropertyCounts(developers);
    return res.status(200).json({
      success: true,
      message: "Admin developers fetched successfully",
      developers: data,
    });
  } catch (error) {
    console.error("Get admin developers error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getDeveloperBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const developer = await Developer.findOne({ slug, isActive: true });
    if (!developer) {
      return res.status(404).json({
        success: false,
        message: "Developer not found",
      });
    }

    const data = await withPropertyCounts(developer);
    return res.status(200).json({
      success: true,
      message: "Developer fetched successfully",
      developer: data,
    });
  } catch (error) {
    console.error("Get developer by slug error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createDeveloper = async (req, res) => {
  try {
    const { name, shortDescription, about, focus, displayOrder, isActive, communities } =
      req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Developer name is required",
      });
    }

    const slug = toSlug(name);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid developer name",
      });
    }

    const exists = await Developer.findOne({ slug });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "A developer with this name already exists",
      });
    }

    let logo = "";
    let heroImage = "";
    if (req.files?.logo?.[0]) {
      try {
        const uploaded = await uploadToCloudinary(req.files.logo[0].path, "developers");
        logo = uploaded?.secure_url || "";
      } catch (uploadError) {
        console.error("Developer logo upload error:", uploadError);
      }
    }
    if (req.files?.heroImage?.[0]) {
      try {
        const uploaded = await uploadToCloudinary(
          req.files.heroImage[0].path,
          "developers",
        );
        heroImage = uploaded?.secure_url || "";
      } catch (uploadError) {
        console.error("Developer hero image upload error:", uploadError);
      }
    }

    const developer = await Developer.create({
      name,
      slug,
      shortDescription: shortDescription || "",
      about: about || "",
      focus: focus || "",
      logo,
      heroImage,
      communities: parseCommunities(communities),
      displayOrder: Number(displayOrder || 0),
      isActive: isActive === "false" ? false : true,
      createdBy: req.admin._id,
    });

    return res.status(201).json({
      success: true,
      message: "Developer created successfully",
      developer,
    });
  } catch (error) {
    console.error("Create developer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateDeveloper = async (req, res) => {
  try {
    const { id } = req.params;
    const developer = await Developer.findById(id);
    if (!developer) {
      return res.status(404).json({
        success: false,
        message: "Developer not found",
      });
    }

    const { name, shortDescription, about, focus, displayOrder, isActive, communities } =
      req.body;

    if (name !== undefined) developer.name = name;
    if (shortDescription !== undefined) developer.shortDescription = shortDescription;
    if (about !== undefined) developer.about = about;
    if (focus !== undefined) developer.focus = focus;
    if (displayOrder !== undefined) developer.displayOrder = Number(displayOrder || 0);
    if (isActive !== undefined) developer.isActive = isActive === "true" || isActive === true;
    if (communities !== undefined) developer.communities = parseCommunities(communities);

    if (req.files?.logo?.[0]) {
      try {
        const uploaded = await uploadToCloudinary(req.files.logo[0].path, "developers");
        developer.logo = uploaded?.secure_url || developer.logo;
      } catch (uploadError) {
        console.error("Developer logo upload error:", uploadError);
      }
    }
    if (req.files?.heroImage?.[0]) {
      try {
        const uploaded = await uploadToCloudinary(
          req.files.heroImage[0].path,
          "developers",
        );
        developer.heroImage = uploaded?.secure_url || developer.heroImage;
      } catch (uploadError) {
        console.error("Developer hero image upload error:", uploadError);
      }
    }

    await developer.save();

    return res.status(200).json({
      success: true,
      message: "Developer updated successfully",
      developer,
    });
  } catch (error) {
    console.error("Update developer error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteDeveloper = async (req, res) => {
  try {
    const { id } = req.params;
    const developer = await Developer.findById(id);
    if (!developer) {
      return res.status(404).json({
        success: false,
        message: "Developer not found",
      });
    }

    await Developer.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Developer deleted successfully",
    });
  } catch (error) {
    console.error("Delete developer error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
