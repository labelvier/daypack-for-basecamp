/**
 * Card edit page UI — tag picker strip and live [tag] highlight backdrop.
 */

import { log } from '../logger.js';
import { EDIT_UI_ID } from '../constants.js';
import { tagColor } from '../utils/colors.js';
import { tagDisplayLabel, normalizeTag, escapeRegExp } from '../utils/tags.js';
import { loadTagsFromSession, appendNewTagsToSession } from '../data/persistence.js';

// ──────────────────────────────────────────────
// Card edit page: tag picker + live highlight
// ──────────────────────────────────────────────

/**
 * Inject the tag editor UI on card edit pages.
 * - Tag picker strip: known tags as clickable pills → prepend to title input
 * - Live [tag] highlight: backdrop overlay that colors [tag] text as you type
 * - Hint text: how to add tags
 */
export function injectEditUI() {
  if (document.getElementById(EDIT_UI_ID)) return;

  // Find the title input (Basecamp uses an <input type="text"> for card titles)
  const titleInput = findTitleInput();
  if (!titleInput) {
    log('Edit page: no title input found, retrying...');
    return false;
  }

  log('Edit page: found title input:', titleInput.tagName, titleInput.className);

  const knownTags = loadTagsFromSession();
  log('Edit page: known tags from session:', knownTags);

  // Wrapper injected above the title input's parent row
  const ui = document.createElement('div');
  ui.id = EDIT_UI_ID;
  ui.className = 'bkf-edit-ui';

  // --- Tag picker strip ---
  if (knownTags.length > 0) {
    const picker = document.createElement('div');
    picker.className = 'bkf-edit-picker';

    const pickerLabel = document.createElement('span');
    pickerLabel.className = 'bkf-edit-picker__label';
    pickerLabel.textContent = 'Tags:';
    picker.appendChild(pickerLabel);

    const pillsWrap = document.createElement('span');
    pillsWrap.className = 'bkf-edit-picker__pills';

    knownTags
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .forEach((tag) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'bkf-tag-pill bkf-edit-picker__pill';
        const colors = tagColor(tag);
        pill.style.backgroundColor = colors.bg;
        pill.style.color = colors.fg;
        pill.textContent = tagDisplayLabel(tag);
        pill.title = `Prepend [${tagDisplayLabel(tag)}] to the title`;

        pill.addEventListener('click', (e) => {
          e.preventDefault();
          prependTag(titleInput, tag);
          titleInput.focus();
        });

        pillsWrap.appendChild(pill);
      });

    picker.appendChild(pillsWrap);
    ui.appendChild(picker);
  }

  // --- Hint text ---
  const hint = document.createElement('p');
  hint.className = 'bkf-edit-hint';
  hint.innerHTML = 'Tip: add <code>[Tag]</code> to the card title to create a tag.';
  ui.appendChild(hint);

  // Inject UI just before the title input's container
  const container = getTitleContainer(titleInput);
  container.parentNode.insertBefore(ui, container);

  // --- Live highlight backdrop ---
  setupLiveHighlight(titleInput);

  return true;
}

/**
 * Find the title input on the card edit page.
 * Tries common selectors Basecamp uses.
 */
export function findTitleInput() {
  // Basecamp uses a textarea with aria-label="Card title"
  const candidates = [
    'textarea[aria-label="Card title"]',
    'textarea[name="recording[title]"]',
    'textarea[name="kanban_card[title]"]',
    'input[aria-label="Card title"]',
    'input[name="recording[title]"]',
    'input[name="kanban_card[title]"]',
    '.todo__title textarea',
    '.todo__title input[type="text"]',
  ];

  for (const sel of candidates) {
    // Prefer the element that already has content (skip ghost/resize twins)
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      if (el.value && el.value.trim().length > 0) return el;
    }
    if (els.length > 0) return els[0];
  }
  return null;
}

/**
 * Get the container element to insert the UI before.
 * On Basecamp edit pages the textarea is inside h1.card-perma__title,
 * so we want to insert before that h1 (within its parent span.checkbox__content).
 */
export function getTitleContainer(input) {
  // Prefer the h1 that contains the title textarea
  const h1 = input.closest('h1');
  if (h1) return h1;
  // Fallback: walk up max 5 levels looking for a block container
  let el = input.parentElement;
  for (let i = 0; i < 5; i++) {
    if (!el || !el.parentElement) break;
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'label' || tag === 'fieldset' ||
        el.classList.contains('todo__title') || el.classList.contains('card-perma__title')) {
      return el;
    }
    el = el.parentElement;
  }
  return input.parentElement;
}

