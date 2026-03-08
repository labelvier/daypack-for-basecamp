/**
 * Jump menu tag pill rendering.
 *
 * Watches for Basecamp's Cmd+J quick-jump menu to open and injects
 * tag pills into card result items whose titles contain [tag] syntax.
 */

import { log } from '../logger.js';
import { extractTags, TAG_REGEX } from '../utils/tags.js';
import { createTagPill } from './pills.js';

// ──────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────

const JUMP_MENU_RESULTS_ID = 'jump-menu__results';
const CARD_ICON_CLASS = 'jump-menu__icon--cards';

// ──────────────────────────────────────────────
// Per-item rendering
// ──────────────────────────────────────────────

/**
 * Process a single jump menu result article element.
 * If its link contains [tags] in the title, strips the brackets from the
 * aria span (so Basecamp's content filter still works) and injects pill
 * elements into the visible title span.
 *
 * DOM structure inside article.jump-menu__result for card items:
 *   <a data-role="content_filter_text">
 *     <span></span>                      ← icon/spacer
 *     <span>Card title text</span>       ← VISIBLE title (we inject pills here)
 *     ... search-highlight spans ...
 *     <span>Project name</span>
 *   </a>
 *   <span data-role="content_filter_aria_text">Card title text</span>
 *     ↑ Basecamp reads this for content filtering — keep as plain text
 *
 * @param {Element} articleEl
 */
function processJumpMenuItem(articleEl) {
  // Only process card results
  if (!articleEl.querySelector(`.${CARD_ICON_CLASS}`)) return;

  const ariaSpan = articleEl.querySelector('[data-role="content_filter_aria_text"]');
  if (!ariaSpan) return;

  // Inject pills into the VISIBLE title span (2nd child of content_filter_text <a>)
  const linkEl = articleEl.querySelector('[data-role="content_filter_text"]');
  if (!linkEl) return;

  const titleSpan = linkEl.children[1]; // span:nth-child(2) — the visible title
  if (!titleSpan) return;

  // Guard against double-processing on the visible title span.
  // We guard here (not on ariaSpan) because Basecamp owns ariaSpan and may
  // update its textContent during search filtering, but won't touch our attribute
  // on the visible titleSpan.
  if (titleSpan.dataset.bkfJumpProcessed) return;

  const rawText = ariaSpan.textContent.trim();
  const tags = extractTags(rawText);
  if (tags.length === 0) return;

  // Mark as processed before making changes
  titleSpan.dataset.bkfJumpProcessed = '1';

  // Strip [tag] brackets from the plain text in the aria span.
  // Keep it as plain text so Basecamp's content filter can read it correctly.
  const cleanText = rawText.replace(TAG_REGEX, '').trim();
  ariaSpan.textContent = cleanText;

  // Rebuild visible title: pills first, then remaining text
  titleSpan.textContent = '';

  tags.forEach((tag) => {
    titleSpan.appendChild(createTagPill(tag));
    titleSpan.appendChild(document.createTextNode(' '));
  });

  if (cleanText) {
    titleSpan.appendChild(document.createTextNode(cleanText));
  }
}

/**
 * Process all card result items inside a jump menu results container.
 *
 * @param {Element} resultsEl
 */
function processJumpMenuResults(resultsEl) {
  resultsEl.querySelectorAll('article.jump-menu__result').forEach(processJumpMenuItem);
}

// ──────────────────────────────────────────────
// MutationObserver
// ──────────────────────────────────────────────

let _jumpMenuObserver = null;

/**
 * Start watching for the jump menu results container and process its contents.
 * Uses a MutationObserver on document.body so we catch the element whenever
 * Basecamp renders it (first open and after searches update results).
 *
 * Safe to call multiple times — only one observer is ever active.
 */
export function initJumpMenuObserver() {
  if (_jumpMenuObserver) return;

  // Process any results already in the DOM (unlikely but safe)
  const existing = document.getElementById(JUMP_MENU_RESULTS_ID);
  if (existing) {
    log('Jump menu: found existing results, processing');
    processJumpMenuResults(existing);
  }

  _jumpMenuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes for the results container itself
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // The results div was added to the DOM
        if (node.id === JUMP_MENU_RESULTS_ID) {
          log('Jump menu: results container added to DOM');
          processJumpMenuResults(node);
          continue;
        }

        // A child was added inside an already-present results container
        const resultsEl = node.id === JUMP_MENU_RESULTS_ID
          ? node
          : node.querySelector?.(`#${JUMP_MENU_RESULTS_ID}`);
        if (resultsEl) {
          log('Jump menu: results container found inside added node');
          processJumpMenuResults(resultsEl);
          continue;
        }

        // New article items added directly to results (search filtering)
        if (node.tagName === 'ARTICLE' && node.classList.contains('jump-menu__result')) {
          processJumpMenuItem(node);
          continue;
        }

        // section/turbo-frame children added inside results
        const parent = node.closest?.(`#${JUMP_MENU_RESULTS_ID}`);
        if (parent) {
          node.querySelectorAll?.('article.jump-menu__result').forEach(processJumpMenuItem);
        }
      }

      // Also handle characterData / subtree changes — when Basecamp's content
      // filter updates the aria-text span text during search, we may need to
      // re-process. The guard is on the visible titleSpan, so check that.
      if (mutation.type === 'characterData' || mutation.type === 'childList') {
        const target = mutation.target;
        const articleEl = target.closest?.('article.jump-menu__result');
        if (!articleEl) continue;
        const linkEl = articleEl.querySelector('[data-role="content_filter_text"]');
        const titleSpan = linkEl?.children[1];
        if (titleSpan && !titleSpan.dataset.bkfJumpProcessed) {
          processJumpMenuItem(articleEl);
        }
      }
    }
  });

  _jumpMenuObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  log('Jump menu observer started');
}

/**
 * Stop the jump menu observer (called on Turbo navigation cleanup if needed).
 */
export function destroyJumpMenuObserver() {
  if (_jumpMenuObserver) {
    _jumpMenuObserver.disconnect();
    _jumpMenuObserver = null;
    log('Jump menu observer stopped');
  }
}
