#!/usr/bin/env bash
# scripts/build-ios.sh — one-command iOS build on a Mac.
# Produces a signed .ipa ready for TestFlight (blueprint §30 Phase 0 deliverable).
#
# Prerequisites (Mac only):
#   - Xcode 15+ (App Store)
#   - CocoaPods:  sudo gem install cocoapods
#   - Node 20+
#   - An Apple Developer account + a Distribution certificate + provisioning profile
#
# Usage:
#   ./scripts/build-ios.sh           # unsigned archive (verifies it compiles)
#   ./scripts/build-ios.sh --sign    # signed .ipa for TestFlight (needs signing set up)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SIGN="${1:-}"

echo "==> Installing JS dependencies..."
npm install

echo "==> Syncing web assets into native iOS project..."
npx cap sync ios

echo "==> Validating native iOS project..."
node test/validate-ios.cjs

if [ "$SIGN" = "--sign" ]; then
  echo "==> Building SIGNED archive + .ipa..."
  xcodebuild -workspace ios/App/App.xcworkspace \
    -scheme App -configuration Release \
    -archivePath build/App.xcarchive \
    -destination 'generic/platform=iOS' \
    archive | xcpretty

  echo "==> Exporting signed .ipa (ensure build/ExportOptions.plist exists)..."
  if [ ! -f build/ExportOptions.plist ]; then
    echo "ERROR: build/ExportOptions.plist not found. Create it with your teamID + bundleID."
    echo "  See: https://developer.apple.com/library/archive/featuredarticles/XcodeConcepts/Concept-ExportOptions.html"
    exit 1
  fi
  xcodebuild -exportArchive \
    -archivePath build/App.xcarchive \
    -exportOptionsPlist build/ExportOptions.plist \
    -exportPath build/ipa | xcpretty

  IPA=$(ls build/ipa/*.ipa 2>/dev/null | head -1)
  echo ""
  echo "✅ Signed .ipa ready: $IPA"
  echo "   Upload to TestFlight via:"
  echo "     xcrun altool --upload-app --type ios -f \"$IPA\" --apiKey <KEY> --apiIssuer <ISSUER>"
  echo "   Or: open Xcode → Organizer → Distribute App → TestFlight"
else
  echo "==> Building UNSIGNED archive (verifies compilation)..."
  xcodebuild -workspace ios/App/App.xcworkspace \
    -scheme App -configuration Release \
    -archivePath build/App.xcarchive \
    -destination 'generic/platform=iOS' \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO | xcpretty
  echo ""
  echo "✅ Unsigned archive built: build/App.xcarchive"
  echo "   This proves the project compiles. Re-run with --sign to produce a TestFlight .ipa."
fi
