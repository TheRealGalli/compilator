#!/bin/bash

# Configuration
SOURCE_IMAGE="client/public/extension/icon.png"
ICONSET_DIR="native_src/AppIcon.iconset"
OUTPUT_ICNS="native_src/AppIcon.icns"
SOURCE_ICON="client/public/extension/icon.png"
ICONSET="AppIcon.iconset"

# Create iconset directory
mkdir -p "$ICONSET"

# Generate various sizes using sips (force PNG format)
sips -z 16 16     "$SOURCE_ICON" --out "$ICONSET/icon_16x16.png"
sips -z 32 32     "$SOURCE_ICON" --out "$ICONSET/icon_16x16@2x.png"
sips -z 32 32     "$SOURCE_ICON" --out "$ICONSET/icon_32x32.png"
sips -z 64 64     "$SOURCE_ICON" --out "$ICONSET/icon_32x32@2x.png"
sips -z 128 128   "$SOURCE_ICON" --out "$ICONSET/icon_128x128.png"
sips -z 256 256   "$SOURCE_ICON" --out "$ICONSET/icon_128x128@2x.png"
sips -z 256 256   "$SOURCE_ICON" --out "$ICONSET/icon_256x256.png"
sips -z 512 512   "$SOURCE_ICON" --out "$ICONSET/icon_256x256@2x.png"
sips -z 512 512   "$SOURCE_ICON" --out "$ICONSET/icon_512x512.png"
sips -z 1024 1024 "$SOURCE_ICON" --out "$ICONSET/icon_512x512@2x.png"

# Convert to icns
iconutil -c icns "$ICONSET" -o AppIcon.icns

# Cleanup
rm -rf "$ICONSET_DIR"

if [ -f "$OUTPUT_ICNS" ]; then
    echo "ICNS created successfully at $OUTPUT_ICNS"
else
    echo "ERROR: Failed to create ICNS"
    exit 1
fi
