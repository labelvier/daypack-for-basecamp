/**
 * Activity feed tag pill rendering.
 *
 * Injects tag pills into kanban card links in:
 * - Project timeline snapshots (project overview pages)
 * - Latest Activity feed (/activity)
 */

import { log } from '../logger.js';
import { extractTags, TAG_REGEX } from '../utils/tags.js';
import { createTagPill } from './pills.js';

const CARD_LINK_RE = /\/card_tables\/cards\//;

// ──────────────────────────────────────────────
// Per-link rendering
// ──────────────────────────────────────────────

/**
 * Process a single card link — works for both timeline and activity feed.
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
 * Process all card links inside a container element.
 */
function processContainer(containerEl) {
  containerEl.querySelectorAll('a.decorated').forEach(processTimelineLink);
}

/**
 * Scan the full document for all known activity containers.
 */
function processAll() {
  // Project overview timeline snapshots
  document.querySelectorAll('section.project-timeline-snapshot').forEach(processContainer);
  // /activity page day lists
  document.querySelectorAll('div.today-events-list').forEach(processContainer);
}

// ──────────────────────────────────────────────
// Observer
// ──────────────────────────────────────────────

let _timelineObserver = null;

/**
 * Start watching for timeline and activity feed containers.
 * Runs on every page. Safe to call multiple times.
 */
export function initProjectTimelineObserver() {
  if (_timelineObserver) return;

  processAll();

  _timelineObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Project timeline snapshot added
        if (node.classList?.contains('project-timeline-snapshot')) {
          processContainer(node);
          continue;
        }

        // Activity feed day list added
        if (node.classList?.contains('today-events-list')) {
          processContainer(node);
          continue;
        }

        // Individual activity item added (infinite scroll / live update)
        if (node.classList?.contains('today-events-list__item') ||
            node.classList?.contains('project-timeline-snapshot__item')) {
          node.querySelectorAll?.('a.decorated').forEach(processTimelineLink);
          continue;
        }

        // Container found inside added node
        node.querySelectorAll?.('section.project-timeline-snapshot, div.today-events-list')
          .forEach(processContainer);
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
