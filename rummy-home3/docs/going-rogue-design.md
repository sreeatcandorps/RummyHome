# Going rogue: player, admin, creator — design spec (PR 20)

Status: **built as PR 20 (the simple version)** — §6 items 2 + 3 (players who scored see a deleted game under Home ›
Deleted games, open it read-only, Ask an admin to restore; admins and the creator restore it from the same places) plus
Q20.1 (a deleted game is really erased 30 days later by the nightly `purge_deleted_games()`, its Log rows kept under
`game_purged`), the honest confirm text (G02), the support card and Help bullet (Q20.7). Items 4 (round actions from the
Log) and 5 (last-reachable-admin guard) are **not built**; they stay below as the record of what was weighed. Migration
`045_going_rogue.sql` is **written, not applied** — Build Bot / Sree apply it. Spec written after his Nov 14, 10:27 PM PT
answer that PR 18 (creator-only delete) should not be built as proposed and that admins may hold the same delete / restore
power as the creator. Mockups: [`going-rogue-mockups/`](going-rogue-mockups/) (G01–G08, same style as the Pool and
Multiplier sets). Section 7 lists the questions; section 6 gives the recommendation and the simplest robust option.

The question in one line: *someone with power over a game — creator, admin, or a player — deletes the game, removes the
admins or players, deletes or edits rounds, and then disappears. How do we stop the damage we can stop, and get back
what we cannot stop?*

## 0. What already holds (so the proposal only adds what is missing)

Read from the migrations, not from memory:

| Today | Where | What it means for a rogue |
| --- | --- | --- |
| Delete game is a **soft delete**: `games.deleted_at / deleted_by`; every reader filters it out; nothing is removed from the database, ever. | 023 | A deleted game can always be brought back by someone with the right to. There is no "permanent delete" button and no purge job — "30 days" in PR 9 is a list rule, not a purge. |
| **Who may delete**: creator, any game admin, or an app admin (`can_manage_game`). **Who may restore**: the deleter or anyone in `can_manage_game`. | 023 | Admins already hold the creator's delete / restore power — exactly what Sree asked for on Nov 14. A rogue admin's delete is reversible by every other admin and by the creator. |
| **Who can see a deleted game**: only the deleter and `can_manage_game` people, under Settings › Hidden & deleted. | 023 / 028 | **Gap 1:** if the rogue is the only admin (or removed the others first) and the creator is unreachable, the players cannot even see that the game existed. |
| The **creator can never lose admin power**: `is_game_admin` reads `games.created_by`; nothing changes `created_by`. | 001 / 006 | A rogue admin cannot lock the creator out. A rogue *creator* cannot be stopped — by design ("you're believing the admin no matter what"). |
| A **player with any non-zero score cannot be removed** (`remove_seat_if_no_scores`). Removing an admin only demotes the seat to player. | 016 / 019 | Nobody can erase a player's history from a game by removing them. A removed admin still sees the game as a player. |
| **Undo** stamps `rounds.undone_at / undone_by`; **Edit round** retires the old row to a spare number and inserts a new one; scores are never deleted by the app. | 035 / PR 2 | **Gap 2:** the data for every edited or undone round is still there, but no screen or function brings it back. |
| The **Log** (036) records `deleted`, `restored`, `admin_removed`, `player_removed`, `round_edited` (with before/after), `round_undone`, with who and when; retained indefinitely. | 036 | The audit log Sree asks about in idea (d) exists. What is missing is actions on it. |
| **Deleting an account** (026) soft-deletes only games where nobody else with an account was ever a member; otherwise the game stays and, if no other admin is left, the first other registered seated player becomes admin. | 026 | A creator who deletes their account does not orphan the game. A creator who simply *stops opening the app* is not covered — see §2 scenario C. |
| App admins (Sree) can run `restore_game` on anything and see everything. | 023 | The support path in idea (c) exists at the database level; it has no front door. |

So two of Sree's four ideas are already true in the data and false on the screen: (a) nothing is ever permanently
deleted (we just never say so, and there is no 30-day promise), and (d) the audit log exists. The gaps are **visibility
for players** (Gap 1), **putting rounds back** (Gap 2), and a **front door for support**.

## 1. Who is who

- **Creator**: `games.created_by`. Always an admin; cannot be demoted or removed. One per game, fixed.
- **Admin** (`game_players.role = 'game_admin'`, seated or not): adds rounds, edits, undoes, changes settings, adds and
  removes players and admins, completes, deletes, restores. Same power as the creator except that admins can remove each
  other and the creator cannot be touched.
