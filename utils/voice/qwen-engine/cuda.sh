#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
src=${QWENTTS_SRC:-$here/build/qwentts.cpp}
build=${QWEN_CUDA_BUILD:-$here/build/cuda}
out=$1

"$here/fetch.sh" "$src"

cmake -S "$src" -B "$build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=OFF \
    -DCMAKE_BUILD_RPATH_USE_ORIGIN=ON \
    -DGGML_BACKEND_DL=ON \
    -DGGML_OPENMP=OFF \
    -DGGML_CUDA=ON \
    -DCMAKE_CUDA_ARCHITECTURES=86
cmake --build "$build" --target ggml-cuda --parallel "$(getconf _NPROCESSORS_ONLN)"

mkdir -p "$out"
cp "$build/libggml-cuda.so" "$out/"
ls -l "$out"

