#!/usr/bin/env node
/**
 * Deploy Chrome extension to the Chrome Web Store.
 *
 * Required env vars:
 *   CHROME_EXTENSION_ID
 *   CHROME_CLIENT_ID
 *   CHROME_CLIENT_SECRET
 *   CHROME_REFRESH_TOKEN
 *
 * Optional env vars:
 *   CHROME_TRUSTED_TESTERS  set to "1" to publish only to trusted testers
 *   CHROME_SKIP_PUBLISH     set to "1" to upload draft only (no publish)
 *
 * Usage (must run via `npm run deploy:chrome` so node_modules/.bin is on PATH):
 *   npm run deploy:chrome
 */

import './load-env.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const required = ['CHROME_EXTENSION_ID', 'CHROME_CLIENT_ID', 'CHROME_CLIENT_SECRET', 'CHROME_REFRESH_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'chrome', 'manifest.json'), 'utf8'));
const version = manifest.version;
const zipPath = path.join(root, 'build', 'chrome', `daypack-by-label-vier-chrome-v${version}.zip`);

if (!fs.existsSync(zipPath)) {
  console.log('Zip not found — running package:chrome first…');
  execSync('npm run package:chrome', { cwd: root, stdio: 'inherit' });
}

const skipPublish = process.env.CHROME_SKIP_PUBLISH === '1';
const trustedTesters = process.env.CHROME_TRUSTED_TESTERS === '1';

// chrome-webstore-upload CLI reads these env names directly
const env = {
  ...process.env,
  EXTENSION_ID: process.env.CHROME_EXTENSION_ID,
  CLIENT_ID: process.env.CHROME_CLIENT_ID,
  CLIENT_SECRET: process.env.CHROME_CLIENT_SECRET,
  REFRESH_TOKEN: process.env.CHROME_REFRESH_TOKEN,
};

if (skipPublish) {
  console.log(`Uploading Chrome v${version} (draft only)…`);
  execSync(`chrome-webstore-upload upload --source "${zipPath}"`, { cwd: root, stdio: 'inherit', env });
} else {
  console.log(`Uploading + publishing Chrome v${version}${trustedTesters ? ' (trusted testers)' : ''}…`);
  const flags = ['--source', `"${zipPath}"`];
  if (trustedTesters) flags.push('--trusted-testers');
  execSync(`chrome-webstore-upload ${flags.join(' ')}`, { cwd: root, stdio: 'inherit', env });
}
console.log('Done.');
