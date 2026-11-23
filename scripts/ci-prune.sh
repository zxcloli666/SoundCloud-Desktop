#!/usr/bin/env bash
set -euo pipefail

target=$1
messages=$2
lock=$3

if [ ! -f .ci/restored ] || ! grep -oE -- '-[0-9a-f]{16}' "$messages" > .ci/used; then
  echo "no build messages, nothing pruned"
  exit 0
fi

before=$(du -sk "$target" | cut -f1)

for profile in "$target"/*/.fingerprint "$target"/*/*/.fingerprint; do
  [ -d "$profile" ] || continue
  profile=${profile%/.fingerprint}
  for dir in .fingerprint build deps; do
    [ -d "$profile/$dir" ] || continue
    { find "$profile/$dir" -mindepth 1 -maxdepth 1 ! -newer .ci/restored |
      grep -E -- '-[0-9a-f]{16}(\.[^/]*)?$' | grep -vFf .ci/used || true; } |
      tr '\n' '\0' | xargs -0 rm -rf
  done
  if [ -d "$profile/incremental" ] && [ "$(cat .ci/lock 2> /dev/null)" != "$lock" ]; then
    find "$profile/incremental" -mindepth 1 -maxdepth 1 ! -newer .ci/restored -exec rm -rf {} +
  fi
done

rm .ci/used
printf '%s' "$lock" > .ci/lock
echo "pruned $((before / 1024)) MB to $(($(du -sk "$target" | cut -f1) / 1024)) MB"
