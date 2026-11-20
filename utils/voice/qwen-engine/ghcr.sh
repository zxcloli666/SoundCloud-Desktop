#!/bin/sh
set -eu

owner=$(printf '%s' "$GITHUB_REPOSITORY_OWNER" | tr '[:upper:]' '[:lower:]')
ref=ghcr.io/$owner/cache/desktop-ci:$2
pack=$(printf '%s' "$RUNNER_TEMP" | tr '\\' /)/$2
dir=$3
mkdir -p "$pack"

if [ "$1" = pull ]; then
    if ! oras pull "$ref" --output "$pack" > /dev/null 2>&1; then
        echo "miss $ref"
        exit 1
    fi
    mkdir -p "$dir"
    if ! zstd -dcq "$pack/files.tar.zst" | tar -xf - -C "$dir"; then
        rm -rf "$dir"
        exit 1
    fi
    echo "hit $ref"
    exit 0
fi

tar -cf - -C "$dir" . | zstd -T0 -3 -q -f -o "$pack/files.tar.zst"
printf '%s' "$TOKEN" | oras login ghcr.io --username "$GITHUB_ACTOR" --password-stdin > /dev/null
cd "$pack"
oras push "$ref" files.tar.zst:application/zstd \
    --annotation "org.opencontainers.image.source=$GITHUB_SERVER_URL/$GITHUB_REPOSITORY" > /dev/null
echo "pushed $ref"
