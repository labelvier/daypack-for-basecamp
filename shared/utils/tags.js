/**
 * Tag parsing, normalization, and display registry.
 */

// ──────────────────────────────────────────────
// Tag parsing & normalization
// ──────────────────────────────────────────────

/** Matches [tag] bracket syntax in text. Always reset lastIndex before use. */
export const TAG_REGEX = /\[([^\]]+)\]/g;

/**
 * Normalize a tag: strip whitespace, collapse internal spaces, lowercase.
 * E.g. "[ Fase  3 ]" → "fase 3", "Bug" → "bug"
 */
export function normalizeTag(tag) {
  return tag.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Registry of best display forms for normalized tags.
 * Preserves original casing from the DOM (e.g. "UX" stays "UX", not "Ux").
 */
export const tagDisplayRegistry = new Map();

/**
 * Register the original casing of a tag. Picks the best display form:
 * - Prefer forms with intentional casing (e.g. "UX" over "ux" or "Ux")
 * - First seen form wins for equal-quality forms
 */
export function registerTagDisplay(original) {
  const normalized = normalizeTag(original);
  const trimmed = original.trim().replace(/\s+/g, ' ');
  if (!tagDisplayRegistry.has(normalized)) {
    tagDisplayRegistry.set(normalized, trimmed);
  }
}

/**
 * Display label for a tag, preserving original casing from the DOM.
 * Falls back to title-casing each word.
 */
export function tagDisplayLabel(tag) {
  const n = normalizeTag(tag);
  if (tagDisplayRegistry.has(n)) return tagDisplayRegistry.get(n);
  // Fallback: title-case
  return n.replace(/\b(\w+)/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/**
 * Extract all tags from a text string. Returns array of normalized tag strings.
 * Also registers the original casing of each tag.
 */
export function extractTags(text) {
  const tags = [];
  let match;
  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(text)) !== null) {
    registerTagDisplay(match[1]);
    tags.push(normalizeTag(match[1]));
  }
  return tags;
}

/**
 * Escape a string for use in a RegExp.
 */
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
