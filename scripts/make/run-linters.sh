#!/usr/bin/env bash
# Run Darwin Lab's code-quality gates — the formatter+linter pass and the svelte-check typecheck —
# without stopping at the first red: both run, results aggregate, the exit code ORs them together.
#
#   --all        prettier + eslint, then svelte-check (default)
#   --fix        auto-fix first (prettier --write + eslint --fix), then re-check everything
#   -h, --help   this guide
#
# Check mode failing prints the exact fix: make lint-fix.

set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/make/lib/ui.sh

usage() {
	sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
}

FIX=0
for arg in "$@"; do
	case "$arg" in
		--all) ;;
		--fix) FIX=1 ;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			usage
			ui::die "unknown flag: $arg" "scripts/make/run-linters.sh --help"
			;;
	esac
done

ui::banner "lint"
[ -d node_modules ] || ui::die "dependencies are not installed." "make setup"

TOTAL=2
[ "$FIX" = 1 ] && TOTAL=3
STEP=0

if [ "$FIX" = 1 ]; then
	STEP=$((STEP + 1))
	ui::step $STEP $TOTAL "Auto-fixing (prettier --write, eslint --fix)"
	set +e
	npm run format
	FMT_CODE=$?
	set -e
	[ "$FMT_CODE" = 0 ] && ui::ok "fixes applied" || ui::warn "some fixes could not be applied (exit $FMT_CODE)"
fi

STEP=$((STEP + 1))
ui::step $STEP $TOTAL "Format + lint (prettier --check, eslint)"
set +e
npm run lint
LINT_CODE=$?
set -e

STEP=$((STEP + 1))
ui::step $STEP $TOTAL "Typecheck (svelte-check)"
set +e
npm run check
CHECK_CODE=$?
set -e

AGGREGATE=0
ui::summary_head "Lint summary"
if [ "$LINT_CODE" = 0 ]; then ui::summary_row "format + lint" "clean" ok; else
	ui::summary_row "format + lint" "FAILED (exit $LINT_CODE)" fail
	AGGREGATE=1
fi
if [ "$CHECK_CODE" = 0 ]; then ui::summary_row "typecheck" "clean" ok; else
	ui::summary_row "typecheck" "FAILED (exit $CHECK_CODE)" fail
	AGGREGATE=1
fi
if [ "$AGGREGATE" != 0 ] && [ "$FIX" = 0 ]; then
	printf '  %sTry:%s make lint-fix\n' "$UI_BOLD" "$UI_RESET"
fi
printf '\n'
exit "$AGGREGATE"
