# Seating order — design spec (PR 21, review first; nothing built)

Status: **built** (Nov 15; approved by Sree at 1:34 AM PT with every Q21.x recommendation). Migration `044_seating_order.sql` is written and **not applied**; Going rogue's migration moved to 045. Build notes: the pop-up flag is written `false` by Start and the sheet only pops while it is exactly `false`, so games started before this build (and the demo seed) never pop — §3.2; the ▲ ▼ on Players · Admins now work mid-game through the same RPC; the Log line falls back to the scorecard's default initials (022 `initials_candidates`) when a seat has no stored label.

**PR 24 (Nov 17, Sree's v11 feedback) reshaped the feature; the table in [`pool-design.md` §0 rows 26–27](pool-design.md) is the contract now.** The sheet is called **Order of players**. The once-per-game pop-up is gone: the order is step 3 of New game (Players → Game type → Order of players → Co-admin → Start game). Tap-to-number replaces tap-to-place: nobody is numbered at the start, each tap gives the next number and lifts the player, tapping the last-numbered player takes it back, numbered rows carry ▲ ▼, Clear and Done. The Players chips column, "Picked up — choose a seat" and "Keep this order" were removed. Mid-game from ⋮ the same component opens prefilled. S01–S08 below show the PR 21 shape and are kept for history.
**Nov 27: the list drawn as a circle (initials only, the name flashes in the middle) is §11 — pictures, waiting for Sree's yes.**
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

## 11. Order of players as a circle (Sree, Nov 27 2026) — mockup, nothing built

Status: **pictures only, waiting for Sree's yes.** Redraws `design-review-2/mockups/table-mockup.png` (Nov 21,
§8.5 of `design-review-2.md`), which predates Palette B (D65), the Size-S look (D66), D74 and D113. The rules of §3–§5
and D56 / D58 / D59 / D64 / D70 do not change: this is a new picture of the same order, not a new order.

