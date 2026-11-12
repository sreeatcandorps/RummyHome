# 01 · Visual audit of EZ Score: Rummy (as of 11 Nov 2026)

Scope: every screen under `rummy-home3/app` and the shared components under `rummy-home3/components`, read from the code and captured running on Expo web (local prototype mode, seeded data) at 390 × 844 @2x in light and dark mode. Captures are in [`mockups/current/`](mockups/current/) (re-captured in round 2 at `414b570`; file names are numbered by flow, see the README).

This audit is descriptive. The recommendations live in [02-design-system.md](02-design-system.md) and the work breakdown in [03-implementation-plan.md](03-implementation-plan.md).

## 1. Summary

The app is built on React Native Paper (Material 3) with a custom "felt green and card-stock cream" theme in `constants/theme.ts`. Structure, flows and accessibility labelling are in good shape. The things that make it read as "cheap or dated" are almost all surface-level and consistent across screens:

| # | Finding | Where it shows |
|---|---|---|
| 1 | **Everything is beige.** Background `#F6F2E9`, cards `#FFFDF8`, sunken fills `#ECE6D9`, table header `#EFE9DC`, hairlines `#E4DED1`. Low-saturation cream on cream flattens hierarchy and looks like an older Material theme. | Every screen |
| 2 | **No brand typeface.** Paper's default (system sans / Roboto fallback) at MD3 default sizes, then weights 800/900 bolted on in 56 + 2 places. Headings look heavy, body looks generic. | Every screen |
| 3 | **Body text is small for the audience.** The most used text style is `bodyMedium` (14 px, 63 uses), then `bodySmall` (12 px, 35 uses). Chips are 12 px / 11 px. Table meta is 8–10 px. | Lists, chips, scorecard, results grid |
| 4 | **Four different "primary" button shapes.** Paper pill (New game, Sign in, Show results), 16 px rounded rect with border (scorecard bottom bar `StackedAction`), 16 px tiles (`ActionTile`), 78 px tall pill (Save round), 16 px rounded yellow (Results). Heights 40, 44, 48, 52, 56, 76, 78. | Home, Scorecard, Add round, Players, Profile |
| 5 | **Two accent colours fight.** Felt green `#1F5C46` is primary, but the brightest thing on most screens is the yellow `secondaryContainer` `#FFE2A0` (Results button, Add round, Find player, Share, User settings row, selected chips). Yellow currently means "secondary action", "selected", "pending", "warning" and "results". | Home, Scorecard, Players, Profile, Results |
| 6 | **Same label, different colour on different screens.** Registration and role chips use three different tone maps (see §6). Seat colours are positional, so the same person changes colour between New game, Scorecard and Players/Admins. | Players, New game, Players/Admins, Scorecard |
| 7 | **Dark mode is a manual switch, not the phone setting.** `app.json` sets `userInterfaceStyle: "light"`; `PreferencesContext` reads a stored boolean; the toggle lives on Profile. Sree asked for follow-the-phone. | Profile, `app/_layout.tsx` |
| 8 | **Contrast is already mostly fine.** Text pairs are AA or AAA in both modes (tables in §7). The exceptions are structural: card borders at 1.4:1 (intentionally faint), seat colours used as text in dark mode (2.2–3.5:1), and 8–10 px labels that pass on contrast but fail on size. | Scorecard header, results grid, dark mode |
| 9 | **Two icon families.** Tab bar uses Ionicons (`home`, `people`); everything else uses Material Community Icons through Paper. Stroke weights and optical sizes differ. | Tab bar vs. all other screens |
| 10 | **Mixed corner radii.** `radius` tokens exist (6/8/12/16/24/999) but 17 literals (`1, 2, 5, 6, 8, 9, 10, 12, 14, 16`) are used directly, and Paper's own `roundness: 4` governs inputs, dialogs and chips. | Dialogs, inputs, chips, result cards |

## 2. Screen-by-screen

Each row records what the screen shows and the visual issues found. "Shows" is the information displayed, so the redesign keeps it.

### 2.1 Auth

