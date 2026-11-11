# Gap analysis: what is not tested

Read with [`inventory.md`](inventory.md). Severity is about the chance that a defect reaches Sree's table on a game night, not about code size. "Caught today by" says which existing layer would notice, if any.

## Summary table

| Area | Caught today by | Gap | Severity |
|---|---|---|---|
| End-to-end workflows on the app | Web screenshots (fixture data, one user, hand-driven) | No scripted flow runs twice the same way; no native run at all | High |
| Real Supabase auth and email OTP | Fake GoTrue on localhost; unit tests of `passcodeFlow` | Real sign-up confirmation, real recovery OTP via Resend, dashboard template, rate limits — never exercised by a machine | High |
| RLS and multi-user permissions | Client-side role rules in unit tests; `friday-rls.mjs` (unrunnable against prod); one-off scratch `psql` for 013–017 | No repeatable test executes the policies and RPCs as several JWT users; the one P1 leak this cycle was exactly this | High |
| Concurrency | Nothing | Two admins saving the same round number; two people declaring the same games; add-seat during a save; retried submit after timeout | High |
| Realtime | Nothing | Subscriptions in `services/realtime.ts` never asserted; reload-on-change is what broke the ⋮ menu | Medium |
| Offline / flaky network | `withTimeout` unit test; "Retry" copy | No airplane-mode or dropped-request scenario on any layer | Medium |
| Native-only behaviour | Nothing (web only) | Keyboard/autofocus, share sheet return, `react-native-view-shot`, `expo-print`, `LayoutAnimation`, back button, deep links `rummy-home3://claim?t=` | High |
| Performance | Source check that scorecard doesn't double-fetch | No timing budget on Home load, picker, 20-game results image, PDF generation | Medium |
| Upgrades | Config tests for EAS Update flags; migrations re-runnable (text) | No install-over-old-APK test, no "old client against new DB" test, no data migration test with real rows | Medium |
| Component rendering | Nothing (regex over source instead) | Zero rendered-component tests; Paper/Expo Router behaviour is unverified until a human taps | Medium |
| Migration execution | One-off scratch Postgres, scripts not committed | Cannot re-verify 001–017 apply cleanly from empty, nor that `rollback_*` restore the previous body | Medium |
| Edge functions (`scorecard`, `send-email`) and static `scorecard.html` | Placeholder check only | Never invoked by a test; the 8-second public page refresh is manual | Low–Medium |

## 1. End-to-end workflows

What exists: a human (agent) tapping the Expo web build with seeded local fixtures and taking screenshots; Maestro YAML that was never run and is stale (wrong `appId`, three renamed labels).

Not covered:

- Any workflow run against a real Supabase (local or branch) end to end: register → confirm → sign in → new game → score → complete → results → share.
- Any workflow on Android. All of PR #7's native paths — share sheet, image capture, PDF, keyboard — are marked "needs a phone pass" in the PR itself.
- Repeatability. Screenshots are not regenerated on change, so a regression after the screenshot was taken is invisible.
- The second-user half of every multi-user flow (invite → register → "Is this you?" → Yes; link seat → target sees the game; declared result opened by another participant).

## 2. Real Supabase auth and email OTP

Covered: `utils/passcodeFlow.ts` against a fake client (14 tests); the recovery HTML template has `{{ .Token }}` and no `<a>`.

Not covered:

