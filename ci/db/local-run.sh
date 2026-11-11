#!/usr/bin/env bash
# Run the whole database suite WITHOUT the Supabase CLI, on a plain Postgres 16 that has pgTAP
# installed (apt: postgresql-16 postgresql-16-pgtap). Writes the same ci/out/db layout as CI so
# `node ci/report/build-report.mjs` produces the same report.
#
# CI does not use this; it uses `supabase start` (see .github/workflows/ci.yml). This is for machines
# with no Docker, such as the cloud-agent VMs, and for a quick local check before pushing.
#
# Usage: ci/db/local-run.sh [dbname]        (default ezscore_test)
# Env:   PSQL="sudo -u postgres psql"       how to run psql as a superuser (default: psql)
#        DB_URL=postgresql://user:pw@host:5432/<dbname>   for the Node concurrency script
#        OUT=ci/out                           output root
set -uo pipefail
cd "$(dirname "$0")/../.."

APP=rummy-home3
DB="${1:-ezscore_test}"
PSQL="${PSQL:-psql}"
OUT="${OUT:-ci/out}"
mkdir -p "$OUT/db"
rm -rf "$OUT/db"/*

echo "== recreate $DB and apply migrations 001..017 + seed"
{
  $PSQL -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB;" -c "create database $DB;" &&
  $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f ci/db/local-stub.sql &&
  for f in "$APP"/supabase/migrations/*.sql; do
    $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" && echo "applied $(basename "$f")" || exit 1
  done &&
  $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$APP"/supabase/seed.sql && echo "applied seed.sql"
} >"$OUT/db/migrations.txt" 2>&1
echo $? >"$OUT/db/migrations.status"
tail -3 "$OUT/db/migrations.txt"
[ "$(cat "$OUT/db/migrations.status")" = 0 ] || { echo "migrations failed, see $OUT/db/migrations.txt"; exit 1; }

echo "== rollbacks"
DB_PSQL="$PSQL -d $DB" ci/db/replay-rollbacks.sh >"$OUT/db/rollbacks.tap" 2>&1
echo $? >"$OUT/db/rollbacks.status"
tail -1 "$OUT/db/rollbacks.tap"

echo "== pgTAP"
DB_PSQL="$PSQL -d $DB" OUT="$OUT/db/pgtap" ci/db/run-pgtap.sh
echo $? >"$OUT/db/pgtap.status"

echo "== concurrency"
(cd ci && [ -d node_modules ] || npm ci --no-audit --no-fund >/dev/null)
DB_URL="${DB_URL:-postgresql:///$DB}" node ci/db/concurrency-save-round.mjs >"$OUT/db/concurrency.tap" 2>&1
echo $? >"$OUT/db/concurrency.status"
grep -E '^(ok|not ok|1\.\.|Bail)' "$OUT/db/concurrency.tap"

echo "== statuses: migrations=$(cat "$OUT/db/migrations.status") rollbacks=$(cat "$OUT/db/rollbacks.status") pgtap=$(cat "$OUT/db/pgtap.status") concurrency=$(cat "$OUT/db/concurrency.status")"
