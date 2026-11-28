# The dealer moves anticlockwise (Q63, Sree Nov 27 2026)

Status: **built on branch `cursor/dealer-anticlockwise-f877`; migration 057 written, not applied anywhere.** Live
gets 057 only on Sree's separate yes to it, from merged `main`, after the local-DB CI suite passed (AGENTS.md).

## 1. Sree's words and how we read them

| Sree said (Nov 27, 7:20 PM PT, verbatim) | Read as |
| --- | --- |
| "Which way the dealer moves after each round? Oh yeah, the dealer always moves counterclockwise. It's always counterclockwise because whoever gets the open card gets to deal, and then when he deals, he's also dealing counterclockwise. The dealer also moves counterclockwise." | After each round the deal passes to the player who got that round's first open card: the next seat anticlockwise from the dealer, i.e. the seat **before** the dealer in seat order (seat 1 → seat N → N−1 → … → 2 → 1). Out seats (pool) are skipped, as today. |

On the circle (D138) seat N is at the top, the seats count down anticlockwise, and seat 1 is one step right of the
top. Anticlockwise from seat k is seat k − 1 (seat 1 wraps to seat N). The cards already went that way (D58: the
first open card goes to the seat before the dealer); now the dealer's job follows them.

**Supersedes:** D58's "the deal moves up one seat each round" (the next dealer is now the seat *before* the last
dealer still in; D58's open-card rule and "skipped, never removed" stand). **Changes the seat** that D70 (joins,
054) and D139 (re-entries, 056) call "the dealer's left" (section 4). The Main agent writes the D-row.

## 2. Before and after: five players, six rounds

Seats: Ravi 1 (lowest card, deals round 1), Priya 2, Sunil 3, Kiran 4, Meena 5 (highest card, at the top).

| Round | Before (D58): deals | opens | After (057): deals | opens |
| --- | --- | --- | --- | --- |
| 1 | Ravi (1) | Meena (5) | Ravi (1) | Meena (5) |
| 2 | Priya (2) | Ravi (1) | **Meena (5)** | Kiran (4) |
| 3 | Sunil (3) | Priya (2) | **Kiran (4)** | Sunil (3) |
| 4 | Kiran (4) | Sunil (3) | **Sunil (3)** | Priya (2) |
| 5 | Meena (5) | Kiran (4) | **Priya (2)** | Ravi (1) |
| 6 | Ravi (1) | Meena (5) | Ravi (1) | Meena (5) |

Both ways everyone deals once and opens once every five rounds. What changes is who follows whom: before, the
Dealer mark stepped one disc **clockwise** each round while the cards went anticlockwise; now the player who opened
round *r* deals round *r* + 1, and the mark walks anticlockwise with the cards.

Pool: when Kiran (4) is out, round 3 after Meena (5) goes to Sunil (3), the next seat anticlockwise still in.

## 3. Every place "who deals next" is worked out

