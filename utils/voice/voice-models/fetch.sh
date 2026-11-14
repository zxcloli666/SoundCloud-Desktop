#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
base=${VOICE_STORAGE:-https://storage.r1.relay.scnative.dev/voice-models}
out=$1
shift
pace=${VOICE_FETCH_RATE:+--limit-rate $VOICE_FETCH_RATE}

for id in "$@"; do
    files=$(jq -r --arg id "$id" '.models[] | select(.id == $id) | .version as $version | .files[]
        | [$version, .path, .sha256, (.executable // false)] | @tsv' "$here/manifest.json" | tr -d '\r')
    if [ -z "$files" ]; then
        echo "$id is not in the manifest" >&2
        exit 1
    fi
    mkdir -p "$out/$id"
    echo "$files" | while IFS="$(printf '\t')" read -r version path sha256 executable; do
        curl -fsSL $pace --retry 8 --retry-all-errors --retry-max-time 1200 -o "$out/$id/$path" "$base/$id/$version/$path"
        got=$(openssl dgst -sha256 -r "$out/$id/$path" | cut -d' ' -f1)
        if [ "$got" != "$sha256" ]; then
            echo "$id/$path: sha256 $got, expected $sha256" >&2
            exit 1
        fi
        if [ "$executable" = true ]; then
            chmod +x "$out/$id/$path"
        fi
    done
done