| Screen | File | Shows | Colours | Buttons | Type | Issues |
|---|---|---|---|---|---|---|
| Login | `app/(auth)/login.tsx` + `components/ui/AuthShell.tsx` | Felt band with app icon, title, subtitle; card with Email, 6-cell passcode, Sign in, Forgot passcode; "New here?" divider; Create account; mode footer | Band `felt #17402F`, cream text, card `surface`, 2 px outlined inputs, giant faded club suit at 5% | Sign in: Paper contained pill, 48 h; Create account: outlined pill; Forgot: text | `headlineMedium` 28/800 title, `bodyMedium` 14 subtitle, passcode glyph 28/800, footer 12 | Strongest screen visually. Felt band is the only place the brand green is saturated. Footer text 12 px. Icon badge corners (16) differ from card (24). |
| Register | `app/(auth)/register.tsx` | Same shell; name, email, player ID, passcode | as above | as above | as above | Same as Login. |
| Forgot passcode | `app/(auth)/forgot-password.tsx` | Same shell with lock icon; email, OTP, new passcode | as above | as above | OTP field 26/800 letter-spaced | Fine. |

### 2.2 Tabs

| Screen | File | Shows | Colours | Buttons | Type | Issues |
|---|---|---|---|---|---|---|
| Home | `app/(tabs)/index.tsx` | Brand header (icon, "EZ Score: Rummy", version); "Hi {first name}"; New game; Results; Live card (count, hint, game rows); Recent card (count, hint, game rows); claim/notice cards | Background cream; New game `primary`; Results `secondaryContainer` yellow; card icons on `primaryContainer`; G-number badge on `stake.container` blue `#DCE8F7` | New game: contained pill 52 h; Results: contained yellow, radius 16, 56 h, 17/800 label; Retry/OK: text | Header 22/700 + 11 version; "Hi" `headlineSmall` 24/700; card titles `titleMedium` 16/700; hints 12; game title 16/700; meta 12 | Two full-width buttons of different shape and colour stacked at top compete; the yellow one wins over the green one. Version string in the header is dev noise. Section cards nest a bordered card inside a bordered card (double frame). Chevron, "Points", "5 players" meta at 12 px. |
| My players | `app/(tabs)/players.tsx` | Search; sort chips (Frequent / Alphabetical); Unregistered filter chip; 2-column player grid in a bordered box (name with bold initials, Player ID pill, You, status chip); three action tiles; Invite | Grid box border `outlineVariant`; cards `surface`; Player ID outlined pill `outline`; sort selected `secondaryContainer`; filter selected `tertiaryContainer`; tiles primary / yellow / outlined | `ActionTile` ×3, 76 h, radius 16, icon 24 over 2-line 12 px label | Card name `titleSmall` 14; chip text 12; `small` tags 11 | Three tiles with three different fills (dark green, yellow, white) dilute the one primary action. 11 px status chips are the smallest text on any tab. Grid inside a bordered box inside the page is another double frame. Searchbar is Paper default (pill, grey) and does not match outlined inputs elsewhere. |
| Profile | `app/(tabs)/me.tsx` | Identity card (avatar 56, name, email, Player ID badge, Share / Edit name); Change passcode; Dark mode switch; Phone card; Settings card with yellow row; Demo data (admins); Log out | Player ID badge 2 px `primary` border; Settings row `secondaryContainer`; Log out `error` red filled | Share: contained-tonal yellow; Edit: outlined; Change passcode: outlined full-width; Log out: contained red full-width, 44 h | Name `headlineSmall` 24; badge 16/800 + 11 helper; rows `titleMedium` | Log out (red, filled, full width) is the loudest element on the screen. Five different container treatments on one page (bordered card, outlined button, bordered row, section card, yellow inner row). Dark mode switch should move out once the phone setting is followed. |

### 2.3 Game

