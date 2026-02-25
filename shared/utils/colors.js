/**
 * Tag color generation — deterministic, WCAG-safe pastel palette.
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
  // Curated pastel palette — soft, warm/cool mix, Basecamp-style
  const PALETTE = [
    [199, 228, 246], // soft blue
    [254, 215, 170], // peach
    [195, 232, 206], // mint
    [246, 198, 198], // rose
    [220, 208, 243], // lavender
    [254, 240, 179], // butter yellow
    [181, 228, 228], // teal
    [248, 206, 228], // pink
    [214, 229, 189], // sage
    [230, 214, 200], // warm sand
    [197, 220, 243], // periwinkle
    [252, 222, 200], // apricot
    [210, 235, 219], // seafoam
    [241, 206, 219], // blush
    [224, 220, 240], // soft violet
    [240, 234, 195], // wheat
    [195, 234, 234], // aqua
    [239, 213, 238], // orchid
    [226, 236, 204], // lime cream
    [219, 213, 230], // mauve
  ];

  const normalized = normalizeTag(tag);
  const hash = hashString(normalized);
  const [r, g, b] = PALETTE[hash % PALETTE.length];
  const lum = luminance(r, g, b);

  // Pick dark or white text based on WCAG contrast
  const crWhite = contrastRatio(1, lum);
  const crBlack = contrastRatio(lum, 0);
  const fg = crWhite >= crBlack ? '#fff' : '#3d4f5f';

  return { bg: `rgb(${r},${g},${b})`, fg };
}
