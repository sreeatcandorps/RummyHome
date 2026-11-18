# Multi-device plan and the flow × role × device matrix (PR 16 test plan, part 3)

## 1. Devices that matter

Our players are family groups on mid-range Android phones in India and the US; a few iPhones; one tablet on the table
for the scorecard. The app ships as an Android APK (EAS). There is no iOS build yet.

| Id | Device class | Why | How it runs |
| --- | --- | --- | --- |
| D1 | **Pixel 6, API 34, 1080 × 2400** (today's CI emulator) | reference | GitHub Actions emulator (`reactivecircus/android-emulator-runner`) — every PR |
| D2 | **Small / old phone**: Pixel 4a profile, API 30, 1080 × 2340 but 5.8", 4 GB; also API 28 with 2 GB RAM | most common second phone in a family; shows clipping and slow renders | emulator, nightly |
| D3 | **Large phone**: Pixel 8 Pro, API 35, 1344 × 2992, font scale 1.3 | 20-player header, large-text settings | emulator, nightly |
| D4 | **Tablet / landscape**: Pixel Tablet, API 34, 2560 × 1600 | scorecard on the table | emulator, nightly (landscape flows only) |
| D5 | **Real Android phones** (Sree's two phones, Samsung A-series and Pixel) | realtime, share sheet, PDF viewer, notifications, keyboard quirks | manual two-phone pass before each milestone APK; later BrowserStack real devices |
| D6 | **Browser** for `/r/` pages: Chrome Android, Safari iOS, desktop Chrome | signed-out viewers | Playwright (headless Chromium + WebKit) in CI |
| D7 | **iPhone** (SE 2nd gen small, 15 regular) | when an iOS build exists | Expo Go on Sree's iPhone first; EAS iOS simulator build + Maestro iOS later |

Appearance and settings axes (not devices, but run on D1 and D3): dark theme, font scale 1.3 and 2.0, landscape,
airplane mode, battery saver (background timers), slow network (emulator `-netdelay`), killed app mid-save.

## 2. Tooling options, cost and effort

| Option | What it gives | Cost (list prices, check before buying) | Effort to set up | Verdict |
| --- | --- | --- | --- | --- |
| A. GitHub Actions emulator matrix (D1–D4) | Maestro flows on four AVD profiles, screenshots, `adb screenrecord` video, hierarchy dumps; our existing job with a `matrix.device` | runner minutes only: a 25-minute emulator job ≈ $0.20 on `ubuntu-latest` (private repo, 2 vCPU); four devices nightly ≈ $25 / month beyond the free minutes; use `ubuntu-latest-4-cores` for the 20-player flows if slow | low: extend `ci.yml`, one AVD profile per device, cache the system images | **do first** |
| B. Self-hosted runner on Sree's PC | same flows, but live: the emulator window is on his screen, `scrcpy` mirrors a real phone plugged in by USB | free; electricity | medium: Android SDK + Java 17 + Maestro + `actions-runner` service; label `self-hosted,sree-pc`; a workflow_dispatch input picks it | **do second** — this is the "watch it live" answer |
| C. Firebase Test Lab | Robo crawl (monkey) and crash reports on real and virtual devices, video per run; no Maestro | Spark: 10 virtual + 5 physical runs a day free; Blaze $1 / virtual device-hour, $5 / physical | low: `gcloud firebase test android run --type robo` with the APK from the EAS artifact | **use for Robo / monkey** on real devices, free tier is enough |
| D. Maestro Cloud (mobile.dev) | our flows unchanged on their devices, web dashboard with per-step screenshots and video | free tier is small; paid plans start in the low hundreds of dollars a month | low | later, if A becomes slow |
| E. BrowserStack App Automate (Maestro supported) / Sauce Labs real device cloud | real Samsung / Xiaomi / Pixel devices, live video, Maestro flows | from ≈ $199 / month for one parallel session; App Live (manual, in-browser phone) ≈ $29–39 / month per user | low | **App Live** is the cheap way to let Sree poke a real device of any model; App Automate only before a public launch |
| F. Physical phones in a drawer on the self-hosted runner (B) | real devices in CI, free after purchase | two used phones ≈ $200 once | medium (USB hub, `adb` over TCP, keep screens on) | good value once B exists |

Recommended path: **A now, B right after (Sree's PC), C for monkey on real devices, E App Live for ad-hoc real-model
checks; D/E Automate only if A/B stop scaling.** iOS (D7) waits for an iOS build decision (Q16.12).

## 3. Flow × role × device matrix

Letters are the planned layer per cell: **S** smoke on every PR (D1) · **N** nightly (D2–D4 and dark / font / offline
axes on D1) · **R** role run — the flow executed as that role on the nightly D1 run, asserting the must-not column of
`flows.md` · **M** manual on D5 before a milestone APK · **W** Playwright on D6 · **—** not applicable. Where a cell is
automated today the code from `docs/testing-strategy.md` is in brackets.

| Flow | CR | AD | PL | SP | OU | SO | D1 | D2 | D3 | D4 | D5 | D6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 Sign in / register / forgot | S | — | R | R | R | R (login only) | S [smoke/01], N [full/10] | N | N | — | M | — |
| F02 Claim / link | R | R | R | — | R (refused) | — | N (full/33) | — | — | — | M (two phones) | — |
| F03 Home | S | R | R | R | R (empty) | — | S, N dark, N offline | N | N (font 1.3) | N | M | — |
| F04 New game Players | S | — | — | — | — | — | S [smoke/09] | N (small keyboard) | N | — | M | — |
| F05 New game Game type | S | — | — | — | — | — | S [smoke/09, 16] | N | N | N landscape | M | — |
| F06 Scorecard | S | R | R (view only) | R | R (RLS refused) | — | S [02, 03, 10, 11], N [20, 21] | N (20 players) | N (font 1.3) | N (landscape 20p) | M (realtime) | — |
| F07 Add round Points | S | R | R (no button) | — | — | — | S [04, 14], N [80] | N | N | N | M (two admins, same round) | — |
| F08 Add round Pool | S | R | R (no re-enter) | — | — | — | S [16] | N | N | N | M | — |
| F09 Undo / edit | S | R | R (no button) | — | — | — | S [13], N (full/35) | N | — | — | M (undo vs typing) | — |
| F10 Players / Admins | N | R | R (no options) | — | — | — | N [30, 31, 32] | N | — | — | M | — |
| F11 Log | N | R | R | R | R (refused) | — | N [70] | — | — | — | — | — |
| F12 Complete Points → Final scores → share | S | R | R (Final scores only) | — | — | — | S [05], N [41] | N (share sheet) | N | — | M (real share targets, PDF viewer) | — |
| F13 Complete Pool → Awards → Results | S | R | R (card only) | — | — | — | S [16] | N | N | — | M | — |
| F14 Results | S | R | R (past only) | — | R (W20) | — | S [06, 12, 15], N [40, 41] | N | N (font) | N | M | — |
| F15 My players | S | — | — | — | — | — | S [08] | N (1,000 rows) | N | — | M | — |
| F16 Me / Profile / Settings | S | — | — | — | — | — | S [07] | N | N | — | M (passcode, delete account) | — |
| F17 Help | S | — | R | — | — | — | S [02, 06], N [50] | — | N (font 2.0) | — | — | — |
| F18 Delete / reopen / hidden | N | R (reopen only) | R (no items) | — | — | — | N (full/34) | — | — | — | M | — |
| F19 Public web | — | — | — | — | — | W | — | — | — | — | M (phone browser) | W (Chromium, WebKit, mobile viewport) |

Role runs (R) need accounts for every role in the e2e seed — see [`break-the-app.md`](break-the-app.md) §2 for the roster;
today only `sree` signs in on the emulator, so every R cell is new work.

Links: areas and codes in [`../testing-strategy.md`](../testing-strategy.md) (Testing matrix, PR blocks); flow files in
`e2e/smoke`, `e2e/full`; volume cases in [`../volume-testing.md`](../volume-testing.md).
