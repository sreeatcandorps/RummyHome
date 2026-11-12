# Rummy Home — Architecture & Timeline

**Purpose:** One living document for *what the system is*, *why each tool exists*, and *what changed over time*.  
**Not for:** Line-by-line code changelogs. Feature tweaks get one short line.

**How this file stays current:** Agents update the **Timeline** and **Current stack** sections whenever architecture, tooling, hosting, or major modules change. See `.cursor/rules/architecture-timeline.mdc`.

---

## The big picture (read this first)

You are **not** leaving Expo to go to Google Play.

| Layer | What it is | What you use it for |
| --- | --- | --- |
| **Expo (SDK)** | The app framework (React Native + tooling) | Writing the Rummy Home UI and logic once for Android (and later iOS) |
| **Expo Go** | A sandbox app on your phone | Fast **development** only — scan QR, try changes. Friends do **not** install the real product this way |
| **EAS (Expo Application Services)** | Expo’s cloud build + submit + OTA update service | Turn the project into a real Android `.aab`, upload to Play, later push JS fixes without a full rebuild |
| **EAS CLI** | Command-line tool (`npx eas-cli …`) | Talk to EAS from PowerShell: login, build, submit, env vars, updates |
| **Google Play Console** | Google’s store for Android apps | Where testers and later the public **install** Rummy Home |
| **Supabase** | Backend (auth + database + RLS) | Accounts, profiles, games, scores — the source of truth |

```
You write code (Expo app)
        ↓
EAS Build (cloud) packages a real Android app (.aab)
        ↓
EAS Submit / Play Console puts it on Google Play tracks
        ↓
Testers install from Play Store (not Expo Go)
        ↓
Optional: EAS Update pushes JS/UI fixes to those installs
```

**Expo Go** = temporary preview cable.  
**EAS + Play Store** = the real product distribution path.  
Same codebase either way.

---

## Current stack (as of 2026-10-28)

| Piece | Choice | Why |
| --- | --- | --- |
| App root | `rummy-home3/` | Expo Router mobile app |
| Framework | Expo SDK **54** | React Native 0.81 app toolchain |
| UI | React Native Paper (Material 3) | Android-familiar components |
| Share image | `react-native-view-shot` and `expo-sharing` | Scorecard picture, and the Results podium picture, for WhatsApp or a text. The web build draws the same card |
| Results PDF | `expo-print` and `expo-sharing` | Share full details prints HTML to a PDF on the phone and opens the share sheet. The web build downloads the same details |
| Backend | Supabase (Auth + Postgres + RLS) | Shared multi-user data without a custom server |
| My players | `my_players` in `007_redesign.sql` | Per-account roster. Home and New game do not read every profile |
| Public scorecard | `https://ezscore.mindweavetech.com/scorecard.html` | Static HTML. `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` are filled at publish time, not committed |
| Local cache | AsyncStorage | Offline/session helpers only — not the system of record |
| Repo | GitHub `sreeatcandorps/RummyHome`, branch `main` | Single mainline; no long-lived feature branches by choice |
| Cloud builds | EAS Build profiles: development / preview / production | Real store binaries |
| OTA | `expo-updates`, on for the production profile only (`EXPO_UPDATES_ENABLED` in `eas.json` → `app.config.js`). Preview/development APKs run their embedded JS | Fix JS during the 14-day test without new Play review every time; preview builds can't be replaced by a stale update |
| Version codes | `appVersionSource: "remote"` in `eas.json` | EAS tracks Android versionCode; no manual bumps in `app.json` |
| Secrets for builds | EAS Environment Variables (`EXPO_PUBLIC_SUPABASE_*`) | `.env.local` never reaches EAS builders |
| Privacy page | `docs/privacy-policy.html` (repo root) | Play Store requires a public privacy URL |
| Store listing draft | `docs/store-listing.md` | Copy/assets checklist for Play Console |

**Package id:** `com.rummyhome.app`  
**Display name:** Rummy Home  
**Expo slug:** `rummy-score` (Expo project name; phone still shows “Rummy Home”)  
**EAS project id:** `076b8018-c964-4819-8331-a65b913d15b6`  
**Expo owner account:** `mindweave` (CLI also has `sree-candorps`)  
**EAS CLI on this PC:** logged in (2026-08-18)  
**EAS env vars:** `EXPO_PUBLIC_SUPABASE_*` pushed to production / preview / development

---

## How the pieces fit (architecture)

