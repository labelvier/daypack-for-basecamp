# Build Directory

This directory contains all build artifacts and distribution packages.

## Structure

```
build/
├── chrome/          # Chrome extension builds (.zip packages)
├── safari/          # Safari extension builds (.app, .xcarchive)
└── README.md        # This file
```

## Chrome Builds

To create a Chrome extension package:

1. Make your changes in `/shared/`
2. Test with Chrome extension loaded from `/chrome/` directory
3. When ready to package:
   ```bash
   cd chrome
   zip -r ../build/chrome/backpack-by-label-vier-v1.0.0.zip . -x "*.DS_Store" -x "__MACOSX"
   ```
4. Upload `build/chrome/backpack-by-label-vier-v1.0.0.zip` to Chrome Web Store

## Safari Builds

Safari builds are created via Xcode:

1. Open `safari/Backpack by Label Vier/Backpack by Label Vier.xcodeproj`
2. Product → Archive
3. Archives are stored in `~/Library/Developer/Xcode/Archives/`
4. Export to `build/safari/` for distribution

## Note

This entire `build/` directory is git-ignored (see `.gitignore`). Build artifacts are not committed to version control.
