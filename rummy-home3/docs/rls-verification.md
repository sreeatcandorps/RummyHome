# RLS Verification

Use two normal player accounts and one app admin account.

## Profiles

- A signed-in user can read profiles.
- A signed-in user can update only their own profile.
- A signed-in user cannot change another profile's role.

## Games

- A signed-in user can create a game where `created_by = auth.uid()`.
- A game member can read their game.
- A non-member cannot read a private game unless spectator access is enabled.
- Only the game creator, game admin, or app admin can update the game.

## Game Players

- The game creator can add initial players.
- A game admin can add or deactivate players.
- A normal player cannot add or deactivate players.

## Rounds And Scores

- Game members can read rounds and scores.
- Game admins can insert rounds and scores.
- Normal players cannot write scores unless promoted to game admin.
- Undo updates `rounds.undone_at` and does not delete rows.

## Token Ledger

- A user can read their own ledger entries.
- Game members can read entries for their game.
- Only game admins or app admins can insert ledger entries.
- Token balances are derived from ledger sums.
