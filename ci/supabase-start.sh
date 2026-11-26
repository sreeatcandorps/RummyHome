#!/usr/bin/env bash
# Start the throw-away local Supabase for a CI job, retrying when the runner's Docker refuses a port.
# Usage (from rummy-home3/): ../ci/supabase-start.sh -x studio,imgproxy,edge-runtime,logflare,vector,inbucket
#
# Nov 15, Nov 19 and four times on Nov 26 a job lost every attempt to "failed to bind host port 0.0.0.0:54322
# (or the mail port): address already in use" while `ss` showed no process on the port: Docker's own port
# proxy kept a stale binding. `supabase stop` does not clear it; restarting the Docker daemon does. So after a
# failure, remove our containers and restart Docker before trying again.
set -uo pipefail

log=/tmp/supabase-start.log
show_log() { sed -E 's/((key|secret|token)[^:=]*[:=] *)[^ ]+/\1[masked]/I' "$log" | tail -"${1:-8}"; }

# The mail catcher (mailpit) starts even with `-x inbucket`: CLI v3 names it `mailpit` and ignores the old name.
# On Nov 26 its default host port 54324 was held by something on the runner that a Docker restart did not
# release. Auth reaches it inside Docker's network, so its host port is only for people: in CI, give it a free
# one (the working copy only). CLI v3 rejects an [inbucket] table; the key is [local_smtp].
if [ -n "${CI:-}" ] && [ -f supabase/config.toml ] && ! grep -qE '^\[(inbucket|local_smtp)\]' supabase/config.toml; then
  mail_port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("", 0)); print(s.getsockname()[1])')
  printf '\n[local_smtp]\nenabled = true\nport = %s\n' "$mail_port" >> supabase/config.toml
  echo "mail catcher on host port $mail_port"
fi

for attempt in 1 2 3 4; do
  if supabase start "$@" > "$log" 2>&1; then
    show_log 40
    exit 0
  fi
  echo "::warning::supabase start failed (attempt $attempt)"
  show_log
  docker ps -a --format '{{.Names}} {{.Status}}' || true
  (sudo ss -ltnp 'sport = :54322' || ss -ltnp 'sport = :54322') 2>/dev/null | tail -n +2 || true
  supabase stop --no-backup > /dev/null 2>&1 || true
  ids=$(docker ps -aq --filter 'name=supabase_' 2>/dev/null)
  [ -n "$ids" ] && docker rm -f $ids > /dev/null 2>&1 || true
  docker network prune -f > /dev/null 2>&1 || true
  echo "restarting the Docker daemon to drop stale port bindings"
  sudo systemctl restart docker 2>/dev/null || sudo service docker restart 2>/dev/null || true
  for _ in $(seq 1 30); do docker info > /dev/null 2>&1 && break; sleep 2; done
  sleep 5
done
echo "::error::supabase start failed four times"
show_log 20
exit 1