### Client
- Expo Router screens under `app/`
- Services talk to Supabase (`services/auth`, `games`, `players`, …)
- Theme/UI helpers in `constants/`, `components/ui/`

### Backend
- Supabase Auth: email + passcode
- Tables: profiles, games, game_players, scores, etc. (see `supabase/migrations/`)
- RLS + security-definer helpers so creators/members can only touch their games

### Distribution path (Android)
1. Develop locally with Metro + Expo Go (optional)
2. `eas build --platform android --profile production` → signed `.aab` in the cloud
3. Upload to Play (manual or `eas submit`)
4. Internal test → Closed test (14-day gate for new personal accounts) → Production when allowed
5. JS-only fixes: `eas update --channel production …`

### What is *not* required for v1
- Leaving Expo / rewriting in “pure” Android
- Full marketing website or web app (privacy page is enough for store)
- iOS until Android closed test is running

---

## Expo account vs Google Play vs PowerShell (common confusion)

| Account | Purpose |
| --- | --- |
| **Expo account** (expo.dev) | Owns EAS projects, builds, env vars, updates |
| **Google Play Console** | Owns the store listing and tester installs |
| **Google login on expo.dev in a browser** | Creates/links your Expo account — does **not** automatically log in PowerShell |

**CLI login is separate.** On this machine you must run:

```powershell
cd C:\Users\koner\.cursor\RummyHome\rummy-home3
npx eas-cli login
```

Default is **browser login** (`-b`). That is the right path if you signed up with Google.  
You do **not** need to invent a new email/password unless you want one.

If the CLI asks for email/password, you likely hit the non-browser path or the browser step did not finish. Prefer:

```powershell
npx eas-cli login
# complete the browser window, then:
npx eas-cli whoami
```

