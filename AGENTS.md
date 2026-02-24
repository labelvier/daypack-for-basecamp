# Development Guidelines for Basecamp Kanban Filter

## Project Overview

Browser extension (Chrome + Safari) that adds filtering capabilities to Basecamp 3 card tables (kanban boards). The extension runs as a content script on Basecamp pages, adding assignee, author, and tag filters with visual tag pills.

## Project Structure

```
basecamp_kanban/
├── shared/           # SOURCE OF TRUTH - All development happens here
│   ├── content.js    # Main content script (1482 lines)
│   └── content.css   # Extension styles
├── chrome/           # Chrome extension wrapper
│   ├── manifest.json
│   ├── icons/
│   └── shared/       # Currently duplicated, SHOULD BE symlink to ../shared
├── safari/           # Safari extension (Xcode project)
│   └── Backpack by Label Vier/
│       └── Backpack by Label Vier Extension/
│           └── Resources/  # Currently duplicated, SHOULD BE symlink
└── build_for_safari/ # Safari build output
```

## File Synchronization Strategy

### Current Problem
Currently, `content.js` and `content.css` are **duplicated** across:
- `/shared/` (source of truth)
- `/chrome/shared/` (duplicate)
- `/safari/.../Resources/` (duplicate, often outdated)

This causes sync issues and version drift.

### Recommended Solution: Use Symlinks

**IMPORTANT**: Always edit files in `/shared/` directory only. Use symlinks to share them with Chrome and Safari.

#### Setup Symlinks (run once):

```bash
# Remove duplicated files in chrome/shared/
rm /Users/mulder/Sites/opencode/basecamp_kanban/chrome/shared/content.js
rm /Users/mulder/Sites/opencode/basecamp_kanban/chrome/shared/content.css

# Create symlinks in chrome/shared/
cd /Users/mulder/Sites/opencode/basecamp_kanban/chrome/shared
ln -s ../../shared/content.js content.js
ln -s ../../shared/content.css content.css

# Remove duplicated files in Safari
rm "/Users/mulder/Sites/opencode/basecamp_kanban/safari/Backpack by Label Vier/Backpack by Label Vier Extension/Resources/content.js"
rm "/Users/mulder/Sites/opencode/basecamp_kanban/safari/Backpack by Label Vier/Backpack by Label Vier Extension/Resources/content.css"

# Create symlinks in Safari Resources
cd "/Users/mulder/Sites/opencode/basecamp_kanban/safari/Backpack by Label Vier/Backpack by Label Vier Extension/Resources"
ln -s ../../../../shared/content.js content.js
ln -s ../../../../shared/content.css content.css
```

#### Verify Symlinks:
```bash
ls -la chrome/shared/          # Should show content.js -> ../../shared/content.js
ls -la safari/.../Resources/   # Should show content.js -> ../../../../shared/content.js
```

### Development Workflow

1. **Edit only in `/shared/` directory**
2. Symlinks automatically reflect changes in Chrome and Safari folders
3. No manual copying needed
4. No version drift

## Build & Development Commands

### Chrome Extension
- **Load for development**: Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `chrome/` directory
- **Test**: Manually test on https://3.basecamp.com/*/buckets/*/card_tables/*
- **Package**: Zip the `chrome/` directory for Chrome Web Store submission
- **Note**: With symlinks, Chrome will read directly from `/shared/`

### Safari Extension
- **Build**: Open `safari/Backpack by Label Vier/Backpack by Label Vier.xcodeproj` in Xcode
- **Run**: Build and run from Xcode (⌘R)
- **Archive**: Product → Archive in Xcode
- **Test**: Enable unsigned extensions in Safari → Develop menu
- **Note**: Xcode follows symlinks during build

### No Build System
This project has **no build step** - it uses vanilla JavaScript and CSS. Changes to `shared/content.js` or `shared/content.css` are immediately reflected after reloading the extension.

## Code Style Guidelines

### Language & Approach
- **Vanilla JavaScript** (ES6+) - no frameworks, no transpilation
- **Strict mode**: All code runs in IIFE with `'use strict'`
- **Browser APIs only**: Uses DOM APIs, MutationObserver, sessionStorage
- **Basecamp integration**: Targets Basecamp 3's DOM structure and Turbo events

