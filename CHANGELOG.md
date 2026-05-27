# Changelog

All notable changes to Daypack by Label Vier are documented here.

## [Unreleased]

## [2.0.0] — 2026-05-27

### Added
- **Tag pills on search results page** — Kanban card results on the `/search` page now show tag pills. A MutationObserver handles infinite-scroll pagination so newly loaded results are processed automatically.

### Changed
- **Basecamp 5 compatibility** — Full BC5 support across all features:
  - **Detail page title** — Updated selector to `h1.perma-header__title` (BC5 renamed `card-perma__title`); both classes supported so BC4 continues to work.
  - **Archived card detail pages** — Tag pills now render on archived cards, which have no edit link and use a plain `<div>` as title container instead of an `<a>` element.
  - **Hey menu** — Extended to `#sidebar_frame` and `aside.sidebar` (BC5 replaced `#navigation_readings`). Observer now processes `article.reading` nodes anywhere in the tree.
  - **Filter bar** — Injects into BC5's native `nav.filter[aria-label="Card filters"]` flex row as a static sibling. Falls back to the BC4 `.perma__header` chain.
  - **Jump menu (Cmd+J)** — Rewritten for BC5's `#my-navigation-menu-listbox` / `li.nav-menu__result` / `span[data-content-filter-target="ariaText"]` structure. BC4 support dropped.
- **Tag pill colors** — Palette replaced with tints of BC5's own color-picker hues (yellow / orange / red / pink / purple / blue / green / sand) at 88% lightness. All colors verified WCAG AA (≥4.5:1 with dark text). Contrast picker now compares against actual `#3d4f5f` luminance instead of pure black.

## [1.0.2] — 2026-05-05

### Added
- **Tag pills in the Hey menu** — Kanban card reading items in the Hey (notification) menu now show tag pills extracted from `[tag]` syntax in the card title. Tags are replaced in-place, so prefixes like "Re: " and "Due today: " are preserved at the correct position.
- **Tag pills on /my/readings page** — The same tag pill rendering applies to the full notifications page (`/my/readings`), including lazily-loaded items.
- **Tag pills on column (tab) pages** — Individual column (single lane) pages now render tag pills, with `cardObserver` re-running on infinite-scroll batches. The filter bar itself remains board-only.
- **Safari .app build automation** — `npm run package:safari` runs `xcodebuild` Release and zips the resulting `.app` to `build/safari/`. The release workflow runs this on a `macos-latest` runner and attaches the zip to the GitHub release.
- **Auto-deploy pipeline** — `npm run deploy:chrome` and `npm run deploy:firefox` upload + publish via `chrome-webstore-upload-cli` and `web-ext sign`. GitHub Actions release workflow auto-deploys to both stores on `release: published` and attaches separate Chrome / Firefox / Safari zips to the release.

### Changed
- **Renamed extension from Backpack to Daypack** — Display name, store descriptions, Xcode project, manifests and build paths all renamed. The Firefox `gecko.id` stays `backpack@labelvier.nl` so existing AMO installs receive updates seamlessly.
- **Safari version sync** — Bumped `MARKETING_VERSION` and the Safari extension manifest version to `1.0.2` in line with Chrome and Firefox.
- **Removed Turbo Streams `characterData` workaround** — `cardObserver` now only listens for new card nodes, simplifying the observer and reducing redundant work.

### Fixed
- **Tag pills not rendering on tabs with many cards** — Lazy-loaded card frames are now resolved before the filter bar is injected, so tag pills render reliably even on large boards.
- **Tag pills missing during infinite scroll on column pages** — `cardObserver` is now started on column pages so newly fetched cards get their pills rendered as the user scrolls.

## [1.0.1] — 2026-03-24

### Fixed
- **Safari version sync** — Bumped `MARKETING_VERSION` in the Xcode project and `version` in the Safari extension manifest from `0.1.0` / `1.0.0` to `1.0.1`, bringing them in line with `package.json` and the Chrome/Firefox manifests.

## [1.0.0] — 2026-03-24

### Added
- **Firefox support** — Extension now builds and packages for Firefox (Manifest v3). Added `firefox/` wrapper with manifest, icons and store description. `npm run build` outputs to `firefox/shared/`; `npm run package:firefox` creates a zip ready for Firefox Add-ons (AMO).
- **Firefox packaging script** — `scripts/package-firefox.js` mirrors the Chrome packaging workflow.

### Changed
- **Version bump to 1.0.0** — Marks the first stable, multi-browser release (Chrome, Firefox, Safari).

## [0.2.2] — 2026-03-10

### Changed
- **New app icon** — Replaced the placeholder icon with the official Backpack icon across Chrome (16, 32, 48, 128px) and Safari (extension icons, AppIcon, LargeIcon). Icon uses a coral-red background (`#E2645E`) with a white backpack illustration.

## [0.2.1] — 2026-03-10

### Added
- **GitHub Actions release pipeline** — A CI/CD workflow (`.github/workflows/release.yml`) now automatically builds and uploads the Chrome extension zip as a release asset whenever a new GitHub release is published. No more manual packaging and uploading.

## [0.2.0] — 2026-03-09

### Added
- **Tag picker in new card form** — When adding a new card via the inline "Add a card" form in a lane, a tag picker strip is now injected below the title input. Users can select existing tags from the board; selected tags are automatically appended to the card title as `[tag]` syntax. The picker detects and deduplicates tags already present in the title, and cleans up when the form is submitted or cancelled. Uses a MutationObserver to detect the inline form on any Basecamp card table page.

## [0.1.0] — 2026-03-08

### Added
- **Jump menu tag pills** — Tag pills now render in the Cmd+J quick-jump menu for card results. Titles with `[Tag]` syntax show styled pill elements; the plain-text aria span is kept intact so Basecamp's search filter continues to work. The observer re-attaches on Turbo navigations (`turbo:load` / `turbo:render`).

## [0.0.1] — 2026-02-25

### Added
- **esbuild build system** — Replaces manual file copying with an esbuild pipeline. `npm run build` produces minified output; `npm run dev` watches `shared/` and rebuilds on every save.
- **ES module refactor** — Monolithic `content.js` (~1500 lines) split into focused modules under `shared/`: `logger.js`, `constants.js`, `observers.js`, `utils/` (colors, tags, page, names), `data/` (scan, persistence), `ui/` (pills, dropdown, edit), `filters/` (counts, filterBar).

### Fixed
- **Turbo navigation** — Broadened the manifest match pattern from `.../card_tables/*` to `3.basecamp.com/*` so the content script is present on all Basecamp pages. The filter bar now initialises correctly when navigating from a project page to a kanban board via Turbo without a hard reload.

## [0.0.0] — 2026-02-24

### Added
- Initial release — Chrome and Safari extension that adds assignee, author, and tag filter dropdowns to Basecamp 4 card table (kanban) pages.
- Tag pills rendered on kanban board cards, card detail pages, column pages, and the card edit form.
- Deterministic WCAG-safe tag colours using FNV-1a hash.
- Tag editor (picker) injected into the card edit form with live `[tag]` highlight backdrop in the title input.
- Filter state persisted via `localStorage` and URL hash, surviving Turbo navigations.
- Column card counts updated to reflect active filters (e.g. "5/12").
