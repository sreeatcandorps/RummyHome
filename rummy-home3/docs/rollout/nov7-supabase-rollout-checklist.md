# EZ Score: Rummy — Nov 7 rollout bundle (DB migrations 013/014/015 + passcode-recovery email)

Prepared from branch `cursor/ezscore-apk-ready` (PR #7, base `cursor/add-round-redesign-0a03`). Build the next APK from the branch head; last app-code change is `df0ae14be44a01fae95c02080d07785236580552`, every commit after it is docs/rollout files only (`bcef2457d55efb121ab3aa005379e8f7068a6c13` at export time).
No credentials appear in this bundle. Nothing in this bundle was run against the live project.

## 0. Targets (non-secret identifiers from the repo)

| Item | Value | Where it comes from |
|---|---|---|
| Supabase project ref (current) | `gngcrplcldfiubvhcdin` | `supabase/functions/scorecard/index.ts`, `supabase/functions/send-email/index.ts`, `docs/friday-setup.md`, `docs/testing-strategy.md` (006 was run here), `docs/redesign-proposal.md` |
| Supabase project URL | `https://gngcrplcldfiubvhcdin.supabase.co` | derived from the ref |
| **Stale ref — do not use** | `zbuutuomiucgxrpvwmxz` | only in `reset-password.html` (Oct 29, the old browser reset page the app no longer needs). Flagged so it is not applied to by mistake. **Confirm in the connector that the project you are attached to is `gngcrplcldfiubvhcdin` before running anything.** |
| EAS project id | `076b8018-c964-4819-8331-a65b913d15b6` | `app.json` → `extra.eas.projectId` |
| EAS owner / slug | `mindweave` / `rummy-score` | `app.json` |
| Android package / iOS bundle | `com.mindweavetech.rummyhome` | `app.json` |
| App version | `1.1.0` (`runtimeVersion.policy = appVersion`) | `app.json` |
| Build profile for the next APK | `preview` (`distribution internal`, `android.buildType apk`, `autoIncrement true`, `channel preview`, `EXPO_UPDATES_ENABLED=false`) | `eas.json` |
| Expected next versionCode | 5 (remote `appVersionSource`, auto-increment from build 4) | `eas.json` `cli.appVersionSource = remote` |

## 1. Order of operations

1. Connector auth confirmed → check project ref (section 0).
2. Run `verify/verify_after_apply.sql` **step 6** first and keep the row counts (baseline).
3. Apply `migrations/013_results_privacy.sql`, then `014_save_round_atomic.sql`, then `015_link_seat_to_player.sql`. Each is one SQL-editor run; each is safe to re-run (verified twice on a scratch Postgres 16 loaded with 001–012).
4. Run `verify/verify_after_apply.sql` fully. Step 6 counts must be unchanged (these files create functions only).
5. Auth config (section 4). Then send ONE recovery code to a test account you own and finish the in-app flow.
6. Only then: `eas build --profile preview --platform android` on the parent box (token lives there).

Prerequisites already on the live DB (per repo docs): 001–012 applied; `005` applied (it drops `profiles_id_fkey`, which 011's unregistered players and 015 rely on — `verify` step 4 confirms). `013` can go before or after 011/012; `015` needs 012.

## 2. What each migration does, and the security review

Reviewed against Supabase "Database functions → Secure a database function" (prefer `security invoker`; a `security definer` function must pin `search_path`, check ownership in the body, and have `execute` revoked from `public`/`anon`).

### 013 — results privacy (`can_see_game_result`, re-defines 3 readers)
- Functions only. **No table, row, or policy changes. No data rewrite.**
- `security definer` + `set search_path = public` on all four; every relation is schema-qualified. Execute revoked from `public` and `anon`, granted to `authenticated` only (verified in pg_proc).
- Access rule enforced in the body: app admin, declarer, `is_game_member(game)` for any game in the result, or `games.created_by = auth.uid()` for any game in the result. Not visible: spectator/public-link viewers, strangers. A non-member calling `get_game_result` gets `null` (indistinguishable from "does not exist").
- Return shapes of `get_game_result` / `list_game_results` / `list_game_results_page` are identical to 008/010 (build 4 keeps working). One additive field: each `sheet.games[]` element gains `label: "G<n>"` read from the live `games.game_number`; old builds ignore unknown keys.
- Residual risk (by design): a combined result is visible to anyone connected to **at least one** of its games, so a player in G7 sees the whole G7+G8 result including G8 rows. The declarer chose to publish them together. Tighten in `can_see_game_result` only if wanted later.
- Note: `search_path = public` (not `''`) matches every earlier helper in this project; Supabase's advisor only flags an unset search_path. Not a blocker.

### 014 — `save_round` (atomic round + scores + current_round)
- Functions only. **No data rewrite on apply.**
- `security invoker` (preferred mode): runs as the caller, so existing RLS on `rounds`, `scores`, `games` still applies. Body additionally requires app admin or `is_game_admin(game)` and raises `42501` otherwise.
- Idempotent for a duplicate "Add round" (no second scores insert), reuses an empty live round (the blank-round symptom), and for Edit round retires the old row (`undone_at`, `round_number → 1000·k + n`) and inserts the new one in the same transaction — the same retire scheme the client already uses since build 4.
- Execute: `authenticated` only. Scratch tests: admin save ✔, duplicate submit ✔ (4 score rows, not 8), replace ✔ (old row retired to 1001), empty round reused ✔, non-admin refused ✔.
- Existing blank rounds are **not** touched by applying this; the in-app repair is Edit round on that round. `verify/blank_round_survey.sql` lists them read-only.

### 015 — `link_seat_to_player` (hand an unregistered seat to a registered Player ID)
- Function only on apply. **When an admin later calls it, it rewrites rows** for one game: `game_players.profile_id`, `scores.profile_id`, `rounds.dealer_profile_id` move from the placeholder to the target; `my_players` upsert for the caller; if the placeholder has no games left it is marked `merged`, its pending claim links `revoked`, and the caller's `my_players` row for it deleted. Nothing is deleted from games/rounds/scores.
- `security definer` (needed to touch rows the caller cannot otherwise update) with the checks the doc asks for: signed in; admin of this game; seat is `unregistered`/`pending` **and** `managed_by = auth.uid()` (or app admin); target is a registered, unmanaged account; target not already in the game. Execute: `authenticated` only.
- **Flag (product, not a bug):** the target account is not asked for consent — any game admin who knows a public Player ID can attribute an unregistered seat's scores in their game to that account. This is the behaviour the Nov 6 brief asked for; the scope is one game and the caller must manage the placeholder. If consent is wanted later it is a P3 item, not in this bundle.
- Rollback drops the function; **links already made are not auto-reversed** — `verify/undo_one_link.sql` has the manual reversal (commented out, read-first).

### Anything dangerous? 
- No `drop`, `truncate`, `delete`, or broad `update` on apply in any of the three files. The only writes happen inside RPCs invoked later by an authenticated game admin, scoped to one game.
- No function is executable by `anon` or `public`. None return rows outside the caller's own games except 013's "any connected game" rule above.

## 3. Rollback

| File | Effect | Data impact |
|---|---|---|
| `rollback/rollback_013_results_privacy.sql` | restores the 008/010 reader definitions verbatim, drops `can_see_game_result` | none; **the P1-A leak returns** |
| `rollback/rollback_014_save_round_atomic.sql` | drops `save_round`; the app detects `PGRST202` and uses its self-healing multi-request save | none; rounds already saved stay valid |
| `rollback/rollback_015_link_seat_to_player.sql` | drops `link_seat_to_player`; the app shows "needs a database update" | none for the function; past links need `verify/undo_one_link.sql` by hand |

All three rollbacks and a re-apply afterwards were exercised on the scratch DB (`scratch-validation/`).

## 4. Auth configuration for in-app passcode recovery (dashboard / Management API, no SQL)

The app flow: `resetPasswordForEmail(email)` → user types the emailed 6-digit code → `verifyOtp({ email, token, type: 'recovery' })` → `updateUser({ password })`. Profile → Change passcode calls `updateUser` and, if the project demands it, `reauthenticate()` + nonce.

| # | Setting | Required value | Why | Management API key (PATCH `/v1/projects/gngcrplcldfiubvhcdin/config/auth`) |
|---|---|---|---|---|
| A | Authentication → Email Templates → **Reset Password** body | contents of `auth-template/recovery-passcode.html` (keeps `{{ .Token }}` **and** `{{ .ConfirmationURL }}`) | `{{ .Token }}` is the 6-digit OTP the app verifies; the link stays as a fallback for build-4 phones | `mailer_templates_recovery_content` |
| B | Reset Password **subject** | e.g. `Your EZ Score: Rummy passcode code` | | `mailer_subjects_recovery` |
| C | OTP length | **6** (Supabase default) | the app's code field is 6 digits | `mailer_otp_length` |
| D | OTP expiry | ≤ 3600 s (default 3600; 600–900 recommended) | shorter window for a 6-digit code | `mailer_otp_exp` |
| E | Password policy: minimum length | **6** (default) — do not raise | passcodes are 6 digits | `password_min_length` |
| F | Password policy: required characters | **none** (`""`) | passcodes are digits only; "letters and digits" would reject every passcode | `password_required_characters` |
| G | **Custom SMTP** (Authentication → SMTP Settings) | **must be ON** with a real provider (Resend is already used by `send-email`) | Supabase's built-in SMTP sends **only to the organisation's team-member addresses** and is capped at **2 emails/hour**. Without custom SMTP, recovery codes to real players fail with "Email address not authorized". | `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_admin_email`, `smtp_sender_name` (values stay on the parent box) |
| H | Rate limit: emails sent | default after custom SMTP is 30/h; raise if a game night has many resets | | `rate_limit_email_sent` |
| I | "Secure password change" (require recent login / reauthentication) | either; the app handles the nonce path | | `security_update_password_require_reauthentication` |
| J | URL Configuration → Redirect URLs | keep the existing `EXPO_PUBLIC_AUTH_REDIRECT_URL` entry (GitHub Pages) so the fallback link in the email still resolves for build-4 phones | | |

Verification (one real send, to an address you own): request a code from the app's Forgot passcode screen → email arrives with a 6-digit code (not only a link) → enter code + new passcode → sign in with it → Profile → Change passcode round-trip. Then confirm Auth logs show `recovery` → `verified` → `password changed`.

Security trade-off to acknowledge once: Supabase recommends ≥ 8 chars with mixed classes; this product is a 6-digit passcode by design (≈10⁶ guesses). Mitigations in place: Supabase's built-in sign-in rate limits and the OTP being single-use. Leaked-password protection does not apply to digit-only codes.

## 5. Release readiness (no token needed; done on the build box)

- Branch `cursor/ezscore-apk-ready`, head `bcef2457d55efb121ab3aa005379e8f7068a6c13` at export (last app-code change `df0ae14be44a01fae95c02080d07785236580552`), pushed to `origin`.
- `npx tsc --noEmit` clean; `node --import tsx --test tests/*.test.ts` → 203 passing.
- `npx expo-doctor` → 18/18 checks passed. `npx expo config --type public` resolves version `1.1.0`, owner `mindweave`, projectId above.
- No new native dependencies since build 4 (the Nov 6 work is TS/SQL only), so a `preview` build from this SHA is a drop-in for the same runtime version. `EXPO_UPDATES_ENABLED=false` on preview, so phones get the new code only via the APK.
- Parent-box command (unchanged): `cd rummy-home3 && eas build --profile preview --platform android` → versionCode auto-increments to 5. EAS env vars `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the `preview` environment must still point at `gngcrplcldfiubvhcdin` (check with `eas env:list --environment preview`, values redacted).

## 6. Blockers / not done here

1. Supabase connector authentication (parent) — nothing in sections 1–4 has been executed.
2. Custom SMTP state is unknown from the repo; if it is off, recovery emails to non-team addresses will fail (section 4-G).
3. Native (Android) pass after the APK: share-sheet crash fix, Final scores / Results image capture, PDF share, and the real recovery email on a phone.
4. Not re-runnable (pre-existing, informational): `011_player_identity.sql` cannot be re-applied after `012` ("cannot change return type of list_my_player_links"). It is already applied on the live DB; do not re-run 011.
