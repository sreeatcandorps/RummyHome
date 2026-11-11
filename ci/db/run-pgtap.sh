#!/usr/bin/env bash
# Run every pgTAP file in rummy-home3/supabase/tests through psql, keep the raw TAP per file
# (the report reads it), and fail if any test fails that is not marked TODO (known failure).
#
# Env: DB_PSQL  - how to reach the database, e.g. `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`
#      OUT      - directory for <file>.tap (default ci/out/db/pgtap)
set -uo pipefail
cd "$(dirname "$0")/../.."

DB_PSQL="${DB_PSQL:-psql}"
OUT="${OUT:-ci/out/db/pgtap}"
mkdir -p "$OUT"

$DB_PSQL -v ON_ERROR_STOP=1 -q -c 'create extension if not exists pgtap;' >/dev/null

total=0; passed=0; failed=0; todo=0; status=0
for f in rummy-home3/supabase/tests/*.sql; do
  name="$(basename "$f" .sql)"
  tap="$OUT/$name.tap"
  # -tA prints only the TAP lines pgTAP returns; stderr (plan mismatches, SQL errors) goes to the same file
  $DB_PSQL -v ON_ERROR_STOP=1 -tA -q -f "$f" >"$tap" 2>&1
  rc=$?
  n_ok=$(grep -c    -E '^ok [0-9]+'      "$tap" || true)
  n_fail=$(grep -c  -E '^not ok [0-9]+'  "$tap" || true)
  n_todo=$(grep -c  -E '^not ok [0-9]+.*# TODO' "$tap" || true)
  real_fail=$((n_fail - n_todo))
  planned=$(grep -m1 -oE '^1\.\.[0-9]+' "$tap" | cut -d. -f3)
  ran=$((n_ok + n_fail))
  verdict=ok
  if [ "$rc" -ne 0 ] || [ "$real_fail" -gt 0 ] || [ -z "$planned" ] || [ "$planned" != "$ran" ]; then
    verdict=FAIL; status=1
  fi
  printf '%-40s %s  (%s ok, %s failed, %s known failures, planned %s)\n' "$name" "$verdict" "$n_ok" "$real_fail" "$n_todo" "${planned:-?}"
  if [ "$verdict" = FAIL ]; then grep -E '^not ok|^#|ERROR|psql:' "$tap" | grep -v '# TODO' | head -20 | sed 's/^/    /'; fi
  total=$((total + ran)); passed=$((passed + n_ok)); failed=$((failed + real_fail)); todo=$((todo + n_todo))
done
echo "pgTAP: $total tests, $passed passed, $failed failed, $todo known failures (TODO)"
exit $status
