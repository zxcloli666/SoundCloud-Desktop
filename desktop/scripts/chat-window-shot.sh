#!/bin/bash
set -euo pipefail

OWNER="${CHAT_SHOT_OWNER:-soundcloud-desktop}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="$ROOT/public/chat-lab-remote.json"

usage() {
  cat <<USAGE
usage:
  chat-window-shot.sh id                          print the window id of the running app
  chat-window-shot.sh shot <out.png>              capture the app window
  chat-window-shot.sh scene <id> [scheme] [perf] [lang] [motion]
                                                  switch the lab in the running window
  chat-window-shot.sh take <scene> <scheme> <out.png> [perf]
                                                  switch scene, wait, capture
  chat-window-shot.sh clean                       remove the remote file

the app must run as: VITE_CHAT_LAB=1 pnpm tauri dev --features chat-lab
env: CHAT_SHOT_OWNER (default soundcloud-desktop), CHAT_SHOT_WAIT (seconds after a switch, default 5)
USAGE
}

window_id() {
  local src
  src=$(mktemp "${TMPDIR:-/tmp}/chat-window.XXXXXX")
  mv "$src" "$src.swift"
  cat >"$src.swift" <<'SWIFT'
import CoreGraphics
import Foundation
let owner = CommandLine.arguments[1]
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []
var best: (Int, Double) = (0, 0)
for w in list where (w[kCGWindowOwnerName as String] as? String) == owner {
  let b = w[kCGWindowBounds as String] as? [String: Double] ?? [:]
  let area = (b["Width"] ?? 0) * (b["Height"] ?? 0)
  if (w[kCGWindowLayer as String] as? Int) == 0 && area > best.1 {
    best = (w[kCGWindowNumber as String] as? Int ?? 0, area)
  }
}
if best.0 == 0 { exit(1) }
print(best.0)
SWIFT
  local code=0
  swift "$src.swift" "$OWNER" 2>/dev/null || code=$?
  rm -f "$src.swift"
  return $code
}

switch_scene() {
  mkdir -p "$ROOT/public"
  local seq
  seq=$(date +%s)
  printf '{"seq":%s,"scene":"%s","scheme":"%s","perf":"%s","lang":"%s","motion":%s}\n' \
    "$seq" "$1" "${2:-dark}" "${3:-beauty}" "${4:-ru}" "$([ -n "${5:-}" ] && echo '"reduce"' || echo null)" >"$REMOTE"
}

capture() {
  local id
  id=$(window_id) || { echo "no window of $OWNER found" >&2; exit 1; }
  screencapture -o -l "$id" "$1"
  echo "$1"
}

case "${1:-}" in
  id) window_id ;;
  shot) capture "${2:?out file}" ;;
  scene) switch_scene "${2:?scene id}" "${3:-}" "${4:-}" "${5:-}" "${6:-}" ;;
  take)
    switch_scene "${2:?scene}" "${3:?scheme}" "${5:-beauty}"
    sleep "${CHAT_SHOT_WAIT:-5}"
    capture "${4:?out file}"
    ;;
  clean) rm -f "$REMOTE" ;;
  *) usage; exit 1 ;;
esac
