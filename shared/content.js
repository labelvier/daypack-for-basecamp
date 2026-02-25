/**
 * Basecamp Kanban Filter
 * Content script that adds assignee/author/tag filter dropdowns to Basecamp card tables.
 * Also renders tag pills on card detail pages, and adds a tag editor UI in edit mode.
 *
 * Works on: Basecamp card_tables board pages + card detail pages + card edit pages
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[BKF]';
  const log = (...args) => console.log(LOG_PREFIX, ...args);
  const warn = (...args) => console.warn(LOG_PREFIX, ...args);

  log('Content script loaded on:', window.location.href);

  const FILTER_BAR_ID = 'bkf-filter-bar';
  const COLLAPSED_COLUMN_SELECTOR = '.kanban-column--slim';
  const CARD_WRAP_SELECTOR = 'article.kanban-card__wrap';

  // ──────────────────────────────────────────────
  // Tag color generation (deterministic, WCAG safe)
  // ──────────────────────────────────────────────

  /**
   * FNV-1a hash — much better distribution for short, similar strings
   * than djb2. Returns a positive 32-bit integer.
   */
  function hashString(str) {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    return hash >>> 0;
  }

  /**
   * Relative luminance per WCAG 2.1.
   */
  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * WCAG contrast ratio between two luminances.
   */
  function contrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Generate a pastel background color from a tag string.
   * Uses a curated palette of soft Basecamp-style pastels with dark text.
   * Returns { bg: 'rgb(r,g,b)', fg: '#...' }
   */
  function tagColor(tag) {
    // Curated pastel palette — soft, warm/cool mix, Basecamp-style
    const PALETTE = [
      [199, 228, 246], // soft blue
      [254, 215, 170], // peach
      [195, 232, 206], // mint
      [246, 198, 198], // rose
      [220, 208, 243], // lavender
      [254, 240, 179], // butter yellow
      [181, 228, 228], // teal
      [248, 206, 228], // pink
      [214, 229, 189], // sage
      [230, 214, 200], // warm sand
      [197, 220, 243], // periwinkle
      [252, 222, 200], // apricot
      [210, 235, 219], // seafoam
      [241, 206, 219], // blush
      [224, 220, 240], // soft violet
      [240, 234, 195], // wheat
      [195, 234, 234], // aqua
      [239, 213, 238], // orchid
      [226, 236, 204], // lime cream
      [219, 213, 230], // mauve
    ];

    const normalized = normalizeTag(tag);
    const hash = hashString(normalized);
    const [r, g, b] = PALETTE[hash % PALETTE.length];
    const lum = luminance(r, g, b);

    // Pick dark or white text based on WCAG contrast
    const crWhite = contrastRatio(1, lum);
    const crBlack = contrastRatio(lum, 0);
    const fg = crWhite >= crBlack ? '#fff' : '#3d4f5f';

    return { bg: `rgb(${r},${g},${b})`, fg };
  }

  // ──────────────────────────────────────────────
  // Tag parsing & rendering
  // ──────────────────────────────────────────────

  const TAG_REGEX = /\[([^\]]+)\]/g;

  /**
   * Normalize a tag: strip whitespace, collapse internal spaces, lowercase.
   * E.g. "[ Fase  3 ]" → "fase 3", "Bug" → "bug"
   */
  function normalizeTag(tag) {
    return tag.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /**
   * Registry of best display forms for normalized tags.
   * Preserves original casing from the DOM (e.g. "UX" stays "UX", not "Ux").
   */
  const tagDisplayRegistry = new Map();

  /**
   * Register the original casing of a tag. Picks the best display form:
   * - Prefer forms with intentional casing (e.g. "UX" over "ux" or "Ux")
   * - First seen form wins for equal-quality forms
   */
  function registerTagDisplay(original) {
    const normalized = normalizeTag(original);
    const trimmed = original.trim().replace(/\s+/g, ' ');
    if (!tagDisplayRegistry.has(normalized)) {
      tagDisplayRegistry.set(normalized, trimmed);
    }
  }

  /**
   * Display label for a tag, preserving original casing from the DOM.
   * Falls back to title-casing each word.
   */
  function tagDisplayLabel(tag) {
    const n = normalizeTag(tag);
    if (tagDisplayRegistry.has(n)) return tagDisplayRegistry.get(n);
    // Fallback: title-case, but keep fully uppercase words (≤5 chars) uppercase
    return n.replace(/\b(\w+)/g, (word) => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  /**
   * Extract all tags from a text string. Returns array of normalized tag strings.
   * Also registers the original casing of each tag.
   */
  function extractTags(text) {
    const tags = [];
    let match;
    TAG_REGEX.lastIndex = 0;
    while ((match = TAG_REGEX.exec(text)) !== null) {
      registerTagDisplay(match[1]);
      tags.push(normalizeTag(match[1]));
    }
    return tags;
  }

  /**
   * Create a pill element for a tag (takes normalized tag).
   */
  function createTagPill(tag) {
    const pill = document.createElement('span');
    pill.className = 'bkf-tag-pill';
    const colors = tagColor(tag);
    pill.style.backgroundColor = colors.bg;
    pill.style.color = colors.fg;
    pill.textContent = tagDisplayLabel(tag);
    return pill;
  }

  /**
   * Replace [tag] text in card titles with styled pill elements.
   * Pills are rendered in a separate div.bkf-pill-row inserted before the title element,
   * so the title text retains its full available space and is not truncated.
   * Only processes titles not yet processed (marked with data-bkf-tags).
   */
  function renderTagPills() {
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

  /**
   * Reconstruct the raw [Tag]-bearing title text from a link element
   * that may already have had pills injected into it.
   * Converts <span.bkf-tag-pill>Bug</span> back to "[Bug]" and concatenates text nodes.
   */
  function getRawTitleFromLink(linkEl) {
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

  /**
   * Render tag pills on card detail pages.
   * Targets the h1.card-perma__title > a element.
   * Skips if the title is in edit mode (form/input present).
   * Always re-renders on each call (handles Turbo navigation back from edit).
   */
  function renderDetailPageTags() {
    const titleH1 = document.querySelector('h1.card-perma__title');
    if (!titleH1) {
      log('Detail page: no h1.card-perma__title found');
      return;
    }

    // Skip if in edit mode (form or input present in the area)
    if (titleH1.querySelector('input, textarea, form')) {
      log('Detail page: title is in edit mode, skipping');
      return;
    }

    const titleLink = titleH1.querySelector('a[href*="/edit?focus=kanban_card_title"]');
    if (!titleLink) {
      log('Detail page: no edit link found in title');
      return;
    }

    // Reconstruct the raw text from the current link content.
    // If pills are already present we convert them back to [Tag] form.
    // This handles both fresh DOM and Turbo cache-restored DOM correctly.
    const rawText = getRawTitleFromLink(titleLink);
    log('Detail page: raw title text:', rawText);

    const tags = extractTags(rawText);

    // Reset the link to plain raw text, then re-render
    titleLink.textContent = rawText;

    if (tags.length === 0) {
      titleH1.dataset.bkfTags = 'none';
      log('Detail page: no tags found in title');
      return;
    }

    titleH1.dataset.bkfTags = tags.join(',');

    // Build new content: pills first, then remaining text
    const remainingText = rawText.replace(TAG_REGEX, '').trim();

    titleLink.textContent = '';

    tags.forEach((tag) => {
      titleLink.appendChild(createTagPill(tag));
      titleLink.appendChild(document.createTextNode(' '));
    });

    if (remainingText) {
      titleLink.appendChild(document.createTextNode(remainingText));
    }

    log('Detail page: rendered', tags.length, 'tag pill(s)');
  }

  // ──────────────────────────────────────────────
  // Card edit page: tag picker + live highlight
  // ──────────────────────────────────────────────

  const EDIT_UI_ID = 'bkf-edit-ui';

  /**
   * Inject the tag editor UI on card edit pages.
   * - Tag picker strip: known tags as clickable pills → prepend to title input
   * - Live [tag] highlight: backdrop overlay that colors [tag] text as you type
   * - Hint text: how to add tags
   */
  function injectEditUI() {
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
    hint.innerHTML = 'Tip: schrijf <code>[Tag]</code> vooraan de titel om een tag toe te voegen.';
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
  function findTitleInput() {
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
  function getTitleContainer(input) {
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
  function prependTag(input, normalizedTag) {
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

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Set up the live [tag] highlight backdrop behind the title input/textarea.
   * Uses the standard "fake highlight" technique:
   * a positioned div mirrors the input text, with [tag] spans colored.
   */
  function setupLiveHighlight(input) {
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
  function syncBackdropStyles(input, backdrop, isTextarea) {
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
  function updateHighlight(input, backdrop) {
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

  /**
   * Scan all card wraps for tags. Returns a Map of normalized tag → count.
   */
  function scanTags() {
    const tagCounts = new Map();
    document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
      if (isInCollapsedColumn(wrap)) return;
      const titleEl = wrap.querySelector('.kanban-card__title');
      if (!titleEl) return;

      const stored = titleEl.dataset.bkfTags;
      let cardTags = [];
      if (stored && stored !== 'none') {
        cardTags = stored.split(',');
      } else if (!stored) {
        cardTags = extractTags(titleEl.textContent);
      }
      cardTags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    });
    return tagCounts;
  }

  /**
   * Get tags from a card wrap element.
   */
  function getCardTags(wrapEl) {
    const titleEl = wrapEl.querySelector('.kanban-card__title');
    if (!titleEl) return [];
    const stored = titleEl.dataset.bkfTags;
    if (stored && stored !== 'none') return stored.split(',');
    if (stored === 'none') return [];
    return extractTags(titleEl.textContent);
  }

  // ──────────────────────────────────────────────
  // URL hash sync + localStorage persistence
  // ──────────────────────────────────────────────

  /**
   * Returns a localStorage key scoped to the current board ID.
   * E.g. "bkf_filters_3/buckets/12345/card_tables/67890"
   */
  function getBoardFilterKey() {
    // Use the path up to and including the card_tables ID as the scope key
    const match = window.location.pathname.match(/(\/\d+\/buckets\/\d+\/card_tables\/\d+)/);
    const scope = match ? match[1] : window.location.pathname;
    return 'bkf_filters_' + scope;
  }

  /**
   * Read filter state from URL hash.
   * Format: #assignee=ID&author=Name&tag=TagName
   */
  function readFiltersFromHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) return {};
    const params = new URLSearchParams(hash);
    const filters = {};
    if (params.has('assignee')) filters.assignee = params.get('assignee');
    if (params.has('author')) filters.author = params.get('author');
    if (params.has('tag')) filters.tag = params.get('tag');
    return filters;
  }

  /**
   * Read filter state from localStorage (fallback when no URL hash).
   */
  function readFiltersFromStorage() {
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
  function writeFiltersToHash() {
    const assigneeVal = document.getElementById('bkf-assignee')?.dataset.value;
    const authorVal = document.getElementById('bkf-author')?.dataset.value;
    const tagVal = document.getElementById('bkf-tag')?.dataset.value;

    const params = new URLSearchParams();
    if (assigneeVal && assigneeVal !== '__all__') params.set('assignee', assigneeVal);
    if (authorVal && authorVal !== '__all__') params.set('author', authorVal);
    if (tagVal && tagVal !== '__all__') params.set('tag', tagVal);

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
  // Helpers
  // ──────────────────────────────────────────────

  function isKanbanBoard() {
    const path = window.location.pathname;
    const result = /\/card_tables\/\d+$/.test(path);
    log('isKanbanBoard?', result, '| pathname:', path);
    return result;
  }

  function isKanbanColumnPage() {
    const path = window.location.pathname;
    const result = /\/card_tables\/columns\/\d+$/.test(path);
    log('isKanbanColumnPage?', result, '| pathname:', path);
    return result;
  }

  function isCardDetailPage() {
    const path = window.location.pathname;
    const result = /\/card_tables\/cards\/\d+$/.test(path);
    log('isCardDetailPage?', result, '| pathname:', path);
    return result;
  }

  function isCardEditPage() {
    const path = window.location.pathname;
    const result = /\/card_tables\/cards\/\d+\/edit$/.test(path);
    log('isCardEditPage?', result, '| pathname:', path);
    return result;
  }

  // ──────────────────────────────────────────────
  // Tag persistence (localStorage, board → edit page, shared across tabs)
  // ──────────────────────────────────────────────

  /**
   * Get localStorage key for tags, scoped to project and bucket.
   * This prevents tags from one project bleeding into another when navigating directly from Hey.
   */
  function getTagsSessionKey() {
    // Use the path up to and including the buckets ID as the scope key
    const match = window.location.pathname.match(/(\/\d+\/buckets\/\d+)/);
    const scope = match ? match[1] : 'global';
    return 'bkf_known_tags_' + scope;
  }

  /**
   * Persist all known normalized tags to localStorage for use on edit pages.
   * Uses localStorage instead of sessionStorage so tags are shared across tabs.
   */
  function persistTagsToSession(tagMap) {
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
  function appendNewTagsToSession(text) {
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
        log('appendNewTagsToSession: added', found.filter(t => !new Set(existing).has(t)));
      }
    } catch (e) { /* localStorage unavailable */ }
  }

  /**
   * Load known tags from localStorage. Returns array of normalized tag strings.
   */
  function loadTagsFromSession() {
    try {
      const raw = localStorage.getItem(getTagsSessionKey());
      if (!raw) return [];
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function isInCollapsedColumn(wrapEl) {
    return wrapEl.closest(COLLAPSED_COLUMN_SELECTOR) !== null;
  }

  /**
   * Try to match an abbreviated author name (e.g. "Eric M.") to an assignee
   * with a full name (e.g. "Eric Mulder"). Handles Dutch tussenvoegsels
   * like "ter", "van", "de" (e.g. "Nathanael t." → "Nathanael ter Borg").
   * Returns the assignee object or null.
   */
  function matchAuthorToAssignee(authorName, assigneeMap) {
    const m = authorName.match(/^(.+?)\s+(\S)\.\s*$/);
    if (!m) return null;
    const firstName = m[1];
    const lastInitial = m[2].toUpperCase();

    for (const assignee of assigneeMap.values()) {
      const parts = assignee.name.split(/\s+/);
      if (parts.length < 2) continue;
      if (parts[0] !== firstName) continue;
      // Check if the initial matches any of the name parts after the first
      const matches = parts.slice(1).some((p) => p[0]?.toUpperCase() === lastInitial);
      if (matches) return assignee;
    }
    return null;
  }

  function scanPersons() {
    const assigneeMap = new Map();
    const authorMap = new Map(); // key = abbreviated name, value = { name, count }

    document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
      if (isInCollapsedColumn(wrap)) return;

      wrap.querySelectorAll('.kanban-card__assignee img[data-avatar-for-person-id]').forEach((img) => {
        const id = img.dataset.avatarForPersonId;
        if (!assigneeMap.has(id)) {
          assigneeMap.set(id, { id, name: img.alt || 'Unknown', src: img.src, count: 0 });
        }
        assigneeMap.get(id).count++;
      });

      const authorEl = wrap.querySelector('.kanban-card__author');
      if (authorEl) {
        const name = parseAuthorName(authorEl.textContent);
        if (name) {
          if (!authorMap.has(name)) {
            authorMap.set(name, { name, count: 0 });
          }
          authorMap.get(name).count++;
        }
      }
    });

    // Count unassigned cards
    let unassignedCount = 0;
    document.querySelectorAll(CARD_WRAP_SELECTOR).forEach((wrap) => {
      if (isInCollapsedColumn(wrap)) return;
      if (isUnassigned(wrap)) unassignedCount++;
    });

    // Map authors to assignees for avatar + full name
    for (const [abbrev, authorData] of authorMap) {
      const matched = matchAuthorToAssignee(abbrev, assigneeMap);
      if (matched) {
        authorData.fullName = matched.name;
        authorData.avatarSrc = matched.src;
      }
    }

    return { assignees: assigneeMap, authors: authorMap, unassignedCount };
  }

  function parseAuthorName(text) {
    const trimmed = text.trim();
    // Match "By Name" followed by a time indicator:
    // - Day names: Monday, Tuesday, ..., yesterday, today
    // - Month names: Jan, Feb, ...
    // - Relative: "at HH:MM", "on ...", digit (date)
    const match = trimmed.match(
      /^By\s+(.+?)(?:\s+(?:yesterday|today|on\s|at\s|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d))/i
    );
    return match ? match[1].trim() : null;
  }

  function getCardAuthorName(wrapEl) {
    const authorEl = wrapEl.querySelector('.kanban-card__author');
    if (!authorEl) return null;
    return parseAuthorName(authorEl.textContent);
  }

  function getCardAssigneeIds(wrapEl) {
    const imgs = wrapEl.querySelectorAll('.kanban-card__assignee img[data-avatar-for-person-id]');
    return Array.from(imgs).map((img) => img.dataset.avatarForPersonId);
  }

  function isUnassigned(wrapEl) {
    return getCardAssigneeIds(wrapEl).length === 0;
  }

  // ──────────────────────────────────────────────
  // Custom dropdown with avatar/pill support
  // ──────────────────────────────────────────────

  /**
   * Create a custom dropdown.
   * Options: { value, label, avatarSrc?, tagColor? }
   * tagColor: { bg, fg } for rendering a pill in the dropdown.
   */
  function createCustomDropdown(id, options) {
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

  function buildMenuItems(container, menu, options) {
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

  function selectItem(container, value, label, avatarSrc, tc) {
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

  // ──────────────────────────────────────────────
  // Column counter updates
  // ──────────────────────────────────────────────

  const originalCounts = new Map();

  function updateColumnCounts() {
    const isFiltering = isActivelyFiltering();

    document.querySelectorAll('.kanban-column__cards-number').forEach((countEl) => {
      if (!originalCounts.has(countEl.id)) {
        const origMatch = countEl.textContent.match(/\((\d+)\)/);
        if (origMatch) {
          originalCounts.set(countEl.id, parseInt(origMatch[1], 10));
        }
      }

      const column = countEl.closest('.kanban-column') || countEl.closest('.kanban-triage');
      if (!column) return;
      if (column.closest(COLLAPSED_COLUMN_SELECTOR)) return;

      const allWraps = column.querySelectorAll(CARD_WRAP_SELECTOR);
      const totalCount = allWraps.length;
      const visibleCount = Array.from(allWraps).filter(
        (w) => !w.classList.contains('bkf-hidden')
      ).length;

      if (isFiltering) {
        countEl.textContent = `(${visibleCount}/${totalCount})`;
      } else {
        const orig = originalCounts.get(countEl.id);
        countEl.textContent = orig !== undefined ? `(${orig})` : `(${totalCount})`;
      }
    });
  }

  function updateShadowcards() {
    const containers = document.querySelectorAll('.kanban-column__cards, .kanban-triage__cards');

    containers.forEach((container) => {
      if (container.closest(COLLAPSED_COLUMN_SELECTOR)) return;

      const wraps = container.querySelectorAll(CARD_WRAP_SELECTOR);
      const visibleCount = Array.from(wraps).filter(
        (w) => !w.classList.contains('bkf-hidden')
      ).length;

      let shadow = container.querySelector('.kanban-card--shadowcard');

      if (visibleCount === 0) {
        if (!shadow) {
          shadow = document.createElement('div');
          shadow.className = 'kanban-card--shadowcard';
          container.appendChild(shadow);
        }
        shadow.classList.add('bkf-shadowcard-visible');
      } else if (shadow) {
        shadow.classList.remove('bkf-shadowcard-visible');
      }
    });
  }

  /** Check if any filter is active. */
  function isActivelyFiltering() {
    const a = document.getElementById('bkf-assignee')?.dataset.value;
    const b = document.getElementById('bkf-author')?.dataset.value;
    const t = document.getElementById('bkf-tag')?.dataset.value;
    return (a && a !== '__all__') || (b && b !== '__all__') || (t && t !== '__all__');
  }

  // ──────────────────────────────────────────────
  // MutationObserver for card DOM changes (drag & drop, new cards, etc.)
  // ──────────────────────────────────────────────

  let cardObserver = null;

  function startCardObserver() {
    if (cardObserver) { cardObserver.disconnect(); cardObserver = null; }

    // Observe the board container for added/removed card nodes
    const board = document.querySelector('.kanban-columns, .panel--kanban-board, #main-content');
    if (!board) return;

    let debounce = null;
    cardObserver = new MutationObserver((mutations) => {
      // Only care about mutations that add/remove article.kanban-card__wrap nodes
      const relevant = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) => n.nodeType === 1 && (
            n.matches?.(CARD_WRAP_SELECTOR) || n.querySelector?.(CARD_WRAP_SELECTOR)
          )
        )
      );
      if (!relevant) return;

      // Debounce: Turbo may add multiple cards in quick succession
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        log('cardObserver: new cards detected, re-rendering pills and re-applying filters');
        renderTagPills();
        if (isActivelyFiltering()) applyFilters();
      }, 50);
    });

    cardObserver.observe(board, { childList: true, subtree: true });
    log('cardObserver started on', board.tagName, board.className.slice(0, 40));
  }

  // ──────────────────────────────────────────────
  // Filter bar injection & filtering
  // ──────────────────────────────────────────────

  function injectFilterBar() {
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
   * Restore filter selections from the URL hash (priority) or localStorage (fallback) and apply.
   */
  function restoreFiltersFromHash() {
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

  /** Apply the current filter selections to all card wraps. */
  function applyFilters() {
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

  // ──────────────────────────────────────────────
  // MutationObserver for inline title editing (detail page)
  // ──────────────────────────────────────────────

  let titleObserver = null;

  /**
   * Watch the card-perma__title h1 for inline edit transitions:
   * - textarea appears  → inject tag picker UI
   * - textarea disappears (back to view mode) → re-render tag pills
   */
  function observeTitleH1() {
    // Clean up any previous observer
    if (titleObserver) {
      titleObserver.disconnect();
      titleObserver = null;
    }

    const titleH1 = document.querySelector('h1.card-perma__title');
    if (!titleH1) return;

    log('Detail page: attaching MutationObserver to h1.card-perma__title');

    let wasEditMode = !!titleH1.querySelector('textarea');

    // If already in edit mode at setup time, inject the UI immediately
    if (wasEditMode) {
      log('Detail page: h1 already in edit mode at observer setup, injecting UI');
      let retries = 0;
      const tryInject = () => {
        const ok = injectEditUI();
        if (!ok && retries < 10) { retries++; setTimeout(tryInject, 200); }
      };
      tryInject();
    }

    titleObserver = new MutationObserver(() => {
      const isEditMode = !!titleH1.querySelector('textarea');

      if (!wasEditMode && isEditMode) {
        // Switched to inline edit — inject the tag picker
        log('Detail page: inline edit opened (textarea appeared)');
        wasEditMode = true;
        let retries = 0;
        const tryInject = () => {
          const ok = injectEditUI();
          if (!ok && retries < 10) { retries++; setTimeout(tryInject, 200); }
        };
        tryInject();
      } else if (wasEditMode && !isEditMode) {
        // Switched back to view mode — re-render tag pills
        log('Detail page: inline edit closed (textarea gone), re-rendering pills');
        wasEditMode = false;
        // Remove stale edit UI if present
        document.getElementById(EDIT_UI_ID)?.remove();
        renderDetailPageTags();
      }
    });

    titleObserver.observe(titleH1, { childList: true, subtree: true });
  }

  // ──────────────────────────────────────────────
  // Init
  // ──────────────────────────────────────────────

  // Guard against multiple concurrent waitForCards loops (e.g. DOMContentLoaded + turbo:load)
  let _boardInitPending = false;

  function init() {
    log('init() called');

    // Card edit pages (full /edit URL): inject tag picker + live highlight
    if (isCardEditPage()) {
      let retries = 0;
      const tryInject = () => {
        const ok = injectEditUI();
        if (!ok) {
          retries++;
          if (retries < 20) setTimeout(tryInject, 300);
        }
      };
      tryInject();
      return;
    }

    // Card detail pages: render tag pills + watch for inline title editing
    if (isCardDetailPage()) {
      renderDetailPageTags();
      observeTitleH1();
      return;
    }

    // Column detail pages: render tag pills in card titles (same as board)
    if (isKanbanColumnPage()) {
      renderTagPills();
      return;
    }

    if (!isKanbanBoard()) {
      log('Not a kanban board, card detail, or card edit page, aborting init');
      return;
    }

    // Prevent multiple concurrent waitForCards polling loops
    if (_boardInitPending) {
      log('Board init already pending, skipping duplicate init');
      return;
    }
    _boardInitPending = true;

    let retryCount = 0;
    const waitForCards = () => {
      const cards = document.querySelectorAll(CARD_WRAP_SELECTOR);
      log(`waitForCards attempt #${retryCount + 1}: found ${cards.length} card wraps`);
      if (cards.length > 0) {
        _boardInitPending = false;
        injectFilterBar();
      } else {
        retryCount++;
        if (retryCount > 20) {
          _boardInitPending = false;
          warn('Gave up waiting for cards after 20 attempts (10s)');
          return;
        }
        setTimeout(waitForCards, 500);
      }
    };

    waitForCards();
  }

  // --- Kick off ---
  log('Document readyState:', document.readyState);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      log('DOMContentLoaded fired');
      init();
    });
  } else {
    log('Document already ready, running init immediately');
    init();
  }

  document.addEventListener('turbo:load', () => {
    log('turbo:load event fired');
    _boardInitPending = false; // Reset on navigation so a fresh init can run
    init();
  });
  document.addEventListener('turbo:render', () => {
    log('turbo:render event fired');
    init();
  });
  // Turbo Frames: fires when a frame finishes loading (e.g. inline title edit open/close)
  document.addEventListener('turbo:frame-load', () => {
    log('turbo:frame-load event fired');
    if (isCardDetailPage() || isCardEditPage()) {
      const h1 = document.querySelector('h1.card-perma__title');
      const hasTextarea = h1 && !!h1.querySelector('textarea');
      if (hasTextarea) {
        // Edit form loaded inside frame — inject tag picker
        log('turbo:frame-load: edit mode detected, injecting edit UI');
        let retries = 0;
        const tryInject = () => {
          const ok = injectEditUI();
          if (!ok && retries < 10) { retries++; setTimeout(tryInject, 200); }
        };
        tryInject();
      } else {
        // View mode restored — re-render tag pills and reset observer
        log('turbo:frame-load: view mode detected, rendering detail tags');
        document.getElementById(EDIT_UI_ID)?.remove();
        renderDetailPageTags();
        observeTitleH1();
      }
    }
  });
})();
