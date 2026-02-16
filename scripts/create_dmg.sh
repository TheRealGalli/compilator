#!/bin/bash

# Configuration
APP_NAME="Gromit Bridge"
DMG_NAME="GromitBridgeInstaller"
APP_PATH="dist_app/$APP_NAME.app"
DMG_PATH="dist_app/$DMG_NAME.dmg"
VOLUME_NAME="GromitBridge"

# Cleanup
rm -f "$DMG_PATH"
rm -f "$DMG_PATH-tmp.dmg"

echo "Creating DMG for $APP_NAME..."

# Create a temporary disk image
hdiutil create -size 100m -fs HFS+ -volname "$VOLUME_NAME" -ov "$DMG_PATH-tmp.dmg"

# Mount the temporary image and get the mount point robustly
MOUNT_RES=$(hdiutil attach "$DMG_PATH-tmp.dmg" | grep /Volumes/)
MOUNT_POINT=$(echo "$MOUNT_RES" | awk -F'\t' '{print $3}' | sed 's/^[[:space:]]*//')

echo "Mount point: $MOUNT_POINT"

if [ -z "$MOUNT_POINT" ]; then
    echo "ERROR: Could not find mount point"
    exit 1
fi

# Copy the app to the volume
echo "Copying app to DMG..."
cp -R "$APP_PATH" "$MOUNT_POINT/"

# Create a symbolic link to Applications
echo "Creating Applications link..."
ln -s /Applications "$MOUNT_POINT/Applications"

# Unmount the image
echo "Unmounting..."
hdiutil detach "$MOUNT_POINT"

# Convert to a compressed read-only image
echo "Converting to compressed DMG..."
hdiutil convert "$DMG_PATH-tmp.dmg" -format UDZO -o "$DMG_PATH"

# Cleanup temporary image
rm "$DMG_PATH-tmp.dmg"

echo "DMG created at $DMG_PATH"
