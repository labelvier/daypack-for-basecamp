#!/usr/bin/env node
/**
 * Deploy Firefox extension to Firefox Add-ons (AMO).
 *
 * Required env vars:
 *   AMO_JWT_ISSUER   AMO API key issuer (user:xxxx:yyy)
 *   AMO_JWT_SECRET   AMO API key secret
 *
 * Optional env vars:
 *   AMO_CHANNEL  default: "listed" (use "unlisted" for self-hosted)
 *
 * Usage:
 *   npm run deploy:firefox
 */

import './load-env.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Accept either AMO_JWT_* or FIREFOX_JWT_* names
const issuer = process.env.AMO_JWT_ISSUER || process.env.FIREFOX_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET || process.env.FIREFOX_JWT_SECRET;
if (!issuer || !secret) {
  console.error('Missing required env vars: AMO_JWT_ISSUER (or FIREFOX_JWT_ISSUER), AMO_JWT_SECRET (or FIREFOX_JWT_SECRET)');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'firefox', 'manifest.json'), 'utf8'));
const version = manifest.version;

// Ensure latest production build is in firefox/shared/
console.log('Running production build…');
execSync('node scripts/build.js', { cwd: root, stdio: 'inherit' });

const channel = process.env.AMO_CHANNEL || 'listed';
const sourceDir = path.join(root, 'firefox');
const artifactsDir = path.join(root, 'build', 'firefox');
fs.mkdirSync(artifactsDir, { recursive: true });

console.log(`Signing + uploading Firefox v${version} to AMO (channel: ${channel})…`);
execSync(
  [
    'web-ext sign',
    `--source-dir "${sourceDir}"`,
    `--artifacts-dir "${artifactsDir}"`,
    `--channel ${channel}`,
    `--api-key "${issuer}"`,
    `--api-secret "${secret}"`,
    `--amo-metadata "${path.join(__dirname, 'amo-metadata.json')}"`,
    '--ignore-files=FIREFOX_STORE_DESCRIPTION.md',
  ].join(' '),
  { cwd: root, stdio: 'inherit' }
);
console.log('Done.');
