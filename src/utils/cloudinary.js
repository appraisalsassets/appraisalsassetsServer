import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { Readable } from "stream";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

export const getCloudinaryConfigErrorMessage = () =>
  "Cloudinary is not configured on the server. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your Vercel project (Settings → Environment Variables), then redeploy.";

export const getCloudinaryAssetUrl = (result) =>
  result?.secure_url || result?.url || "";

/** Safe public_id for raw PDF uploads (extension required for correct delivery). */
/** Cloudinary blocks delivery (401) when public_id ends with ".pdf" — never include it. */
export function buildPdfPublicId(originalname) {
  let name = String(originalname || "property-brochure.pdf")
    .replace(/^.*[\\/]/, "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  if (!name) name = "property-brochure";
  return `${Date.now()}_${name}`;
}

function isPdfBuffer(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 4 &&
    buffer.subarray(0, 4).toString("utf8") === "%PDF"
  );
}

/** Legacy uploads used public_ids ending in ".pdf"; newer uploads omit the extension. */
function rawPublicIdCandidates(publicId) {
  const trimmed = String(publicId || "").trim();
  if (!trimmed) return [];

  const candidates = [trimmed];
  if (/\.pdf$/i.test(trimmed)) {
    candidates.push(trimmed.replace(/\.pdf$/i, ""));
  } else {
    candidates.push(`${trimmed}.pdf`);
  }

  return [...new Set(candidates)];
}

async function fetchCloudinaryRawViaPrivateDownload(publicId) {
  const candidates = rawPublicIdCandidates(publicId);
  if (!candidates.length) {
    throw new Error("Missing Cloudinary public_id");
  }

  let lastError = new Error("Cloudinary private download failed");

  for (const id of candidates) {
    try {
      const downloadUrl = cloudinary.utils.private_download_url(id, "pdf", {
        resource_type: "raw",
        type: "upload",
        attachment: true,
      });

      const response = await fetch(downloadUrl, {
        headers: { Accept: "application/pdf,application/octet-stream,*/*" },
      });
      if (!response.ok) {
        lastError = new Error(
          `Cloudinary private download failed (${response.status})`,
        );
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (!isPdfBuffer(buffer)) {
        lastError = new Error("Downloaded brochure is not a valid PDF");
        continue;
      }

      return buffer;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Cloudinary private download failed");
    }
  }

  throw lastError;
}

/** Cloudinary blocks public delivery for many PDFs (401) — verify via signed Admin download. */
export async function verifyCloudinaryPdfAccessible(publicId) {
  if (!publicId?.trim() || !isCloudinaryConfigured()) return false;
  try {
    const buffer = await fetchCloudinaryRawViaPrivateDownload(publicId);
    return isPdfBuffer(buffer);
  } catch {
    return false;
  }
}

/** Strip broken fl_attachment segments; delivery filename is set by our API. */
export function getCloudinaryPdfDeliveryUrl(url) {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) {
    return url;
  }
  return url.replace(/\/fl_attachment:[^/]+\//, "/");
}

/** Extract folder + public_id from a Cloudinary raw delivery URL. */
export function parseCloudinaryRawAsset(url) {
  if (!url?.includes("res.cloudinary.com")) return null;
  const path = url.split("?")[0];
  const match = path.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/i);
  if (!match) return null;
  return { publicId: decodeURIComponent(match[1]) };
}

async function fetchCloudinaryRawViaPublicUrl(deliveryUrl) {
  const response = await fetch(deliveryUrl, {
    headers: { Accept: "application/pdf,application/octet-stream,*/*" },
  });
  if (!response.ok) {
    throw new Error(`Cloudinary fetch failed (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!isPdfBuffer(buffer)) {
    throw new Error("Downloaded brochure is not a valid PDF");
  }
  return buffer;
}

/** Fetch raw PDF bytes (uses Cloudinary signed Admin download when configured). */
export async function fetchCloudinaryRawBuffer(url, publicIdOverride = "") {
  const deliveryUrl = getCloudinaryPdfDeliveryUrl(url);
  const asset = parseCloudinaryRawAsset(deliveryUrl || url || "");
  const publicId = (publicIdOverride || asset?.publicId || "").trim();

  if (publicId && isCloudinaryConfigured()) {
    try {
      return await fetchCloudinaryRawViaPrivateDownload(publicId);
    } catch (privateError) {
      if (!deliveryUrl) throw privateError;
      try {
        return await fetchCloudinaryRawViaPublicUrl(deliveryUrl);
      } catch {
        throw privateError;
      }
    }
  }

  if (!deliveryUrl) {
    throw new Error("Missing Cloudinary URL or public_id");
  }

  return fetchCloudinaryRawViaPublicUrl(deliveryUrl);
}

function buildUploadParams(folder, options = {}) {
  const resourceType = options.resourceType || "auto";
  const params = {
    resource_type: resourceType,
    folder,
    type: "upload",
    access_mode: "public",
    use_filename: Boolean(options.useFilename ?? true),
    unique_filename: Boolean(options.uniqueFilename ?? true),
  };

  if (options.publicId) {
    let id = String(options.publicId).replace(/^.*\//, "");
    if (resourceType === "raw") {
      id = id.replace(/\.pdf$/i, "");
      if (!id) id = `brochure_${Date.now()}`;
      params.public_id = id;
      params.display_name = id;
    } else {
      params.public_id = id.replace(/\.pdf$/i, "");
      if (options.format) {
        params.format = options.format;
      }
    }
    params.use_filename = false;
    params.unique_filename = false;
  } else if (options.format && resourceType !== "raw") {
    params.format = options.format;
  }

  return params;
}

export function uploadBufferToCloudinary(
  buffer,
  folder = "properties",
  options = {},
) {
  if (!buffer?.length) {
    return Promise.resolve(null);
  }

  if (!isCloudinaryConfigured()) {
    console.warn(getCloudinaryConfigErrorMessage());
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const uploadParams = buildUploadParams(folder, options);
    const stream = cloudinary.uploader.upload_stream(
      uploadParams,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    Readable.from(buffer).pipe(stream);
  });
}

/** Upload from disk path (local dev / legacy). */
export const uploadToCloudinary = async (
  localFilePath,
  folder = "properties",
  options = {},
) => {
  if (Buffer.isBuffer(localFilePath)) {
    return uploadBufferToCloudinary(localFilePath, folder, options);
  }

  try {
    if (!isCloudinaryConfigured()) {
      console.warn(getCloudinaryConfigErrorMessage());
      return null;
    }

    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(
      localFilePath,
      buildUploadParams(folder, options),
    );

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return response;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    if (typeof localFilePath === "string" && fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    throw error;
  }
};

/** Prefer multer memory buffer (Vercel/serverless); fall back to disk path. */
export async function uploadMulterFile(file, folder = "properties", options = {}) {
  if (!file) return null;

  if (!isCloudinaryConfigured()) {
    return null;
  }

  const uploadOptions = { ...options };
  if (uploadOptions.resourceType === "raw" && file.originalname) {
    uploadOptions.publicId =
      uploadOptions.publicId || buildPdfPublicId(file.originalname);
    uploadOptions.useFilename = false;
    uploadOptions.uniqueFilename = false;
  }

  if (file.buffer?.length) {
    return uploadBufferToCloudinary(file.buffer, folder, uploadOptions);
  }

  if (file.path) {
    return uploadToCloudinary(file.path, folder, uploadOptions);
  }

  return null;
}

export const uploadOnCloudinary = uploadToCloudinary;
