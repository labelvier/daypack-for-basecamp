/**
 * Custom due-date range dropdown — from/until date inputs + overdue toggle, Basecamp pill style.
 */

// ──────────────────────────────────────────────
// Due date range dropdown
// ──────────────────────────────────────────────

/**
 * Create a due-date range dropdown with From / Until date inputs and a "show all overdue" checkbox.
 * Exposes container.dataset.start / container.dataset.end as 'YYYY-MM-DD' (or ''),
 * and container.dataset.overdue as 'true' (or '').
 */
export function createDateRangeDropdown(id) {
  const container = document.createElement('div');
  container.id = id;
  container.className = 'bkf-dropdown bkf-daterange';
  container.tabIndex = 0;
  container.dataset.start = '';
  container.dataset.end = '';
  container.dataset.overdue = '';

  const selected = document.createElement('div');
  selected.className = 'bkf-dropdown__selected';
  selected.textContent = 'Due date';
  container.appendChild(selected);

  const menu = document.createElement('div');
  menu.className = 'bkf-dropdown__menu bkf-daterange__menu';
  menu.style.display = 'none';
  container.appendChild(menu);

  const startField = buildDateField('From', 'bkf-daterange__start');
  const endField = buildDateField('Until', 'bkf-daterange__end');
  menu.appendChild(startField.row);
  menu.appendChild(endField.row);

  const overdueRow = document.createElement('label');
  overdueRow.className = 'bkf-daterange__overdue-row';
  const overdueCheckbox = document.createElement('input');
  overdueCheckbox.type = 'checkbox';
  overdueCheckbox.className = 'bkf-daterange__overdue';
  const overdueLabel = document.createElement('span');
  overdueLabel.textContent = 'Show all overdue';
  overdueRow.appendChild(overdueCheckbox);
  overdueRow.appendChild(overdueLabel);
  menu.appendChild(overdueRow);

  const actions = document.createElement('div');
  actions.className = 'bkf-daterange__actions';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'bkf-daterange__clear';
  clearBtn.textContent = 'Clear';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'bkf-daterange__apply';
  applyBtn.textContent = 'Apply';

  actions.appendChild(clearBtn);
  actions.appendChild(applyBtn);
  menu.appendChild(actions);

  const openMenu = () => {
    menu.style.display = 'block';
    menu.classList.add('bkf-dropdown__menu--open');
    container.classList.add('bkf-dropdown--open');
  };

  const closeMenu = () => {
    menu.style.display = 'none';
    menu.classList.remove('bkf-dropdown__menu--open');
    container.classList.remove('bkf-dropdown--open');
  };

  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('bkf-dropdown__menu--open');
    document.querySelectorAll('.bkf-dropdown__menu--open').forEach((m) => {
      m.style.display = 'none';
      m.classList.remove('bkf-dropdown__menu--open');
      m.closest('.bkf-dropdown')?.classList.remove('bkf-dropdown--open');
    });
    if (!isOpen) openMenu();
  });

  // Keep clicks inside the menu (date inputs, buttons) from bubbling to the document closer.
  menu.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', () => {
    closeMenu();
  });

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  const syncAndApply = () => {
    applyState(container, {
      start: startField.input.value,
      end: endField.input.value,
      overdue: overdueCheckbox.checked,
    });
  };

  overdueCheckbox.addEventListener('change', () => {
    startField.input.disabled = overdueCheckbox.checked;
    endField.input.disabled = overdueCheckbox.checked;
    syncAndApply();
    closeMenu();
  });

  applyBtn.addEventListener('click', () => {
    syncAndApply();
    closeMenu();
  });

  clearBtn.addEventListener('click', () => {
    startField.input.value = '';
    endField.input.value = '';
    overdueCheckbox.checked = false;
    startField.input.disabled = false;
    endField.input.disabled = false;
    syncAndApply();
    closeMenu();
  });

  return container;
}

function buildDateField(labelText, inputClass) {
  const row = document.createElement('label');
  row.className = 'bkf-daterange__row';

  const label = document.createElement('span');
  label.className = 'bkf-daterange__label';
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'date';
  input.className = inputClass;

  row.appendChild(label);
  row.appendChild(input);

  return { row, input };
}

/** Apply start/end/overdue state to the dropdown, update its label, and fire a change event. */
function applyState(container, { start = '', end = '', overdue = false }) {
  container.dataset.start = overdue ? '' : (start || '');
  container.dataset.end = overdue ? '' : (end || '');
  container.dataset.overdue = overdue ? 'true' : '';
  container.querySelector('.bkf-dropdown__selected').textContent = formatSummary(
    container.dataset.start,
    container.dataset.end,
    overdue
  );
  container.dispatchEvent(new Event('change'));
}

function formatSummary(start, end, overdue) {
  if (overdue) return 'Overdue';
  if (!start && !end) return 'Due date';
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  return `Until ${formatDate(end)}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Programmatically set the dropdown's start/end/overdue values (e.g. restoring from URL hash).
 */
export function setDateRangeValue(container, start, end, overdue) {
  if (!container) return;
  const startInput = container.querySelector('.bkf-daterange__start');
  const endInput = container.querySelector('.bkf-daterange__end');
  const overdueCheckbox = container.querySelector('.bkf-daterange__overdue');
  if (startInput) startInput.value = overdue ? '' : (start || '');
  if (endInput) endInput.value = overdue ? '' : (end || '');
  if (overdueCheckbox) overdueCheckbox.checked = !!overdue;
  if (startInput) startInput.disabled = !!overdue;
  if (endInput) endInput.disabled = !!overdue;
  applyState(container, { start, end, overdue });
}
