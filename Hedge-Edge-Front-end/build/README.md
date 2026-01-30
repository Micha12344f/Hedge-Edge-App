# Build Resources

This folder contains resources used by electron-builder for packaging the desktop app.

## Required Icons

Before building for distribution, add the following icon files:

### Windows
- `icon.ico` - Windows icon (256x256 recommended, multi-resolution ICO)

### macOS  
- `icon.icns` - macOS icon (512x512 or 1024x1024)

### Linux / General
- `icon.png` - PNG icon (512x512 recommended)

## Generating Icons

You can use tools like:
- [electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker)
- [png2icons](https://www.npmjs.com/package/png2icons)
- Online converters like [icoconvert.com](https://icoconvert.com/)

### Quick generation with electron-icon-maker:

```bash
# Install globally
npm install -g electron-icon-maker

# Generate all formats from a 1024x1024 PNG
electron-icon-maker --input=./source-icon.png --output=./build
```

## Other Files

- `entitlements.mac.plist` - macOS entitlements for code signing and notarization
