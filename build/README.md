# Build Directory

This directory contains all build artifacts and distribution packages.

## Structure

```
build/
├── chrome/          # Chrome extension builds (.zip packages)
├── firefox/         # Firefox extension builds (.zip packages)
├── safari/          # Safari extension builds (.app, .xcarchive)
└── README.md        # This file
```

## Chrome Builds

To create a Chrome extension package:

```bash
npm run package:chrome
```

This will:
1. Run a production build
  2. Create `build/chrome/daypack-by-label-vier-v{version}.zip`
3. Upload to Chrome Web Store

## Firefox Builds

To create a Firefox extension package:

```bash
npm run package:firefox
```

This will:
1. Run a production build
  2. Create `build/firefox/daypack-by-label-vier-v{version}.zip`
3. Upload to Firefox Add-ons (AMO)

## Safari Builds

Safari builds are created via Xcode:

  1. Open `safari/Daypack by Label Vier/Daypack by Label Vier.xcodeproj`
2. Product → Archive
3. Archives are stored in `~/Library/Developer/Xcode/Archives/`
4. Export to `build/safari/` for distribution

## Note

This entire `build/` directory is git-ignored (see `.gitignore`). Build artifacts are not committed to version control.
