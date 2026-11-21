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
