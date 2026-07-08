/**
 * Filter and tag persistence via URL hash and localStorage.
 */

import { extractTags } from '../utils/tags.js';

// ──────────────────────────────────────────────
// Filter state — URL hash + localStorage
// ──────────────────────────────────────────────

/**
 * Returns a localStorage key scoped to the current board ID.
 * E.g. "bkf_filters_3/buckets/12345/card_tables/67890"
 */
export function getBoardFilterKey() {
  const match = window.location.pathname.match(/(\/\d+\/buckets\/\d+\/card_tables\/\d+)/);
  const scope = match ? match[1] : window.location.pathname;
  return 'bkf_filters_' + scope;
}

/**
 * Read filter state from URL hash.
 * Format: #assignee=ID&author=Name&tag=TagName
 */
export function readFiltersFromHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  const filters = {};
  if (params.has('assignee')) filters.assignee = params.get('assignee');
  if (params.has('author')) filters.author = params.get('author');
  if (params.has('tag')) filters.tag = params.get('tag');
  if (params.has('dueStart')) filters.dueStart = params.get('dueStart');
  if (params.has('dueEnd')) filters.dueEnd = params.get('dueEnd');
  if (params.has('dueOverdue')) filters.dueOverdue = true;
  return filters;
}

/**
 * Read filter state from localStorage (fallback when no URL hash).
 */
export function readFiltersFromStorage() {
  try {
    const raw = localStorage.getItem(getBoardFilterKey());
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Write current filter state to URL hash and localStorage.
 */
export function writeFiltersToHash() {
  const assigneeVal = document.getElementById('bkf-assignee')?.dataset.value;
  const authorVal = document.getElementById('bkf-author')?.dataset.value;
  const tagVal = document.getElementById('bkf-tag')?.dataset.value;
  const dueDateEl = document.getElementById('bkf-duedate');
  const dueStartVal = dueDateEl?.dataset.start;
  const dueEndVal = dueDateEl?.dataset.end;
  const dueOverdueVal = dueDateEl?.dataset.overdue === 'true';

  const params = new URLSearchParams();
  if (assigneeVal && assigneeVal !== '__all__') params.set('assignee', assigneeVal);
  if (authorVal && authorVal !== '__all__') params.set('author', authorVal);
  if (tagVal && tagVal !== '__all__') params.set('tag', tagVal);
  if (dueOverdueVal) params.set('dueOverdue', '1');
  if (dueStartVal) params.set('dueStart', dueStartVal);
  if (dueEndVal) params.set('dueEnd', dueEndVal);

  const hashStr = params.toString();
  const newHash = hashStr ? '#' + hashStr : '';
  const currentUrl = window.location.pathname + window.location.search + newHash;

  // Use replaceState to avoid polluting history
  history.replaceState(null, '', currentUrl);

  // Also persist to localStorage so the filter survives navigation away and back
  try {
    const filters = {};
    if (assigneeVal && assigneeVal !== '__all__') filters.assignee = assigneeVal;
    if (authorVal && authorVal !== '__all__') filters.author = authorVal;
    if (tagVal && tagVal !== '__all__') filters.tag = tagVal;
    if (dueOverdueVal) filters.dueOverdue = true;
    if (dueStartVal) filters.dueStart = dueStartVal;
    if (dueEndVal) filters.dueEnd = dueEndVal;

    if (Object.keys(filters).length > 0) {
      localStorage.setItem(getBoardFilterKey(), JSON.stringify(filters));
    } else {
      localStorage.removeItem(getBoardFilterKey());
    }
  } catch (e) {
    // localStorage may be unavailable
  }
}

// ──────────────────────────────────────────────
// Tag persistence — localStorage cross-page
// ──────────────────────────────────────────────

/**
 * Get localStorage key for tags, scoped to project and bucket.
 * This prevents tags from one project bleeding into another.
 */
export function getTagsSessionKey() {
  const match = window.location.pathname.match(/(\/\d+\/buckets\/\d+)/);
  const scope = match ? match[1] : 'global';
  return 'bkf_known_tags_' + scope;
}

/**
 * Persist all known normalized tags to localStorage for use on edit pages.
 * Uses localStorage instead of sessionStorage so tags are shared across tabs.
 */
export function persistTagsToSession(tagMap) {
  try {
    const tags = Array.from(tagMap.keys());
    localStorage.setItem(getTagsSessionKey(), JSON.stringify(tags));
  } catch (e) {
    // localStorage may be unavailable
  }
}

/**
 * Add any tags found in `text` to the localStorage list if not already present.
 * Called on every input event so newly typed [Tag] brackets are persisted immediately.
 */
export function appendNewTagsToSession(text) {
  const found = extractTags(text);
  if (found.length === 0) return;
  try {
    const existing = loadTagsFromSession();
    const set = new Set(existing);
    let changed = false;
    found.forEach((t) => {
      if (!set.has(t)) {
        set.add(t);
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(getTagsSessionKey(), JSON.stringify([...set]));
    }
  } catch (e) { /* localStorage unavailable */ }
}

/**
 * Load known tags from localStorage. Returns array of normalized tag strings.
 */
export function loadTagsFromSession() {
  try {
    const raw = localStorage.getItem(getTagsSessionKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
