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

## 7. Competitor screens

Waiting for the screens Sree mentioned. Each gets: what it does better than us, what it does worse, what we take.
