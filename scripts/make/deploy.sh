#!/usr/bin/env bash
# Publish Darwin Lab to GitHub Pages — on demand, never automatically. Merging to main only proves
# main is healthy (CI runs verify + e2e, nothing ships); THIS is the only thing that goes live.
#
# It publishes origin/main, not your working tree: the deploy runs in CI, which re-does the whole
# bar fresh (verify + e2e) and ships the exact bytes it just tested. Before triggering it shows the
# gap — what is live now vs what main is about to become — so you are never guessing what ships.
#
#   make deploy              publish, after showing the gap and asking to confirm
#   scripts/make/deploy.sh --yes   skip the confirmation (for automation)
#   scripts/make/deploy.sh -h      this guide

set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/make/lib/ui.sh

WORKFLOW=ci.yml
BRANCH=main
YES=0

usage() { sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
	case "$arg" in
		-y | --yes) YES=1 ;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			usage
			ui::die "unknown flag: $arg" "scripts/make/deploy.sh --help"
			;;
	esac
done

ui::banner "deploy"

# ---- 1 · prerequisites ----
ui::step 1 5 "Checking the toolchain"
command -v gh >/dev/null 2>&1 || ui::die "the GitHub CLI (gh) is not installed." "brew install gh"
gh auth status >/dev/null 2>&1 || ui::die "gh is not authenticated." "gh auth login"
SLUG=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
SITE_URL=$(gh api "repos/$SLUG/pages" --jq .html_url 2>/dev/null || true)
[ -n "$SITE_URL" ] || ui::die "GitHub Pages is not enabled for $SLUG." "gh api -X POST repos/$SLUG/pages -f source[branch]=main"
ui::ok "$SLUG → $SITE_URL"

# ---- 2 · what is about to ship ----
ui::step 2 5 "Working out what will ship"
git fetch --quiet origin "$BRANCH"
TARGET=$(git rev-parse "origin/$BRANCH")
ui::ok "publishing origin/$BRANCH @ $(git rev-parse --short "origin/$BRANCH")"

# Unpushed local commits would NOT ship — the deploy takes origin/main, not your tree.
if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
	AHEAD=$(git rev-list --count "origin/$BRANCH..$BRANCH" 2>/dev/null || echo 0)
	[ "$AHEAD" -gt 0 ] && ui::warn "your local $BRANCH is $AHEAD commit(s) ahead of origin — those will NOT ship (push them first)"
fi

# The gap: the SHA Pages last shipped, and every commit between it and what we're about to ship.
LAST=$(gh api "repos/$SLUG/deployments?environment=github-pages&per_page=1" --jq '.[0].sha // empty' 2>/dev/null || true)
if [ -z "$LAST" ]; then
	ui::info "no previous Pages deploy on record — this is the first"
elif [ "$LAST" = "$TARGET" ]; then
	ui::warn "origin/$BRANCH is already live — nothing new to publish (re-deploying anyway is fine)"
else
	COUNT=$(git rev-list --count "$LAST..$TARGET" 2>/dev/null || echo '?')
	ui::info "$COUNT commit(s) since the live build ($(git rev-parse --short "$LAST" 2>/dev/null || echo "$LAST")):"
	git --no-pager log --oneline "$LAST..$TARGET" 2>/dev/null | sed 's/^/      /' || ui::info "  (live SHA not in local history — fetch to see the list)"
fi

# ---- 3 · confirm ----
if [ "$YES" = 0 ]; then
	[ -t 0 ] || ui::die "refusing to deploy unconfirmed in a non-interactive shell." "scripts/make/deploy.sh --yes"
	printf '\n  %sPublish this to %s? [y/N] %s' "$UI_BOLD" "$SITE_URL" "$UI_RESET"
	read -r reply
	case "$reply" in
		y | Y | yes | YES) ;;
		*)
			ui::warn "aborted — nothing deployed"
			exit 0
			;;
	esac
fi

# The live build stamp, captured BEFORE we trigger — every build rewrites version.json, so once the
# live value moves off this one we know the new bytes are actually being served, not just deployed.
BEFORE_VER=$(curl -fsS "${SITE_URL%/}/_app/version.json" 2>/dev/null || echo "none")

# ---- 4 · trigger and watch ----
ui::step 3 5 "Triggering the deploy pipeline"
# Capture the newest prior dispatch run so we can wait for OURS specifically, not an older one.
PREV_RUN=$(gh run list --workflow "$WORKFLOW" --event workflow_dispatch --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)
gh workflow run "$WORKFLOW" --ref "$BRANCH"

ui::step 4 5 "Waiting for the run to register"
RUN_ID=""
_tries=0
while [ -z "$RUN_ID" ] || [ "$RUN_ID" = "$PREV_RUN" ]; do
	sleep 2
	RUN_ID=$(gh run list --workflow "$WORKFLOW" --event workflow_dispatch --branch "$BRANCH" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)
	_tries=$((_tries + 1))
	[ "$_tries" -ge 30 ] && ui::die "the dispatched run never appeared." "check: gh run list --workflow $WORKFLOW"
done
RUN_URL=$(gh run view "$RUN_ID" --json url --jq .url 2>/dev/null || true)
ui::ok "run $RUN_ID — verify + e2e + deploy"
[ -n "$RUN_URL" ] && ui::info "watch live: $RUN_URL"

ui::step 5 5 "Running the pipeline (verify · e2e · deploy) — a few minutes"
if gh run watch "$RUN_ID" --exit-status >/dev/null 2>&1; then
	ui::ok "pipeline green"
else
	ui::fail "the deploy run failed — nothing was published"
	ui::info "logs: gh run view $RUN_ID --log-failed"
	exit 1
fi

# ---- confirm the site actually updated (Pages can lag the run by a few seconds) ----
ui::info "confirming the live site picked up the new build…"
_waited=0
while [ "$_waited" -lt 90 ]; do
	NOW_VER=$(curl -fsS "${SITE_URL%/}/_app/version.json" 2>/dev/null || echo "none")
	if [ "$NOW_VER" != "$BEFORE_VER" ] && [ "$NOW_VER" != "none" ]; then
		ui::summary_head "Deployed"
		ui::summary_row "url" "$SITE_URL" ok
		ui::summary_row "shipped" "$(git rev-parse --short "$TARGET")" ok
		ui::summary_row "run" "$RUN_ID" ok
		printf '\n'
		exit 0
	fi
	sleep 5
	_waited=$((_waited + 5))
done
ui::warn "run is green but the live build stamp hasn't changed yet — Pages CDN can lag; check $SITE_URL shortly"