| Screen | File | Shows | Colours | Buttons | Type | Issues |
|---|---|---|---|---|---|---|
| New game | `app/(screens)/games/new.tsx` | "Playing N" with big count circle and hint; search + sort toggles; candidate rows (avatar, bold-initial name, You / Player ID / status tags, +); selected strip; Add players / From database; Start game | Rows `surface` with 1.5 px border; tags neutral/positive/leader/info; tool buttons `contained-tonal` yellow; Start `primary` (disabled grey) | Add players, From database: tonal 48 h; Start game: contained pill | Count 30/900; row name `bodyLarge` 16; tags 11 | Yellow tool buttons again sit above the primary Start button. Seat avatar colour here is by list position, so Meera is blue here and purple on the scorecard. Status tag colours differ from Players/Admins (§6). |
| Scorecard | `app/(screens)/games/[id].tsx` + `components/game/ScoreTable.tsx` | Header "Scorecard" + help + ⋮ menu; Points tag; Round/dealer tag; View only tag; score table (RND column with dealer initials, player columns with initials + total + seat bar / crown / DEALS, per-round cells with win pill / loss red / big-loss red pill, latest row tinted); bottom bar Undo / Add round / Complete | Header `tableHeader #EFE9DC`; dealer column header `primary` filled; stripes `tableStripe`; latest `tableLatest`; win pill `positiveContainer`; big loss `errorContainer`; seat colours as header text | Undo: outlined 56 h radius 16; Add round: yellow tonal, 1.7× width, 15/800; Complete: filled `primary`, 1.1× | Header 20/700; column label 13–15/800; totals 13–16/800; cells 13–16; "DEALS" 8 px; round meta 9 px; "RND" 10 px | The everyday action (Add round) is yellow and the rare, destructive-ish action (Complete) is the only green filled button, which inverts the hierarchy Sree asked for. 8–10 px labels. Seat-coloured header text fails contrast in dark mode (2.2–3.5:1). Table fills 100% of the remaining height even with 6 rounds, leaving a big empty bordered box. Round tag and Points tag are the same chip style as status chips elsewhere, so they read as statuses. |
| Add round (score entry) | `app/(screens)/score-entry.tsx` + `ScoreCell`, `ScoreKeypad` | Custom header: G-badge (felt), "Round N", started date, scorer avatar, ⋮; 2-col player cells (name, score, ×); action row (+, −, Drop, Middle drop, Full count, Rummy); digit pad; Save score key; Balance pill; Save round | Cells `cellNeutral` beige → `secondaryContainer` yellow (selected) → `positiveContainer` green (confirmed); Rummy `tertiaryContainer` blue; Balance `positiveContainer` / `errorContainer`; Save score `primary` when enabled | Digits 70 h radius 12 with 1 px border; Save score 108 w; Save round 78 h pill 24/800 | Cell name 17/700; cell value 26/800; digits 33/700; presets 22/800; Balance 30/800 | The best-designed screen for the audience: big targets, big numbers. Issues are cosmetic: beige empty cells look disabled; yellow "selected" and yellow "sign toggle on" reuse the colour that means "secondary button" elsewhere; four border colours in the action row; Save round at 78 px is taller than any other primary. |
| Complete game | `app/(screens)/games/complete.tsx` | "Complete G14"; Active tag + date; "Final scores so far"; explanation; standings list (avatar, name, signed total); rounds check line; Game admins card; Not yet / Complete game | Standings on `surface`; totals `positive` / `negative` | Not yet: outlined pill; Complete game: contained pill | Heading `headlineSmall` 24; totals `titleMedium` 16/800 | Consistent and calm. Only note: the same standings list is styled differently from `Standings.tsx` (unused here) and from Results totals. |
| Final scores / share | `app/(screens)/games/final-scores.tsx` + `components/share/*` | Share image preview + actions | Hard-coded brand colours (`#17402F`, `#FBF1E1`, `#E3B341`, `#8C2F2F`, `#0E7A43`, …) because the image must not follow dark mode | — | Fixed sizes | Out of scope for theming (image export), but the share card should pick up the new palette so shared images match the app. |
| Players/Admins | `app/(screens)/games/players.tsx` | Sections Playing / Admins not playing / Watching; rows (seat avatar, name, Player ID, role, registration tags, reorder arrows, ⋮); explanatory text; Add admin + hint; Back to scorecard / Add new players | Tags: role `positive` for Creator/Admin, registration `info` for Registered, `results` yellow for Pending, neutral for Unregistered | Add admin: outlined; Back: outlined; Add new players: contained | Name `bodyLarge` 16/600; tags 11 | Three tags per row at 11 px. Tone map differs from My players (Registered is blue here, green there). Two outlined buttons + one contained in the same view. |

### 2.4 Results

| Screen | File | Shows | Colours | Buttons | Type | Issues |
|---|---|---|---|---|---|---|
| Results picker | `app/(screens)/results/index.tsx` | Heading; filter chips Completed / Closed / Active; "N game selected"; game rows with checkbox; Show results; Past results card (winner avatar + crown, date, Results tag, counts, 1st/2nd/3rd rows) | Selected chip `primary` filled; selected row `primaryContainer` with `primary` border; Past result card has a 5 px `secondary` yellow left border | Show results: contained pill | Heading `titleMedium` 16; place rows `bodyLarge` | Fine. Filter chips are Paper default (radius 8 → forced to full). Yellow left border is a third meaning for yellow. |
| Results (view / saved) | `app/(screens)/results/view.tsx`, `[id].tsx`, `components/results/*` | Header Save / Share / Help icons; yellow warning rows; grey save box with Save result; "Results" + date; Totals (two columns, name + initials/ID + signed points); score grid (felt header, G columns, Total); Top 3 | Warnings `secondaryContainer`; save box `surfaceVariant`; grid header hard-coded `brand.felt` + `brand.cream` (does not change in dark mode); positive totals `primary` green, negative `error` | Save result: contained pill inside grey box | Title `headlineMedium` 28/800; totals `bodyLarge` 16; grid 13 px; grid sub-labels 8 px | The "winner moment" does not exist: Top 3 is a plain text list at the bottom. Grid header 8 px times. Two "Results" headings on one screen (nav title + page title). Save box is a grey slab. |

