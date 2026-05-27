#!/usr/bin/env node
/**
 * Package Safari extension as a .zip ready for distribution.
 *
 * Usage:
 *   npm run package:safari
 *
 * Output: build/safari/daypack-by-label-vier-safari-v{version}.zip
 *
 * Note: requires Xcode + xcodebuild in PATH (macOS only).
 * The .app is signed with whatever signing identity Xcode picks (typically
 * the Development certificate in your keychain). For App Store submission
 * use Xcode → Archive.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const safariProject = path.join(root, 'safari', 'Daypack by Label Vier', 'Daypack by Label Vier.xcodeproj');
const safariManifest = path.join(root, 'safari', 'Daypack by Label Vier', 'Daypack by Label Vier Extension', 'Resources', 'manifest.json');

const manifest = JSON.parse(fs.readFileSync(safariManifest, 'utf8'));
const version = manifest.version;

const outDir = path.join(root, 'build', 'safari');
const derivedDir = path.join(outDir, 'derived');
const outFile = path.join(outDir, `daypack-by-label-vier-safari-v${version}.zip`);

fs.mkdirSync(outDir, { recursive: true });

// Run shared production build first so Resources/ is up-to-date
console.log('Running production build…');
execSync('node scripts/build.js', { cwd: root, stdio: 'inherit' });

// Build Safari .app via xcodebuild
console.log('Building Safari .app via xcodebuild (Release)…');
execSync(
  `xcodebuild -project "${safariProject}" -scheme "Daypack by Label Vier" -configuration Release -derivedDataPath "${derivedDir}" clean build`,
  { cwd: root, stdio: 'inherit' }
);

const appPath = path.join(derivedDir, 'Build', 'Products', 'Release', 'Daypack by Label Vier.app');
if (!fs.existsSync(appPath)) {
  console.error(`Build did not produce expected .app at ${appPath}`);
  process.exit(1);
}

// Remove existing zip if present
try { fs.unlinkSync(outFile); } catch {}

// Zip the .app bundle from its parent dir so the archive contains "Daypack by Label Vier.app/"
console.log(`Packaging .app → ${path.relative(root, outFile)}`);
const appParent = path.dirname(appPath);
const appName = path.basename(appPath);
execSync(
  `zip -ry "${outFile}" "${appName}" -x "*.DS_Store"`,
  { cwd: appParent, stdio: 'inherit' }
);

const size = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`Done — ${size} MB`);
