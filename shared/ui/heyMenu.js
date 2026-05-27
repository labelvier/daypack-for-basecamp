/**
 * Hey menu tag pill rendering.
 *
 * Watches for Basecamp's Hey (notification) menu to open and injects
 * tag pills into reading items whose card titles contain [tag] syntax.
 * Only processes items that link to kanban card pages.
 */

import { log } from '../logger.js';
import { extractTags, TAG_REGEX } from '../utils/tags.js';
import { createTagPill } from './pills.js';

// ──────────────────────────────────────────────
// Selectors
// ──────────────────────────────────────────────

// BC4: navigation_readings | BC5: sidebar_frame (turbo-frame wrapping the sidebar panel)
const HEY_MENU_IDS = ['navigation_readings', 'sidebar_frame'];
const CARD_LINK_PATTERN = /\/card_tables\/cards\/\d+/;

// ──────────────────────────────────────────────
// Per-item rendering
// ──────────────────────────────────────────────

/**
 * Process a single reading article element.
 * If it links to a kanban card and the title contains [tags],
 * strip the brackets from the title text and inject pill elements.
 *
 * DOM structure inside article.reading for kanban card items:
 *   <a class="reading__link" href="/…/card_tables/cards/…">
 *     <div class="reading__avatar">…</div>
 *     <div class="reading__content">
 *       <h4 class="reading__description">
 *         <span class="sr-only">…</span>
 *         Card title with [Tag] here   ← text node we target
 *       </h4>
 *       …
 *     </div>
 *   </a>
 *
 * @param {Element} articleEl
 */
function processHeyMenuItem(articleEl) {
  const linkEl = articleEl.querySelector('a.reading__link');
  if (!linkEl) return;

  // Only process links to kanban card pages
  const href = linkEl.getAttribute('href') || '';
  if (!CARD_LINK_PATTERN.test(href)) return;

  const descEl = articleEl.querySelector('h4.reading__description');
  if (!descEl) return;

  // Guard against double-processing
  if (descEl.dataset.bkfHeyProcessed) return;

  // Extract the raw title text from the description element.
  // The h4 may contain an sr-only span ("Basecamp posted a kanban,") and
  // a text node with the actual title. We only want to process the text node(s).
  // Collect text from non-sr-only children only.
  let rawText = '';
  descEl.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      rawText += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('sr-only') && !node.classList.contains('bkf-tag-pill') && !node.classList.contains('bkf-hey-pill-row')) {
      rawText += node.textContent;
    }
  });
  rawText = rawText.trim();

  const tags = extractTags(rawText);
  if (tags.length === 0) {
    descEl.dataset.bkfHeyProcessed = 'none';
    return;
  }

  // Mark as processed before making changes
  descEl.dataset.bkfHeyProcessed = tags.join(',');

  // Replace [tag] brackets in-place inside each text node, preserving any
  // prefix text (e.g. "Re: ", "Due today: ") that comes before the tag.
  // We walk the child nodes and only touch text nodes (skipping sr-only spans).
  const textNodes = [];
  descEl.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) textNodes.push(node);
  });

  textNodes.forEach((textNode) => {
    const text = textNode.textContent;
    if (!TAG_REGEX.test(text)) return;
    TAG_REGEX.lastIndex = 0;

    // Split the text on [tag] occurrences and rebuild as a fragment
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    TAG_REGEX.lastIndex = 0;
    while ((match = TAG_REGEX.exec(text)) !== null) {
      // Text before this tag
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      // The pill
      frag.appendChild(createTagPill(match[1]));
      lastIndex = match.index + match[0].length;
    }
    // Remaining text after last tag
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.replaceWith(frag);
  });

  log('Hey menu: processed card reading with tags:', tags);
}

/**
 * Process all reading articles inside a given container element.
 * Used for both the Hey menu panel and the /my/readings full page.
 *
 * @param {Element} containerEl
 */
function processReadingArticles(containerEl) {
  containerEl.querySelectorAll('article.reading').forEach(processHeyMenuItem);
}

/**
 * Scan the entire document for reading articles and process them.
 * Called on the /my/readings full page where articles are in the main DOM.
 * Also sets up a MutationObserver for lazily-loaded articles (e.g. pagination).
 */
export function processReadingsPage() {
  log('Readings page: processing all reading articles');
  processReadingArticles(document);

  // Watch for additional articles loaded into the page (lazy/paginated)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'ARTICLE' && node.classList.contains('reading')) {
          processHeyMenuItem(node);
        } else {
          node.querySelectorAll?.('article.reading').forEach(processHeyMenuItem);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  log('Readings page: mutation observer started');
}

// ──────────────────────────────────────────────
// MutationObserver
// ──────────────────────────────────────────────

let _heyMenuObserver = null;

/**
 * Start watching for the Hey menu to open and process reading items.
 * Uses a MutationObserver on document.body.
 *
 * Safe to call multiple times — only one observer is ever active.
 */
export function initHeyMenuObserver() {
  if (_heyMenuObserver) return;

  // Process any readings already in DOM (covers BC5 sidebar always present on load)
  HEY_MENU_IDS.forEach((id) => {
    const existing = document.getElementById(id);
    if (existing) {
      log('Hey menu: found existing container #' + id + ', processing');
      processReadingArticles(existing);
    }
  });
  // BC5: sidebar may already have articles outside the known IDs
  const sidebarEl = document.querySelector('aside.sidebar');
  if (sidebarEl) processReadingArticles(sidebarEl);

  _heyMenuObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Known container added (BC4 navigation_readings or BC5 sidebar_frame)
        if (HEY_MENU_IDS.includes(node.id)) {
          log('Hey menu: container #' + node.id + ' added to DOM');
          processReadingArticles(node);
          continue;
        }

        // A known container found inside added node
        let matched = false;
        for (const id of HEY_MENU_IDS) {
          const containerEl = node.querySelector?.(`#${id}`);
          if (containerEl) {
            log('Hey menu: container #' + id + ' found inside added node');
            processReadingArticles(containerEl);
            matched = true;
            break;
          }
        }
        if (matched) continue;

        // A new article.reading was added (BC4 or BC5 dynamic load)
        if (node.tagName === 'ARTICLE' && node.classList.contains('reading')) {
          processHeyMenuItem(node);
          continue;
        }

        // Batch of articles inside any sidebar/reading container
        if (node.querySelectorAll) {
          node.querySelectorAll('article.reading').forEach(processHeyMenuItem);
        }
      }
    }
  });

  _heyMenuObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  log('Hey menu observer started');
}

/**
 * Stop the Hey menu observer (called on Turbo navigation cleanup).
 */
export function destroyHeyMenuObserver() {
  if (_heyMenuObserver) {
    _heyMenuObserver.disconnect();
    _heyMenuObserver = null;
    log('Hey menu observer stopped');
  }
}
