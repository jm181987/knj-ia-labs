#!/usr/bin/env bash
set -euo pipefail

# Read-only migration verification for KNJ IA Labs.
# Secrets must be supplied as environment variables; this script never prints them.
#
# SOURCE_DATABASE_URL='postgresql://...' \
# TARGET_DATABASE_URL='postgresql://...' \
#   ./scripts/migration/compare_source_target.sh

if [[ -z "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "ERROR: SOURCE_DATABASE_URL is required" >&2
  exit 2
fi

if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "ERROR: TARGET_DATABASE_URL is required" >&2
  exit 2
fi

if [[ "${SOURCE_DATABASE_URL}" == "${TARGET_DATABASE_URL}" ]]; then
  echo "ERROR: source and target URLs are identical; refusing to continue" >&2
  exit 2
fi

for cmd in psql diff mktemp; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: required command not found: $cmd" >&2
    exit 2
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_SQL="${SCRIPT_DIR}/critical_integrity.sql"

if [[ ! -f "${CHECK_SQL}" ]]; then
  echo "ERROR: integrity SQL not found: ${CHECK_SQL}" >&2
  exit 2
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

SOURCE_REPORT="${WORK_DIR}/source.txt"
TARGET_REPORT="${WORK_DIR}/target.txt"

# Connectivity only. No credentials are printed.
echo "Checking source connection..."
psql "${SOURCE_DATABASE_URL}" -X -v ON_ERROR_STOP=1 -Atc \
  "select 'source=' || current_database() || ';pg=' || current_setting('server_version');" >/dev/null

echo "Checking target connection..."
psql "${TARGET_DATABASE_URL}" -X -v ON_ERROR_STOP=1 -Atc \
  "select 'target=' || current_database() || ';pg=' || current_setting('server_version');" >/dev/null

echo "Collecting source integrity report (read-only)..."
psql "${SOURCE_DATABASE_URL}" -X -v ON_ERROR_STOP=1 -f "${CHECK_SQL}" >"${SOURCE_REPORT}"

echo "Collecting target integrity report (read-only)..."
psql "${TARGET_DATABASE_URL}" -X -v ON_ERROR_STOP=1 -f "${CHECK_SQL}" >"${TARGET_REPORT}"

if diff -u "${SOURCE_REPORT}" "${TARGET_REPORT}"; then
  echo
  echo "OK: critical source and target reports match."
  exit 0
fi

echo
echo "MISMATCH: source and target differ. Do NOT perform cutover." >&2
exit 1
