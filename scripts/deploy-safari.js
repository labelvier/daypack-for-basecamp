#!/usr/bin/env node
/**
 * Build the Safari extension package and upload the zip to the matching
 * GitHub release.
 *
 * The release tag is derived from the version in the Safari manifest
 * (e.g. version "2.1.0" → tag "2.1.0").
 *
 * Requirements:
 *   - macOS with Xcode + xcodebuild in PATH
 *   - `gh` CLI installed and authenticated (gh auth login)
 *
 * Usage:
 *   npm run deploy:safari
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const safariManifest = path.join(
  root,
  'safari',
  'Daypack by Label Vier',
  'Daypack by Label Vier Extension',
  'Resources',
  'manifest.json'
);

const version = JSON.parse(fs.readFileSync(safariManifest, 'utf8')).version;
const tag = version;
const zipPath = path.join(root, 'build', 'safari', `daypack-by-label-vier-safari-v${version}.zip`);

// Build the package if the zip is missing or outdated
if (!fs.existsSync(zipPath)) {
  console.log('Zip not found — running package:safari first…');
  execSync('npm run package:safari', { cwd: root, stdio: 'inherit' });
} else {
  console.log(`Using existing zip: ${path.relative(root, zipPath)}`);
}

// Verify the release exists before uploading
console.log(`Checking GitHub release for tag "${tag}"…`);
try {
  execSync(`gh release view "${tag}" --repo labelvier/backpack-for-basecamp`, {
    cwd: root,
    stdio: 'pipe',
  });
} catch {
  console.error(`No GitHub release found for tag "${tag}".`);
  console.error('Create the release first (e.g. push the tag and let the Release workflow run).');
  process.exit(1);
}

// Upload (--clobber replaces an existing asset with the same name)
console.log(`Uploading ${path.basename(zipPath)} to release "${tag}"…`);
execSync(
  `gh release upload "${tag}" "${zipPath}" --clobber --repo labelvier/backpack-for-basecamp`,
  { cwd: root, stdio: 'inherit' }
);

console.log('Done.');
