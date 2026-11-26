# Design review 2 — the whole app, as a professional would see it (Nov 21, 2026)

Sree: "I think we're in a place where we can do one overhaul of the design … some screens still don't look that
great, especially the settings screen. There are all kinds of oval shapes in it for no reason … find all the
inconsistencies … make it the most usable, most pleasing-looking design … document first."

**Status: document only. Nothing is built.** Sree picks a size (§5) and sends the competitor screens he mentioned;
then mockups (show, then build), then the build in two or three PRs.

Read with: [`design-review-2/findings.png`](design-review-2/findings.png) (six screens, captioned with the finding
numbers below). Every frame is from the Pixel 6 smoke run of `main` @ `f98f4ac2`, light theme.

---

## 0. Where the app stands

> **Status (Nov 21):** Sree picked **S, mockups first** (Q11: "Go with Small now, mockups first"). The four S mockups
> are in `design-review-2/mockups/small-*.png` (before = the v17 CI frame, after = light and dark); **no code until
> he approves them screen by screen.** His competitor review is in §7 with recommendations; his APK v17 notes on three
> screens are in §8 with mockups. Small fixes he reported on the same pass are collected in `next-up.md` ("Small fixes
> batch") and go out as **one** PR when he says so.
>
> **Nov 21, 2:31 AM** — Sree: "What about the new designs? That's what I'm very interested in. Are we also doing any
> color changes?" The four S screens are above (§5, `small-*.png`); the colour question is answered in **§9** with
> three palettes on the same four screens, light and dark (`palette-*.png`), recommendation **B · Felt & Brass**.
> **Nov 23** — Sree: "Palette B" (**D65**); then "Yes to the Profile redesign" (**D66**). Still no code: he is
> then "Yes to the Settings redesign" (**D67**), "Yes to the Game type redesign" (**D68**), and for Sign in "the redesign
> is good, but can you pick a better image? … just get the Joker card" + keep the passcode eye (**D69**, re-mocked in
> `small-sign-in.png`). All four S screens are approved; still no code ("Mockups only, no building yet"). §10 is the
> build spec per screen, ready for the first S PR on his "build".

PR 15 (`design-audit.md`, Nov 17–18) fixed the **token** layer: one button component with two weights, one `Tag`,
one `SearchField`, one dialog family, one date format, radii from a table, sentence-case headings. That work holds —
the pieces are consistent with themselves.

What PR 15 did not touch is the **shape language and the hierarchy**: *which* piece a screen uses for *what*, how
many containers sit inside each other, and what colour means. That is where the "ovals for no reason" come from.
The Profile screen is the clearest case: it is built entirely out of the primary-action parts (filled pills,
outlined pills, tinted blocks), so a page of settings looks like a page of twelve calls to action.

Honest overall read: the **game screens** (Scorecard, Add round, Awards, Final scores, Order of players) are good
and close to done — the numbers are the hero, the keypad is confident, landscape works. The **shell** (Home, Profile,
Settings, Game type, Sign in) is where the app looks home-made. That is the normal shape for an app built
feature-first, and it is the cheaper half to fix.

## 1. What Robinhood, Spotify and Duolingo actually do (and what to take)

Not their colours or their brand — the disciplines under them.

| App | The discipline | What it means for EZ Score |
| --- | --- | --- |
| **Robinhood** | One accent. Numbers are the hero; everything else is quiet. Lists are flat rows with hairline dividers, almost no cards and no borders. One filled button per screen, always at the bottom. Settings is a grouped list with chevrons. Big, light titles. | Profile / Settings become **grouped lists**, not card stacks. Scorecard header gets quieter so the scores win. One filled button per screen (we mostly have this). Drop the tinted info blocks. |
| **Spotify** | Content first, chrome last. Dark is the real theme and light is derived. Rows are identical everywhere: leading square, two lines of text, trailing control. A plain icon tab bar. Bold type, no outlines. | A real **tab bar** (icons, not pills). One **row** component used on Home, My players, Results, Settings. A **dark-first pass** — ours is light-first and dark is untested in the screenshot matrix. |
| **Duolingo** | Feedback and warmth: big friendly buttons with a bottom edge (we already have the 4 px edge), motion that confirms a tap, a celebration when something completes, progress always visible. Playful, but on a strict grid with few colours. | Keep the edge. Add **one** celebration (Complete → Final scores, once, not confetti every time). The seating tutorial (D61) is the Duolingo move — more of that pattern instead of walls of help text. |

What **not** to take: Robinhood's black-and-green-only palette (a rummy table is warm; the cream and the marigold
are right for us), Spotify's density (our users are 40–70 and the phone is on a table), Duolingo's mascot and
streaks (no).

## 2. Findings, ranked

Impact: **P1** it changes what a user understands or does · **P2** it makes the app look unfinished · **P3** polish.
PR 15's numbers were A01–A21; these continue as B01–B20 so the two lists never collide.

