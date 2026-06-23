/** Normalize category text (e.g. "Off-Plan", "off plan") to a comparable key. */
export function normalizeCategoryKey(value = "") {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isOffPlanCategory(value = "") {
  const key = normalizeCategoryKey(value);
  return key === "off_plan" || key === "offplan" || key.includes("off_plan");
}

/** Map legacy/variant values to the canonical category stored in forms and filters. */
export function normalizePropertyCategory(value = "") {
  const key = normalizeCategoryKey(value);
  if (!key) return "";

  if (
    key === "for_sale" ||
    key === "sale" ||
    key === "forsale" ||
    key === "buy"
  ) {
    return "for_sale";
  }

  if (
    key === "for_rent" ||
    key === "for_rental" ||
    key === "rent" ||
    key === "rental"
  ) {
    return "for_rent";
  }

  if (isOffPlanCategory(key)) {
    return "off_plan";
  }

  if (key === "commercial") {
    return "commercial";
  }

  return key;
}

export function categoryMatches(stored = "", filter = "") {
  if (!filter) return true;
  return (
    normalizePropertyCategory(stored) === normalizePropertyCategory(filter)
  );
}

/** All DB values that should match a canonical category filter. */
export function categoryFilterValues(filter = "") {
  const canonical = normalizePropertyCategory(filter);
  const aliases = {
    for_sale: ["for_sale", "sale", "forsale", "buy"],
    for_rent: ["for_rent", "for_rental", "rent", "rental"],
    off_plan: ["off_plan", "offplan", "off-plan"],
    commercial: ["commercial"],
  };

  const variants = aliases[canonical] || [canonical];
  return [...new Set([canonical, ...variants, normalizeCategoryKey(filter)])].filter(
    Boolean,
  );
}

export const CATEGORY_LABELS = {
  for_sale: "For Sale",
  for_rent: "For Rent",
  off_plan: "Off-Plan",
  commercial: "Commercial",
};

export function getCategoryLabel(value = "") {
  const canonical = normalizePropertyCategory(value);
  return CATEGORY_LABELS[canonical] || String(value).replace(/_/g, " ");
}
