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
| Share image | `react-native-view-shot` and `expo-sharing` | Scorecard picture, and the one-page Results card (ranked scores with medals, generator initials, link), for WhatsApp or a text. The web build draws the same card |
| Results PDF | `expo-print` and `expo-sharing` | Share full details prints phone-sized HTML pages (390 × 780) to a PDF on the phone and opens the share sheet; a single game's rounds go the same way. The web build downloads the same details |
| Backend | Supabase (Auth + Postgres + RLS); live project plus **`ezscore-staging`** (Nov 21, same region, migrations only, seeded population, no real people) | Shared multi-user data without a custom server; staging takes the volume tests and the staging APK |
| My players | `my_players` in `007_redesign.sql` | Per-account roster. Home and New game do not read every profile |
| Scheduled DB job | **pg_cron** (Supabase extension), enabled on live Nov 15. The 045 job `purge-deleted-games` was **unscheduled the same day** (0 jobs) after Sree's rule that the app never permanently deletes games or results. PR 22 / migration 046 (written, not applied) replaces it with `archive-deleted-games` → `archive_deleted_games()`, 03:15 UTC nightly, non-destructive (`games.archived_at`) | Live has no scheduled job until 046 is applied; `purge_deleted_games()` exists there but nothing calls it |
| Public scorecard | `https://ezscore.mindweavetech.com/scorecard.html` — Cloudflare Worker `ezscore-site`, deployed by `publish-site.yml` on merge to `main` (Nov 23) | Static HTML inlined in one Worker. `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` are filled at publish time, not committed |
| Local cache | AsyncStorage | Offline/session helpers only — not the system of record |
| Tutorials | `components/tutorial/StepsSheet.tsx` + `expo-haptics` (D61, Nov 20) | Step-by-step sheets drawn from the real components (no video / Lottie); seen-flags on `profiles.default_settings`; the light tap on the real last tap of the Order of players |
| Repo | GitHub `sreeatcandorps/RummyHome`, branch `main` | Single mainline; no long-lived feature branches by choice |
| Cloud builds | EAS Build profiles: development / preview / staging (EZ Score · Staging, `.staging` package, points at `ezscore-staging`) / production | Real store binaries |
| Device UI tests | Maestro + `reactivecircus/android-emulator-runner` in GitHub Actions (`ci/ui/`, `rummy-home3/e2e/`); five emulator rows (Pixel 6 · 4a · 7 Pro at font 1.3 · Tablet · 4a at 360 dp with font 1.3), six suites, `adb monkey`, two-emulator races; dashboard on the `gh-pages` branch (GitHub Pages) | Flows on the real APK, screenshots and videos of every run, bugs filed as issues; no EAS credits, no production data, $0 on the public repo |
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
- Add New Players by Initials is a dedicated stack screen (`players/add`), left only through Done; the add-by-initials sheet component is gone. Both My players and New game push it. Initials ending in a digit were refused inline at the time (PR 6 on Nov 13 allows them; only the first character must be a letter).
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

### 2026-11-12 — Final launch batch (027–032) and volume testing
- `027` Remove from My players (soft remove, Undo), `028` game numbers S/P in place of the UUID (race-safe server assignment, backfill), `029` server-enforced guardrails (`docs/guardrails.md`), `030` My players at scale (paged list, server search), `031` round-robin rotation from the stored dealers, `032` two results-speed fixes. All **not applied**, each with a rollback and pgTAP file; apply order in `docs/migrations-to-apply.md`.
- New CI tooling: `ci/volume/` — `volume.sql` seeds deterministic users, rosters (100 / 1,000 / 10,000) and games (2–20 players × 50–500 rounds, 100 / 1,000 / 5,000 per user) on the local DB; `run-volume.mjs` runs every case as the real user through the RPCs with timings and writes `ci/out/volume/results.{md,json}`; `screenshots.mjs` renders the web `/r/` pages from those payloads in headless Chrome. Findings and fixes in `docs/volume-testing.md` (JIT on `public_result`, `game_rounds_json` rewrite, stale statistics after bulk loads). Tests: 812 pgTAP, 38 concurrency, 124 rollback checks.