| Where | What it does | Change |
| --- | --- | --- |
| `next_in_rotation` (052) | the dealer after p_after | **057**: the seat before p_after; when p_after is out or gone, the next seat *down* still in, wrapping to the highest |
| `current_dealer`, `set_round_dealer` (052) | who deals the round being played; the Dealer sheet's "Round 7: X deals" and its log line | none (they call `next_in_rotation`) |
| `save_round` (052 body) | stores each new round's dealer; the "this round only" chain | **057**: same body, the four dealer lines mirrored; new helper `round_rule_dealer` for a game with no stored dealer |
| `set_seating_order` (044) | `nextDealer` in its return value and Log row | **057**: same body, the dealer lines mirrored |
| `add_seated_player` (054) | a joiner's seat | **057**: the seat **after** the dealer (section 4); the 054 pin kept |
| `reenter_player` (056) | a re-entry's default seat, the Log's "(left of X)" | **057**: the seat after the dealer; "left of" names the seat before him |
| `utils/dealerRotation.ts` | the app's single rule: `dealsAfter` (was `seatAfter`), `plannedDealer`, `nextDealer`, `planDealerChange`, `planJoin`, `planReentry`, `roundRuleDealer` | mirrored; `seatLeftOf`-style helpers now "the seat after" |
| scorecard DEALS / OPENS, rotation dividers | `nextDealer` / `opensFor` / `rotationStarts` | none (follow the rule) |
| the circle's Dealer mark, "X deals round N", the deal arrow | `nextDealerFor` (`utils/seating.ts`) | now calls `nextDealer` instead of its own copy; the arrow already pointed anticlockwise |
| Round saved: "Next: round 5 · X deals" | `nextDealer` | none |
| Re-entry line, hint, strip, "Back in … left of X" | `utils/reentrySeat.ts` | hint wording; a tap on a name sits him *after* that person; "left of" names the seat before him |
| Add players notice | `joinSeatNotice` | newcomers are seated in reverse pick order so they still sit in pick order (section 4) |
| Offline / local games | `services/games.ts` via `dealerRotation` | none beyond the rule |
| Shared scorecard page (`public/scorecard.html`), `get_game_bundle`, `public_scorecard` | stored dealers only | none |
| Help (Order of players, Who deals first?), the seating tutorial's first step | copy | "moves up one seat" → "passes anticlockwise to the player who got the first open card" |

Played rounds keep the dealer they were saved with; only the next deal follows the new rule. Pre-031 rounds with no
stored dealer are still drawn with the old seat-order rule (`seatOrderDealer`), because that is who dealt them.

## 4. "Left of the dealer" for joins and re-entries — checked

D70 and D139 promise: the newcomer (or the player coming back) **deals last** and **nobody's turn moves**. Under the
old rotation the seat before the dealer did both, *and* got the first open card of the round being played. Under the
new rotation **those come apart**, so it cannot stay "the seat that deals last, i.e. the one that gets the first open
card":

