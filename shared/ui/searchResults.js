/**
 * Search results tag pill rendering.
 *
 * Injects tag pills into kanban card results on the /search page.
 * Handles infinite-scroll pagination via MutationObserver.
 */

import { log } from '../logger.js';
import { extractTags, TAG_REGEX } from '../utils/tags.js';
import { createTagPill } from './pills.js';

// ──────────────────────────────────────────────
// Per-item rendering
// ──────────────────────────────────────────────

/**
 * Process a single search result article (article.search-result--kanban).
 *
 * DOM:
 *   <article class="search-result search-result--kanban">
 *     <h4 class="search-result__title">
 *       <a class="decorated" href="…/card_tables/cards/…">
 *         [Tag] <mark class="circled-text"><span></span>title text</mark>
 *       </a>
 *     </h4>
 *   </article>
 *
 * @param {Element} articleEl
 */
function processSearchResultItem(articleEl) {
  const linkEl = articleEl.querySelector('h4.search-result__title a');
  if (!linkEl) return;

  if (linkEl.dataset.bkfSearchProcessed) return;

  // Collect title text from text nodes only (skip <mark> highlight spans)
  let rawText = '';
  linkEl.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) rawText += node.textContent;
  });
  rawText = rawText.trim();

  const tags = extractTags(rawText);
  if (tags.length === 0) {
    linkEl.dataset.bkfSearchProcessed = 'none';
    return;
  }

  linkEl.dataset.bkfSearchProcessed = tags.join(',');

  // Remove text nodes that contain tags; leave <mark> elements in place
  const textNodes = [];
  linkEl.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) textNodes.push(node);
  });
  textNodes.forEach((n) => n.remove());

  // Prepend pills + remaining text before the first child (the <mark> element)
  const cleanText = rawText.replace(TAG_REGEX, '').trim();
  const frag = document.createDocumentFragment();
  tags.forEach((tag) => {
    frag.appendChild(createTagPill(tag));
    frag.appendChild(document.createTextNode(' '));
  });
  if (cleanText) {
    frag.appendChild(document.createTextNode(cleanText + ' '));
  }

  linkEl.insertBefore(frag, linkEl.firstChild);

  log('Search results: processed card with tags:', tags);
}

/**
 * Process all kanban card results inside a container.
 *
 * @param {Element} containerEl
 */
function processSearchResults(containerEl) {
  containerEl.querySelectorAll('article.search-result--kanban').forEach(processSearchResultItem);
}

// ──────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────

/**
 * Process the search results page: render pills immediately and watch for
 * infinite-scroll additions.
 */
export function processSearchResultsPage() {
  log('Search results: processing page');
  processSearchResults(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.classList?.contains('search-result--kanban')) {
          processSearchResultItem(node);
        } else {
          node.querySelectorAll?.('article.search-result--kanban').forEach(processSearchResultItem);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  log('Search results: mutation observer started');
}
