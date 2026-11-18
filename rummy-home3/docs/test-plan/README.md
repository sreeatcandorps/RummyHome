# Test plan (PR 16) — index

Approved by Sree on Nov 14 (Android-only, budget OK, infrastructure first). **PR 17 builds it** — see "Status" below; this folder stays the plan. The existing per-PR
reference stays `../testing-strategy.md` (areas, codes, PR blocks); this plan adds the flow view, the role and device
axes, the automation tiers and the break-the-app programme, and links back to those codes.

| Part | File | What is in it |
| --- | --- | --- |
| 1 | [`flows.md`](flows.md) | the 19 flows F01–F19, each with a mermaid diagram and the rendered PNG ([`flows/`](flows/)), who may run it and who must not, warnings touched, what is automated today |
| 2 | [`coverage.md`](coverage.md) | screens → flows (30 routes) and warnings / dialogs / toasts → flows (38 codes W01–W38), gaps named with the flow that closes them |
| 3 | [`devices.md`](devices.md) | device classes D1–D7, tooling options with cost and effort, the flow × role × device matrix |
| 4 | [`automation.md`](automation.md) | tiers T0–T4, change-based selection table, flakiness policy |
| 5 | [`break-the-app.md`](break-the-app.md) | current testing setup (accounts, seed, CI jobs, volume, emulators, gaps), proposed roster / seed / volume / chaos / fuzz / role runs, live visibility from Sree's PC, bug reporting to GitHub issues and the project board, build order |

## Status (PR 17, test infrastructure)

| Plan item | Built in PR 17 | Still open |
| --- | --- | --- |
| Roster of test users + Points / Pool seed games (`break-the-app.md` §3.1–3.2) | `supabase/seed-break.sql`: 38 accounts, 63 placeholders, 47 games | — |
| Chaos C16-1..10 (§3.4) | `e2e/chaos/c01–c10` + runner hooks `--net-off`, `--kill-after`, crash detection, video | C16-3 concurrent edits is the two-device race; soak is T4 |
| Fuzz (§3.5) | `ci/chaos/monkey.sh` (1.5k PR / 5k nightly / 20k pre-release) | Firebase Robo needs a Google Cloud project (Sree) |
| Role runs (§3.6) | `e2e/roles/r01–r04` | SP on every flow; CR vs AD on Complete |
| Device matrix D1–D4 (`devices.md`) | `ci/select-tests.mjs` DEVICES: Pixel 6, Pixel 4a API 30, Pixel 7 Pro font 1.3, Pixel Tablet landscape | D5 real phones, D6/D7 iOS (Q16.4: Android-only) |
| Two emulators, concurrent edits (§3.7) | `ci/ui/run-two-device.sh` + `e2e/two-device/*` | — |
| Tiers and change-based selection (`automation.md`) | `select` job: PR / nightly / pre-release; area → flows map; `[ui-all]`, `[tier:…]`, `[file-bugs]` tags | screenshot regression (Q16.14), Playwright `/r/` (T16-6) |
| Live view from Sree's PC (§4) | gh-pages dashboard: history, screenshots, videos, Live panel over the Actions API | GitHub Pages must be switched on once; App Live / Maestro Cloud / self-hosted runner are flagged, not started |
| Bug filing (§5) | `ci/report/file-bugs.mjs`: issues `bug` + `found-by-tests`, de-duplicated; board add attempted | board auto-add rule (Q16.8) or a `PROJECTS_TOKEN` |
| Volume (§3.3) | `volume` job, pre-release tier: the existing `run-volume.mjs` size ladder + new `run-stress.mjs` V1–V5 (latency budgets, 8 clients, 500-round guard) | 20 × 500 on a device, 30 × 20 result |

## Headline numbers

- Today: 483 unit tests, 33 pgTAP files, 10 concurrency cases, 16 smoke + 13 full Maestro flows on one emulator, 19 volume cases (no device), 1 sign-in account on the device, 0 chaos / fuzz, 0 auto-filed bugs.
- Plan: 19 flows × 6 roles × 7 device classes; 38 warnings all mapped; 10 chaos attacks; 4 device profiles nightly; Robo on real devices; video of every failing flow; issues filed and boarded automatically.

## Test codes (reserved in `../testing-strategy.md`, PR 16 block)

