# Changelog

All notable changes to Backpack by Label Vier are documented here.

## [Unreleased]

### Added
- **Tag pills in the Hey menu** — Kanban card reading items in the Hey (notification) menu now show tag pills extracted from `[tag]` syntax in the card title. Tags are replaced in-place, so prefixes like "Re: " and "Due today: " are preserved at the correct position.
- **Tag pills on /my/readings page** — The same tag pill rendering applies to the full notifications page (`/my/readings`), including lazily-loaded items.

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
