# Guardrails

Server-enforced limits with friendly messages (migration `029_guardrails.sql`, Nov 12). Every
value lives in one table, `public.guardrails`, so a limit can be tuned later with one `update`
and no new build. The limits are enforced by `BEFORE` triggers on the tables themselves
(`my_players`, `game_players`, `rounds`, `games`, `player_links`), so the app's inserts under
RLS, the RPCs (`add_my_player`, `save_round`, `request_player_link`, …) and a script holding a
user's token all meet the same refusal. The UI only repeats the message.

A refusal is a Postgres error with SQLSTATE **`GRD01`**, the message from the table, and the
hint `guardrail:<key>`. The app (`utils/guardrails.ts`) recognises `GRD01` and shows the
message as is; it also mirrors the defaults so the local (no Supabase) prototype enforces the
same caps and so the app can say the same thing without a round trip where it already knows
the count (seat cap on the New game screen).

## Limits

"Per day" is a rolling 24 hours counted on `created_at`, so no timezone is involved.

| Key | Default | Counts | Message shown |
| --- | --- | --- | --- |
| `my_players_max` | 1,000 | Active (not removed) rows in My players per owner. Undo (restore) counts as an active row. (Was 2,000; lowered by Sree, Nov 12.) | You've reached your limit of 1,000 players. |
| `players_added_per_day` | 100 | New My players rows per owner in the last 24 hours: Add by Player ID, Add by name (new unregistered player), and playing together for the first time. Restoring a removed player does not count. | You added 100 players today. Try again tomorrow. |
| `players_per_game` | 20 | Active, seated, non-spectator rows per game. A non-playing admin does not count until seated. Also the New game and Add player cap in the app (`MAX_SEATED_PLAYERS`). | A game holds at most 20 players. |
| `rounds_per_game` | 500 | Rounds per game that are not undone. Edit round undoes the old row before inserting, so editing round 500 still works. | This game has reached 500 rounds. Create a new game to keep playing. |
| `live_games_per_user` | 10 | Games per creator with `status = 'active'`, not deleted, not closed. Completing, closing (Save result) or deleting a game frees a slot. | You have 10 live games. Finish or close one first. |
| `games_per_day` | 50 | Games per creator in the last 24 hours, deleted ones included. | You created 50 games today. Try again tomorrow. |
| `link_requests_pending` | 20 | Pending `player_links` rows per owner: link requests (025) and invites. Sending a request for a player who already has one replaces it, so that does not add. | You have 20 link requests waiting. Wait for an answer or cancel one first. |
| `email_per_day` | 90 | Outbox rows the `send-email` flush sends per rolling 24 hours (Resend's free tier allows 100). | (not shown; rows wait, see below) |
| `email_per_flush` | 50 | Outbox rows one flush run delivers. | (not shown) |

### Tuning

```sql
update public.guardrails set value = 30, updated_at = now() where key = 'live_games_per_user';
```

The triggers read the table on every check, so the new value applies at once. The message text
is static (it names the shipped number), so change `message` in the same statement when the
number changes. Re-applying the migration keeps tuned values (it only refreshes `message` and
`description`); `rollback_029_guardrails.sql` drops the table and the triggers.

Where the app shows a limit before asking the server (the 20-seat cap on New game), the number
is `GUARDRAILS` in `utils/guardrails.ts`; a server tuned above the app's number is simply more
permissive on paths the app does not pre-check.

## Failure modes

| Situation | What happens |
| --- | --- |
| **Offline** (no network) | Reads come from the on-device copy (`queryCache` + AsyncStorage: Home, My players, the open scorecard). Writes fail with "Network error — check Wi‑Fi…" and nothing is half-saved: every write is one RPC or one insert, and `save_round` is a single transaction. The user retries when back online; a round saved twice is a no-op on the server (same payload) so the retry is safe. Guardrail counts are not checked offline; the server checks them on the retry. |
| **Email provider down** (Resend unreachable or 5xx) | The game or result is already saved; email is best effort and never blocks a save. The row stays in `email_outbox` with `last_error`, `attempts + 1` and `next_attempt_at` pushed out (5 min, 10, 20, … capped at 24 h). The next flush (any later Start game or Save result by anyone) sends what is due. Nothing is dropped; the old 5-attempt cap is gone. `select * from public.email_outbox_backlog()` shows waiting / due / failing (3+ attempts) / oldest. |
| **Email rate limit** (Resend 429) | The failing row waits a minute (or a day when the answer names the daily quota), the flush stops for this run, the other rows keep their `next_attempt_at` and go on the next flush. |
| **Email daily cap** (`email_per_day`, 90 of Resend's 100) | The flush counts rows with `sent_at` in the last 24 hours and sends only up to the remainder, oldest first; the rest wait for the window to roll. The response says "Daily email cap reached (90). N waiting for the next window." The app does not surface this: the game link and the result page are shared in-app regardless, and the email arrives later. There is no scheduler: a backlog goes out on the next flush trigger (Start game / Save result anywhere). If the app ever goes quiet for a day with rows waiting, a `pg_cron` job calling the function once an hour is the one-line fix; it is not part of this change. |
| **Slow database** | Requests are wrapped in `withTimeout` (12 s) where a hang would block the UI: the screen shows Retry instead of a spinner. `save_round` is idempotent, so a retry after a timeout whose first attempt actually landed returns the same round and does not double it. Guardrail counts are indexed lookups (`my_players(owner_id)`, `game_players(game_id)`, `rounds(game_id)`, `games(created_by)`, `player_links(owner_id)`), one per insert plus an advisory lock; timings at 1,000–10,000 My players / 500 rounds are in `docs/volume-testing.md`. |
| **Duplicate taps** (Save round, Start game, Add player, Send request twice) | Save round: the same payload for an already saved round is a no-op (`save_round`, 019); the app also disables the button while saving. Start game: the Home bundle is refreshed before a second create lands; a true double create is two games and counts twice toward `games_per_day` / `live_games_per_user`, which is what the limits are for. Add player: `add_my_player` is `on conflict … do update`, one row. Send request: the second request replaces the first (`request_player_link` cancels the pending one). Email: `event_key` is unique and is the Resend Idempotency-Key, so a double flush sends once. |
| **Two admins** scoring the same game | `save_round` takes a per-game advisory lock; the second save of the same round with different scores is refused with `PT409` ("Round N was just saved by someone else. The scorecard has been refreshed; check it before you save again.") and the app refreshes. The same scores twice is a no-op. Two admins adding a player at once: each guard trigger takes a transaction advisory lock on its scope (`guard:game_players:<game>`, `guard:games:<creator>`, …) before counting, so the two inserts count one after the other and a 21st seat is refused even when both start at 19. |
| **Two creators at once** | Game numbers (028) are assigned under `pg_advisory_xact_lock(hashtext('games.game_label'))`, so two games created in the same instant get different labels; the `games_0_guard` trigger runs first (alphabetical trigger order) so a refused game never takes the lock. |
| **Script with a user's token** | Meets the same triggers as the app: `GRD01` with the message. `guardrails` is readable (select) by signed-in users and writable by nobody but the service role; `guardrail_refuse`, `email_sends_left_today` and `email_outbox_backlog` are not executable by `authenticated`. |
| **Older APK** (before this build) | No function changed its signature or column list. The old app shows the refusal in the place it would show any other error (red text under the form); its own seat cap is 15, below the server's 20. |

## Checks

- pgTAP `supabase/tests/19_guardrails_029.sql` (60 checks): defaults and messages, grants, trigger order, each limit refused and allowed at a lowered value, the real 1,000 My players, the 2,000 → 1,000 default bump on a re-run (a tuned value kept), restore-counts-but-is-not-an-addition, undone rounds excluded, deleted/closed games free a slot, email backoff columns and counters.
- Unit `tests/guardrails-029.test.ts`: the app mirrors the server numbers and wording, `GRD01` detection, the local prototype's caps, the email retry rule and the flush source, and this document.
- Rollback replay (`ci/db/replay-rollbacks.sh`): rollback 029 → 013, re-apply all, second apply is a no-op.
