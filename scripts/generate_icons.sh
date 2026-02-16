#!/bin/bash

# Configuration
SOURCE_IMAGE="client/public/extension/icon.png"
ICONSET_DIR="native_src/AppIcon.iconset"
OUTPUT_ICNS="native_src/AppIcon.icns"

# Create iconset directory
mkdir -p "$ICONSET_DIR"

# Generate various sizes using sips (force PNG format)
echo "Generating icon sizes..."
sips -z 16 16     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512@2x.png"

# Convert to icns
echo "Converting to icns..."
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

# Cleanup
rm -rf "$ICONSET_DIR"

if [ -f "$OUTPUT_ICNS" ]; then
    echo "ICNS created successfully at $OUTPUT_ICNS"
else
    echo "ERROR: Failed to create ICNS"
    exit 1
fi
