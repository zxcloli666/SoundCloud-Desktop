#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

pinned=$(sed -n 's/^channel *= *"\(.*\)"/\1/p' rust-toolchain.toml)

rustup toolchain install
{ rustup toolchain list --quiet | grep -v "^$pinned-" || true; } | xargs -n1 -r rustup toolchain uninstall
