#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

stamp=.ci/sha
old=200001010000

case ${1:-} in
  restore)
    if [ ! -f "$stamp" ]; then
      echo "no stamp, every file stays new"
      exit 0
    fi
    sha=$(cat "$stamp")
    if ! git cat-file -e "$sha^{commit}" 2>/dev/null && ! git fetch --no-tags --depth=1 origin "$sha"; then
      echo "cannot fetch $sha, every file stays new"
      exit 0
    fi
    git ls-files -z | xargs -0 touch -h -t "$old"
    git diff --name-only --diff-filter=d -z "$sha" HEAD | xargs -0 -r touch -h
    echo "cache built at ${sha:0:12}, $(git diff --name-only "$sha" HEAD | wc -l | tr -d ' ') files changed since"
    ;;
  stamp)
    if [ "${2:-}" = success ]; then
      mkdir -p .ci
      git rev-parse HEAD > "$stamp"
    else
      rm -f "$stamp"
    fi
    ;;
  *)
    echo "usage: ci-mtime.sh restore | stamp <build outcome>" >&2
    exit 2
    ;;
esac
