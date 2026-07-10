#!/usr/bin/env bash
# scripts/setup-signing.sh — install signing cert + provisioning profile into a
# temporary keychain for CI builds. Called by .github/workflows/ios-build.yml.
# Blueprint §26: validate receipts / entitlements — signed builds only for TestFlight.
set -euo pipefail

# Create a temporary keychain
KEYCHAIN_PATH="$RUNNER_TEMP/app-signing.keychain-db"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

# Import the distribution certificate
CERT_PATH="$RUNNER_TEMP/build_certificate.p12"
echo "$BUILD_CERTIFICATE_BASE64" | base64 --decode > "$CERT_PATH"
security import "$CERT_PATH" -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security list-keychain -d user -s "$KEYCHAIN_PATH" login.keychain

# Install the provisioning profile
PP_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PP_DIR"
PP_PATH="$RUNNER_TEMP/build_profile.mobileprovision"
echo "$BUILD_PROVISION_PROFILE_BASE64" | base64 --decode > "$PP_PATH"
# Determine the profile UUID and copy it to the expected location
UUID=$(/usr/libexec/PlistBuddy -c "Print UUID" /dev/stdin \
  <<< "$(security cms -D -i "$PP_PATH")")
cp "$PP_PATH" "$PP_DIR/$UUID.mobileprovision"

echo "✓ Signing certificate and provisioning profile installed (UUID: $UUID)"