### 2026-11-12 — Clubhouse green design system applied (PR 11 round 2, approved)
- The design proposal in `docs/design/` (branch `cursor/design-review-proposal-6470`) is now the app: Clubhouse palette in `constants/theme.ts` (light and dark, button green with a pressable edge, marigold accent, info blue, win/loss tints, seat colours), one button standard (`components/ui/AppButton` wraps Paper's Button: pill, 2 px outline or filled with edge), 32 px tags, pill bottom tabs (custom `tabBar`), scorecard with G badge, tinted dealer column, signed near-black totals and the Creator/Admin footer inside the table card. Role tags: plain players see Creator (and You); creators/admins also see Admin. No new dependency; Paper's MDI icons replace Ionicons in the tab layout.
- Appearance follows the phone by default (`userInterfaceStyle: automatic`, Profile › Appearance: Phone / Light / Dark; the old Dark mode switch value is honoured).
- Skipped on freeze day, by choice: the Nunito font (new native asset), confetti (new dependency), and the share image / PDF palette (still the parchment-and-felt card).

### 2026-11-13 — Device UI testing in CI (PR 1 of the Nov 12 feedback plan)
- New CI jobs `ui-smoke` (every push/PR, blocking) and `ui-full` (nightly + on demand): the app is built on the runner with `expo prebuild` + Gradle `assembleRelease` (debug keystore, one ABI), bundled against the throw-away local Supabase (`10.0.2.2:54321`, `seed.sql` + new `supabase/seed-e2e.sql` fixtures), and driven on a Pixel 6 / API 34 emulator (`reactivecircus/android-emulator-runner`, KVM, cached AVD snapshot) by Maestro flows in `rummy-home3/e2e/` (`smoke/`, `full/`, `known-bugs/`, shared `lib/`). Runner scripts in `ci/ui/`; screenshots and a gallery (`ui/index.html`) in the `ui-screenshots-*` artifact, a table in the job summary and a PR comment. The nine never-run flows with the wrong `appId` are replaced. No app behaviour change beyond three `testID`s (login fields, game cards). The full testing matrix (journeys × U/D/C/S/N/M) is in `docs/testing-strategy.md`.
- Known-bug flows for PR 2 (undo → add round), PR 3 (rummy with a positive pot), PR 6 (initials clash → HT2) and PR 8 (0 players in a saved result) are quarantined until their PR lands.

### 2026-11-13 — Results design (PR 8) and migration 034
- One layout model for the result (`utils/resultsDesign.ts`) feeds the app screen, the share image, the PDF and the public `/r/` page: ranked scores split (positives with medals, negatives closest to zero first), the games across in bordered bands of five with Player and Total fixed on the left, a legend, and "Games in this result" (time bold, date, players · rounds · Game ID, creator and admins). The share image is summary-only with the generator's initials; the PDF prints phone-sized pages (390 × 780, 16 px) through `expo-print`; the web page and the PDF share `RESULTS_DESIGN_CSS` byte for byte (a unit test enforces it). Single-game Final scores now share the same standings card and offer the rounds as a second PDF; the web scorecard shows blocks of five players with totals in the head.
- `034_results_design.sql` (written, **not applied**; Build Bot applies after CI): `declare_game_result` builds standings from seated `game_players` left-joined to scores, so a completed game with no rounds yields its players at 0 instead of "0 players"; a `result_versions` table with triggers snapshots a result when saved and when one of its games is deleted; `public_result(uuid, integer)` returns the version list, creator/admins/round count per game and the deleted state so the page can show "edited after it was saved" and older versions. Rollback and pgTAP file 24 included; the full local DB suite is green (928 pgTAP, 134 rollback checks, 38 race checks).

### 2026-11-13 — Undo then Add round (PR 2) and migration 035
- `035_undo_round.sql` (written, **not applied**; Build Bot applies after CI): the rounds unique key becomes a partial index over live rounds only, so an undone round no longer blocks saving that number again (the Nov 12 "Round already saved by someone else" dead end); new `undo_last_round` RPC does the undo and the `current_round` step-back in one locked server call; `save_round` names the admin who saved a colliding round and refuses a number past the last live round after an undo. The app undoes through the RPC with a fallback for older databases, and a raw unique violation is no longer blamed on another admin. The quarantined `known-bugs/pr2` flow is now `smoke/13`.

### 2026-11-13 — Game and result logs (Logs PR) and migration 036
- `036_event_log.sql` (written, **not applied**; Build Bot applies after CI): one append-only `event_log` table written only on the server (triggers on games / players / rounds / profiles / results, `save_round` now security definer, new `create_game` and `add_seated_player` RPCs) inside the same transaction as the change, so every round added / edited / undone, player or admin change, settings change, status change and result save / delete / restore is on record with the actor's name. Direct `insert`/`delete` on `rounds` and `scores` are revoked from clients; UPDATE stays so the shipped APK's Undo keeps working. Rows reach the app live through the realtime publication. Readers: `list_game_log` (paged, All / Important), `list_result_history` (result rows + 034 versions + the "changed" note), and two small anon RPCs for the public pages.
- App: "Log" in the scorecard ⋮ menu (every member, including view-only) opens a day-grouped timeline with All / Important chips, bold names, expandable was→now tables for edited rounds, "Show earlier" paging and live inserts; the saved result page gains a History section (and a ⋮ History item that scrolls to it) and a one-line amber "Changed after sharing" note that the share image, the PDF and the `/r/` page print word for word; the live scorecard page shows the last 10 important changes. New game and Add player call the RPCs and fall back to the old inserts on a pre-036 server.

### 2026-11-13 — Add round colours, count warnings, Rummy negative share (PR 3) and migration 037
- `037_rummy_negative_share.sql` (written, **not applied**; Build Bot applies after CI): the `scores` check constraint lets a Rummy row be negative, so a round where the others add up to a plus can be saved (the Nov 12 "Balance +40, Save off" dead end). App: Rummy share = minus the others' total, split -16/-15 between two winners; the validator drops its "Rummy ≥ 0" rule; Save round confirms once when a share is ≤ 0. Add round keeps its layout (Sree parked the calculator-style redesign, see `docs/redesign-proposal.md` §10); only the tokens change — yellow selected cell and active sign key, light green for a saved plus — plus a half / Full count warning line and a once-per-cell confirm when a typed number passes the Full count. The quarantined `known-bugs/pr3` flow is now `smoke/14`.

### 2026-11-13 — Initials rule widened, Add new players by initials rebuilt (PR 6) and migration 039
- `039_initials_rules.sql` (written, **not applied**; Build Bot applies after CI): scorecard initials are any free 2–3 characters whose first character is a letter (SK2 may be typed as well as suggested); new `create_player_by_initials` makes a player named by their initials (D6.2) and stores the first free digit form on a clash via `pick_free_initials`, mirrored one-to-one by `utils/initials.ts` with a shared CSV fixture asserted by both the unit test and pgTAP. App: the add screen is three fixed rows (cell 1 one letter and jumps on, cell 2 one or two characters), the stored label in green with its digit in red and the sentence "X is already SK. This new player is SK2.", one Edit per row and no delete; the one `InitialsDialog` serves My players, Players/Admins, Find player and the add screen, accepts the wider rule, says "Change the letters to save." and keeps Save above the keyboard. The last quarantined flow (`known-bugs/pr6`) is now part of `smoke/09`; `e2e/known-bugs/` may be empty.

### 2026-11-13 — Add players to this game, picker labels, Players · Admins (PR 7, no migration)
- The mid-game picker is "Add players to this game": a big yellow Total circle that counts seated players only (D7.1 — admins who do not play and spectators are left out, the same number as the scorecard chip), "Added now: N (yellow ring)", Return to game right under the strip and the two tiles renamed "Add new players" / "From database"; the search box is pale yellow with "Search name, initials or #ID" here and on Find player. D7.2: the "You" tag is gone everywhere (you stay first, spoken "(you)"), and the "Registered" tag and texts are gone — only Unregistered / Pending registration / Link pending are shown, through one `visibleRegistration` rule. Players · Admins gets a big outlined "Add non-playing admin" button with a one-line note. No schema change.

### 2026-11-13 — Delete result visible, Undo, Deleted + Restore (PR 9, no migration)
- Delete result moved from a ⋮ item to a red **Delete this result** button at the foot of the result page with its consequence line, and a Delete chip on each Past results row the viewer may manage (`can_manage_result` per row). Deleting runs at once with a 10-second Undo toast backed by `restore_result` (D9.2); only a result shared from this phone (picture or PDF, tracked in AsyncStorage since the server records no share) asks first. D9.1 kept: games go back to Completed unless another live result holds them. D9.3: a Deleted section under Past results lists the last 30 days with Restore for the people who could delete them. Behaviour documented first in `docs/results-delete.md`; the 023 functions get their own pgTAP file (30).

### 2026-11-14 — APK 9 phone test: scorecard regression fixed alone (PR 10a), the rest as PR 10b with migration 040 (written, not applied)
- PR 10a (`#24`) rebuilt the scorecard table so the header can never collapse into a stack: one vertical scroller, a frozen round column beside one sideways scroller, the header following on the native driver; `smoke/10–11` gained a layout gate (header and a cell of column 2 on screen together). PR 10b carries the rest of Sree's APK 9 notes: Home Recent paging by "Show more" on the existing games query (no new RPC), own scorecard initials on the profile (`040`: `profiles.initials`, `set_my_initials`, `seat_default_label` prefers them), a one-off `repair_round_gaps` for pre-Nov-11 undo holes, Add players save path down to one RPC, every saved Add round cell green with a "N more ▾" cue and three columns from 13 players, results list without the row Delete, "Game by game" and "Unique result ID" wording, and the share engine reworked: every player on the picture (positives left / negatives right until a side passes ten, then half and half), captured off-screen at a fixed 1080 px so every phone sends the same image, game shares in marigold and results in green (a unit test keeps the hex apart), PDFs that flow across pages with the ID and link once at the end, the app icon embedded in phone PDFs. No new dependency (`expo-asset` ships with `expo`); `react-native-view-shot` now receives a fixed output size. Migration 040 is written, tested locally and **not applied** — Sree decides; Build Bot applies.

### 2026-11-14 — Pool games built (PR 13, migration 041)
- Pool is the second game type, built to Sree's screen-by-screen review of the spec (`docs/pool-design.md`, mockups in `docs/pool-mockups/`): New game is two screens (Players → Next → Game type with this game's settings prefilled from the user's saved defaults), limits 101 / 201 / 251 / Custom with drops 25 / 50 / 130, Re-entry a plain on/off (default on) with the eligible players named after every round, plus-only scores (several zeros allowed, over the Full count only asks "Are you sure?"), a scorecard header of number / initials / score with outs struck and re-entered players in blue, Standings under the table, and the new flow Complete → Award (five presets or Custom inline, may be saved unbalanced) → Result (an unawarded pool is grey with "Give awards first"). Every game shares and lists in yellow, results in green; "stake" and "prize" are gone from the UI (a unit test greps the strings). Migration `041_pool.sql` adds the pool columns, the positive-score trigger, the pool branch of `save_round` / `undo_last_round`, `reenter_player`, `set_pool_awards` and the awards path of `declare_game_result`; it is written, tested locally and **not applied** — Sree decides; Build Bot applies. No new dependency.

### 2026-11-14 — Migrations 040 + 041 applied to the live project
- Build Bot ran `040_own_initials_and_round_gaps.sql` and `041_pool.sql` on `gngcrplcldfiubvhcdin` at 6:32 PM PT; data verified intact, and the two old pre-Pool games stored as "pool" were deleted. The live database is now ahead of any installed APK (APK 9 reads it fine; the pool columns and RPCs sit unused until the next build). 042 (Pool re-entries setting + limit-only lock, PR 13) followed on Nov 15, applied by Sree. Nothing is pending on the database side; 043 (Multiplier) and 044 (Seating order) are written and wait for Sree's OK; 045 (Going rogue) is spec-only.

### 2026-11-15 — Migration 042 applied to the live project
- Sree ran `042_pool_reentries_and_limit_lock.sql` on `gngcrplcldfiubvhcdin` (reported 12:35 AM PT): the Re-entries setting (Unlimited / Limited N) and the limit-only pool lock are live server-side. No column or row changes; APK 9 keeps working. The live database now carries 001–042 and nothing is waiting to be applied.

### 2026-11-15 — Test infrastructure (PR 17, no migration)
- CI gained a device plan: `select` (change-based: PR / nightly / pre-release tiers from `ci/select-tests.mjs`) → `apk` (one runner-built test APK per run) → `ui` matrix over four emulator profiles (Pixel 6 reference, Pixel 4a API 30, Pixel 7 Pro at font 1.3, Pixel Tablet landscape) and six suites (smoke, full, chaos, roles, two-device, monkey) → `volume` (local database budgets) → `dashboard`. New tooling, all free on the public repo: `adb screenrecord` video and logcat crash detection per flow, a second emulator booted by script for concurrent-edit races, `adb monkey` fuzz, a **GitHub Pages dashboard on the `gh-pages` branch** (history, screenshots, videos, live job view over the public Actions API) and **automatic bug filing** as issues labelled `bug` + `found-by-tests`. `supabase/seed-break.sql` adds the 38-account test roster and 47 break-the-app games to the local database only. `nightly.yml` is the one file main needs so the 09:00 UTC run can target the top of the stack. Nothing touches the hosted Supabase; no paid service was started (BrowserStack App Live, Maestro Cloud, Firebase Robo and a self-hosted runner stay flagged for Sree).

### 2026-11-15 — Nightly trigger on `main`; first fixes from the break-the-app suite
- `.github/workflows/nightly.yml` is the first file of the test tooling to reach `main` (one-file fast-forward, `18fa662`, under Sree's one-off no-merge exception): GitHub schedules only fire from the default branch, so this workflow dispatches CI's nightly tier at 09:00 UTC on the top code branch of the stack (`TARGET_REF`). The feature stack itself stays unmerged. GitHub Pages for the dashboard and the Projects auto-add rule still need Sree's clicks (PR 17 Q17.1 / Q17.3).
- CI run 6 on PR 17: chaos / roles / two-device / monkey green; the realtime probe proved the local stack delivers CDC, so F4 was a stack flake. PR 19 (#46) carries the app fixes found by the suite: F1 log-out with a dead session, F2 offline wording, F3 pool-limit message placement, F6 20-player Standings starving the grid. No migration.

### 2026-11-23 — Palette B tokens and the Size-S grouped-list shell (design review 2, no new dependency)
- `constants/theme.ts` moved from the Clubhouse set to "Felt & Brass" (D65: felt `#0E4D2A`, brass `#F0DFAE`, paper `#F5F2E8`, light and dark); the web scorecard / results pages and the share card follow the same green. Seat colours and red are unchanged.
- The approved S screens (Profile D66, Settings D67, Game type D68, Sign in D69) now share three UI pieces — `SettingsGroup`, `SegmentedChoice`, `ListRow` with a value slot — plus `RulesForm layout="grouped"` and the `JokerCard` hero in `AuthShell`. Paper's `SegmentedButtons`, `RadioButton` and `SectionCard` leave those four screens; the rest of the app keeps today's look until Sree says which screen is next (`docs/design-review-2.md` §10).

### Now
- Play Console personal account under Google verification (~days).
- EAS side ready to build once Play app exists / you’re ready to upload.

---

## Module status (short)

| Area | Status |
| --- | --- |
| Auth (email/passcode, session refresh, app-only OTP recovery, sign-up code) | Done in the app; OTP email live via Resend since Nov 9. Sign-up confirms with a typed code (D101) once Build Bot sets the Confirm signup template on both projects. Phone pass pending |
| Profiles / Player ID + share | Done |
| Find players | By Player ID only (D113): the app sends only a number; until `053` is applied the server still answers names and emails for anyone calling the API. From New game it also seats the player |
| New game (Points / Pool, my players) | Done. Four steps (PR 24): Players (Next) → Game type with this game's settings prefilled from Settings (Next) → Order of players (tap to number) → Co-admin → Start game. Creator is not pre-seated; Add players (full screen) / Add player from database |
| Game table + score entry | Done, portrait + landscape. Add round: grid, presets, keypad, Balance gate, explicit 0, big losses in red. Complete game, Final scores, and Players are their own pages. Apply `014_save_round_atomic.sql` for the one-transaction save |
| Home | Done. Results → every live game → Recent (every Completed/Closed game, newest first, no filter). History screen redirects home |
| In-app help | Help pages per screen + index with search + Why? links + ⓘ mini helps (PR 11, Nov 18). Screenshots regenerate from a CI smoke run |
| Results | Done in the app. Status chips (with deselect warning), every game listed and admin-only ticks, Show results then explicit Save result (closes games, status popup), share after save, totals and table with Player IDs, banded share image, full-details PDF. `008` and `013` are live; `018_results_reuse_and_player_ids.sql` (reused flag, Player IDs) is written, not applied |
| Security / concurrency (019) | `019_security_and_concurrency_fixes.sql` written, scratch-verified, **not applied**: role lock, owner-only contact columns + `my_profile`, per-game lock in `save_round` / `remove_seat_if_no_scores`, `PT409` conflicts. App handles both pre- and post-019 databases |
| Performance (020) | `020_performance_rpcs_and_indexes.sql` written, scratch-verified, **not applied**: index-driven visibility RPCs, policy wrappers, bundle RPCs. App works on both pre- and post-020 databases; see `docs/performance/RESULTS.md` |
| CI (GitHub Actions) | Done on PR 7: unit + tsc, local Supabase DB suite (migrations, rollbacks, pgTAP, concurrency), report per run. Device UI tests (PR 1, Nov 13): Maestro flows on an Android emulator against a runner-built APK. PR 17 (Nov 15): change-based plan, four devices × six suites (chaos, roles, two-device, monkey added), volume job, gh-pages dashboard, auto-filed bugs. Nightly needs `nightly.yml` on `main` (it dispatches CI on the stack top) and Pages switched on once. See `docs/testing-strategy.md` |
| Game admins | Done in the app. Players/Admins page: Add admin by Player ID (non-player, open or completed games), Game admins on Complete game and the final-scores picture |
| Pool games | Done in the app (PR 13): plus-only scores, outs and re-entry, Standings, Complete → Award → Result. `041_pool.sql` (Nov 14) and `042_pool_reentries_and_limit_lock.sql` (Nov 15) are on the live database. PR 24 (Nov 17): Points-style header, footer inside the card, 70 / 30 portrait, stacked landscape, ↺ re-entry cells, Re-entry score / Late entry rules; `047_reentry_and_late_entry_score.sql` written, **not applied** |
| Settle / prize sessions | **Removed** from the app (D110, Nov 25). Its tables and RPCs stay in the database, unused, until a later migration Sree says yes to |
| Theming (light/dark) | Done; Clubhouse green design system (Nov 12). Appearance follows the phone by default; Profile › Appearance overrides it |
| Supabase schema + RLS helpers | Apply `006`, then `007_redesign.sql`, then `008_results.sql`. `005` only if you use demo data |
| Public scorecard | Static HTML on ezscore.mindweavetech.com (Worker `ezscore-site`). Publishes itself on merge to `main` (`publish-site.yml`, D83) once the two repo secrets are set; the job checks every live page against the build. The key is not in git |
| Expo Go local preview | Working |
| EAS project linked on this PC | Done |
| EAS env vars for Supabase | Done |
| Google Play | **Live in Production** (Nov 25 2026): build 15, version 1.1.0, published under the Candor PS organization account (developer name "MindWeave Tech", to become "MindWeave", D118). Internal testing stays active for staging builds |
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

### 2026-11-15 — PR 14 Multiplier built (stacked PR; migration 043 — applied to live later the same day, see below)
- Points games carry `settings.multiplier` (1–10,000, whole game, changeable any time with a whole-game confirm). The app
  stores entered points and multiplies at the edges; Results / result e-mails / result lists sum as `bigint` in SQL (043).
- New shared number rules: short form K / M / B (≤ 5 characters) on screens, exact with separators on sheets, PDFs, the
  live page and the `/r/` page; the share image goes to one column from 8-digit totals; PDF round blocks 5 / 4 / 3 wide.
- 043 also returns the multiplier from `public_scorecard` and labels the settings-change Log line "Multiplier". Applied to
  live by Build Bot with Sree's OK on Nov 15 (with 044).

### 2026-11-15 — PR 21 Seating order built (stacked PR; migration 044 — applied to live later the same day, see below)
- The seating order is `game_players.player_order` as before; nothing new is stored. 044 adds `set_seating_order` (one
  logged, atomic RPC used by the new Seating sheet and the Players · Admins ▲ ▼, which now work mid-game), the Log kind
  `seating_changed`, and makes the settings log
  ignore the once-per-game pop-up flag `settings.seatingPrompted` (written false by Start, true after the first answer).
- The sheet pops up once right after Start (tap-to-place or arrows, no drag dependency) and is in ⋮ for admins on Active
  games. Going rogue's migration is renumbered 045. Smoke 19 and nightly 51 cover it; 044 was applied to live with 043 on Nov 15 (below).

### 2026-11-15 — Design audit 15a built (stacked PR; no migration)
- Screen-only: the P1/P2 half of `docs/design-audit.md` (A01 A08 A11 A03 A05 A02 A06 A10) plus the three Help-spec items
  Q11.12 / Q11.14 / Q11.18. New shared pieces: `components/ui/ActionBar.tsx` (the one bottom bar), `utils/formatWhen.ts`
  (the one date format), `screenTitle()` ("Screen · S1", centred everywhere). "Back to scorecard" bar buttons are gone;
  the header arrow is the way back (Add round gained one). Flows match `"Scorecard( · .*)?"`; `tests/design-audit-pr15a.test.ts`
  pins it. 15b (share sheet, SearchField, dialogs, Tag/Chip, Toast, tokens test) follows as its own stacked PR.

### 2026-11-15 — Design audit 15b built (stacked PR; no migration)
- The mechanical half: one `ShareSheet` from the header share icon (A04), one `SearchField` (A07), `ConfirmDialog` +
  `NoticeDialog` and no `Alert.alert` (A09), `Tag` for status / `Chip` only for filters (A12), one `Toast` with 3 s / 4 s
  (A13), every radius a token (A15), Complete's strip (A16), two button weights — `contained-tonal` removed from
  `AppButton`'s type (A17), `EmptyState` everywhere (A19), header order share · help · menu (A20), "Add by initials" /
  "Find in database" labels (A21). `tests/design-tokens.test.ts` is the DC15-1 drift guard. Q13.25 (50 / 50 is a
  deliberate exception) is written into the Pool doc and pinned by a test.

### 2026-11-15 — Going rogue built (PR 20, stacked PR; migration 045 written, not applied)
- The simple version of `docs/going-rogue-design.md` §6 (items 2 + 3 + Q20.1): players with a saved score see a deleted
  game under Home › Deleted games and in a read-only scorecard with a red banner; `request_restore` logs the ask and
  tells the creator and the admins (notice + `restore_requested` email); admins / creator restore from Home, the
  scorecard or Settings › Hidden & deleted. **First real erasure:** `purge_deleted_games()` removes games deleted 30+
  days ago (results they were removed from keep their baked standings; Log rows survive re-anchored on
  `purged_game_id` + a `game_purged` row), scheduled nightly 03:15 UTC through **pg_cron** when the extension is on —
  Build Bot enables it on the live project when applying 045. Support path is support@ezscore.app (Q20.7). Items 4 and 5
  (round actions from the Log, last-admin guard) not built.

### 2026-11-15 — Migrations 043 + 044 applied to the live project
- With Sree's approval Build Bot ran `043_multiplier.sql` and `044_seating_order.sql` (from the PR 21 branch) on
  `gngcrplcldfiubvhcdin` and verified them: `game_multiplier`, `set_seating_order` and `games_multiplier_check` exist,
  row counts unchanged. **Live is at 044.** APK 9 keeps working (the multiplier is 1 and the seating RPC is unused until
  the next build). **045 (Going rogue, PR 20) is written and not applied**; it needs pg_cron on first.

### 2026-11-15 — Migration 045 applied to the live project; pg_cron on; purge job then unscheduled
- Build Bot (Sree's OK, 11:15 AM PT) enabled pg_cron and applied `045_going_rogue.sql` to `gngcrplcldfiubvhcdin`;
  `purge_deleted_games` exists, row counts unchanged (games 42, game_players 291, rounds 92, scores 690, game_results 12,
  event_log 19, profiles 92). **Live is at 045.**
- One minute later Sree set a new rule: **nothing about games or results is ever permanently deleted by the app.** Build Bot
  unscheduled the live `purge-deleted-games` cron job (0 jobs left); `purge_deleted_games()` still exists but nothing
  calls it. After 30 days a deleted game becomes a second-layer soft delete — hidden from every user, not restorable by
  users, kept in the database for support. Migration 046 (PR 22, stacked on PR 20) rewrites the function that way;
  written, not applied. A manual / batch cleanup may come later when data gets big.

---

## Maintenance rule for agents

When you change **tooling, hosting, SDK major/minor, backend provider, store path, or finish a major module**, add a short Timeline bullet and update **Current stack** / **Module status**. Skip noisy UI-only tweaks unless they change architecture.

### 2026-11-15 — APK v11 built by Build Bot; GitHub status pass; nightly target moved; PR 23 flow docs
- Build Bot cut the EAS preview **APK v11** (versionCode 11) from the stack top `6a262d2` at 11:28 AM PT — the first
  build carrying Pool, Multiplier, Seating, Design audit 15a/15b and Going rogue; it talks to live at 045.
- Every open PR (#7 → #53, 27 of them) got a Status block at the top of its body: built / CI / migration applied or not
  / pending on Sree / in APK v11 / stack position. PR #66 (merged to `main`) points `nightly.yml` at
  `cursor/pr20-going-rogue-build-0a03`, so the nightly now exercises the stack top instead of the stale PR 19 branch.
- PR 23 (docs only, on top of the stack): `docs/flows/` — one Mermaid flowchart + PNG per user flow, a code-enumerated
  screen / pop-up / warning inventory with stable IDs, scenarios tagged with the tests that cover them, and traceability
  matrices a–e (markdown + CSV). Generated by `node docs/flows/build.mjs`; `@mermaid-js/mermaid-cli` renders PNGs (dev-time
  only, not a dependency of the app).

### 2026-11-15 — PR 22 No permanent delete built (stacked PR; migration 046 written, not applied)
- Sree's rule made concrete: the 30-day step is now a second-layer soft delete. `games.archived_at` is set by the
  nightly `archive_deleted_games()`; an archived game is hidden from every user (no Deleted games row, no bundle, no Log,
  no ask, `restore_game` refuses with PT410 and the support address) and kept whole for support, who finds it with
  dashboard SQL and hands it back by clearing the stamps. `purge_deleted_games()` keeps its name but is the same
  harmless step, so no old cron line can erase anything; pg_cron job `archive-deleted-games` (03:15 UTC) replaces
  `purge-deleted-games`. Every "erased" / "gone for good" line in the app, Help, the Log label and the restore e-mail
  now says "hidden for good — nothing is erased" (APK v11 still carries the old words until the next build). pgTAP 37
  (X22-1…4), pgTAP 36's X20-3 rewritten, unit X22-5/6, rollback 046 (leaves the purge job off), replay hook.

### 2026-11-17 — PR 24 v11 pool and seating feedback built (stacked PR; migration 047 written, not applied)
- Sree's walk-through of APK v11 turned into one focused PR on the pool scorecard and seating. The pool header now
  uses the Points typography (one small line taller for the #number), the Creator / Admin / Unique game ID footer moved
  inside the card under the last round at 70 % italic, portrait pool is a 70 / 30 split (scorecard pane, standings
  pane, independent scrollers) and landscape pool is the full-width table with the standings below it. Re-entry cells
  show the re-entry score with ↺ and grey the cells above. Re-entry settings gained "Re-entry score" and a separate
  "Late entry" section (Highest score / Highest score + 1, default + 1); Limited re-entries start with an empty count.
  New game became four steps (Players → Game type → Order of players → Co-admin → Start game) and the PR 21 seating
  pop-up is gone; **Order of players** is tap-to-number (undo last, arrows on numbered rows, Clear / Done) for both
  the start and ⋮ mid-game. Migration `047_reentry_and_late_entry_score.sql` (server-side +1 rules, Log labels) with
  rollback, pgTAP 38 and the replay hook is **written, not applied** to live. Decisions recorded in
  `pool-design.md` §0 rows 18–27.

### 2026-11-18 — PR stack merged to `main`; end flow rebuilt (PR A of the Nov 18 batch, no migration)
- The 30-PR stack (#7 → #82) was merged into `main` in one merge commit; from here every PR and migration starts from
  `main`, and `nightly.yml` targets `main`. The merged-but-still-open PRs are closed as housekeeping.
- Sree's end-of-game rules became the code: **Complete** is one dialog on the scorecard (`CompleteGameDialog`; the
  Complete page, its route and Help entry are gone), a Points game goes straight to the **Final screen**, a pool goes
  to **Awards** (Not now / Save awards) and then the Final screen. The Final screen's bar is **Share + Done**: Share
  offers the picture or the full-details PDF only; **Done always goes Home** (`router.navigate('/(tabs)')`); the header
  arrow returns to the completed scorecard. No Results nudge anywhere in the end flow (Results is its own errand from
  Home; a one-game result reads "Show results · 1 game"). A completed pool without awards is just **Completed** — no
  "Awards pending" — and the Results picker asks for awards only when it is picked. Info sheets close with **Close**
  (Round saved, Exact points), so Done means one thing. The full-details PDF now carries the pool: limit and drops,
  every player's pool score, entries, put in, gets, award and out round, re-entries, and the rounds with "out" / ↺
  cells (`utils/endFlow.ts`, `utils/finalScoresSheet.ts` `pdfSections`). PR B (pool portrait 5-line card, landscape
  without standings) and PR C (decisions log, PR template) follow as separate PRs.

### 2026-11-18 — Pool portrait five-row card, landscape without standings (PR B of the Nov 18 batch, no migration)
- Sree's 5-line rule replaces PR 24's 70 / 30 split: the pool card in portrait hugs its rounds (a placeholder row at 0
  rounds), one empty row and the Creator / Admin / ID lines, capped at five round-row heights, with the newest round
  anchored at the bottom of the card; the Standings take the rest. Landscape pool is the full-width table alone, like
  Points — the standings pane and the `below` slot are gone; an admin reaches Give / Change awards from the strip.
  `pool-design.md` §0 rows 21–22 rewritten. Maestro 17 / 20 updated.

### 2026-11-18 — Decision register, PR template, agent rules (PR C of the Nov 18 batch, docs only)
- `docs/decisions.md` is the one dated list of what Sree decided and whether it still holds (D-ids, status active /
  superseded / deferred), seeded from pool-design §0, help-design, design-audit and the Nov 18 batch. The root
  `.github/PULL_REQUEST_TEMPLATE.md` carries the design-review checklist as checkboxes plus the screenshot matrix;
  `AGENTS.md` gained the branching rules (trunk-based from `main`), the authority table (merge / migration / APK only
  on Sree's explicit yes) and the relay rule (Build Bot relays verbatim; the builder asks its own questions).

### 2026-11-18 — PR 11 Help built (#81, rebased on `main`; no migration)
- Help moved from one dialog per screen (`constants/help.ts` `HELP`) to one **help page per screen**: `constants/helpTopics.ts`
  (19 topics: purpose · Need to know · annotated screenshot · Full guide · the ⋮ table · Tricky cases · Also see), rendered by
  `app/(screens)/help/[topic].tsx`; a **help index with local search** (`help/index.tsx`, reachable from Me and from every
  help page); two rules pages; "Why?" links from five puzzling dialogs to the matching Tricky case. The screenshots are
  real smoke-run frames halved and badged by `scripts/help-screenshots.mjs` (pngjs only), positions in
  `scripts/help-callouts.json` — regenerate from the branch's own CI smoke artifact. Mini helps (Sree, Nov 17): an `InfoTip` ⓘ
  beside a section title opens a short pop-up (Got it / Full guide) and replaces the paragraphs under it; approved on
  New game · Game type and then applied to every screen (`SectionCard` grew a `tip` slot). Help copy already describes
  PR 24's four-step New game, Order of players, ↺ re-entry rows and in-card footer. Rebased on `main` after the
  Nov 18 batch: the `complete` help topic now describes the Complete dialog, the Final screen page says Share + Done,
  the Awards page has no Add to Results. No new dependency, no hosting change.

### 2026-11-18 — #81 and #89 merged to `main` (Help module done; two-device suite green; no migration)
- Sree: "Merge eighty one, Merge eighty nine." #81 (Help) and #89 (two-device realtime) merged in that order after full
  device CI on each. #89 added a `[realtime]` status log line per game channel, a 20 s foreground poll plus a reload on
  app resume on the scorecard (Realtime stays primary; the poll is the safety net for the subscribe window), probe
  stage 2 (`save_round` through RPC), and `ci/report/file-bugs.mjs` closing `found-by-tests` issues whose set/flow is
  green again. Two-device suite 9/9 on the merged head. Correction (Build Bot, 21:14 UTC): 046 and 047 **were already on
  live** — `schema_migrations` has 046 (2026-11-15 23:31 UTC), 047 (2026-11-18 07:20 UTC) and a `047b_event_log_games_exact_fix`
  (07:21 UTC) that has no file in the repo; functions matched the files by hash, row counts unchanged. Nothing applied
  today. No APK built — Sree wants the pending list first. No new dependency, no hosting change.

### 2026-11-18 — 047b recorded in the repo as migration 048 (already on live; no new apply)
- Live `schema_migrations` had `047b_event_log_games_exact_fix` (version 20261118072131, 07:21 UTC) with no file in
  the repo. Build Bot read the stored SQL back: it re-applies `event_log_games` with the 047 section D body,
  byte-for-byte. Sree: "This is fine." → committed as `supabase/migrations/048_event_log_games_exact_fix.sql`
  (`supabase db reset` only reads `<digits>_name.sql`, so not `047b_`), with `rollback_048_…` (same body) and pgTAP
  `39_event_log_games_048.sql`; the rollback replay covers it. Nothing applied to live. Rule going forward: a step
  run on live gets its file in the same hour, so the repo stays the source of truth.

### 2026-11-18 — D46 C and D47 B built (migration 049 written, not applied)
- Sree picked the recommendations: **D46 C** — reopening a pool that has awards clears them (migration
  `049_reopen_pool_clears_awards.sql`, a `before update of status` trigger on `games` plus the app's own reopen
  update; rollback, pgTAP 40, replay hook), and **D47 B** — "sideways" means wider than tall on every device, so a
  tablet turned sideways gets the table-alone pool layout and upright keeps the card + Standings. His question on
  reopening a pool that is in a result: it cannot happen — such a pool is Closed; results keep their stored places.
  049 is **not applied** to live (needs Sree's yes). No new dependency, no hosting change.

### 2026-11-19 — #90 and #91 merged to `main`; 049 applied to live
- Sree: "go ahead with all recommended actions". #90 (help pictures, pool header without the player number — D48,
  ci.yml schedule refs) and #91 (D46 C, D47 B, migration 049) merged after green device runs. Build Bot applied
  **049** to `gngcrplcldfiubvhcdin` (schema_migrations `20261119044506`; trigger present and enabled; row counts
  unchanged). 050 waits on #93's run. Open: #93 (050), #94 (nightly drift + planner: infra PRs run the edited full
  flows), #95 (sign-in help picture). No new dependency, no hosting change.

### 2026-11-19 — D49 B: a Closed game can be reopened (migration 050 rewritten; #93 replaced)
- Sree's real-use case ("he should be able to add, because it happens all the time … give a warning … the old
  result never changes") overturned the Nov 18 refusal. He picked **B** "to keep it simple" and set the
  **simplicity principle** (D50, now in `AGENTS.md`). 050 is rewritten: `game_results.stale_at/stale_by/
  stale_game_id`, trigger `games_reopen_closed` (stamp the result Out of date, un-close its other games), the
  rounds/scores guards replace the games guard, `result_for_game` RPC, and the results RPCs wrapped (`_v028` /
  `_v043` kept intact). App: one Reopen dialog that names the result, an Out of date chip in Results and a banner
  on the result page. PR #93 (the refusal) is closed, replaced. #96 merged to `main` (`4b8187a`) on Sree's yes; #95
  (sign-in help picture) merged earlier the same morning (`c6b6bae`). Build Bot applied **050** to live at 06:50 UTC
  (schema_migrations `20261119065006`; trigger enabled, guard gone, columns and `result_for_game` present, counts
  unchanged). No new dependency, no hosting change.

### 2026-11-19 — APK v12 (EAS preview) from `main`; #94 merged
- Sree: "build". Build Bot cut **APK v12** (EAS build `ac2a3759-7b3c-4219-a51b-43ffa4bb0937`, versionCode 12, appVersion
  1.1.0, profile `preview`) from `main` `3d32599` at 07:19 UTC and sent Sree the install link
  (`https://expo.dev/artifacts/eas/3fVyWAuc9Sp8JDBmUp2pyodqzJ2XwojCzluopAVXHgA.apk`). v12 carries #90, #91, #95 and
  #96 (D46–D50: pool reopen clears awards, sideways layout, no player number, sign-in help picture, Closed-game
  reopen with Out of date results); the live database has 049 and 050. #94 (nightly drift fixes, the planner's
  edited-full-flows job, smoke-first full job, `full/51` signs back in as sree) merged right after the build, so
  its Exact-points scroll fix waits for the next APK. No new dependency, no hosting change.

### 2026-11-19 — v12 feedback: #97 and #98 merged; quick-fix and pool-limit PRs opened; Play Store path written
- Sree tested v12 and sent 15 points (`docs/v12-feedback.md`). #97 (flow 42 device frames) and #98 (the feedback
  table and `docs/play-store-launch.md`) merged on his "Yes". Two PRs follow: the quick fixes (D51 scorecard header
  scrolls sideways, D52 Add by initials layout, help pictures fit, 48 dp seating rows, no tick, pill clearance) and
  the pool-limit unlock (D53, **migration 051**, applied the same evening, see below) with the width-fitted round blocks and the two-column
  abbreviation key (D54). Open with Sree: seating countdown (Q4), the unsaved-players button wording (Q3), the
  Find-in-database help highlight (Q5), republishing the live scorecard page (Q6), and the Play Console account
  (personal needs 12 testers × 14 days before production; organization needs a D-U-N-S number). No new dependency.

### 2026-11-19 — #100 merged; 051 applied to live; first production AAB cut
- Sree: "Yes, merge 100, apply 051 to live, and build the AAB and APK." #100 merged (`eafe964`). Build Bot applied
  **051** at 18:46 UTC (schema_migrations `20261119184606`; `games_pool_limit_changed` enabled, `games_pool_settings_lock`
  gone, `player_back_in` in `event_log_kind`, counts unchanged). Two EAS builds from `eafe964`: the first **production
  AAB** (`d34e29b6`, versionCode 13, for Google Play) and the preview APK v13 (`ee53751b`, versionCode 14, sideload).
  First time the `production` profile is used; EAS holds the upload key, Play App Signing will hold the app key.
  Play Store answers so far: contact `support@mindweavetech.com`, all countries; trader status and #101 (listing
  pack) still open. No new dependency.
### 2026-11-19 — Google Play: organization account in place; listing pack written
- Sree: "Todays goal is to deploy on android store … Use a business account for Candor PS." The Play Console
  organization account (MindWeave Tech / CANDOR PS LLC, owner sree@candorps.com) already exists, verified, with a
  draft app for `com.mindweavetech.rummyhome` and no bundle yet. Distribution path from here: production **AAB** from
  EAS (`production` profile, Play App Signing) → Internal testing → Production review. `docs/play-listing/` holds the
  store text, the 11 App content answers, icon 512, feature graphic 1024×500 and eight captioned 9:16 / 16:9
  screenshots built from the CI device gallery (`make-assets.py`). No new dependency; Pillow only for the images.

### 2026-11-19 — Order of players counts down (D56); Play listing frames get their own seed
- Sree reviewed the Play listing pictures and settled the seating question from v12 point 7: "Tap from highest to
  lowest. Seat numbers are from lowest to highest. Lowest deals first." Built as D56 in `utils/seating.ts` and the
  Order of players component (first tap = seat N on top, last tap = seat 1 and deals; help copy, smoke/16, smoke/19
  and full/51 follow). No server change: `player_order` is unchanged, only how the list is built.
- The listing screenshots now come from a dedicated account seeded by `supabase/seed-listing.sql` (applied by the
  ui-smoke / ui-full jobs after seed-break; never on hosted): a 10-player Points game, a 9-player pool with two out,
  and a saved result over S1 + S2, captured by `smoke/22`. Nothing in Sree's test data changes.

### 2026-11-19 — The Dealer sheet (D60), join at dealer + 1 (D57), the deal skips out seats (D58): migration 052 written, not applied
- Sree asked for the dealer to be "a menu of its own" and for one simple flow for any round. Migration
  `052_dealer.sql` adds `games.next_dealer_profile_id / next_dealer_round / next_dealer_keeps_sequence` and the
  admin RPC `set_round_dealer(game, round, dealer, follow)`: a played round is rewritten (`rounds.dealer_profile_id`,
  later rounds re-dealt when followed), the next round is an override `save_round` consumes; "this round only"
  chains one more override so the sequence survives. `add_seated_player` now seats a newcomer at the current dealer's
  seat + 1 once rounds exist (D57). The rotation helpers skip `out_round` seats on both sides (D58), and the scorecard
  header shows DEALS and OPENS. pgTAP `43_dealer_052.sql`, rollback `rollback_052_dealer.sql`, replay harness updated;
  `smoke/23-dealer` captures the frames. **The migration is a file in the PR only; live gets it on Sree's separate yes.**
- Not built: a Points "left the table" state (Q9) — pool "out" is the only out state today.

### 2026-11-20 — #105 merged, 052 live; the Order of players tutorial (D61); `expo-haptics` added
- #101, #102 and #105 are on `main`; Sree applied 052 to live and cut AAB v15 / APK v16 from `e800cb2`.
- D61: a reusable step-by-step sheet (`components/tutorial/StepsSheet.tsx`) with the Order of players as its first
  user — four steps, each a looping demo of the real rows scripted in `utils/tutorials.ts` (no video asset, no
  Lottie, no Reanimated: plain state on a timer). Forced on the first visit, remembered on
  `profiles.default_settings` (jsonb, no migration) plus a per-person device copy; Show me on the screen and Watch
  how (20 s) in Help replay it. New native module **`expo-haptics`** for the light tap on the real last tap — the
  next EAS / CI APK includes it (prebuild picks it up); Expo Go is unaffected since we do not use it.
- `seed-listing.sql` flags every seeded account as having seen the tutorial except Ravi (demo@test.local), so the
  existing seating flows are unchanged and `smoke/24-seating-tutorial` covers the first-time run.

### 2026-11-21 — #107 / #108 merged (`afa9c83`), APK v17; AAB 15 in Play review; `docs/next-up.md` becomes the ordered list
- Sree: the board does not tell him what is next and the agent stops when a PR lands. New living doc
  `docs/next-up.md` (ordered, kept every turn by rule `.cursor/rules/next-up.mdc`); the board stays the *state*
  view, `decisions.md` the *why*. The agent starts the next unblocked item on its own; merges, live migrations,
  builds and Play uploads still wait for Sree's yes through Build Bot.
- Found while reading CI timings: the New game "Playing" halo looped for ever on the JS thread, so Maestro waited
  60–100 s per tap on that screen (smoke/19 10 min) and the slower nightly devices timed out (#88 #103 #106) — #109.
- Three plans written on Sree's asks, no code: design review 2 (`docs/design-review-2.md`, #111), iPhone
  (`docs/ios/README.md`, #112 — the date is Apple's enrolment + TestFlight + App Review waits) and volume / test
  environment (`docs/test-environment-plan.md`, Q12): the database ladder and device suites already exist; what is
  missing is a hosted staging Supabase project (free tier) with a staging APK, and load against it.
- Volume ladder re-run on 001–052 (V1 of `docs/test-environment-plan.md`): 20 new rows for pool at the cap (19→20p ×
  500r: recompute, bundle, late joiner, dealer override, seating, awards, reopen), a real 10p pool at 101 with
  re-entry, and 30 awarded pools in one result — all within budget (≤ 145 ms). Case 7–9's "S5001" expectation
  rewritten for D5.1 (numbers reused once a game leaves Active). `volume` moves from pre-release-only to **nightly**.
- Rendering the payloads found `public/scorecard.html` broken since PR 14 (`multiplier` read before its `const`) —
  fixed in its own PR, with a test that executes the page script in a stub DOM, before Q6 republishes the page.
- Sree said yes to staging (Q12). New Supabase project **`ezscore-staging`** (ca-central-1, same org, $10 / month;
  migrations 001–052 applied by Build Bot, pg_cron not enabled). `app.config.js` gains an `APP_VARIANT=staging`
  second app (EZ Score · Staging, `.staging` package, own scheme) and `eas.json` a `staging` profile whose anon key is
  an EAS secret; `ci/volume/seed-staging.mjs` generates the §3 population deterministically and refuses every host
  but loopback or the staging ref. Seeding staging and the first staging APK wait for Sree's yes.

### 2026-11-23 — The share site deploys from CI; how the agents work changes (D79–D84)
- The share site is the Cloudflare Worker **`ezscore-site`** (every page inlined in one module), uploaded by hand
  until now: the live pages were the Nov 12 build, so shared pool links showed no Standings for eleven days (Q6).
  New `publish-site.yml` builds the module from `public/` (`scripts/build-site-worker.mjs`), deploys it with
  **wrangler** on every merge to `main` that touches the site, and `scripts/verify-site.mjs` compares every live page
  with the build (body hash and an `x-ezscore-build` header naming the commit). The custom domain stays attached in
  the dashboard; the token needs only Workers Scripts · Edit. Needs two repo secrets before the first CI publish.
  On Sree's yes the same module (main @ `a7018d7`, hash-checked against the repo build) was uploaded the same
  evening through the Cloudflare API, and `verify-site.mjs` confirmed all eight live pages — Q6 closed.
- Process (Sree's yes to the workflow review): staging seeds / migrations and merges of green, approved-spec PRs are
  pre-approved (D79, D80); at most three open PRs (D81); a five-line *For Sree* block on every PR and atop
  `next-up.md`, and on a PR CI keeps the video of each flow the change selected (D82); a bug is fixed when a test
  proves it (D83); Telugu, phone sign-in and the extra tutorials wait until v1 is live in Play (D84).

### 2026-11-24 — Agent procedures move into project skills (D87)
- The step-by-step procedures in `AGENTS.md` (show then build, screenshot matrix, PR write-up, bug proof, small-fixes
  batch) became five project skills under `.cursor/skills/`, loaded only when they apply; `AGENTS.md` keeps one line
  each and its authority table unchanged. New `scripts/compare-frames.py` turns two sets of CI device frames into
  "today | after" pictures. Pictures for Sree are committed to the public repo and linked by raw URL, because
  Cursor artifact links need a login and the CI dashboard prunes old runs (D87).

### 2026-11-26 — Create account confirms with a typed code; no Player ID box (D101, D105)
- Sign-up no longer depends on a confirm link and a web page to land on: Supabase's Confirm signup e-mail carries
  `{{ .Token }}` and the app verifies it (`verifyOtp` type `signup`), which signs the person in at once. The e-mail
  side is a dashboard template on both projects (`supabase/templates/confirm-code.html`,
  `docs/signup-code-template.md`), set by Build Bot after the merge, staging first. Link e-mails already sent still
  confirm, and Sign in offers *Enter the code* for an unconfirmed address. The optional Player ID box left Create
  account (D105); linking by Player ID stays on My players. No migration. Merged Nov 26 (#151, `897a9a7d`). The live
  template switches only after the next Play release: the code e-mail has no link, and 1.1.0 has no code box (D126).

### 2026-11-24 — The `small` CI phone (batch 2 PR)
- CI device plan gains a fifth row, `small`: the Pixel 4a profile on the API 34 image at density 480 (a 360 × 780 dp window, `adb shell wm density` from `DEVICE_DENSITY`) with font 1.3; smoke on every app PR, full nightly. Started on the API 30 image; moved to API 34 after its cached snapshot hung three PR runs (12h). Reason: five of the eight staging-build-2 bugs were a narrow phone or a big font and the PR gate ran smoke on the Pixel 6 only. The `tablet` row was never landscape (the Pixel Tablet's natural orientation is landscape; rotation 1 is upright) — relabelled, flows re-pinned.

### 2026-11-25 — The hidden Settle / prize-sessions module is deleted (D110)
- Settle (coin balances across finished games, hidden behind `EXPO_PUBLIC_SETTLE_ENABLED` since PR 13) is gone from
  the app: its two screens, the sessions and token-ledger services, the coin math and the flag. Why: Google Play
  forbids "companion functionality" for real-money games and India's 2025 Act bans online real-money games
  (`business-analysis.md` §4). No migration: `prize_sessions`, `prize_session_games`, `prize_entries`,
  `token_ledger`, `games.prize` and the five `*_prize_*` RPCs stay in the database, unused, until Sree says yes to
  dropping them.

### 2026-11-26 — Migration 054: a mid-game joiner sits to the dealer's left (D70), live
- `054_join_left_of_dealer.sql` replaces only `add_seated_player`'s seat rule (052's dealer + 1, D57): a newcomer
  takes the seat before whoever deals the round being played, so they deal last and nobody's turn moves; the
  dealer keeps the round through the 052 override when needed. Re-entry is unchanged. The app predicts the same
  seat (`planJoin`) for local games and for the one-line notice on Add players. Rollback restores the 052 body;
  CI's rollback replay and pgTAP cover it. Merged as #156 (`eb4a3270`); Build Bot applied 054 from that `main` to
  live (row counts unchanged before and after) and to staging on Nov 26.
### 2026-11-26 — Find players by Player ID only (053, D113); invite is a plain message (D106)
- Migration `053_player_id_search_only.sql` (merged as #150; **applied to live** Nov 26 by Build Bot from `main`
  `1ece816a`, row counts unchanged before and after; on staging the same day) turns `search_players` into an exact Player ID
  lookup: one registered account, its name shortened to first name + last initial (`short_player_name`), or nothing.
  Names, initials and emails are no longer searchable through the API, so typing two letters can no longer list
  people from the whole database. Same signature, so older app builds keep working; `search_my_players` (the
  user's own players) is unchanged. The app's Find in database is a number keypad with a Search button.
- Invite to EZ Score shares a plain get-the-app message; the one-time sign-up (claim) link is gone from the app.
  The claim RPCs stay on the server so links already sent still open until they expire. Link to Player ID (025)
  is now the one way to move an initials player's games to an account. D70's seat change becomes migration 054.

### 2026-11-26 — The next staging APK ships without WhatsApp (D126, D117 superseded)
- Distribution order is now: staging APK from `main` with everything except WhatsApp (054 on live, 053 + 054 and
  the code e-mail on staging first) → Sree tests → a later build adds WhatsApp sign-in (#153, migration 055) once
  the Twilio / Meta sender works on staging. The live code e-mail follows the next Play release, not the merge.
- CI: the AVD snapshot step is capped at 8 minutes and cached only when it finishes, and the Maestro install
  retries (#163), after one 88-minute snapshot hang and one Maestro download 504 on Nov 26.

### 2026-11-25 — EZ Score: Rummy is live on Google Play (Production 15, 1.1.0)
- Google approved the review; build 15 (1.1.0) is published to Production (Play Console: "Last published on November
  25, 2026", 0 policy tasks). Internal testing stays active, so staging builds still go to testers first.
- Distribution is now: EAS build → Internal testing (staging) → Production on Sree's yes. The next Production release
  was to carry WhatsApp sign-in (D116, D117; since D126 WhatsApp comes one build later), so its Data safety form adds the phone number; the 30-day delete grace (D72)
  changes the "deleted within" answer when it is built.
- Unblocked by the approval: the Play developer name change to "MindWeave" (D118) and the delete-account grace (D72,
  still needs Sree's go). D84's other "after live" items (Telugu, more tutorials) have no approved spec yet and stay
  after the code freeze unless Sree moves them.
