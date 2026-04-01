#!/usr/bin/env node
/**
 * Watch script — watches shared/ for changes and rebuilds immediately.
 * Uses a development build (readable, with inline sourcemaps).
 *
 * Usage:
 *   npm run dev
 *
 * After a change is detected, reload the extension in Chrome:
 *   chrome://extensions → click the reload (↺) button on Daypack by Label Vier
 */

import chokidar from 'chokidar';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sharedDir = path.join(root, 'shared');

function rebuild() {
  const start = Date.now();
  try {
    execSync('node scripts/build.js --dev', { cwd: root, stdio: 'inherit' });
    console.log(`  ✓ Built in ${Date.now() - start}ms — reload the extension in Chrome to see changes.\n`);
  } catch {
    console.error('  ✗ Build failed — see errors above.\n');
  }
}

console.log(`Watching ${path.relative(process.cwd(), sharedDir)}/ for changes…`);
console.log('Press Ctrl+C to stop.\n');

// Initial build
rebuild();

// Watch the entire shared/ directory tree (JS + CSS across all subdirectories)
chokidar
  .watch(sharedDir, {
    ignoreInitial: true,
    ignored: /node_modules/,
  })
  .on('change', (filePath) => {
    console.log(`Changed: ${path.relative(root, filePath)}`);
    rebuild();
  })
  .on('add', (filePath) => {
    console.log(`Added: ${path.relative(root, filePath)}`);
    rebuild();
  });