- Sign-up with **Confirm email ON** (production setting; the register screen's "Check your email" path). None of the scripts can even sign in under that setting.
- The recovery email as actually sent: Resend SMTP, template pasted into the dashboard, subject, OTP length 6 / expiry 900 s. The repo cannot see dashboard state; the PR says "new app-only template still to paste".
- OTP autofill from the notification (`autoComplete="sms-otp"` / `textContentType="oneTimeCode"`) — Android-only behaviour.
- Rate limits: Supabase's `rate_limit_email_sent` (30/h after custom SMTP) and sign-in attempt limits under a 6-digit passcode.
- Session persistence across app restart and across an APK upgrade (AsyncStorage token refresh).
- "Secure password change" reauthentication path against a real project (only the fake was exercised).

## 3. RLS and multi-user permissions

Covered: client mirror functions (`gameVisibleToUser`, `canEnterScores`, `canSeeResult`, `linkTargetProblem`, `canRemoveSeat`) and regex checks that the SQL mentions `is_game_admin`, `security definer`, `revoke ... from anon`.

Not covered, and this is where the Nov 6 P1 leak lived:

- Executing `list_game_results_page`, `get_game_result`, `list_visible_game_ids`, `list_new_game_candidates`, `list_my_players`, `save_round`, `link_seat_to_player`, `remove_seat_if_no_scores`, `public_scorecard` as **each** of: creator-not-playing, game admin, seated player, viewer, outsider, anon, app admin.
- Table-level policies on `profiles` (post-011: only own row, players I manage, players I've played with), `games`, `game_players`, `rounds`, `scores`, `my_players`, `player_links`, `game_results`.
- Negative paths the phone test can't reach: a non-admin calling an RPC directly with a crafted request, an outsider guessing a 6-character `share_code`.
- The "owner excluded by `auth.uid()`" class of bug: RPC return sets checked against the calling user's own identity.
- The documented manual checklist [`rls-verification.md`](https://github.com/sreeatcandorps/RummyHome/blob/cursor/ezscore-apk-ready/rummy-home3/docs/rls-verification.md) has never been automated.

## 4. Concurrency

Nothing tests two sessions acting at once. Concrete scenarios with no coverage:

| Scenario | What should happen | Risk today |
|---|---|---|
| Two admins both press Save round for round 7 within a second | One wins; the other sees the saved round, no duplicate, no 23505 to the user | `save_round` (014) handles the duplicate-submit case for the **same** payload; two different payloads for the same round number are not specified |
| Admin A edits round 3 while admin B adds round 8 | Both land; retired row numbering (`1000·k + n`) doesn't collide | Untested |
| Admin adds a mid-game player while another admin is in score entry | New seat gets zeros for played rounds; the open score-entry screen either refreshes or refuses with a clear message | Untested; score-entry reducer has no "roster changed" input |
| Two people press Declare on the same completed games | One result; the second gets "already in another result" | Only the warning copy is tested |
| Same account on two phones (Sree's phone and tablet) | Realtime keeps both in step; no double round | Untested |
| Save round while the connection drops after the request is sent | Round exists once; retry is a no-op | This produced the blank round 6; 014 fixes it by design, but no test reproduces the drop |

## 5. Realtime

`realtimeService.subscribeToGame` listens on five tables and reloads the whole game. Not covered:

- That a change by user B appears on user A's scorecard at all (no two-client test).
- Reload-on-change interacting with open UI (the dead-menu bug came from a re-render mid-animation).
- Subscription teardown on navigate-away / sign-out (channel leak, stale callbacks writing into `gameCache`).
- Realtime being **disabled** for a table in the dashboard (publication membership is project config, not in the repo).
- The public `scorecard.html` 8-second poll.

## 6. Offline and flaky network

Covered: `withTimeout` resolves/rejects; "Retry" copy exists; `gameCache` serves a stale copy.

Not covered:

- Cold start with no network → error with Retry (listed in `testing-strategy.md` as manual).
- Airplane mode during Save round, during Remove player, during Declare; what the user sees and what is in the DB afterwards.
- Expired JWT after a long idle at the table (token refresh with `autoRefreshToken`).
- Clock skew path (`isClockSkewError`) beyond the message mapping.

## 7. Native-only behaviour (Android)

All of these are listed as Partial or "needs a phone test" in `CHECKLIST-NOV9.md` and PR #7:

- Keyboard opens on the **first** tap of the passcode cells; cursor lands in Email on launch; OTP box autofocus (Android ignores `autoFocus` mid-transition; code works around it with a post-layout focus).
- Number pad vs full keyboard for OTP and passcode; paste of "48 29 13".
- Share sheet: `Share.share` (invite, Player ID), `Sharing.shareAsync` (image, PDF); returning to the app without a crash; ⋮ menu still works after (`useMenuThenShare` + `AppState`).
- `react-native-view-shot` capture of Final scores and Results sheets at the intended pixel size; `expo-print` PDF of the 20-game details.
- `LayoutAnimation` on the player picker (needs `UIManager.setLayoutAnimationEnabledExperimental` on old architecture; behaviour differs on new architecture).
- Hardware back button on every screen: picker in add mode (staged picks lost?), score entry with a pending number, Complete game's second confirmation, the Results preview. No `BackHandler` in the code base, so it is whatever Expo Router does by default — never asserted.
- Deep link `rummy-home3://claim?t=…` and the web `get` page's "Open in app" into a cold app.
- Rotation of the scorecard (listed manual in `testing-strategy.md`).
- APK upgrade over the previous build keeps the session and local draft.

## 8. Performance

No budgets, no measurements. Candidates with user-visible risk: Home first paint with `list_visible_game_ids` + games (noted in `redesign-proposal.md` as the call that "can sit there"), New game picker with 100+ candidates, Results with 20 games × 15 players (image draw and PDF print), realtime reload storm during fast scoring.

## 9. Upgrades

- App: tests assert `EXPO_UPDATES_ENABLED=false` for preview, but nothing installs build N+1 over build N and checks session, draft, and that the JS is the embedded one (the A7 symptom).
- Database: migrations 011–017 are "safe to re-run" by text inspection. Nobody applies the **full** 001→017 chain from an empty database automatically, and 011 is known not to be re-runnable after 012. Rollback files were exercised once by hand.
- Compatibility: an older APK (build 4) talking to a DB with 013–017 applied — the PR argues it is additive; no test.

## 10. Rendered components

There is no React test renderer or `@testing-library/react-native` in `devDependencies`. Every UI assertion is either a regex over `.tsx` or a human looking at a web screenshot. Behaviour that lives in Paper/Router internals (Menu lifecycle, Dialog dismissal, tab focus) has no automated check at all.

## 11. Edge functions and static pages

`supabase/functions/scorecard`, `supabase/functions/send-email`, `public/scorecard.html` and `public/get/index.html` have no test beyond "placeholders, not keys". The welcome email and the public live page are game-night features.

## Top gaps, ranked by game-night risk

1. **No repeatable multi-user permission test.** The only P1 of the cycle (results leak) was an RLS bug; 016 and 017 are new security-definer functions waiting to be applied with the same kind of one-off verification.
2. **No native run of anything.** Every item still open on PR #7 is Android-only: keyboard, share sheet, image/PDF capture, menu after share, APK not reverting.
3. **No concurrency or dropped-connection test** for `save_round`, even though the blank round was the worst scoring bug seen.
4. **Real auth never exercised by a machine** — sign-up confirmation and the OTP email depend on dashboard state no test can see.
5. **Web screenshots are not regenerable**, so UI regressions after a screenshot are invisible until a phone pass.
6. **Migration verification scripts are not in the repo**; the chain 001→017 cannot be replayed.
