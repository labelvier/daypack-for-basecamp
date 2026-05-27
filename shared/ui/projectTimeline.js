/**
 * Project timeline tag pill rendering.
 *
 * Injects tag pills into kanban card links in the project timeline snapshot
 * (homepage and project overview pages). Watches for dynamically rendered
 * or replaced timeline sections via MutationObserver.
 */

import { log } from '../logger.js';
import { extractTags, TAG_REGEX } from '../utils/tags.js';
import { createTagPill } from './pills.js';

const CARD_LINK_RE = /\/card_tables\/cards\//;

// ──────────────────────────────────────────────
// Per-link rendering
// ──────────────────────────────────────────────

/**
 * Process a single timeline item link.
 *
 * DOM:
 *   <div class="project-timeline-snapshot__content">
 *     Eric M. commented on
 *     <a class="decorated" href="…/card_tables/cards/…">[Tag] Card title</a>
 *   </div>
 */
function processTimelineLink(linkEl) {
  if (!CARD_LINK_RE.test(linkEl.getAttribute('href') || '')) return;
  if (linkEl.dataset.bkfTimelineProcessed) return;

  const rawText = linkEl.textContent.trim();
  const tags = extractTags(rawText);
  if (tags.length === 0) {
    linkEl.dataset.bkfTimelineProcessed = 'none';
    return;
  }

  linkEl.dataset.bkfTimelineProcessed = tags.join(',');

  const cleanText = rawText.replace(TAG_REGEX, '').trim();
  linkEl.textContent = '';

  tags.forEach((tag) => {
    linkEl.appendChild(createTagPill(tag));
    linkEl.appendChild(document.createTextNode(' '));
  });
  if (cleanText) {
    linkEl.appendChild(document.createTextNode(cleanText));
  }
}

/**
 * Process all card links inside a timeline container.
 */
function processTimeline(containerEl) {
  containerEl.querySelectorAll('a.decorated').forEach(processTimelineLink);
}

// ──────────────────────────────────────────────
// Observer
// ──────────────────────────────────────────────

let _timelineObserver = null;

/**
 * Start watching for project timeline snapshots anywhere in the document.
 * Runs on every page so the homepage and project overview pages are covered.
 * Safe to call multiple times — only one observer is ever active.
 */
export function initProjectTimelineObserver() {
  if (_timelineObserver) return;

  // Process any timelines already in the DOM
  document.querySelectorAll('section.project-timeline-snapshot').forEach(processTimeline);

  _timelineObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        if (node.classList?.contains('project-timeline-snapshot')) {
          processTimeline(node);
          continue;
        }
        node.querySelectorAll?.('section.project-timeline-snapshot').forEach(processTimeline);

        // Single link added inside an existing timeline
        if (node.classList?.contains('project-timeline-snapshot__item')) {
          node.querySelectorAll?.('a.decorated').forEach(processTimelineLink);
        }
      }
    }
  });

  _timelineObserver.observe(document.body, { childList: true, subtree: true });
  log('Project timeline observer started');
}

export function destroyProjectTimelineObserver() {
  if (_timelineObserver) {
    _timelineObserver.disconnect();
    _timelineObserver = null;
    log('Project timeline observer stopped');
  }
}