### 2.5 Settings and players management

| Screen | File | Shows | Issues |
|---|---|---|---|
| User settings | `app/(screens)/settings.tsx` | Rules form (Drop / Middle drop / Full count), priority explainer, Save, Use Rummy defaults | Fine. Priority bars use `primary`, `secondary`, `outline`: colour alone carries rank (numbers are also shown, so acceptable). |
| Add new players by initials | `app/(screens)/players/add.tsx` | Numbered rows of First / Last inputs, Saved state, Done | Input text 18/700; Done 18/800. Consistent with Add round sizing, which is good. |
| Find player in database | `app/(screens)/players/new.tsx` | Search, candidate rows | Uses `PlayerPickerRow`; same positional avatar colour issue. |
| Player detail / edit | `app/(screens)/players/[id].tsx`, `[id]/edit.tsx` | Legacy screens | Mostly unreachable from the current navigation; low priority. |
| Dialogs (Game settings, Register players, Edit round, Undo, Reopen, errors) | various | Paper `Dialog` | Paper default radius 28 (MD3) vs the app's 24 on `styles.dialog` where overridden; some dialogs override, some do not. |

## 3. Colour inventory

### 3.1 Theme tokens (`constants/theme.ts`)

| Role | Light | Dark | Used for |
|---|---|---|---|
| background | `#F6F2E9` | `#0E1512` | Page background |
| surface | `#FFFDF8` | `#151D19` | Cards, table, bottom bar, tab bar |
| surfaceVariant | `#ECE6D9` | `#26302B` | Neutral tags, skeleton rows, save box, empty-state icon, search |
| onSurface | `#1B1F1C` | `#E2E6E2` | Text |
| onSurfaceVariant | `#4A524D` | `#BEC8C1` | Secondary text, icons, chevrons |
| outline | `#79807B` | `#89938C` | Outlined buttons, inputs, Player ID pill |
| outlineVariant | `#DCD5C7` | `#34403A` | Card borders, dividers |
| primary / onPrimary | `#1F5C46` / `#FFFFFF` | `#8FD5B0` / `#00391F` | Contained buttons, dealer column, tab active, links |
| primaryContainer / on | `#CDEBD9` / `#002113` | `#1D4E3A` / `#CDEBD9` | Section icons, Creator tag, Completed tag, selected rows, new-player chips |
| secondary / onSecondary | `#8A6100` / `#FFFFFF` | `#F2C45A` / `#402D00` | Crown on past results, warning icons, selected-cell ring |
| secondaryContainer / on | `#FFE2A0` / `#2B1E00` | `#5C4300` / `#FFE2A0` | Results button, Add round, tonal buttons, selected cells, Results tag, warnings, Pending tag, sort chips |
| tertiary / onTertiary | `#3A6472` / `#FFFFFF` | `#A2CDDC` / `#033541` | Rummy key border |
| tertiaryContainer / on | `#C6E8F4` / `#001F28` | `#214C59` / `#C6E8F4` | Info tag (Admin, Registered on Players/Admins, Unregistered on My players), Rummy key, filter chip |
| error / onError | `#B3261E` / `#FFFFFF` | `#F2B8B5` / `#601410` | Loss text, Log out, badges, error text |
| errorContainer / on | `#F9DEDC` / `#410E0B` | `#8C1D18` / `#F9DEDC` | Big-loss pill, unbalanced round, Balance pill, danger tag |
| positive | `#1E7A4C` | `#7FD8A6` | Win totals, saved ticks |
| positiveContainer / on | `#D5F0E0` / `#00391F` | `#164430` / `#C8F2D9` | Win pill, confirmed cell, Active tag, Registered tag (My players), preset flash, balanced pill |
| negative | `#B3261E` | `#F2A29C` | Loss scores |
| leader / leaderContainer / on | `#8A6100` / `#FFE7AE` / `#2B1E00` | `#F2C45A` / `#4D3900` / `#FFE7AE` | Crown, leader row, Pending tag (My players) |
| felt / onFelt / onFeltMuted | `#17402F` / `#FBF1E1` / 72% | `#123326` / `#FBF1E1` / 70% | Auth band, G-badge on Add round |
| cellNeutral | `#F3EEE3` | `#1B2420` | Empty score cell |
| tableHeader / tableStripe / tableLatest | `#EFE9DC` / `#FAF7F0` / `#EAF5EE` | `#1F2924` / `#18211D` / `#1A3327` | Scorecard |
| hairline | `#E4DED1` | `#2A3530` | Table grid lines |
| gameTypes.stake | `#DCE8F7` / `#0D2F55` / `#2563A8` | `#1E3550` / `#CFE2FA` / `#7FB0EA` | G-number badge, Points tag |
| gameTypes.pool | `#FBE6C8` / `#4A2D00` / `#B9770E` | `#4A3410` / `#FBE3BF` / `#E9B25A` | Pool tag |
| brand | felt `#17402F`, feltLight `#225A43`, cream `#FBF1E1`, gold `#E3B341` | same | Splash, icon, share images, results grid header |
| Seat colours (10) | `#2E7D5B #C2410C #2563EB #B4237A #7C3AED #0E7490 #A16207 #BE123C #4D7C0F #475569` | same in both modes | Avatars, scorecard column headers, seat bars |
| Paper MD3 defaults still in use | everything not overridden (e.g. `inverseSurface`, `scrim`, `elevation.level*`) | | Snackbar, menus, dialogs |

