#!/usr/bin/env bash
set -euo pipefail

zero=0000000000000000000000000000000000000000
all=false
frontend=false
rust=false
real=false

if [ "$EVENT_NAME" = pull_request ]; then
  files=$(git diff --name-only HEAD^1 HEAD) || all=true
elif [ "$BEFORE" != "$zero" ] && git fetch --no-tags --depth=1 origin "$BEFORE" 2>/dev/null; then
  files=$(git diff --name-only "$BEFORE" HEAD) || all=true
else
  files=
  all=true
fi

callers=$(git grep -l -E 'call_client|decrypt_client' -- desktop/src-tauri/src || true)

while IFS= read -r file; do
  case $file in
    .github/workflows/ci.yml | .github/scripts/changes.sh | scripts/ci-mtime.sh | scripts/ci-toolchain.sh | rust-toolchain.toml | .cargo/* | desktop/src-tauri/.cargo/*)
      all=true ;;
    desktop/src-tauri/Cargo.* | utils/*)
      rust=true
      real=true ;;
    desktop/src-tauri/*)
      rust=true
      if grep -qxF "$file" <<< "$callers"; then real=true; fi ;;
    desktop/*)
      frontend=true ;;
  esac
done <<< "$files"

if [ "$all" = true ]; then
  frontend=true
  rust=true
  real=true
fi

{
  echo "frontend=$frontend"
  echo "rust=$rust"
  echo "real=$real"
} | tee -a "${GITHUB_OUTPUT:-/dev/null}"
