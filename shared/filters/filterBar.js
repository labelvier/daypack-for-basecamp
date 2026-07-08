/**
 * Filter bar injection, filter restoration, and filter application.
 */

import { log, warn } from '../logger.js';
import { FILTER_BAR_ID, CARD_WRAP_SELECTOR } from '../constants.js';
import { tagColor } from '../utils/colors.js';
import { tagDisplayLabel } from '../utils/tags.js';
import { scanPersons, scanTags, getCardTags, getCardAssigneeIds, getCardAuthorName, getCardDueDateISO, getTodayISO, isUnassigned, isInCollapsedColumn } from '../data/scan.js';
import { persistTagsToSession, readFiltersFromHash, readFiltersFromStorage, writeFiltersToHash } from '../data/persistence.js';
import { renderTagPills } from '../ui/pills.js';
import { createCustomDropdown } from '../ui/dropdown.js';
import { createDateRangeDropdown, setDateRangeValue } from '../ui/dateRangeDropdown.js';
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

  // BC5: inject into the native filter nav so dropdowns flow as flex siblings.
  const nativeFilterNav = document.querySelector('nav.filter[aria-label="Card filters"]');
  log('Looking for nav.filter[aria-label="Card filters"] (BC5):', nativeFilterNav ? 'FOUND' : 'NOT FOUND');

  // BC4 / fallback chain
  let headerArea = nativeFilterNav
    || document.querySelector('.perma__header')
    || document.querySelector('header.perma-header')
    || document.querySelector('.panel--kanban-board')
    || document.querySelector('.kanban-triage');

  if (!headerArea) {
    warn('No suitable header element found! Giving up.');
    return;
  }
  log('Filter bar injection target:', headerArea.tagName, (headerArea.id || headerArea.className).toString().substring(0, 40));

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
  const dueDateDropdown = createDateRangeDropdown('bkf-duedate');

  bar.appendChild(assigneeDropdown);
  bar.appendChild(authorDropdown);
  bar.appendChild(tagDropdown);
  bar.appendChild(dueDateDropdown);

  // When injecting into BC5's own flex nav, use static flow instead of absolute overlay.
  if (nativeFilterNav) {
    bar.classList.add('bkf-filter-bar--inline');
  } else {
    const headerStyle = window.getComputedStyle(headerArea);
    if (headerStyle.position === 'static') {
      headerArea.style.position = 'relative';
    }
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
  dueDateDropdown.addEventListener('change', onFilterChange);

  // --- Restore filters from URL hash ---
  restoreFiltersFromHash();

  // --- Watch for DOM changes (drag & drop, new cards) and re-apply filters ---
  startCardObserver();
}

/**
 * Restore filter selections from the URL hash (priority) or localStorage (fallback) and apply.
 */
export function restoreFiltersFromHash() {
  let filters = readFiltersFromHash();
  if (!filters.assignee && !filters.author && !filters.tag && !filters.dueStart && !filters.dueEnd && !filters.dueOverdue) {
    filters = readFiltersFromStorage();
  }
  if (!filters.assignee && !filters.author && !filters.tag && !filters.dueStart && !filters.dueEnd && !filters.dueOverdue) return;

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
  if (filters.dueStart || filters.dueEnd || filters.dueOverdue) {
    setDateRangeValue(document.getElementById('bkf-duedate'), filters.dueStart, filters.dueEnd, filters.dueOverdue);
  }
}

/**
 * Apply the current filter selections to all card wraps.
 */
export function applyFilters() {
  const assigneeDropdown = document.getElementById('bkf-assignee');
  const authorDropdown = document.getElementById('bkf-author');
  const tagDropdown = document.getElementById('bkf-tag');
  const dueDateDropdown = document.getElementById('bkf-duedate');

  if (!assigneeDropdown || !authorDropdown || !tagDropdown) return;

  const selectedAssignee = assigneeDropdown.dataset.value;
  const selectedAuthor = authorDropdown.dataset.value;
  const selectedTag = tagDropdown.dataset.value;
  const selectedDueStart = dueDateDropdown?.dataset.start || '';
  const selectedDueEnd = dueDateDropdown?.dataset.end || '';
  const selectedDueOverdue = dueDateDropdown?.dataset.overdue === 'true';
  const todayISO = getTodayISO();

  log('Applying filters:', { assignee: selectedAssignee, author: selectedAuthor, tag: selectedTag, dueStart: selectedDueStart, dueEnd: selectedDueEnd, dueOverdue: selectedDueOverdue });

  const wraps = document.querySelectorAll(CARD_WRAP_SELECTOR);

  wraps.forEach((wrap) => {
    if (isInCollapsedColumn(wrap)) return;

    let matchAssignee = true;
    let matchAuthor = true;
    let matchTag = true;
    let matchDueDate = true;

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

    if (selectedDueOverdue) {
      const dueISO = getCardDueDateISO(wrap);
      matchDueDate = !!dueISO && dueISO < todayISO;
    } else if (selectedDueStart || selectedDueEnd) {
      const dueISO = getCardDueDateISO(wrap);
      if (!dueISO) {
        matchDueDate = false;
      } else {
        if (selectedDueStart && dueISO < selectedDueStart) matchDueDate = false;
        if (selectedDueEnd && dueISO > selectedDueEnd) matchDueDate = false;
      }
    }

    if (matchAssignee && matchAuthor && matchTag && matchDueDate) {
      wrap.classList.remove('bkf-hidden');
    } else {
      wrap.classList.add('bkf-hidden');
    }
  });

  updateColumnCounts();
  updateShadowcards();
}