| # | Impact | Finding | Where it shows | Recommendation |
| --- | --- | --- | --- | --- |
| **B01** | **P1** | **Pills are used for things that are not actions.** Share your Player ID, Change passcode, Privacy policy, Delete account are four full-width pills on one screen; Appearance is three pill segments; Settings and Help are tinted blocks with chevrons. The eye cannot tell the one thing to do from the eleven things it could do. | Profile (both halves), Sign in ("Create account" pill under the card) | **Rule: a pill is the one primary action of a screen, or lives in the bottom bar. Nothing else is a pill.** Navigation = a row with a chevron. Secondary actions = a text button or a row. Destructive = a red text row at the very bottom, never a filled red bar. |
| **B02** | **P1** | **One card per setting.** Phone, Email, Appearance, Account, Settings, Help are each a card holding one row, each with its own icon in a pale square and its own ⓘ. Eight cards, eight icons, eight info buttons on one screen. | Profile | Profile becomes **one grouped list** (Robinhood Account / iOS Settings shape): a header block (avatar, name, e-mail, #1 as a quiet line), then groups — *Your table* (initials, Player ID, share), *Notifications* (Phone, Email), *Game defaults* (→ Settings), *Appearance* (segmented, the one control that stays inline), *Help & guide*, *Account* (Privacy policy, Change passcode, Delete account, Log out as red text). Hairline separators, no icon squares, no per-row ⓘ (one Help button in the header). |
| **B03** | **P1** | **Yellow means five things.** The game-number square (identity), a selected game (selection), the Settings row (navigation), the hint "A 30 is 30 · a Full count is 80" (information), the Add round selected key (state), and Results / My players on Home (navigation again). Blue means three: the #1 banner, the Help row, "Not saved yet". | Profile, Home, Game type, Add round, Results | **Colour contract:** marigold = *a game or a selection*; brand green = *the primary action and positive numbers*; blue = *an informational notice, once per screen at most*; red = *destructive and negative numbers*; grey = everything else. Hints under controls are plain grey text. Navigation is never tinted. |
| **B04** | **P2** | **Tinted blocks read as alerts.** The yellow Settings row and the blue Help row on Profile look like warnings; the beige "Your initials on scorecards" box looks disabled. | Profile | Rows (B02). The initials box becomes a row with the value on the right and a pencil. |
| **B05** | **P2** | **Containers inside containers.** Game type: screen → "Pool settings" card → bordered field → label inside the field. Scorecard: outer card → header strip → chip. Results: card → tinted block → chip. Three border levels is one more than any of the reference apps use anywhere. | Game type, Scorecard, Results, Awards | **One border level per screen.** A screen is either a list on the background or a single card; never a card in a card. Section headings separate groups, not boxes. |
| **B06** | **P2** | **Six input styles.** Tiny labelled boxes (Drop / Middle / Full), a multiplier field with a leading ×, chips + "Custom…" for the pool limit, radios for re-entries, a segmented pill for Game type and for Appearance, the Add round keypad's preset chips. | Game type, Settings, Add round, Dealer sheet | **Control rule:** 2–3 options side by side = one segmented control (the Game type one is right; Appearance and Pool limit 101/201/251 use the same). 4+ options or options with explanations = a radio list. Chips only for *filters* (Completed / Closed / Active). Numbers = one outlined field with the label above, never inside, full row width or exactly half. |
| **B07** | **P2** | **The scorecard header is the loudest thing on the scorecard.** Four tinted chips (S1 · Points · 4 players · Round 4) under the title; per-player coloured underlines; DEALS / OPENS micro-tags; totals in three colours. The scores underneath are what people came for. | Scorecard (4 p and 20 p), Pool scorecard | Chips become **one line of quiet text** ("Points · 4 players · Round 4"; S1 is already in the title). Keep the dealer mark (one crown) and drop the underline colours (the initials are already coloured avatars elsewhere; here they are column labels). Totals stay coloured — they are the one number that matters. |
| **B08** | **P2** | **Three bottom buttons** (Undo · Add round · Complete) on the screen people use most; Undo is grey-outlined and sits where a Back would. | Scorecard | Two in the bar — **Add round** filled, **Complete** outlined — and Undo moves into ⋮ *and* into the toast after a save ("Round 7 saved · Undo", 4 s). Fewer mis-taps on the table. |
| **B09** | **P2** | **Home has no title; it has a logo.** "EZ Score: Rummy" with the icon sits where every other screen puts its title; then "Hi Sree"; then a green pill, two yellow pills, then the list. Four rows of chrome before the first game. | Home | Large title **"Hi Sree"** (or "Your games") as the only header; **New game** as the one filled button; Results and My players move to the tab bar (B10) — then the first game card is the second thing on screen. |
| **B10** | **P2** | **The tab bar is two pills.** Home and an avatar, drawn as buttons. Results and My players are then buttons on Home instead of destinations. | Every tab screen | A plain **four-tab bar**: Home · Results · Players · Me (avatar). Icons with labels, brand green for the active one, no pill. This is the single biggest "feels like a real app" change and it removes B09's yellow pills for free. |
| **B11** | **P2** | **The same question is asked with different controls** across the settings surfaces: pool limit (chips) vs re-entries (radios) vs re-entry score (radios) vs late entry (radios) vs Game type (segmented) vs Appearance (segmented). | Game type, Settings | B06's control rule, applied once; the four pool questions become one list of four rows with a segmented control each ("101 · 201 · 251 · Other", "Unlimited · Limited", "Highest · Highest + 1", "Highest · Highest + 1"). |
| **B12** | **P3** | **Icon squares as section decoration.** Pale-green squares with an icon before Phone, Email, Account, Appearance, Settings, Help, Game type, Pool settings — the same ornament eight times. | Profile, Game type, Settings | Drop them. A section title is text. Icons go where they *mean* something (the tab bar, the share icon, a status). |
| **B13** | **P3** | **Tag overload on game cards.** Every live card carries ● Active · Creator · Points plus the player count; inside a section called *Live*, "Active" says nothing, and "Creator" is true for most of a person's games. | Home, Results picker | One line under the title: "Points · 13 players". Status only when it is *not* the section's (a closed game in Recent). Creator becomes a quiet "Admin" tag only when you are *not* the creator. |
| **B14** | **P3** | **The Add round pane mixes six control styles**: + / − toggle, four preset chips, a lavender Rummy key (a sixth colour), the digit grid, Balance, Save. | Add round | Keep the keypad. Rummy becomes a green key (it is the good outcome); presets become the same shape as digits; the sign toggle becomes two keys in the grid's first column. One palette, one key shape. |
| **B15** | **P3** | **Dark mode is unreviewed.** Every screenshot matrix is light; dark tokens exist but nobody has looked at 60 dark screens side by side. | All | Add a dark column to the CI gallery (`smoke` once in dark) before the overhaul; fix what it shows during it. |
| **B16** | **P3** | **Hint text under every control.** "Where a re-entering player starts.", "100 is in, 101 is out.", "Out players may re-enter as often as they like…" — true, useful, and it doubles the height of every settings screen. | Game type, Settings, Profile | The ⓘ mini-help pattern already exists (PR 11): hints go behind it; the one-line rule stays on screen only where a wrong answer costs money (pool limit). |
| **B17** | **P3** | **Sign in says "Secure sign-in enabled."** A line that means nothing to the person reading it; "New here?" + a pill. | Sign in | Remove the line. "New here? **Create account**" as a text link under the button. |
| **B18** | **P3** | **Help pages are bullet walls.** Good content, heavy form; the *Order of players* section is 11 bullets. | Help | More of D61: a *Watch how* per hard section (Q10), fewer bullets per section (the rest in *Tricky cases*). |
| **B19** | **P3** | **Motion is incidental.** A halo that breathed for ever (fixed in #109), a pop on a counter, LayoutAnimation on a list; nothing on Complete, nothing on a saved round, nothing on Awards. | Complete, Add round, Awards | One **confirming motion** for the three moments that matter: round saved (the new row slides in), game completed (the final scores card scales in once), awards saved (the pool total counts up). Each under 400 ms, each once. |
| **B20** | **P3** | **Type scale is wide at the bold end.** Six bold sizes on Profile alone (title 28, name 24, section 18, row 16, pill 16, caption 12 bold). | Profile, Game type | Three bold sizes (title, section, row) + regular body + caption. Numbers get the one display size they already have on the scorecard. |

Kept on purpose (do not change): the warm cream background and marigold / green pairing; the 4 px button edge;
the Add round keypad concept; the scorecard's numbers and landscape; the seating tutorial; coloured initials avatars
in lists (and none in the header — A14).

## 3. What the Profile screen would become (the "ovals" fix, in words)

```
Profile                                           ?
┌ ST  Sree Test                                   ┐
│     sree@test.local · #1                        │   ← header block, no border
└─────────────────────────────────────────────────┘
YOUR TABLE
  Initials on scorecards              ST        ✎
  Player ID                           #1        ›   ← tap: share sheet
NOTIFICATIONS
  Phone                      No number yet      ›
  Email                      Game started       ›
GAME DEFAULTS
  Points · Pool · Drop · Middle · Full count     ›   ← today's yellow block
APPEARANCE
  [ Phone | Light | Dark ]                            ← the one inline control
HELP
  How each screen works, tricky cases            ›
ACCOUNT
  Change passcode                                ›
  Privacy policy                                 ›
  Delete account                       (red)     ›
  Log out                              (red)
                 EZ Score v1.1.0 (build 1)
```

Zero pills. One border level (none). The same row component the rest of the app would use.

## 4. Inconsistencies by the numbers (the sweep)

Counted in code on `main` @ `f98f4ac2` (`rg`), so each finding has a target a test can pin:

- Filled / outlined buttons on **Profile** (`app/(tabs)/me.tsx`): **13**; on Sign in: 3. B01's target: 0 on Profile (Log out and the rest become rows), 1 on Sign in.
- `SectionCard` with an `icon=` (the pale icon square before a section title): **23 of 30** uses. B12's target: 0 — the prop goes away.
- `secondaryContainer` (the marigold fill) referenced in screens and components: **23**; by eye about a third are a game or a selection, the rest are navigation, hints and state. B03's target: every use is a game or a selection.
- Option controls for a choice of ≤ 3: `SegmentedButtons` 6, `RadioButton` 14, Paper `Chip` groups 3, the Appearance pill row 1. B06's target: one `SegmentedChoice` for 2–3 options; radios only for 4+ or when each option needs a line of its own.
- Screens with a bordered container inside a bordered container, from the screenshots: Game type, Settings, Scorecard, saved Result, Awards, Players · Admins — 6. B05's target: 0.

## 5. Three sizes of overhaul — pick one

| | **S · Shell clean-up** | **M · Shell + shape** | **L · New identity** |
| --- | --- | --- | --- |
| What | B01–B06, B11, B12, B16, B17: Profile / Settings / Game type rebuilt as grouped lists with the control rule; colour contract applied; hints behind ⓘ | S **+** B07–B10, B13, B14, B19: four-tab bar, Home with a title, quiet scorecard header, two-button bar with Undo in the toast, one row component everywhere, three confirming motions, dark pass (B15) | M **+** a type choice (a display face for the numbers), dark-first palette, illustration on empty states and Final scores, onboarding screens, a new icon |
| Touches | Profile, Settings, Game type, Sign in; `components/ui/Row`, `SegmentedChoice`, `SettingsGroup` | + Home, tab layout, Scorecard header, Add round pane, every list | + every screen, assets, store listing images again |
| Risk to what works | none to the game screens | the scorecard header and bottom bar change under people who have learned them (v12–v17 testers) | a relaunch; the Play listing images are redone |
| What Sree has to decide | approve the mockups | tab bar yes / no; Undo out of the bar yes / no | a direction board first |
| **Recommendation** | **Do now** — before the Play review ends, so the first public build does not carry the Profile screen | **Next**, after Sree's competitor screens and the first outside feedback; the tab bar is the one thing in M worth doing early if he says yes | **Not yet** — an identity change before anyone outside has used the app is designing in the dark |

Process either way: **mockups first** (PNG per screen, light and dark, in `docs/design-review-2/mockups/`), Sree
says yes screen by screen, then build in PRs of one surface each with the screenshot matrix (light + dark from
B15 on), tests pinning the rules of §2 the way `tests/design-tokens.test.ts` pins PR 15's.

## 6. Questions for Sree (recommended answer first)

| # | Question | Recommended |
| --- | --- | --- |
| 1 | Size: S now, M after the competitor screens, L later? | **yes** |
| 2 | Tab bar: Home · Results · Players · Me? (M's biggest change; can be pulled into S) | **yes, in S** — it is what makes the shell feel finished |
| 3 | Scorecard bar: Add round + Complete, Undo in the toast and ⋮? | yes |
| 4 | Dark mode: review it as part of S (adds a dark column to every matrix from now on)? | yes |
| 5 | Home title: "Hi Sree" or "Your games"? | "Your games" (the greeting is in the avatar) |
| 6 | The competitor screens you mentioned — send them; this document gets a §7 comparing shape by shape. | — |
| 7 | Palette (§9): **A** keep the current Clubhouse, **B** Felt & Brass, or **C** Ink & Marigold? | **B** — same family as the icon, deeper green (text 8.9:1 instead of 4.6:1), brass instead of lemon yellow; a token change that rides along with S — **answered Nov 23: B** (D65) |
| 8 | If B: dark mode stays green-black (as shown) or goes neutral black? **Nov 23, Sree: "I don't know what that dark mode thing is. Maybe I should see what it looks like first" → `mockups/dark-q8.png`, three S screens both ways. Then: "Both are fine. Just choose one. I don't care." → green-black, as #120 ships (D71).** | green-black as shown — the Sign-in band, the felt toast and the dark screens then share one tone. **Answered Nov 23 → D71** |

## 7. Competitor review (Sree, Nov 21) — and what we recommend

Sree looked at six Play Store apps: *Rummy Score Tracker*, *Rummy Score Card*, two actual Rummy games (plain Rummy,
Gin Rummy), *Rummy Score – Rummy, Poker and more*, and a multi-game scorer with "templates" (Uno, Darts, Yahtzee,
Rummy 51). His verdict: "there is literally no competition … we have a winner … there's literally nothing I can use."
Agreed on the substance — none of them has My players, seating, pool outs and re-entries, awards, results, a live link
or a log. The useful part of the exercise is the handful of small things he noticed, and his own ideas. He asked
for recommendations, industry standards and better suggestions, "don't just take everything I say". Here they are.

| # | Sree's idea | What the better apps do | Recommendation |
| --- | --- | --- | --- |
| 7.1 | **Light / dark toggle on the Home top bar** ("there's space on the top … instead of going all the way into Settings") | Material 3 and Apple HIG both put appearance under Settings and default to **following the phone**. No major app (Spotify, Robinhood, Duolingo, WhatsApp, Google apps) has a theme switch in a content screen's top bar; the top bar carries actions about *that* screen. Our app already follows the phone, and the Phone / Light / Dark choice is on **Profile** — one tap from Home, no settings page to dig into. | **Keep it on Profile, not on Home.** In the S redesign it becomes the *Appearance* row (mockup `small-profile.png`). A top-bar toggle is one more control on the one screen that must stay calm, used once and then never. If he still wants a faster route: long-press the Me tab → "Dark / Light" — zero visual cost. Picture: `competitor-mockups.png`, first two phones. |
| 7.2 | **Sounds** ("there's sounds when I'm adding stuff … see if we even need it or not") | Score-keeping happens at a table with people talking; phones are usually silent; a tick on every keypress is what the competitor does and what makes it feel like a toy. Industry practice (Material "sound" guidance, Apple HIG feedback): sound only when it carries information the eye may miss, always optional, and **haptics before sound** — the phone in the hand feels it, the table does not hear it. We already use `expo-haptics` once (the seating toast, D61). | **No key sounds. Haptics for the three moments that matter, sound off by default with a switch.** (a) *Round saved* — light tap; (b) *someone is out / last player standing* — warning buzz; (c) *awards saved / pool completed* — success double-tap. Then one **Sounds** switch under Appearance, default **off**, with three short clips for the same three moments only (card-slap, soft chime, applause under a second). No sound on keypad digits, ever. Cost: `utils/haptics.ts` already exists; sounds need `expo-av` and three assets (~60 KB). |
| 7.3 | **Winner animation** ("like a slot machine … subtle … maybe only for viewers, not for the admin") | Good instinct, and the standard form is a **toast / banner**, not a full-screen effect: slides in, lives 2 s, never blocks, respects "reduce motion". Viewers are the right audience — the admin is typing the next round. | **Yes, for viewers and for the web link.** After a round saves, non-admin phones on the scorecard and the live web page show a dark banner at the bottom: winner's initials on a yellow disc, "Player 3 wins round 4", the sub-line "Rummy · the table put in 133", and the points roll up like a counter (that is the slot-machine feel, in 600 ms). Gone after 2 s or on tap. Big moments get one more beat: a player goes **out** → the banner turns red; **last player standing** → the banner is the winner's name and the confetti burst is a single 1-second particle pass, once. The admin's phone shows nothing new — the existing green flash on the winning cell stays. Points games: "SK wins round 4 · +85". Picture: `competitor-mockups.png`, third phone. Not in S; it is the first item of M. |
| 7.4 | **The web link must show as much as the app, including pool standings** | — | **Checked.** The page in the repo has had Standings for pool games since Nov 14 (PR 13: in / out, points left, drops left, re-entries, the awarded status) and the multiplier line since Nov 15. **The live page is the Nov 12 build** (byte-compared `ezscore.mindweavetech.com/scorecard.html` against every commit of `public/scorecard.html`; it matches `427c5a0b` exactly). So Sree's pool links show the old page with no Standings — a **publishing gap, not a code gap: Q6**, open since Nov 19, unblocked by #113's fix. It needs Build Bot to republish, nothing to build. Remaining parity after that (small, for the batch): the page does not mark **who dealt** each round (the app shows DEALS / OPENS; the payload already carries `dealers`), does not list the **awards** once given (only says "Awarded"), and does not show **entries** per player. |
| 7.5 | **Strategies and practice games inside the scoring app** ("at some point") | — | Noted for later in `next-up.md`; not part of any size here. The honest version is a *Learn* tab with rules, the pool math (what "2 drops left" means), and an "if you were dealt this hand" quiz — content, not a game engine. |
| 7.6 | **"Make sure this goes out to all Indian users"** | — | Growth is outside this document; the levers that exist today are the Telugu half of #29, the Play listing (#107 in review), and the share links (every scorecard and result link is an invitation — the live page should end with "Keep score like this: get EZ Score"). Put as a row in `next-up.md`. |

What we take from the competitors, then: **nothing structural**. Two small borrowings worth having — a visible
*Watch a game* entry in Help for first-time users (one app had it), and a one-line **web / app link** on the result
page for people who do not have the app (we have the pages; we do not point to the app from them).

## 8. APK v17 notes on three screens — suggestions and mockups (Nov 21, no code)

Sree, on the same pass, asked for suggestions only on three screens; each has a mockup. They are not S or M — they are
the next batch of small fixes once he picks.

### 8.1 Round saved (pool) — "the buttons and the text are all over the place; will it scroll?"

What he saw: six red sentences, a grey sentence listing the same six names, six outlined pills right-aligned with
truncated first names ("Re-enter Player" three times — indistinguishable), then Close.

| Problem | Recommendation |
| --- | --- |
| Six sentences, six pills, same six names | **One row per player**: initials disc · name · status line · score · **Re-enter** text action on the row. Nothing is said twice. |
| Pills truncate to the first name; three "Player"s | The row has the full name (ellipsis only past ~22 characters) and the action never carries a name. |
| Dialog grows with the players; 10+ players would push Close off screen | A **bottom sheet**, not a dialog: title and the summary chips pinned, the list scrolls (max ~6 rows visible), Close and Complete pinned at the bottom. Mockup shows 7 and 12 players. |
| "May re-enter at 96: …" repeats the names | One chip: **Re-entry starts at 96**; two more chips: **6 out this round · 1 in**. |
| Pill ovals | Text actions on rows, one filled Close — the Small control rule. |
| Who wins / is it over? | When one player is left, the sub-line says so and **Complete** is offered beside Close (the code already has `lastStanding`). |

Edge case to verify on CI before building: six "is out" lines in one round is suspicious — a pool round always has a
winner on 0 who cannot go out, so at most *n − 1* can go out together. The dialog may be listing **every** out
player, not only this round's (the `before` snapshot it compares against comes from the scorecard's cache and may not
carry pool seats). If so, that is a bug for the batch, found by his screenshot. Picture: `round-saved-mockup.png`.

### 8.2 Awards — "I don't see the pool count … show the game name and how much it was played for"

| Problem | Recommendation |
| --- | --- |
| Title is "Awards · P5"; the limit (101) appears nowhere; the entry (100) is an input without context | One line under the title: **Friday night · Pool 101 · drop 25 · 7 players** (game name first when the game has one; otherwise just the pool line). The same line goes on the **Final scores sheet** header. The **PDF** already prints "Limit 101 · drop 25" and the **share picture** says "4 in · 2 out · limit 101"; the **web page** says "Pool · limit 101" — Awards is the only screen without it. |
| "AWAR D" — the column header wraps | Give the last column its width (the header is wider than its numbers): min-width for the Award column, or "Award" in the same small caps as the others with `numberOfLines={1}` and a slightly narrower Player column. |
| "6 left · 1 drops" | Plural helper: "1 drop", "2 drops" (the web page already does this). |

Picture: `awards-mockup.png`.

### 8.3 Add by initials — "one letter each … cursor moves on … one Save … show what happened … then Done"

Sree's idea, in short: one letter per box, the cursor auto-advances (first → last → next row's first), one Save for
all rows instead of a Save per row, then a summary of what happened (saved; any initials changed because of a clash,
confirmed one by one), then Done leaves; editing later allows up to three letters.

**Recommendation: take all of it, with three refinements.**

| Sree's idea | Keep / change | Why |
| --- | --- | --- |
| One letter per box | **Keep.** The last box drops from two characters to one. | It is what makes auto-advance possible: a box is "done" the moment it has a letter. Two-letter surnames (and digits) move to **Edit**, where three characters stay allowed (D14). |
| Cursor moves on by itself | **Keep**: F → L → next row F; Backspace on an empty box goes back one. | Standard OTP-field behaviour; everybody's thumbs know it. |
| One Save instead of per-row Save | **Keep**, and label it with the count: **Save 2 players** (live, counts rows with both letters). It sits **above the keyboard**, not under the rows, so it never scrolls away. Rows with one letter are the only question (D52 keeps). | One decision instead of three; the count tells him exactly what will happen. |
| After Save, "show what happened" | **Keep, in place**: the three rows turn into result rows — ✓ **SK · Saved · Sree K · new player**; ! **~~HG~~ HG2 · Harish Gadupudi already has HG · this new player is HG2**; ✓ **VR · Saved** — each with **Edit**. The seated strip under them already shows the new chips. | He sees every outcome without a dialog, and the clash row is the one that stands out. |
| Then Done | **Keep**: **Done** (filled) and **Add 3 more** (text) under the results. Done is the only exit (as today). | |
| "Allow three letters in Edit" | **Keep** (already so). Refinement: the clash row's Edit opens with the **digit form pre-selected**, so one tap types the letters he wants. | |

Three refinements that are not in his words: (1) the row shows the resolved name beside the boxes **as he types**
("Sree K · new"), so a clash is visible before Save, not only after; (2) rows grow: when the third row fills, a
fourth appears (up to the per-day cap), so "add three people quickly" becomes "add as many as are at the table";
(3) the summary rows are the same `Row` component the S redesign introduces, so this screen is built once.

Picture: `initials-mockup.png`.

### 8.3a Add by initials, revised for Q44 (Sree, Nov 25)

> "If I want to add 3 people … just use the keyboard on the bottom, so I don't have to even go up and click on Save
> … Done should take me back to the screen and show me, 'Okay, hey, these are the 3 players' … should we just have
> 2 Done buttons? What if he goes back and deletes something, or he edits something? … he needs to see clearly that
> those 3 are getting saved … one extra confirmation before you take him away."

**Recommendation: one button that changes job: Save N players, then Done. Not two Done buttons**: the same word
doing two different things is how people tap through by mistake. This is the pattern WhatsApp's *New group* uses
(pick people, then a confirm step with one Create button) and Splitwise's *Add people* (type, then the list, then
Done). Picture: [`add-players-q44.png`](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/main/rummy-home3/docs/design-review-2/mockups/add-players-q44.png).