115 hex values live in the theme file; 7 app roles (`positive`, `negative`, `leader`, `felt`, `cellNeutral`, `table*`, `hairline`) are custom additions on top of MD3.

### 3.2 Hard-coded colours outside the theme

| File | Values | Why |
|---|---|---|
| `components/share/FinalScoresView.tsx`, `ScorecardImageView.tsx`, `ShareCardView.tsx`, `utils/resultsDetails.ts`, `utils/shareImage.ts` | `#17402F #14382A #FBF1E1 #E3B341 #8C2F2F #0E7A43 #6B6455 #7A6E5B #5A4A10 #EADFC2 #5C6560 #FFF8E6 #FBE7E6 #F7F1E6 #F4F1EA #F3EBDD #F2C14E #F2B8B5 #E7E0D4 #E3F4E8 #B7E4C7 #2E2300 #FBF8F2 #D7CBB8 #B3261E #8A6A1F #1B1F1C` and 5 `rgba(251,241,225,…)` | Share images render light-only and must not follow dark mode. Reasonable, but they duplicate the palette by hand (27 values) and will drift when the theme changes. |
| `components/results/GameScoreGrid.tsx` | `brand.felt`, `brand.cream` | Grid header stays felt green in dark mode (looks fine, but it is the only in-app element that ignores the theme). |
| `components/ui/SeatAvatar.tsx` | `#FFFFFF` initials | Fine. |
| `app/_layout.tsx` (error boundary) | `brand.cream`, `brand.felt`, `#1B1F1C` | Runs before the theme exists. Fine. |
| `components/ui/AuthShell.tsx` | `rgba(251,241,225,0.05)` suit | Decorative. |

## 4. Button inventory

