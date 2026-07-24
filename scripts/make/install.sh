#!/usr/bin/env bash
# One-command dev environment setup for Darwin Lab. Idempotent: every step checks state first and
# skips what is already in place, so re-running is a fast no-op.
#
# This is a pure Node/SvelteKit static app — no Python, no Docker, no databases, no secrets. The
# whole environment is: a modern Node, npm dependencies, and Playwright's browsers for e2e.

set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/make/lib/ui.sh

# Vite 7 requires Node 20.19+ / 22.12+; we gate on the major and let npm surface finer mismatches.
MIN_NODE_MAJOR=20
STATE_DIR=.run-state
TOTAL=4

usage() {
	cat <<'EOF'
Usage: scripts/make/install.sh [-h]

Installs the full dev environment: verifies Node/npm, installs npm dependencies (skipped when the
lockfile is unchanged), and downloads Playwright's browsers for e2e. Safe to re-run any time.
EOF
}
case "${1:-}" in -h | --help)
	usage
	exit 0
	;;
esac

ui::banner "setup"
mkdir -p "$STATE_DIR"

# ---- 1 · Node runtime (hard requirement) ----
ui::step 1 $TOTAL "Node runtime"
command -v node >/dev/null 2>&1 ||
	ui::die "Node is not installed." "brew install node   (or https://nodejs.org — v${MIN_NODE_MAJOR}+)"
NODE_V=$(node --version)
NODE_MAJOR=${NODE_V#v}
NODE_MAJOR=${NODE_MAJOR%%.*}
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
	ui::die "Node $NODE_V is too old (need v${MIN_NODE_MAJOR}+)." "brew upgrade node"
fi
ui::ok "node $NODE_V"
command -v npm >/dev/null 2>&1 || ui::die "npm is missing from this Node install." "brew reinstall node"
ui::ok "npm $(npm --version)"

# ---- 2 · npm dependencies (skip when the lockfile hasn't moved) ----
ui::step 2 $TOTAL "Project dependencies"
LOCK_SHA=$(shasum package-lock.json | cut -d' ' -f1)
if [ -d node_modules ] && [ "$(cat "$STATE_DIR/deps.sha" 2>/dev/null)" = "$LOCK_SHA" ]; then
	ui::skip "node_modules is current (lockfile unchanged)"
else
	ui::run "npm ci (clean install from the lockfile)" npm ci
	printf '%s' "$LOCK_SHA" >"$STATE_DIR/deps.sha"
fi

# ---- 3 · Playwright browsers (soft: only e2e needs them) ----
ui::step 3 $TOTAL "Playwright browsers"
if ui::run "playwright install (skips browsers already present)" npx playwright install; then
	:
else
	ui::warn "browsers not installed — 'make test-e2e' will not run until this succeeds"
fi

# ---- 4 · Summary ----
ui::step 4 $TOTAL "Environment ready"
ui::summary_head "Setup summary"
ui::summary_row "node" "$NODE_V" ok
ui::summary_row "npm" "v$(npm --version)" ok
ui::summary_row "dependencies" "$(ls node_modules 2>/dev/null | wc -l | tr -d ' ') packages" ok
ui::summary_row "e2e browsers" "playwright" ok
printf '\n%sNext:%s make run\n\n' "$UI_BOLD" "$UI_RESET"
