/**
 * Column counter and shadow-card updates when filtering is active.
 */

import { CARD_WRAP_SELECTOR, COLLAPSED_COLUMN_SELECTOR } from '../constants.js';

// ──────────────────────────────────────────────
// Column counter updates
// ──────────────────────────────────────────────

/** Stores the original (unfiltered) card count per column counter element ID. */
export const originalCounts = new Map();

/** Returns true if any filter dropdown has a non-__all__ value. */
export function isActivelyFiltering() {
  const a = document.getElementById('bkf-assignee')?.dataset.value;
  const b = document.getElementById('bkf-author')?.dataset.value;
  const t = document.getElementById('bkf-tag')?.dataset.value;
  return (a && a !== '__all__') || (b && b !== '__all__') || (t && t !== '__all__');
}

/**
 * Update column header counts to show (visible/total) while filtering,
 * or restore the original count when no filter is active.
 */
export function updateColumnCounts() {
  const isFiltering = isActivelyFiltering();

  document.querySelectorAll('.kanban-column__cards-number').forEach((countEl) => {
    if (!originalCounts.has(countEl.id)) {
      const origMatch = countEl.textContent.match(/\((\d+)\)/);
      if (origMatch) {
        originalCounts.set(countEl.id, parseInt(origMatch[1], 10));
      }
    }

    const column = countEl.closest('.kanban-column') || countEl.closest('.kanban-triage');
    if (!column) return;
    if (column.closest(COLLAPSED_COLUMN_SELECTOR)) return;

    const allWraps = column.querySelectorAll(CARD_WRAP_SELECTOR);
    const totalCount = allWraps.length;
    const visibleCount = Array.from(allWraps).filter(
      (w) => !w.classList.contains('bkf-hidden')
    ).length;

    if (isFiltering) {
      countEl.textContent = `(${visibleCount}/${totalCount})`;
    } else {
      const orig = originalCounts.get(countEl.id);
      countEl.textContent = orig !== undefined ? `(${orig})` : `(${totalCount})`;
    }
  });
}

/**
 * Show or hide placeholder "shadow" cards when all cards in a column are filtered away.
 */
export function updateShadowcards() {
  const containers = document.querySelectorAll('.kanban-column__cards, .kanban-triage__cards');

  containers.forEach((container) => {
    if (container.closest(COLLAPSED_COLUMN_SELECTOR)) return;

    const wraps = container.querySelectorAll(CARD_WRAP_SELECTOR);
    const visibleCount = Array.from(wraps).filter(
      (w) => !w.classList.contains('bkf-hidden')
    ).length;

    let shadow = container.querySelector('.kanban-card--shadowcard');

    if (visibleCount === 0) {
      if (!shadow) {
        shadow = document.createElement('div');
        shadow.className = 'kanban-card--shadowcard';
        container.appendChild(shadow);
      }
      shadow.classList.add('bkf-shadowcard-visible');
    } else if (shadow) {
      shadow.classList.remove('bkf-shadowcard-visible');
    }
  });
}
