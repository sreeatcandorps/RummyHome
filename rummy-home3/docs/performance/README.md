# EZ Score performance review

Research only. No app code and no live database were touched. Every number below was
measured either on a **local Postgres 16** loaded with the repo's own migrations and a
seeded dataset (2 000 users, 30 000 games, 2.25 M score rows), or by **replaying the real
`services/*.ts` code in Node** with `fetch` intercepted. Scripts, raw plans and outputs
are in [`bench/`](bench/) and [`results/`](results/) so anyone can re-run them
(see [`bench/README.md`](bench/README.md)).

This builds on PR 7 (`cursor/ezscore-apk-ready`), which already added the in-memory
last-known cache (`utils/gameCache.ts`), one load per screen open, `accessFor(preloaded)`
and the Home prefetch of the first two live games. Nothing here re-proposes those; the
items below are what is still left on the table after PR 7.

Contents

1. [Measure first](#1-measure-first)
2. [Rendering and graphics](#2-rendering-and-graphics)
3. [Code efficiency and bloat](#3-code-efficiency-and-bloat)
4. [Architecture for scale](#4-architecture-for-scale)
5. [Prioritized roadmap](#5-prioritized-roadmap)

---

## 0. Headline findings

| # | Finding | Measured | Where |
|---|---------|----------|-------|
| 1 | `list_visible_game_ids()` sequentially scans **every game in the database** on every Home focus and every Results open | **428–554 ms** at 30 k games; index-driven rewrite **0.53 ms** (same semantics) or **0.13 ms** (drop email-match branch) | [`results/db-visible-ids.txt`](results/db-visible-ids.txt) |
| 2 | Home focus is a 4-deep serial waterfall followed by a burst | **17 HTTP requests**, 4 serial round-trips before anything new can paint (session refresh → profile → ids RPC → games) | [`results/client-requests.txt`](results/client-requests.txt) |
| 3 | Realtime fan-out: one saved round emits `N+2` `postgres_changes` events, and each one re-runs the full 4-request scorecard load | 5-seat table: **7 events → 28 requests per subscribed device**, 32 with the focus reload; 4 spectators + scorer = **~160 requests per round** | harness + `services/realtime.ts` |
| 4 | RLS policy on `scores` re-evaluates `is_app_admin() OR is_game_member(game_id)` per row | 150-row game: **0.42 ms** no RLS (606 buffers) → **4.22 ms** as written (3 117 buffers) → **3.02 ms** with `(select …)` wrappers (2 263 buffers) | [`results/db-rls-payload.txt`](results/db-rls-payload.txt) |
| 5 | Scorecard payload is `select *` × 3 tables | **53.2 KB** for one 25-round, 6-seat game (`scores` alone 48.9 KB); minimal columns 12.9 KB; one bundled JSON RPC **2.5 KB in 0.39 ms** | same |
| 6 | Results page is N+1 and downloads every score of every visible game | 12 visible games → **17 requests**; at 50 games → 55 requests and **1.37 MB** of `scores` (4 018 rows) to compute totals the server could return as **24.9 KB** | same + harness |
| 7 | `list_new_game_candidates()` and `list_game_results_page()` have the same "`OR exists` over all rows" shape | **270–308 ms → 2.1–2.3 ms**; **115–128 ms → 7.7–8.4 ms** | [`results/db-rpc-rewrites.txt`](results/db-rpc-rewrites.txt) |
| 8 | Icon fonts: two root imports from `@expo/vector-icons` pull in **all 15 font files (~4 MB)** of the 4.9 MB asset set | Hermes bundle 2.87 MB; app code is ~12 % of it | [`results/bundle-export.txt`](results/bundle-export.txt), [`results/bundle-attribution.txt`](results/bundle-attribution.txt) |
| 9 | 826 KB 1024×1024 `assets/icon.png` is decoded at runtime as the in-app logo on three screens (a 1.7 KB `assets/logotype.png` already exists and is unused) | — | `app.json`, `components/ui/AuthShell.tsx`, `app/index.tsx`, `app/(tabs)/_layout.tsx` |
| 10 | ~40 expo-router files are copied verbatim into the app root, plus 15 loose `.md` files, dual "local mode" code paths (115 `isSupabaseConfigured` checks) and 4 dead modules | see §3 | — |

Top 5 recommendations, in order: (1) rewrite the three visibility RPCs as index-driven
unions and add the three missing indexes; (2) a `get_game_bundle(game_id)` RPC plus
column lists, so a scorecard open is 1 request / ~2.5 KB instead of 4 / 53 KB; (3) debounce
realtime (or move to Broadcast) so a save costs one reload, not seven; (4) collapse the
Home waterfall (skip the network session refresh when the token is fresh, run profile +
ids in parallel or fold them into one RPC, lazy-load claim/notice RPCs); (5) `results/`
candidates RPC with server-side totals instead of fetching all scores.

---

## 1. Measure first

### 1.1 Method

* **Database**: local Postgres 16, `bench/00_supabase_shim.sql` (emulates `auth.uid()`,
  `auth.jwt()`, roles, `extensions` schema), then the repo's `supabase/migrations/001…017`
  unmodified, then `bench/10_seed.sql`. Queries run as `set role authenticated` with
  `request.jwt.claims` set, so RLS applies exactly as through PostgREST. Query shapes are
  the ones PostgREST generates for the app's `supabase-js` calls (embedded resources as
  lateral `json_agg`).
* **Client**: `bench/harness/count-requests.mjs` imports the real `services/*.ts` and
  `utils/*.ts` through `tsx`, stubs React Native/Expo modules, intercepts `fetch`, and
  replays each screen's `loadData` sequence line-for-line from the screen source. It
  counts requests and serial round-trips. Latency is not simulated; think of every
  serial step as one mobile RTT (typically 80–300 ms on Indian 4G to the nearest Supabase
  region).
* **Bundle**: `npx expo export --platform android --source-maps` and
  `bench/mapsize.mjs` over the Hermes source map.

Seeded dataset (deterministic, `setseed(0.42)`):

| table | rows | size |
|-------|------|------|
| profiles | 6 000 (2 000 registered + 4 000 guests) | 5 MB |
| games | 30 000 (2 active + 13 completed per user) | 32 MB |
| game_players | 150 071 (4–6 seats) | 42 MB |
| rounds | 447 074 | 95 MB |
| scores | 2 255 058 | 374 MB |
| my_players | 118 395 | 16 MB |
| game_results / game_result_games | 6 000 / 18 000 | 10 MB |
| **database** | | **583 MB** |

So roughly **290 MB per 1 000 active users** who each finish ~15 games. Supabase Pro
includes 8 GB disk; see §4.6.

### 1.2 Requests per screen (measured, [`results/client-requests.txt`](results/client-requests.txt))

| Screen / action | HTTP requests | Serial RTTs before new data can paint | What they are |
|---|---|---|---|
| **Home focus** (cold, 2 live games) | **17** | **4** | `POST auth/token` (refresh) → `GET profiles` → `POST rpc/list_visible_game_ids` → `GET games?…in(ids)&select=*,game_players(...)`, then in parallel: 2 × prefetch (`games`, `game_players`, `scores`, `game_players+profiles`), `rpc/take_creator_notices`, `rpc/list_claim_requests`, `rpc/list_my_players`, and **two more `GET profiles`** from `(tabs)/_layout.tsx` (`useMyName` and the player-count effect) |
| **Scorecard open** `games/[id].tsx` | 4 | 1 | `games`, `game_players`, `scores(+rounds)`, `game_players(+profiles)` — all parallel. Paints instantly from `gameCache` when seeded (PR 7) |
| **Round entry open** `score-entry.tsx` | 5 | 1 | same 4 + `GET profiles` (`getCurrentPlayer`). **Not seeded from `gameCache`**: `useState<Game|null>(null)`, `loading = true`, so this screen still shows a spinner for one RTT even though the scorecard it came from had the data |
| **Players page** `games/players.tsx` | 5 | 1 | same 4 + `GET profiles`; also reloads on every `AppState → active` |
| **Save round** | 4 | 2 | `rpc/save_round` then `getGame` refetch (3 requests) |
| **Realtime echo after one save** (5 seats) | **32** | — | 7 `postgres_changes` events (1 `rounds` + 5 `scores` + 1 `games`) each → full 4-request reload, + 1 reload from `useFocusEffect` when returning to the scorecard |
| **Results page** `results/index.tsx` | 17 (12 visible games) → **~55 at 50 games** | 5 | `profiles` → `rpc/list_visible_game_ids` → `games` → `scores in(all game ids)` → **one `game_players` request per game** → `rpc/list_game_results_page` |
| **Tab switch** (`(tabs)/_layout.tsx` path effect) | 3 | 1 | `GET profiles` ×2 + `rpc/list_my_players` — re-runs on every pathname change |
| **New game** `new-game.tsx` | 2–3 | 1 | `rpc/list_new_game_candidates` (+ `list_my_players`) |
| **Results detail** `results/[id].tsx` | 1 + 3 per game ×2 | 2 | `rpc/get_game_result`, then `flagReuse` and `withRounds` each call `getGame` (3 requests) **per game in the result** — 3 games = 19 requests |

Waterfall notes

* `authService.ensureFreshSession()` always calls `supabase.auth.refreshSession()`, i.e. a
  network `POST /auth/v1/token` on **every startup and every Home focus**, before anything
  else is allowed to start. supabase-js already auto-refreshes; the call is only needed when
  `expires_at` is near.
* `getCurrentPlayer()` is `getSession()` + `GET profiles` with no memoisation. The harness
  counts **3 profile fetches during one Home focus** and one on every subsequent screen.
* Realtime `onChange` is wired straight to `loadGameData` with no debounce; there is also
  a `token_ledger` subscription that nothing consumes (5 channels per game).
* `prefetchGame()` has no cache check, so returning to Home re-prefetches both live games
  (8 requests) even if they were fetched a second ago.

### 1.3 Payload sizes (measured, [`results/db-rls-payload.txt`](results/db-rls-payload.txt) section D–F)

One 6-seat, 25-round game (150 score rows — the largest game the test user owns), bytes PostgREST would return:

| request | bytes |
|---|---|
| `games select *` | 619 |
| `game_players select *` | 1 790 |
| `scores select *, rounds(round_number, undone_at)` | **48 904** |
| `game_players select *, profiles(...)` (`listGamePlayers`) | 1 891 |
| **scorecard open total** | **53.2 KB** |
| `scores` with only the 5 columns the client uses | 12 921 |
| **`get_game_bundle`-style single JSON** (game + seats + per-player score arrays) | **2 524 bytes, 0.39 ms** |

Home list (`games select *, game_players(...)` for 15 games): 18.4 KB; ~61 KB at the
50-game limit. Results page for a user with 50 visible games (section K): **1.37 MB of
`scores`** (4 018 rows, 93 ms DB under RLS) plus 50 `game_players` requests, to compute
per-game totals the server could return as **24.9 KB** (107 ms in a SECURITY DEFINER
function that checks visibility once; 240 ms if left to per-row RLS). The win there is
55× less egress and 50 fewer requests, not DB time.

### 1.4 Query plans, N+1 and missing indexes (measured)

| Query (as shipped) | Time at 30 k games | Why | Rewrite measured |
|---|---|---|---|
| `list_visible_game_ids()` (006) | **428–554 ms** | `Seq Scan on games` with a correlated `EXISTS … join profiles on lower(p.email)` → 149 909-row hash join per call | union of three index scans (`games_created_by_number_idx`, `game_players_profile_idx`, `profiles_email_normalized_key`): **0.53–0.56 ms**; without the email branch **0.12–0.13 ms** |
| Home `games … in(list_visible_game_ids())` | 407–445 ms | all but ~7 ms is the RPC | follows from above |
| `list_new_game_candidates(100)` (012) | **270–308 ms** | `my_games` CTE uses `created_by = me OR exists(…)` → seq scan of games + 149 k `game_players` | `UNION` of the two branches: **2.1–2.3 ms** |
| `list_game_results_page(5,0)` (013) | **115–128 ms** | walks `game_results` by `declared_at` and calls `can_see_game_result(id)` per row until 5 pass | candidate set first (`declared_by = me ∪ my seats ∪ my games`): **7.7–8.4 ms** |
| `scores` for one game under RLS | 4.22 ms | `is_app_admin() OR is_game_member(game_id)` called 150 times on `scores` and again 150 times on the `rounds` embed (3 117 buffers vs 606) | `(select is_app_admin()) or (select is_game_member(game_id))`: **3.02 ms**; the real fix is the bundle RPC (0.39 ms) |
| `save_round(...)` | 3.1–4.6 ms | fine; RLS on `game_players` adds ~0.2 ms | — |
| `get_game_result` | 6.7–7.7 ms | OK | — |
| `search_players('Player 12')` | 3.9–4.2 ms | OK at 6 k profiles; trigram index if profiles ≫ 100 k | — |
| `list_claim_requests`, `take_creator_notices` | 0.4 ms (tables empty) | `player_links` and `creator_notices` have **no `owner_id` index**; at 4 k / 40 k rows measured 1.29 → 0.48 ms and 3.58 → 0.16 ms with partial indexes | add `(owner_id) where status='pending'` / `where taken_at is null` |

Indexes that are missing for queries the app runs:

```sql
create index game_results_declared_by_idx on public.game_results (declared_by);
create index player_links_owner_pending_idx on public.player_links (owner_id) where status = 'pending';
create index creator_notices_owner_open_idx on public.creator_notices (owner_id) where taken_at is null;
```

`scores_game_idx`, `game_players_game_idx`, `game_players_profile_idx`,
`games_created_by_number_idx` and `rounds_game_round_idx` exist and are used.

Functionality note on `list_visible_game_ids`: the 0.53 ms version keeps the email-match
branch (seats linked to the signed-in email but not yet to the profile id) by using the
existing `lower(btrim(email))` partial index, which only covers non-guest profiles with an
email — identical to who can actually sign in. Dropping the branch (0.13 ms) would hide
email-only seats from Home and is a product decision.

### 1.5 RLS costs

Policies call SECURITY DEFINER helpers (`is_app_admin()`, `is_game_member(game_id)`,
`is_game_admin(game_id)`, `can_see_profile(id)`) directly in `USING`, so Postgres evaluates
them once per candidate row. On `scores` that is one `game_players` lookup per score row
(measured above). Wrapping each helper in `(select …)` lets the planner hoist the
`is_app_admin()` half into an InitPlan and cache `is_game_member(game_id)` per distinct
game — a documented Supabase RLS optimisation that changes no semantics. The same applies
to `rounds`, `game_players`, `games` and `profiles` policies.

### 1.6 Realtime load

`services/realtime.ts` subscribes one channel per table (`games`, `game_players`,
`rounds`, `scores`, `token_ledger`) with `event: '*'`. Postgres Changes semantics:

* one message per changed **row**, per subscriber, with RLS evaluated per subscriber →
  a 5-seat round is **7 messages × subscribers**, counted against the 5 M-message quota;
* the Realtime authoriser is single-threaded per project and Supabase's own guidance is to
  use Broadcast when many clients watch the same game;
* on the client every message is a full 4-request reload (28 requests per save per
  device, measured above), and the scorer's own device reloads too.

With 100 tables being played concurrently (5 players each, one round every ~3 min) that is
~5 800 messages/min and ~23 000 REST requests/min from echoes alone. Supabase Pro's quota
is 500 messages/s, so that stays within limits, but the REST load is almost entirely
redundant.

---

## 2. Rendering and graphics

Observations from reading the components (no profiler run; the Android emulator is not
available in this environment).

### 2.1 Re-renders

* **No `React.memo` anywhere in `components/`**. `GameListItem`, `SeatAvatar`,
  `ScoreTable`, `ScoreCell`, `PlayerRow` all re-render whenever their parent does.
* `games/[id].tsx` recomputes every per-player total, the rounds matrix and the
  `ScoreTable` props inline in the render body on every state change (including every
  realtime `setGame`), with inline closures passed down so children cannot bail out.
  `useMemo` on the derived matrix + memoised rows is enough.
* `(tabs)/_layout.tsx` runs `getCurrentPlayer` twice and `listMyPlayers` on every
  `pathname` change, and each resolves into `setState`, which re-renders the whole tab
  tree.

### 2.2 Lists and virtualization

* Home renders games with `.map` inside a `ScrollView`; fine at 15 games, not at the
  50-game limit with avatars per seat. `FlatList` is used in exactly one place
  (`app/(tabs)/players.tsx`).
* `ScoreTable` is a non-virtualised rounds × players grid (25 rounds × 6 players = 150+
  cells), every cell a `Text` with `adjustsFontSizeToFit`, which forces a per-cell native
  measurement pass. Virtualise rows (`FlatList` with `getItemLayout`) and drop
  `adjustsFontSizeToFit` in favour of a fixed width/tabular-nums font.

### 2.3 Heavy components and animations

* `ScoreCell` allocates **3 `Animated.Value`s per cell** and animates with
  `useNativeDriver: false`, so colour/scale feedback runs on the JS thread while the same
  thread is parsing the 37 KB realtime refetch. Use `useNativeDriver: true` for
  transform/opacity (colour interpolation cannot use the native driver; swap the fill for
  an opacity cross-fade of two views).
* Totals row and `ScoreCell` flash animations run for every cell when the matrix is
  rebuilt (because the parent re-renders), not only for the changed round.

### 2.4 Images and fonts

* `assets/icon.png` is **1024×1024, 826 KB** and is used as the app icon, splash,
  adaptive-icon foreground **and** the in-app logo (`components/ui/AuthShell.tsx`,
  `app/index.tsx`, `(tabs)/_layout.tsx`). The runtime decodes an 826 KB PNG to a 4 MB
  bitmap to draw a ~64 px logo. `assets/logotype.png` (96×88, 1.7 KB) is already in the
  repo and unused; a 256 px version of the icon (~15 KB) would also do.
* Icon fonts: `import { Ionicons } from '@expo/vector-icons'` (`(tabs)/_layout.tsx`) and
  `import { MaterialCommunityIcons } from '@expo/vector-icons'` (`ShareCardView.tsx`) hit
  the package root, so Metro bundles **all 15 font families (~4 MB of the 4.9 MB asset
  export)**: `MaterialCommunityIcons.ttf` 1.31 MB, `FontAwesome5` ×3 ~0.9 MB,
  `Fontisto` 314 KB, `Ionicons` 390 KB … Subpath imports
  (`@expo/vector-icons/Ionicons`, `@expo/vector-icons/MaterialCommunityIcons`) keep only
  the two used (~1.7 MB) — and `react-native-paper` already requires
  `MaterialCommunityIcons`, so the real floor is Ionicons + MCI.

### 2.5 Startup, bundle, Hermes, JS thread

* Hermes is on (default for SDK 54; `expo export` produced a `.hbc`). Bundle:
  **2.87 MB** (`results/bundle-export.txt`). Attribution by source map
  ([`results/bundle-attribution.txt`](results/bundle-attribution.txt)): react-native
  38 %, react-native-paper 11.2 %, expo-router 6.6 %, app code (`app/ utils/ components/
  services/ hooks/`) ≈ 12 %, `@supabase/*` 5.9 % of which `@supabase/storage-js` 0.7 % is
  never used (no Storage calls in the app; `createClient` option to omit it does not exist
  in 2.39, so this is a note, not an action).
* Startup path: `app/_layout.tsx` awaits `ensureFreshSession()` (network) before rendering
  the first route, and `app/index.tsx` calls `ensureFreshSession()` again. On a cold start with
  a valid cached session this is one avoidable RTT before the first screen. The 12 s
  `withTimeout` means a dead network shows a blank screen for 12 s.
* JS thread hot spots: `scores` JSON parse (49 KB × 7 realtime echoes), `legacyGameFromServer`
  conversion for every reload, `listMyPlayers` serialising the full roster into
  AsyncStorage on every call (`services/players.ts`).

---

## 3. Code efficiency and bloat

### 3.1 Dead code and stray files

| item | detail |
|---|---|
| **expo-router copy at app root** | `_ctx*.js`, `entry.js`, `entry-classic.js`, `stack.js`, `tabs.js`, `drawer.js`, `head.js`, `html.js`, `server.js`, `rsc/`, `link/`, `node/`, `*.d.ts`, `testing-library.js`, `ui.js`, `_error.js`, `doctor.js`, `babel.js`, `version.js`, `update-version.js`, `_async-server-import.js`, `polyfills.js`, `expo-module.config.json` — byte-identical to `node_modules/expo-router/*`, added in c53b26a "Initial project setup". Nothing imports them; Metro ignores them, but they confuse tooling and reviewers. Delete. |
| 15 loose markdown files at app root | `AUTHENTICATION_SIMPLIFICATION.md`, `DATABASE_MIGRATION_GUIDE.md`, `FIXES_SUMMARY.md`, `GAME_TABLE_FIX.md`, `LANDSCAPE_*.md`, `PASSWORD_RESET_*.md`, `PLAYER_CREATION_FIXES.md`, `PROFILE_FEATURES.md`, … — move under `docs/history/` or delete. |
| Unreferenced modules | `hooks/useAuth.ts`, `components/DevTools.tsx`, `services/stats.ts`, `components/PlayerAvatar.tsx` (superseded by `SeatAvatar`). |
| Unused dependencies (`package.json`) | `react-native-vector-icons` (paper uses `@expo/vector-icons`), `expo-sms`, `react-dom` + `react-native-web` (web target is not shipped; `expo export --platform web` is unused), `expo-font` (no custom fonts loaded), `expo-linking` (only `Linking` from RN is used). Root `package.json` also declares `@expo/vector-icons ^14` which duplicates the app's. |
| `token_ledger` realtime channel | subscribed in `services/realtime.ts`, consumed nowhere. |

### 3.2 Duplicated logic

* **Dual "local mode"**: 115 `isSupabaseConfigured` branches across `services/`, `app/`,
  `hooks/` and `components/` (`games.ts` carries a parallel AsyncStorage implementation of
  nearly every method next to the network one, plus `demoSeed.ts`). Production builds always have Supabase configured
  (`validate-env` enforces it). Keep the demo/offline path behind one adapter interface
  or delete it; either way it should not be interleaved with the network code.
* Scores → rounds matrix conversion exists in `legacyGameFromServer` (`games.ts`) and
  again inline in `results/[id].tsx` (`withRounds`).
* `getCurrentPlayer()` call sites: 34 across `app/`, `components/`, `hooks/`, `services/`.
  Each one is a fresh `GET profiles`.
* `withTimeout` + `console.warn` boilerplate repeated per method instead of a wrapper
  around the PostgREST builder.

### 3.3 Oversized files

| file | lines | suggestion |
|---|---|---|
| `services/games.ts` | 1 024 | split into `games.read.ts`, `games.write.ts`, `games.local.ts`, `games.mappers.ts` |
| `app/(screens)/games/[id].tsx` | 588 | extract `useScorecard(gameId)` hook and totals selectors |
| `supabase/migrations/006_*.sql` | large single migration | fine as history; new RPCs go in new migrations |

### 3.4 Prioritized cleanup list

1. Delete the expo-router copies and stale root `.md`s (zero risk, pure noise).
2. Remove the four dead modules and the unused deps; `npm run typecheck` + tests prove it.
3. Memoise `getCurrentPlayer()` (one in-flight promise + 30 s TTL) — removes ~4 requests
   per Home focus with no behaviour change.
4. Remove the `token_ledger` subscription.
5. Split `services/games.ts`; move local-mode behind an adapter.

---

## 4. Architecture for scale

### 4.1 Caching (React-Query style)

PR 7's `gameCache` is a good last-known-value layer. What is missing is the
stale-while-revalidate and dedupe semantics that a query cache gives for free:

* key every read (`['game', id]`, `['home', userId]`, `['profile', userId]`) with
  `staleTime` so two screens mounting in the same second share one request (today
  score-entry and players each refetch what the scorecard just fetched);
* in-flight dedupe for `getCurrentPlayer`, `prefetchGame`, `listMyPlayers`;
* persist the cache (`@tanstack/query-async-storage-persister`) so cold start paints
  Home from disk — PR 7's cache is process-lifetime only.

`@tanstack/react-query` adds ~45 KB to the bundle. A hand-rolled 150-line version
(`Map<key,{data,updatedAt,promise}>` + `useQuery(key, fn)`) is also acceptable given the
small number of query types.

### 4.2 Optimistic updates

`addRound` already validates locally before `save_round`. Apply the round to the cached
game immediately (push `Round`, bump `currentRound`), render, then reconcile from the
RPC's returned round id / realtime. Undo (the `rounds.undone_at` update) same pattern. This makes "save"
feel instant on 4G and removes the 3-request refetch after save (the bundle RPC in 4.4
can return the fresh state in the same round-trip instead).

### 4.3 Realtime deltas

Short term (no schema change): subscribe to `rounds` and `games` only (not `scores`,
`game_players`, `token_ledger`), debounce `onChange` 300–500 ms, and ignore events whose
`commit_timestamp` is older than the last applied load. This alone turns 7 echo reloads
into 1.

Medium term: `realtime.broadcast_changes()` from an `after insert on rounds` trigger
sending `{game_id, round_number, scores:[…]}` to topic `game:<id>`; clients apply the
delta to the cached game with no REST call. Broadcast messages are authorised once per
channel join instead of per row, scale to many spectators, and `rls` on
`realtime.messages` keeps the per-game access check.

### 4.4 Combined RPCs

`get_game_bundle(game_id uuid) returns jsonb` — game row, seats with profile fields the
client uses, rounds with per-player values as arrays. Measured: **2.5 KB, 0.39 ms** vs
**53.2 KB across 4 requests** today. It also removes the per-row RLS cost on `scores`
because the function does one `is_game_member()` check up front (SECURITY DEFINER with the
same visibility rule as the policies). Same shape for Home: `get_home_bundle()` returning
profile + visible games + seat summaries + pending notices in one call (replaces 4 serial
RTTs with 1).

`save_round` can `return get_game_bundle(game_id)` so the write and the refresh share one
round-trip.

### 4.5 Pagination and Results

* Home already limits to 50; add `created_at < cursor` keyset pagination behind "Show
  more" and lower the default to 20 so the first paint is smaller.
* `results/index.tsx`: replace `listGamesForCurrentUser(includeScores) + N × listGamePlayers`
  with `list_result_candidates(limit, before)` returning `{game, seats, totals}` computed in
  SQL (measured 24.9 KB vs 1.37 MB + 50 requests).
* `results/[id].tsx`: `get_game_result` can embed the per-game rounds it needs; the current
  `getGame` per game ×2 is 6 requests per listed game.

### 4.6 Offline queue

Reads are covered by the cache. Writes (`save_round`, round undo, seat edits) should go
through a tiny persisted queue (AsyncStorage array of `{op, args, clientId}`) flushed on
reconnect; `save_round` already takes a round number so it is idempotent per
`(game_id, round_number)` if the RPC gets an `on conflict do nothing` guard. Flag as a
functionality change (conflict UX when two scorers are offline).

### 4.7 Connection pooling and Supabase Pro limits (verified against supabase.com/pricing and docs, Nov 2026)

| resource | Pro included | relevance |
|---|---|---|
| Compute | Micro: 1 GB RAM, 2-core shared; **60 direct / 200 pooler connections** | the app uses PostgREST only (pooled by PostgREST itself), so connection count is not a risk; CPU is — `list_visible_game_ids` at 0.5 s per call ×  users saturates a Micro quickly |
| Database disk | 8 GB included, then $0.125/GB-month | 290 MB per 1 000 active users → ~25 k active users before the included disk is exhausted; `scores` is 66 % of it |
| Egress | 250 GB/month, then $0.09/GB | today one scorecard open = 53 KB, a 20-round game with 5 watchers ≈ 20 × 7 echoes × 5 × 53 KB ≈ **37 MB per game**; with bundle RPC + debounce ≈ 20 × 5 × 2.5 KB ≈ 0.25 MB |
| Realtime | 500 peak connections, 5 M messages/month, 500 msg/s, 500 channel joins/s (10 k connections / 2 500 msg/s with spend cap off) | each device opens 5 channels today; 100 devices watching = 500 channel joins on reconnect bursts. Move to 1 channel per game |
| MAU | 100 k | not a constraint |
| Pro price | $25/month + usage | the egress line is the only one the current design can realistically blow through |

Recommended knobs: keep PostgREST (no direct connections from the app), set
`db.pool_size` only if Edge Functions are added, enable `pg_stat_statements` review monthly
(it is on by default in Supabase; the three RPCs above will top it).

---

## 5. Prioritized roadmap

Impact is on user-perceived latency / cost; effort is engineering scope; risk is regression
risk. ⚑ = changes behaviour a user could notice.

### Quick (single PR each, no app-code dependencies between them)

| # | item | impact | effort | risk |
|---|------|--------|--------|------|
| Q1 | New migration: rewrite `list_visible_game_ids`, `list_new_game_candidates`, `list_game_results_page` as index-driven unions; add the 3 missing indexes | **High** — Home DB time ~440 → ~8 ms, New game ~290 → 2 ms, Results ~125 → 8 ms | Low (SQL only, RPC signatures unchanged) | Low; verify with `tests/` RLS scripts. Email-branch removal would be ⚑ — keep it |
| Q2 | Wrap RLS helper calls in `(select …)` across `scores`, `rounds`, `game_players`, `games`, `profiles` policies | Medium — 2× on every row-level read | Low | Low (semantics identical) |
| Q3 | Debounce realtime `onChange` (400 ms) and drop `scores`/`game_players`/`token_ledger` channels | **High** — 28 → 4 requests per saved round per device | Low | Low; seat edits still arrive via `games.updated_at` bump or keep `game_players` channel |
| Q4 | Memoise `getCurrentPlayer()`; skip `refreshSession()` unless `expires_at - now < 5 min` | Medium — Home −1 RTT, −3 requests | Low | Low |
| Q5 | Seed `score-entry.tsx` from `gameCache.peekGame/peekSeats` like the scorecard does | Medium — no spinner on round entry | Low | Low |
| Q6 | Subpath icon imports; 256 px in-app logo | Medium — ~2.3 MB smaller APK, faster logo decode | Low | None |
| Q7 | Delete expo-router copies, stray `.md`s, dead modules, unused deps | Hygiene | Low | None |

### Medium

| # | item | impact | effort | risk |
|---|------|--------|--------|------|
| M1 | `get_game_bundle(game_id)` RPC + `getGame` uses it (keep legacy mapper) | **High** — scorecard 4 req/53 KB → 1 req/2.5 KB; removes `scores` RLS cost | Medium (SQL + `games.ts` read path + tests) | Medium; mapper must match `legacyGameFromServer` exactly |
| M2 | `get_home_bundle()` (profile + visible games + notices + claim requests) | High — Home 4 serial RTTs → 1 | Medium | Low |
| M3 | Results: `list_result_candidates` with server totals; `get_game_result` embeds rounds | High — 55 requests/1.4 MB → 1 request/25 KB | Medium | Low |
| M4 | Query cache with staleTime + in-flight dedupe + AsyncStorage persistence (extend `gameCache` or adopt react-query) | High — instant cold-start Home; no duplicate loads across screens | Medium | Medium (invalidation rules) |
| M5 | Memoise `ScoreTable` rows/cells, `useMemo` totals, native-driver animations, virtualised rounds | Medium — smoother scorecard on low-end Android | Medium | Low |
| M6 | Home `FlatList`, default page 20 with "Show more" ⚑ | Low–Medium | Low | Low |

### Large

| # | item | impact | effort | risk |
|---|------|--------|--------|------|
| L1 | Broadcast-based realtime deltas (`realtime.broadcast_changes` trigger on `rounds`; client applies delta) | High at scale — no REST echo, authorisation per channel | High (trigger, channel auth RLS, client reducer, fallback) | Medium |
| L2 | Optimistic round save/undo with `save_round` returning the bundle ⚑ (UI shows round before server ack) | High perceived speed | Medium–High | Medium (conflict handling) |
| L3 | Offline write queue ⚑ | Medium for the target market's connectivity | High | High (two-scorer conflicts) |
| L4 | Split `services/games.ts`, isolate local/demo mode behind an adapter | Maintainability | High | Medium |
| L5 | `scores` storage: store per-round values as a `jsonb`/array on `rounds` (or a materialised per-game totals table) ⚑ for exports | Cuts 66 % of disk growth and the largest table | High (migration of 2 M rows, export paths) | High |

Suggested order: Q1 → Q3 → Q4/Q5 → M1 → M2 → M3 → M4, with Q6/Q7 whenever convenient.
Q1 alone removes the largest measured cost (0.5 s of DB CPU per Home focus per user), and
Q3 removes the largest measured request volume.