### Code Organization
- **Section headers**: Use ASCII art separators for major sections:
  ```javascript
  // ──────────────────────────────────────────────
  // Section name
  // ──────────────────────────────────────────────
  ```
- **Single file**: All logic in one `content.js` file (1482 lines)
- **Top-down flow**: Constants → utilities → core features → initialization

### Naming Conventions
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `LOG_PREFIX`, `FILTER_BAR_ID`, `TAG_REGEX`)
- **Functions**: `camelCase`, descriptive verbs (e.g., `renderTagPills`, `extractTags`, `scanPersons`)
- **Variables**: `camelCase` (e.g., `tagCounts`, `assigneeMap`, `authorMap`)
- **CSS classes**: BEM-style with `bkf-` prefix (e.g., `bkf-filter-bar`, `bkf-dropdown__menu`, `bkf-tag-pill`)
- **Data attributes**: `data-bkf-*` (e.g., `data-bkf-tags`)
- **DOM IDs**: Kebab-case with `bkf-` prefix (e.g., `bkf-assignee`, `bkf-author`, `bkf-tag`)

### Selectors & DOM Queries
- **Store selectors as constants**: `const CARD_WRAP_SELECTOR = 'article.kanban-card__wrap'`
- **Use specific selectors**: Target Basecamp's existing classes (`.kanban-card__title`, `.kanban-card__assignee`)
- **Namespace classes**: Prefix all custom classes with `bkf-` to avoid conflicts
- **Cache DOM queries**: Store frequently accessed elements in variables

### Functions
- **JSDoc comments**: Add doc comments for complex functions
  ```javascript
  /**
   * Extract all tags from a text string. Returns array of normalized tag strings.
   * Also registers the original casing of each tag.
   */
  function extractTags(text) { ... }
  ```
- **Pure functions**: Prefer pure functions for data transformations (e.g., `normalizeTag`, `hashString`)
- **Small, focused functions**: Each function does one thing well
- **Return early**: Use early returns to reduce nesting

### Error Handling
- **Logging**: Use custom logging functions with prefix
  ```javascript
  const LOG_PREFIX = '[BKF]';
  const log = (...args) => console.log(LOG_PREFIX, ...args);
  const warn = (...args) => console.warn(LOG_PREFIX, ...args);
  ```
- **Null checks**: Always check for element existence before manipulation
  ```javascript
  const titleEl = wrap.querySelector('.kanban-card__title');
  if (!titleEl) return;
  ```
- **Defensive coding**: Check for edge cases (e.g., collapsed columns, missing data)
- **No try-catch**: Code relies on null checks rather than exception handling

### Data Management
- **sessionStorage**: Use for persisting tag state across page navigations
  ```javascript
  function saveTagsToSession(tags) {
    sessionStorage.setItem('bkf_known_tags', JSON.stringify(tags));
  }
  ```
- **Data attributes**: Store state on DOM elements (e.g., `titleEl.dataset.bkfTags`)
- **Maps for lookups**: Use `Map` for efficient key-value storage (e.g., `tagDisplayRegistry`)

### Event Handling
- **Turbo events**: Listen for Basecamp's Turbo navigation events
  ```javascript
  document.addEventListener('turbo:load', () => { init(); });
  document.addEventListener('turbo:render', () => { init(); });
  document.addEventListener('turbo:frame-load', () => { ... });
  ```
- **Delegation**: Use event delegation for dynamic content
- **MutationObserver**: Watch for DOM changes (drag & drop, new cards)
- **Debouncing**: Use `setTimeout` with retry logic for async DOM updates

### CSS
- **BEM naming**: Block-Element-Modifier with `bkf-` prefix
- **Basecamp matching**: Match Basecamp's visual style (colors, fonts, spacing)
- **CSS variables**: Use specific RGB values from Basecamp's design
  ```css
  border: 1px solid rgb(43, 55, 62);
  font-family: -apple-system, system-ui, "system-ui", Aptos, Roboto, "Segoe UI", Helvetica, Arial, sans-serif;
  ```