Pictures (`design-review-2/mockups/`, generator `make-seating-circle.py`; the "today" frames are CI's own, from run
[46035664063](https://github.com/sreeatcandorps/RummyHome/actions/runs/46035664063) on #170, smoke 24g on the Pixel 6 and
19d on the 360 dp × 1.3 small phone, kept in `mockups/ci-frames/`):

| File | Shows |
| --- | --- |
| `seating-circle-today-vs-proposed.png` | Today's list (CI frame) · the ring, everyone numbered, the last tap flashing · fixing a wrong tap (Priya selected, ▲ ▼ in the middle) |
| `seating-circle-taps.png` | Four phones: nobody numbered · first tap (Meena, highest card → seat 6, glides) · next tap (Kiran → 5) · last tap (Ravi → seat 1, deals) |
| `seating-circle-small-13-20.png` | 360 dp × text 1.3: today (names already cut at 4 players) · 13 players mid-count · 20 players with WWW / MMM / HG2, one screen |
| `seating-circle-dark.png` | Dark (D71): New game step 3 · mid-game Pool page with one player out and one re-entered |

### 11.1 Sree's words and how we read them

| Sree said (verbatim) | Read as |
| --- | --- |
| "The number 1 seating shown as a circle or oval: I think that would be very, very nice because it's so much easier to visualize." (Nov 27) | The list on Order of players becomes an oval table, in both places (New game step 3 and ⋮ mid-game), one component. Seat 1 sits at the bottom of the oval. |
| "It should be a circle, or at least an oval … that's how people sit in real life … dealing always happens counterclockwise … they have to always sit to the left side of the person that is dealing." (Nov 21, 1:11 AM) | Seats run **anticlockwise** from seat 1: seat 2 is to seat 1's right on screen, and so on round the table. A dashed arrow inside the felt and one line under it ("The deal goes anticlockwise ⟲") show it. The dealer's left is then the seat before the dealer, which is exactly where D70 seats a newcomer, so the picture and the join rule agree. |
| "At the same time, it's kind of hard to show the full name, so I think we could just show initials, and that would be perfect. Just initials is just fine for the seating chart." | Each player is a disc with the scorecard's own initials (the column letters), no names on the ring. |
| "Let's just do mockups, and then you basically put them in a circle." | Pictures first; nothing is built until he says yes. |
| "As you tap them, they get numbers, and they move to the right position automatically. Before that, you only show initials." | Before any tap the players sit round the ring in the order they were added, grey and dashed (= not numbered yet). Each tap gives the next number and the disc **glides** to that seat (about a quarter of a second); the players still waiting slide round to fill the seats left. The numbers count down as today (D56): the first tap is the highest card and gets the highest seat, the last tap is seat 1 and deals. |
| "Maybe a long tap should show his name and player ID, or even a single tap can show his full name." | **A single tap does it.** One tap numbers the player and shows his name. A long tap does nothing extra (see 11.2). |
| "Just flash his name, his player ID anytime they're touched in the middle of the circle, and his player number." | Every tap shows a card in the middle of the oval for about 2 seconds: full name, Player ID (#57, D113) and "Seat 6", plus "highest card" on the first tap and "deals round 1" on the last. Then the middle goes back to "2 of 6 numbered". |
| "That might be enough, automatically. Yeah, I don't know." | He is not sure the flash is enough on its own. That is the one question below: do we drop the list of names under the circle? |

### 11.2 Recommendation

1. **The ring replaces the list.** No numbered list under the circle. A tap shows the name, the screen reader still
   reads the full name of every disc, and a list under a ring would mean two pictures of one order, twice the
   height, and a scroll at 13+ players (D50: fewest states). The list's only extra (all names visible at once)
   is the thing Sree said he can give up ("Just initials is just fine").
2. **Single tap = number + flash. Long tap = nothing.** A gesture nobody can see is not discoverable, and a long tap that only
   *showed* a name would be a second way to do what a tap already does. If someone wants to see a name without
   numbering, tapping the latest player again already takes his number back (today's undo), so a "peek" costs two taps
   and needs nothing new.
3. **Fixing a wrong tap.** Three ways, all of them exist today; only the picture changes:
   - *The latest tap*: tap him again: his number comes off and he glides back among the waiting players (today's undo).
   - *Anyone else who is numbered* (and everyone once all are numbered, and every player mid-game): tap him. He lights
     up, the others dim, and the middle shows his name with two 48-dp buttons, **▲ Seat 4** and **▼ Seat 2** (one seat up or
     down; he swaps with that neighbour on the ring). Tap him again, or the empty felt, to let go. The highest seat
     has no ▲ and seat 1 has no ▼ (D59).
   - *Start again*: Clear, as today.

   **D74, reconciled.** D74 has two parts. "Only the selected player gets arrows" stays exactly. "Arrows on every
   row at rest" cannot stay: on a ring it is two arrows round every disc (40 at 20 players) with nowhere to put them. At
   rest the ring has **no arrows**; the middle says "Tap anyone to move them" once everyone is numbered. This changes
   the at-rest half of D74, so it is named in the question.
4. **Sizes.** Discs are 56 dp up to 10 players and 48 dp from 11 (never under 48, D52). A disc grows into a pill to fit
   its letters (WWW, MMM, HG2) and never cuts them (D95). The seat number is a small badge just inside the ring, in front
   of the player, so it never covers a letter. The oval grows taller with the number of players and fills the space
   between the title and the buttons; the gaps follow the disc widths so no two discs touch. Measured in the generator:
   20 players at 360 dp × text 1.3 fit on one screen, just: the ring and its line take 562 of the 564 dp between the
   title and the buttons. Only if a phone is shorter still, or the text is above 1.3, does the page scroll, with the
   buttons fixed.
   Not chosen: two rings of seats (who sits next to whom stops being visible), smaller discs (Sree, v12: too small to
   tap), a scrolling ring (you cannot see the table).
5. **The middle of the oval is the one place for words.** At rest: "Tap players from the highest card to the lowest",
   the count ("0 of 6 numbered"), and Show me. On a tap: the flash. Selected: the name and ▲ ▼. Mid-game: "Round 6 ·
   Kiran deals next". That is why the hint line and its card above the list go.
6. **Mid-game opens as a full page, not a dialog.** Today's ⋮ sheet is a dialog with a half-screen list; a ring cannot fit
   there at 13–20 players. The page has the same subline and yellow note above the ring ("5 rounds played. Saved rounds
   keep their dealers …") and Cancel · Clear · Done at the bottom. Done's D64 behaviour is unchanged; its line
   ("Everyone numbered · order unchanged — Done closes") moves into the middle.
7. **Pool.** An out player keeps his seat as a grey, struck-through disc marked "out", which cannot be selected and which the deal skips (§5,
   unchanged); a re-entered player is blue, as on the scorecard.
8. **Kept simple on purpose.** Seat 1 is always at the bottom (the §8.5 idea of turning the ring to the admin's own chair
   is dropped, so every phone shows the same picture). No new dependency: the glide uses React Native's own `Animated`
   (Q21.2 still holds), and with the phone's "remove animations" setting on, the disc jumps instead. Landscape gets no
   design of its own (D89); the ring draws itself in whatever space it has.

### 11.3 What is lost or moved from today's screen

| Today | Proposed |
| --- | --- |
| Full name on every row | In the middle, for 2 s, on each tap; while selected; always read aloud by the screen reader. **Not visible all at once any more** (the trade Sree asked for) |
| Player ID (#124) on wide rows | In the flash, on every phone size (today it hides on narrow rows) |
| Initials, twice (in the avatar and as text) | Once, on the disc |
| Seat number circle at the left of the row | Badge inside the ring, in front of the disc |
| Avatar coloured by add order before it is numbered | Grey and dashed until numbered, then the seat colour |
| "highest card" tag on the first row | Pill in the first tap's flash |
| Green seat number + "deals" tag | Green badge; "deals round 1" in the last tap's flash; "Round 6 · Kiran deals next" in the middle mid-game |
| Counter line under the list (incl. D64 "order unchanged — Done closes") | In the middle |
| ▲ ▼ on every numbered row at rest (D74) | **Removed at rest**; ▲ ▼ only for the selected player, in the middle (D74's selected-only half kept) |
| Selected row lifts out with a gap (D74) | Selected disc gets a green ring, the others dim |
| Card with icon square, title, hint line and Show me | Gone (Size-S look); the hint and Show me move into the middle |
| Bottom toast "Lowest card — Ravi deals round 1" + phone buzz (D61) | The last tap's flash says it; the buzz stays |
| Mid-game dialog | Full page |
| Pool: out row grey and struck through; re-entered blue | Same, on the disc |
| Tutorial (3 steps, Show me) and Help › Order of players, Watch how | Same steps, redrawn on the ring; Help text and pictures re-made |

Nothing else on the screen changes: Back · Clear · Next / Start game, the step order (D17), what Done saves, the Log row,
the dealer rules, Realtime.

### 11.4 What a build would touch

- `components/game/OrderOfPlayers.tsx`: the list becomes the ring (same props, so both hosts change little); the disc,
  badge, flash and move buttons live here.
- New `utils/seatRing.ts` (pure): disc widths from the initials and text size, positions on the oval, whether it fits
  (the generator's algorithm). `utils/seating.ts`: one new helper for which player sits in which seat while counting
  (the waiting players fill the low seats in the order added); `tapPlayer`, `stepNumbered`, `displayOrder`,
  `numberedCounter`, `seatRowLabel` and the rest stay as they are.
- `components/game/OrderStep.tsx`: no card, no hint row, no bottom toast (the flash replaces it; the buzz stays).
- `components/game/SeatingSheet.tsx`: dialog → full page; `components/game/OrderHowTo.tsx` moves into the middle of
  the ring or goes.
- `utils/tutorials.ts` (the three scripted steps), `components/tutorial/SeatingTutorial.tsx`, `constants/helpTopics.ts`
  (Order of players topic), the help pictures.
- No migration, no server change, no new package, nothing under `public/`.

### 11.5 Tests and device flows that would change

- Unit: `tests/seating-pr21.test.ts`, `tests/seating-tutorial-d74.test.ts`, `tests/v12-quick-fixes-nov19.test.ts` and
  `tests/pool-pr24.test.ts` pin today's list (rows, arrows on every row, the toast); they move to the ring.
  `tests/help-pr11.test.ts` pins the Help copy ("Wrong tap? Tap the latest player again …"), which keeps its meaning
  and gains the ▲ ▼ sentence. `tests/test-selection-pr17.test.ts` pins the mid-game sheet keeping its taps across a
  reload (`[visible, baseKey]`); the full page must keep that. New `tests/seat-ring.test.ts`: for 2–20 players at text
  1.0 and 1.3 on 360 and 412 dp, no two discs touch, none is under 48 dp, no pill is narrower than its letters, seat 1 is
  at the bottom and seats run anticlockwise, and "does not fit" is reported (scroll) at text 2.0; a number never
  changes once given (D56); the waiting players fill the low seats in the order added.
- Device flows: `e2e/smoke/19-seating-order.yaml` (row ids → disc ids by seat, assertions on the flash text,
  ▲ ▼ through the middle buttons, frames 19 … 19j re-taken), `e2e/smoke/24-seating-tutorial.yaml` (24e toast → flash, 24f /
  24g selected-only arrows), `e2e/smoke/16-pool-game.yaml` (its Order of players step), `e2e/full/51-seating-20p.yaml`
  (20 discs on one screen, WWW / MMM never cut, Pixel 6 and small phone), plus the help frames in
  `e2e/smoke/21-help-frames.yaml`. New test ids: `seat-disc-<seat>`, `seat-flash`, `seat-move-up`, `seat-move-down`.
- The UI PR carries the screenshot matrix (0 / 1 / 5 rounds × 4 / 13 players, D45) in light and dark, plus the 20-player
  small-phone frame.

### 11.6 The one question for Sree

**Can the circle replace the list completely, with each tap flashing the name, Player ID and seat in the middle, and
with ▲ ▼ shown only for the player you tap (no arrows at rest)? Default if no answer: yes, as drawn.**
