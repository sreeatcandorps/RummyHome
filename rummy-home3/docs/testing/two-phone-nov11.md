# Two-phone test plan — preview APK, Nov 11 2026

**Build under test:** `cursor/ezscore-apk-ready` at `0295ba2` (all PR 7 work), EAS `preview` profile, Android APK, versionCode 7 (EAS auto-increments from 6). Live Supabase project has 017, 018, 019 and 020 applied.

**Phones**

- **Phone A — Sree.** Creator and admin of every test game.
- **Phone B — Sree's second Android phone, or Harish.** A *different* account from A.
- **Laptop (optional, cases 3b and 4b only):** Supabase dashboard → SQL editor for the live project.

**Before you start (once)**

1. Install the APK on both phones (uninstall the old preview first if the install is refused). Open the app, sign in: A with Sree's account, B with the second account.
2. On each phone open the **Profile** tab and write down the **Player ID** (`#NN`). Below: `#A` and `#B`.
3. On A: **My players → Find player in database**, type `#B`, add B. (Skip if B is already in My players.)
4. On A: **New game** → pick A ("+ Add me" if needed) and B → start the game. Call it **G-test**.
5. On A: scorecard **⋮ → Players/Admins → B's ⋮ → Make admin.** B's card now reads **Admin**.
6. On B: pull down on Home; **G-test** appears under Live with the **Admin** tag. Open it.

Each case below: numbered steps, then **Expect:** one line. Take a screenshot of anything that differs and note the phone, the round number and the time.

---

## 1. Two admins save the same round at the same moment (019)

1. Both phones open the **G-test** scorecard. Agree on the next round number, say round 3.
2. On both phones tap **Add round** and type scores. Use *different* numbers on A and B (A: −40 / +40, B: −60 / +60).
3. Count down and tap **Save round** on both phones within the same second.
4. The slower phone shows a dialog titled **Round already saved**. Read the text.
5. Tap OK. Look at the scorecard on both phones.

**Expect:** one phone saves; the other sees *"Round 3 was just saved by someone else. The scorecard has been refreshed; check it before you save again."*, its typed scores are cleared, and both phones show round 3 once, with the winner's numbers. No blank round, no duplicate round 3.

Variant (same payload): repeat with the *same* scores on both phones. **Expect:** no error on either phone; round saved once.

## 2. Remove a seat while the other phone is saving (019 + 016)

Setup: on A, scorecard **⋮ → Players/Admins → Add new players → Add players**, add an unregistered player **Zed**, tap **Return to game**. Zed gets 0 for every round already played.

**2a — remove first, then save**

1. On B: **Add round**, type scores for everyone including a non-zero score for Zed. Do **not** save yet.
2. On A: **⋮ → Players/Admins → Add new players**, tap the **×** on Zed in the face strip. Zed disappears at once.
3. On B: tap **Save round**.

**Expect:** B sees *"The players in this game changed while you were scoring. The scorecard has been refreshed…"*, the scorecard reloads without Zed, and nothing was saved for that round.

**2b — save first, then remove**

1. Add Zed again (same path as setup).
2. On B: **Add round**, give Zed a non-zero score, **Save round**.
3. On A: **Add new players → ×** on Zed.

**Expect:** A sees *"You cannot delete this player. You cannot delete a player that has a score…"* and Zed stays. Then on B **⋮ → Edit round**, set Zed's score in that round to 0, save; on A the × now removes Zed and his 0 rows, and B's scorecard loses the Zed column after a moment.

## 3. Privacy (019)

**3a — others never see email, phone or postal code**

1. On B: **My players**, tap Sree's card. Read every field.
2. On B: **Find player in database**, type `#A`. Read the result card.
3. On B: open **G-test → ⋮ → Players/Admins**. Read A's card.
4. On A: **Profile** tab → own profile.

**Expect:** B sees only name, initials, Player ID, role and registration for A — no email, no phone, no postal code, anywhere. A still sees their own email and phone on their own Profile.

**3b — nobody can make themselves an app admin** (laptop; the app has no screen for this, so it is checked at the database)

1. In the Supabase SQL editor run, replacing `<B uid>` with B's `auth.users.id`:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<B uid>","role":"authenticated"}';
update public.profiles set role = 'app_admin' where id = auth.uid();
rollback;
```

2. Read the error.

**Expect:** the update is refused with `42501` *"Only an app admin can change a player's role."* (or *"…grant the app admin role."*). Re-saving B's profile from the app (Profile tab → Settings → Save) still works.

## 4. Link to a Player ID takes over the seat (017)

**4a — non-playing co-admin takes the seat** (all in-app)

1. On A: **New game** with A and an unregistered player **Harish (temp)** (Add players). Start it; call it **G-link**. Play one round so the temp seat has a score.
2. On A: **⋮ → Players/Admins → Add admin**, type `#B`, confirm. B is listed under **Game admins** as "not playing" and has no score column.
3. On B: pull down Home; **G-link** shows with **Admin**; open it — no own column.
4. On A: **Players/Admins → Harish (temp) ⋮ → Link to a Player ID**, type `#B`, confirm.
5. Both phones look at the scorecard and Players/Admins.