- **Positioning**: Use absolute positioning for filter bar overlay
- **z-index management**: Careful layering (filter bar: 10, dropdown: 999)

### Algorithms & Logic
- **Deterministic colors**: Use FNV-1a hash for consistent tag colors
- **WCAG compliance**: Calculate contrast ratios for accessible text colors
  ```javascript
  function luminance(r, g, b) { ... }
  function contrastRatio(l1, l2) { ... }
  ```
- **Regex patterns**: Use simple, readable patterns (e.g., `/\[([^\]]+)\]/g` for tags)
- **String normalization**: Lowercase, trim, collapse spaces for matching

### Performance
- **Lazy initialization**: Wait for DOM readiness with retry logic
- **Avoid reflow**: Batch DOM updates where possible
- **Early exits**: Skip processing for collapsed columns or already-processed elements
- **Efficient selectors**: Use specific class selectors over complex traversal

## Testing

### Manual Testing Workflow
1. Make changes to `shared/content.js` or `shared/content.css`
2. Chrome: Go to `chrome://extensions`, click reload button for "Backpack by Label Vier"
3. Safari: Rebuild in Xcode or use Develop → Allow Unsigned Extensions
4. Navigate to a Basecamp card table: `https://3.basecamp.com/*/buckets/*/card_tables/*`
5. Test filtering, tag pills, card detail pages, and edit mode
6. Check browser console for `[BKF]` log messages

### Test Scenarios
- **Filter dropdowns**: Select assignee/author/tag filters, verify cards hide/show correctly
- **Tag pills**: Verify tags render on cards, detail pages, and in edit mode
- **Tag editor**: Add/remove tags using the picker in edit mode
- **Column counts**: Verify counts update when filtering (e.g., "(5/12)")
- **Turbo navigation**: Navigate between pages, verify filters persist/reset correctly
- **Edge cases**: Empty boards, unassigned cards, cards with no tags

### No Automated Tests
This project has no test framework. All testing is manual browser testing.

### Agent Testing (Browser Console Injection)

**For AI agents with browser access**: You can test code changes directly without reloading the extension by injecting JavaScript and CSS via the browser console.

#### Testing JavaScript Changes
1. Use browser tools to navigate to a Basecamp card table page
2. Open the browser console
3. Inject the updated JavaScript code:
   ```javascript
   // First, remove existing extension code (if running)
   // Then inject the new code by reading shared/content.js and executing it
   ```
4. The code will execute immediately in the page context
5. Verify functionality and check console for `[BKF]` log messages

#### Testing CSS Changes
1. Navigate to a Basecamp card table page
2. Open the browser console
3. Inject CSS changes:
   ```javascript
   const style = document.createElement('style');
   style.id = 'bkf-injected-styles';
   style.textContent = `/* paste content.css here */`;
   document.head.appendChild(style);
   ```
4. Verify visual changes immediately
5. To update styles, remove old style tag and inject new one:
   ```javascript
   document.getElementById('bkf-injected-styles')?.remove();
   ```

#### Agent Testing Workflow
1. Read `shared/content.js` or `shared/content.css`
2. Make your code changes
3. Use browser screenshot/console tools to verify current state
4. Inject the modified code via console
5. Take screenshot to verify changes
6. Check browser console for errors or `[BKF]` logs
7. If working correctly, write changes back to the file

**Important**: Since content.js runs in an IIFE, you can execute it multiple times for testing. However, be aware that event listeners and DOM modifications will accumulate unless you clean up first.

## Git Workflow

This project is **not currently a Git repository**. To initialize:
```bash
git init
git add .
git commit -m "Initial commit: Basecamp Kanban Filter extension"
```

## Browser Compatibility

- **Chrome**: Manifest v3, tested on Chrome 120+
- **Safari**: Safari Web Extension, tested on Safari 17+
- **Target**: Basecamp 3 only (https://3.basecamp.com)

## Key Constraints

- No npm, no webpack, no TypeScript - pure vanilla JS
- Must not break Basecamp's native functionality
- Must handle Turbo navigation (SPA-style page loads)
- Must be visually consistent with Basecamp's design system
- Must persist state across page navigations (sessionStorage)
