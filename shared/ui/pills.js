/**
 * Tag pill rendering — board cards, detail pages.
 */

import { log } from '../logger.js';
import { TAG_REGEX, extractTags } from '../utils/tags.js';
import { tagColor } from '../utils/colors.js';
import { tagDisplayLabel } from '../utils/tags.js';

// ──────────────────────────────────────────────
// Tag pill creation
// ──────────────────────────────────────────────

/**
 * Create a pill element for a tag (takes normalized tag).
 */
export function createTagPill(tag) {
  const pill = document.createElement('span');
  pill.className = 'bkf-tag-pill';
  const colors = tagColor(tag);
  pill.style.backgroundColor = colors.bg;
  pill.style.color = colors.fg;
  pill.textContent = tagDisplayLabel(tag);
  return pill;
}

/**
 * Reconstruct the raw [Tag]-bearing title text from a link element
 * that may already have had pills injected into it.
 * Converts <span.bkf-tag-pill>Bug</span> back to "[Bug]" and concatenates text nodes.
 */
export function getRawTitleFromLink(linkEl) {
  let raw = '';
  linkEl.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      raw += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('bkf-tag-pill')) {
      // Convert pill back to bracket form using its display label
      raw += `[${node.textContent.trim()}]`;
    }
  });
  return raw.trim();
}

// ──────────────────────────────────────────────
// Board-page pill rendering
// ──────────────────────────────────────────────

/**
 * Replace [tag] text in card titles with styled pill elements.
 * Pills are rendered in a separate div.bkf-pill-row inserted before the title element,
 * so the title text retains its full available space and is not truncated.
 * Only processes titles not yet processed (marked with data-bkf-tags).
 */
export function renderTagPills() {
  document.querySelectorAll('.kanban-card__title').forEach((titleEl) => {
    if (titleEl.dataset.bkfTags) return; // already processed

    const originalText = titleEl.textContent;
    const tags = extractTags(originalText);
    if (tags.length === 0) {
      titleEl.dataset.bkfTags = 'none';
      return;
    }

    titleEl.dataset.bkfTags = tags.join(',');

    // Strip [tag] brackets from the title text, leaving only the clean title
    const remainingText = originalText.replace(TAG_REGEX, '').trim();
    titleEl.textContent = remainingText;

    // Keep the title attribute clean (without brackets)
    const titleAttr = titleEl.getAttribute('title');
    if (titleAttr) {
      titleEl.setAttribute('title', titleAttr.replace(TAG_REGEX, '').trim());
    }

    // Insert a pill row as a sibling directly before the title element,
    // so pills don't consume space inside the title and cause text truncation.
    const pillRow = document.createElement('div');
    pillRow.className = 'bkf-pill-row';
    tags.forEach((tag) => {
      pillRow.appendChild(createTagPill(tag));
    });

    titleEl.parentNode.insertBefore(pillRow, titleEl);
  });
}

// ──────────────────────────────────────────────
// Detail-page pill rendering
// ──────────────────────────────────────────────

/**
 * Render tag pills on card detail pages.
 * Targets the h1.card-perma__title > a element.
 * Skips if the title is in edit mode (form/input present).
 * Always re-renders on each call (handles Turbo navigation back from edit).
 */
export function renderDetailPageTags() {
  // BC5 renamed class to perma-header__title; support both.
  const titleH1 = document.querySelector('h1.perma-header__title, h1.card-perma__title');
  if (!titleH1) {
    log('Detail page: no h1.perma-header__title / h1.card-perma__title found');
    return;
  }

  // Skip if in edit mode (form or input present in the area)
  if (titleH1.querySelector('input, textarea, form')) {
    log('Detail page: title is in edit mode, skipping');
    return;
  }

  const titleLink = titleH1.querySelector('a[href*="/edit?focus=kanban_card_title"]');

  // Archived cards have no edit link — title is a plain <div> child instead.
  const titleContainer = titleLink || titleH1.querySelector('div');
  if (!titleContainer) {
    log('Detail page: no title container found');
    return;
  }

  // Reconstruct the raw text from the current content.
  // getRawTitleFromLink works on any element — converts pill spans back to [Tag] form.
  const rawText = getRawTitleFromLink(titleContainer);
  log('Detail page: raw title text:', rawText);

  const tags = extractTags(rawText);

  // Reset the container to plain raw text, then re-render
  titleContainer.textContent = rawText;

  if (tags.length === 0) {
    titleH1.dataset.bkfTags = 'none';
    log('Detail page: no tags found in title');
    return;
  }

  titleH1.dataset.bkfTags = tags.join(',');

  // Build new content: pills first, then remaining text
  const remainingText = rawText.replace(TAG_REGEX, '').trim();

  titleContainer.textContent = '';

  tags.forEach((tag) => {
    titleContainer.appendChild(createTagPill(tag));
    titleContainer.appendChild(document.createTextNode(' '));
  });

  if (remainingText) {
    titleContainer.appendChild(document.createTextNode(remainingText));
  }

  log('Detail page: rendered', tags.length, 'tag pill(s)');
}
