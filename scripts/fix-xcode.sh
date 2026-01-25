#!/bin/bash

echo "🛠️  Avvio della riparazione automatica dell'ambiente Xcode/Simulator..."

# 1. Kill existing processes to start fresh
echo "🧹 Chiusura processi esistenti..."
killall Simulator 2>/dev/null
killall com.apple.CoreSimulator.CoreSimulatorService 2>/dev/null
sleep 2

# 2. Reset Xcode path
echo "📍 Reimpostazione del path di Xcode..."
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# 3. Register the SimDeviceType
echo "📱 Registrazione dei dispositivi nel database di sistema..."
xcrun simctl list devices > /dev/null

# 4. Final check
echo "--------------------------------------------------------"
NUM_DEVICES=$(xcrun simctl list devices available | grep -c "(")
if [ "$NUM_DEVICES" -gt 0 ]; then
    echo "✅ Successo! Registro $NUM_DEVICES dispositivi disponibili."
else
    echo "⚠️  Attenzione: simctl non vede ancora dispositivi disponibili."
    echo "Questo di solito significa che i runtime iOS non sono installati in Xcode."
    echo "Prova a lanciare: xcodebuild -downloadPlatform iOS"
fi
echo "--------------------------------------------------------"

echo "✨ Ora puoi riprovare con: npm run expo"
