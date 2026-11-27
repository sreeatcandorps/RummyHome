# Help — redesign spec (PR 11; approved Nov 15, built Nov 18 on `cursor/pr11-help-build-0a03`)

Status: **built as written** (every recommended answer in section 8, Q11.1–Q11.23). Mockups: [`help-mockups/`](help-mockups/)
(H00–H14). What exists: `constants/helpTopics.ts` (the topics), `app/(screens)/help/[topic].tsx` and `help/index.tsx`
(page and index with search), `components/help/*` (page, rich lines, Why? link), `components/ui/InfoTip.tsx` (ⓘ mini
helps, Sree's Nov 17 addition — approved on New game · Game type Nov 18 and then applied to every screen: each section keeps
its title plus a ⓘ, the explanation lives in the pop-up, only live feedback and links stay on screen),
`scripts/help-screenshots.mjs` + `scripts/help-callouts.json` → `assets/help/*.png` (a section can carry its own
cropped picture and legend, `HelpSection.shot`: Add players › *Find in database*, D98, from smoke frame 31c). Not built: a `?` on the claim route
(it has no screen — it redirects to Create account, which has one); `players-admins`, `hidden-deleted` and `sign-in` have
no annotated screenshot yet because the smoke run takes no frame of them.

## 0. What Sree asked (Nov 14, 3:53 PM PT)

Rewrite the help ("pretty bad"). Every screen gets a help icon and its own help page. Same design elements as the app
(chips, colours, buttons, icons, yellow games / green results). Two levels: what a new user must know (especially what
is not intuitive), then the in-depth part with tricky cases and every menu item; pick and justify names for the levels
(he floated "Summary" and "Detailed help"). Professional documentation look, with images or annotated screenshots.
Deliverable: for each screen a mockup of the screen next to its help page, most important screens first (Home, New game
both screens, Scorecard, Add round, Final scores, Results, Pool awards, Settings), then the rest. Flag any screen whose
order or flow feels off. Lots of questions wherever something feels off.

## 1. What exists today

- One component, `HelpButton` (a `?` in the header), opens a **Paper dialog titled "Help"** with a flat bullet list from
  `constants/help.ts` (28 keys, ~150 bullets, 3–8 bullets each, ≤ 200 characters per line by unit test). No images, no
  headings except on Home (`## Statuses`), no links between topics, no index, no search.
