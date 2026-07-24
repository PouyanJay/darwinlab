#!/usr/bin/env bash
# Boot Darwin Lab — the one service this project has (a Vite server), managed properly: stale
# instances stopped first, the port allocated (and MOVED if the preferred one is taken), the
# process backgrounded with its PID and log under .run-state/, readiness polled before success is
# claimed, and a summary with the URL at the end. Ctrl-C during boot tears down what was started.
#
#   (no flags)   start the dev server (hot reload)
#   --preview    build, then serve the production build
#   --stop       tear down anything this script started
#   --logs       follow the running server's log
#   -h, --help   this guide

set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/make/lib/ui.sh

STATE_DIR=.run-state
DEV_PORT_BASE=5173
PREVIEW_PORT_BASE=4173
READY_TIMEOUT=60

usage() {
	sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

# ---------- port allocation ----------

port_busy() { lsof -ti tcp:"$1" >/dev/null 2>&1; }

# find_free_port BASE — the preferred port, or the next free one within +20 (hard fail past that:
# twenty occupied ports in a row means something is wrong, not that we should keep walking).
find_free_port() {
	_port=$1
	_limit=$(($1 + 20))
	while port_busy "$_port"; do
		_port=$((_port + 1))
		[ "$_port" -gt "$_limit" ] && ui::die "no free port in $1-$_limit." "make stop   (or free the range)"
	done
	printf '%s' "$_port"
}

# ---------- process management ----------

# stop_service NAME — kill the PID we recorded, then anything still holding the port we recorded.
# The port sweep matters: Vite spawns children the PID alone can miss, and a stale preview on 4173
# has poisoned test runs before (it served an OLD build to a green-looking suite).
stop_service() {
	_name=$1
	_stopped=0
	if [ -f "$STATE_DIR/$_name.pid" ]; then
		_pid=$(cat "$STATE_DIR/$_name.pid")
		if kill -0 "$_pid" 2>/dev/null; then
			kill "$_pid" 2>/dev/null || true
			sleep 0.5
			kill -9 "$_pid" 2>/dev/null || true
			_stopped=1
		fi
		rm -f "$STATE_DIR/$_name.pid"
	fi
	if [ -f "$STATE_DIR/$_name.port" ]; then
		_port=$(cat "$STATE_DIR/$_name.port")
		if port_busy "$_port"; then
			lsof -ti tcp:"$_port" | xargs kill -9 2>/dev/null || true
			_stopped=1
		fi
		rm -f "$STATE_DIR/$_name.port"
	fi
	[ "$_stopped" = 1 ] && ui::ok "stopped $_name" || ui::skip "$_name was not running"
}

# start_service NAME PORT CMD… — nohup the command, record pid+port, poll readiness with a spinner.
start_service() {
	_name=$1
	_port=$2
	shift 2
	nohup "$@" >"$STATE_DIR/$_name.log" 2>&1 &
	_pid=$!
	printf '%s' "$_pid" >"$STATE_DIR/$_name.pid"
	printf '%s' "$_port" >"$STATE_DIR/$_name.port"

	trap 'printf "\n"; ui::warn "interrupted — cleaning up"; stop_service '"$_name"'; exit 130' INT TERM

	_waited=0
	until curl -sf -o /dev/null "http://localhost:$_port/"; do
		if ! kill -0 "$_pid" 2>/dev/null; then
			ui::fail "$_name died before it became ready — last log lines:"
			tail -20 "$STATE_DIR/$_name.log" | sed 's/^/    /'
			rm -f "$STATE_DIR/$_name.pid" "$STATE_DIR/$_name.port"
			exit 1
		fi
		[ "$_waited" -ge "$READY_TIMEOUT" ] && {
			ui::fail "$_name not ready after ${READY_TIMEOUT}s — last log lines:"
			tail -20 "$STATE_DIR/$_name.log" | sed 's/^/    /'
			stop_service "$_name"
			exit 1
		}
		[ "$UI_TTY" = 1 ] && printf '\r  %s…%s waiting for http://localhost:%s (%ss)' "$UI_PRIMARY" "$UI_RESET" "$_port" "$_waited"
		sleep 1
		_waited=$((_waited + 1))
	done
	[ "$UI_TTY" = 1 ] && printf '\r'
	trap - INT TERM
	ui::ok "$_name ready in ${_waited}s (pid $_pid)"
}

open_browser() {
	# TTY-and-macOS-only nicety; CI and pipes never trigger it.
	if [ "$UI_TTY" = 1 ] && [ "$(uname)" = "Darwin" ] && [ -z "${CI:-}" ]; then
		open "$1" 2>/dev/null || true
	fi
}

summary() {
	ui::summary_head "Darwin Lab is up"
	ui::summary_row "url" "$1" ok
	ui::summary_row "log" "$2 (make logs)" ok
	ui::summary_row "stop" "make stop" ok
	printf '\n'
}

require_deps() {
	[ -d node_modules ] || ui::die "dependencies are not installed." "make setup   (or: make run)"
}

# ---------- flows ----------

cmd_stop() {
	ui::banner "stop"
	ui::step 1 1 "Tearing down"
	stop_service dev
	stop_service preview
	printf '\n'
}

cmd_logs() {
	for _name in dev preview; do
		if [ -f "$STATE_DIR/$_name.pid" ] && kill -0 "$(cat "$STATE_DIR/$_name.pid")" 2>/dev/null; then
			exec tail -f "$STATE_DIR/$_name.log"
		fi
	done
	ui::die "nothing is running." "make run"
}

cmd_dev() {
	ui::banner "run · dev server"
	mkdir -p "$STATE_DIR"
	require_deps

	ui::step 1 3 "Stopping stale instances"
	stop_service dev

	ui::step 2 3 "Allocating a port"
	PORT=$(find_free_port $DEV_PORT_BASE)
	if [ "$PORT" = "$DEV_PORT_BASE" ]; then
		ui::ok "port $PORT is free"
	else
		ui::warn "port $DEV_PORT_BASE is taken — moved to $PORT"
	fi

	ui::step 3 3 "Starting the dev server"
	start_service dev "$PORT" npm run dev -- --port "$PORT" --strictPort
	summary "http://localhost:$PORT/" "$STATE_DIR/dev.log"
	open_browser "http://localhost:$PORT/"
}

cmd_preview() {
	ui::banner "run · production preview"
	mkdir -p "$STATE_DIR"
	require_deps

	ui::step 1 4 "Stopping stale instances"
	stop_service preview

	ui::step 2 4 "Building"
	ui::run "npm run build" npm run build

	ui::step 3 4 "Allocating a port"
	PORT=$(find_free_port $PREVIEW_PORT_BASE)
	if [ "$PORT" = "$PREVIEW_PORT_BASE" ]; then
		ui::ok "port $PORT is free"
	else
		ui::warn "port $PREVIEW_PORT_BASE is taken — moved to $PORT"
	fi

	ui::step 4 4 "Serving the build"
	start_service preview "$PORT" npm run preview -- --port "$PORT" --strictPort
	summary "http://localhost:$PORT/" "$STATE_DIR/preview.log"
	open_browser "http://localhost:$PORT/"
}

case "${1:-}" in
	-h | --help) usage ;;
	--stop) cmd_stop ;;
	--logs) cmd_logs ;;
	--preview) cmd_preview ;;
	'') cmd_dev ;;
	*)
		usage
		ui::die "unknown flag: $1" "scripts/make/run.sh --help"
		;;
esac