| Style | Component / props | Height | Radius | Fill / text | Used on |
|---|---|---|---|---|---|
| Primary pill | Paper `Button mode="contained"` | 40 default; 48 (EmptyState), 52 (New game), 44 (Profile) | Paper full pill (20) | `primary` / `onPrimary` | New game, Sign in, Show results, Save result, Complete game, Start game, Add new players, dialog confirms, Log out (`buttonColor=error`) |
| Yellow block | `Button mode="contained"` + `buttonColor=secondaryContainer` | 56 | 16 | `secondaryContainer` / `onSecondaryContainer`, 17/800 | Home → Results (only place) |
| Tonal pill | `Button mode="contained-tonal"` | 40–48 | pill | `secondaryContainer` | Share (Profile), Add players / From database (New game), Look up, Go to Results |
| Outlined pill | `Button mode="outlined"` | 40–48 | pill | 1 px `outline`, `primary` text | Create account, Edit name, Change passcode, Not yet, Back to scorecard, Add admin, Cancel, Decline, Clear |
| Text | `Button mode="text"` | 40 | — | `primary` text | Forgot passcode, Retry, Show more, OK, Cancel, Use Rummy defaults, Invite, Turn off link (red), Remove from My players (red) |
| Stacked action | `components/ui/StackedAction.tsx` | 56 (44 landscape) | 16 | outlined / `tonal` yellow / `filled` primary; icon over 13–15/700–800 label | Scorecard bottom bar (Undo / Add round / Complete) |
| Action tile | `components/ui/ActionTile.tsx` | 76 min | 16 | `primary` / `tonal` yellow / `outlined`; icon 24 over 12/700 label; red count badge | My players (3 tiles) |
| Save round | `Button mode="contained"` with `contentStyle` | 78 | pill | `primary`, 24/800 | Add round |
| Keypad digit | `ScoreKeypad` | 70 (56 compact) | 12 | `surface` + 1 px `outlineVariant`, 33/700 | Add round |
| Save score key | `ScoreKeypad` | 144 | 12 | `primary` when enabled, else `surfaceVariant` | Add round |
| Preset / sign / Rummy keys | `score-entry.tsx` action row | 72 | 12 | `surface` (preset), `secondaryContainer` (sign on), `tertiaryContainer` (Rummy); borders `outlineVariant` / `secondary` / `tertiary` | Add round |
| Score cell | `ScoreCell` | ~80 | 16 | beige → yellow → green, 2 px ring | Add round |
| Filter / sort chips | Paper `Chip` | 32 | forced full | selected `primary` (Results) or `secondaryContainer` (sort) or `tertiaryContainer` (filter) | Results picker, My players |
| Icon buttons | Paper `IconButton` 22 | 40 | — | `onSurface` | Help, ⋮, Save/Share in header, clear ×, reorder arrows |
| Round chips (Edit round dialog) | `Button compact outlined / contained-tonal` | 40 | pill | | Scorecard |

Thirteen distinct button treatments; three of them (yellow block, tonal pill, yellow stacked/tile) share the yellow fill but not shape or size.

## 5. Typography inventory

Paper MD3 variants used (with their default sizes):

| Variant | Size / line | Uses | Where |
|---|---|---|---|
| headlineMedium | 28 / 36 | 2 | Auth title, Results title |
| headlineSmall | 24 / 32 | 5 | "Hi name", Profile name, Final scores heading, StatTile value |
| titleLarge | 22 / 28 | 4 | Brand title, New game "Playing", Add round "Round N" |
| titleMedium | 16 / 24 | 23 | Section titles, game date, Totals, Top 3 |
| titleSmall | 14 / 20 | 17 | Player cards, past results date, passcode label |
| bodyLarge | 16 / 24 | 18 | List rows, place rows, standings names |
| **bodyMedium** | **14 / 20** | **63** | Default body copy, dialogs, hints, empty states |
| bodySmall | 12 / 16 | 35 | Supporting text, meta, footers |
| labelLarge | 14 / 20 | 14 | Stacked action labels, settings rows |
| labelMedium | 12 / 16 | 13 | Tags, Balance label, tile labels |
| labelSmall | 11 / 16 | 14 | Small tags, Player ID pills, version |

Explicit `fontSize` literals (outside Paper variants): `1` (hidden input), `8` (×2: "DEALS", grid times), `9` (round meta), `10` (×2: "RND", share), `11` (×5), `12` (×6), `13` (×11), `14` (×2), `15` (×5), `16` (×7), `17` (×2), `18` (×7), `20` (×4), `22` (×7), `24` (×2), `26` (×2), `28`, `30` (×2), `33`, `34`, `36`.

Weights: `800` ×56, `700` ×50, `600` ×13, `900` ×2, `500` ×2, `400` ×1. Three heavy weights are used interchangeably for the same job (card titles are 700, brand title 800, "Playing" count 900).

Observations for the audience:

- Below 14 px: 36 occurrences (8–13 px). The smallest meaningful text is 8 px.
- Default body copy is 14 px; large readable type for older players implies 16 px body and 14 px minimum for meta.
- Tabular numerals are applied consistently where scores appear (`tabularNums`), which is good.
- No custom font is loaded (`expo-font` plugin is configured but unused for text).

## 6. Cross-screen inconsistencies

