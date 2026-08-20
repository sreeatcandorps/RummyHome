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

## Current stack (as of 2026-08-18)

| Piece | Choice | Why |
| --- | --- | --- |
| App root | `rummy-home3/` | Expo Router mobile app |
| Framework | Expo SDK **54** | React Native 0.81 app toolchain |
| UI | React Native Paper (Material 3) | Android-familiar components |
| Backend | Supabase (Auth + Postgres + RLS) | Shared multi-user data without a custom server |
| Local cache | AsyncStorage | Offline/session helpers only — not the system of record |
| Repo | GitHub `sreeatcandorps/RummyHome`, branch `main` | Single mainline; no long-lived feature branches by choice |
| Cloud builds | EAS Build profiles: development / preview / production | Real store binaries |
| OTA | `expo-updates` enabled + EAS Update channels | Fix JS during the 14-day test without new Play review every time |
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


### Now
- Play Console personal account under Google verification (~days).
- EAS side ready to build once Play app exists / you’re ready to upload.

---

## Module status (short)

| Area | Status |
| --- | --- |
| Auth (email/passcode, session refresh) | Done enough for testing |
| Profiles / Player ID + share | Done |
| Find players (email/phone/ID, invites) | Done |
| New game (stake/pool, expenses) | Done |
| Game table + score entry | Done; landscape polish still open |
| History / dashboard loading | Done |
| Supabase schema + RLS helpers | Done (apply any pending migrations before store build) |
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
| `docs/store-listing.md` (repo root `docs/`) | Play listing copy |
| `docs/privacy-policy.html` (repo root) | Hosted privacy page |
| `TASK_LIST.md` | Older feature backlog (partially stale) |

---

## Maintenance rule for agents

When you change **tooling, hosting, SDK major/minor, backend provider, store path, or finish a major module**, add a short Timeline bullet and update **Current stack** / **Module status**. Skip noisy UI-only tweaks unless they change architecture.
