# Phone checklist: Sree + Harish, next preview APK (build 5, head `859ee1c`)

Only the cases a cloud agent **cannot** verify on the web preview (see [`ai-vs-phone.md`](ai-vs-phone.md)). Everything else on these screens has unit tests or web screenshots on [PR #7](https://github.com/sreeatcandorps/RummyHome/pull/7). About 60 minutes for two people, in order. **S** = Sree's phone, **H** = Harish's phone.

## Before you start (5 min, not counted)

- [ ] Both phones have the **build 5** APK installed **over** the previous build (do not uninstall first — the upgrade path is one of the tests). Home shows `v1.1.0 (build 5)`.
- [ ] Both have WhatsApp and a PDF viewer. Harish has an email inbox he can open on the phone.
- [ ] Sree knows whether migrations **016** and **017** have been applied (see the PR table). Steps below say what to expect either way.
- [ ] Sree has pasted the new recovery template (`supabase/templates/recovery-passcode.html`, subject "Your EZ Score: Rummy OTP") in Authentication → Email Templates → Reset Password. If not, step 1.3 will show the old email; note it and move on.
- [ ] A spare email address Harish can register fresh (step 5.2), or a third test phone/account.
- [ ] Record results as you go in a new GitHub issue titled "Build 5 phone test" (one line per case: number, Pass/Fail, one sentence, screenshot if Fail).

## 1. Sign in and reset (12 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 1.1 | S, H | Open the app after the upgrade install. Kill it from Recents and reopen, twice. | Still signed in (or your email is pre-filled). Home shows **build 5** every time — it never shows build 4 again (the "APK reverts" bug). |
| 1.2 | H | Sign out. On Sign in, do not touch anything for two seconds. Then tap a passcode cell **once**. | On open, the cursor is already in Email and the keyboard is up. One tap on the cells opens the **number pad** (not the full keyboard) on the first tap; a caret blinks in the cell. × clears the cells. |
| 1.3 | H | Sign in → Forgot passcode → enter your email → Send. Open the email on the phone. Switch back to the app. | Email arrives within about a minute from the EZ Score sender (not "Supabase Auth"), subject "Your EZ Score: Rummy OTP", a **6-digit code**, **no link**. In the app the OTP box is focused with the number pad; the keyboard may offer the code as an autofill chip (nice, not required). Type a wrong code → refused with OTP wording. Type the right code, a new passcode twice → back at Sign in with email pre-filled. Sign in with the **new** passcode works; the old one is refused. |
| 1.4 | S | Profile → Change passcode → current, new, new → Save. | Green Saved. If the project asks for a fresh check, an OTP email arrives and the dialog asks for it. Sign out, sign in with the new passcode. |

## 2. New game (5 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 2.1 | S | New game. Look at the list before tapping. Tap **+ Add me**, then tap Harish's row, then two more people. | You are first in the list with a "You" tag (not missing, not last). Each tapped row **slides** into the face strip smoothly, no flash or jump (this is `LayoutAnimation` on Android). Badge reads **Playing · 4**. |
| 2.2 | S | Press the phone's **Back** button while on the picker. Reopen New game. | Back returns to Home without a crash. The draft either comes back with the same four or is clearly empty — note which. Then start the game. |

## 3. Scoring (9 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 3.1 | S, H | S: Add round, tap a player, type a score on the keypad, tap the others, Save round. H: keep the scorecard open and do **not** pull to refresh. | On S the on-screen keypad is used, the system keyboard never appears. On H the new round appears within a few seconds by itself (realtime). |
| 3.2 | S | Round 2 with one **Rummy** winner. Then ⋮ → Edit round → change one score → Save. Then ⋮ → Undo last round. | Rummy takes the table's losses. Edit replaces the round in place (no extra row). Undo removes it on S **and** on H without a refresh. |
| 3.3 | S | Fill round 3. Turn on **airplane mode**. Tap Save round. Wait for the message. Turn airplane mode off. Tap Save round again. | A clear error, no crash, no spinner that never ends. After reconnecting, **one** round 3 exists on both phones — no blank row, no duplicate (the "blank round 6" bug). |
| 3.4 | H | Open Add round (H is not an admin yet). | H has no way to save a round: the entry is hidden or read-only, with the role shown on the Home card as "View only"/player. |
| 3.5 | S | Add round, type a number for one player, press phone **Back**. | Back leaves the screen without a crash; nothing is saved. Reopen: the sheet is empty. |

## 4. Mid-game add and remove (6 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 4.1 | S | Scorecard ⋮ → Players in this game → **Add new players** → pick one person → Return to game. | Badge says **Added 1**, only the new pick is yellow, the whole roster is listed. Back on the scorecard the new player has **0** in every played round. H's scorecard gains the column within seconds. |
| 4.2 | S | Players in this game → remove the player you just added (all zeros). | **016 applied:** removed, column gone on both phones. **016 not applied:** "Removing a player who has rounds isn't available yet" — no crash. |
| 4.3 | S | Try to remove a player who has a non-zero score. | The exact "You cannot delete this player…" message; nothing changes. |

## 5. Invites and registration (9 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 5.1 | S | Players in this game → add an unregistered player by initials (e.g. "R K") → ⋮ on that seat → **Invite to register** → choose WhatsApp → send to Harish. Return to the app. Open ⋮ again. | The Android share sheet opens; the message has the Player ID and a link. The app is still alive when you come back (no crash, no blank screen). The seat shows **Pending registration** immediately. The ⋮ menu still opens. |
| 5.2 | H | Tap the link in WhatsApp. Register with the spare email (cold start of the flow). Open the confirmation email, tap the link, return and sign in. | Link opens the app (or the get page with "Open in app"), then Register. "Check your email" screen. Confirmation email arrives. After sign-in: **"Is this you? You played in G… with Sree"** → Yes. The game appears on H's Home with R K's scores now under H's name. On S the seat shows Registered. |

## 6. Linking a Player ID (4 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 6.1 | H | New game **without** tapping + Add me: seat Sree and one unregistered player ("A B"), start it, save one round. Players in this game → ⋮ on A B → **Link to a Player ID** → type **your own** Player ID → preview → Confirm. | Preview shows Harish. **017 applied:** A B's seat and score become Harish's, Harish is now seated and still admin; My players has no "Harish" row for himself. **017 not applied:** the server answers "They are already in this game." and nothing changes. Note which. |
| 6.2 | H | In the same game, add another unregistered seat and try to link it to **Sree's** Player ID. | Refused at once: "They are already playing in this game." |

## 7. Results (5 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 7.1 | S, H | S: Complete game → confirm twice. H watches. | Final scores sorted highest first. H's Home moves the game to Recent within seconds. H's ⋮ on the completed game has **no Reopen**; S's does. |
| 7.2 | S, H | S: Home → Results → the completed game is pre-ticked → Show results → Declare. H: Home → Results → past results. | H sees the declared result and can open it. If a third account with no games is available: it sees **nothing** in past results. |

## 8. Share and PDF (6 min)

| # | Who | Steps | Expected |
|---|---|---|---|
| 8.1 | S | Completed game → **Share final scores** → preview → Share → WhatsApp to Harish. Come back, open ⋮. | Yellow sheet preview; WhatsApp receives a **readable** image (names, 5 cells per row, times, Game ID footer). ⋮ still works after the share sheet. |
| 8.2 | S | Results → Share results (image), then **Share full details (PDF)** → open in a PDF viewer. | Image shows places and the per-game breakdown, Result ID at the bottom. PDF opens, one column, every round of every game, Result ID footer. |
| 8.3 | S, H | Live game ⋮ → Share live scorecard → copy link → open in Chrome on H. S adds a round. | Chrome shows the table (not page source), with start time and game ID. The new round appears on the page within ~8 seconds without reloading by hand. |

## 9. Two users at once (6 min)

Make Harish a **game admin** first (Players in this game → ⋮ → Admin).

| # | Who | Steps | Expected |
|---|---|---|---|
| 9.1 | S + H | Both open Add round for the **same** next round, fill different scores, count down 3-2-1 and tap Save together. | Exactly **one** round with that number on both phones. The second person gets a clear message or just sees the other's round. No blank row, no duplicate, no crash. |
| 9.2 | S + H | H opens Add round and starts typing. S adds a mid-game player. H taps Save. | H's screen refreshes with the new player, or Save is refused with a clear message. No crash, and the saved round (if any) balances. |
| 9.3 | S + H | H: ⋮ → Undo last round while S is looking at the scorecard. | S's scorecard drops the round within seconds. |
| 9.4 | S + H | Both go to Results, tick the same completed game, both tap Declare. | One result exists. The second person sees the "already in another result" warning, not a second result. |

## If you run short

Do 1.3, 3.3, 5.1, 8.1, 9.1 first — those are the five that automation has never touched and that broke on earlier builds.