**Revised Nov 25, 8:28 PM.** Sree: "make sure the keyboard is below the initials. If he's trying to add 8 players
at the same time, it has to automatically scroll up so he can see what he's typing" and "It doesn't know that SK is
[Sree K] … you can't show that the new player is [Sree K]. That's not possible." Both are in the picture now.

1. **Type.** The rows are on top and the keyboard is below them. One letter per box; the cursor jumps on by itself
   (F → L → next row); a new row appears when the last one fills. The keyboard's own action key reads **Save**, and a
   **Save N players** button sits just above the keyboard, so the thumb never goes to the top. The count only
   includes rows with both letters. A new player shows only the letters typed ("SK · new player"): initials carry
   no name. The only name the app can show is someone already in My players ("Harish G is already HG. This new
   player is HG2.", the existing `clashSentence`).
2. **Many players.** The list scrolls up by itself as each row fills, so the row being typed always sits just above
   the Save bar and the keyboard (8 players: rows 1–2 slide up out of view, a line says so, a swipe down shows them).
3. **See what was saved.** The keyboard goes down and the screen lists every new player with a ✓ ("SK · new
   player") or a ! when the initials changed ("HG2 · Harish G is already HG"). Each row has **Edit** and **Remove**.
   The seated players below show them in green. The only way on is **Done** (and *+ Add more* to type again).
4. **Done** goes back to Players · Admins, with no further dialog.

| Case | What happens |
| --- | --- |
| A row with one letter | It is left out of the count and stays on screen; Save saves the rest. |
| The same initials twice in one batch, or initials already in My players | Shown while typing ("Harish G is already HG. This new player is HG2."), so nothing surprises him after Save. |
| 8 or more rows, keyboard up | The list scrolls so the row with the cursor is just above the Save bar; earlier rows stay a swipe away. |
| Edit after Save | Opens that row with up to three letters (D14); saving it updates the row in place. |
| Remove after Save | Takes the player out of this game at once; the player stays in My players (a seat with no scores is free to remove). |
| ← or Android back after typing, without tapping Save | One question, only then: "SK is not saved yet": **Save SK and go back** / **Discard**. A row with one letter is left out either way. This replaces D97's "Done · keep the 1 saved" wording, since there is no Done while typing. |
| Small phone, keyboard covering the screen | The Save button rides on top of the keyboard; the rows scroll above it. |
| Double tap on Save | The button is disabled while saving. |

### 8.4 Order of players — "arrows only on the selected player" (Sree, Nov 21)

**Sree's words**: "show the arrows on all the rows initially; once a player is selected, only his arrows show — that
is the selection sign — the others' arrows are gone; deselect and all the arrows come back; clicking another player
moves the selection; the last player has no down arrow; do it in both places; update the tutorial and the help; merge
tutorial steps 2 and 3 — 'the last tap deals' is obvious; what is step 4?"

**Honest view.** Industry pattern for reordering a short list is one of two: *drag handles* (iOS Reminders, Google
Keep, Spotify queue — a ≡ grip on every row, press-and-drag) or *select, then move* (Android Settings › Apps order,
most accessibility-first UIs — tap a row, then up/down controls act on it). Drag is the prettier default but fails
the table: six to eighteen rows, a phone passed hand to hand, fingers that are not steady, and a list that is also
being *tapped* to count down cards (D56) — a drag gesture and a tap gesture on the same row fight each other.
**Select-then-move is the right pattern here, and Sree's version of it is the textbook one**: the selection *is* the
affordance. We recommend it with one refinement: when nobody is selected, show the arrows on every row **faint**
(outline grey), not full strength — Sree's "show them initially so people know" is right, but at full strength six
rows × two arrows is the clutter he reacted to in v17. On selection they turn full green on the selected row only.
Twelve arrows that all work (today) become two that do; fewer mis-taps on an 18-player list.

Rules, as we would build them (both places, one component — `OrderOfPlayers`, used by `OrderStep` in New game ›
step 3 and by `SeatingSheet` from the ⋮ menu mid-game, so it is one change):

| Rule | Behaviour |
| --- | --- |
| Nobody selected | Faint ▲ ▼ on every numbered row (top row no ▲, seat 1 no ▼). Unnumbered rows: none (unchanged). |
| Tap a numbered row | Row highlighted (today's `primaryContainer`), **its** arrows full green, every other row's arrows hidden. |
| Tap the selected row again | Deselect: faint arrows return everywhere. (Today the same tap *takes back the number* for the latest player — that stays for the latest player while numbering; once everyone is numbered, a second tap deselects.) |
| Tap another numbered row | Selection moves; arrows follow. |
| ▲ ▼ | Move one seat, selection stays on the player (so three taps move three seats). |
| Last row (seat 1, deals) | No ▼ — already true today (`arrowSlot` spacer); the top row gets the matching rule for ▲ (today it is a disabled grey chevron). |
| Out / left-the-table rows (mid-game) | Not selectable, no arrows — unchanged. |

**Tutorial**: merge steps 2 and 3 into one — *"Tap the highest card first"* / "Tap the highest card first, then the
next one down… the last tap is the lowest card and deals round 1." Three steps instead of four. **Step 4 today is
"Wrong tap? Fix it"** — "Tap the latest player again to take it back. Once everyone is numbered, the arrows move a
player one seat." It becomes step 3 and its second sentence changes to the new rule: "Once everyone is numbered, tap
a player and use ▲ ▼ to move them." Help › Order of players gets the same sentence; the on-screen one-liner
("Tap players from the highest card to the lowest") is unchanged.

Picture: `order-mockup.png` — today's CI frame (arrows on every row), proposed with nobody selected (faint arrows),
proposed with Sree selected (only his arrows, green). Generator: `make-order-mockup.py`.

Batch item (no PR yet, per the batching rule): `OrderOfPlayers.tsx` selected-state arrows, `utils/tutorials.ts`
SEATING_STEPS 4 → 3, Help copy, flows 19b–19i and 24b–24c re-pinned.

### 8.5 Order of players as a table, and "the newcomer sits left of the dealer" (Sree, Nov 21, 1:11 AM)

**Sree's words**: "It should be a circle, or at least an oval, because that's how people sit in real life … The dealing
always happens counterclockwise … When someone new comes in, they have to always sit to the left side of the person
that is dealing. Even if someone re-enters … Anytime someone new is added, you have to warn and say, 'he's going to sit
on the left side of the dealer, his seat is going to be so-and-so number, the dealer's seat is seat 5, and he's going
to sit in between these two people.' … the admin can move the players around if he wants, but implement this as a default."

**The table view — yes.** A ring of seats is how every table app draws this (poker home-game lobbies, seating-chart
tools, board-game companions), and it is the only picture in which "left of the dealer" and "the deal goes this way"
can be seen rather than read. Recommendation, shown in `table-mockup.png`:

| | Recommendation |
| --- | --- |
| Where | Above today's list, in both places (`OrderOfPlayers`, so New game step 3 and the mid-game sheet get it together). The list stays: it is where the card count-down taps happen (D56) and where names, initials and IDs are readable. The table fills as players are numbered — the first tap (highest card) appears, then the next, round the ring. |
| Geometry | Seat 1 at six o'clock, then **anticlockwise** (seat 2 to seat 1's right — a seated person's right is anticlockwise seen from above), a faint dashed arrow inside the felt showing the deal direction, the dealer's seat badge green with "deals". The centre says the state: "Round 7 · Priya deals · Venkat opens". |
| 6–8 seats | Circle, 40 dp avatars with the seat badge, first names under them. |
| 9–13 seats | Oval (the phone is taller than wide), 34 dp avatars, initials only on the ring, names in the list. 13 × 34 dp fits a 336 × 216 oval with room; the ring never shrinks below 34 dp — above 13 the oval scrolls with the page, which is the 14–18 case the scorecard already treats as "big table". |
| With the 1:03 AM idea | The same selection: tap a seat on the ring (or its row) and **only that player** shows controls — on the ring two round buttons ⟲ ⟳ beside the avatar ("move one seat either way", the ring makes ▲ ▼ meaningless), the row highlighted below. Tap again to deselect. One rule, two pictures of it. |
| Rotation | When the admin is seated, the ring turns so **they** sit at six o'clock — the table as they see it from their chair. |

**"Left of the dealer" — a direction check, and the one question.** The app stores no left or right, only the order,
and the order *is* the deal order: seat 1 deals, then seat 2, … (`nextDealer` = the seat after the last dealer). With
counterclockwise dealing the deal passes to the dealer's **right**, so the dealer's right-hand neighbour is seat + 1
and **the dealer's left-hand neighbour is seat − 1: the one who deals last before the dealer deals again.** What is
built today (D57, 052 `add_seated_player`, approved Nov 19 as "+1 from the dealer's seat number") puts a joiner at
**seat + 1 — the dealer's right — and they deal the very next round.** So the two instructions point opposite ways:

| | Nov 19 (built, D57) | Nov 21 words, taken literally |
| --- | --- | --- |
| Kiran joins while Priya (seat 3) deals round 7 | Kiran = seat 4, Priya's **right**; Venkat → 5, Sree → 6, Harish → 7 | Kiran = seat 3, Priya's **left**; Priya → 4, Venkat → 5 … |
| Kiran first deals | round 8 (next) | round 13 (after everyone else — last in the cycle) |
| Kiran first opens | round 9 | round 8 (dealt in last, plays last) |
| Who else notices | Venkat loses "deals next" to Kiran | nobody's turn moves; Kiran waits his turn |

Our recommendation is the **Nov 21 reading** — it is the real-life convention he describes (the newcomer is dealt in
last and queues for the deal; nobody at the table loses a deal or an open), and it is what the ring will *show*, so
the picture and the rule must agree. It means changing D57's "+1" to "the seat before the dealer" in `add_seated_player`
(one line of the 052 body, a migration 053 with the same shape) and the help copy. **Q13 asks Sree to confirm with
the picture: Kiran at Priya's right (deals next, built) or Priya's left (deals last, his words).**

**Answered, Nov 23** — Sree: *"New players always sit on the left side of the dealer. It could be a setting in the
future, but for now, it's always left as a default."* So the Nov 21 reading stands (**D70**): a joiner takes the seat
**before** the dealer (the dealer's left; dealt in last, deals last in the cycle, nobody else's turn moves). D57 is
**superseded**; what 052's `add_seated_player` does today (seat + 1, deals next) is **wrong against this** and must
change — one line of the body, as a migration 053 with the same shape and tests, plus the help copy and the
notice copy above. "Could be a setting in the future" is noted, not built (D50: no setting until a table asks).
Re-entry follows the same seat rule as recommended above, with Keep seat N. This is a code change, so it is a
batch item for its own PR, not part of the S redesign PR.

**Re-entry (pool).** Today a player who re-enters **keeps their seat** (`reenter_player` never touches
`player_order`); only the score and the entry count change. Sree's rule moves them to the dealer's left as well.
Recommend: yes as the default, through the same notice, with a **Keep seat N** button — the person who went out has
usually left their chair, and the dealer's left is the fairest place to be dealt back in (they play last that round).
Cost to say out loud: their scorecard column moves (columns follow seats, D56), as it already does when an admin
reorders. The Round saved sheet's `Re-enter` pill opens the notice first.

**The notice** (third screen of the mockup) is a confirm, not a toast — it is the moment the admin can disagree:
"**Kiran sits left of the dealer.** Seat 3, between Anil (2) and Priya, who is dealing (now seat 4). Priya, Venkat,
Sree and Harish each move up one seat." + the small ring with the new seat dashed-green + one grey line "Kiran is
dealt in from round 8 and deals after Anil. Scorecard columns follow the seats." Buttons **Pick a seat** (opens
Order of players with Kiran selected) · **Add Kiran**. For re-entry: "Anil re-enters at 61 and sits left of the
dealer: seat 3, between Venkat and Priya." · **Keep seat 5** · **Re-enter**. Before round 1 nobody is dealing: the
newcomer takes the last seat with no notice, as today.

Picture: `table-mockup.png`. Generator: `make-table-mockup.py`. Batch item 10; the direction is Q13.

### 8.6 Awards: the split chips (Sree, Nov 21, 1:16 AM)

**Sree's words**: "'Winner takes all' is weird, because obviously, if there's only one person left, it's 'winner takes
all' … If there are 3 players left, distribute evenly … call it 'even distribution' … 'Distribute by drops' is probably
the most important default, and that should be the first default. The second default should be 'distribute evenly.'
Those are the two options that could automatically activate. The rest are other options … 'buy points' is fine, 'buy
points left', 'custom'. We have 4 options."

**Reading it.** "Buy points" / "buy points left" are the transcriber's "by points" — today's **By points left**
preset (share in proportion to the points each player still in has left). He names five labels and counts four; the
count is right if "by points" and "by points left" are the same chip. We read it as **four**: *By drops left · Split
evenly · By points left · Custom*, and ask him to say if "by points" was a different idea (e.g. in proportion to points
*scored* — unusual, the lowest score would get the least; we recommend not).

**What goes, and what it costs.** *Winner takes all* and *50 / 50* fold into **Split evenly**: the players still in
share the pool equally — one left takes it all, two left is 50 / 50, three left is thirds (his "the 3 players get the
full prize"). The one case lost is "three still in, pay only the top two" — 50 / 50 as a *choice* with three in. That is
what Custom is for; we would not keep a chip for it.

**By drops left, first.** It is today's *Entry per drop left*: every player still in gets one entry per drop they have
left; the lowest score (the winner) gets the rest. With one player left it **is** winner takes all (the others are out,
nothing to pay), so the default works at every table size. **Why it was greyed on his screen** (D23 / F13.23): the
preset is refused when the others' drop entries would leave the winner with less than, or equal to, any of them — on
P6 the two others had enough drops left (3 × 100 each) to beat the winner's remainder. Today the chip greys and a
pop-up explains only when tapped. Recommendation: keep D23's rule, but **say why on the screen** under the chips
("By drops left is off here: Venkat's 3 drops (300) and Sree's 3 drops (300) would leave Priya, the winner, 100") and
**pick the next default automatically** — exactly his "two options that could automatically activate": *By drops left*
when viable, else *Split evenly*; the line says "Picked for you: Split evenly".

**Labels**: "By drops left" (not "Entry per drop left" — the unit is in the hint), "Split evenly" (shorter than "even
distribution", reads as a verb like the others), "By points left", "Custom". The hint line under the chips explains the
selected one in one sentence; the Gets column shows the result. Four chips fit one row on a Pixel; the fifth today
wrapped.

Picture: `awards-chips-mockup.png` (today · proposed with drops · proposed when drops is off). Generator:
`make-awards-chips-mockup.py`. Batch item 11.

### 8.7 Order of players: Done stays grey when nothing changed (Sree thought it was a bug)

Mid-game the sheet's Done is `disabled` while the order is incomplete **or unchanged** (`SeatingSheet`: `!complete ||
!changed`); nothing on the screen says which. A grey primary button with no reason reads as broken. Recommendation:
**Done is never grey once everyone is numbered** — unchanged order → Done simply closes (nothing saved, no Log row),
the standard "Done = I'm finished" meaning; and the counter line under the list carries the state: "Everyone numbered
· order unchanged" / "Everyone numbered · Sree moves 5 → 3, the next deal follows the new order". While numbering is
incomplete Done stays grey and the line already says "3 of 6 numbered". Batch item 12.

### 8.8 Scorecard columns — "10 is too much … it should show 5" (Sree, Nov 23)

> **Revised Nov 24** (D90: 5 · 7 · **Max**, not All): the spec to build is [`columns-landscape-spec.md`](columns-landscape-spec.md). This section is the Nov 23 proposal.

Sree: *"I think it can fit 10. 10 is too much … Do you think we can add a zoom button for the scorecard, right on top
of it instead of the share? Or maybe I can keep it inside the menu by pressing plus or minus … it should show 5. 5 is
the least zoom … for everybody else, you have to scroll … for some of the people that can't see properly, this might
be too small … We've also sanitized to 5 only, so are you sure 10 is good?"*

**What the code does today.** A player column is never narrower than **38 dp** (`MIN_COLUMN_WIDTH`), and the table
shrinks columns until that floor before it lets anything scroll. On a Pixel-width screen (412 − 32 margins − 42 round
column = 338 dp) that is **8.9 columns**, so 9–10 players show at once with **13-pt digits** — the CI frame
(`scorecard-20p-before.png`, 20 players) shows exactly that. The floor was picked so a 13-player table fits without
scrolling; it was never a readability choice. Now that sideways scrolling is solid (header and body in one offset,
#117), "fit everything" does not need to be the default any more. **No, 10 is not good** for the people he means.

**What the better apps do.**

| | Visible columns | How you change it | Frozen |
| --- | --- | --- | --- |
| Google Sheets, Excel, Numbers (mobile) | whatever the zoom gives | **pinch** on the grid; zoom remembered per sheet | header row + first column |
| ESPN / Cricbuzz / CricHeroes scorecards | fixed, ~4–6 stat columns | none — horizontal **scroll**, the name column never moves | name column |
| Keep Score, Score Counter, the Uno / Yahtzee scorers | one column per player, 4–6 fit | none; bigger tables scroll | header |
| Android itself | — | Settings › Display › **Font size**; apps are expected to honour it (we do, for row height) | — |

The convention for a grid is pinch; the convention for a scorecard is a **fixed, readable column count and a frozen
label column**. Nobody puts a zoom button in the top bar.

**Recommendation (in order of what we'd build).**

1. **Default 5 columns in portrait.** 338 / 5 = **67 dp** per column, which the existing size ladder already turns into
   **18-pt digits** (`cellFontSize`: ≥ 64 → 18). Players 6–20 scroll sideways; the round column stays; a thin scroll
   bar under the table says there is more. Five matches D54 ("we've sanitized to 5") and the results blocks, so the
   two tables agree. New installs start here; nothing else about the table changes.
2. **Pinch to zoom on the table**, snapping to **5 · 7 · All** (All = today's fit-to-38-dp). Snapping, not free zoom:
   a snapped table always has whole columns and the same digit size per step, so it never looks half-rendered.
3. **The same three as a row in ⋮ — "Columns 5 · 7 · All"** — for the people who will never pinch (the ones he is
   worried about). One preference, **remembered on the phone for every game**, not per game: "I like it big" is a
   property of the eyes, not the table.
4. **Share stays in the top bar.** Sharing the result is the thing people do most (D50); the bar already has Share,
   Help and ⋮. A + / − pair there is two more targets for one setting that is changed once. His "plus or minus in
   the menu" is item 3 in different clothes; the segmented row is one tap instead of several.
5. **Landscape ignores the setting and fits everyone** (915 − 32 − 48 = 835 dp → 20 players at 41 dp, 22 at the
   floor); past 22 it scrolls. Five 167-dp columns in landscape would be silly, and landscape is for seeing the whole
   table (§8.9).

**Not recommended**: a zoom *button* replacing Share; free pinch zoom without snap points; a per-game setting;
changing the 38-dp floor itself (All must still fit a 13-player table on one screen for the people who want that).

**Cost**: a `columns` preference (`PreferencesContext`, like `appearance`), `columnLayout(width, count, compact,
columns)` taking the count, a `PinchGestureHandler` around the table that maps scale to the next snap, the ⋮ row,
one help line, flow 25 re-pinned to 5 visible. A small PR; **batch item**, not part of the S redesign.
Picture: `scorecard-density.png` (the CI frame · 5 columns · the ⋮ row). Generator: `make-scorecard-density-mockup.py`.

### 8.9 Landscape is for viewing — "I can barely see 2 rows" (Sree, Nov 23)

> **Revised Nov 24** (D89: the table alone, no bar, no tags, no "View only"): the spec to build is [`columns-landscape-spec.md`](columns-landscape-spec.md). This section is the Nov 23 proposal.

Sree: *"When I do the landscape, it automatically fits the 11 players … I don't think we need the buttons on landscape.
The landscape should only be for viewing. The undo button, add round, and complete: add round is not convenient in
landscape anyway … I can barely see 2 rows … more space can be saved by pushing all those tags up, closer to the
scorecard … instead of 2 rows, maybe 1 row. Also, completely remove those buttons on the bottom in landscape."*

**Agree on all three, and it is cheaper than keeping them.** A Pixel 6 in landscape is **412 dp tall**: status 24 +
header 56 + two rows of tags 88 + table header ~50 + the 44-dp bar with its paddings ~70 leaves **~120 dp for rows =
2½ rows** at the compact 34-dp height. That is what he sees. The Add round page is a portrait page (a keypad and a
column of players); Undo and Complete are dialogs that work in any orientation, but nobody rotates to reach them.

**Proposed**: in landscape (`isShort`, phones only — tablets are not short and keep everything):

| | Today | Proposed |
| --- | --- | --- |
| Top | 56-dp header (back · title · share · help · ⋮) + two rows of tags | **one 48-dp line**: back · "Scorecard · S2" · Points · 11 players · Round 61 (· View only) · share · help · ⋮ — the tags move into the header row, smaller |
| Bottom | Undo · Add round · Complete | **nothing** — the bar is not rendered; the code stays, so it is one condition to bring back |
| Under the table | Creator · Admin · Unique game ID | **not shown** in landscape (it is in portrait and on the share) |
| Row tap | opens Edit round | **off** in landscape ("you have to come back to portrait to do everything else"); ⋮ stays, since Players, Log and Game settings are reading too and its dialogs work |
| Rows visible | 2–3 | **6–7** |
| Columns | fit all (11 at 76 dp) | fit all, as today; 20 players still fit at 41 dp; past 22 it scrolls (§8.8 item 5) |

**One honest caveat**: the Round saved toast and the "pool is over — Complete" nudge (`poolOver` makes Complete filled)
are portrait things too; in landscape the strip's Round tag is the only hint the game moved. Fine for a viewing mode.

**Not recommended**: keeping a single "Add round" FAB in landscape (it opens a portrait page; the rotation is the
annoyance, not the button); hiding ⋮ (it costs rows nothing and hiding it would strand the Log).

**Cost**: `[id].tsx` — `isShort` already exists; the bar, footer and the row `onPress` get `!isShort`, the strip gets
a one-line variant; `ScoreTable` unchanged. Flow 25 (landscape fling) re-pinned without the bar. **Batch item**, not
part of the S redesign. Picture: `scorecard-landscape.png`. Generator: `make-scorecard-density-mockup.py`.

## 9. Colour — three palettes on the S screens (Sree, Nov 21, 2:31 AM)

> **Decided Nov 23 — Sree: "Palette B."** Recorded as **D65** in `decisions.md`. Nothing is built yet; the tokens go into the first S PR once he has said yes to the screens.

Sree: "What about the new designs? That's what I'm very interested in. Are we also doing any color changes? Can we
talk about that?"

The straight answer first: **S as written changes *where* colours go, not *which* colours.** The colour contract (B03:
marigold = a game or a selection, green = the primary action and positive numbers, blue = one notice per screen, red =
destructive and negative, grey = the rest) is most of what makes the S screens look calmer — the "ovals" were as much a
colour problem as a shape problem. The palette itself (green felt, marigold, cream — the icon's colours) was going to
stay. Since he asked, here are three palettes on the **same four S screens**, light and dark, so the choice is made
from pictures, not words.

| | **A · Current · Clubhouse** | **B · Felt & Brass** (recommended) | **C · Ink & Marigold** |
| --- | --- | --- | --- |
| Buttons / links | green `#15803D` | deeper felt `#0E4D2A` | near-black `#1B1F24` |
| Selection (segments, chips, game badge) | lemon marigold `#FFE38A` | brass `#F0DFAE`, text `#3E2E07` | marigold `#FFE38A` (unchanged) |
| Paper / hairlines | cream `#F6F6F1` / `#E8E8E1` | warmer paper `#F5F2E8` / `#E6E1D3` | neutral `#F7F7F5` / `#E7E8E6` |
| Dark mode | `#0F1412`, mint buttons `#5FD68E` | green-black `#0C120E`, mint `#7FD39F`, brass `#E3BE63` | black `#0E0F11`, **white** buttons |
| Text contrast (WCAG) | green on cream **4.6 : 1** — passes AA for text, but only just; the green links ("Forgot passcode?", "Create account", text buttons) are the thinnest colour in the app | green on paper **8.9 : 1**; brass selection text 9.9 : 1; dark buttons 8.1 : 1 | 16 : 1 both modes |
| Reads as | the app today | the same room, better lit: the brass reads *selected* where the lemon read *caution* (B04) | the fintech / music shell — Robinhood, Spotify |
| Fits the icon, the listing, the share sheets (cream card stock), the Sign-in band | yes | yes — same family, nothing else to redo | no: a green icon and a green band lead into a black app; the band goes ink too (shown), and the listing screenshots, web pages and icon would have to follow — that is **L** (§5) |
| What it costs | nothing | one token change: `constants/theme.ts` + the one green in `public/scorecard.html` (and its `web/` copy); the seat colours stay | the token change **plus** a re-think of everything green |

What does **not** change in any option: the ten seat colours (teal first, never the button green), red for negatives
and destructive actions, the meaning of each colour (B03), and any words on any screen.

**Recommendation: B, together with S.** It is the only option that is both a visible improvement and free of
knock-on work: the icon, the Play listing, the share sheets and the web pages already agree with it. A is the
no-change fallback — fine, but the 4.6 : 1 green stays the weakest thing in the app. C is kept here so the choice is
informed, not because it is on the table now; if Sree likes the black shell, that is the L conversation (new icon,
new listing images), after outside feedback.

If he picks B, the order of work does not change: S screen by screen (Profile first), the palette tokens in the first
S PR, light + dark in every screenshot matrix from then on (Q4).

Pictures (`design-review-2/mockups/`): `palette-swatches.png` (the tokens side by side), then the four S screens in
the three palettes, light above and dark below — `palette-profile.png`, `palette-settings.png`, `palette-game-type.png`,
`palette-sign-in.png`. Generator: `make-palette-mockups.py` (reuses `make-small-mockups.py`; `--render` redoes the 24
phones through headless Chrome, without it only the sheets are recomposed).

## 10. Build specs for the approved S screens (Nov 23, nothing built)

### 10.1 Profile (Sree: "Yes to the Profile redesign"; D66)

Approved as drawn in `small-profile.png` (§3 in words). Not built yet — Sree: "No building yet". This section is what
the first S PR does, so it can be cut the moment he says build; it also carries the B tokens (D65).

**Screen** (`app/(tabs)/me.tsx`, top to bottom): header block — avatar (seat colour 1), name, `email · Player #N`, one
Help button in the top bar; then six groups with a small-caps heading each, hairline separators, no cards, no icon
squares, no per-row ⓘ:

| Group | Rows (label · value · tap) |
| --- | --- |
| Your table | Name · `Sree Test` · opens today's inline edit as a sheet ⟶ Initials on scorecards · `ST` ✎ · today's initials sheet ⟶ Player ID · `#1 · Share` · the share sheet |
| Notifications | Phone · `No number yet` / the number · today's phone editor as a sheet, Save inside ⟶ Email · `Game started` (the switches that are on, "Off" when none) · a sub-page with today's switches and their one-line help |
| Game defaults | Settings · `Points · −10 · −30 · −80` (the current defaults, one line) · the Settings screen |
| Appearance | Theme · `Phone \| Light \| Dark` segmented, inline (the one control that stays) |
| Help | Help & guide · "How each screen works, tricky cases" · the Help index (`me-help-index` keeps its testID) |
| Account | Change passcode ⟶ Privacy policy ⟶ Delete account (red) ⟶ Log out (red, no chevron); version line under the list |

Demo tools (admins only, today's `showDemo` block) become a seventh group **Admin** at the bottom, same rows.

**Pieces**: `ListRow` (exists; gains a `value` slot on the right and loses its icon square here), new `SettingsGroup`
(heading + rows + hairlines; takes `info` for the one-per-group ⓘ where a group needs it — none on Profile), new
`SegmentedChoice` (2–3 options, 40 dp, outlined, selected = `secondaryContainer`; replaces the Appearance pill row and,
in later S PRs, the B06 radios). **Zero `Button`s on the screen** (B01's target: 13 → 0); the only filled buttons are
inside the sheets (Save) — one per sheet.

**Tokens (D65, same PR)**: `constants/theme.ts` light `primary #0E4D2A`, `primaryContainer #D8ECDD`, `secondary
#8A6A1E`, `secondaryContainer #F0DFAE`, `onSecondaryContainer #3E2E07`, `background #F5F2E8`, `outlineVariant
#E6E1D3`; dark `background #0C120E`, `surface #141B16`, `primary #7FD39F`, `secondaryContainer #4A3A10`,
`onSecondaryContainer #F5E3B0`; `brand.feltLight` follows `primary`; the one green in `public/scorecard.html` and its
`web/` copy. Seat colours untouched. The whole app changes tint with this — that is the point of a token change — so
the matrix for this PR includes one scorecard and one Home frame in both modes to show nothing else moved.

**What does not change**: every behaviour behind the rows (name / initials / phone / e-mail saving and their errors,
delete account's confirm, log out, the help index), the Paper dialogs (A09: `me-notice` stays), the Staging label on a
staging build, the `#1` Player ID semantics (the share text is the same).

**Tests to add / move**: `tests/design-review-2-s.test.ts` — 0 `<Button` and 0 `SectionCard` in `me.tsx`; the six
group headings in order; `SegmentedChoice` used for Appearance; D65 hex values in `theme.ts`; `ListRow` has no icon
square when `value` is set. `design-tokens.test.ts`'s Profile pins move with the screen. Flow `07-profile.yaml`:
"Your initials on scorecards" → "Initials on scorecards"; the Settings tap label "Game type, Drop, Middle drop, Full
count" → "Settings"; "Edit name" → tap the Name row; 07b scrolls to "Log out" as today; one new frame 07e dark.

**Screenshot matrix for the PR**: Profile light / dark × default / large font; the Phone and Email sheets; plus one
Home and one 13-player scorecard frame in light and dark for the token change. Help copy: the Profile topic in
`constants/help.ts` re-written for rows instead of cards (one paragraph).

**Scope note**: Settings, Game type and Sign in keep today's look until their own yes; for a build or two the shell is
mixed. If Sree prefers one PR for all four once he has answered, the same spec applies per screen and the PR is one
surface larger — his call in the Next-up line.

### 10.2 Settings (Sree: "Yes to the Settings redesign"; D67)

Approved as drawn in `small-settings.png`. Today: five `SectionCard`s (four with icon squares and a ⓘ each), Paper
`SegmentedButtons` for the game type, `RulesForm` inside the cards with outlined `TextInput`s and `RadioButton` rows,
a yellow hint block under the multiplier, and a filled Save with a text Reset at the bottom.

**Screen** (`app/(screens)/settings.tsx`), top to bottom, same `SettingsGroup` as Profile:

| Group | Rows / controls |
| --- | --- |
| New game starts as | Game type · `Points \| Pool` (`SegmentedChoice`), plain grey note "You can still switch on the Game type screen." |
| Points defaults ⓘ | the `RulesForm` fields two per line — Drop · Middle drop / Full count · Multiplier — one outlined input style, the "A 30 is 30 · a Full count is 80 · ×1 unless you change it" hint moves behind the group's ⓘ (B03: hints are not yellow) |
| Pool defaults ⓘ | Pool limit · `101 \| 201 \| 251 \| Other` (`SegmentedChoice`, Other reveals the input; today's chips), grey note "100 is in, 101 is out."; Drop · Middle drop / Full count; Re-entries · `Unlimited \| Limited` (+ the count input when Limited); Re-entry score · `Highest \| Highest + 1`; Late entry score · `Highest \| Highest + 1` — the three radio pairs become segmented rows (B06) |
| More | Which setting wins · "Game settings › Settings › app defaults" · opens today's `SettingsPriority` as a sheet ⟶ Hidden & deleted · "Games you hid, games or results you deleted" · the existing screen |

**Save**: the screen keeps today's explicit Save (defaults are a form, not a toggle list) — one filled Save in a
`BottomBar`, Reset to app defaults as a text action beside it; the saved / error notice stays as the inline line
above the bar (`accessibilityLiveRegion` as today). The `settings-*` testIDs stay on the same controls so flow 07's
pool-limit and re-entry steps keep working (`settings-pool-limit-101`, `-custom`, `settings-pool-reentries-unlimited`,
`-limited`, `-count`, `settings-save`).

**Pieces**: `SettingsGroup` and `SegmentedChoice` from 10.1; `RulesForm` gains a `layout="grouped"` prop (rows with
hairlines instead of its own paddings) and renders the re-entry / late-entry choices through `SegmentedChoice` when
grouped — the Game type screen will use the same prop, so the form is written once. `SectionCard` leaves this screen
(B12: 23 → 18 uses after Profile and Settings).

**What does not change**: the rules model and validation (`draftFromRules`, limits), which setting wins (D-rules in
`SettingsPriority`), the help topic ids, the Staging label.

**Tests / flows**: `design-review-2-s.test.ts` adds: 0 `SectionCard` and 0 `SegmentedButtons` in `settings.tsx`,
`RulesForm` grouped layout has no `RadioButton`, the four group headings in order, Save is the one `contained` button.
Flow `07-profile.yaml` steps 07d / 07e / 07f keep their ids; the tap label "Game type, Drop, Middle drop, Full count"
becomes the Profile row "Settings" (same as 10.1); assertions "Points defaults" / "Pool defaults" / "Re-entry score" /
"Late entry" stay as text. Screenshot matrix: Settings light / dark × default / large font, Pool defaults with Limited
re-entries open, the Which-setting-wins sheet.

### 10.3 Game type (Sree: "Yes to the Game type redesign"; D68)

Approved as drawn in `small-game-type.png`. Today (`components/game/GameTypeStep.tsx`, step 2 of New game): a
"Game type" `SectionCard` with Paper `SegmentedButtons`, a "Pool settings" / "Points settings" card holding
`RulesForm` (bordered fields inside the card inside the screen — B05), a "Playing · n" outlined card of grey chips,
the refused-limit strip above the bar, and Back / Next in the `BottomBar`.

**Step**, top to bottom, same `SettingsGroup` as 10.1 / 10.2:

| Group | Rows / controls |
| --- | --- |
| Game type ⓘ | `Points \| Pool` (`SegmentedChoice`, ids `game-type-points` / `game-type-pool` stay) — the one-line grey note under it says what changes ("Pool: out at the limit, re-entries allowed" / "Points: every round counts, multiplier applies") instead of the two-paragraph tip, which moves behind ⓘ |
| Pool settings ⓘ *(or Points settings)* | `RulesForm layout="grouped"` exactly as in 10.2: Pool limit segmented + Other, Drop · Middle drop / Full count, Re-entries, Re-entry score, Late entry score; for Points: Drop · Middle drop / Full count · Multiplier. Hints behind ⓘ (B03, B16). The "from Settings" / "app defaults" origin line stays as the group's grey footer so the player sees where these numbers came from |
| Playing · n | one row per player, avatar initials + name, no chips and no card — the same `ListRow` as Players, read-only, tapping the header goes Back to step 1 |

**Bottom**: `BottomBar` unchanged — outlined Back, filled Next (`new-game-type-next`); the refused-limit strip keeps
its place above the bar (F3, chaos c03) and its `new-game-problem` id. The large-multiplier dialog
(`multiplier-high-confirm`) is unchanged.

**Pieces**: nothing new — `SettingsGroup`, `SegmentedChoice`, `ListRow`, `RulesForm layout="grouped"` all exist after
10.1 / 10.2. `SectionCard` leaves `GameTypeStep` (B12: 18 → 15 uses). `OrderStep` (step 3) is **not** in S — the
seating card stays until Sree asks.

**What does not change**: step order and the step counter, `draftFromRules` / `rulesFromDraft`, the limit refusal
rules and copy, the defaults priority (D-rules), the help anchors (`new-game` topic).

**Tests / flows**: `design-review-2-s.test.ts` adds: 0 `SectionCard` and 0 `SegmentedButtons` in `GameTypeStep.tsx`,
`RulesForm` used with `layout="grouped"`, the Playing group renders `ListRow` (no `styles.chip`). Flow `16-pool.yaml`
steps 16b–16d keep their ids and the "Game type" text assertion; the 16c2 re-entries tip step now taps the Pool
settings ⓘ. Screenshot matrix: Game type Points / Pool × light / dark, Pool with Limited re-entries open, the
refused-limit strip, large font.

### 10.4 Sign in (Sree: "the redesign is good, but can you pick a better image? …"; D69)

Sree, Nov 23, verbatim: *"Yeah, the redesign is good, but can you pick a better image? Can you actually pick the exact
Joker card from the Bicycle cards, the 52 cards from that company? … Don't get the poker-style cards. Get the regular
ones that are smaller in looking size. Anyway, just get the Joker card. I know I have this thing where I'm hiding the
password. … Can you keep that functionality and not remove it?"* Then, told Bicycle's Joker is the card company's
copyrighted artwork and that an original Joker in the same classic style avoids the risk: *"ok"*.

Read as: (1) the grouped-list Sign in is approved; (2) the hero is a **Joker playing card**, not the app-icon tile;
(3) **bridge-size** proportions (2¼ × 3½ — Bicycle's "regular" narrower deck, not the 2½ × 3½ poker deck); (4) the
artwork is **ours**, in the classic turn-of-the-century engraving style — jester with a three-point cap, ruff, diamond
tunic, marotte, red / yellow / blue flat fills with black line-work — no Bicycle figure, no brand; (5) the **passcode
eye stays** — the first mockup had dropped it, which is what he caught. Re-mocked in `small-sign-in.png` (before · after
light · after dark · the card at 2×) by `make-sign-in-joker-mockup.py`; the figure is `mockups/joker-figure.png`.

**Screen** (`app/(auth)/login.tsx` inside `components/ui/AuthShell.tsx`), top to bottom:

| Part | Today | S |
| --- | --- | --- |
| Felt panel | 76 dp rounded tile with `icon-small.png`, ⓘ help top-right, a faint club | **The Joker card**: 90 × 140 dp, white, 7 dp radius, 1 dp inner rule 4 dp in, tilted −6°, soft shadow; "JOKER" set upright-vertical in the top-left and bottom-right (rotated 180°) indices; the figure 118 dp tall centred. Title and subtitle unchanged below it. ⓘ stays. Landscape: the card sits in the felt column as the tile does today |
| Card | Email outlined with a mail icon, `PasscodeField` (six cells + eye), filled Sign in, Forgot passcode? text | Same controls, **one input style**: Email outlined without the leading icon, the six cells, **the eye at the right of the "6-digit passcode" label exactly as today** (`PasscodeField` is untouched), filled Sign in, Forgot passcode? as a text button |
| Below | "New here?" divider, outlined **Create account pill**, "Secure sign-in enabled" | One line: "New here? **Create account**" (text button, B01). The "Secure sign-in enabled" line goes (B17); the local-prototype warning stays when Supabase is not configured |

**Pieces**: `JokerCard` (new, `components/ui/JokerCard.tsx`): a `View` card with the border and shadow, two rotated
`Text` indices, one `Image` — the frame is drawn in RN so the edges stay crisp at every density and dark mode needs no
second asset; the figure is the only bitmap (`assets/joker-figure.png`, ≈ 400 × 720, exported from the mockup source at
1× / 2× / 3×). `AuthShell` takes `hero?: ReactNode` (default = today's tile) so Register and Forgot passcode get the
card too without touching their screens. Palette B (D65) tokens throughout.

**What does not change**: `PasscodeField` (digits hidden by default, eye toggles, PR 10b), the validation and error
copy, `AuthShell`'s keyboard avoidance and landscape split, the help topic (`sign-in`), the `login-*` testIDs.

**Card drawing notes (Sree, Nov 23: "Why is there a second line inside the Joker card from top to bottom that is
touching the letters? Even the word 'Joker' on the left side is also not clear")**: the line was a crop artefact — five
black columns from the source card's border left on the right edge of `joker-figure.png`, now trimmed (the build asset
must be re-cut from the same source, not from the first PNG); the inner frame I had drawn is gone (real card faces have
none); the indices are stacked letters in a real serif, not a shrunk vertical-text run, and the card panel is rendered
at full size instead of upscaled. Made by Claude; the jester illustration came from the image generator in Claude's
toolkit, the card, indices and screens are drawn in code.

**Not the Bicycle artwork**: the figure was drawn for EZ Score; nothing from the US Playing Card Company's decks is
copied. Keep it that way in the build — no "Bicycle" string, no rider, no their Joker.

**Tests / flows**: `design-review-2-s.test.ts` adds: `login.tsx` renders `JokerCard` and still `PasscodeField`;
`PasscodeField` still has the eye toggle (`eye-outline` / `eye-off-outline`); 0 outlined `Button`s in `login.tsx`;
"Secure sign-in enabled" is gone. Flow `01-sign-in.yaml` (or whichever flow signs in first) keeps `login-email`,
`login-passcode`, the eye tap and `login-submit`. Screenshot matrix: Sign in light / dark × portrait / landscape,
passcode revealed, the Supabase-missing line.
