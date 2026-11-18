# Realtime And Offline Behavior

## Realtime

The scorecard subscribes through `services/realtime.ts` to one channel per game:

- `games` (the row, by id)
- `game_players` (by game)
- `rounds` (by game)

A saved round touches all three within milliseconds; the screen reloads once per burst (400 ms trailing
debounce) from the service layer. This keeps the realtime implementation simple and avoids partial
client-side merge bugs. The channel's status (`SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`) is
logged as `[realtime] game <id>: <status>` — `adb logcat -s ReactNativeJS` on a release build shows it.

**Safety net (Nov 18).** Realtime is not the only way a round arrives. The scorecard also reloads when
the app returns to the foreground (the socket dies while the phone sleeps or the share sheet is up),
and while an **active** game is on screen it polls every 20 s (`LIVE_POLL_MS`) as long as the app is in
front. Completed and deleted games do not poll. So the other phone's round shows within about a second
when Realtime works and within 20 s when it does not.

## Local Storage

AsyncStorage is allowed for:

- Current local-development session fallback when Supabase env vars are missing.
- Cached reads for recently opened games.
- Draft score entry before submit.

AsyncStorage is not the production source of truth for games, rounds, scores, or token balances.

## Conflict Rules

- Round submission must be append-only and balanced to `0`.
- Undo marks a round as undone once Supabase is enabled.
- Game completion prevents future scoring.
- Game admin actions control settings, undo, completion, and token adjustments.
- Token balances are derived from `token_ledger`.
