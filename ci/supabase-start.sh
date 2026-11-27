#!/usr/bin/env bash
# Start the throw-away local Supabase for a CI job, retrying when the runner's Docker refuses a port.
# Usage (from rummy-home3/): ../ci/supabase-start.sh -x studio,imgproxy,edge-runtime,logflare,vector,inbucket
#
# Nov 15, Nov 19 and five times on Nov 26 a job lost every attempt to "failed to bind host port 0.0.0.0:54322
# (or the mail port): address already in use" while `ss` showed no process on the port: Docker's own port
# proxy kept a stale binding. `supabase stop` does not clear it; restarting the Docker daemon sometimes does,
# and on Nov 26 (#149, #151) it did not, and the fourth restart left no Docker at all. So when the database's
# host port is the one refused, the database moves to a free port (the working copy's config.toml only) instead;
# any other failure removes our containers and restarts Docker before trying again.
#
# The database URL is the script's output: on success it is written to $GITHUB_ENV (later steps) and to
# $DB_URL_FILE (the step that called the script: `DB_URL=$(cat "$DB_URL_FILE")`). Jobs must not set DB_URL
# themselves, since a job-level env value is not reliably overridden by $GITHUB_ENV.
set -uo pipefail

log=/tmp/supabase-start.log
DB_URL_FILE=${DB_URL_FILE:-/tmp/ezscore-db-url}
show_log() { sed -E 's/((key|secret|token)[^:=]*[:=] *)[^ ]+/\1[masked]/I' "$log" | tail -"${1:-8}"; }
free_port() { python3 -c 'import socket; s = socket.socket(); s.bind(("", 0)); print(s.getsockname()[1])'; }
db_port() { awk '/^\[db\]/{d=1; next} /^\[/{d=0} d && /^port *=/{gsub(/[^0-9]/, ""); print; exit}' supabase/config.toml; }

# The mail catcher (mailpit) starts even with `-x inbucket`: CLI v3 names it `mailpit` and ignores the old name.
# On Nov 26 its default host port 54324 was held by something on the runner that a Docker restart did not
# release. Auth reaches it inside Docker's network, so its host port is only for people: in CI, give it a free
# one (the working copy only). CLI v3 rejects an [inbucket] table; the key is [local_smtp].
if [ -n "${CI:-}" ] && [ -f supabase/config.toml ] && ! grep -qE '^\[(inbucket|local_smtp)\]' supabase/config.toml; then
  mail_port=$(free_port)
  printf '\n[local_smtp]\nenabled = true\nport = %s\n' "$mail_port" >> supabase/config.toml
  echo "mail catcher on host port $mail_port"
fi

for attempt in 1 2 3 4; do
  if supabase start "$@" > "$log" 2>&1; then
    show_log 40
    port=$(db_port)
    url="postgresql://postgres:postgres@127.0.0.1:${port:-54322}/postgres"
    printf '%s\n' "$url" > "$DB_URL_FILE"
    [ -n "${GITHUB_ENV:-}" ] && printf 'DB_URL=%s\n' "$url" >> "$GITHUB_ENV"
    echo "database on host port ${port:-54322}"
    exit 0
  fi
  echo "::warning::supabase start failed (attempt $attempt)"
  show_log
  port=$(db_port)
  docker ps -a --format '{{.Names}} {{.Status}}' || true
  (sudo ss -ltnp "sport = :${port:-54322}" || ss -ltnp "sport = :${port:-54322}") 2>/dev/null | tail -n +2 || true
  supabase stop --no-backup > /dev/null 2>&1 || true
  ids=$(docker ps -aq --filter 'name=supabase_' 2>/dev/null)
  [ -n "$ids" ] && docker rm -f $ids > /dev/null 2>&1 || true
  docker network prune -f > /dev/null 2>&1 || true
  if [ -n "${CI:-}" ] && [ -n "$port" ] && grep -q "host port 0.0.0.0:${port}/tcp: address already in use" "$log"; then
    new_port=$(free_port)
    sed -i -E "/^\[db\]/,/^\[/ s/^port *= *${port}\$/port = ${new_port}/" supabase/config.toml
    echo "::warning title=Database port moved::host port $port is held on this runner; the database moves to $new_port"
    continue
  fi
  echo "restarting the Docker daemon to drop stale port bindings"
  sudo systemctl restart docker 2>/dev/null || sudo service docker restart 2>/dev/null || true
  for _ in $(seq 1 30); do docker info > /dev/null 2>&1 && break; sleep 2; done
  sleep 5
done
echo "::error::supabase start failed four times"
show_log 20
exit 1
