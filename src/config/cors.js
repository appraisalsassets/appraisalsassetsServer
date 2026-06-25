const DEFAULT_ALLOWED_ORIGINS = [
  "https://appraisalsassets-client-g2nn-p31kdjqom.vercel.app",
  "https://appraisalsassets-client-delta-v2-s14b9q8i4.vercel.app",
  "https://appraisalsassets-client-delta.vercel.app",
  "https://www.assetsappraisals.com",
  "https://assetsappraisals.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
];

function normalizeOrigin(origin = "") {
  return String(origin).trim().replace(/\/$/, "");
}

export function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  const frontendUrl = normalizeOrigin(process.env.FRONTEND_URL || "");

  return [
    ...new Set([
      ...DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin),
      ...fromEnv,
      ...(frontendUrl ? [frontendUrl] : []),
    ]),
  ];
}

export function isOriginAllowed(origin) {
  const cleanOrigin = normalizeOrigin(origin);
  if (!cleanOrigin) return true;
  return getAllowedOrigins().includes(cleanOrigin);
}

export function resolveAllowedOrigin(origin) {
  const cleanOrigin = normalizeOrigin(origin);
  if (!cleanOrigin) return getAllowedOrigins()[0] || "";
  return isOriginAllowed(cleanOrigin) ? cleanOrigin : "";
}

export const corsAllowHeaders = [
  "Content-Type",
  "Authorization",
  "Accept",
  "Origin",
  "X-Requested-With",
];

export const corsAllowMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

export function applyCorsHeaders(res, origin) {
  const allowedOrigin = resolveAllowedOrigin(origin);
  if (!allowedOrigin) return false;

  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", corsAllowMethods.join(","));
  res.setHeader("Access-Control-Allow-Headers", corsAllowHeaders.join(","));
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  return true;
}

export function createExpressCorsOptions() {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: corsAllowMethods,
    allowedHeaders: corsAllowHeaders,
  };
}