- **Player**: on the scorecard, no admin power. Can hide the game from their own Home. Cannot leave a game once scored.
- **Viewer** (spectator): read-only; irrelevant here.
- **App admin**: Sree and the allow-listed support accounts; can see and restore anything from the SQL side.

## 2. Scenarios, and what happens today

Sample game S14: creator Sree, admins Harish and Priya, seven players, seven rounds. "Disappears" means the person
stops answering and never opens the app again.

| # | Scenario | Today | Damage left behind |
| --- | --- | --- | --- |
| A | **A player** deletes rounds, removes people, deletes the game | Impossible. A player has no write path to rounds, seats or the game row (RLS + RPC checks). | None. Hide affects only their own Home. |
| B1 | **Admin Harish** deletes the game and disappears | Game is soft-deleted; off everyone's Home; Log row "Game deleted". Priya or Sree can restore it from Settings › Hidden & deleted; players see nothing. | Reversible — if Priya or Sree notice. Players have no way to tell them except by asking in person. |
| B2 | Harish **removes Priya as admin, then deletes the game**, and disappears | Priya is now a player and cannot see or restore it. Sree (creator) can. | Reversible only by the creator or an app admin. If Sree is also inactive (scenario C) the players are stuck until support is reached. |
| B3 | Harish **undoes rounds 7 and 6 and edits round 5**, then disappears | Rounds 6–7 are stamped undone; round 5's old row is retired and a new one saved. Log shows all three with before/after. Any admin can re-add rounds 6–7 by hand from the Log text and edit round 5 back by hand. | Recoverable by retyping — tedious, error-prone, and only if someone reads the Log carefully. |
| B4 | Harish **removes players** | Only players with no non-zero score can be removed; everyone scored stays. | None of substance. |
| C | **Creator Sree** removes both admins, deletes the game, disappears | Soft-deleted; nobody but Sree and app admins can see or restore it. | Players lose the game until support is reached. Sree says this is acceptable ("believing the admin") — but the players should still be able to *find* it and *ask*. |
| D | Creator or admin **edits rounds to change who won**, then completes and declares a Result | Log shows every edit with before/after. The Result is saved from the current scores. | Detectable (Log), not reversible without retyping. A result once declared can be deleted and re-declared (PR 9). |
| E | An admin deletes the game **by mistake** on a busy night | Same as B1: anyone in `can_manage_game` restores it; the 10-second Undo from PR 9 exists for results, not for games. | Fine when noticed; otherwise the game sits in Hidden & deleted forever. |

What the table says: **the irreversible cases do not exist** — nothing is purged, players cannot be erased once
scored, the creator cannot be locked out. What exists is **invisibility** (B2, C: the people harmed cannot see or ask)
and **tedium** (B3, D: data is kept but must be retyped).

## 3. Sree's four ideas, evaluated

### (a) No permanent delete; everything kept 30 days no matter what

