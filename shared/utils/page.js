/**
 * Page type detection helpers.
 * Detects which Basecamp page the content script is running on.
 */

import { log } from '../logger.js';

// ──────────────────────────────────────────────
// Page type detectors
// ──────────────────────────────────────────────

export function isKanbanBoard() {
  const path = window.location.pathname;
  const result = /\/card_tables\/\d+$/.test(path);
  log('isKanbanBoard?', result, '| pathname:', path);
  return result;
}

export function isKanbanColumnPage() {
  const path = window.location.pathname;
  const result = /\/card_tables\/columns\/\d+$/.test(path);
  log('isKanbanColumnPage?', result, '| pathname:', path);
  return result;
}

export function isCardDetailPage() {
  const path = window.location.pathname;
  const result = /\/card_tables\/cards\/\d+$/.test(path);
  log('isCardDetailPage?', result, '| pathname:', path);
  return result;
}

export function isCardEditPage() {
  const path = window.location.pathname;
  const result = /\/card_tables\/cards\/\d+\/edit$/.test(path);
  log('isCardEditPage?', result, '| pathname:', path);
  return result;
}
