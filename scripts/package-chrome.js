#!/usr/bin/env node
/**
 * Package Chrome extension as a .zip ready for the Chrome Web Store.
 *
 * Usage:
 *   npm run package:chrome
 *
 * Output: build/chrome/backpack-by-label-vier-v{version}.zip
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Read version from manifest
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'chrome', 'manifest.json'), 'utf8'));
const version = manifest.version;
const outDir = path.join(root, 'build', 'chrome');
const outFile = path.join(outDir, `backpack-by-label-vier-v${version}.zip`);

// First run a production build
console.log('Running production build…');
execSync('node scripts/build.js', { cwd: root, stdio: 'inherit' });

// Create output directory
fs.mkdirSync(outDir, { recursive: true });

// Remove existing zip if present
try { fs.unlinkSync(outFile); } catch {}

// Zip chrome/ directory
console.log(`Packaging chrome/ → ${path.relative(root, outFile)}`);
execSync(
  `zip -r "${outFile}" . -x "*.DS_Store" -x "__MACOSX/*" -x "*.map"`,
  { cwd: path.join(root, 'chrome'), stdio: 'inherit' }
);

const size = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`Done — ${size} kB`);