Do **not** paste Expo passwords into chat. Username on Expo may look different from your Gmail; that is normal — check [expo.dev](https://expo.dev) → Account settings after browser login.

**Status 2026-08-18:** Browser `eas login` succeeded as `sree-candorps` / `sree@candorps.com`. Project linked; `update:configure` set `updates.url`; Supabase public env vars pushed via `npm run eas:env`.

---

## Timeline (architecture & tooling focused)

### Early product (pre–GitHub centralization)
- Expo app for home rummy scoring; lots of local/UI iteration.
- Supabase introduced for real accounts and shared games.
- Many early build notes live in older files (`TASK_LIST.md`, fix guides) — historical.

### 2026-07 — Make it a real shared project
- **GitHub** connected; work centered on `main`.
- **Supabase** wired with env vars; auth smoke tooling added.
- RLS hardened so game create / players / rounds work for normal users.
- Gameplay unlocked for all signed-in users (not admin-only).
- Automated tests expanded (unit + smoke / game-flow / nightly).

### 2026-07 — Product UX pass
- Material Design 3 theme + shared UI pieces (`Screen`, cards, list items).
- Game table, score entry, history, find-players, profile/player ID flows reworked.
- Player codes, rummy multi-winner split, expense-per-round amount, stake/pool tinting.

### 2026-08 — Store path (still Expo — adding distribution)
- Renamed display name to **Rummy Home**.
- Removed **expo-contacts** (avoid contact-book permission for Play review).
- Aligned Expo packages; added **expo-updates**.
- **eas.json** channels + environments for preview/production.
- Privacy policy HTML + Play setup docs + EAS env push script.
- Strategy: personal Play Console closed test for 14-day gate; D‑U‑N‑S/org account in parallel for later.

### 2026-08-19 — Stale JWT after Supabase pause
- Free-tier Supabase pause caused login/network failures; after restore, saved sessions hit `PGRST303 JWT issued at future`.
- Auth now refreshes or clears the local session and asks the user to sign in again (not a phone Date & Time toggle).

### 2026-10-07 — Visual redesign (no logic changes)
- One design system in `constants/theme.ts`: felt-green/cream brand palette, spacing/radius tokens, seat colours, and matching **light + dark** themes. The Settings dark-mode switch now actually applies the dark theme (`contexts/PreferencesContext.tsx`).
- Every screen restyled; scoreboard rebuilt around a sticky score table (`components/game/ScoreTable.tsx`) that stays readable with many players/rounds.
- Orientation stays unlocked (`"orientation": "default"`); short landscape screens get dedicated two-column / side-panel layouts and respect notch + nav-bar insets (`hooks/useLayout.ts`).

### 2026-10-27 — Friday game night (sharing, admins, prizes)
- Any account seated in a game, added as view-only, or keeping score sees that game. Game admins (the creator, plus people they promote on the scorecard) are the only ones who can enter or undo scores.
- Live scorecards are shared with an unguessable `view_token`. The public page is a Supabase Edge Function (`supabase/functions/scorecard`); email goes through `send-email` when a Resend key is set.
- Completed games can be grouped into a prize session (coins, not money). Apply `supabase/migrations/006_friday_game_night.sql` before using this on the APK. Passcode reset must use the GitHub Pages URL as the Supabase Site URL, or the email keeps pointing at localhost.

### 2026-10-28 — Redesign (Home, my players, Results, Pages scorecard)
- Three tabs: Home, Players, Me. History, the stat tiles, and the whole-directory player list are gone. A non-player admin is a `game_players` row with `seated = false`.
- Settle is hidden the same day. `EXPO_PUBLIC_SETTLE_ENABLED` is off. Results replaces it on Home: check finished games, then a page with the created time, positive and negative totals, one row per player (first name A–Z) with a column per game and a total, and 1st, 2nd, and 3rd place. Score columns follow the width on screen, with the name and the total staying put. Declare only if you admin every selected game. Apply `008_results.sql` after `007` before declare works on the live database. The `prize_sessions` tables stay unused.
- Scorecard and Results can be shared as an image (`react-native-view-shot` on the phone, the same card drawn for the web). Results also shares a PDF of the full table (`expo-print` `printToFileAsync` plus `expo-sharing`). The scorecard link stays as a second option. A game seats at most 20 players (a server guardrail since 029). One Results view holds at most 50.
- Public scorecard and the invite page are static HTML for GitHub Pages (`public/scorecard.html`, `public/get/index.html`), not the Supabase function URL. Apply `007_redesign.sql` after `006` before my players and unseated admins work on the live database.

### 2026-10-27 — Admin demo seed on Supabase
- Home-screen Load/Clear demo data is available in release builds only for an allowlisted admin email (`EXPO_PUBLIC_ADMIN_EMAILS`, default `koneru2k@gmail.com`, enforced again in `public.is_demo_admin()`).
- Sample players and games are tagged `is_demo` and written with the signed-in session through `apply_demo_seed` / `clear_demo_data`. Apply `supabase/migrations/005_demo_data.sql` before using it on the APK.

### 2026-10-07 — Pre-release hardening
- Removed the passwordless `/admin-login` dev route (local-mode backdoor); it no longer ships in any build.
- `eas.json` now sets `appVersionSource: "remote"`: EAS owns the Android versionCode (starts at 1, production `autoIncrement` bumps it). Expo SDK 54 patch versions aligned via `expo install --fix`.

### 2026-11-04 — Scorecard config and pending player migrations
- The public scorecard no longer asks anyone to paste an anon key into the file. `public/scorecard.html` keeps `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__`, and `scripts/inject-scorecard-config.mjs` writes a publishable copy. Real keys stay out of git.
- `011_player_identity.sql` and `012_player_numbers_and_claim_links.sql` are reviewed and safe to re-run. They are not applied from the app. Until they are, player sign-up shows a short message and New game still searches My players. See `docs/migrations-to-apply.md`.
- Scoring no longer has a table-cost column. Game defaults are Drop, Middle drop, and Full count (default -80), stored with the existing points settings.

### 2026-11-04 — Add round redesigned from the paper sketch
- Score entry is one screen again: G-number / round / start time / scorer header with a ⋮ menu, a two-column player grid, a Drop / Middle drop / Full count / Rummy row, an on-screen keypad with a +/- toggle (minus default), and a Balance + Save round bar. Multi-select players, then type or tap a preset. Rummy winners split the table's losses (remainder to the players tapped first). Moving to another player auto-saves. Save round unlocks only at Balance 0. No new dependencies; animations use React Native `Animated`.
- The rules live in `utils/roundEntry.ts` with their own node tests, separate from the screen.

### 2026-11-04 — Preview APKs stop reverting; version shown on Home
- Cause of "the phone goes back to an old version": `expo-updates` was on for every build with `runtimeVersion: appVersion` (always `1.0.0`) and the preview profile on the `preview` channel. Any update ever published to that channel matched every 1.0.0 preview APK, and with `checkAutomatically: ON_LOAD` + `fallbackToCacheTimeout: 0` the APK ran its own code on the first launch, downloaded the channel's latest update in the background, and ran that (older) code from the second launch on.
- Fix: `app.config.js` layers over `app.json` and turns `updates.enabled` on only when `EXPO_UPDATES_ENABLED=true`. `eas.json` sets it `false` for development and preview and `true` for production, so preview/development APKs always run the JavaScript built into them. The version is bumped to 1.1.0 (also a new runtime version), and preview builds `autoIncrement` so each APK has its own build number. Nothing was published.
- Home shows `v1.1.0 (build N)` next to the title (expo-application, falling back to the config in Expo Go / web) and Help adds the same plus whether the code is embedded or an OTA update. New dependency: `expo-application`.

### 2026-11-05 — Home, My players, New game reshaped from build 2 feedback; every help popup rewritten
- Home: Results (light yellow) sits above a Live card that lists every active game, then Recent with only Completed/Closed games (All or Last 10 days). My players: sort toggle in the header, two-column fixed-height grid with full names and a numeric "Player ID N" badge (letter codes are never shown), three plain buttons; the −/+ stepper is gone and the add-by-initials sheet opens with 3 rows. Find player in database marks people already on your list and sorts them last; from New game it is "Add player to new game" and seats them as well. No new dependencies, no schema changes.
- Numeric player IDs in the lists depend on migration `012` being applied; a database still on letter codes shows no badge.
- All help popups (`constants/help.ts`) are now short prose covering only what the screen cannot show.

### 2026-11-05 — Build 3 feedback: full-screen Add New Players, Profile redesign, closed games warn instead of block
- Add New Players by Initials is a dedicated stack screen (`players/add`), left only through Done; the add-by-initials sheet component is gone. Both My players and New game push it. Initials ending in a digit are refused inline (digits stay reserved for H2/H3 duplicate labels).
- Results: Closed games are listed and selectable again; a yellow warning says they were already counted. This is client-only — `declare_game_result` never rejected closed games, so no migration.
- Profile tab is avatar-only (the SK chip); the screen is "Profile". Phone has its own one-column save (`authService.updatePhone`) with inline Saved/error text. A "Which setting wins" ladder (Game settings > User settings > Game defaults) sits on Profile and on User settings.
- New game no longer pre-seats the creator; they are offered first and tap themselves to play. Home opens on Last 10 days; My players opens on Frequent and labels everyone Registered / Pending registration / Unregistered. No new dependencies, no schema changes.

### 2026-11-05 — Build 4 feedback: Edit round without a migration, Results defaults and warnings, names replace avatars
- Edit round (Scorecard ⋮ → Edit round → pick a round) reopens Add round pre-filled and saves through `gamesService.replaceRound`. On Supabase it retires the old `rounds` row (sets `undone_at`, moves `round_number` to 1000+n to dodge the unique index) and inserts a fresh row + scores, because clients have no update/delete on `scores`. Every reader already skips undone rounds, so no migration.
- Results opens on Completed with every completed game ticked; All adds Active and Closed. Two client-side warnings (active game used; game already in another result) show on the picker and on opened results. Clients cannot read `game_result_games`, so "already in another result" is a heuristic: a game whose `closed_at` predates the result by more than a minute. Deleting a past result needs a server RPC and is deferred.
- Player avatars are gone from lists; names show with bold first/last initials (`BoldName`). A shared in-memory draft (`newGameDraft`) keeps New game seats and the Add New Players strip in sync.
- Score-entry palette is final (beige / yellow / green / blue); `cellConfirmed` token removed. No new dependencies, no schema changes.

### 2026-11-07 — Nov 6 phone test, P1: results privacy and in-app passcode recovery
- Results privacy (P1-A): `013_results_privacy.sql` adds `can_see_game_result` and routes `get_game_result` / `list_game_results` / `list_game_results_page` through it (declarer, seated player, game creator/admin, app admin). Written and tested as text; **not applied** to the project from here. The client repeats the rule for the detail screen and the local store, but the paged list can only be fixed server-side.
- Passcode recovery (P1-B): no more browser reset page. Forgot passcode emails a 6-digit code (`resetPasswordForEmail` → `verifyOtp type=recovery` → `updateUser`) typed back in the app; Profile → Change passcode checks the current passcode and sets the new one in-app, with a reauthentication-nonce step if the project demands it. Depends on the Supabase "Reset Password" template including `{{ .Token }}` (`supabase/templates/recovery-passcode.html`) and digit-only password requirements — dashboard settings, not code. Flow logic lives in `utils/passcodeFlow.ts` behind an injectable client and was exercised in a browser against a local GoTrue fake; real email delivery was not tested from the build box.

### 2026-11-07 — Nov 6 phone test, P2: roles, scoring, complete-game flow, players page, Results
- Two more migrations are written as text and **not applied** from here: `014_save_round_atomic.sql` (`save_round` RPC: round + scores + `current_round` in one transaction, the cause of the blank round 6; the client falls back to a self-healing multi-step save when the RPC is missing) and `015_link_seat_to_player.sql` (`link_seat_to_player`: move an unregistered seat's game rows to a registered Player ID). `docs/migrations-to-apply.md` lists the order and the repair steps.
- Game flow split into pages instead of dialogs: Complete game (own page, second confirmation) → Final scores preview → share (yellow sheet, five square cells per row, started/generated/completed times, Game ID footer); Players in this game (own page: Creator/Admin/Player/View only tags, per-player menu for admin, edit name, invite, link to a Player ID). Admins can reopen a Completed game that is not Closed. Home Recent sorts by completion time (`completed_at` is now read by the client; the column already existed).
- Results: Completed / Closed / Active chips are multi-select; a game keeps its own number everywhere (`ResultSheetGame.label` is stored at declare time; older results show their code); every selected game is on the share image (games down the side past five) with a "Result ID · XXXXXX" footer on image and PDF; previews are marked "Preview · not saved" and never write. The web canvas now draws the same card as the native view (grid, crowns, legend, footer). No new dependencies.
- Verified in a browser (Expo web + local storage fixtures, puppeteer); Android/iOS not run from the build box — the native share-sheet crash fix (menu closes before the share Activity opens, remounts after) and `react-native-view-shot` capture of the new sheets need a phone pass.

### 2026-11-09 — Migrations 013–015 live; app-only passcode recovery (issue #8)
- Sree applied `013_results_privacy.sql`, `014_save_round_atomic.sql` and `015_link_seat_to_player.sql` to the production project by hand (all six functions verified). Auth is set to 6-digit email OTPs with a 15-minute expiry, minimum password length 6, and custom SMTP through Resend is live; recovery emails arrive with the code. The Supabase MCP connector stayed unauthenticated, so none of this was done from the agent.
- Recovery is now fully app-only: Forgot passcode has one visible numeric OTP box (number pad, OTP autofill, paste, clear, autofocus) and the recovery template carries only `{{ .Token }}` with no browser link, so the GitHub Pages redirect URLs are no longer needed. The passcode cells put the real input over the cells (the hidden opacity-0 input that needed a second tap on Android is gone). OTPs are exactly six digits on both the reset and change screens. `docs/CHECKLIST-NOV9.md` holds the screenshot-backed status of every P1/P2 item; APK not built yet.

### 2026-11-09 — Player picker rebuilt; mid-game add reuses it; seat removal rule (016)
- New game is one player per row (coloured avatar, bold-initial name, registration pill, Player ID — the same row as Players in this game) with a compact face strip on top; tapping a row or a face moves the person between list and strip with `LayoutAnimation` plus `Animated` entry effects (no new dependency; reanimated was not added). Players in this game → Add a player now opens the same screen in add mode (`/games/new?gameId=`): saved seats sit in the strip, new picks are staged and seated on **Return to game** through the existing `addSeatedPlayer` path (zeros for rounds already played).
- A seat can be removed only while every one of its round scores is exactly 0 (`utils/seatRemoval.ts`; the total is never checked). `016_remove_seat_if_no_scores.sql` enforces the same rule server-side (security definer, authenticated, game-admin only) and is the only way to delete a joiner's zero rows, since clients cannot delete `scores`. Written and scratch-verified, **not applied**; without it the app removes seats that have no rounds and shows "isn't available yet" otherwise.

### 2026-11-10 — Preview APK build 5 feedback: owner in own roster, menu remount, speed cache, link takeover (017)
- Two root causes from Sree's phone test. The organiser never saw himself in New game, Find player or My players because the server candidate RPCs exclude `auth.uid()` and the client sorted the stat-less self row last, past the ten-row page; the client now pins the organiser first (`pinOrganiser`, `withOwnerFirst`) and Find player offers **Add me**. The view-only scorecard ⋮ menu went dead because Paper's `Menu` keeps a stale `prevRendered` ref when it is dismissed before its open animation ends; `useMenuThenShare` now remounts the menu (key bump) on every close.
- A module-level stale-while-revalidate cache (`utils/gameCache.ts`) seeds the scorecard, roster and score entry from the last fetch and Home prefetches the first two live games; no new dependency. Optimistic round saves, realtime deltas and a single `get_game_bundle` RPC are the next steps, not done.
- `017_link_seat_takeover.sql` lets a non-playing admin or a viewer take an unregistered seat by Player ID (015 refused them); written and scratch-verified, **not applied**. Rollback restores the 015 body.

### 2026-11-10 — Batch 2: Results save flow (P1), banded share table, game admins (018)
- P1 root cause: Show results only *saved* when the person was admin of every selected game; Sree picked games from his test accounts, so the app silently showed a preview and `declare_game_result` (which closes games) never ran. Results now has an explicit **Save result** step: the picker lists every game the person is in (non-admin games visible but locked), Show results only shows, Save moves the games to Closed and lists the status changes, and Share is off until saved. A result that reuses a Closed game carries a warning icon everywhere it is listed.
- Share image and PDF: Player ID under each name; the by-game table is players × games in bands of five columns (G1–G5, then G6–G10 …) so twenty games still fit a phone-width picture. The on-screen table widens columns for long scores and large system fonts so a number never wraps.
- `018_results_reuse_and_player_ids.sql`: `get_game_result`/`list_game_results_page` add `reusedGameIds` and `playerNo`; read-only, scratch-verified, **not applied** (apply 017 then 018). The app falls back to reading the games when the fields are absent.
- Home Recent lost its Last 10 days / All filter (every finished game, newest first). The scorecard's Players page is **Players/Admins** with Add admin by Player ID (non-player admin; open or completed games only); Game admins are listed on Complete game and the final-scores picture. A slow roster load now offers Retry instead of "Game not available".

### 2026-11-11 — CI merged into PR 7; migration 019 fixes the four bugs CI found
- PR 9's testing setup now lives on the PR 7 branch: GitHub Actions `ci.yml` (unit tests + tsc, a throw-away local Supabase with every migration from empty, rollback replay, pgTAP, two-client concurrency, one Markdown report per run), `supabase/config.toml`, the multi-user `seed.sql`, `supabase/tests/`, `ci/` scripts and `docs/testing/`. Nothing in CI touches the hosted project.
- `019_security_and_concurrency_fixes.sql` (+ rollback), **not applied**, apply after 017 and 018: (a) a trigger stops a user setting their own `profiles.role` to `app_admin`; (b) `SELECT` on profiles is granted per column so email/phone/zip are the owner's only, read through the new `my_profile` view (the app names its columns now; `select *` on profiles is refused); (c) `save_round` serialises writers per game with an advisory lock and answers a losing race with `PT409` + a plain sentence the app shows before refreshing; (d) `remove_seat_if_no_scores` takes the same lock and `save_round` refuses a player who left, so no orphan 0 row. The tests that recorded these as known failures are hard assertions now (265 unit, 192 pgTAP, 31 concurrency, 39 rollback checks).

### 2026-11-11 — Performance pass (migration 020 + client), from the PR 10 research
- The PR 10 review (`docs/performance/README.md`) is built: `020_performance_rpcs_and_indexes.sql` (+ rollback), **not applied**, apply after 019. The three visibility RPCs become index lookups (0.5 s → ~2–8 ms at 30 k games), the row policies hoist their helper calls, and three bundle RPCs (`get_game_bundle`, `get_home_bundle`, `list_result_candidates`) plus `rounds` inside `get_game_result` make Home, scorecard, round entry and Results one request each. The app tries each new RPC once and falls back to the pre-020 requests on `PGRST202`, so it runs on either database.
- Client: `utils/queryCache.ts` (in-flight dedupe, staleness window, opt-in persistence) under the game bundle, the own profile (60 s) and My Players (30 s); session refresh only near expiry; realtime debounced to one reload per save over three tables; Home Recent list through a `FlatList`; memoised `ScoreTable` rows; round entry seeded from the cache. Bundle: icon subpath imports and a 320 px in-app logo cut exported JS+assets from 7.8 MB to 4.5 MB; the expo-router copies at the package root, 14 stale root docs, four dead modules and `expo-sms` / `react-native-vector-icons` are gone. No visible UI or behaviour change. Numbers: `docs/performance/RESULTS.md`. Tests: 290 unit, 253 pgTAP, 31 concurrency, 47 rollback checks.

### 2026-11-11 — Email uniqueness (021) and scorecard initials per owner (022)
- `021_email_uniqueness.sql` (+ rollback), **not applied**: emails normalised on write, one profile per email in any case, duplicates reported never deleted. App side: a repeat sign-up is refused with "An account with this email already exists".
- `022_player_initials.sql` (+ rollback), **not applied**, apply after 021: the scorecard letters belong to the owner's My players (`my_players.initials`, unique per owner, two letters then three letters from the name, never a digit unless letters run out; owner may type 2–3 letters) and are fixed per seat when a game is created (`game_players.label`, returned by the bundles). Lists always show the live profile name; a rename never changes initials — the app shows a "Name changed" note instead. New screens: Fix initials before Start game / Return to game, Edit initials in My players and in Players · Admins. The per-scorecard recompute (S2 in one game, SK in another) is gone. Tests: 319 unit, 328 pgTAP, 31 concurrency, 62 rollback checks.

### 2026-11-12 — Hide and soft delete (023), item 1 of the Nov 11 10:59 PM batch
- `023_hide_and_soft_delete.sql` (+ rollback), **not applied**, apply after 022: per-user Hide (Home only), soft Delete game (creator/admin; removed from saved results, which are totalled again; restore never re-adds), soft Delete result (declarer/admins; its games uncounted again). Enforced in the row policy and every reader RPC, including the public scorecard. App: scorecard ⋮ Hide / Delete with the "in result R3" warning, result ⋮ Delete result, Settings > Hidden & deleted (Unhide / Restore), "This game/result was deleted" states, local-store parity. Tests: 399 pgTAP, 31 concurrency, 70 rollback checks.

### 2026-11-12 — Emails and public results page (024), item 3 of the batch
- `024_emails_and_public_results.sql` (+ rollback), **not applied**, apply after 023: two email preferences on `profiles` (both on), an unsubscribe token, and an idempotent `email_outbox` the database fills (one row per event and recipient) for **game started** (live scorecard link) and **result saved** (link to the new public page); no game-completed email. The existing `send-email` edge function gains a `flush` action that delivers unsent rows through Resend (`scores@mindweavetech.com`) with the row key as the Idempotency-Key; the app triggers it after Start game and Save result and never blocks on it. New static pages on the share site: `/r/<result id>` (read-only saved result from `public_result(uuid)`, "This result was deleted" state) and `/unsubscribe.html`; `404.html` rewrites the pretty path on GitHub Pages. App: co-admin nudge at Start game (one-tap pick, skippable), Profile > Email checkboxes. Tests: 448 pgTAP, 31 concurrency, 77 rollback checks.

### 2026-11-12 — Unified player menu and Link to Player ID (025), item 5 of the batch
- One ⋮ menu per player on the game's Players · Admins page and on My players (Invite to register · Link to Player ID · Edit initials · Edit name · Make/Remove admin · Remove from game / Remove from My players), built from one model (`utils/gamePlayers`). The Register players popup (scorecard ⋮ and My players) and the Unregistered filter chip are gone; the third My players tile shows the unregistered count and filters the list; the list is one row per player.
- `025_link_player_to_account.sql` (+ rollback), **not applied**, apply after 024. Amended Nov 12 to Sree's spec: the admin types the Player ID only and sends a **request**; the account owner says Yes or No by email (024 outbox → new public page `public/link.html`, works signed out by token) or on Home. Nothing moves until Yes; the conflict check runs again then; the row reads Link pending; requests expire in 7 days and can be cancelled. The conflict sentence names each blocking game with its G-number, full game ID and creator. After Yes the admin gets a one-time pop-up "Harish (HG) is now linked to #40." Tests: 588 pgTAP (95 for 025), 31 concurrency, 91 rollback checks. Pages deploy gains `dist/link.html`.

### 2026-11-12 — Google Play requirements (026), item 6 of the batch
- In-app account deletion: Profile › Account › Delete account, one tick, then `delete_my_account()` (026, **not applied**, apply after 025) anonymises the profile server-side and removes the auth user. Seats and scores with other people stay under the name as an unregistered player; lone games are soft-deleted; orphaned games get the next registered seat as admin. The dashboard "delete user" now does the same cleanup instead of failing on foreign keys. Tests: 529 pgTAP, 31 concurrency, 89 rollback checks.
- Public pages on the share site, static and key-free: `/privacy` (policy: email, name, Player ID, optional phone/postal code, games and scores; Supabase ca-central-1; Resend; no ads, no analytics; TLS) and `/delete-account` (in-app steps, email path, and the same deleted/kept lists as the app, from `utils/accountDeletion.ts`). Contact `support@mindweavetech.com`.
- Version label never says "dev" any more: `v1.1.0 (build 7)`, or `v1.1.0` when the build number cannot be read, or nothing.

### Now
- Play Console personal account under Google verification (~days).
- EAS side ready to build once Play app exists / you’re ready to upload.

---

## Module status (short)

| Area | Status |
| --- | --- |
| Auth (email/passcode, session refresh, app-only OTP recovery) | Done in the app; OTP email live via Resend since Nov 9. Phone pass pending |
| Profiles / Player ID + share | Done |
| Find players (name, player ID, exact email, +) | Done; needs `007` on the live database. From New game it also seats the player |
| New game (points, my players) | Done. Creator is not pre-seated; big animated Playing · N; Add players (full screen) / Add player from database. Stored type is still the points game |
| Game table + score entry | Done, portrait + landscape. Add round: grid, presets, keypad, Balance gate, explicit 0, big losses in red. Complete game, Final scores, and Players are their own pages. Apply `014_save_round_atomic.sql` for the one-transaction save |
| Home | Done. Results → every live game → Recent (every Completed/Closed game, newest first, no filter). History screen redirects home |
| Results | Done in the app. Status chips (with deselect warning), every game listed and admin-only ticks, Show results then explicit Save result (closes games, status popup), share after save, totals and table with Player IDs, banded share image, full-details PDF. `008` and `013` are live; `018_results_reuse_and_player_ids.sql` (reused flag, Player IDs) is written, not applied |
| Security / concurrency (019) | `019_security_and_concurrency_fixes.sql` written, scratch-verified, **not applied**: role lock, owner-only contact columns + `my_profile`, per-game lock in `save_round` / `remove_seat_if_no_scores`, `PT409` conflicts. App handles both pre- and post-019 databases |
| Performance (020) | `020_performance_rpcs_and_indexes.sql` written, scratch-verified, **not applied**: index-driven visibility RPCs, policy wrappers, bundle RPCs. App works on both pre- and post-020 databases; see `docs/performance/RESULTS.md` |
| CI (GitHub Actions) | Done on PR 7: unit + tsc, local Supabase DB suite (migrations, rollbacks, pgTAP, concurrency), report per run. Nightly rows start once `ci.yml` is on `main`. See `docs/testing/ci.md` |
| Game admins | Done in the app. Players/Admins page: Add admin by Player ID (non-player, open or completed games), Game admins on Complete game and the final-scores picture |
| Settle / prize sessions | Hidden. Flag off. Tables and screens kept, not shown |
| Theming (light/dark) | Done; dark mode is on Profile and saved on the phone |
| Supabase schema + RLS helpers | Apply `006`, then `007_redesign.sql`, then `008_results.sql`. `005` only if you use demo data |
| Public scorecard | Static HTML on ezscore.mindweavetech.com. Placeholders filled by `scripts/inject-scorecard-config.mjs` at publish time. The key is not in git |
| Expo Go local preview | Working |
| EAS project linked on this PC | Done |
| EAS env vars for Supabase | Done |
| Play Console listing + closed test | **Waiting** on Google verification |
| iOS App Store | Not started (same Expo app later) |
| Full website / web app | Not required for v1 (privacy page only) |

---

## Commands cheat sheet

```powershell
# Confirm Expo/EAS login
npx eas-cli whoami

# Link project + OTA config (once logged in)
npx eas-cli init
npx eas-cli update:configure

# Push Supabase public keys into EAS
npm run eas:env

# Real Android store binary
npx eas-cli build --platform android --profile production

# Upload to Play (after Console app exists + service account optional)
npx eas-cli submit --platform android

# JS fix to testers without a new native build
npx eas-cli update --channel production --message "short note" --environment production
```

More detail: `docs/play-store-setup.md`, `docs/release-checklist.md`.

---

## Related docs

| Doc | Use |
| --- | --- |
| `docs/play-store-setup.md` | Step checklist for EAS + privacy URL |
| `docs/release-checklist.md` | Pre-build smoke tests |
| `docs/product-contract.md` | Product rules (scoring, roles, limits) |
| `docs/friday-setup.md` | SQL, Site URL, scorecard function, Resend |
| `docs/testing-strategy.md` | Unit, RLS, roles, Friday checklist |
| `docs/store-listing.md` (repo root `docs/`) | Play listing copy |
| `docs/privacy-policy.html` (repo root) | Hosted privacy page |
| `TASK_LIST.md` | Older feature backlog (partially stale) |

---

## Maintenance rule for agents

When you change **tooling, hosting, SDK major/minor, backend provider, store path, or finish a major module**, add a short Timeline bullet and update **Current stack** / **Module status**. Skip noisy UI-only tweaks unless they change architecture.
