# Delete result (PR 9)

How a saved result is deleted and brought back. The server side is `delete_result` /
`restore_result` from migration 023 (soft delete) with 034's `/r/` page and 036's Logs rows; PR 9
adds no schema. Decisions D9.1–D9.3 approved by Sree on Nov 13.

## Who may delete

The person who saved the result, an app admin, or someone who is an admin (creator or game admin)
of **every** game in it — `can_manage_result(uuid)`. Everyone else sees the result but no Delete.
The app asks `can_manage_result` per listed row for the Delete chip on Past results.

## Where Delete is

- **Result page**: a red outlined **Delete this result** button at the foot, under the Logs
  section, with one line beneath it: "S14 and S15 go back to Completed and can go into a new
  result. Everyone loses this result; you can restore it for 30 days." (one game: "S14 goes back…";
  labels are the games' own numbers, or their short code).
- **Past results row**: a red **Delete** chip on the right of each result the viewer may delete.
- The ⋮ menu on the result page keeps its Delete result item; it does the same thing.

## What happens (D9.1)

`delete_result` stamps `game_results.deleted_at / deleted_by` and runs `sync_closed_at` over the
result's games: a game is **Closed** only while a live, non-removed result holds it, so

- a game held only by this result goes back to **Completed** (its `status` column is untouched;
  Closed is `closed_at`), and can be picked for a new result;
- a game also held by another live result **stays Closed** (its `closed_at` becomes the earlier
  live result's date).

The games themselves are never deleted. Players' totals in other results are untouched.

## Undo and confirm (D9.2)

- Tapping Delete deletes **at once** and shows a 10-second toast "Result deleted · S14, S15 are
  Completed again" with **Undo**. Undo calls `restore_result`. When the toast closes without Undo on
  the result page, the page goes back to the list.
- A result that was **shared from this phone** (picture or PDF sent from the Share dialog — the
  share sheet opening counts, since the app cannot tell whether it was then cancelled) asks first:
  "Delete a shared result? This result was shared from this phone. The link will say it was
  deleted; the picture or PDF already sent stays as it is. Everyone loses it here, and you can
  restore it for 30 days." Cancel / Delete. The marker is `AsyncStorage` key `sharedResults`
  (last 200 ids), read again when Delete is pressed so a share made on the same visit counts —
  nothing on the server records a share, so another phone that shared it does not trigger the
  question here.

## Deleted list and Restore (D9.3)

Under Past results, a **Deleted** section lists results deleted in the last **30 days** that the
viewer could delete (from `list_hidden_and_deleted().deletedResults`, filtered on the phone by
`deletedAt`), greyed, with the date, "N games · N players", a Deleted tag and a **Restore** chip.
Beneath it: "Deleted results stay listed for 30 days under "Deleted" for the people who could
delete them; everyone else no longer sees them." Settings › Hidden & deleted keeps every deleted
result without a time limit; the 30 days is a list rule, not a purge (nothing is removed from the
database).

Restore (`restore_result`) is allowed to the deleter or anyone who may manage the result. It
clears the stamp and runs `sync_closed_at` again, so the games are Closed by it once more. Toast:
"Result restored · its games are Closed again".

## What stays visible after a delete

- `/r/<id>` (034 `public_result`): read-only, "This result was deleted on …", the saved standings
  and every version still shown.
- Result-saved emails already sent (024) are not recalled; their link opens the page above.
- Logs (036): `result_deleted` ("Result deleted · 1 game back to Completed · can be restored from
  Past results") and `result_restored` rows are written by the trigger; the result's Logs section
  and the game logs show them.

## Tests

- pgTAP `supabase/tests/30_results_delete.sql` (9.1–9.5, who may, Logs rows, double delete).
- Unit `tests/results-delete-pr9.test.ts` (copy, toast timer, consequence line for 0/1/2 games,
  30-day window, shared marker, the screens' wiring).
- Maestro smoke `e2e/smoke/12-results-zero-players.yaml` (the button and its line on a saved
  result; Delete → Undo toast → Undo; Delete on the row → toast runs out → Deleted + Restore →
  Restore) and `e2e/smoke/15-delete-shared-result-confirm.yaml` (share the picture, then Delete
  asks first). Nightly `e2e/full/40-results-save-and-past.yaml` repeats the Delete/Undo/Restore
  path on game A's result.
