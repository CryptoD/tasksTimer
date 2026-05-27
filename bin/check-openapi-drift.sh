#!/usr/bin/env bash
# Fail when HTTP handler sources change without a matching OpenAPI / API contract update.
# Task 74 — see CONTRIBUTING.md (Task 96).
#
# Usage:
#   bin/check-openapi-drift.sh              # PR/push: auto base ref
#   bin/check-openapi-drift.sh origin/main  # explicit merge base
#   bin/check-openapi-drift.sh --self-test  # verify fail/ok logic
#
# Exit 0: no handler changes, or spec updated alongside handlers.
# Exit 1: handler drift detected.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="${ROOT}/tooling/openapi_drift_manifest.txt"

load_manifest() {
  handler_prefixes=()
  spec_files=()
  mode=""
  while IFS= read -r line || [ -n "$line" ]; do
    trimmed="${line%%#*}"
    trimmed="$(echo "$trimmed" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -z "$trimmed" ] && continue
    case "$trimmed" in
      "--- HANDLER"*) mode="handler"; continue ;;
      "--- SPEC"*) mode="spec"; continue ;;
    esac
    if [ "$mode" = "handler" ]; then
      handler_prefixes+=("$trimmed")
    elif [ "$mode" = "spec" ]; then
      spec_files+=("$trimmed")
    fi
  done < "$MANIFEST"
}

is_handler() {
  local f="$1"
  local p
  for p in "${handler_prefixes[@]}"; do
    case "$f" in
      "$p"*) return 0 ;;
    esac
  done
  case "$f" in
    *router*.go|*handlers*.go|*handler_*.go) return 0 ;;
  esac
  return 1
}

is_spec() {
  local f="$1"
  local s
  for s in "${spec_files[@]}"; do
    [ "$f" = "$s" ] && return 0
  done
  return 1
}

classify_changed() {
  handler_hits=()
  spec_hits=()
  local f
  for f in "$@"; do
    if is_handler "$f"; then
      handler_hits+=("$f")
    fi
    if is_spec "$f"; then
      spec_hits+=("$f")
    fi
  done
}

report_drift() {
  local base_label="$1"
  if [ ${#handler_hits[@]} -eq 0 ]; then
    echo "[check-openapi-drift] ok (no handler paths changed vs $base_label)"
    return 0
  fi
  if [ ${#spec_hits[@]} -gt 0 ]; then
    echo "[check-openapi-drift] ok (handler + spec updated vs $base_label)"
    return 0
  fi
  echo "[check-openapi-drift] FAILED — handler files changed without OpenAPI contract update" >&2
  echo "Changed handler paths:" >&2
  printf '  - %s\n' "${handler_hits[@]}" >&2
  echo "" >&2
  echo "Update at least one spec file:" >&2
  printf '  - %s\n' "${spec_files[@]}" >&2
  echo "" >&2
  echo "See CONTRIBUTING.md → Task 96 (OpenAPI drift policy)." >&2
  return 1
}

run_self_test() {
  if [ ! -f "$MANIFEST" ]; then
    echo "self-test: missing manifest" >&2
    return 1
  fi
  load_manifest

  classify_changed e2e/handlers.mjs
  if report_drift self-test; then
    echo "self-test: expected failure when handler changes alone" >&2
    return 1
  fi

  classify_changed e2e/handlers.mjs docs/api/openapi.yaml
  report_drift self-test || return 1

  classify_changed README.md
  report_drift self-test || return 1

  echo "[check-openapi-drift] self-test: ok"
}

if [ "${1:-}" = "--self-test" ]; then
  set +e
  run_self_test
  exit $?
fi

if [ ! -f "$MANIFEST" ]; then
  echo "check-openapi-drift: missing manifest at tooling/openapi_drift_manifest.txt" >&2
  exit 1
fi

cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "check-openapi-drift: not a git repository" >&2
  exit 1
fi

resolve_base() {
  if [ -n "${1:-}" ]; then
    echo "$1"
    return
  fi
  if [ "${GITHUB_EVENT_NAME:-}" = "pull_request" ] && [ -n "${GITHUB_BASE_REF:-}" ]; then
    echo "origin/${GITHUB_BASE_REF}"
    return
  fi
  if git rev-parse HEAD~1 >/dev/null 2>&1; then
    echo "HEAD~1"
    return
  fi
  echo ""
}

load_manifest

BASE="$(resolve_base "${1:-}")"
if [ -z "$BASE" ]; then
  echo "[check-openapi-drift] skip (no base ref for comparison)"
  exit 0
fi

if ! git rev-parse "$BASE" >/dev/null 2>&1; then
  echo "[check-openapi-drift] skip (base ref '$BASE' not found)"
  exit 0
fi

mapfile -t changed < <(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE" HEAD)

if [ ${#changed[@]} -eq 0 ]; then
  echo "[check-openapi-drift] ok (no changed files vs $BASE)"
  exit 0
fi

classify_changed "${changed[@]}"
report_drift "$BASE"
