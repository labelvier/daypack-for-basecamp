#!/usr/bin/env node
/**
 * Build script — compiles shared/content.js + shared/content.css
 * into chrome/shared/ and safari/.../Resources/ (minified).
 *
 * Usage:
 *   npm run build          — production build (minified)
 *   npm run build -- --dev — development build (readable, no minify)
 */

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const isDev = process.argv.includes('--dev');

const TARGETS = [
  path.join(root, 'chrome', 'shared'),
  path.join(root, 'firefox', 'shared'),
  path.join(root, 'safari', 'Daypack by Label Vier', 'Daypack by Label Vier Extension', 'Resources'),
];

const SRC_JS  = path.join(root, 'shared', 'content.js');
const SRC_CSS = path.join(root, 'shared', 'content.css');

// Ensure target directories exist
TARGETS.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

async function build() {
  console.log(`Building ${isDev ? '(dev — readable)' : '(production — minified)'}…`);

  // --- JS via esbuild (bundle: true to resolve imports across the shared/ modules) ---
  const jsResult = await esbuild.build({
    entryPoints: [SRC_JS],
    bundle: true,         // Bundle all import/export modules into one output file
    format: 'iife',       // Wrap in an IIFE so no globals leak into the page
    minify: !isDev,
    sourcemap: isDev ? 'inline' : false,
    write: false,         // Capture output in memory
    logLevel: 'info',
    define: {
      __DEV__: isDev ? 'true' : 'false',
    },
  });

  const jsOutput = jsResult.outputFiles[0].text;

  // --- CSS via esbuild ---
  const cssResult = await esbuild.build({
    entryPoints: [SRC_CSS],
    bundle: false,
    minify: !isDev,
    write: false,
    logLevel: 'info',
  });

  const cssOutput = cssResult.outputFiles[0].text;

  // --- Write to all targets ---
  for (const dir of TARGETS) {
    // Remove symlinks first if present (e.g. after git clone on macOS)
    for (const [file, content] of [[`content.js`, jsOutput], [`content.css`, cssOutput]]) {
      const dest = path.join(dir, file);
      try { fs.unlinkSync(dest); } catch {}
      fs.writeFileSync(dest, content, 'utf8');
    }
    const shortDir = path.relative(root, dir);
    console.log(`  → ${shortDir}/content.js  (${(Buffer.byteLength(jsOutput) / 1024).toFixed(1)} kB)`);
    console.log(`  → ${shortDir}/content.css (${(Buffer.byteLength(cssOutput) / 1024).toFixed(1)} kB)`);
  }

  console.log('Done.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
