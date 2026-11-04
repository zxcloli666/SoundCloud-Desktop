set -e
if [ -z "$1" ]; then
  echo "usage: sh rebuild.sh <dir with the cached ru-stress.tsv, ru-yo.tsv, ru-suffix.tsv, en-us.tsv>" >&2
  exit 2
fi
here=$(cd "$(dirname "$0")" && pwd)
cached=$(cd "$1" && pwd)
voice=$(cd "$here/../.." && pwd)
work=$(mktemp -d "${TMPDIR:-/tmp}/g2p-rebuild.XXXXXX")
trap 'rm -rf "$work"' EXIT
python3 "$here/rebuild_cached.py" "$cached" "$work"
CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-$work/target} \
  cargo run --release --manifest-path "$voice/Cargo.toml" -p voice-g2p --example pack -- "$work" "$here/../data"