**Already true, and stronger than asked**: nothing is ever removed. The honest problem is the opposite — we have no
retention promise and no purge, so "deleted" games accumulate forever and the PR 9 wording ("you can restore it for
30 days") is a list rule nobody enforces.

Recommendation: **make the 30 days real and say it everywhere.**

- Confirm dialog (G02): "Nothing is lost for 30 days. Everyone who played in it still finds it under Deleted games and
  can ask an admin to bring it back; you, Harish or Priya can restore it there. After 30 days it is gone for good."
- A nightly purge (`purge_deleted_games()`, pg_cron or the existing nightly CI dispatch) hard-deletes games with
  `deleted_at < now() - 30 days` **and** no live result holding them; the Log rows are kept with `game_id` nulled and a
  `game_purged` kind so the history line survives.
- Restore stays open to the deleter, every admin, the creator and app admins (as today). No "only the deleter" rule.

Cost: one migration (purge function + schedule + log kind), two strings. Risk: purging is the only *new* irreversible
action in this spec, so it runs only on rows older than 30 days and the pgTAP test proves a 29-day-old game survives.

### (b) Any player who ever had a saved score sees the game in their own Deleted games list

**Recommended — this is the fix for Gap 1 (scenarios B2 and C).** It is cheap, because `list_hidden_and_deleted` and
`get_game_bundle` already know who was seated; the change is the visibility predicate, not the data.

- Home gets a **Deleted games** section (G03), under Active / Completed, listing games deleted in the last 30 days
  where the viewer **has at least one saved score** (undone rounds included) or is an admin / creator. Greyed, with
  "Deleted by Harish · 2 days ago · gone for good on Dec 14".
- Opening one shows the **scorecard read-only** (G04-A) with a red banner and one button: **Ask an admin to restore.**
  It writes a Log row `restore_requested` and sends the existing in-app notice + email (024 plumbing) to the creator and
  every admin: "Anil asked to restore S14." The button then reads "Asked · Nov 10"; one ask per person per game.
- Admins and the creator see the same page with **Restore game** (G04-B) and the "Anil asked to restore it" line in the
  banner.
- Players cannot restore. Sree's principle stands: admins run the game; players can see and ask.

Server side: `can_read_game` gains a branch `deleted_at is not null and (can_manage_game or has_score)`;
`get_home_bundle` returns `deletedGames`; one new RPC `request_restore(p_game_id)`. The live link (`/s/`) stays
"This game was deleted" for the public — only signed-in players who were in it see the card.

### (c) Support ticket / backend restore path

**Recommended at the smallest size.** Everything needed exists (`restore_game` as app admin; the Unique game ID already
on every scorecard footer). What is missing is telling people:

- Settings › Hidden & deleted gets a card (G07): "Can't find a game? If the person who deleted it is gone and no admin
  is left, email **support@ezscore.app** with the Unique game ID. Within the 30 days an app admin can restore it; after
  that it no longer exists."
- The Help page (PR 11) gets the same bullet under Deleting.
- No ticket system, no form, no new backend. Sree (or whoever holds the app-admin account) runs
  `select restore_game('<id>')` from the dashboard — the same action the app would take.

If asks (b) are in place, this path is needed only when **every** admin and the creator are gone, which is the
edge of the edge.

### (d) Restoring after rounds were deleted or edited — versioning / audit log

**Recommended as two Log actions, not a versioning system.** The rows are already kept (Undo stamps, Edit retires), and
the Log already shows before/after. What is missing is a way to use them without retyping (Gap 2, scenario B3/D):

- **Bring round N back** on a `round_undone` Log entry (G06): clears `undone_at` on that round. Allowed only when it
  would keep rounds contiguous — i.e. the undone round is the next number after the current last live round — so the
  chip is active on round 6 and greyed on round 7 ("after round 6") when both were undone. Admin-only; Log row
  `round_restored`. The scorecard's current round moves forward.
- **Put round N back as it was** on a `round_edited` entry (G06): swaps the live row and the retired row (the current one
  retires, the old one takes the number back). Admin-only; Log row `round_reverted` with the numbers. Pool games run
  `pool_recompute` afterwards, as `undo_last_round` does today.
- **Show before / after** opens the existing Log detail (already stored) as two short rows.

Not proposed: a per-round version browser, snapshots of the whole game, or a "restore game to 9:00 PM" time machine.
The Log plus these two actions covers every case in §2 because the app never destroys a round row.

## 4. Prevention: the one new guard

The scenarios show that prevention is mostly already there (creator locked in, scored players locked in, soft delete).
One hole is worth closing (G05-B): **a game must never be left without a reachable admin.** Today Harish can demote
Priya and himself and walk away, leaving an inactive creator as the only admin.

- Rule: an admin cannot remove **the last other admin**, or step down themselves, while the creator has not opened the
  app in 14 days. That needs a new `profiles.last_seen_at`, stamped by `get_home_bundle` (one column, one line; there
  is no such column today). The dialog offers "Make Anil admin" first.
- The creator is exempt (they can always remove everyone — Sree's call), but gets the same dialog as a warning.

Everything else — approvals, two-person delete, cooling-off timers, "only the creator can delete" (PR 18) — is **not**
proposed. Sree's stance is to trust whoever holds admin; the spec protects the *record*, not the *decision*.

## 5. Screens (G01–G08)

| # | File | Shows |
| --- | --- | --- |
| G01 | `G01-scorecard-menu-delete.png` | The ⋮ menu today: "Delete game for everyone" for creator and admins; players get only Hide. Unchanged. |
| G02 | `G02-delete-confirm-30-days.png` | The new confirm text: who still sees it, who restores, 30 days then gone for good. |
| G03 | `G03-home-deleted-games-player.png` | Idea (b): Home › Deleted games for a player, "Ask to restore" and "Asked · date". |
| G04 | `G04-deleted-game-page.png` | A deleted game opened: A the player's read-only view with Ask; B the admin's view with Restore. |
| G05 | `G05-admins-players-guards.png` | A the guards that already exist; B the new last-reachable-admin dialog. |
| G06 | `G06-log-history-and-revert.png` | Idea (d): the Log with "Bring round N back", "Put round N back as it was", "Show before / after". |
| G07 | `G07-settings-deleted-and-support.png` | Settings › Hidden & deleted with "gone for good on …", a red "Restore now" on the last day, and the support card (idea c). |
| G08 | `G08-matrix-and-timeline.png` | The permission matrix (new rows in yellow) and the 30-day life of a deleted game. |

## 6. Recommendation, and the simplest robust option

**Recommendation (the full set, all small):**

1. Make 30 days real: nightly purge + honest confirm text (idea a). One migration, two strings.
2. Deleted games visible to the people who played, read-only, with Ask to restore (idea b). The core fix; one RPC, two
   predicate changes, one Home section, one banner.
3. Support card in Settings and Help (idea c). Strings only.
4. Two Log actions to bring rounds back (idea d). Two RPCs, two chips.
5. Last-reachable-admin guard (§4). One check in `set_seat_role`, one dialog.

Order of value: **2 → 4 → 1 → 5 → 3.** Item 2 alone turns every "disappeared" scenario from "stuck" into "a player
asks, an admin taps Restore".

**Simplest robust option** (if Sree wants one PR, not five items): **items 2 and 3 only.** Players can find and ask;
support is one email away; nothing new can destroy data because nothing destroys data today. It leaves "30 days" as a
list rule (as PR 9 has it) and leaves rounds to be retyped from the Log. Roughly PR 9-sized.

**Not recommended:** PR 18 as proposed (creator-only delete) — it removes power from admins Sree wants to trust, and it
does nothing for the creator-goes-rogue case, which is the one he raised.

## 7. Questions for Sree

- **Q20.1** Make the 30-day purge real (idea a as written), or keep "deleted forever but hidden" as today and just fix
  the words? The purge is the only irreversible thing in this spec.
- **Q20.2** Who gets the "Anil asked to restore S14" notice: creator + all admins (proposed), or creator only?
- **Q20.3** Should players who asked be able to *see* the Log of a deleted game (to notice "Harish undid rounds 6–7"),
  or only the scorecard? Proposed: scorecard + Log, both read-only.
- **Q20.4** The last-reachable-admin guard uses 14 days of creator inactivity. Right number? Or drop the inactivity
  condition and simply never allow a game to fall to one admin?
- **Q20.5** "Bring round N back" and "Put round N back as it was" — admin-only (proposed), or creator-only?
- **Q20.6** Does a deleted game that a player can now see count in their Results pickers or stats? Proposed: no;
  visibility is for finding and asking only.
- **Q20.7** support@ezscore.app — does the address exist, or should the card say "the person who gave you the app"?
- **Q20.8** One PR (simplest option, items 2 + 3) or the full set in one build PR?

## 8. Tests (codes for `docs/testing-strategy.md`; written with the build)

| # | Kind | What it proves |
| --- | --- | --- |
| X20-1 | D | pgTAP: a player with a saved score can read a deleted game (`can_read_game`) and sees it in `get_home_bundle.deletedGames`; a player with no score cannot; the public `/s/` page still says deleted |
| X20-2 | D | `request_restore`: one ask per person per game; Log row; notice rows for creator + admins; refused for non-members and on non-deleted games |
| X20-3 | D | Purge: a 31-day-old deleted game with no live result is removed, its Log rows survive with `game_purged`; a 29-day-old one and one held by a live result survive |
| X20-4 | D | `restore_round` (undone) only when contiguous; `revert_round_edit` swaps live and retired rows; Pool recompute runs; both admin-only and logged |
| X20-5 | D | Last-reachable-admin guard: demoting the last other admin while the creator is inactive is refused with the dialog text; allowed when the creator was seen within 14 days or another admin remains; `last_seen_at` stamped by the Home bundle |
| X20-6 | U | Home bundle maps `deletedGames`; "gone for good on" date math; Ask button states |
| X20-7 | S | Smoke: admin deletes → player's Home shows Deleted games → opens read-only → Ask → admin sees the line → Restore → game back on both Homes |
| X20-8 | C | Chaos (PR 17 suite): rogue-admin script (demote others, undo two rounds, edit one, delete, revoke session) → recovery by a second admin from the Log and Deleted games within the flow's time budget |

## 9. Place in the sequence

Spec only. If approved, the build stacks after PR 19 as PR 20 (build), after PR 14's 043 and PR 21's 044 (Seating order), so its migration is **045**.
It touches 023's readers (`can_read_game`, `get_home_bundle`, `list_hidden_and_deleted`), 035/036 for the round
actions, and the Home screen — about PR 9-sized for the simplest option, PR 10b-sized for the full set.
