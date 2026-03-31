/**
 * Filter bar injection, filter restoration, and filter application.
 */

import { log, warn } from '../logger.js';
import { FILTER_BAR_ID, CARD_WRAP_SELECTOR } from '../constants.js';
import { tagColor } from '../utils/colors.js';
import { tagDisplayLabel } from '../utils/tags.js';
import { scanPersons, scanTags, getCardTags, getCardAssigneeIds, getCardAuthorName, isUnassigned, isInCollapsedColumn } from '../data/scan.js';
import { persistTagsToSession, readFiltersFromHash, readFiltersFromStorage, writeFiltersToHash } from '../data/persistence.js';
import { renderTagPills } from '../ui/pills.js';
import { createCustomDropdown, buildMenuItems } from '../ui/dropdown.js';
import { isActivelyFiltering, updateColumnCounts, updateShadowcards } from './counts.js';
import { startCardObserver } from '../observers.js';

// ──────────────────────────────────────────────
// Filter bar injection & filtering
// ──────────────────────────────────────────────

/**
 * Inject the filter bar (assignee / author / tag dropdowns) into the board header.
 */
export function injectFilterBar() {
  if (document.getElementById(FILTER_BAR_ID)) {
    log('Filter bar already exists, skipping injection');
    return;
  }

  let headerArea = document.querySelector('.perma__header');
  log('Looking for .perma__header:', headerArea ? 'FOUND' : 'NOT FOUND');

  if (!headerArea) {
    headerArea = document.querySelector('.panel--kanban-board');
    log('Fallback .panel--kanban-board:', headerArea ? 'FOUND' : 'NOT FOUND');
  }

  if (!headerArea) {
    headerArea = document.querySelector('.kanban-triage');
    log('Last resort .kanban-triage:', headerArea ? 'FOUND' : 'NOT FOUND');
    if (!headerArea) {
      warn('No suitable header element found! Giving up.');
      return;
    }
  }

  // Render tag pills in card titles before scanning
  renderTagPills();

  const { assignees, authors, unassignedCount } = scanPersons();
  const tags = scanTags();
  log('Scanned:', { assignees: assignees.size, authors: authors.size, tags: tags.size });

  // Persist tags so the edit page can show the tag picker
  persistTagsToSession(tags);

  // --- Assignee options ---
  const assigneeOptions = [
    { value: '__all__', label: 'All assignees' },
    { value: '__unassigned__', label: 'Unassigned' },
    ...Array.from(assignees.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ value: p.id, label: p.name, avatarSrc: p.src })),
  ];

  // --- Author options (mapped to assignee avatars) ---
  const authorOptions = [
    { value: '__all__', label: 'All authors' },
    ...Array.from(authors.values())
      .sort((a, b) => (a.fullName || a.name).localeCompare(b.fullName || b.name))
      .map((a) => ({
        value: a.name,
        label: a.fullName || a.name,
        avatarSrc: a.avatarSrc || null,
      })),
  ];

  // --- Tag options (with colored pills) ---
  const tagOptions = [
    { value: '__all__', label: 'All tags' },
    ...Array.from(tags.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t]) => ({ value: t, label: tagDisplayLabel(t), tagColor: tagColor(t) })),
  ];

  // --- Build the filter bar ---
  const bar = document.createElement('div');
  bar.id = FILTER_BAR_ID;
  bar.className = 'bkf-filter-bar';

  const assigneeDropdown = createCustomDropdown('bkf-assignee', assigneeOptions);
  const authorDropdown = createCustomDropdown('bkf-author', authorOptions);
  const tagDropdown = createCustomDropdown('bkf-tag', tagOptions);

  bar.appendChild(assigneeDropdown);
  bar.appendChild(authorDropdown);
  bar.appendChild(tagDropdown);

  const headerStyle = window.getComputedStyle(headerArea);
  if (headerStyle.position === 'static') {
    headerArea.style.position = 'relative';
  }

  headerArea.appendChild(bar);
  log('Filter bar injected');

  // --- Event listeners ---
  const onFilterChange = () => {
    applyFilters();
    writeFiltersToHash();
  };
  assigneeDropdown.addEventListener('change', onFilterChange);
  authorDropdown.addEventListener('change', onFilterChange);
  tagDropdown.addEventListener('change', onFilterChange);

  // --- Restore filters from URL hash ---
  restoreFiltersFromHash();

  // --- Watch for DOM changes (drag & drop, new cards) and re-apply filters ---
  startCardObserver();
}

/**
 * Re-scan tags from the DOM and rebuild the tag dropdown menu items.
 * Called after new cards are lazy-loaded so the dropdown stays complete.
 */
