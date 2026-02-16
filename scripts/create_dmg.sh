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

# Script to set the icon positions and window size (Basic version using applescript via shell)
echo "Setting DMG appearance..."
osascript <<EOF
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {400, 100, 1424, 868} -- 1024x768 wide
        set viewOptions to the icon view options of container window
        set icon size of viewOptions to 160
        set arrangement of viewOptions to not arranged
        set position of item "$APP_NAME.app" of container window to {250, 384}
        set position of item "Applications" of container window to {774, 384}
        close
    end tell
end tell
EOF

# Unmount the image
echo "Unmounting..."
hdiutil detach "$MOUNT_POINT"

# Convert to a compressed read-only image
echo "Converting to compressed DMG..."
hdiutil convert "$DMG_PATH-tmp.dmg" -format UDZO -o "$DMG_PATH"

# Cleanup temporary image
rm "$DMG_PATH-tmp.dmg"

echo "DMG created at $DMG_PATH"
