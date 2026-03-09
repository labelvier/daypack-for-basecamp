/**
 * New card inline form — tag picker injection.
 *
 * When a user opens the "Add a card" inline form in a kanban lane,
 * this module injects a tag picker strip above the title input so
 * the user can select existing project tags directly from that popup.
 *
 * Clicking a tag pill prepends [Tag] to the title input value,
 * mirroring the behaviour already present on full card edit pages.
 */

import { log } from '../logger.js';
import { tagColor } from '../utils/colors.js';
import { tagDisplayLabel, normalizeTag, escapeRegExp } from '../utils/tags.js';
import { loadTagsFromSession, appendNewTagsToSession } from '../data/persistence.js';
import { updateHighlight } from './edit.js';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

/** ID placed on the injected tag picker so we never double-inject. */
const NEW_CARD_PICKER_ID = 'bkf-new-card-picker';

/**
 * Selectors that identify the "add a card" title input inside the inline form.
 * Basecamp renders a small inline form with an <input> when the user clicks
 * the "Add a card" button at the bottom of a kanban lane.
 */
const NEW_CARD_INPUT_SELECTORS = [
  'input[name="kanban_card[title]"]',
  'input[name="recording[title]"]',
  'input[placeholder*="card"]',
  'input[placeholder*="Card"]',
  'input[placeholder*="kaartje"]',
];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Find the title input inside a new-card inline form element.
 *
 * @param {Element} formEl  — the form or container element
 * @returns {HTMLInputElement|null}
 */
function findNewCardInput(formEl) {
  for (const sel of NEW_CARD_INPUT_SELECTORS) {
    const el = formEl.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Prepend [Tag] to the new-card title input, removing duplicates.
 * Uses the same logic as edit.js > prependTag, adapted for plain inputs
 * that don't need the Basecamp-specific execCommand workaround.
 *
 * @param {HTMLInputElement} input
 * @param {string} normalizedTag
 */
function prependTagToNewCardInput(input, normalizedTag) {
  const label = tagDisplayLabel(normalizedTag);
  const bracket = `[${label}]`;
  const current = input.value;
  // Remove existing instance of this tag (avoid duplicates)
  const cleaned = current
    .replace(new RegExp(`\\[${escapeRegExp(label)}\\]\\s*`, 'i'), '')
    .trim();
  const newValue = `${bracket} ${cleaned}`.trim();

  // Set via native input setter so React/Turbo driven inputs pick up the change
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  );
  if (nativeSetter && nativeSetter.set) {
    nativeSetter.set.call(input, newValue);
  } else {
    input.value = newValue;
  }

  // Dispatch an input event so any framework listeners update
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();

  // Also persist newly typed tags to session storage
  appendNewTagsToSession(newValue);

  // Update the live highlight backdrop if one was set up
  if (input._bkfBackdrop) {
    updateHighlight(input, input._bkfBackdrop);
  }
}

// ──────────────────────────────────────────────
// Injection
// ──────────────────────────────────────────────

/**
 * Inject the tag picker strip into an "add a card" inline form.
 * Safe to call repeatedly — bails out if the picker is already present.
 *
 * @param {Element} formEl  — the form or container that holds the title input
 * @returns {boolean}  true if the picker was successfully injected
 */
export function injectNewCardPicker(formEl) {
  // Guard: only inject once per form
  if (formEl.querySelector(`#${NEW_CARD_PICKER_ID}`)) return true;

  const input = findNewCardInput(formEl);
  if (!input) {
    log('New card picker: no title input found in form');
    return false;
  }

  const knownTags = loadTagsFromSession();
  if (knownTags.length === 0) {
    log('New card picker: no known tags in session, skipping picker injection');
    return true; // not an error — board may just have no tags yet
  }

  log('New card picker: injecting tag picker with', knownTags.length, 'tag(s)');

  // Build the picker strip
  const picker = document.createElement('div');
  picker.id = NEW_CARD_PICKER_ID;
  picker.className = 'bkf-new-card-picker';

  const label = document.createElement('span');
  label.className = 'bkf-new-card-picker__label';
  label.textContent = 'Tags:';
  picker.appendChild(label);

  const pillsWrap = document.createElement('span');
  pillsWrap.className = 'bkf-new-card-picker__pills';

  knownTags
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((tag) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'bkf-tag-pill bkf-new-card-picker__pill';
      const colors = tagColor(tag);
      pill.style.backgroundColor = colors.bg;
      pill.style.color = colors.fg;
      pill.textContent = tagDisplayLabel(tag);
      pill.title = `Voeg [${tagDisplayLabel(tag)}] toe aan de titel`;

      pill.addEventListener('mousedown', (e) => {
        // Prevent the form losing focus (which may close the inline form in some UIs)
        e.preventDefault();
        prependTagToNewCardInput(input, tag);
      });

      pillsWrap.appendChild(pill);
    });

  picker.appendChild(pillsWrap);

  // Insert the picker directly before the input element
  input.parentNode.insertBefore(picker, input);

  return true;
}

// ──────────────────────────────────────────────
// MutationObserver for new-card forms
// ──────────────────────────────────────────────

let _newCardObserver = null;

/**
 * Selectors that match the inline "add a card" form container.
 * Basecamp renders this inside the kanban column as a small form element.
 */
const NEW_CARD_FORM_SELECTORS = [
  'form.kanban-card__add-form',
  'form[action*="kanban_cards"]',
  'form[action*="card_tables"]',
  '.js-new-card-form',
  '.kanban-card__new',
];

/**
 * Given a newly-added DOM node, try to find and return a new-card form
 * element (or null if there isn't one).
 *
 * @param {Node} node
 * @returns {Element|null}
 */
function findNewCardForm(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  // Check if the node itself is the form
  for (const sel of NEW_CARD_FORM_SELECTORS) {
    if (node.matches?.(sel)) return node;
  }

  // Check descendants
  for (const sel of NEW_CARD_FORM_SELECTORS) {
    const el = node.querySelector?.(sel);
    if (el) return el;
  }

  // Fallback: if the node contains any of the known input selectors it's
  // probably an add-card container even if the form selector doesn't match.
  for (const sel of NEW_CARD_INPUT_SELECTORS) {
    if (node.querySelector?.(sel)) return node;
  }

  return null;
}

/**
 * Start watching the board for "add a card" inline form appearances.
 * Uses a single MutationObserver on the main board element.
 *
 * Safe to call multiple times — only one observer is ever active.
 */
export function startNewCardObserver() {
  if (_newCardObserver) {
    _newCardObserver.disconnect();
    _newCardObserver = null;
  }

  const board = document.querySelector('.kanban-columns, .panel--kanban-board, #main-content');
  if (!board) {
    log('New card observer: no board container found, skipping');
    return;
  }

  _newCardObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const form = findNewCardForm(node);
        if (!form) continue;

        log('New card observer: detected new-card form, injecting tag picker');

        // Retry a few times in case the input isn't in the DOM yet
        let retries = 0;
        const tryInject = () => {
          const ok = injectNewCardPicker(form);
          if (!ok && retries < 10) {
            retries++;
            setTimeout(tryInject, 150);
          }
        };
        tryInject();
      }
    }
  });

  _newCardObserver.observe(board, { childList: true, subtree: true });
  log('New card observer started');
}

/**
 * Stop the new-card observer (called during cleanup / Turbo navigation).
 */
export function destroyNewCardObserver() {
  if (_newCardObserver) {
    _newCardObserver.disconnect();
    _newCardObserver = null;
    log('New card observer stopped');
  }
}