- The seat **before** the dealer (054's seat) gets the first open card of the round being played and therefore
  **deals next**. A newcomer there would jump the queue and every other player would deal one round later.
- The seat **after** the dealer (his own left hand, sitting at the table; one disc clockwise from him on the
  screen) gets his cards **last** this round, opens the second-to-last round of the cycle and **deals last**.
  Nobody else's deal moves; only the dealer's own next open card comes one round later, after the newcomer's.

**057 uses the seat after the dealer.** It keeps D70's meaning ("deals last, nobody's turn moves") and matches Sree's
words literally: "they have to always sit to the left side of the person that is dealing" — for someone in the
dealer's chair facing the table, the clockwise neighbour is on his left. The copy keeps "left of the dealer".

Worked example (the table above, rounds 1–2 played; Kiran deals round 3). Tara joins:

| | Seats after the join | Round 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 057: after the dealer | Ravi 1, Priya 2, Sunil 3, Kiran 4, **Tara 5**, Meena 6 | Kiran deals, Sunil opens | Sunil | Priya | Ravi | Meena (Tara opens) | **Tara** (Kiran opens) | Kiran |
| 054's seat kept (not built) | …, Sunil 3, **Tara 4**, Kiran 5, Meena 6 | Kiran deals, **Tara opens** | **Tara** | Sunil | Priya | Ravi | Meena | Kiran |

The pin stays: the newcomer lands between this round's dealer and last round's (Meena), so the seat before Meena
would be Tara; the round being played is pinned to Kiran with the Dealer-sheet override (052), exactly as 054 did.

- **Joins (054 → 057):** once a round is saved, the newcomer takes the dealer's seat + 1 and everyone after moves up
  one. The old "dealer at seat 1 → the last seat" exception is gone (seat + 1 is always next to him). Before round 1
  nothing changes: the last seat (see question 2).
- **Several newcomers at once:** each call sits its player straight after the dealer, so the app seats the picks in
  reverse order; they end up in pick order going round from the dealer, and "R K and C D sit at seats 4–5" stays true.
- **Re-entries (056 → 057):** the default is the seat after the dealer among the seats still in, worked out with him
  out of his old seat. "Already there" means only out seats (or none) between the dealer and him going *up*. The
  pin is unchanged. The Log line's "(left of X)" names the seat still in just before him. A tap on a name in the
  strip sits him straight after that person.

On the circle the newcomer used to appear between the dealer and the top (§11.2 item 3); now he appears one disc
clockwise from the dealer (with seat 1 dealing, between Ravi and Priya, below Ravi on the right).

## 5. Old APKs

No signature changes: `save_round`, `set_round_dealer`, `current_dealer`, `add_seated_player`, `reenter_player` (two
or three arguments) and `set_seating_order` keep their arguments and return shapes. An old APK keeps working: saved
rounds get their dealer from the server, so the scorecard's per-round dealers are right. Until it is updated, its own
"deals next" mark, Round saved line, join notice and re-entry line use the old rule and can name a different player
than the server then stores — a wrong label, not a wrong score, and it corrects itself on the next refresh after the
round is saved. Ship 057 and the APK together.

## 6. Rollback

`supabase/rollback/rollback_057_dealer_anticlockwise.sql` puts back 052's `next_in_rotation`, 052's `save_round`,
044's `set_seating_order`, 054's `add_seated_player` and 056's `reenter_player`, and drops `round_rule_dealer`.
Rounds already saved keep the dealer they were saved with; seats already given stay where they are; a pin for the
round being played is used once, as before. CI's rollback replay rolls 057 back first, checks the old bodies, then
re-applies 057.

## 7. Tests

- pgTAP `46_dealer_anticlockwise_057.sql`: the six-round table above, `round_rule_dealer`, `next_in_rotation` (in the
  rotation, out of it, wrapping), a join after round 1 with the dealer at the last seat (seat, pin, the next five
  dealers), a pool skip, same signatures. The older files are moved to the new rule where they assert who deals or
  where someone sits: 05, 21, 26, 32, 35, 38, 43, 44 (joins: seat after the dealer, two joins in a row, dealer at
  seat 1 and at the last seat, a kept Dealer-sheet pick, pool) and 45 (re-entries: default move with the pin, Keep
  seat, a picked seat, the dealer at the last seat, already on the dealer's left with an out seat between; its §10.6
  table is mirrored to SK HG VR PK AS so every case still tests what it was written for).
- Unit: `tests/dealer-anticlockwise-057.test.ts` (the table through `nextDealer`, the pool skip, Tara's join and a
  re-entry, the copy, joiners seated last pick first, the migration files) plus the dealer, Dealer-sheet, join,
  re-entry, circle and volume tests moved to the new rule.
- Seeds keep their saved dealers (played rounds never change); only the next deal follows 057. Game U
  (`seed-e2e.sql`) was dealt Sree, Alpha, Bravo, so Alpha deals round 4 and, with Alpha out, Sree deals round 5;
  game F's round 30 was dealt by seat 10, so seat 9 deals round 31.
- Maestro: `smoke/16` (Zed out, so Priya deals round 2; Zed keeps seat 4, already on her left), `smoke/16b` (Sree
  deals round 5; Charlie keeps seat 4; the second re-entry is now Golf, seat 8 → 2, because Bravo is already on
  Sree's left; the strip tap is Echo → seat 7, then Sree; Hotel from Standings to seat 2), `full/32` (seat 3 deals
  round 2, so the newcomers take seats 4–5), `full/51` (Test Hotel deals round 31: seat 9, then seat 10 after the
  reorder). `smoke/19`, `smoke/24`, `full/52` assert round 1 only (seat 1 deals) and do not change; `smoke/23`
  asserts the sheet with patterns, not names. `ci/volume/run-volume.mjs` accepts either direction for the dealer
  chain so staging passes before and after 057 is applied.

## 8. Questions for Sree (each with the default built)

1. **A newcomer sits on the dealer's own left hand (one disc clockwise from him on the circle), gets his cards last
   and deals last; he does not get the first open card straight away. Right?** Default: yes, as built (D70's "deals
   last, nobody's turn moves").
2. **A player added after Start but before round 1 is saved still takes the last seat** — the new top, who gets the
   first open card of round 1 and deals round 2. Default: unchanged (the order is still being set; the admin can move
   him in Order of players).
