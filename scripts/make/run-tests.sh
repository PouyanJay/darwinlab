#!/usr/bin/env bash
# Run Darwin Lab's test suites — any of them, or all of them — and NEVER stop at the first red:
# every selected suite runs, the results are aggregated, and the exit code is the OR of them all,
# so a developer sees every failure in one pass and CI still fails properly.
#
#   --all        unit + e2e (default)
#   --unit       Vitest only
#   --e2e        Playwright only
#   -h, --help   this guide
#
# Suites stream their output live (a spinner hiding minutes of Playwright progress helps nobody).

set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/make/lib/ui.sh

usage() {
	sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
}

RUN_UNIT=0
RUN_E2E=0
case "${1:---all}" in
	--all)
		RUN_UNIT=1
		RUN_E2E=1
		;;
	--unit) RUN_UNIT=1 ;;
	--e2e) RUN_E2E=1 ;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		usage
		ui::die "unknown flag: $1" "scripts/make/run-tests.sh --help"
		;;
esac

TOTAL=$((RUN_UNIT + RUN_E2E))
STEP=0
UNIT_CODE=-1
E2E_CODE=-1

ui::banner "tests"
[ -d node_modules ] || ui::die "dependencies are not installed." "make setup"

if [ "$RUN_UNIT" = 1 ]; then
	STEP=$((STEP + 1))
	ui::step $STEP $TOTAL "Unit tests (Vitest)"
	set +e
	npm run test:unit -- --run
	UNIT_CODE=$?
	set -e
fi

if [ "$RUN_E2E" = 1 ]; then
	STEP=$((STEP + 1))
	ui::step $STEP $TOTAL "End-to-end tests (Playwright)"
	# A stale preview on 4173 serves an OLD build to a green-looking suite — it has happened here.
	# Kill anything holding the port before Playwright boots its own fresh server.
	if lsof -ti tcp:4173 >/dev/null 2>&1; then
		ui::warn "killing a stale server on :4173 (it would serve an old build to the suite)"
		lsof -ti tcp:4173 | xargs kill -9 2>/dev/null || true
	fi
	set +e
	npx playwright test
	E2E_CODE=$?
	set -e
fi

# ---- aggregate: every suite reports, the exit code ORs them together ----
AGGREGATE=0
ui::summary_head "Test summary"
if [ "$UNIT_CODE" != -1 ]; then
	if [ "$UNIT_CODE" = 0 ]; then ui::summary_row "unit" "passed" ok; else
		ui::summary_row "unit" "FAILED (exit $UNIT_CODE)" fail
		AGGREGATE=1
	fi
fi
if [ "$E2E_CODE" != -1 ]; then
	if [ "$E2E_CODE" = 0 ]; then ui::summary_row "e2e" "passed" ok; else
		ui::summary_row "e2e" "FAILED (exit $E2E_CODE)" fail
		AGGREGATE=1
	fi
fi
printf '\n'
exit "$AGGREGATE"
