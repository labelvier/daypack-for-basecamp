#!/usr/bin/env node
/**
 * Extract the body of a CHANGELOG.md section for a given version.
 *
 * Usage:
 *   node scripts/extract-changelog.js 2.0.0
 *   RELEASE_VERSION=2.0.0 node scripts/extract-changelog.js
 *
 * Prints the section body (minus the heading line) to stdout.
 * Exits 1 if the section is missing or empty.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const raw = (process.argv[2] || process.env.RELEASE_VERSION || '').replace(/^v/, '');
if (!raw) {
  console.error('Usage: node scripts/extract-changelog.js <version>');
  process.exit(1);
}

const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

const headingRe = new RegExp(
  `^## \\[${raw.replace(/\./g, '\\.')}\\][ \\t]*[—\\-][ \\t]*\\d{4}-\\d{2}-\\d{2}`,
  'm'
);
const match = changelog.match(headingRe);
if (!match) {
  console.error(`Section for v${raw} not found in CHANGELOG.md`);
  process.exit(1);
}

const start = match.index + match[0].length;
const rest = changelog.slice(start);
const next = rest.search(/\n## \[/);
const body = (next === -1 ? rest : rest.slice(0, next)).trim();

if (!body) {
  console.error(`Section for v${raw} is empty`);
  process.exit(1);
}

process.stdout.write(body + '\n');
