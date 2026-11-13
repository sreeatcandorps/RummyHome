# Initials: options to discuss

Ideas only; nothing here is implemented. Written against Sree's notes of 11 Nov 2026 and the code as of `414b570`.

## What happens today

`utils/playerInitials.ts` computes labels on the fly and never stores them: first initial + last initial (Sree Koneru → SK; a one-word name takes its first two letters). When two players in the *same context* collide, the first keeps the label and the others get first initial + a number (SK, S2, S3). "First" is seat order in a game and first appearance across games in a result. The context is one scorecard, one result, or one picker sheet, so the same person can be SK in one game and S2 in the next, and the fallback (S2, A2) throws away the surname letter, which is the part that distinguishes people in practice.

The capture `mockups/current/04-scorecard-9p-16-rounds-light.png` shows it: Suresh Kumar becomes **S2** and Arjun Reddy becomes **A2** because Sree Koneru and Anita Rao sit before them.

Where initials are used: scorecard column heads and dealer marks, the Add round header, share images and PDFs, result sheets, the Add players strip. Everywhere else (Players/Admins, My players, Results totals) the full name and `#ID` are shown, so the initials problem is really a scorecard problem.

## Shared principles (all options)

- **Player ID is the identity.** Initials are a label for narrow columns; the `#ID` stays visible on every full-width list.
- **Unique within one owner's My players, not per game.** A person has one label in every game that owner creates.
- **The owner decides.** The creator of a game owns the My players list the labels come from; a player cannot change how they appear on someone else's scorecard.
- **Conflicts are shown together, with suggestions,** at two moments: when a player is added or saved in My players, and right before a game starts (Start game on New game and Add new player during a game).
- **Names do not change under you.** A player renaming their profile updates the database only. Each owner's My players keeps its copy of the name (and the initials derived from it) until the owner taps **Refresh from database** on that player.

## Option 1 · Two letters, numbered when needed (SK, SK1, SK2)

Rule: first + last initial. A second person with the same pair gets the same two letters plus `1`, the third `2`, in the order they joined the owner's My players. Stored per owner.

| Pros | Cons |
|---|---|
| Shortest; fits 9–10 columns on a phone at 15–16 px | `SK1` tells you nothing about who it is; people learn it only by use |
| One obvious rule, no judgement calls | Numbers look like scores next to numbers (`SK1 +75`) |
| Already close to today's behaviour, smallest change to share images and PDFs | A third collision (`SK2`) is awkward; rare, but Kumar/Reddy groups make it plausible |

## Option 2 · Three letters when needed (SK, SUK)

Rule: two letters by default. On a collision the later player becomes three letters built from the name: first two of the first name + surname initial (**Su**resh **K**umar → `SUK`), or first initial + first two of the surname (`SKU`). The owner picks from suggestions; two-letter labels never change. Stored per owner.

| Pros | Cons |
|---|---|
| Labels stay readable: `SUK` is recognisably Suresh | Columns are 1 character wider; at 10 players the table drops to ~14 px heads unless it scrolls (it already scrolls) |
| No numbers mixed with scores | Two rules to explain (2 letters normally, 3 when needed) |
| Suggestions are usually enough; "Edit…" is the escape hatch | Three letters can still collide (two Suresh Kumars) and then you need a 4th letter or a number anyway |

## Option 3 · Owner-chosen label, 2–3 characters, free text with suggestions

Rule: every player in My players has an editable label (default = two-letter initials). The app only enforces uniqueness within the owner's list and length 2–3. Suggestions come from Option 2's generator. Stored per owner.

| Pros | Cons |
|---|---|
| Matches how groups talk ("Big Suresh" → `BS`, nicknames) | Freedom means inconsistency; a list of `SK`, `ANI`, `RK`, `MNR` looks untidy |
| Zero algorithm arguments: the owner is always right | Owner must do a small chore for each collision |
| Same storage as Options 1–2, so it can be added later | Needs an input, validation, and a "reset to default" |

## Recommendation

**Option 2 with Option 3's escape hatch**: two letters by default, three letters on collision chosen from suggestions, and an "Edit…" field limited to 2–3 letters (A–Z, 0–9) for the rare case the suggestions are all bad. Numbers are allowed in the free field (so someone who prefers `SK1` can have it) but are not what the app suggests. The person who joined My players first keeps the two-letter form; the owner can swap them if they prefer.

Reasoning: Sree's goal is that a column head tells older players at a glance who it is. `SUK` does that; `SK1` does not. The width cost is small because the scorecard already scrolls sideways above ~7 columns and the proposed type scale drops score cells to 15 px above 8 columns anyway.

## Where each control lives

