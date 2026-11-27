# Seating order — design spec (PR 21, review first; nothing built)

Status: **built** (Nov 15; approved by Sree at 1:34 AM PT with every Q21.x recommendation). Migration `044_seating_order.sql` is written and **not applied**; Going rogue's migration moved to 045. Build notes: the pop-up flag is written `false` by Start and the sheet only pops while it is exactly `false`, so games started before this build (and the demo seed) never pop — §3.2; the ▲ ▼ on Players · Admins now work mid-game through the same RPC; the Log line falls back to the scorecard's default initials (022 `initials_candidates`) when a seat has no stored label.

**PR 24 (Nov 17, Sree's v11 feedback) reshaped the feature; the table in [`pool-design.md` §0 rows 26–27](pool-design.md) is the contract now.** The sheet is called **Order of players**. The once-per-game pop-up is gone: the order is step 3 of New game (Players → Game type → Order of players → Co-admin → Start game). Tap-to-number replaces tap-to-place: nobody is numbered at the start, each tap gives the next number and lifts the player, tapping the last-numbered player takes it back, numbered rows carry ▲ ▼, Clear and Done. The Players chips column, "Picked up — choose a seat" and "Keep this order" were removed. Mid-game from ⋮ the same component opens prefilled. S01–S08 below show the PR 21 shape and are kept for history.
**Nov 27 (D138): Order of players becomes a circle of initials — highest card at the top, the dealer (seat 1) one step to its right. Approved and being built; the geometry, pictures and where it stops fitting are §11.**
Mockups: [`seating-order-mockups/`](seating-order-mockups/) (S01–S08, same style as the Pool / Multiplier / Going rogue
sets; 390 dp, light theme, caption strip on each). Section 7 lists the questions with a recommendation on each; section 8
the test rows; section 9 the place in the queue.

The feature in one line: *after the players draw cards and sit down, the admin tells the app who sits where; the deal
then rotates by seat, and the admin can fix the order mid-game from the menu.*

## 0. Sree's requirements (Nov 15, 12:40 AM PT) and how this spec reads them

| # | Sree said | Read as |
| --- | --- | --- |
| 1 | Real play: players draw cards and sit in an order; the dealer rotates by seat. The app has no player order today. | Half true, and that is good news (§2): the database already has one order per game (`game_players.player_order`) and the scorecard columns, the Add round order and the dealer rotation all follow it. What is missing is a way to **set** it that matches real play — today the order is simply the order players were added, changeable only by ▲ ▼ on Players · Admins and only before any score exists. |
| 2 | Keep it simple. After the admin adds the players and the game starts, an order screen pops up automatically: seats 1..N on one side, players on the other; the admin drags or moves players into their seats; Done. | The **Seating order** sheet (S01–S04): pre-filled with the current order so Done works at once; tap a player, tap a seat (or ▲ ▼) to move; no new dependency for drag (§3.2, Q21.2). Shown once per game, right after Start, on the phone that started it. |
| 3 | Also a game menu item, so the admin can rearrange mid-game. Admin-only. The "who deals" indicator follows the current order. No skip-dealer. | ⋮ → **Seating order** for admins (S05); the same sheet; saved rounds keep their dealers, the next deal is the seat after the last dealer in the new order — which is exactly what `nextDealer()` and `save_round` already do (S06, §4). No skip-dealer button (D21.3). |
| 4 | OUT for now: random card draw (52 cards, jokers lowest), random seat assignment, a big seat card on each player's phone. Mention only as "later". | §10, one paragraph, nothing designed. |

## 1. What already holds

- **One order per game exists.** `game_players.player_order integer` (001), unique per game. `listGamePlayers`, every
  bundle RPC (`get_game_bundle`, `public_scorecard`, …), `save_round` (`array_agg(profile_id order by player_order)`), the
  scorecard columns, the Add round cells, the Final scores card, the PDF and the live page all read it. **Nothing new has
  to learn an order; they only need the order to be right.**
- **The deal already rotates by seat.** `utils/dealerRotation.ts` (031): the dealer of a saved round is stored with the
  round (`rounds.dealer_profile_id`); the next dealer is *the seat after the last round's dealer in the current seat
  order*; a divider marks each new rotation. `save_round` applies the same rule on the server. Pool (041): the deal skips
  players who are out.
- **An order can be changed today, barely.** Players · Admins shows ▲ ▼ per seated player (`gamesService.moveSeat`) only
  while **no score exists** (`canReorder`), as three client-side updates on `game_players` (park, swap, swap) with no
  RPC, no transaction and no Log line.
- **The order sets the colours.** `seatColor(index)` and the initials labels are by position, so moving a seat moves a
  colour with the column — fine, and what players would expect (the column is "where I sit").

So PR 21 is a **UI and a small server function**, not a data model change.

## 2. Scope

In: the Seating order sheet (auto once after Start, and from the ⋮ menu any time while the game is Active); the RPC that
rewrites the order atomically with a Log line; the dealer indicator following the order (already does); Pool behaviour;
retiring the unlogged ▲ ▼ path or routing it through the RPC (Q21.5).

Out (D21.4, §10): card draw, random seats, per-phone seat card. Also out: per-round seat history (where someone sat in
round 3 is not stored — only who dealt), and any change to how Add round orders its cells (it follows the seats).

## 3. Screens (S01–S08)

| # | File | Shows |
| --- | --- | --- |
| S01 | `S01-seating-popup-4p.png` | The pop-up right after Start, 4 players: seats 1–4 each holding a player, ▲ ▼ on every row, "Keep this order" / "Done"; seat 1 is green = deals round 1 |
| S02 | `S02-seating-popup-8p-move.png` | 8 players, a move in progress: Priya picked up (green chip in the Players column), seat 6 highlighted as the target, "Picked up 1 · Seated 7" |
| S03 | `S03-seating-popup-12p.png` | 12 players: compact 32 dp rows from 9 players, names still shown, the list scrolls under the fixed buttons |
| S04 | `S04-seating-popup-20p-initials.png` | 20 players: 30 dp rows; the initials pill grows to its text (WWW, MMM) and never clips (F13.22); names truncate; the list scrolls, buttons stay |
| S05 | `S05-menu-and-mid-game-rearrange.png` | A: ⋮ menu with **Seating order** (admins) · B: the same sheet after 6 rounds, Harish and Priya swapped, the note "saved rounds keep their dealers; the next deal follows the new order", the green number showing who deals next |
| S06 | `S06-dealer-indicator-follows-order.png` | Before / after the swap on the scorecard: columns reorder, rounds 1–6 unchanged, the "deals" bar lands on the seat after the last dealer |
| S07 | `S07-pool-out-and-reentered-seats.png` | Pool: out players keep a grey seat (a re-entry lands back in it), re-entered players are blue as on the card, the deal skips out players, Standings unaffected |
| S08 | `S08-data-log-and-later.png` | Data: `player_order` + one RPC + one Log kind + the pop-up flag; the Log line; the three "later" ideas |

### 3.1 The sheet

A bottom sheet over the scorecard (like Game settings), title **Seating order**, sub-line by context ("Pops up once, right
after Start. Admins only." / "Mid-game · admins only · logged" / "Pool · 6 seats · 1 out"). One numbered list, **seats 1..N**,
each row: seat number (green when that seat deals next), the player's initials pill, the name, ▲ ▼. On wide screens (≥ 8
players, landscape, tablets) a second **Players** column of chips appears (S02) so a player can be picked up and dropped;
on a phone in portrait with ≤ 7 players the chips are not needed — the rows are the players.

- Pre-filled with the current order, so **Done with no change is one tap** (the order players were added is a fine
  default — it is what happens today).
- **Move**: tap a row (or chip) to pick it up (green), tap the seat it belongs in: the player lands there and the rows in
  between shift one seat towards the gap. Or ▲ ▼ one seat at a time. Both are plain presses — no gesture library (Q21.2).
- **Done** saves (one RPC call) and closes; **Keep this order** (auto pop-up) / **Cancel** (menu) closes without saving.
  Nothing is written until Done.
- **Sizes**: 40 dp rows to 8 players (one screen), 32 dp from 9, 30 dp at 17–20; the list scrolls; the buttons are fixed
  at the bottom. Initials follow F13.22: the pill is sized to its text and never clipped; the name truncates with an
  ellipsis instead (S04).
- **Who sees it**: admins only (creator and game admins), in an **Active** game. Players and viewers never see the sheet
  or the menu item; they see the result (columns move) through Realtime like any other change.

### 3.2 The auto pop-up

- Opens on the scorecard **the first time it is shown with zero rounds** to the admin who started the game, after the
  co-admin nudge (New game → Start → nudge → scorecard → sheet). Not on the Players screen, not on New game — the game
  must exist first so the sheet writes to a real row.
- **Once per game**: Start writes `games.settings.seatingPrompted = false`; Done or Keep this order sets it `true` (jsonb
  key, written by the same settings path as Drop / Middle drop / Full count; 044 keeps it out of the settings Log). The
  sheet pops only while the key is exactly `false`, so a second admin opening the game sees no pop-up (the flag is on the
  game, not the phone — Q21.1) and games started before this build never pop (they have the ⋮ item).
- **Skipped** when the game has one player (nothing to order) or was created from the Rules editor's demo seed (no key).
- With **one** player seated no sheet; with ≥ 2 always, even if the admin "always sits in add order" — one tap closes it.

### 3.3 Mid-game (menu)

⋮ → **Seating order** (between Players · Admins and Edit round; admins only; Active games only — hidden when Completed).
Same sheet, plus the yellow note "N rounds played. Saved rounds keep their dealers; the **next deal** follows the new
order. Columns on the scorecard move with the seats." Done → RPC → Log line (§4.2) → Realtime updates every phone.

### 3.4 The dealer indicator

Unchanged in code, which is the point (S06): `nextDealer(game, roundCount)` = the seat after the last round's dealer in
the **current** `game.players` order; the scorecard draws the 4 dp bar under that column. After a reorder:

- rounds already saved keep `dealer_profile_id` → the divider and the per-round dealer labels do not move;
- the next dealer is recomputed from the new order — usually the same person (the seat after the last dealer is still
  that person unless *they* moved), and the rotation continues from there in the new order.

No skip-dealer, no "set dealer" (D21.3). If Sree ever wants one it is a one-field RPC (`set_next_dealer`) and a tap on
the header, nothing in this spec would change.

## 4. Data, server, Log

### 4.1 Nothing new to store

The order **is** `game_players.player_order`. The proposal adds no column. The pop-up flag lives in `games.settings`
(jsonb) like every other per-game toggle.

### 4.2 One RPC: `set_seating_order(p_game_id uuid, p_profile_ids uuid[])` (migration 044 or 045 — numbered when written)

- Caller must be a **game admin** (creator or `game_admin`) and the game **Active** (not Completed / Closed / deleted);
  otherwise `raise exception` with the usual plain-English messages ("Only a game admin can change the seating.", "The
  game is completed. Reopen it to change the seating.").
- `p_profile_ids` must be exactly the **seated, non-spectator** players of the game, each once (`array_length` =
  count and the two sets equal) — otherwise "Every player needs a seat." A non-playing admin or a viewer is not a seat
  and keeps its `player_order` above the players (as today: 900+).
- One transaction: `update … set player_order = player_order + 10000` for the seated rows (parks them clear of the
  unique key), then `player_order = i - 1` for `i` in `1..N` from the array. The existing `unique (game_id,
  player_order)` is never violated mid-statement.
- **Log**: `perform log_event(game, null, 'seating_changed', level, text, details)` with `text` = "Seating changed ·
  1 SK · 2 PT · 3 HG · …" (initials from `player_snapshot`), `details` = `{ "from": [ids], "to": [ids], "rounds": N,
  "nextDealer": id }`, level **routine** when `rounds = 0` (the pop-up) and **important** after (a mid-game change moves
  columns under everyone). New `event_log_kind` value `seating_changed` — the constraint is re-stated as 041 did (Q21.4
  asks whether to reuse `settings_changed` instead).
- No change to `save_round`, `nextDealer`, Pool recompute, bundles or the live page: they read `player_order`.
- Rollback: drop the function, restate the kind constraint without `seating_changed` (existing rows of that kind are
  relabelled `settings_changed` first so the constraint holds).
- `gamesService.moveSeat` (▲ ▼ on Players · Admins) is **re-pointed at the RPC** (one call, logged, atomic) and its
  "no scores yet" guard is dropped, or the arrows are removed in favour of the sheet (Q21.5).

### 4.3 Local (no Supabase) games

`storage.updateGame({ players: newOrder })` — the same reorder `moveSeat` does locally today; no Log (local games have
none).

## 5. Interaction with Pool and with round entry

- **Pool**: a seat is a seat whether the player is in or out. Out players keep their seat (grey in the sheet, S07) so a
  re-entry comes back to the same column; the dealer rotation already skips out players (041 `save_round`: "the previous
  dealer went out; the deal passes to the next seat still in"). Moving an out player is allowed and harmless. Standings
  (`PoolStandings`) sort by points left and ignore seats. The Pool **limit lock** (042) is about `settings.poolLimit`,
  not seats — unaffected.
- **Add round** (`score-entry.tsx`) lists cells in `game.players` order, so after a reorder the cells follow the new
  seats — the admin goes round the table in the new order, which is the whole point. A round being entered on another
  phone when the order changes keeps its typed values (they are keyed by player id, not position) and re-lays its cells
  on the next render.
- **Edit round / Undo / Log** are keyed by player id → untouched. The Log's per-round "SK +160 · HG −30 …" strings keep
  the order they were written in (they are text), which is a small, acceptable oddity.
- **Results, Final scores, share image, PDF**: ordered by `player_order` at the time they are rendered / declared; a
  saved result is a snapshot (jsonb `places`) and does not reorder later. Fine.
- **Multiplier (PR 14)**: independent; the Game settings sheet and the Seating sheet are two menu items.
- **Players added mid-game** (PR 7): `add_player_to_game` appends at `max(player_order) + 1` → seat N+1, as today; the
  admin can move them with the sheet. Removing a seat (016, only with all-zero scores) leaves a gap in the numbers;
  the sheet shows positions 1..N regardless (it numbers rows, not stored values) and Done compacts them.

## 6. Help, copy, accessibility

- Help bullet (Scorecard help, PR 11 owns the text): "Seating order: after you start a game the app asks who sits where.
  Seat 1 deals first and the deal goes round by seat. Admins can change the order any time from the ⋮ menu; rounds already
  played keep their dealer."
- Sheet copy as on the mockups; the note is one sentence in the pop-up and two mid-game.
- Every row is one accessible element: "Seat 3, Harish Gadupudi, deals next, move up, move down". The picked-up state is
  announced ("Priya picked up — choose a seat").

## 7. Questions for Sree (Q21.x) with recommendations

- **Q21.1 Once per game, or once per admin phone?** *Recommend once per game* (`settings.seatingPrompted` on the game).
  The order is one fact about the table; a second admin should not be asked again. The menu item is always there.
- **Q21.2 Drag, or tap-to-place + ▲ ▼?** *Recommend tap-to-place + ▲ ▼* as the build. Drag needs
  `react-native-gesture-handler` + `react-native-reanimated` (or a PanResponder list we would maintain); neither is in
  the app today, both add native code to the APK and a new class of flakiness in Maestro. Tap-tap is two presses, works
  with TalkBack, and is what S02 shows. Drag can be layered on later without changing the data path.
- **Q21.3 Where does the pop-up appear?** *Recommend the scorecard* (after Start and the co-admin nudge), not a step on
  New game: the game must exist to write the order, and a sheet over the scorecard is the same surface the mid-game
  version uses.
- **Q21.4 New Log kind `seating_changed`, or reuse `settings_changed`?** *Recommend the new kind*: the Log filter and the
  "important" badge can treat it on its own, and the text "Seating changed · 1 SK · 2 PT …" reads better than a settings
  diff. Cost: one line in the kind constraint (041 showed how) and one label in the Log screen.
- **Q21.5 Players · Admins ▲ ▼?** *Recommend keep them but route through the RPC* (logged, atomic, allowed mid-game) so
  there is one code path; the Seating sheet becomes the primary way. Removing them is also fine — say which.
- **Q21.6 Should a reorder change who deals next?** *Recommend no special rule*: the next dealer stays "the seat after
  the last dealer" in the new order (S06). It is the rule we already have, needs no code, and matches "the indicator just
  follows the order". The sheet shows the consequence live (green number) so nobody is surprised.
- **Q21.7 Completed games?** *Recommend hidden* — the sheet and the menu item exist only while Active. A completed game's
  column order is history. Reopen → change → complete again if it really matters.
- **Q21.8 Pool — may an out player be moved?** *Recommend yes* (S07); it costs nothing and chairs do get shuffled when
  someone leaves the table.
- **Q21.9 Admins who are not playing / viewers?** *Recommend they are not seats* — they stay off the list as today
  (`player_order` 900+, `seated = false`), and the RPC refuses a list that includes them.
- **Q21.10 Smoke or full?** *Recommend one smoke flow* (pop-up → one move → Done → columns and dealer bar; menu → swap →
  Log line) and a nightly 20-player pass (scroll, WWW/MMM pills); see §8.

## 8. Tests (codes for `docs/testing-strategy.md`, PR 21 block; written with the build)

| # | Kind | What it proves |
| --- | --- | --- |
| X21-1 | U | `utils/seating.ts`: `placeAt(order, id, seat)` shifts the rows between source and target by one; ▲ ▼ swap at the ends are no-ops; the result is always a permutation of the input; row sizes 40 / 32 / 30 dp by count |
| X21-2 | U | Pop-up gating: shown once for an admin with ≥ 2 seated players and 0 rounds and no `seatingPrompted`; never for players / viewers / completed games / one player; Done and Keep both set the flag |
| X21-3 | U | `nextDealer` after a reorder: the seat after the last dealer in the new order; rounds already saved keep their dealer labels; rotation dividers unchanged (existing `dealerRotation` tests extended) |
| X21-4 | D | pgTAP: `set_seating_order` as creator / game admin succeeds and compacts to 0..N-1; player, viewer, non-member refused; missing or duplicated player → "Every player needs a seat."; Completed game refused; spectator / unseated admin in the list refused; unique key never violated (20 players, reverse order, in one call) |
| X21-5 | D | pgTAP: the Log row — kind `seating_changed`, routine at 0 rounds, important after, text "Seating changed · 1 SK · 2 …", details `from` / `to` / `rounds` / `nextDealer`; rollback relabels to `settings_changed` and the forward replay restores the kind |
| X21-6 | D | pgTAP: Pool — reorder with an out player and a re-entered player keeps `out_round` / `reentry_score`; the next `save_round` picks the dealer as the next seat still in, in the new order |
| X21-7 | S | Smoke: New game 4 players → Start → Skip the nudge → the sheet pops → move Priya to seat 2 → Done → columns PT second, Log line, seat-1 player's column has the dealer bar → ⋮ → Seating order → swap → Done → bar on the expected column (screenshots) |
| X21-8 | N | Nightly: 20 players (WWW / MMM / W88 labels) — the sheet scrolls, every pill fully visible, buttons fixed; landscape shows the Players column; a reorder in a Pool with 3 out players |
| X21-9 | R | Two-device: admin reorders on phone A, phone B (player) sees the columns move within 3 s and no pop-up |
| X21-10 | M | Emulator pass of every S-screen (S01–S08) |

## 9. Place in the sequence, and how big the build is

Review-first. If approved, the build stacks after PR 14 (Multiplier build) in the queue and before any Going rogue work:
one migration (one function + one Log kind, ~120 lines + pgTAP), `utils/seating.ts` (pure), one component
(`SeatingSheet.tsx`, ~250 lines), a menu item and the pop-up hook on the scorecard, `gamesService.setSeatingOrder` and the
re-pointed `moveSeat`, one Help bullet, smoke 19 + a nightly flow. Roughly PR 9-sized; no new dependency.

## 10. Later (not designed; Sree's "later" list)

- **Card draw**: each player taps to draw from a virtual 52-card deck (jokers lowest); the highest card picks the seat /
  deals first; the result pre-fills this sheet.
- **Random seats**: a Shuffle button on the sheet.
- **Seat card**: a big "Seat 3" card on each player's own phone after the order is set (Realtime already delivers the
  order; this is UI only).

None of these change the data path above: they all end in the same `set_seating_order` call.

## 11. Order of players as a circle (Sree, Nov 27 2026; D138) — approved, built

Status: **approved by Sree on Nov 27 (Q58 → D138); built from the geometry below (branch
`cursor/seating-circle-build-259f`). 11.7 is measured on the build; 11.8 lists where the build differs from the
pictures.** Redraws
`design-review-2/mockups/table-mockup.png` (Nov 21, §8.5 of `design-review-2.md`), which predates Palette B (D65), the
Size-S look (D66), D74 and D113. The rules of §3–§5 and D56 / D58 / D59 / D64 / D70 do not change: this is a new
picture of the same order, not a new order. The first round of these pictures (Nov 27 morning) put seat 1 at the
bottom; D138 moved the highest card to the top, and the pictures were redrawn over the same file names.

Pictures (`design-review-2/mockups/`, generator `make-seating-circle.py`, `--fit` prints the table in 11.7; the "today"
frames are CI's own, from run [46035664063](https://github.com/sreeatcandorps/RummyHome/actions/runs/46035664063) on
#170, smoke 24g on the Pixel 6 and 19d on the 360 dp × 1.3 small phone, kept in `mockups/ci-frames/`):

| File | Shows |
| --- | --- |
| `seating-circle-today-vs-proposed.png` | Today's list (CI frame) · the ring, everyone numbered, the dealer flashing · fixing a wrong tap (Priya selected, ▲ ▼ in the middle) · a newcomer (D70) joining while the dealer deals round 1 |
| `seating-circle-taps.png` | Four phones: nobody numbered · first tap (Meena, highest card → seat 6, glides to the top) · next tap (Kiran → 5, to her left) · last tap (Ravi → seat 1, the dealer, one step right of the top) |
| `seating-circle-small-13-20.png` | 360 dp × text 1.3: today (names already cut at 4 players) · 13 players, designed to look right · 20 players with WWW / MMM / HG2, still on one screen |
| `seating-circle-dark.png` | Dark (D71): New game step 3 · mid-game Pool page with one player out, one re-entered and the "deals next" label moved round |

### 11.1 Sree's words and how we read them

| Sree said (verbatim) | Read as |
| --- | --- |
| "This is good. Let's make this happen! It is super rare to have more than even 11 players … Make your design work for up to 13, and then 14 onwards, it's okay if it doesn't look that great, but if you can make it work, definitely make it work." (Nov 27, Q58) | Build it. 4–13 players must look right on the Pixel 6 and on the 360 dp × 1.3 small phone; 14–20 must work (no cut letters, nothing under 48 dp) even if crowded. 11.7 says where it stops fitting. |
| "What I want is the highest on the top … The highest goes to the top. The second highest goes to the left. It goes on like that." | Seat N (highest card, first tap) sits at 12 o'clock. Seat N−1 sits just to its left on screen, and the seats keep counting down **anticlockwise on screen**: down the left side, across the bottom, up the right. |
| "The least, the dealer, should be on the right … The dealer is always one step to the right, and then you definitely want to show him clearly that he's the dealer. Make it obvious who the dealer is, and give him number 1. The highest gets the max number." | Seat 1 (lowest card, last tap) is the last seat round, so it lands one step to the right of the top, at about 1 o'clock. Numbers stay D56: dealer 1, highest N. The dealer is marked three ways: a gold ring round his disc, a gold **DEALER** label above it, and a green number badge "1". |
| "The default for dealing is counterclockwise (anticlockwise). Obviously, whoever has the highest gets the first open card. It's all about the open card, right?" | A dashed arrow runs from the dealer anticlockwise to the top player, labelled "first open card", and one line under the ring says "The deal goes anticlockwise ⟲". This is the app's rule already: the first open card goes to the seat before the dealer (D58), which for seat 1 is seat N, the top. |
| "Tell me when this will fail: small screens, too many people, and what are we going to do about it?" | 11.7. |
| "The number 1 seating shown as a circle or oval: I think that would be very, very nice because it's so much easier to visualize." (Nov 27, morning) | The list on Order of players becomes an oval table, in both places (New game step 3 and ⋮ mid-game), one component. |
| "It should be a circle, or at least an oval … that's how people sit in real life … dealing always happens counterclockwise … they have to always sit to the left side of the person that is dealing." (Nov 21, 1:11 AM) | A newcomer (D70) sits in the seat before the dealer: on the ring, the place between the dealer and the top player. See 11.2 item 3 and the fourth frame of the first picture. |
| "At the same time, it's kind of hard to show the full name, so I think we could just show initials, and that would be perfect. Just initials is just fine for the seating chart." | Each player is a disc with the scorecard's own initials (the column letters), no names on the ring. |
| "As you tap them, they get numbers, and they move to the right position automatically. Before that, you only show initials." | Before any tap the players sit round the ring in the order they were added, grey and dashed (= not numbered yet). Each tap gives the next number and the disc **glides** to that seat (about a quarter of a second): the first tap to the top, the next to its left, and so on round anticlockwise; the players still waiting slide round to fill the seats left. |
| "Maybe a long tap should show his name and player ID, or even a single tap can show his full name." / "Just flash his name, his player ID anytime they're touched in the middle of the circle, and his player number." | **A single tap does it.** Every tap shows a card in the middle for about 2 seconds: full name, Player ID (#57, D113) and "Seat 6", plus "highest card" on the first tap and "lowest card · dealer" on the last. A long tap does nothing extra. |

### 11.2 The design (D138)

1. **Where everyone sits.** Seat N, the highest card and the first tap, at 12 o'clock. Seat N−1 just to its left, then
   anticlockwise on screen: down the left, across the bottom, up the right. Seat 1, the lowest card, the last tap and the
   dealer of round 1, is the last seat round: one step to the right of the top, about 1 o'clock. At 6 players: MI (6) top,
   KR (5) upper left, SK (4) lower left, PR (3) bottom, AR (2) lower right, RK (1) upper right. The same at every count:
   only the spacing changes.
2. **The dealer is unmistakable.** Gold ring round the disc, a gold **DEALER** label just above it, a green "1" badge, and
   on the last tap the flash says "lowest card · dealer". A dashed arrow from the dealer, anticlockwise, to the top
   player, labelled "first open card"; under the ring, "The deal goes anticlockwise ⟲". The arrow and the dealer marks
   are there at rest, not only on a tap.
3. **A newcomer (D70).** He takes the seat before the dealer. With seat 1 dealing, that is the new highest seat (N+1), so
   on the ring he appears **at the top, between the old top player (now just to his left) and the dealer (just to his
   right)**; the old top player moves one place round to the left and everyone keeps his number. His disc has a dashed
   green outline and his flash says "just joined"; the note above the ring keeps D70's wording ("Tara sits at seat 7,
   between Meena and Ravi — left of the dealer. She is the new highest seat, so she sits at the top."). With any other
   dealer, he lands one step anticlockwise from that dealer, where the first open card goes.
4. **Mid-game the seats stay put; the dealer label moves.** Seat numbers are the table, so mid-game the ring is drawn
   the same way (highest seat at the top) and the gold ring and label sit on whoever deals next ("DEALS NEXT"), with the
   first-open-card arrow from him to the seat before him that is still in. So after round 1 the dealer is no longer one
   step right of the top: he walks round the ring with the deal. Not chosen: turning the ring so the current dealer is
   always at 1 o'clock (every player would jump on screen every round, and the top would stop meaning "highest card").
5. **The ring replaces the list.** No numbered list under the circle. A tap shows the name, the screen reader still reads
   the full name, seat and "dealer" of every disc, and a list under a ring would be two pictures of one order (D50).
6. **Fixing a wrong tap** (unchanged from the first round, approved). The latest tap: tap him again, his number comes off.
   Anyone else numbered (and every player mid-game): tap him; he lights up, the others dim, and the middle shows his name
   with two 48-dp buttons, **▲ Seat 4** and **▼ Seat 2**; he swaps with that neighbour. Tap him again or the felt to let
   go. The highest seat has no ▲ and seat 1 has no ▼ (D59). Clear starts again. D74's at-rest arrows are dropped (D138).
7. **Sizes.** Discs are 56 dp up to 10 players and 48 dp from 11 (never under 48, D52). A disc grows into a pill to fit
   its letters (WWW, MMM, HG2) and never cuts them (D95). The seat number is a small badge just inside the ring, in front
   of its player, so it never covers a letter. Up to 8 players the ring is a gentle oval; from 9 it takes all the height
   between the title and the buttons, so the middle stays roomy. The gaps follow the disc widths so no two discs touch.
   The flash's name is capped at 22 px so it fits the middle at large text sizes.
8. **The middle of the oval is the one place for words.** At rest: "Tap players from the highest card to the lowest",
   the count ("0 of 6 numbered") and Show me. On a tap: the flash. Selected: the name and ▲ ▼. Mid-game: "Round 6 ·
   Kiran deals next".
9. **Mid-game opens as a full page, not a dialog**, with the same subline and yellow note above the ring and Cancel ·
   Clear · Done at the bottom; Done's D64 behaviour is unchanged. **Pool:** an out player keeps his seat as a grey,
   struck-through disc marked "out" that the deal and the first open card skip; a re-entered player is blue, as on the
   scorecard.
10. **Kept simple.** Every phone shows the same picture (no turning the ring to the admin's chair). No new dependency: the
    glide uses React Native's `Animated`; with "remove animations" on, the disc jumps. Landscape gets no design of its own
    (D89); the ring draws itself in whatever space it has.

**Where the picture and the app's rules meet, said plainly** (Sree asked for his geometry even where code or convention
differ; nothing here changes what is drawn):

- *The cards go anticlockwise, the dealer's job goes clockwise.* The first open card goes anticlockwise from the dealer
  to the top player, as Sree said. But the next dealer is seat 2 (D58: the deal moves up one seat), and seat 2 sits
  clockwise from seat 1 on this ring (just below him on the right). So round 2 is dealt by the player one step clockwise,
  and the dealer label walks clockwise down the right side, then across the bottom and up the left. That is how the app
  already rotates the deal; the build does not change it. If Sree wants the dealer's job to move anticlockwise too, that
  is a change to D58 (who deals and who opens each round), not to the picture.
- *"Left of the dealer."* On the screen the newcomer appears to the dealer's left (between him and the top player). For
  someone sitting in the dealer's chair facing the table, that seat is on his right hand. The copy keeps D70's words
  ("left of the dealer") because they describe the picture.

### 11.3 What is lost or moved from today's screen

| Today | Proposed |
| --- | --- |
| Full name on every row | In the middle, for 2 s, on each tap; while selected; always read aloud by the screen reader. **Not visible all at once any more** (the trade Sree asked for) |
| Player ID (#124) on wide rows | In the flash, on every phone size (today it hides on narrow rows) |
| Initials, twice (in the avatar and as text) | Once, on the disc |
| Seat number circle at the left of the row | Badge inside the ring, in front of the disc |
| Avatar coloured by add order before it is numbered | Grey and dashed until numbered, then the seat colour |
| "highest card" tag on the first row | Pill in the first tap's flash; the top of the ring |
| Green seat number + "deals" tag | Gold ring + DEALER label + green "1"; "lowest card · dealer" in the last tap's flash; "DEALS NEXT" and "Round 6 · Kiran deals next" mid-game |
| (nothing) | The first-open-card arrow and "The deal goes anticlockwise ⟲" |
| Counter line under the list (incl. D64 "order unchanged — Done closes") | In the middle |
| ▲ ▼ on every numbered row at rest (D74) | **Removed at rest** (D138); ▲ ▼ only for the selected player, in the middle |
| Selected row lifts out with a gap (D74) | Selected disc gets a green ring, the others dim |
| Card with icon square, title, hint line and Show me | Gone (Size-S look); the hint and Show me move into the middle |
| Bottom toast "Lowest card — Ravi deals round 1" + phone buzz (D61) | The last tap's flash says it; the buzz stays |
| Mid-game dialog | Full page |
| Pool: out row grey and struck through; re-entered blue | Same, on the disc |
| Tutorial (3 steps, Show me) and Help › Order of players, Watch how | Same steps, redrawn on the ring; Help text and pictures re-made |

Nothing else on the screen changes: Back · Clear · Next / Start game, the step order (D17), what Done saves, the Log row,
the dealer rules, Realtime.

### 11.4 What the build touches

- `components/game/OrderOfPlayers.tsx`: the list becomes the ring (same props, so both hosts change little); the disc,
  badge, dealer marks, first-open-card arrow, flash and move buttons live here.
- New `utils/seatRing.ts` (pure): disc widths from the initials and text size, positions on the oval starting at the
  top and going anticlockwise from seat N, whether it fits (the generator's algorithm). `utils/seating.ts`: one new
  helper for which player sits in which seat while counting (the waiting players fill the low seats in the order added);
  `tapPlayer`, `stepNumbered`, `displayOrder`, `numberedCounter`, `seatRowLabel`, `opensFor` and the rest stay as they are.
- `components/game/OrderStep.tsx`: no card, no hint row, no bottom toast (the flash replaces it; the buzz stays).
- `components/game/SeatingSheet.tsx`: dialog → full page; `components/game/OrderHowTo.tsx` moves into the middle of
  the ring or goes.
- `utils/tutorials.ts` (the three scripted steps), `components/tutorial/SeatingTutorial.tsx`, `constants/helpTopics.ts`
  (Order of players topic), the help pictures.
- No migration, no server change, no new package, nothing under `public/`.

### 11.5 Tests and device flows that change

- Unit: `tests/seating-pr21.test.ts`, `tests/seating-tutorial-d74.test.ts`, `tests/v12-quick-fixes-nov19.test.ts` and
  `tests/pool-pr24.test.ts` pin today's list (rows, arrows on every row, the toast); they move to the ring.
  `tests/help-pr11.test.ts` pins the Help copy ("Wrong tap? Tap the latest player again …"), which keeps its meaning
  and gains the ▲ ▼ sentence. `tests/test-selection-pr17.test.ts` pins the mid-game sheet keeping its taps across a
  reload (`[visible, baseKey]`); the full page must keep that. New `tests/seat-ring.test.ts`: for 4–20 players at text
  1.0 and 1.3 on 360 and 412 dp, no two discs touch, none is under 48 dp, no pill is narrower than its letters; seat N is
  at 12 o'clock, seat N−1 is to its left, seats count down anticlockwise, seat 1 is the position just right of the top;
  the first-open-card arrow goes from the dealer to `opensFor`; 4–13 players fit on one screen at 360 dp × 1.3 and
  "does not fit" (scroll) is reported at the counts in 11.7; a number never changes once given (D56); the waiting
  players fill the low seats in the order added.
- Device flows: `e2e/smoke/19-seating-order.yaml` (row ids → disc ids by seat, assertions on the flash text and the
  DEALER label, ▲ ▼ through the middle buttons, frames 19 … 19j re-taken), `e2e/smoke/24-seating-tutorial.yaml` (24e
  toast → flash, 24f / 24g selected-only arrows), `e2e/smoke/16-pool-game.yaml` (its Order of players step),
  `e2e/full/51-seating-20p.yaml` (20 discs on one screen, WWW / MMM never cut, Pixel 6 and small phone),
  `e2e/full/52-seating-13p.yaml` (Sree: "Make your design work for up to 13" — New game with 13, all numbered, one
  selected, then sideways: `13p-order-everyone-numbered`, `13p-order-selected-arrows`, `13p-order-landscape`), plus
  the help frames in `e2e/smoke/21-help-frames.yaml`. As built the ids keep their old meaning where they can:
  `seat-row-<p>` is ring position p (1 = 12 o'clock = seat N, counted anticlockwise, so it is the old list's row p) and
  its accessibility label reads "Seat 4, Priya Test"; `seat-label-<p>` the initials; `seat-no-<p>` / `seat-number-<p>`
  the badge; `seat-deals-next` the Dealer tag; `seat-up-<p>` / `seat-down-<p>` the middle card's ▲ ▼ for the selected
  player; new: `seat-selected` (+ `-name`, `-seat`), `seat-flash` (+ `-name`, `-seat`, `-deals`), `seat-highest-card`
  (the first tap's pill), `seat-deals-line` (the middle at rest), `seat-deal-direction`, `seat-ring`.
- The UI PR carries the screenshot matrix (0 / 1 / 5 rounds × 4 / 13 players, D45) in light and dark, plus the 20-player
  small-phone frame.

### 11.6 The question (answered)

Q58 — "Can the circle replace the list completely, with each tap flashing the name, Player ID and seat in the middle,
and with ▲ ▼ shown only for the player you tap?" **Answered Nov 27: yes, with the highest card at the top and the dealer
one step to its right (D138).**

### 11.7 Where it fails

Measured on the build (`utils/seatRing.ts`, the numbers pinned by `tests/seat-ring.test.ts`). **A disc is never under
48 dp and initials are never cut, on any screen, at any count.** When the players do not fit, the oval grows taller
until it fills the space between the title and the buttons; past that **the page scrolls** (the title and the buttons
stay). Space for the ring is the screen less the title, the bottom bar and the two lines under the ring; mid-game the
subline and the yellow note take more (about 540 dp on the Pixel 6, about 390 dp on the small phone once a round is
saved). New game counts have the dealer at seat 1; mid-game counts try the Dealer mark on every seat.

| Screen | One screen, two-letter initials | Some three-letter (every fifth: WWW, MMM, HG2) | All three letters | Then |
| --- | --- | --- | --- | --- |
| Pixel 6, New game | 2–20 | 2–20 | 2–20 | — |
| Pixel 6, mid-game page | 2–20 | 2–18 | 2–18 | 19–20 scroll by under 90 dp |
| Pixel 6, text 1.3 | 2–20 | 2–20 | 2–16 | scrolls by up to 175 dp at 20 |
| 360 dp, text 1.0 | 2–20 | 2–20 | 2–16 | scrolls by up to 116 dp at 20 |
| 360 dp × 1.3, New game (CI's small phone) | 2–18 | 2–16 | 2–12 | 20 scrolls about 100 dp (two letters), 310 dp (all three) |
| 360 dp × 1.3, mid-game with the note | 2–12 | 2–9 | 2–9 | 13–14 scroll by under one disc; 20 by about 240 dp (half a screen) |
| 360 dp, text 2.0 | none | none | none | always scrolls: 2–8 players by under 60 dp, 20 by 300–700 dp |
| Landscape phone (D89, no design) | none | none | none | the ring is taller than the short side: scrolls 80–180 dp |
| Tablet (800 × 1280) | 2–20 | 2–20 | 2–20 | — |

Other places it gets tight, and what the build does:

- *The middle card is narrower than its two buttons* (about 118 dp) on the small phone at text 1.3 for some counts
  (3, 6, 9 players), mid-game there from 3, and at text 2.0 always. The selected card then covers the nearest badge or
  the edge of a side disc **while it is open** (it closes with a tap anywhere). The oval grows to widen it only while
  it still fits on one screen; it never scrolls just to widen the card.
- *The Dealer tag on a crowded side.* It sits above the dealer's disc in the top half, below it in the bottom half;
  if a neighbour is in the way it tries the other side, then slides sideways away from his own badge, then sits on
  his disc's rim like a ribbon (half on the disc, under the initials). Only if all of that fails does the oval grow.
- *Two badges facing each other across a narrow ring* (big text, many players) move to the middle-line side of their
  discs; a badge that would sit on a neighbour tries the other sides of its own disc first.
- *Long names in the middle.* Two lines, then cut with "…"; the screen reader still reads the full name, seat and
  "deals next" of every disc.

### 11.8 As built: where it differs from the pictures

- **The counter stays under the ring**, with "The deal goes anticlockwise ⟲" under it, not in the middle: the middle is
  the flash and the selected player's card, and the counter (D64's "order unchanged — Done closes") must stay readable
  while they show.
- **The deal arrow has no "first open card" label**: a dotted arrow leaves the dealer anticlockwise, and the line under
  the ring says which way the deal goes. The label had no room at 13+ players.
- **The middle at rest** says the one line (building) or "Tap anyone to move them." (everyone numbered), then
  "Ravi deals round 1" / "You deal round 6" and Show me. The pictures' "Round 6 · Kiran deals next" reads as
  "Kiran deals round 6".
- **The flash pill** on the dealer's tap reads "Dealer · deals round 1" ("Dealer · you deal round 1" for the signed-in
  player); the first tap's pill is "highest card". A tap that takes a number back flashes "Number taken back".
- **Out players stay movable** (as in today's sheet and flow 51): grey, struck through, "out" in the label; the deal
  and the first open card skip them.
- **The Show me steps are the circle**, with the same three titles and lines: four players, the K at the top, the 2 one
  step right of it with the Dealer tag, the finger tapping each disc and the middle naming him; step 3 takes the
  latest tap back, then selects Chitra and taps her ▲. It is the screen's own layout, drawn at most 220 dp tall
  inside the dialog (a picture, nothing to tap); seen on the Pixel 6 in run 46076237027 (frames 24b–24d, and Help
  › Watch how in 24h). **No Help picture shows Order of players**: the section is words plus Watch how (the steps
  above), and none of the 17 annotated pictures in `assets/help` is of this screen, so nothing needed redrawing; the
  Help words are updated. A picture of its own (like D98's Find in database) would be new: next-up row 12p.
- **The dealer's job still moves to seat 2** (D58): on the ring the Dealer mark steps one disc clockwise each round,
  while the first card goes anticlockwise. That is Q63, unchanged until Sree answers.
