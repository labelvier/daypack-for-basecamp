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
  const dueDateEl = document.getElementById('bkf-duedate');
  const dueStart = dueDateEl?.dataset.start;
  const dueEnd = dueDateEl?.dataset.end;
  const dueOverdue = dueDateEl?.dataset.overdue === 'true';
  return (a && a !== '__all__') || (b && b !== '__all__') || (t && t !== '__all__') || !!dueStart || !!dueEnd || dueOverdue;
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
 * Only shows (0/x) — columns with cards all filtered out; not truly empty columns (0/0).
 */
export function updateShadowcards() {
  // Derive containers from actual card wraps to avoid relying on specific class names.
  const containerMap = new Map();

  document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
    if (wrap.closest(COLLAPSED_COLUMN_SELECTOR)) return;
    const container = wrap.parentElement;
    if (!container) return;
    if (!containerMap.has(container)) containerMap.set(container, { total: 0, visible: 0 });
    const counts = containerMap.get(container);
    counts.total++;
    if (!wrap.classList.contains('bkf-hidden')) counts.visible++;
  });

  // Collect containers that need shadowcard shown.
  const showShadow = new Set();

  containerMap.forEach((counts, container) => {
    if (counts.total > 0 && counts.visible === 0) showShadow.add(container);
  });

  // Show shadowcard for filtered-empty containers.
  showShadow.forEach((container) => {
    let shadow = container.querySelector('.kanban-card--shadowcard');
    if (!shadow) {
      shadow = document.createElement('div');
      shadow.className = 'kanban-card--shadowcard';
      container.appendChild(shadow);
    }
    shadow.classList.add('bkf-shadowcard-visible');
    container.classList.add('bkf-has-shadowcard');
  });

  // Remove shadowcard from all other containers (cleanup stale ones too).
  document.querySelectorAll('.kanban-card--shadowcard').forEach((shadow) => {
    const container = shadow.parentElement;
    if (!container || showShadow.has(container)) return;
    shadow.classList.remove('bkf-shadowcard-visible');
    container.classList.remove('bkf-has-shadowcard');
  });
}
