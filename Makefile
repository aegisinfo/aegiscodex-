SHELL := /bin/bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

# ─── Phony targets ──────────────────────────────────────────────────────
.PHONY: all install typecheck build build-publish release ci clean

# ─── Default ─────────────────────────────────────────────────────────────
all: ci

# ─── Install dependencies ────────────────────────────────────────────────
install:
	npm ci

# ─── TypeScript check ───────────────────────────────────────────────────
typecheck:
	npm run typecheck

# ─── Build (JS bundle only) ─────────────────────────────────────────────
build:
	npm run build

# ─── Build + make binary (matches CI) ───────────────────────────────────
build-publish:
	npm run build:publish

# ─── Full CI pipeline (matches GitHub workflow) ─────────────────────────
ci: install typecheck build-publish
	@echo "═══ CI passed ═══"

# ─── Clean ──────────────────────────────────────────────────────────────
clean:
	rm -rf dist/ bin/
	@echo "✓ cleaned"
