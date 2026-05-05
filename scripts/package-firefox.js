#!/usr/bin/env node
/**
 * Package Firefox extension as a .zip ready for Firefox Add-ons (AMO).
 *
 * Usage:
 *   npm run package:firefox
 *
 * Output: build/firefox/daypack-by-label-vier-firefox-v{version}.zip
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Read version from manifest
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'firefox', 'manifest.json'), 'utf8'));
const version = manifest.version;
const outDir = path.join(root, 'build', 'firefox');
const outFile = path.join(outDir, `daypack-by-label-vier-firefox-v${version}.zip`);

// First run a production build
console.log('Running production build…');
execSync('node scripts/build.js', { cwd: root, stdio: 'inherit' });

// Create output directory
fs.mkdirSync(outDir, { recursive: true });

// Remove existing zip if present
try { fs.unlinkSync(outFile); } catch {}

// Zip firefox/ directory
console.log(`Packaging firefox/ → ${path.relative(root, outFile)}`);
execSync(
  `zip -r "${outFile}" . -x "*.DS_Store" -x "__MACOSX/*" -x "*.map"`,
  { cwd: path.join(root, 'firefox'), stdio: 'inherit' }
);

const size = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`Done — ${size} kB`);
