#!/usr/bin/env bash
# The `make help` screen — the command reference a developer sees on a bare `make`.

set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/make/lib/ui.sh

row() { printf '    %s%-18s%s %s%s%s\n' "$UI_PRIMARY" "$1" "$UI_RESET" "$UI_DIM" "$2" "$UI_RESET"; }
head_() { printf '\n  %s%s%s\n' "$UI_BOLD" "$1" "$UI_RESET"; }

printf '\n  %sDarwin Lab%s %s— a browser lab for neuroevolution%s\n' "$UI_BOLD" "$UI_RESET" "$UI_DIM" "$UI_RESET"

head_ "Setup & Run"
row "make run" "Everything, end to end: setup + start the dev server"
row "make setup" "Install the dev environment (idempotent, safe to re-run)"
row "make start" "Start the dev server (auto-allocates a free port)"
row "make preview" "Build, then serve the production build"
row "make stop" "Tear down anything make started"
row "make logs" "Follow the running server's log"

head_ "Testing"
row "make test" "All suites — unit + e2e — never stopping at the first red"
row "make test-unit" "Vitest only"
row "make test-e2e" "Playwright only (clears stale :4173 servers first)"

head_ "Code quality"
row "make lint" "prettier + eslint + svelte-check, aggregated"
row "make lint-fix" "Auto-fix what can be fixed, then re-check everything"

printf '\n'
