# Delete account with a 30-day grace (D72)

> **Status (Nov 23):** decided, not built. Sree on the Q14 recommendation: *"Okay, that's fine. Make sure you
> build this after Google approves the current review."* Nothing here is coded or migrated until Google approves
> the submission that is in review now **and** Sree says go. Mockup: `design-review-2/mockups/delete-grace-dialogs.png`.

## 0. What Sree said → what this is

| Sree (Nov 23, verbatim) | Read as |
| --- | --- |
| "What was the idea behind delete account?" | Google Play's account-deletion policy: an in-app path plus a web link that really delete the account's data. Declared in the Data safety form; `/delete-account` page; migration 026. |
| "allow for a player to unregister themselves … so they can't be found in the database" | Already true of 026: `search_players` returns only `registered` profiles. The grace keeps that from the first second. |
| "your passcode won't work anymore. If you ever change your mind, you can always come back" | The opposite of the first half, the whole of the second: the passcode **keeps working** for 30 days, and signing in *is* coming back. Forgot passcode works as usual. |
| "delete is a scary thing … What if the user can lose all his data?" | Nothing is erased for 30 days; the dialog says the date. Shared scorecards never lose his name (026 rule, unchanged). |
| "Make sure you build this after Google approves the current review." | The reviewer must see the flow we declared. Build after approval, redeclare "up to 30 days" in Data safety with the next submission. |

Industry standard it follows: Instagram / Facebook / Snapchat 30 days, Discord 14, Apple ID up to 7 — the account is
deactivated at once and signing in cancels the deletion. Shared content stays under the name (Reddit, Slack, Splitwise).

## 1. The three moments

1. **Profile › Account › Delete account** → one dialog (no checkbox — the date replaces "I understand. This cannot be undone"):
   *Your account is **deactivated right now** and deleted for good on **{date}**. Until then nobody can find you, you get
   no invites or emails, and you are signed out everywhere. Your name stays on scorecards you played with other people.
   Change your mind? **Sign in before {date}** and everything is back — your passcode keeps working.* — **Cancel** / **Delete account** (red).
2. **Right after**: signed out everywhere, Sign in screen, one toast: *Account deactivated. It is deleted for good on {date}
   unless you sign in before then.*
3. **Signs in within 30 days** → one dialog before anything else: *Welcome back, {first name}. Your account was due to be
   deleted on {date}. Keep it?* — **Delete now** (red text) / **Keep my account** (filled, default). Keep clears the status;
   Delete now runs the tombstone immediately (today's behaviour).
4. **Day 30**: a nightly job tombstones every `deactivated` profile whose date has passed (026 `tombstone_profile`, unchanged).

## 2. While deactivated

| Surface | Behaviour |
| --- | --- |
| Find in database (`search_players`, `search_my_players`) | not returned (status is not `registered`) |
| Invites, link requests, game / result emails | none queued; `email_outbox` rows for this profile are skipped by the flush |
| Other players' scorecards and results | unchanged: name, initials, scores stay (as 026 already does after a delete) |
| Admin of a game | stays on paper until day 30; the game works for the others as if the admin were offline. On day 30, 026 promotes the next registered player |
| Sessions | every refresh token revoked at step 1 (`auth.admin.signOut(user, 'global')` from the RPC's edge call, or 026's existing session delete) |
| Sign in | allowed — it is the undo. OTP (Forgot passcode) also allowed |
| Web `/delete-account` | adds "Your account is deactivated at once and deleted after 30 days. Sign in before then to keep it." |
| Privacy policy, Play Data safety | "deleted within 30 days" (Play accepts a disclosed grace period) |

## 3. Data and migration (05x, after approval)

- `profiles.player_status` gains `deactivated`; `profiles.delete_after timestamptz`.
- `delete_my_account()` (026) becomes: set `deactivated`, `delete_after = now() + 30 days`, revoke sessions, return the date. A new `delete_my_account_now()` keeps today's immediate tombstone for *Delete now*.
- `keep_my_account()`: `deactivated` → `registered`, `delete_after = null`. Called by the app after the Welcome-back dialog; also what any successful sign-in on a `deactivated` profile offers.
- Nightly `pg_cron` job (same pattern as 045): `select public.tombstone_profile(id) from profiles where player_status = 'deactivated' and delete_after < now()`.
- `search_players`, `search_my_players`, the invite / e-mail enqueue functions already filter on `registered`; the Supabase trigger from 005 (dashboard delete = support path) is unchanged.
- Rollback: the 05x down-file flips `deactivated` rows back to `registered` and drops the column and the job. No data is erased by the up-file.

## 4. App

- `components/account/DeleteAccountDialog.tsx`: body from `utils/accountDeletion.ts` with the date; checkbox removed; red filled action.
- `app/(auth)/login.tsx` (and the OTP path): after sign-in, if the profile is `deactivated`, show `WelcomeBackDialog` before routing Home.
- Toast copy on Sign in after sign-out.
- Help › Account topic: one paragraph. `e2e/smoke/07-profile.yaml`: the delete step now asserts the toast and the date.

## 5. Out of scope

- A separate Deactivate button (D50: one button, fewest states).
- Choosing the grace length (30 is the common number; Play does not set one).
- Erasing a player's name from other people's scorecards (the 026 rule stands).

## 6. Decisions

- **D72** (Nov 23): this document. Supersedes nothing — 026's immediate delete stays live until this ships.
- Open: none. Build trigger = Google approves the current review + Sree's go.
