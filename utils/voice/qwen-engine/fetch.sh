#!/bin/sh
set -eu

commit=de2ad833e9bd5c06082231d1da637789f7562816
src=$1

if [ ! -d "$src/.git" ]; then
    git init -q "$src"
    git -C "$src" config core.autocrlf false
    git -C "$src" remote add origin https://github.com/ServeurpersoCom/qwentts.cpp
fi
if [ "$(git -C "$src" rev-parse -q --verify HEAD || true)" != "$commit" ]; then
    git -C "$src" fetch -q --depth 1 origin "$commit"
    git -C "$src" checkout -q FETCH_HEAD
    git -C "$src" submodule update -q --init --depth 1
fi
