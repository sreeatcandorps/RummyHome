# Performance measurement scripts

Everything here runs against a **local** Postgres or a mocked network. None of it
contacts the live Supabase project, and none of it is imported by the app.

Outputs from the run quoted in [`../README.md`](../README.md) are in
[`../results/`](../results/).

## Database: schema + seed + plans

Requirements: Postgres 15/16 with `psql` (tested on 16), run from `rummy-home3/`.

```bash
B=docs/performance/bench
sudo -u postgres psql -c "create database ezscore_perf"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d ezscore_perf -f $B/00_supabase_shim.sql \
  -c "alter database ezscore_perf set search_path = public, extensions"
for f in supabase/migrations/*.sql; do
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ezscore_perf -f "$f" || break
done
sudo -u postgres psql -v ON_ERROR_STOP=1 -d ezscore_perf -f $B/10_seed.sql      # ~3–5 min, ~580 MB
sudo -u postgres psql -d ezscore_perf -f $B/20_bench.sql       > results-per-screen.txt
sudo -u postgres psql -d ezscore_perf -f $B/21_bodies.sql      > results-rpc-rewrites.txt
sudo -u postgres psql -d ezscore_perf -f $B/22_rls_payload.sql > results-rls-payload.txt
sudo -u postgres psql -d ezscore_perf -f $B/23_visible_ids.sql > results-visible-ids.txt
```

| file | what it does |
|------|--------------|
| `00_supabase_shim.sql` | Minimal emulation of what the migrations expect from Supabase: `auth` schema and `auth.users`, `auth.uid()/jwt()/role()` reading `request.jwt.claims`, the `anon`/`authenticated`/`service_role` roles, `extensions` schema with `pgcrypto`, the `supabase_realtime` publication, default grants. |
| `10_seed.sql` | Deterministic dataset: `:users` registered users (default 2 000) × `:games_per_user` games (default 15; 2 active, 13 completed), 4–6 seats, 8–25 rounds, one score per seat per round, `my_players` rosters, 3 declared results per user. Edit the two `\set` lines at the top to change scale. Uses the real triggers/functions from the migrations, so shapes match production. |
| `20_bench.sql` | Every query the app issues per screen, in the exact PostgREST shape (embedded resources as lateral `json_agg`), run as `set role authenticated` with a JWT for `user1@example.com` so RLS applies. `EXPLAIN (ANALYZE, BUFFERS)` for each. |
| `21_bodies.sql` | The bodies of the three slow RPCs (`list_visible_game_ids`, `list_new_game_candidates`, `list_game_results_page`) as written in the migrations, next to a semantics-preserving rewrite of each, so the plans can be compared directly. |
| `22_rls_payload.sql` | A–C: cost of the `scores` RLS policy as written vs with `(select …)` wrappers (policy swapped inside a rolled-back transaction). D–F: byte sizes PostgREST would return for the scorecard, Home list and a `get_game_bundle`-style single JSON. G: `save_round` cost (rolled back). H: `profiles` RLS on the seat embed. I: existing indexes. J: table sizes. K: Results-page scores download vs server-side totals. |
| `23_visible_ids.sql` | `list_visible_game_ids` rewrite variants: with the email-match branch using the existing `lower(btrim(email))` partial index, without the branch, and the shipped function for reference. |

Notes

* Timings are single-run, warm cache, on a shared VM; treat ±20 % as noise. The ratios
  (hundreds of ms vs single-digit ms) are what matter.
* The seed does not seat guest (managed) profiles, so section H of `22_rls_payload.sql`
  falls back to a registered-only game.
* `gen_random_uuid()` is not seeded, so the "largest game the test user owns" picked by
  `22_rls_payload.sql` differs slightly between seeds (150 vs 114 score rows in two runs);
  byte counts and times scale with it.

## Client: requests per screen

`harness/count-requests.mjs` imports the real `services/*.ts` and `utils/*.ts` through
`tsx`, stubs the React Native / Expo modules they import (`harness/stub-loader.mjs`),
replaces `globalThis.fetch` with a recorder that answers with minimal, shape-correct JSON,
then replays each screen's load sequence exactly as the screen component does it. Run from
`rummy-home3/` after `npm ci`:

```bash
node --import ./docs/performance/bench/harness/stubs.mjs --import tsx \
     docs/performance/bench/harness/count-requests.mjs
```

It prints, per flow, the number of HTTP requests, how many are serial, and a breakdown by
endpoint. Env vars point `supabase.ts` at a `.invalid` host, so nothing can leak out even
if a request escapes the mock.

## Bundle size

```bash
npx expo export --platform android --source-maps --output-dir /tmp/ezscore-export
node docs/performance/bench/mapsize.mjs /tmp/ezscore-export/_expo/static/js/android/*.hbc.map
```

`mapsize.mjs` sums `sourcesContent` per package from the Hermes source map (a proxy for
bundle share; minified bytes are roughly proportional). The export log lists every asset
and its size, which is where the icon-font finding comes from.
