/**
 * Person name parsing and matching utilities.
 */

// ──────────────────────────────────────────────
// Name utilities
// ──────────────────────────────────────────────

/**
 * Parse "By Name Monday" → "Name".
 * Supports day names, month abbreviations, relative dates.
 */
export function parseAuthorName(text) {
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

/**
 * Try to match an abbreviated author name (e.g. "Eric M.") to an assignee
 * with a full name (e.g. "Eric Mulder"). Handles Dutch tussenvoegsels
 * like "ter", "van", "de" (e.g. "Nathanael t." → "Nathanael ter Borg").
 * Returns the assignee object or null.
 */
export function matchAuthorToAssignee(authorName, assigneeMap) {
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
