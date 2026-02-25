/**
 * Custom dropdown widget with avatar and tag-pill support.
 */

// ──────────────────────────────────────────────
// Custom dropdown with avatar/pill support
// ──────────────────────────────────────────────

/**
 * Create a custom dropdown.
 * Options: { value, label, avatarSrc?, tagColor? }
 * tagColor: { bg, fg } for rendering a pill in the dropdown.
 */
export function createCustomDropdown(id, options) {
  const container = document.createElement('div');
  container.id = id;
  container.className = 'bkf-dropdown';
  container.tabIndex = 0;
  container.setAttribute('role', 'listbox');

  const selected = document.createElement('div');
  selected.className = 'bkf-dropdown__selected';
  container.appendChild(selected);

  const menu = document.createElement('div');
  menu.className = 'bkf-dropdown__menu';
  menu.style.display = 'none'; // Ensure hidden before CSS loads (race condition guard)
  container.appendChild(menu);

  buildMenuItems(container, menu, options);

  // Set initial selection
  const first = options[0];
  selectItem(container, first.value, first.label, first.avatarSrc || null, first.tagColor || null);

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

  // Toggle menu
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains('bkf-dropdown__menu--open');
    // Close all other open menus
    document.querySelectorAll('.bkf-dropdown__menu--open').forEach((m) => {
      m.style.display = 'none';
      m.classList.remove('bkf-dropdown__menu--open');
      m.closest('.bkf-dropdown')?.classList.remove('bkf-dropdown--open');
    });
    if (!isOpen) {
      openMenu();
    }
  });

  document.addEventListener('click', () => {
    closeMenu();
  });

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selected.click();
    }
  });

  return container;
}

/**
 * Build and append menu items into the dropdown menu.
 */
export function buildMenuItems(container, menu, options) {
  options.forEach(({ value, label, avatarSrc, tagColor: tc }) => {
    const item = document.createElement('div');
    item.className = 'bkf-dropdown__item';
    item.dataset.value = value;
    item.setAttribute('role', 'option');

    if (avatarSrc) {
      const img = document.createElement('img');
      img.src = avatarSrc;
      img.alt = '';
      img.className = 'bkf-dropdown__avatar';
      item.appendChild(img);
    }

    if (tc) {
      const pill = document.createElement('span');
      pill.className = 'bkf-tag-pill';
      pill.style.backgroundColor = tc.bg;
      pill.style.color = tc.fg;
      pill.textContent = label;
      item.appendChild(pill);
    } else {
      const text = document.createElement('span');
      text.textContent = label;
      item.appendChild(text);
    }

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem(container, value, label, avatarSrc || null, tc || null);
      menu.style.display = 'none';
      menu.classList.remove('bkf-dropdown__menu--open');
      container.classList.remove('bkf-dropdown--open');
    });

    menu.appendChild(item);
  });
}

/**
 * Update the dropdown selected display and fire a change event.
 */
export function selectItem(container, value, label, avatarSrc, tc) {
  container.dataset.value = value;
  const selected = container.querySelector('.bkf-dropdown__selected');
  selected.innerHTML = '';

  if (avatarSrc) {
    const img = document.createElement('img');
    img.src = avatarSrc;
    img.alt = '';
    img.className = 'bkf-dropdown__avatar';
    selected.appendChild(img);
  }

  if (tc) {
    const pill = document.createElement('span');
    pill.className = 'bkf-tag-pill';
    pill.style.backgroundColor = tc.bg;
    pill.style.color = tc.fg;
    pill.textContent = label;
    selected.appendChild(pill);
  } else {
    const text = document.createElement('span');
    text.textContent = label;
    selected.appendChild(text);
  }

  container.querySelectorAll('.bkf-dropdown__item').forEach((item) => {
    item.classList.toggle('bkf-dropdown__item--active', item.dataset.value === value);
  });

  container.dispatchEvent(new Event('change'));
}
