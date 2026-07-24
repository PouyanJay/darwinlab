#!/usr/bin/env bash
# Shared UI library for the make scripts — colours, icons, steps, spinner, command runner, summary.
#
# Targets bash 3.2 (macOS system bash): no associative arrays, no ${var^^}, no [[ =~ ]].
# Colour and spinner degrade automatically: NO_COLOR, TERM=dumb, or piped output disables ANSI;
# FORCE_COLOR overrides; non-UTF-8 locales fall back to ASCII icons. Source it, never execute it.

# ---------- TTY, colour and icon detection ----------

UI_TTY=0
[ -t 1 ] && UI_TTY=1

UI_COLOR=$UI_TTY
[ "${TERM:-}" = "dumb" ] && UI_COLOR=0
[ -n "${NO_COLOR:-}" ] && UI_COLOR=0
[ -n "${FORCE_COLOR:-}" ] && UI_COLOR=1

if [ "$UI_COLOR" = 1 ]; then
	UI_PRIMARY=$'\033[36m'
	UI_GREEN=$'\033[32m'
	UI_YELLOW=$'\033[33m'
	UI_RED=$'\033[31m'
	UI_DIM=$'\033[2m'
	UI_BOLD=$'\033[1m'
	UI_RESET=$'\033[0m'
else
	UI_PRIMARY='' UI_GREEN='' UI_YELLOW='' UI_RED='' UI_DIM='' UI_BOLD='' UI_RESET=''
fi

case "${LC_ALL:-}${LC_CTYPE:-}${LANG:-}" in
	*UTF-8* | *utf8*)
		UI_I_OK='✔' UI_I_FAIL='✖' UI_I_WARN='⚠' UI_I_INFO='ℹ' UI_I_SKIP='⊘' UI_I_STEP='▸'
		;;
	*)
		UI_I_OK='[ok]' UI_I_FAIL='[FAIL]' UI_I_WARN='[!]' UI_I_INFO='[i]' UI_I_SKIP='[-]' UI_I_STEP='>'
		;;
esac

# ---------- banner and steps ----------

# ui::banner "context string" — project name, context, timestamp; once at script start.
ui::banner() {
	printf '\n%sDarwin Lab%s %s· %s · %s%s\n\n' \
		"$UI_BOLD" "$UI_RESET" "$UI_DIM" "$1" "$(date '+%H:%M:%S')" "$UI_RESET"
}

# ui::step N TOTAL "description" — numbered progress header.
ui::step() {
	printf '%s%s %s/%s%s %s%s%s\n' "$UI_PRIMARY" "$UI_I_STEP" "$1" "$2" "$UI_RESET" "$UI_BOLD" "$3" "$UI_RESET"
}

ui::ok() { printf '  %s%s%s %s\n' "$UI_GREEN" "$UI_I_OK" "$UI_RESET" "$1"; }
ui::fail() { printf '  %s%s %s%s\n' "$UI_RED" "$UI_I_FAIL" "$1" "$UI_RESET"; }
ui::warn() { printf '  %s%s %s%s\n' "$UI_YELLOW" "$UI_I_WARN" "$1" "$UI_RESET"; }
ui::skip() { printf '  %s%s %s%s\n' "$UI_DIM" "$UI_I_SKIP" "$1" "$UI_RESET"; }
ui::info() { printf '  %s%s%s %s\n' "$UI_PRIMARY" "$UI_I_INFO" "$UI_RESET" "$1"; }

# ui::die "message" "remediation command" — hard failure with the exact fix, then exit 1.
ui::die() {
	ui::fail "$1"
	[ -n "${2:-}" ] && printf '    %sFix:%s %s\n' "$UI_BOLD" "$UI_RESET" "$2"
	exit 1
}

# ---------- command runner with spinner ----------

# ui::run "description" cmd [args…] — run quietly with a spinner; ✔ on success, on failure dump
# the captured output and return the command's exit code. For long LIVE output (test suites),
# don't use this — stream directly under a ui::step instead.
ui::run() {
	_ui_desc=$1
	shift
	_ui_out=$(mktemp)
	"$@" >"$_ui_out" 2>&1 &
	_ui_pid=$!

	if [ "$UI_TTY" = 1 ]; then
		_ui_frames='|/-\'
		_ui_i=0
		while kill -0 "$_ui_pid" 2>/dev/null; do
			_ui_c=$(printf '%s' "$_ui_frames" | cut -c$((_ui_i % 4 + 1)))
			printf '\r  %s%s%s %s' "$UI_PRIMARY" "$_ui_c" "$UI_RESET" "$_ui_desc"
			_ui_i=$((_ui_i + 1))
			sleep 0.15
		done
		printf '\r'
	fi

	wait "$_ui_pid"
	_ui_code=$?
	if [ "$_ui_code" = 0 ]; then
		ui::ok "$_ui_desc"
	else
		ui::fail "$_ui_desc (exit $_ui_code)"
		sed 's/^/    /' "$_ui_out"
	fi
	rm -f "$_ui_out"
	return "$_ui_code"
}

# ---------- summary dashboard ----------

# ui::summary_row "label" "value" ok|warn|fail|skip — one aligned row of the closing dashboard.
ui::summary_row() {
	case "$3" in
		ok) _ui_icon="$UI_GREEN$UI_I_OK$UI_RESET" ;;
		warn) _ui_icon="$UI_YELLOW$UI_I_WARN$UI_RESET" ;;
		fail) _ui_icon="$UI_RED$UI_I_FAIL$UI_RESET" ;;
		*) _ui_icon="$UI_DIM$UI_I_SKIP$UI_RESET" ;;
	esac
	printf '  %s %s%-18s%s %s\n' "$_ui_icon" "$UI_DIM" "$1" "$UI_RESET" "$2"
}

ui::summary_head() {
	printf '\n%s%s%s\n' "$UI_BOLD" "$1" "$UI_RESET"
}
