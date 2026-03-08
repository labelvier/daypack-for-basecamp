# Changelog

All notable changes to Backpack by Label Vier are documented here.

## [Unreleased]

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
