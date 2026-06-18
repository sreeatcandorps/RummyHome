# Rummy Home Product Contract

This contract turns the historical spec and backlog into implementation rules.

## App Root

`rummy-home3` is the mobile app root. Existing UI can be reused, but Supabase is the system of record for users, games, rounds, scores, and token balances.

## Authentication

- Authentication is email plus password/passcode through Supabase Auth.
- Phone number is optional profile data, not a login requirement for the first production slice.
- Password reset uses Supabase email recovery.
- A Supabase Auth user must have exactly one `profiles` row.
- Local storage may cache the current session but must not create authenticated users by itself.

## Roles

- `app_admin`: operational admin outside normal games.
- `game_admin`: can create and control a specific game.
- `player`: can view and score games they belong to, subject to game permissions.
- `spectator`: can view a game by share code when spectator access is enabled.

## Game Defaults

| Setting | Stake | Pool |
| --- | ---: | ---: |
| Expense enabled | yes | yes |
| Expense amount | -10 | -10 |
| Drop | -10 | -25 |
| Middle drop | -30 | -50 |
| Max count | -80 | -80 |
| Pool amount | n/a | 100 |
| Default token deposit | n/a | -100 |

Game settings start from profile defaults and are copied onto the game at creation. Game settings can be edited by the game admin until the game is completed.

## Players

- A game must have at least 2 players and at most 20 players.
- Player order is explicit and controls dealer rotation.
- A default expense player is represented as a system score, not a normal profile.
- Player colors and display numbers are per-game metadata.
- A player can be added mid-game; prior rounds receive zero scores unless the game admin enters an adjustment round.

## Scoring

- Every submitted round must sum to `0`.
- Score types are `drop`, `middle_drop`, `rummy`, `count`, and `expense`.
- `drop`, `middle_drop`, `count`, and `expense` scores are non-positive.
- `rummy` scores are positive balancing scores.
- The dealer for round `n` is `game_players[(n - 1) % active_player_count]`.
- Completed games are immutable except token/prize adjustments by a game admin.
- Undo records metadata on the round. It should not silently delete history once server persistence is enabled.

## Tokens

- Tokens are represented by an append-only ledger.
- Stake games award each player token movement equal to their final score unless adjusted by the game admin.
- Pool games start with the configured default deposit and settle prizes at completion.
- Manual token transfers and prize adjustments require a game admin.
- Current balances are derived from ledger entries, not stored counters.

## Realtime And Offline

- Active game screens subscribe to game, membership, round, score, and token events.
- AsyncStorage can hold read cache and score-entry drafts.
- Supabase remains the source of truth; offline writes are queued only after conflict rules are explicit.

## Release Bar

- TypeScript typecheck passes.
- Core scoring helpers are covered by tests.
- Supabase migrations and RLS policies exist for all production tables.
- Auth, create game, add round, undo, complete game, history, and token settlement have smoke coverage.
