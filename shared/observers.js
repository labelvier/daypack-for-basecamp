/**
 * MutationObservers for tracking card DOM changes and inline title editing.
 */

import { log } from './logger.js';
import { CARD_WRAP_SELECTOR, EDIT_UI_ID } from './constants.js';
import { renderTagPills } from './ui/pills.js';
import { renderDetailPageTags } from './ui/pills.js';
import { injectEditUI } from './ui/edit.js';
import { isActivelyFiltering } from './filters/counts.js';
import { applyFilters } from './filters/filterBar.js';

// ──────────────────────────────────────────────
// MutationObserver for card DOM changes (drag & drop, new cards, etc.)
// ──────────────────────────────────────────────

let cardObserver = null;

/**
 * Start watching the board container for added/removed card nodes.
 * Debounces re-render + re-filter at 50ms.
 */
export function startCardObserver() {
  if (cardObserver) { cardObserver.disconnect(); cardObserver = null; }

  const board = document.querySelector('.kanban-columns, .panel--kanban-board, #main-content');
  if (!board) return;

  let debounce = null;
  cardObserver = new MutationObserver((mutations) => {
    // Only care about mutations that add article.kanban-card__wrap nodes
    const relevant = mutations.some((m) =>
      Array.from(m.addedNodes).some(
        (n) => n.nodeType === 1 && (
          n.matches?.(CARD_WRAP_SELECTOR) || n.querySelector?.(CARD_WRAP_SELECTOR)
        )
      )
    );
    if (!relevant) return;

    // Debounce: Turbo may add multiple cards in quick succession
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      log('cardObserver: new cards detected, re-rendering pills and re-applying filters');
      renderTagPills();
      if (isActivelyFiltering()) applyFilters();
    }, 50);
  });

  cardObserver.observe(board, { childList: true, subtree: true });
  log('cardObserver started on', board.tagName, board.className.slice(0, 40));
}

// ──────────────────────────────────────────────
// MutationObserver for inline title editing (detail page)
// ──────────────────────────────────────────────

let titleObserver = null;

/**
 * Watch the card-perma__title h1 for inline edit transitions:
 * - textarea appears  → inject tag picker UI
 * - textarea disappears (back to view mode) → re-render tag pills
 */
export function observeTitleH1() {
  // Clean up any previous observer
  if (titleObserver) {
    titleObserver.disconnect();
    titleObserver = null;
  }

  const titleH1 = document.querySelector('h1.card-perma__title');
  if (!titleH1) return;

  log('Detail page: attaching MutationObserver to h1.card-perma__title');

  let wasEditMode = !!titleH1.querySelector('textarea');

  // If already in edit mode at setup time, inject the UI immediately
  if (wasEditMode) {
    log('Detail page: h1 already in edit mode at observer setup, injecting UI');
    let retries = 0;
    const tryInject = () => {
      const ok = injectEditUI();
      if (!ok && retries < 10) { retries++; setTimeout(tryInject, 200); }
    };
    tryInject();
  }

  titleObserver = new MutationObserver(() => {
    const isEditMode = !!titleH1.querySelector('textarea');

    if (!wasEditMode && isEditMode) {
      // Switched to inline edit — inject the tag picker
      log('Detail page: inline edit opened (textarea appeared)');
      wasEditMode = true;
      let retries = 0;
      const tryInject = () => {
        const ok = injectEditUI();
        if (!ok && retries < 10) { retries++; setTimeout(tryInject, 200); }
      };
      tryInject();
    } else if (wasEditMode && !isEditMode) {
      // Switched back to view mode — re-render tag pills
      log('Detail page: inline edit closed (textarea gone), re-rendering pills');
      wasEditMode = false;
      // Remove stale edit UI if present
      document.getElementById(EDIT_UI_ID)?.remove();
      renderDetailPageTags();
    }
  });

  titleObserver.observe(titleH1, { childList: true, subtree: true });
}
