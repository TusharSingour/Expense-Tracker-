/**
 * Canonical category definitions — colors drive charts, lists, and stored snapshots.
 */

/** @typedef {{ key: string; label: string; color: string; icon: string }} CategoryMeta */

/** @type {Record<string, CategoryMeta>} */
export const CATEGORY_META = {
  Food: { key: "Food", label: "Food", color: "#f97316", icon: "🍛" },
  Travel: { key: "Travel", label: "Travel", color: "#3b82f6", icon: "✈️" },
  Bills: { key: "Bills", label: "Bills", color: "#ef4444", icon: "📄" },
  Shopping: { key: "Shopping", label: "Shopping", color: "#a855f7", icon: "🛍️" },
  Health: { key: "Health", label: "Health", color: "#22c55e", icon: "❤️" },
  Education: { key: "Education", label: "Education", color: "#eab308", icon: "📚" },
  Other: { key: "Other", label: "Other", color: "#64748b", icon: "⋯" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_META);

/**
 * @param {string} name
 * @returns {CategoryMeta}
 */
export function getCategoryMeta(name) {
  return CATEGORY_META[name] || CATEGORY_META.Other;
}
