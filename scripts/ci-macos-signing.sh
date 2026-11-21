#!/usr/bin/env bash
set -euo pipefail

keychain="$RUNNER_TEMP/signing.keychain-db"
p12="$RUNNER_TEMP/signing.p12"
password=$(openssl rand -hex 24)

printf '%s' "$MACOS_CERTIFICATE" | base64 --decode > "$p12"
security create-keychain -p "$password" "$keychain"
security set-keychain-settings -lut 21600 "$keychain"
security unlock-keychain -p "$password" "$keychain"
security import "$p12" -k "$keychain" -P "$MACOS_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
rm -f "$p12"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$password" "$keychain" > /dev/null
read -r -a others <<< "$(security list-keychains -d user | tr -d '"' | tr '\n' ' ')"
security list-keychains -d user -s "$keychain" "${others[@]}"

security find-identity -p codesigning "$keychain"
identity=$(security find-identity -p codesigning "$keychain" | awk '/"SoundCloud Desktop"/ { print $2; exit }')
if [ -z "$identity" ]; then
  echo "no SoundCloud Desktop signing identity in MACOS_CERTIFICATE" >&2
  exit 1
fi
echo "APPLE_SIGNING_IDENTITY=$identity" >> "$GITHUB_ENV"
