#!/bin/bash

# Configuration
APP_NAME="Gromit Bridge"
SRC_FILE="native_src/GromitOCR.swift"
OUTPUT_DIR="dist_app"
CONTENTS_DIR="$OUTPUT_DIR/$APP_NAME.app/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

# Create structure
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Compile Swift (macOS SDK)
echo "Compiling $APP_NAME..."
xcrun -sdk macosx swiftc "$SRC_FILE" -o "$MACOS_DIR/GromitOCR" -O

# Create Info.plist
cat > "$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>GromitOCR</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.gromit.bridge</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF

echo "Build complete: $OUTPUT_DIR/$APP_NAME.app"
echo "To test: open '$OUTPUT_DIR/$APP_NAME.app'"