| # | Kind | What it proves |
| --- | --- | --- |
| T16-1 | U | `coverage.md` lists every route in `app/` and every `Dialog.Title` / `NoticeDialog` / `Alert.alert` / `Snackbar` string; zero gaps after the legacy-route decision |
| T16-2 | U | `flows.md` diagrams render (mermaid parse) and every `Fxx` has a PNG; every W code in a flow exists in `coverage.md` |
| T16-3 | N | role runs: each R cell of the matrix — the must-not assertion for CR / AD / PL / SP / OU on D1 |
| T16-4 | N | device matrix D2–D4: smoke set on each profile, screenshots compared to the approved set |
| T16-5 | T3 | chaos C16-1..10 green; `adb monkey` 20,000 events no crash; Robo run no crash |
| T16-6 | S | Playwright `/r/` scorecard and result pages (Chromium + WebKit, phone viewport); wrong token → not found |
| T16-7 | T3 | volume L3 with a device in the loop: 20 × 500 scorecard opens < 2 s on D2; Results 30 × 20 renders < 3 s |
| T16-8 | U | `ci/select-tests.mjs` maps every path in the repo to a flow set (no unclassified source path) |

## Questions for Sree (recommended answer first)

- **Q16.1** Are the 19 flows the right cut (F01–F19 in `flows.md`)? Anything you do on the phone that is not in one? Recommended: accept; add a flow when a feature PR adds a screen.
- **Q16.2** Roles: is **spectator / view-only (SP)** still a real role you give people, or is "player who is not an admin" enough? Recommended: keep SP as a test role (RLS covers it) but do not add UI for it.
- **Q16.3** Device classes: agree D2 (small / old, API 28–30), D3 (large, font 1.3), D4 (tablet landscape) nightly, D1 on PRs? Recommended: yes.
- **Q16.4** iOS: do we start an iOS build (EAS, Apple developer account $99 / year) before go-live, or Android-only launch? Recommended: Android-only launch; iOS after the first month; keep `/r/` pages tested on Safari (WebKit) so iPhone family members can watch.
- **Q16.5** Tooling: A (GitHub emulator matrix) + B (self-hosted runner on your PC) + Firebase Robo free tier + BrowserStack App Live on demand. OK to budget ≈ $25–40 / month for runner minutes and App Live? Recommended: yes.
- **Q16.6** Self-hosted runner on your PC: are you willing to install Android Studio, Java 17, Maestro and the GitHub runner service (one-time, ~1 hour of your time, scripted)? Recommended: yes — it is the only truly live view.
- **Q16.7** Nightly should also run on the **top of the PR stack** (today only `ezscore-apk-ready` and `main`). Recommended: yes, a `nightly-ref` repository variable the agent updates.
- **Q16.8** Project board: use the board's own "Auto-add" workflow on the `bug` label (no token) rather than giving CI a `PROJECTS_TOKEN`? Recommended: auto-add.
- **Q16.9** Legacy routes `settle`, `sessions/[id]`, `games/history`, `players/index`, `players/new`: delete now (zero-gap coverage) or keep behind the flag? Recommended: delete `players/index`, `players/new`, `games/history` if unreachable; keep `settle` / `sessions` behind `settleEnabled` and out of coverage.
- **Q16.10** Chaos severity: is "one duplicate round from a double tap" an S1 (blocks APK) for you? Recommended: yes, S1 — scores are the product.
- **Q16.11** Fuzz corpus: may the monkey and Robo runs use the seeded `c1` account on the **local** CI database only (never the hosted dev project)? Recommended: yes, local only.
- **Q16.12** Real devices: buy two used phones (≈ $200) for the drawer on the self-hosted runner, or use your own two phones by USB when you are at the PC? Recommended: your phones first; buy later if the drawer is needed daily.
- **Q16.13** Crash reporting in the app (Sentry free tier, 5k events / month) so field crashes reach us? It is a new dependency and a privacy line in the Play listing. Recommended: yes, opt-in in Settings, before go-live.
- **Q16.14** Screenshot regression: approve a set of 12 key screens as the baseline after PR 15a, and treat any pixel diff > 0.5 % as a nightly failure? Recommended: yes, after 15a.
- **Q16.15** Who triages auto-filed bugs each morning — the agent (reproduce, attach flow, propose fix PR) with you deciding severity on the board? Recommended: yes.
- **Q16.16** Order: build the test infrastructure (break-the-app §5 steps 1–3) **before** PR 11 / PR 14 app code, so those builds land on the new net? Recommended: yes — steps 1–2 first, then PR 15a, then the feature builds, chaos (step 3) alongside.

## Build order recommendation

`break-the-app.md` §5: seed + Playwright + coverage test → device matrix + video + role runs → chaos + monkey + Robo →
self-hosted runner (Sree) → bug filing + board → weekly soak. Each step is one PR with its own tests, none needs a
migration.
