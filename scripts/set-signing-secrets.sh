#!/usr/bin/env bash
# scripts/set-signing-secrets.sh — set up GitHub secrets for signed TestFlight builds.
#
# Prerequisites (one-time, from your Apple Developer account at developer.apple.com):
#   1. A paid Apple Developer Program membership ($99/year).
#   2. An App ID registered for bundle id "studio.tumble.pullpop" (or change capacitor.config.json
#      + this script's BUNDLE_ID to your own registered App ID).
#   3. A Distribution Certificate (iOS Distribution) — export it as a .p12 with a password.
#   4. A Provisioning Profile of type "App Store" bound to that certificate + App ID.
#   5. (Optional) an App Store Connect API key for auto-upload to TestFlight.
#
# This script reads your local files and pushes them as GitHub Actions secrets,
# so the next `git push` produces a SIGNED, TestFlight-ready .ipa.
#
# Usage:
#   gh auth login   # ensure gh is authenticated to your repo
#   ./scripts/set-signing-secrets.sh
set -euo pipefail

BUNDLE_ID="studio.tumble.pullpop"
REPO="${GH_REPO:-CloseBUG/pullpop-pocket-beasts}"

echo "PULLPOP — TestFlight signing setup"
echo "Repo: $REPO  | Bundle ID: $BUNDLE_ID"
echo ""

# 1. Distribution certificate (.p12)
read -rp "Path to your iOS Distribution .p12 file: " P12_PATH
[ -f "$P12_PATH" ] || { echo "ERROR: $P12_PATH not found"; exit 1; }
read -rsp "Password for the .p12: " P12_PW; echo

# 2. Provisioning profile (.mobileprovision)
read -rp "Path to your App Store provisioning profile (.mobileprovision): " PP_PATH
[ -f "$PP_PATH" ] || { echo "ERROR: $PP_PATH not found"; exit 1; }

# 3. Team ID
read -rp "Your Apple Developer Team ID (e.g. ABCD123XYZ): " TEAM_ID
# Derive the provisioning profile UUID (needs macOS security tool; on other OSes, ask)
PP_UUID=""
if command -v security >/dev/null 2>&1; then
  PP_UUID=$(security cms -D -i "$PP_PATH" 2>/dev/null | /usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin 2>/dev/null || true)
fi
if [ -z "$PP_UUID" ]; then
  echo "(Could not auto-read UUID on this OS.)"
  read -rp "Paste the provisioning profile UUID: " PP_UUID
fi
echo "Using provisioning profile UUID: $PP_UUID"

# 4. Build ExportOptions.plist
TMP="$(mktemp -d)"
EXPORT_PLIST="$TMP/ExportOptions.plist"
cat > "$EXPORT_PLIST" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key><string>app-store</string>
	<key>teamID</key><string>${TEAM_ID}</string>
	<key>uploadBitcode</key><false/>
	<key>uploadSymbols</key><true/>
	<key>signingStyle</key><string>manual</string>
	<key>stripSwiftSymbols</key><true/>
	<key>provisioningProfiles</key>
	<dict>
		<key>${BUNDLE_ID}</key>
		<dict><key>identifier</key><string>${PP_UUID}</string></dict>
	</dict>
</dict>
</plist>
XML

# 5. Generate a random keychain password
KEYCHAIN_PW="$(openssl rand -base64 24)"

echo ""
echo "Setting GitHub Actions secrets on $REPO..."
# base64-encode binary/secret files and push as secrets
base64 -i "$P12_PATH" | gh secret set BUILD_CERTIFICATE_BASE64 --repo "$REPO"
printf '%s' "$P12_PW" | gh secret set P12_PASSWORD --repo "$REPO"
base64 -i "$PP_PATH" | gh secret set BUILD_PROVISION_PROFILE_BASE64 --repo "$REPO"
printf '%s' "$KEYCHAIN_PW" | gh secret set KEYCHAIN_PASSWORD --repo "$REPO"
base64 -i "$EXPORT_PLIST" | gh secret set EXPORT_OPTIONS_PLIST --repo "$REPO"

echo ""
echo "✓ All signing secrets set."
echo "  Next: git push  →  the iOS Build workflow will produce a SIGNED .ipa ready for TestFlight."
echo "  (Add ASC_KEY_ID + ASC_ISSUER_ID + APP_STORE_CONNECT_API_KEY secrets for auto TestFlight upload.)"
