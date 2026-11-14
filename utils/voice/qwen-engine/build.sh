#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=${QWENTTS_SRC:-$here/build/qwentts.cpp}
build=${QWEN_BUILD:-$here/build/cmake}
out=$1
shift

"$here/fetch.sh" "$src"
if ! git -C "$src" apply --reverse --check "$here/threads.patch" 2>/dev/null; then
    git -C "$src" apply "$here/threads.patch"
fi

cmake -S "$src" -B "$build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=OFF \
    -DCMAKE_BUILD_RPATH_USE_ORIGIN=ON \
    "-DCMAKE_PROJECT_qwentts-ggml_INCLUDE=$here/scd-qwen.cmake" \
    "-DSCD_QWEN_MAIN=$here/main.cpp" \
    "$@"
cmake --build "$build" --config Release --parallel "$(getconf _NPROCESSORS_ONLN)"

bin=$build
if [ -f "$build/Release/scd-qwen.exe" ]; then
    bin=$build/Release
fi
mkdir -p "$out"
for file in "$bin"/scd-qwen "$bin"/scd-qwen.exe "$bin"/*.dll "$bin"/libggml*.so.0 "$bin"/libggml*.so; do
    if [ -f "$file" ] && { [ ! -L "$file" ] || [ "${file%.so.0}" != "$file" ]; }; then
        cp -L "$file" "$out/"
    fi
done
ls -l "$out"
