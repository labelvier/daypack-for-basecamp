/**
 * Basecamp Kanban Filter — entry point
 *
 * Content script that adds assignee/author/tag filter dropdowns to Basecamp card tables.
 * Also renders tag pills on card detail pages, and adds a tag editor UI in edit mode.
 *
 * Works on: Basecamp card_tables board pages + individual column pages + card detail pages + card edit pages
 *
 * This file is the esbuild entry point. All feature logic lives in the modules under shared/.
 * esbuild bundles everything into a single IIFE output for Chrome and Safari.
 */

'use strict';

import { log } from './logger.js';
import { CARD_WRAP_SELECTOR, EDIT_UI_ID } from './constants.js';
import { isKanbanBoard, isKanbanColumnPage, isCardDetailPage, isCardEditPage, isReadingsPage } from './utils/page.js';
import { renderTagPills, renderDetailPageTags } from './ui/pills.js';
import { injectEditUI } from './ui/edit.js';
import { injectFilterBar } from './filters/filterBar.js';
import { observeTitleH1, startCardObserver, startLazyFrameObserver, destroyLazyFrameObserver } from './observers.js';
import { initJumpMenuObserver, destroyJumpMenuObserver } from './ui/jumpMenu.js';
import { initHeyMenuObserver, destroyHeyMenuObserver, processReadingsPage } from './ui/heyMenu.js';
import { startNewCardObserver, destroyNewCardObserver } from './ui/newCard.js';

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────

log('Content script loaded on:', window.location.href);

// Start the jump menu observer immediately — it runs on every page so that
// tag pills appear in Cmd+J results regardless of the current page context.
initJumpMenuObserver();

// Start the Hey menu observer immediately — it runs on every page so that
// tag pills appear in Hey (notification) menu reading items for kanban cards.
initHeyMenuObserver();

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

  // Readings page (/my/readings): render tag pills in kanban card reading items
  if (isReadingsPage()) {
    processReadingsPage();
    return;
  }

  // Column detail pages: render tag pills only — no filter bar.
  // Uses lazyFrameObserver (triggers card loading) and cardObserver (re-renders pills per batch).
  if (isKanbanColumnPage()) {
    startLazyFrameObserver();
    let retryCount = 0;
    const waitForColumnCards = () => {
      const cards = document.querySelectorAll(CARD_WRAP_SELECTOR);
      log(`waitForColumnCards attempt #${retryCount + 1}: found ${cards.length} card wraps`);
      if (cards.length > 0) {
        renderTagPills();
        startCardObserver();
      } else {
        retryCount++;
        if (retryCount < 20) setTimeout(waitForColumnCards, 500);
      }
    };
    waitForColumnCards();
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

  // Force-load all lazy turbo-frames so all cards are available for tag scanning
  startLazyFrameObserver();

  let retryCount = 0;
  const waitForCards = () => {
    const cards = document.querySelectorAll(CARD_WRAP_SELECTOR);
    const lazyFrames = document.querySelectorAll('turbo-frame[loading="lazy"]');
    log(`waitForCards attempt #${retryCount + 1}: found ${cards.length} card wraps, ${lazyFrames.length} lazy frames remaining`);
    if (cards.length > 0 && lazyFrames.length === 0) {
      _boardInitPending = false;
      destroyLazyFrameObserver();
      injectFilterBar();
      startNewCardObserver();
    } else {
      retryCount++;
      if (retryCount > 40) {
        _boardInitPending = false;
        destroyLazyFrameObserver();
        log('Gave up waiting for all lazy frames after 40 attempts (20s), injecting with partial cards');
        injectFilterBar();
        startNewCardObserver();
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
  // Re-init jump menu observer in case body was replaced by turbo:render
  destroyJumpMenuObserver();
  destroyHeyMenuObserver();
  destroyNewCardObserver();
  destroyLazyFrameObserver();
  initJumpMenuObserver();
  initHeyMenuObserver();
  init();
});

document.addEventListener('turbo:render', () => {
  log('turbo:render event fired');
  _boardInitPending = false; // Reset on render so a fresh init can run
  // turbo:render replaces document.body — re-attach the observer to the new body
  destroyJumpMenuObserver();
  destroyHeyMenuObserver();
  destroyNewCardObserver();
  destroyLazyFrameObserver();
  initJumpMenuObserver();
  initHeyMenuObserver();
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
