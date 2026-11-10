#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
commit=de2ad833e9bd5c06082231d1da637789f7562816
src=${QWENTTS_SRC:-$here/build/qwentts.cpp}
build=${QWEN_BUILD:-$here/build/cmake}
out=$1
shift

if [ ! -d "$src/.git" ]; then
    git init -q "$src"
    git -C "$src" remote add origin https://github.com/ServeurpersoCom/qwentts.cpp
fi
if [ "$(git -C "$src" rev-parse -q --verify HEAD || true)" != "$commit" ]; then
    git -C "$src" fetch -q --depth 1 origin "$commit"
    git -C "$src" checkout -q FETCH_HEAD
    git -C "$src" submodule update -q --init --depth 1
fi

cmake -S "$src" -B "$build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=OFF \
    -DCMAKE_BUILD_RPATH_USE_ORIGIN=ON \
    "-DCMAKE_PROJECT_qwentts-ggml_INCLUDE=$here/scd-qwen.cmake" \
    "-DSCD_QWEN_MAIN=$here/main.cpp" \
    "$@"
cmake --build "$build" --config Release --parallel

bin=$build
if [ -d "$build/Release" ]; then
    bin=$build/Release
fi
mkdir -p "$out"
for file in "$bin"/scd-qwen "$bin"/scd-qwen.exe "$bin"/*.dll "$bin"/libggml*.so.0 "$bin"/libggml*.so; do
    if [ -f "$file" ] && { [ ! -L "$file" ] || [ "${file%.so.0}" != "$file" ]; }; then
        cp -L "$file" "$out/"
    fi
done
ls -l "$out"