export function refreshTagDropdown() {
  const tagDropdown = document.getElementById('bkf-tag');
  if (!tagDropdown) return;

  const tags = scanTags();
  log('refreshTagDropdown: re-scanned tags:', tags.size);

  persistTagsToSession(tags);

  const currentValue = tagDropdown.dataset.value || '__all__';

  const tagOptions = [
    { value: '__all__', label: 'All tags' },
    ...Array.from(tags.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([t]) => ({ value: t, label: tagDisplayLabel(t), tagColor: tagColor(t) })),
  ];

  const menu = tagDropdown.querySelector('.bkf-dropdown__menu');
  if (!menu) return;
  menu.innerHTML = '';
  buildMenuItems(tagDropdown, menu, tagOptions);

  const stillExists = tagOptions.some((o) => o.value === currentValue);
  const restoreOption = stillExists ? tagOptions.find((o) => o.value === currentValue) : tagOptions[0];

  tagDropdown.dataset.value = restoreOption.value;
  const selectedEl = tagDropdown.querySelector('.bkf-dropdown__selected');
  if (selectedEl) {
    selectedEl.innerHTML = '';
    if (restoreOption.tagColor) {
      const pill = document.createElement('span');
      pill.className = 'bkf-tag-pill';
      pill.style.backgroundColor = restoreOption.tagColor.bg;
      pill.style.color = restoreOption.tagColor.fg;
      pill.textContent = restoreOption.label;
      selectedEl.appendChild(pill);
    } else {
      const text = document.createElement('span');
      text.textContent = restoreOption.label;
      selectedEl.appendChild(text);
    }
  }
  tagDropdown.querySelectorAll('.bkf-dropdown__item').forEach((item) => {
    item.classList.toggle('bkf-dropdown__item--active', item.dataset.value === restoreOption.value);
  });
}

/**
 * Restore filter selections from the URL hash (priority) or localStorage (fallback) and apply.
 */
export function restoreFiltersFromHash() {
  let filters = readFiltersFromHash();
  if (!filters.assignee && !filters.author && !filters.tag) {
    filters = readFiltersFromStorage();
  }
  if (!filters.assignee && !filters.author && !filters.tag) return;

  log('Restoring filters from hash/storage:', filters);

  if (filters.assignee) {
    const dd = document.getElementById('bkf-assignee');
    const item = dd?.querySelector(`.bkf-dropdown__item[data-value="${CSS.escape(filters.assignee)}"]`);
    if (item) item.click();
  }
  if (filters.author) {
    const dd = document.getElementById('bkf-author');
    const item = dd?.querySelector(`.bkf-dropdown__item[data-value="${CSS.escape(filters.author)}"]`);
    if (item) item.click();
  }
  if (filters.tag) {
    const dd = document.getElementById('bkf-tag');
    const item = dd?.querySelector(`.bkf-dropdown__item[data-value="${CSS.escape(filters.tag)}"]`);
    if (item) item.click();
  }
}

/**
 * Apply the current filter selections to all card wraps.
 */
export function applyFilters() {
  const assigneeDropdown = document.getElementById('bkf-assignee');
  const authorDropdown = document.getElementById('bkf-author');
  const tagDropdown = document.getElementById('bkf-tag');

  if (!assigneeDropdown || !authorDropdown || !tagDropdown) return;

  const selectedAssignee = assigneeDropdown.dataset.value;
  const selectedAuthor = authorDropdown.dataset.value;
  const selectedTag = tagDropdown.dataset.value;

  log('Applying filters:', { assignee: selectedAssignee, author: selectedAuthor, tag: selectedTag });

  const wraps = document.querySelectorAll(CARD_WRAP_SELECTOR);

  wraps.forEach((wrap) => {
    if (isInCollapsedColumn(wrap)) return;

    let matchAssignee = true;
    let matchAuthor = true;
    let matchTag = true;

    if (selectedAssignee !== '__all__') {
      if (selectedAssignee === '__unassigned__') {
        matchAssignee = isUnassigned(wrap);
      } else {
        matchAssignee = getCardAssigneeIds(wrap).includes(selectedAssignee);
      }
    }

    if (selectedAuthor !== '__all__') {
      matchAuthor = getCardAuthorName(wrap) === selectedAuthor;
    }

    if (selectedTag !== '__all__') {
      matchTag = getCardTags(wrap).includes(selectedTag);
    }

    if (matchAssignee && matchAuthor && matchTag) {
      wrap.classList.remove('bkf-hidden');
    } else {
      wrap.classList.add('bkf-hidden');
    }
  });

  updateColumnCounts();
  updateShadowcards();
}
