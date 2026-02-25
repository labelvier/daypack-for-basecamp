/**
 * Basecamp Kanban Filter — entry point
 *
 * Content script that adds assignee/author/tag filter dropdowns to Basecamp card tables.
 * Also renders tag pills on card detail pages, and adds a tag editor UI in edit mode.
 *
 * Works on: Basecamp card_tables board pages + card detail pages + card edit pages
 *
 * This file is the esbuild entry point. All feature logic lives in the modules under shared/.
 * esbuild bundles everything into a single IIFE output for Chrome and Safari.
 */

'use strict';

import { log } from './logger.js';
import { CARD_WRAP_SELECTOR, EDIT_UI_ID } from './constants.js';
import { isKanbanBoard, isKanbanColumnPage, isCardDetailPage, isCardEditPage } from './utils/page.js';
import { renderTagPills, renderDetailPageTags } from './ui/pills.js';
import { injectEditUI } from './ui/edit.js';
import { injectFilterBar } from './filters/filterBar.js';
import { observeTitleH1 } from './observers.js';

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────

log('Content script loaded on:', window.location.href);

// Guard against multiple concurrent waitForCards loops (e.g. DOMContentLoaded + turbo:load)
let _boardInitPending = false;

function init() {
  log('init() called');

  // Card edit pages (full /edit URL): inject tag picker + live highlight
  if (isCardEditPage()) {
    let retries = 0;
    const tryInject = () => {
      const ok = injectEditUI();
      if (!ok) {
        retries++;
        if (retries < 20) setTimeout(tryInject, 300);
      }
    };
    tryInject();
    return;
  }

  // Card detail pages: render tag pills + watch for inline title editing
  if (isCardDetailPage()) {
    renderDetailPageTags();
    observeTitleH1();
    return;
  }

  // Column detail pages: render tag pills in card titles (same as board)
  if (isKanbanColumnPage()) {
    renderTagPills();
    return;
  }

  if (!isKanbanBoard()) {
    log('Not a kanban board, card detail, or card edit page, aborting init');
    return;
  }

  // Prevent multiple concurrent waitForCards polling loops
  if (_boardInitPending) {
    log('Board init already pending, skipping duplicate init');
    return;
  }
  _boardInitPending = true;

  let retryCount = 0;
  const waitForCards = () => {
    const cards = document.querySelectorAll(CARD_WRAP_SELECTOR);
    log(`waitForCards attempt #${retryCount + 1}: found ${cards.length} card wraps`);
    if (cards.length > 0) {
      _boardInitPending = false;
      injectFilterBar();
    } else {
      retryCount++;
      if (retryCount > 20) {
        _boardInitPending = false;
        log('Gave up waiting for cards after 20 attempts (10s)');
        return;
      }
      setTimeout(waitForCards, 500);
    }
  };

  waitForCards();
}

// ──────────────────────────────────────────────
// Bootstrap — DOMContentLoaded + Turbo events
// ──────────────────────────────────────────────

log('Document readyState:', document.readyState);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded fired');
    init();
  });
} else {
  log('Document already ready, running init immediately');
  init();
}

document.addEventListener('turbo:load', () => {
  log('turbo:load event fired');
  _boardInitPending = false; // Reset on navigation so a fresh init can run
  init();
});

document.addEventListener('turbo:render', () => {
  log('turbo:render event fired');
  _boardInitPending = false; // Reset on render so a fresh init can run
  init();
});

// Turbo Frames: fires when a frame finishes loading (e.g. inline title edit open/close)
document.addEventListener('turbo:frame-load', () => {
  log('turbo:frame-load event fired');
  if (isCardDetailPage() || isCardEditPage()) {
    const h1 = document.querySelector('h1.card-perma__title');
    const hasTextarea = h1 && !!h1.querySelector('textarea');
    if (hasTextarea) {
      // Edit form loaded inside frame — inject tag picker
      log('turbo:frame-load: edit mode detected, injecting edit UI');
      let retries = 0;
      const tryInject = () => {
        const ok = injectEditUI();
        if (!ok && retries < 10) { retries++; setTimeout(tryInject, 200); }
      };
      tryInject();
    } else {
      // View mode restored — re-render tag pills and reset observer
      log('turbo:frame-load: view mode detected, rendering detail tags');
      document.getElementById(EDIT_UI_ID)?.remove();
      renderDetailPageTags();
      observeTitleH1();
    }
  }
});
