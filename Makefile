# Darwin Lab — the universal entry point. Thin wrapper only: every target is one script call;
# the logic (checks, ports, PIDs, readiness, aggregation) lives in scripts/make/.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ── Setup & orchestration ─────────────────────────────────────────────
.PHONY: help setup start run preview stop logs

help:
	@./scripts/make/help.sh

setup:
	@./scripts/make/install.sh

start:
	@./scripts/make/run.sh

run: setup start

preview:
	@./scripts/make/run.sh --preview

stop:
	@./scripts/make/run.sh --stop

logs:
	@./scripts/make/run.sh --logs

# ── Testing ───────────────────────────────────────────────────────────
.PHONY: test test-unit test-e2e

test:
	@./scripts/make/run-tests.sh --all

test-unit:
	@./scripts/make/run-tests.sh --unit

test-e2e:
	@./scripts/make/run-tests.sh --e2e

# ── Code quality ──────────────────────────────────────────────────────
.PHONY: lint lint-fix

lint:
	@./scripts/make/run-linters.sh --all

lint-fix:
	@./scripts/make/run-linters.sh --all --fix
