#!/usr/bin/env bash
set -euo pipefail

repo="$1"
site="$2"
branch=master
title="SoundCloud Desktop"
runtime_repo=https://dl.flathub.org/repo/flathub.flatpakrepo
bundle=soundcloud-desktop.flatpak

if [ -z "${GPG_FPR:-}" ]; then
  flatpak build-bundle "$repo" "$bundle" "$FLATPAK_APP_ID" "$branch" --runtime-repo="$runtime_repo"
  echo "repo=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

repo_url="${FLATPAK_SITE_URL%/}/repo/"
keyring="$(mktemp)"
gpg --export "$GPG_FPR" > "$keyring"
gpg_key="$(base64 -w0 "$keyring")"

flatpak build-update-repo \
  --gpg-sign="$GPG_FPR" \
  --title="$title" \
  --default-branch="$branch" \
  --prune \
  "$repo"

flatpak build-bundle "$repo" "$bundle" "$FLATPAK_APP_ID" "$branch" \
  --runtime-repo="$runtime_repo" \
  --repo-url="$repo_url" \
  --gpg-keys="$keyring" \
  --gpg-sign="$GPG_FPR"

rm -rf "$site"
mkdir -p "$site"
cp -r "$repo" "$site/repo"
rm -rf "$site/repo/tmp" "$site/repo/.lock"

cat > "$site/soundcloud-desktop.flatpakrepo" <<REPO
[Flatpak Repo]
Title=$title
Url=$repo_url
Homepage=https://soundcloud-desktop.fun/
Comment=SoundCloud Desktop updates
DefaultBranch=$branch
GPGKey=$gpg_key
REPO

cat > "$site/soundcloud-desktop.flatpakref" <<REF
[Flatpak Ref]
Name=$FLATPAK_APP_ID
Branch=$branch
Title=$title
Url=$repo_url
Homepage=https://soundcloud-desktop.fun/
RuntimeRepo=$runtime_repo
SuggestRemoteName=soundcloud-desktop
IsRuntime=false
GPGKey=$gpg_key
REF

rm -f "$keyring"
echo "repo=true" >> "$GITHUB_OUTPUT"
