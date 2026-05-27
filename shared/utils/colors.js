/**
 * Tag color generation — deterministic, WCAG-safe palette.
 * Colors sourced from BC5's named color vocabulary.
 */

import { normalizeTag } from './tags.js';

// ──────────────────────────────────────────────
// Color utilities
// ──────────────────────────────────────────────

/**
 * FNV-1a hash — much better distribution for short, similar strings
 * than djb2. Returns a positive 32-bit integer.
 */
export function hashString(str) {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0;
}

/**
 * Relative luminance per WCAG 2.1.
 */
export function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG contrast ratio between two luminances.
 */
export function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generate a pastel background color from a tag string.
 * Uses a curated palette of soft Basecamp-style pastels with dark text.
 * Returns { bg: 'rgb(r,g,b)', fg: '#...' }
 */
export function tagColor(tag) {
  // BC5 color-picker hues at 88% lightness — all verified WCAG AA (≥4.5:1, dark text)
  const PALETTE = [
    [254, 241, 194], // yellow
    [255, 230, 194], // orange
    [254, 207, 194], // red
    [249, 199, 230], // pink
    [216, 197, 252], // purple
    [194, 225, 255], // blue
    [212, 237, 219], // green
    [231, 225, 218], // sand
  ];

  const normalized = normalizeTag(tag);
  const hash = hashString(normalized);
  const [r, g, b] = PALETTE[hash % PALETTE.length];
  const lum = luminance(r, g, b);

  // Compare against actual text colors (not pure black) for accurate WCAG pick
  const L_DARK = 0.0741; // luminance of #3d4f5f
  const crDark = contrastRatio(lum, L_DARK);
  const crWhite = contrastRatio(1, lum);
  const fg = crDark >= crWhite ? '#3d4f5f' : '#fff';

  return { bg: `rgb(${r},${g},${b})`, fg };
}