/**
 * Prepend [Tag] to the title input value, avoiding duplicates.
 */
export function prependTag(input, normalizedTag) {
  const label = tagDisplayLabel(normalizedTag);
  const bracket = `[${label}]`;
  const current = input.value;
  // Remove existing instance of this tag if already present
  const cleaned = current.replace(new RegExp(`\\[${escapeRegExp(label)}\\]\\s*`, 'i'), '').trim();
  const newValue = bracket + ' ' + cleaned;

  // Clear via ID first (Basecamp tracks this element by ID),
  // then insert the new value as a user action via execCommand.
  const byId = document.getElementById('kanban_card_title');
  const target = byId || input;
  target.focus();
  target.value = '';
  document.execCommand('insertText', false, newValue);

  updateHighlight(input);
}

/**
 * Set up the live [tag] highlight backdrop behind the title input/textarea.
 * Uses the standard "fake highlight" technique:
 * a positioned div mirrors the input text, with [tag] spans colored.
 */
export function setupLiveHighlight(input) {
  const isTextarea = input.tagName.toLowerCase() === 'textarea';

  // Wrap input in a relative container
  const wrapper = document.createElement('div');
  wrapper.className = 'bkf-input-wrap';
  wrapper.style.position = 'relative';
  wrapper.style.display = 'block';

  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  // The backdrop (sits behind the input)
  const backdrop = document.createElement('div');
  backdrop.className = 'bkf-input-backdrop';
  wrapper.insertBefore(backdrop, input);

  // Match input styles precisely
  syncBackdropStyles(input, backdrop, isTextarea);

  // Update on every keystroke + persist any newly typed tags to sessionStorage
  input.addEventListener('input', () => {
    updateHighlight(input, backdrop);
    appendNewTagsToSession(input.value);
  });

  // Sync scroll (horizontal for input, vertical for textarea)
  input.addEventListener('scroll', () => {
    if (isTextarea) {
      backdrop.scrollTop = input.scrollTop;
    } else {
      backdrop.scrollLeft = input.scrollLeft;
    }
  });

  // Initial render
  updateHighlight(input, backdrop);

  // Store reference for prepend updates
  input._bkfBackdrop = backdrop;
}

/**
 * Copy key CSS properties from the input/textarea to the backdrop div.
 */
export function syncBackdropStyles(input, backdrop, isTextarea) {
  const cs = window.getComputedStyle(input);
  const props = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'width', 'boxSizing',
  ];
  props.forEach((prop) => {
    backdrop.style[prop] = cs[prop];
  });
  backdrop.style.position = 'absolute';
  backdrop.style.top = '0';
  backdrop.style.left = '0';
  backdrop.style.overflowX = 'hidden';
  backdrop.style.overflowY = 'hidden';
  backdrop.style.pointerEvents = 'none';
  backdrop.style.zIndex = '0';
  backdrop.style.color = 'transparent';
  backdrop.style.background = 'transparent';
  backdrop.style.borderColor = 'transparent';

  if (isTextarea) {
    // Textarea: wrap text, match height
    backdrop.style.whiteSpace = 'pre-wrap';
    backdrop.style.wordBreak = 'break-word';
    backdrop.style.height = cs.height;
  } else {
    // Single-line input: no wrap, fixed height
    backdrop.style.whiteSpace = 'pre';
    backdrop.style.height = cs.height;
  }
}

/**
 * Update the backdrop content to highlight [tag] patterns.
 */
export function updateHighlight(input, backdrop) {
  const bd = backdrop || input._bkfBackdrop;
  if (!bd) return;

  const text = input.value;
  bd.innerHTML = '';

  let lastIndex = 0;
  const regex = /\[([^\]]+)\]/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    // Text before the match
    if (m.index > lastIndex) {
      bd.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
    }
    // Highlighted tag span
    const span = document.createElement('mark');
    span.className = 'bkf-input-tag-highlight';
    const normalized = normalizeTag(m[1]);
    const colors = tagColor(normalized);
    span.style.backgroundColor = colors.bg;
    span.style.color = colors.fg;
    span.style.borderRadius = '3px';
    span.textContent = m[0];
    bd.appendChild(span);
    lastIndex = regex.lastIndex;
  }
  // Remaining text
  if (lastIndex < text.length) {
    bd.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  // Sync scroll position
  bd.scrollLeft = input.scrollLeft;
}
