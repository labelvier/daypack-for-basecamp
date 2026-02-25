/**
 * DOM scanning — reads card data from the live Basecamp board DOM.
 * All functions are read-only: they query and return data, never modify the DOM.
 */

import { CARD_WRAP_SELECTOR, COLLAPSED_COLUMN_SELECTOR } from '../constants.js';
import { extractTags } from '../utils/tags.js';
import { parseAuthorName, matchAuthorToAssignee } from '../utils/names.js';

// ──────────────────────────────────────────────
// Card & column helpers
// ──────────────────────────────────────────────

/** Returns true if a card wrap is inside a collapsed kanban column. */
export function isInCollapsedColumn(wrapEl) {
  return wrapEl.closest(COLLAPSED_COLUMN_SELECTOR) !== null;
}

/** Returns the assignee person-ID strings for a card wrap. */
export function getCardAssigneeIds(wrapEl) {
  const imgs = wrapEl.querySelectorAll('.kanban-card__assignee img[data-avatar-for-person-id]');
  return Array.from(imgs).map((img) => img.dataset.avatarForPersonId);
}

/** Returns true when a card has no assignees. */
export function isUnassigned(wrapEl) {
  return getCardAssigneeIds(wrapEl).length === 0;
}

/** Returns the abbreviated author name for a card wrap, or null. */
export function getCardAuthorName(wrapEl) {
  const authorEl = wrapEl.querySelector('.kanban-card__author');
  if (!authorEl) return null;
  return parseAuthorName(authorEl.textContent);
}

/**
 * Get tags from a card wrap element.
 * Reads from the data-bkf-tags cache on the title element if available.
 */
export function getCardTags(wrapEl) {
  const titleEl = wrapEl.querySelector('.kanban-card__title');
  if (!titleEl) return [];
  const stored = titleEl.dataset.bkfTags;
  if (stored && stored !== 'none') return stored.split(',');
  if (stored === 'none') return [];
  return extractTags(titleEl.textContent);
}

// ──────────────────────────────────────────────
// Board-level scans
// ──────────────────────────────────────────────

/**
 * Scan all card wraps for tags.
 * Returns a Map of normalized tag → count.
 */
export function scanTags() {
  const tagCounts = new Map();
  document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
    if (isInCollapsedColumn(wrap)) return;
    const titleEl = wrap.querySelector('.kanban-card__title');
    if (!titleEl) return;

    const stored = titleEl.dataset.bkfTags;
    let cardTags = [];
    if (stored && stored !== 'none') {
      cardTags = stored.split(',');
    } else if (!stored) {
      cardTags = extractTags(titleEl.textContent);
    }
    cardTags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
  });
  return tagCounts;
}

/**
 * Scan all card wraps for assignees and authors.
 * Returns { assignees: Map, authors: Map, unassignedCount: number }.
 */
export function scanPersons() {
  const assigneeMap = new Map();
  const authorMap = new Map(); // key = abbreviated name, value = { name, count }

  document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
    if (isInCollapsedColumn(wrap)) return;

    wrap.querySelectorAll('.kanban-card__assignee img[data-avatar-for-person-id]').forEach((img) => {
      const id = img.dataset.avatarForPersonId;
      if (!assigneeMap.has(id)) {
        assigneeMap.set(id, { id, name: img.alt || 'Unknown', src: img.src, count: 0 });
      }
      assigneeMap.get(id).count++;
    });

    const authorEl = wrap.querySelector('.kanban-card__author');
    if (authorEl) {
      const name = parseAuthorName(authorEl.textContent);
      if (name) {
        if (!authorMap.has(name)) {
          authorMap.set(name, { name, count: 0 });
        }
        authorMap.get(name).count++;
      }
    }
  });

  // Count unassigned cards
  let unassignedCount = 0;
  document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
    if (isInCollapsedColumn(wrap)) return;
    if (isUnassigned(wrap)) unassignedCount++;
  });

  // Map authors to assignees for avatar + full name
  for (const [abbrev, authorData] of authorMap) {
    const matched = matchAuthorToAssignee(abbrev, assigneeMap);
    if (matched) {
      authorData.fullName = matched.name;
      authorData.avatarSrc = matched.src;
    }
  }

  return { assignees: assigneeMap, authors: authorMap, unassignedCount };
}