- Screens **with** a `?` today: Sign in / Create account / Reset (via `AuthShell`), Home, My players tab, Me tab, New game,
  Game type (shares New game's), Scorecard, Add round (Points and Pool texts), Complete game, Awards, Players · Admins,
  Add players to this game, Add new players, Find player, Results (picker, saved result, preview — all the same text),
  Settings, Hidden & deleted, Log.
- Screens **without** help: **Final scores**, Profile edit pages (`players/[id]`, `players/[id]/edit`), the claim screen,
  the Game settings dialog, the live web page (has two lines in `publicScorecard` that nothing shows), the Fix initials
  step (has text, shown only inside that dialog).
- Why it reads badly (from the Scorecard dialog, `help-mockups/`-adjacent screenshot `02b-scorecard-help.png`): seven
  equal-weight bullets, the important one ("View only means…") first only by accident, Pool and Points mixed in one list,
  the ⋮ menu described in one 30-word sentence, no picture, no way to the next topic, and the dialog hides the screen it
  explains.

## 2. The two levels: names and why

Recommended: **"Need to know"** (top) and **"Full guide"** (below).

| Candidate | Problem |
| --- | --- |
| Summary / Detailed help (Sree's) | "Summary" promises a shortened version of the same text; the top section is *different* content — the non-obvious rules. "Detailed help" is generic and sounds like a longer dialog. |
| Quick start / Reference | "Quick start" implies a first-run tutorial (that is PR 12). "Reference" is right but cold. |
| Basics / In depth | "Basics" sounds like things the user already knows; the top section is exactly the things they do not. |
| **Need to know / Full guide** | "Need to know" says: read this, it is short, you cannot guess it. "Full guide" says: everything on this screen is here, including every menu item. Both are two words and fit a section label chip. |

Each help page shows them as labelled cards (green rule for Need to know, yellow for Full guide — see H00) so the eye finds
the same two blocks on every page.

## 3. Anatomy of every help page (H00)

1. **Header** "Help · Screen name", back arrow, **Index** link on the right.
2. **Hero** card in the screen's colour family (yellow = games, green = results, grey = people / you, blue = rules), icon,
   screen name, one line of purpose.
3. **Need to know** — 3 to 5 bullets, only what the screen cannot say: hidden rules, what a tap commits, what cannot be
   undone, who can do it. Real UI **specimens inline** — the actual `Tag`, `Button`, score-cell styles (`Active`,
   `Save round`, `-80`) — so a user maps help to the screen without reading.
4. **Annotated screenshot** (thumbnail of the real screen with numbered badges) and the numbered legend, one line each.
5. **Full guide** — sections per region of the screen, **the ⋮ menu as a table in on-screen order** (item · what it does ·
   who sees it · when it is hidden), pool and landscape differences, **Tricky cases** (the situations support questions
   come from: locks, conflicts, "why is this grey").
6. **Also see** chips to related help pages and to the two rules pages.
7. The page is a **screen** (`help/[topic]`), not a dialog: it scrolls, it can hold images, Back returns to the exact spot.
   The `?` stays in the header of every screen, same position, same icon, always.
8. **Help & guide index** (H10) from Me and from every page's Index link: grouped Playing / Results / People / You / Rules,
   with a search box over titles and bullets.
9. Two **rules pages** that are not tied to a screen: "How scoring works" (Points vs Pool, drops, Rummy, multiplier) and
   "Complete → Award → Result" (the three steps after the last round). Several screens link to them instead of repeating.
10. **Dialog links**: confirm dialogs that puzzle people ("Give awards first", "The scorecard changed", "Save awards
    anyway?") get a small "Why?" link that opens the matching Tricky-case anchor.

## 4. Screen inventory → help pages

| Screen (route) | Help today | Help page | Family | Mockup | Flow / order flag (section 6) |
| --- | --- | --- | --- | --- | --- |
| Home (`(tabs)/index`) | yes, flat | Home | green | H01 | F11.1 "Results" means two things |
| New game › Players (`games/new`) | yes | New game · Players | yellow | H02 | F11.2 Add tiles named differently from My players |
| New game › Game type | shares New game | New game · Game type | yellow | H03 | — |
| Scorecard (`games/[id]`) | yes, long | Scorecard | yellow | H04 | F11.3 two shares in one menu; F11.4 Game settings only via ⋮ |
| Add round (`score-entry`) | yes ×2 (Points, Pool) | Add round | yellow | H05 | — |
| Final scores (`games/final-scores`) | **none** | Final scores | yellow | H06 | F11.5 Complete page and Final scores overlap |
| Results picker (`results/index`) | yes, generic | Results | green | H07 | F11.1 |
| Results preview (`results/view`) | same text | Results (anchor "The preview") | green | H07 | — |
| Saved result (`results/[id]`) | same text | Results (anchor "A saved result") | green | H07 | — |
| Awards (`games/award`) | yes | Awards (Pool) | yellow | H08 | F11.6 Complete → Award → Result is three screens |
| Settings (`settings`) | yes (priority ladder) | Settings | grey | H09 | F11.7 Hidden & deleted lives under Settings |
| Me (`(tabs)/me`, `profile`) | yes | Me | grey | H11 | F11.8 Me vs Profile vs Settings naming |
| My players (`(tabs)/players`, `players/index`) | yes, 7 bullets | My players | grey | H12 | — |
| Complete game (`games/complete`) | yes | Complete game | yellow | H13 | F11.6 |
| Game log (`games/log`) | yes | Game log | yellow | H14 | — |
| Players · Admins (`games/players`) | yes | Players · Admins | grey | (build) | F11.9 row ⋮ has seven items |
| Add players to this game (`players/add`) | yes | Add players · Find player | grey | (build) | F11.2 |
| Add new players (`players/new`) | yes | same page, anchor | grey | (build) | F11.10 Done is the only exit |
| Find player in database | yes | same page, anchor | grey | (build) | — |
| Hidden & deleted | yes | Hidden & deleted | grey | (build) | F11.7 |
| Sign in / Create account / Forgot passcode | yes (AuthShell) | Sign in · Create account · Passcode | grey | (build) | — |
| Claim a player (`claim`) | **none** | Sign in … (anchor "Is this you?") | grey | (build) | — |
| Player detail / edit (`players/[id]`, `/edit`) | **none** | My players (anchor "Initials") | grey | (build) | — |
| Game settings dialog | **none** | Scorecard (anchor "Game settings") + a "Why locked?" link | yellow | (build) | F11.4 |
| Fix initials step | dialog text | New game · Players (anchor "Initials clash") | yellow | (build) | — |
| Live web page (`public/scorecard.html`) | text exists, unused | a short "About this page" fold on the web page | yellow | (build) | — |
| Rules: How scoring works | — | new | blue | (build) | — |
| Rules: Complete → Award → Result | — | new | blue | (build) | F11.6 |

"(build)" pages follow the H00 anatomy; their content is the existing bullets regrouped, plus Tricky cases. They are
listed so nothing is left without a `?`.

## 5. Mockups

| # | File | Shows |
| --- | --- | --- |
| H00 | `H00-help-page-anatomy.png` | The template every page follows |
| H01 | `H01-home.png` | Home beside its help page |
| H02 | `H02-new-game-players.png` | New game › Players |
| H03 | `H03-game-type.png` | New game › Game type (Pool shown) |
| H04 | `H04-scorecard.png` | Scorecard, menu in order, pool and landscape sections |
| H05 | `H05-add-round.png` | Add round |
| H06 | `H06-final-scores.png` | Final scores (no help today) |
| H07 | `H07-results.png` | Results picker with preview / saved-result / delete sections |
| H08 | `H08-pool-awards.png` | Awards (Pool) |
| H09 | `H09-settings.png` | Settings |
| H10 | `H10-help-index.png` | Help & guide index with search and the two rules pages |
| H11 | `H11-me.png` | Me |
| H12 | `H12-my-players.png` | My players |
| H13 | `H13-complete-game.png` | Complete game |
| H14 | `H14-game-log.png` | Game log |

The screenshots are the CI smoke artifacts of PR 13's branch (Nov 14), so the help text is written against the current
screens. Callout positions are indicative.

## 6. Flow and order flags (things that felt off while writing the help)

- **F11.1 "Results" means two things.** The Home button is both the list of saved results and the place a new result is
  made (chips + ticks + Show results). The help has to explain the double meaning in its first bullet. Suggestion: Home
  button "Results"; inside, two tabs or a clear split "Make a result" / "Past results" (the second already exists as a
  section). Question Q11.9.
- **F11.2 Three names for adding people.** New game: "Add new players" / "From database"; My players: "Add new players" /
  "Find player in database"; mid-game: "Add players to this game" with the same two tiles. Same action, three labels.
  Suggestion: "Add by initials" and "Find in database" everywhere. Q11.10.
- **F11.3 Two shares in the scorecard ⋮.** "Share live scorecard" and "Share final scores" sit next to each other but one is
  a link and one is a picture; Final scores has two more share buttons. Suggestion: one "Share…" item opening a small
  sheet (Live link · Final scores picture · Full details PDF). Q11.11.
- **F11.4 Game settings reachable only via ⋮**, and only until round 1; the lock message appears after the tap. Suggestion:
  show the lock state on the menu item itself ("Game settings · locked"). Q11.12.
- **F11.5 Complete page and Final scores overlap.** Both show totals and a Share final scores button; Final scores adds
  Round by round and the PDF. New users do not know which to open. Suggestion: Complete's done-state shows a small card
  preview and one button "Final scores & share"; the share buttons live only on Final scores. Q11.13.
- **F11.6 Complete → Award → Result is three screens on a pool**, two on a Points game. The spec (PR 13) says the tutorial
  explains it; the help gets a rules page for it. Suggestion kept from PR 13 (no screen change) — but the Awards screen
  should end with "Add to Results" as its primary button so the chain is visible. Q11.14.
- **F11.7 Hidden & deleted lives under Settings** (and under Past results › Deleted for results). It is about games and
  results, not settings. Suggestion: move the entry to Home › Recent ("Hidden & deleted" footer link) and keep the
  Settings entry. Q11.15.
- **F11.8 Me / Profile / User settings.** The tab is "Me", the header says "Me", the stack route is `profile`, the settings
  page is "User settings" and the Game type screen says "Settings". Suggestion: "Me" (tab) and "Settings" (page), drop
  "User". Q11.16.
- **F11.9 Players · Admins row ⋮ has up to seven items** (Invite, Link, Edit initials, Edit name, Make/Remove admin,
  Remove). The help lists them in order; a longer-term fix is a player sheet with the actions as buttons. Q11.17.
- **F11.10 Add new players: Done is the only exit**, no back gesture. Intentional (rows save on their own) but surprising;
  the help says so. Q11.18.

## 7. Writing rules for help text (so every page sounds the same)

- One idea per bullet; ≤ 2 sentences; plain words; numbers as digits; the app's own labels in **bold** exactly as shown.
- Say who ("admins", "the creator", "everyone") and when ("until the first round", "once in a saved result").
- Never money words (awards, results, winners only); "Points" and "Pool" capitalised; "live link", not "public link".
- Tricky cases are written as the user's question: "Why is this grey?" → answer.
- Every page ends with Also see. No page repeats another page's rules — it links.
- Unit test keeps: every `help/` topic has a hero line, 3–5 Need-to-know bullets, ≥ 1 Tricky case; every ⋮ item named in a
  help table exists as a `Menu.Item` title in the code (and the other way round); no forbidden words.

## 8. Questions for Sree (recommended answer first)

- **Q11.1 Level names.** "Need to know" / "Full guide" (recommended, section 2) — or your "Summary" / "Detailed help".
- **Q11.2 Page, not dialog.** Help as a full screen with Back (recommended) vs keeping the dialog with two tabs. A dialog
  cannot carry screenshots or links and hides the screen.
- **Q11.3 Screenshots in the app.** (a) Real annotated screenshots bundled as assets (~25 PNGs, ~2 MB, go stale with every
  redesign; a CI job can regenerate them from the smoke run — recommended), (b) drawn schematic thumbnails (never stale,
  less recognisable), (c) no pictures, specimens only.
- **Q11.4 Index and search.** Index from Me and from every help page (recommended); search over titles and bullets (cheap,
  recommended); no server, all local.
- **Q11.5 Rules pages.** Two screen-independent pages (recommended): "How scoring works", "Complete → Award → Result".
  They are also where the tutorial (PR 12) can deep-link.
- **Q11.6 "Why?" links in dialogs.** Yes for the five dialogs people ask about (recommended): Give awards first · The
  scorecard changed · Save awards anyway · Settings locked · Closed game counted again. No for routine confirms.
- **Q11.7 Help language.** English only now; strings kept in one file so Telugu / Hindi can follow. Confirm no second
  language is needed for go-live.
- **Q11.8 Depth of "Full guide".** Every menu item and every state (recommended; that is Sree's ask) — accepting pages of
  1.5–2 screens. Alternative: menu items only, tricky cases in a separate FAQ page.
- **Q11.9 (F11.1) Results naming.** Keep one screen, add a clear split "Make a result" / "Past results" with the help
  explaining both (recommended, no flow change) — or two Home buttons.
- **Q11.10 (F11.2) One pair of labels** for adding people everywhere: "Add by initials" / "Find in database" — **built in Design audit 15b (A21)**
  (recommended; a PR 15 consistency item, not this PR).
- **Q11.11 (F11.3) One Share… item** with a three-line sheet (recommended; PR 15) vs two items as today — **built in Design audit 15b (A04): the header share icon opens the sheet**.
- **Q11.12 (F11.4) "Game settings · locked"** on the menu item once rounds exist (recommended; small, could ride with PR 11).
- **Q11.13 (F11.5) Complete done-state** shows the card preview and a single "Final scores & share" button; share buttons
  only on Final scores (recommended; PR 15). Keep as is if you like the shortcut. **Superseded Nov 18:** the Complete
  page is deleted; Complete is one dialog on the scorecard and goes straight to the Final screen (Share + Done).
- **Q11.14 (F11.6) Awards primary button "Add to Results"** after save (recommended; tiny change to PR 13's screen).
  **Reversed Nov 18 (Sree):** no Results button anywhere in the end flow; Awards ends with Not now / Save awards and
  goes on to the Final screen. Results is its own errand from Home.
- **Q11.15 (F11.7) Hidden & deleted** also reachable from Home › Recent footer (recommended) — or leave under Settings.
- **Q11.16 (F11.8) "Me" + "Settings"**, drop "User settings" (recommended; copy-only).
- **Q11.17 (F11.9) Players · Admins** keep the ⋮ (help lists it in order) now; player sheet later (recommended).
- **Q11.18 (F11.10) Add new players** gain a Back arrow that behaves like Done (recommended; tiny).
- **Q11.19 Order of the index** Playing → Results → People → You → Rules (recommended; mirrors Home top to bottom).
- **Q11.20 Who writes the final words.** The agent drafts every page from this spec; Sree edits in the PR (recommended) —
  or Sree sends notes per screen first.
- **Q11.21 Sequence.** Build PR 11 after PR 14's wording is decided (multiplier bullets land once) but do not wait for PR
  14's build; the Pool pages are written from PR 13 as merged. Recommended: PR 11 build right after Sree's answers here.
- **Q11.22 Keep the `?` for view-only players?** Yes (recommended) — they are the ones who most need "what am I looking at".
- **Q11.23 Dark mode.** Help pages follow the app theme (recommended); screenshots are light-theme only (note in the page).

## 9. Build sketch (not for this PR)

- `constants/help/` one file per topic: `{ title, family, purpose, needToKnow[], callouts[], sections[], menu[], tricky[], alsoSee[] }`;
  `app/(screens)/help/[topic].tsx` renders the anatomy; `HelpButton` navigates instead of opening a dialog (same `?`).
- `assets/help/*.png` annotated screenshots produced by `scripts/help-screenshots.mjs` from the smoke artifact (badge
  positions in a JSON next to the topic).
- Help index + search (`help/index.tsx`), two rules pages, "Why?" links from five dialogs.
- Live web page: "About this page" fold.
- Unit tests (section 7); smoke: open help from Home, Scorecard, Add round, Results, Awards and screenshot; nightly: every
  screen's `?` opens its page (one flow, ~25 taps).

## 10. Tests (codes for `docs/testing-strategy.md`, PR 11 block)

| # | Kind | What it proves |
| --- | --- | --- |
| HL11-1 | U | Every route in `app/` has a help topic; every topic has hero, 3–5 Need to know, ≥ 1 Tricky case, Also see |
| HL11-2 | U | Every ⋮ item in a help menu table is a `Menu.Item` title in the code, and every `Menu.Item` title appears in some help table |
| HL11-3 | U | No money / stake / prize words; labels in bold match on-screen strings (`pointsGameLabel`, button titles) |
| HL11-4 | U | Index lists every topic once; search matches titles and bullets; family colours come from the theme tokens |
| HL11-5 | S | `?` on Home, Scorecard, Add round, Results, Awards opens the page (title, Need to know, Full guide, Index) — screenshots |
| HL11-6 | N | One flow taps `?` on every screen (≈ 25) and asserts the title; dark theme pass |
| HL11-7 | M | Read-through of every page on the emulator against this spec |
