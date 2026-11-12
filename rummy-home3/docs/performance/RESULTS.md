# Performance work: before / after (Nov 11, 2026)

What was built from [README.md §5](README.md#5-prioritized-roadmap): Q1–Q7 and M1–M6, plus
the My Players screen. L1–L5 were not done. Nothing a user sees changed: same screens,
same order, same text; the Home list still shows every live game and then the full Recent
section.

Database side: one migration, [`supabase/migrations/020_performance_rpcs_and_indexes.sql`](../../supabase/migrations/020_performance_rpcs_and_indexes.sql),
with its rollback [`supabase/rollback/rollback_020_performance_rpcs_and_indexes.sql`](../../supabase/rollback/rollback_020_performance_rpcs_and_indexes.sql).
The app works on a database with or without 020: each new RPC is tried once and a
`PGRST202` answer switches that session back to the pre-020 request sequence
([`results/after/client-requests-pre020-fallback.txt`](results/after/client-requests-pre020-fallback.txt)).

How the numbers were taken is unchanged from the research: a local Postgres 16 with the
repo migrations and the 2 000-user / 30 000-game seed, `EXPLAIN ANALYZE` as the
`authenticated` role for `user1@example.com` (`before` = migrations 001–019, `after` =
same database plus 020), and the real `services/*.ts` replayed in Node with `fetch`
intercepted ([`bench/harness/count-requests.mjs`](bench/harness/count-requests.mjs)).
Raw outputs: [`results/before/`](results/before/) and [`results/after/`](results/after/).

## In plain words, per screen

| Screen | Before | After (020 applied) |
|---|---|---|
| **Home** (focus, 2 live games) | 17 requests, 4 in a row before anything new can paint; the visibility RPC alone 550 ms of database time, the games list 510 ms | **3 requests, 1 in a row** (`get_home_bundle`, then the two live-game prefetches); **8.5 ms** of database time for the whole bundle (72 KB for 50 games) |
| **Save a round** | 4 requests (save + 3 to refetch), 4.6 ms database | **2 requests** (save + 1 bundle refetch), 4.1 ms database; the scorecard then reloads **once** per save instead of 7 times (realtime echo 32 requests → 2) |
| **Scorecard open** | 4 requests, ~53 KB for a 25-round 6-seat game | **1 request, 4.6 KB**, 2.6 ms database. Round entry opens with the grid already drawn from the cache |
| **Results** (picker, 12 visible games) | 17 requests, 5 in a row; every score of every visible game downloaded (1.37 MB at 50 games); list RPC 180 ms | **2 requests, 2 in a row**; totals computed on the server (126 KB at 50 games, 13.8 ms); list RPC 7.8 ms. The result sheet gets its rounds inside `get_game_result` instead of 3 requests per game |
| **My Players** (tab open) | 7 requests, 4 in a row (profile fetched twice, roster fetched twice, the offline roster copy rewritten on every open, sort/filter re-run on every keystroke) | **2 requests, 1 in a row** (the unregistered set and the claim card); profile and roster come from the 60 s / 30 s memo shared with the tab bar; the roster file is written only when the list changed; search/sort/filter memoised and tiles memoised |

Database time per RPC (ms, local Postgres 16, 30 k games, as `user1`):

| RPC / query | before | after |
|---|---|---|
| `list_visible_game_ids()` | 549.8 | **1.6** |
| Home games + seats embed (`in(<visible ids>)`, limit 50) | 509.9 | **6.2** |
| `list_new_game_candidates(100)` | 337.9 | **3.2** |
| `list_game_results_page(5, 0)` | 180.4 | **7.8** |
| `scores` select for one game (RLS) | 1.8 | 0.8 |
| `get_game_result(id)` (+ embedded rounds after) | 7.7 | 7.5 |
| `save_round` (rolled back) | 4.6 | 4.1 |
| `get_game_bundle(id)` | — | 2.6 (4.6 KB) |
| `get_home_bundle(50)` | — | 8.5 (72 KB) |
| `list_result_candidates(50)` | — | 13.8 (126 KB) |
| `list_my_players()` / `list_my_unregistered_players()` / `list_claim_requests()` | 0.8 / 1.2 / 0.3 | 0.7 / 1.1 / 0.3 (already fast; My Players was slow on the client) |

HTTP requests per screen, from the harness
([before](results/before/client-requests.txt), [after](results/after/client-requests.txt)):

| Screen / action | before | after | after, database without 020 (fallback) |
|---|---|---|---|
| Home focus | 17 req / 4 serial | **3 / 1** | 17 / 3 |
| Scorecard open | 4 / 1 | **1 / 1** | 4 / 1 |
| Round entry open | 5 / 1 | **1 / 1** (grid seeded from cache) | 4 / 1 |
| Game players page | 5 / 1 | **1 / 1** | 4 / 1 |
| Save round | 4 / 2 | **2 / 2** | 4 / 2 |
| Realtime echo after one save (5 seats) | 32 | **2** | 8 |
| My Players tab | 7 / 4 | **2 / 1** | 2 / 1 |
| Results picker (12 games) | 17 / 5 | **2 / 2** | 17 / 4 |

The fallback column also shows the one extra `PGRST202` probe per new RPC the first time
it is tried in a session; after that the session uses the old requests only.

## App bundle (`expo export --platform android`, Hermes)

| | before | after | change |
|---|---|---|---|
| JS bundle (`.hbc`) | 2 886 192 B (2.75 MiB) | 2 744 956 B (2.62 MiB) | **−141 KB (−4.9 %)** |
| Bundled assets | 4 925 579 B (4.70 MiB), 44 files | 1 792 725 B (1.71 MiB), 27 files | **−3.13 MB (−64 %)** |
| of which icon fonts (`.ttf`) | 4 076 840 B (15 fonts) | 1 697 384 B (2 fonts: MaterialCommunityIcons, Ionicons) | −2.38 MB |
| of which images (`.png`) | 849 716 B | 96 318 B | −753 KB |
| **JS + assets** | **7.81 MB** | **4.54 MB** | **−3.27 MB (−42 %)** |

No APK was built (per the rules). The APK carries these files compressed, so the installed
size drop will be smaller than 3.27 MB (fonts compress roughly 2:1; the PNG was already
compressed) — expect roughly 1.5–2.5 MB off the APK, plus whatever the two removed native
modules (`expo-sms`, `react-native-vector-icons`) contributed. The launcher icon is still
the 1024 px `assets/icon.png`; only the in-app logo moved to the 320 px `assets/icon-small.png`.

## What each item became

| # | Item | Where |
|---|---|---|
| Q1 | Index-driven `list_visible_game_ids`, `list_new_game_candidates`, `list_game_results_page` (email-match branch kept) + indexes on `game_results(declared_by)`, `player_links(owner_id) where pending`, `creator_notices(owner_id) where open`, `profiles(lower(email))` | 020 §A–B |
| Q2 | `(select …)` wrappers on the `games`, `game_players`, `rounds`, `scores` policies | 020 §C |
| Q3 | One scorecard reload per 400 ms burst; channel follows `games`, `game_players`, `rounds` only (no `scores`, no `token_ledger`) | `services/realtime.ts`, `utils/debounce.ts` |
| Q4 | Own profile memoised 60 s (every write/sign-out forgets it); `ensureFreshSession` refreshes only within 5 min of expiry | `services/auth.ts`, `utils/sessionFreshness.ts` |
| Q5 | Round entry seeds game, seats and (in edit mode) the cells from `gameCache` | `app/(screens)/score-entry.tsx` |
| Q6 | `@expo/vector-icons/Ionicons` and `/MaterialCommunityIcons` subpath imports; 320 px in-app logo | `app/(tabs)/_layout.tsx`, `components/share/ShareCardView.tsx`, `assets/icon-small.png` |
| Q7 | Removed the expo-router copies at the package root, 14 stale root `.md` files, `hooks/useAuth.ts`, `components/DevTools.tsx`, `services/stats.ts`, `components/PlayerAvatar.tsx`, `expo-sms`, `react-native-vector-icons` | — |
| M1 | `get_game_bundle(game_id)`; `getGame`, `listGamePlayers`, `prefetchGame` share one in-flight request per game | 020 §D, `services/games.ts` |
| M2 | `get_home_bundle(limit)`: profile, visible games with seats, notices (taken), claim requests, My Players | 020 §D, `services/home.ts` |
| M3 | `list_result_candidates(limit)` with server totals; `get_game_result` embeds `rounds` per sheet game | 020 §D, `services/games.ts`, `services/results.ts` |
| M4 | `utils/queryCache.ts`: in-flight dedupe, staleness window, opt-in AsyncStorage persistence; used for the game bundle, own profile and My Players | `utils/queryCache.ts` |
| M5 | `ScoreTable` rows memoised by value (`ScoreRow`) | `components/game/ScoreTable.tsx` |
| M6 | Home draws the Recent rows through a `FlatList` (`ScreenList`); the Recent card is split into head / rows / closing edge so it looks like one card. All live games, then all finished games; no paging, no new filter | `app/(tabs)/index.tsx`, `components/ui/Screen.tsx`, `components/ui/SectionCard.tsx` |
| My Players | Parallel loads, shared memo with the tab bar, roster write only on change, memoised list and tiles | `app/(tabs)/players.tsx`, `services/players.ts` |

## Tests

* `supabase/tests/10_bundles_020.sql` — 61 pgTAP checks: outsiders get nothing, seated
  players / spectator seats / creators / app admins get exactly what the table policies
  allow, bundles carry no `email`, `phone` or `zip_code`, `get_home_bundle` equals
  `list_visible_game_ids ∩ games policy`, server totals equal the client sums, the
  `rounds` embed matches the `getGame` arrays, email-match seats still list, anon is refused.
* `ci/db/replay-rollbacks.sh` — rolls 020 back (bundles and indexes gone, 019 intact) and
  re-applies it.
* `tests/performance-020.test.ts` — query cache, bundle mappers, session freshness,
  debounce, and source checks that the screens use the new paths with fallbacks.
