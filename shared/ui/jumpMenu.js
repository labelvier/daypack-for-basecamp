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

const RESULTS_ID = 'my-navigation-menu-listbox';
const CARD_LINK_RE = /\/card_tables\/cards\//;

// ──────────────────────────────────────────────
// Per-item rendering
// ──────────────────────────────────────────────

/**
 * Process a single nav menu result (li.nav-menu__result).
 *
 * DOM:
 *   <li class="nav-menu__result">
 *     <a class="nav-menu__link" href="…/card_tables/cards/…">
 *       <span class="nav-menu__icon nav-menu__icon--cards"></span>
 *       <span data-content-filter-target="ariaText">
 *         [Tag] Card title
 *         <span class="nav-menu__subtitle">Project name</span>
 *       </span>
 *     </a>
 *   </li>
 */
function processJumpMenuItem(liEl) {
  const linkEl = liEl.querySelector('a.nav-menu__link');
  if (!linkEl) return;

  if (!CARD_LINK_RE.test(linkEl.getAttribute('href') || '')) return;

  const ariaSpan = liEl.querySelector('[data-content-filter-target="ariaText"]');
  if (!ariaSpan) return;

  if (ariaSpan.dataset.bkfJumpProcessed) return;

  // Title text lives in text nodes only; subtitle is a child span — skip it
  let rawText = '';
  ariaSpan.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) rawText += node.textContent;
  });
  rawText = rawText.trim();

  const tags = extractTags(rawText);
  if (tags.length === 0) return;

  ariaSpan.dataset.bkfJumpProcessed = '1';

  const cleanText = rawText.replace(TAG_REGEX, '').trim();

  // Remove existing title text nodes (keep subtitle span)
  const textNodes = [];
  ariaSpan.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) textNodes.push(node);
  });
  textNodes.forEach((n) => n.remove());

  // Build pill + clean-text fragment
  const frag = document.createDocumentFragment();
  tags.forEach((tag) => {
    frag.appendChild(createTagPill(tag));
    frag.appendChild(document.createTextNode(' '));
  });
  if (cleanText) {
    frag.appendChild(document.createTextNode(cleanText + ' '));
  }

  // Insert before subtitle if present, otherwise append
  const subtitleSpan = ariaSpan.querySelector('.nav-menu__subtitle');
  if (subtitleSpan) {
    ariaSpan.insertBefore(frag, subtitleSpan);
  } else {
    ariaSpan.appendChild(frag);
  }

  log('Jump menu: processed card with tags:', tags);
}

/**
 * Process all card result items inside the jump menu container.
 */
function processJumpMenuResults(containerEl) {
  containerEl.querySelectorAll('li.nav-menu__result').forEach(processJumpMenuItem);
}

// ──────────────────────────────────────────────
// MutationObserver
// ──────────────────────────────────────────────

let _jumpMenuObserver = null;

/**
 * Start watching for the jump menu results container and process contents.
 * Safe to call multiple times — only one observer is ever active.
 */
export function initJumpMenuObserver() {
  if (_jumpMenuObserver) return;

  // Process any results already in the DOM
  const existing = document.getElementById(RESULTS_ID);
  if (existing) {
    log('Jump menu: found existing container, processing');
    processJumpMenuResults(existing);
  }

  _jumpMenuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // The results container itself was added
        if (node.id === RESULTS_ID) {
          log('Jump menu: container added to DOM');
          processJumpMenuResults(node);
          continue;
        }

        // Container found inside added node
        const containerEl = node.querySelector?.(`#${RESULTS_ID}`);
        if (containerEl) {
          log('Jump menu: container found inside added node');
          processJumpMenuResults(containerEl);
          continue;
        }

        // New li item added directly (search filtering replaces items)
        if (node.tagName === 'LI' && node.classList.contains('nav-menu__result')) {
          processJumpMenuItem(node);
          continue;
        }

        // Batch of items inside the results container
        if (node.closest?.(`#${RESULTS_ID}`)) {
          node.querySelectorAll?.('li.nav-menu__result').forEach(processJumpMenuItem);
        }
      }

      // Re-process on childList changes inside li items (search filtering updates text)
      if (mutation.type === 'childList') {
        const li = mutation.target.closest?.('li.nav-menu__result');
        if (li) {
          const ariaSpan = li.querySelector('[data-content-filter-target="ariaText"]');
          if (ariaSpan && !ariaSpan.dataset.bkfJumpProcessed) {
            processJumpMenuItem(li);
          }
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
 * Stop the jump menu observer.
 */
export function destroyJumpMenuObserver() {
  if (_jumpMenuObserver) {
    _jumpMenuObserver.disconnect();
    _jumpMenuObserver = null;
    log('Jump menu observer stopped');
  }
}