| Element | Screen A | Screen B | Screen C |
|---|---|---|---|
| **Registration chip** | My players: Registered = green `positive`, Pending = yellow `leader`, Unregistered = blue `info` | Players/Admins: Registered = blue `info`, Pending = yellow `results`, Unregistered = grey `neutral` | Register players dialog: both = grey `neutral` with icon |
| **Role chip** | Home / Results cards: Creator = green `primary`, Admin = blue `info`, Player / View only = grey | Players/Admins: Creator and Admin = green `positive`, others grey | Scorecard: View only = grey |
| **Player ID** | My players: outlined pill "Player ID 7" (11 px) | Players/Admins: grey tag "#7" | New game / Find: grey tag "Player ID 7"; Results: text "SK · #7"; Profile: 2 px green-bordered box "Player ID 7" |
| **Seat colour** | Scorecard: by seat order (Sree green, Anita orange, Ravi blue, Meera magenta, Vijay purple) | New game list: by list order (Meera blue, Ravi magenta) | Players/Admins: by section index (restarts for each section) |
| **Status chip for a game** | Home: Active green, Completed green-primary, Closed grey — consistent via `GAME_STATUS_TONE` | Scorecard: Round/dealer chip uses the same `primary` tone as "Completed" | |
| **Yellow means** | Secondary action (Results, Add round, Share, tool buttons) | Selected (score cell, sort chip, sign toggle) | Pending / warning / Results tag / past-result border |
| **Primary action per screen** | Home: two (New game + Results) | Scorecard: Complete is filled, Add round is yellow | My players: three tiles, one filled |
| **Header title size** | Tabs: 22/700 | Stack screens: 20/700 | Add round: custom header, `titleLarge` 22/800 |
| **Card border** | `SectionCard`, `GameListItem`, `StatTile`, `AuthShell`: `hairline × 2` (≈1.3 px) | My players grid / card, Profile identity: `1` | `PlayerPickerRow`: `1.5`; `ScoreCell`: `2`; `SelectedPlayersStrip` chip: `1.5` |
| **Dialog radius** | Scorecard / Add round / Results dialogs: 24 | Register players, Help, Game settings: Paper default 28 | |
| **Icon set** | Tab bar: Ionicons `home`, `people` | Everywhere else: Material Community Icons | |
| **Avatar for "me"** | Tab bar: 44 px `primary` chip | Add round header: 34 px `primary` | Profile: 56 px `primary`; Scorecard / Players: seat colour |
| **Empty / loading** | `LoadingRows` skeletons (Home, Players, Results) | `ActivityIndicator` (Scorecard, Add round, Players/Admins) | |

## 7. Contrast check of the current palette

Computed with the WCAG 2.x formula (script in [`mocks/contrast.js`](mocks/contrast.js)).

### Light

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text | `#1B1F1C` on `#FFFDF8` | 16.40:1 | AAA |
| Secondary text | `#4A524D` on `#FFFDF8` | 7.93:1 | AAA |
| Primary button label | `#FFFFFF` on `#1F5C46` | 7.84:1 | AAA |
| Primary as text/icon on surface | `#1F5C46` on `#FFFDF8` | 7.72:1 | AAA |
| Tonal (primaryContainer) label | `#002113` on `#CDEBD9` | 13.43:1 | AAA |
| Yellow chip / Results button label | `#2B1E00` on `#FFE2A0` | 12.91:1 | AAA |
| Info chip label | `#001F28` on `#C6E8F4` | 13.25:1 | AAA |
| Danger chip label | `#410E0B` on `#F9DEDC` | 12.77:1 | AAA |
| Win score on surface | `#1E7A4C` on `#FFFDF8` | 5.24:1 | AA |
| Loss score on surface | `#B3261E` on `#FFFDF8` | 6.43:1 | AA |
| Win score in green pill | `#00391F` on `#D5F0E0` | 10.82:1 | AAA |
| Loss score in red pill | `#B3261E` on `#F9DEDC` | 5.14:1 | AA |
| Leader chip label | `#2B1E00` on `#FFE7AE` | 13.42:1 | AAA |
| Outline (border) vs surface | `#79807B` on `#FFFDF8` | 3.98:1 | AA (non-text) |
| OutlineVariant (card border) vs surface | `#DCD5C7` on `#FFFDF8` | 1.44:1 | fail (decorative) |
| Points chip label | `#0D2F55` on `#DCE8F7` | 10.89:1 | AAA |
| Pool chip label | `#4A2D00` on `#FBE6C8` | 10.35:1 | AAA |
| Brand band text | `#FBF1E1` on `#17402F` | 10.37:1 | AAA |