**Expect:** the temp seat, its score and its dealer turn now belong to B; B is seated **and** still Admin; B's column shows the round-1 score; Harish (temp) is gone; no duplicate row for B.

**4b — view-only member takes the seat** (one laptop step, because the app no longer has an "Add view only" button)

1. On A: **New game** with A and unregistered **Kiran (temp)**; start it; call it **G-view**. Play one round.
2. Laptop, SQL editor:

```sql
insert into public.game_players (game_id, profile_id, player_order, role)
values ('<G-view id>', '<B uid>', 99, 'spectator');
```

3. On B: pull down Home. **G-view** appears with **View only**; open it — no Add round button.
4. On A: **Players/Admins → Kiran (temp) ⋮ → Link to a Player ID → `#B`**, confirm.

**Expect:** B becomes the seated player with Kiran's score; the **View only** tag is gone on B after a pull-down and **Add round** is still absent (B is a player, not an admin).

**4c — still refused when the target already plays**

1. In **G-test** (B is seated), add unregistered **Pat (temp)** and link Pat to `#B`.

**Expect:** *"They are already playing in this game."* and nothing changes.

## 5. Results: reused-game warning and Player IDs (018)

Setup: have two **Completed** games (scorecard → **Complete game** → confirm) where A is admin. Call them **G-r1** and **G-r2**.

1. On A: Home → **Results** → **Select completed games**. Tick **G-r1** only → **Show results** → **Save result** → OK. G-r1 is now **Closed**.
2. Back on the picker, turn the **Closed** chip on. Tick **G-r1** and **G-r2** → **Show results**.
3. Read the warning lines at the top of the results page.
4. Look at the totals and the by-game table.
5. **Save result**, read the popup, then open **Past results**.
6. Share the results image from the saved result.

**Expect:** step 3 shows *"G-r1 is already part of a previous result. Its points count again here."*; step 4 shows each player's initials and `#ID` under the name in totals and the Player ID under the name in the by-game table; the popup lists `G-r2: Completed → Closed` and `G-r1: already Closed · counted again`; the past-results card has the small warning icon; the share image has a Player ID line under each name.

On B: open Results → Past results. **Expect:** B sees only results from games B is in; a result for a game B is not part of does not appear.

## 6. Speed and scrolling (020 + client changes)

Use a stopwatch; Wi-Fi on both phones.

1. Force-close the app on A, reopen, sign-in state kept. Time from tap to a drawn Home.
2. Scroll the **Recent** section top to bottom and back, fast.
3. Open a live game from Home, go back, open it again.
4. Open **My players**; type in the search box; clear it; change the sort.
5. Open the live scorecard and tap **Add round**.
6. Turn airplane mode on, reopen the app.

**Expect:** Home draws in under 2 s and shows *every* live game first, then the full Recent list (no "Show more", no new filter); Recent scrolls without stutter or blank rows; the second scorecard open is instant and the first takes under 1 s; My players opens in under 1 s and the search field never lags a keystroke; Add round opens with the player names already filled; offline, Home and My players still show the last data with no crash.

Record each timing in the table at the end.

## 7. Realtime: the other phone sees the change

1. Both phones on the **G-test** scorecard. On A **Add round**, save.
2. On A **⋮ → Players/Admins → Add new players**, add an unregistered player, **Return to game**.
3. On B **Add round**, save.
4. On A **⋮ → Edit round**, change one score, save.
5. On A **Complete game**, confirm.
6. On B go back to Home and pull down.

**Expect:** after each of steps 1–4 the other phone's scorecard updates by itself within about 2 s (no pull-to-refresh), exactly once, with no flicker or duplicate round; after step 5 B's scorecard shows the game completed, and in step 6 it has moved from Live to Recent.

---

## Timings (fill in)

| Screen | Phone A | Phone B |
|---|---|---|
| Home cold open | | |
| Home warm open | | |
| Scorecard first open | | |
| Scorecard second open | | |
| My players open | | |
| Results picker open | | |

## Result

| Case | A | B | Notes / screenshot |
|---|---|---|---|
| 1 save conflict | | | |
| 2a remove then save | | | |
| 2b save then remove | | | |
| 3a no contact fields | | | |
| 3b self-promotion refused | | | |
| 4a co-admin takeover | | | |
| 4b viewer takeover | | | |
| 4c seated refused | | | |
| 5 results warning + IDs | | | |
| 6 speed | | | |
| 7 realtime | | | |

Clean-up afterwards: delete the test games from the SQL editor or leave them (they are only visible to A and B).