| Control | Where | Who |
|---|---|---|
| Default label | Computed when a player is added to My players (manual add, Find in database, link, or first game together) | App |
| Edit initials | My players → tap a player → bottom sheet, field "Initials on your scorecards" (mock: `mockups/initials/player-refresh-*.png`) | Owner |
| Edit initials inside a game | Players/Admins → row ⋮ → "Edit initials" (writes to the owner's My players, so the next game is consistent) | Creator; admins only if they are the owner of the list the game was built from (see shared games) |
| Conflict check on add/save | My players add / edit sheet: inline error under the field with suggestions, Save disabled until unique | Owner |
| Conflict check before a game | New game → Start game, and Players/Admins → Add new player: full-screen "Fix initials" listing all pairs (mock: `mockups/initials/initials-conflicts-*.png`). "Not now" lets the game start with today's automatic fallback; "Apply and start" saves the choices to My players | Creator |
| Refresh from database | Same bottom sheet in My players, button "Refresh from database"; shows what would change ("Suresh Kumar → Suresh K. Nair") before applying; also offered in the conflict screen when a stale name is part of the collision | Owner |
| Reset to default | Small "Reset" text button next to the initials field | Owner |

Help text for the field, one line: "Shown in scorecard columns. Must be different from everyone else in your My players."

## Edge cases

- **Manual (unregistered) players.** They live only in the owner's My players, so the same rule applies with no extra work. If the player later registers and is linked, the label travels with the row (see next point).
- **Linking a seat to a Player ID.** When an unregistered seat is linked to a real profile, keep the owner's label for the row that survives; if the owner already had a label for the target Player ID, keep that one and drop the placeholder's. Show the result in the link confirmation ("Meera Nair will appear as MN, same as before").
- **Shared games: two admins, different labels.** The scorecard uses the **game creator's** labels, always. Admins see the creator's labels in that game even if their own My players says otherwise; a one-line note on Players/Admins ("Initials in this game come from Sree's My players") explains it. Reason: one table, one set of column heads, and the creator is the only person guaranteed to have every seat in their list. If a creator leaves (not possible today), the rule would pass to the next admin.
- **A player renames their profile.** Nothing changes on anyone's scorecards until that owner taps Refresh. The My players card shows a small "name changed" dot (as in the mock) so owners know a refresh is available. Refresh updates the stored name; it does **not** recompute a label the owner has edited, only a default one, and even then only after showing the change.
- **Owner renames a player in My players (Edit name).** Keeps working as now; the default label follows the owner's name, not the database name.
- **Results across games from different creators.** Result sheets already compute labels per result; with per-owner labels, use the viewer's My players when the viewer owns a label for that player, else the creator's label from the first game, else the default. Full names and `#ID` are printed in the totals anyway.
- **Share images and PDFs.** They print whatever the scorecard shows (creator's labels), so they stay consistent with the phone screen.
- **Two owners, same person, different labels.** Expected and fine: labels are per owner, like contact names in a phone.
- **Deleting a player from My players.** The label goes with the row; a later re-add recomputes the default and runs the conflict check.
- **Case and characters.** Store upper-case A–Z and 0–9 only; strip accents; max 3; min 2.

## Data model change

Smallest version: two nullable columns on `my_players` (one row per owner × player already exists), no new tables.

```sql
alter table public.my_players
  add column initials text check (initials ~ '^[A-Z0-9]{2,3}$'),   -- null = use the default rule
  add column name_snapshot text;                                      -- owner's copy of display_name; null = live
create unique index my_players_owner_initials_idx
  on public.my_players (owner_id, initials) where initials is not null;
```

- `list_my_players` and `get_game_bundle` return `initials` and `name_snapshot`; the client falls back to `baseInitials(name)` when `initials` is null and resolves collisions among nulls with the chosen rule (Option 2 suggestions, or today's numbering for "Not now").
- "Refresh from database" = set `name_snapshot = null` (or copy the current `display_name` into it, if the snapshot should always be explicit).
- Local prototype mode: the same two fields on the `RosterRow` in `services/players.ts`.
- No change to `game_players`, `games`, or results tables. The game only needs `created_by` (already stored) to know whose labels to use.

If snapshots are not wanted yet, `initials` alone is enough for Options 1–3; `name_snapshot` is what makes "Refresh from database" meaningful.

## Mockups

- `mockups/initials/initials-conflicts-light.png`, `-dark.png`: the pre-game "Fix initials" screen, all conflicting pairs together, suggestions per pair, "Not now" / "Apply and start".
- `mockups/initials/player-refresh-light.png`, `-dark.png`: the My players bottom sheet with the initials field, the locked name copy, the "name changed" notice and the Refresh from database action.

Both are rendered from `mocks/mock.html?screen=initials-conflicts` and `?screen=player-refresh`.