### Dark

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text | `#E2E6E2` on `#151D19` | 13.63:1 | AAA |
| Secondary text | `#BEC8C1` on `#151D19` | 10.00:1 | AAA |
| Primary button label | `#00391F` on `#8FD5B0` | 7.67:1 | AAA |
| Primary as text/icon on surface | `#8FD5B0` on `#151D19` | 10.08:1 | AAA |
| Tonal (primaryContainer) label | `#CDEBD9` on `#1D4E3A` | 7.48:1 | AAA |
| Yellow chip / Results button label | `#FFE2A0` on `#5C4300` | 7.37:1 | AAA |
| Info chip label | `#C6E8F4` on `#214C59` | 7.25:1 | AAA |
| Danger chip label | `#F9DEDC` on `#8C1D18` | 7.17:1 | AAA |
| Win score on surface | `#7FD8A6` on `#151D19` | 10.05:1 | AAA |
| Loss score on surface | `#F2A29C` on `#151D19` | 8.53:1 | AAA |
| Win score in green pill | `#C8F2D9` on `#164430` | 9.01:1 | AAA |
| Loss score in red pill | `#F2A29C` on `#8C1D18` | 4.52:1 | AA |
| Leader chip label | `#FFE7AE` on `#4D3900` | 9.10:1 | AAA |
| Outline (border) vs surface | `#89938C` on `#151D19` | 5.42:1 | AA |
| OutlineVariant (card border) vs surface | `#34403A` on `#151D19` | 1.59:1 | fail (decorative) |
| Points chip label | `#CFE2FA` on `#1E3550` | 9.47:1 | AAA |
| Pool chip label | `#FBE3BF` on `#4A3410` | 9.41:1 | AAA |
| Brand band text | `#FBF1E1` on `#123326` | 12.29:1 | AAA |

### Seat colours (used as avatar fill and as header text)

| Seat | Hex | White initials on it | As text on light surface | As text on dark surface |
|---|---|---|---|---|
| 1 | `#2E7D5B` | 5.00:1 AA | 4.92:1 AA | 3.44:1 large only |
| 2 | `#C2410C` | 5.18:1 AA | 5.09:1 AA | 3.32:1 large only |
| 3 | `#2563EB` | 5.17:1 AA | 5.08:1 AA | 3.33:1 large only |
| 4 | `#B4237A` | 6.07:1 AA | 5.97:1 AA | 2.83:1 fail |
| 5 | `#7C3AED` | 5.70:1 AA | 5.61:1 AA | 3.02:1 large only |
| 6 | `#0E7490` | 5.36:1 AA | 5.27:1 AA | 3.21:1 large only |
| 7 | `#A16207` | 4.92:1 AA | 4.84:1 AA | 3.49:1 large only |
| 8 | `#BE123C` | 6.29:1 AA | 6.18:1 AA | 2.73:1 fail |
| 9 | `#4D7C0F` | 4.99:1 AA | 4.91:1 AA | 3.44:1 large only |
| 10 | `#475569` | 7.58:1 AAA | 7.45:1 AAA | 2.27:1 fail |

Conclusion: the text palette is already AA/AAA. The real accessibility debts are **type size** (8–13 px in tables and chips), **seat colours as text in dark mode**, and **meaning carried by colour alone** in a few places (yellow "selected" cells, green/red totals with no sign in some share images, seat bars). Every status chip already pairs colour with an icon and a word, which is the right pattern to keep.

## 8. Spacing, radius, elevation, icons

- Spacing scale `2/4/8/12/16/24/32` is used consistently; a handful of literals (`3, 6, 7, 10`) appear in chips and keys.
- Radius: tokens `6/8/12/16/24/999`; Paper `roundness: 4` makes inputs and dialogs rounder than the tokens (MD3 multiplies roundness ×7 for dialogs = 28, ×5 for buttons = 20).
- Elevation: almost everything is flat with a border; `AuthShell` card and Paper menus/dialogs add shadow. No tonal elevation system is used, so dark mode cards are distinguished from the background only by a 1.5:1 border.
- Icons: Material Community Icons at 13 (tags), 14, 18, 20, 22, 24, 32, 34 px; Ionicons 24 in the tab bar. Help uses `help-circle-outline`; overflow uses `dots-vertical` as a `Button` on the scorecard and an `IconButton` on Add round (different hit areas and padding).
- Animation: subtle and purposeful (cell fill, preset flash, chip pop-in). Keep.

## 9. What is already good and should be kept

- One `Screen` wrapper, one `SectionCard`, one `Tag`, one `SeatAvatar`, one `BottomBar`: the component layer exists, so a token change propagates.
- Accessibility labels, roles and live regions on nearly everything.
- 48 dp targets on primary controls; keypad and score cells are generous.
- Status chips combine icon + word + colour.
- Tabular numerals for all scores; signed `+40` / `-10` everywhere.
- Landscape and tablet handling (`useLayout`, `MAX_CONTENT_WIDTH`).
