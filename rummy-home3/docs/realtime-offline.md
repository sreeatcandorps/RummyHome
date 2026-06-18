# Realtime And Offline Behavior

## Realtime

Active game screens subscribe through `services/realtime.ts` to:

- `games`
- `game_players`
- `rounds`
- `scores`
- `token_ledger`

Any change reloads the current game view from the service layer. This keeps the first realtime implementation simple and avoids partial client-side merge bugs.

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
