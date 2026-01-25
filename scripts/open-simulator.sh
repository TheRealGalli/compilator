#!/bin/bash

# Configuration
PORT=${PORT:-5001}
URL="http://localhost:$PORT"
SIMULATOR_NAME="iPhone 16"
SIMULATOR_NAME_PLUS="iPhone 16 Plus"

echo "🚀 Starting iOS Simulator integration..."

# 1. Check if the local server is even responding
echo "🔍 Checking if local server is running on port $PORT..."
if ! curl -s --head "$URL" > /dev/null; then
    echo "--------------------------------------------------------"
    echo "❌ ERROR: Il server NON sembra essere attivo su $PORT."
    echo "--------------------------------------------------------"
    echo "Il simulatore non può caricare l'app se il server è spento."
    echo ""
    echo "👉 Prova a usare il nuovo comando combinato:"
    echo "   npm run ios:dev"
    echo ""
    echo "Oppure avvia il server in un altro terminale con:"
    echo "   npm run dev"
    echo "--------------------------------------------------------"
    # We continue anyway, maybe curl failed but server is up, or user just wants the simulator
fi

# 2. Open Simulator app
echo "📂 Opening Simulator app..."
open -a Simulator

# 2. Try to open the URL directly if a device is already booted
# This works if simctl is just being slow or if a device is already up
echo "🔗 Attempting to open $URL in a booted device..."
if xcrun simctl openurl booted "$URL" 2>/dev/null; then
    echo "✅ URL opened successfully in the booted simulator!"
    osascript -e 'tell application "Simulator" to activate'
    exit 0
fi

# 3. Find a device to boot if nothing was booted
echo "🔎 Looking for available devices..."
DEVICE_ID=$(xcrun simctl list devices available | grep "$SIMULATOR_NAME_PLUS" | head -n 1 | sed -E 's/.*\(([-A-Z0-9]+)\).*/\1/')

if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID=$(xcrun simctl list devices available | grep "$SIMULATOR_NAME" | head -n 1 | sed -E 's/.*\(([-A-Z0-9]+)\).*/\1/')
fi

if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID=$(xcrun simctl list devices available | grep "iPhone" | head -n 1 | sed -E 's/.*\(([-A-Z0-9]+)\).*/\1/')
fi

# 4. If we found a device, try to boot it
if [ -n "$DEVICE_ID" ]; then
    echo "📱 Found device ID: $DEVICE_ID. Booting..."
    xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
    
    echo "⏳ Waiting for simulator to initialize..."
    # Wait up to 10 seconds for it to accept the URL
    for i in {1..5}; do
        if xcrun simctl openurl "$DEVICE_ID" "$URL" 2>/dev/null; then
            echo "✅ App opened in simulator!"
            osascript -e 'tell application "Simulator" to activate'
            exit 0
        fi
        sleep 2
    done
fi

# 5. Fallback: Help the user if nothing worked
echo "--------------------------------------------------------"
echo "⚠️  Il simulatore è aperto ma i servizi di sistema sono KO."
echo "--------------------------------------------------------"
echo "Il comando 'simctl' non risponde correttamente. "
echo "Prova a resettare i servizi aprendo un nuovo terminale e incollando questo:"
echo ""
echo "sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && killall Simulator; killall com.apple.CoreSimulator.CoreSimulatorService"
echo ""
echo "Dopo averlo fatto, riprova con: npm run ios:dev"
echo ""
echo "Per ora, apri Safari nel simulatore e digita manualmente:"
echo "👉 $URL"
echo "--------------------------------------------------------"
