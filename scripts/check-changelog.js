#!/usr/bin/env node
/**
 * Validate that CHANGELOG.md contains a populated section for the current version.
 *
 * Pass/fail rules:
 *   - There must be a `## [X.Y.Z] — YYYY-MM-DD` section matching package.json version
 *   - The section must be non-empty (at least one bullet under any `### …` group)
 *
 * Usage:
 *   node scripts/check-changelog.js                 # uses version from package.json
 *   RELEASE_VERSION=1.2.3 node scripts/check-changelog.js   # explicit version
 *
 * Exit codes:
 *   0 — OK
 *   1 — missing or empty section
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = (process.env.RELEASE_VERSION || pkg.version).replace(/^v/, '');

const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

// Find `## [X.Y.Z] — YYYY-MM-DD` (em-dash or hyphen tolerated)
const headingRe = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\][ \\t]*[—\\-][ \\t]*(\\d{4}-\\d{2}-\\d{2})`, 'm');
const match = changelog.match(headingRe);
if (!match) {
  console.error(`✗ CHANGELOG.md is missing a "## [${version}] — YYYY-MM-DD" section.`);
  console.error('  Add an entry for this version before releasing.');
  process.exit(1);
}

// Extract section body up to the next `## ` heading
const start = match.index + match[0].length;
const rest = changelog.slice(start);
const next = rest.search(/\n## \[/);
const body = next === -1 ? rest : rest.slice(0, next);

const hasBullet = /^\s*-\s+\S/m.test(body);
if (!hasBullet) {
  console.error(`✗ CHANGELOG.md section for ${version} exists but has no bullet entries.`);
  process.exit(1);
}

console.log(`✓ CHANGELOG.md has a populated entry for v${version} (${match[1]}).`);
