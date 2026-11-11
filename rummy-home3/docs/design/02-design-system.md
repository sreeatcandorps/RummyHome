# 02 · Proposed design system: "Clubhouse"

A visual-only system for EZ Score: Rummy. It keeps every current layout and flow, replaces the tokens underneath them, and tightens the handful of components that drift. Direction: **game-night, Duolingo-friendly**: bold rounded shapes, one saturated brand green, one warm marigold accent, white cards on a near-white page, large friendly type, and subtle delight (a single confetti moment for the winner).

The two alternative palettes are in [04-palette-alternatives.md](04-palette-alternatives.md). Everything in this document except the hue values applies to all three.

## 1. Principles (from Sree's interview, 11 Nov 2026)

1. **Keep the screens.** Same information, same order, same navigation. Only colour, type, shape and spacing change.
2. **One obvious primary per screen.** Exactly one filled green button per screen; everything else is tonal, outlined or text.
3. **Large by default.** Body text 16 px, nothing below 13 px, scores 20 px+, targets 48 dp+.
4. **High contrast.** AA for all text, AAA for scores and body copy. Verified below.
5. **Never colour alone.** Every status carries a word and an icon; wins and losses carry a sign; the leader carries a crown.
6. **Subtle fun.** Confetti once when a result is shown. Press feedback on buttons. No sound, no looping motion.
7. **Light and dark from the phone.** `useColorScheme()` drives the theme; the manual toggle goes away.

## 2. Colour

### 2.1 Light tokens

| Token | Hex | Role |
|---|---|---|
| `background` | `#F6F6F1` | Page. Near-white with a touch of warmth, no beige cast. |
| `surface` | `#FFFFFF` | Cards, table, bars, inputs. |
| `surfaceSunken` | `#EEEEE7` | Search field, keypad well, empty score cells, skeletons. |
| `onSurface` | `#17201B` | Text. |
| `onSurfaceVariant` | `#4E5752` | Secondary text, icons. |
| `outline` | `#8A918C` | Outlined buttons, input borders. |
| `outlineVariant` | `#DCDDD5` | Card borders (decorative). |
| `hairline` | `#E8E8E1` | Table grid lines. |
| `primary` | `#15803D` | Brand green ("Table"). Filled primary button, tab active, links, dealer column. |
| `primaryEdge` | `#0E5A2A` | 4 px bottom edge of the filled button (the Duolingo "press" look). |
| `onPrimary` | `#FFFFFF` | |
| `primaryContainer` / `onPrimaryContainer` | `#D6F5DF` / `#0B3B1F` | Tonal button, section icons, Active / Completed chips, selected rows, win pills. |
| `secondary` | `#8A5A00` | Marigold as text/icon (crown, warning icon). |
| `secondaryContainer` / `onSecondaryContainer` | `#FFE38A` / `#3F2D00` | **Accent only:** Results entry point, leader, Pending, Pool, warnings. Not for buttons that are not Results. |
| `secondaryEdge` | `#E0B33A` | Bottom edge of the Results button. |
| `tertiary` | `#2B5FBF` | Info blue as text/icon. |
| `tertiaryContainer` / `onTertiaryContainer` | `#DCE8FF` / `#0F2B63` | Info chips (Admin, Registered), Points game tint, Rummy key. |
| `error` / `onError` | `#B4231B` / `#FFFFFF` | Destructive button, error text. |
| `errorContainer` / `onErrorContainer` | `#FFE1DD` / `#5C0F0A` | Loss pills, unbalanced round, danger chips. |
| `win` | `#0C6331` | Positive score text on surface (AAA). |
| `winContainer` / `onWinContainer` | `#D6F5DF` / `#0B3B1F` | Positive score pill. |
| `loss` | `#A8201A` | Negative score text on surface (AAA). |
| `lossContainer` / `onLossContainer` | `#FFE1DD` / `#5C0F0A` | Big-loss pill. |
| `leader` | `#9A6700` | Crown icon. |
| `leaderContainer` / `onLeaderContainer` | `#FFF0BF` / `#3F2D00` | Leader row / chip. |
| `felt` / `onFelt` | `#15803D` / `#FFFFFF` | Auth band, G-badge. Same as primary now: one green. |
| `focus` | `#2B5FBF` | 3 px focus ring (keyboard / web). |
| `gameTypes.stake` | container `#DCE8FF`, on `#0F2B63` | Points: blue tint (G-badge, chip). |
| `gameTypes.pool` | container `#FFE38A`, on `#3F2D00` | Pool: marigold tint. |
| `tableHeader` / `tableStripe` / `tableLatest` | `#F1F1EA` / `#F9F9F5` / `#EAF7EE` | Scorecard. |
| `cellNeutral` | `#F3F3ED` | Empty Add-round cell. |
| `backdrop` | `rgba(23,32,27,0.45)` | Dialog scrim. |

### 2.2 Dark tokens

| Token | Hex |
|---|---|
| `background` | `#0F1412` |
| `surface` | `#181E1B` |
| `surfaceSunken` | `#111614` |
| `onSurface` | `#EAEDE9` |
| `onSurfaceVariant` | `#BAC2BC` |
| `outline` | `#8A938D` |
| `outlineVariant` | `#343C38` |
| `hairline` | `#2A312D` |
| `primary` / `primaryEdge` / `onPrimary` | `#5FD68E` / `#2E9E5C` / `#04301A` |
| `primaryContainer` / `onPrimaryContainer` | `#1A4A2E` / `#CFF4DB` |
| `secondary` | `#FFD45E` |
| `secondaryContainer` / `onSecondaryContainer` / `secondaryEdge` | `#5C4300` / `#FFE8AE` / `#3F2D00` |
| `tertiary` | `#9DBCFF` |
| `tertiaryContainer` / `onTertiaryContainer` | `#22406E` / `#DCE8FF` |
| `error` / `onError` | `#FF978E` / `#4A0B07` |
| `errorContainer` / `onErrorContainer` | `#7A1F1A` / `#FFDAD6` |
| `win` / `winContainer` / `onWinContainer` | `#73DF9D` / `#1A4A2E` / `#CFF4DB` |
| `loss` / `lossContainer` / `onLossContainer` | `#FFA19A` / `#7A1F1A` / `#FFDAD6` |
| `leader` / `leaderContainer` / `onLeaderContainer` | `#FFD45E` / `#4D3900` / `#FFE8AE` |
| `felt` / `onFelt` | `#123B25` / `#EAEDE9` |
| `focus` | `#9DBCFF` |
| `gameTypes.stake` | container `#22406E`, on `#DCE8FF` |
| `gameTypes.pool` | container `#5C4300`, on `#FFE8AE` |
| `tableHeader` / `tableStripe` / `tableLatest` | `#1F2622` / `#1B211E` / `#1B3326` |
| `cellNeutral` | `#1C2320` |
| `backdrop` | `rgba(0,0,0,0.6)` |

Dark surfaces use a two-step lift instead of borders alone: `background` → `surface` (+2.5% L) → `surfaceVariant` (+5%). Cards still get the `outlineVariant` border so the structure survives on low-quality OLED panels.

### 2.3 Contrast (light)

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text | `#17201B` on `#FFFFFF` | 16.68:1 | AAA |
| Body text on background | `#17201B` on `#F6F6F1` | 15.39:1 | AAA |
| Secondary text | `#4E5752` on `#FFFFFF` | 7.48:1 | AAA |
| Primary button label | `#FFFFFF` on `#15803D` | 5.02:1 | AA (labels are 18 px bold, so AAA-large) |
| Primary as text/icon on surface | `#15803D` on `#FFFFFF` | 5.02:1 | AA |
| Tonal (primaryContainer) label | `#0B3B1F` on `#D6F5DF` | 10.84:1 | AAA |
| Marigold chip / button label | `#3F2D00` on `#FFE38A` | 10.47:1 | AAA |
| Info / Pool chip label | `#0F2B63` on `#DCE8FF` | 11.02:1 | AAA |
| Danger chip label | `#5C0F0A` on `#FFE1DD` | 11.17:1 | AAA |
| Error / loss text on surface | `#B4231B` on `#FFFFFF` | 6.57:1 | AA |
| Win score on surface | `#0C6331` on `#FFFFFF` | 7.38:1 | AAA |
| Loss score on surface | `#A8201A` on `#FFFFFF` | 7.28:1 | AAA |
| Win score in win pill | `#0B3B1F` on `#D6F5DF` | 10.84:1 | AAA |
| Loss score in loss pill | `#5C0F0A` on `#FFE1DD` | 11.17:1 | AAA |
| Leader chip label | `#3F2D00` on `#FFF0BF` | 11.64:1 | AAA |
| Outline (border) vs surface | `#8A918C` on `#FFFFFF` | 3.23:1 | AA (non-text) |
| OutlineVariant (card border) vs surface | `#DCDDD5` on `#FFFFFF` | 1.37:1 | decorative |
| Points chip label | `#0F2B63` on `#DCE8FF` | 11.02:1 | AAA |
| Pool chip label | `#3F2D00` on `#FFE38A` | 10.47:1 | AAA |
| Brand band text | `#FFFFFF` on `#15803D` | 5.02:1 | AA |

### 2.4 Contrast (dark)

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text | `#EAEDE9` on `#181E1B` | 14.34:1 | AAA |
| Body text on background | `#EAEDE9` on `#0F1412` | 15.75:1 | AAA |
| Secondary text | `#BAC2BC` on `#181E1B` | 9.30:1 | AAA |
| Primary button label | `#04301A` on `#5FD68E` | 7.97:1 | AAA |
| Primary as text/icon on surface | `#5FD68E` on `#181E1B` | 9.27:1 | AAA |
| Tonal (primaryContainer) label | `#CFF4DB` on `#1A4A2E` | 8.54:1 | AAA |
| Marigold chip / button label | `#FFE8AE` on `#5C4300` | 7.71:1 | AAA |
| Info / Pool chip label | `#DCE8FF` on `#22406E` | 8.40:1 | AAA |
| Danger chip label | `#FFDAD6` on `#7A1F1A` | 7.97:1 | AAA |
| Error / loss text on surface | `#FF978E` on `#181E1B` | 8.12:1 | AAA |
| Win score on surface | `#73DF9D` on `#181E1B` | 10.30:1 | AAA |
| Loss score on surface | `#FFA19A` on `#181E1B` | 8.72:1 | AAA |
| Win score in win pill | `#CFF4DB` on `#1A4A2E` | 8.54:1 | AAA |
| Loss score in loss pill | `#FFDAD6` on `#7A1F1A` | 7.97:1 | AAA |
| Leader chip label | `#FFE8AE` on `#4D3900` | 9.16:1 | AAA |
| Outline (border) vs surface | `#8A938D` on `#181E1B` | 5.35:1 | AA |
| OutlineVariant (card border) vs surface | `#343C38` on `#181E1B` | 1.49:1 | decorative |
| Points chip label | `#DCE8FF` on `#22406E` | 8.40:1 | AAA |
| Pool chip label | `#FFE8AE` on `#5C4300` | 7.71:1 | AAA |
| Brand band text | `#EAEDE9` on `#123B25` | 10.60:1 | AAA |

### 2.5 Seat colours

Two rules fix the audit findings: (a) a seat colour is a **fill with white initials** or a **bar**; in dark mode any seat colour used as *text* switches to its dark variant; (b) the colour follows the **seat order within a game** on every screen of that game (scorecard, Add round, Players/Admins, Complete), and the **roster order** on list screens. Same list, same index, same colour.

Avatar fills (both modes) and light-mode text:

| Seat | Hex | White initials on it | As text on light surface |
|---|---|---|---|
| 1 | `#15803D` | 5.02:1 AA | 5.02:1 AA |
| 2 | `#C2410C` | 5.18:1 AA | 5.18:1 AA |
| 3 | `#1D4ED8` | 6.70:1 AA | 6.70:1 AA |
| 4 | `#A21CAF` | 6.32:1 AA | 6.32:1 AA |
| 5 | `#6D28D9` | 7.10:1 AAA | 7.10:1 AAA |
| 6 | `#0E7490` | 5.36:1 AA | 5.36:1 AA |
| 7 | `#92400E` | 7.09:1 AAA | 7.09:1 AAA |
| 8 | `#BE123C` | 6.29:1 AA | 6.29:1 AA |
| 9 | `#3F6212` | 7.08:1 AAA | 7.08:1 AAA |
| 10 | `#475569` | 7.58:1 AAA | 7.58:1 AAA |

Dark-mode text variants (scorecard column labels, legends):

| Seat | Hex | As text on dark surface | Dark initials `#04301A` on it |
|---|---|---|---|
| 1 | `#4ADE80` | 9.72:1 AAA | 8.35:1 AAA |
| 2 | `#FB923C` | 7.48:1 AAA | 6.43:1 AA |
| 3 | `#7DB4FF` | 7.94:1 AAA | 6.82:1 AA |
| 4 | `#F0ABFC` | 9.62:1 AAA | 8.27:1 AAA |
| 5 | `#C4B5FD` | 9.17:1 AAA | 7.88:1 AAA |
| 6 | `#22D3EE` | 9.37:1 AAA | 8.05:1 AAA |
| 7 | `#FBBF24` | 10.14:1 AAA | 8.72:1 AAA |
| 8 | `#FDA4AF` | 8.95:1 AAA | 7.70:1 AAA |
| 9 | `#BEF264` | 12.96:1 AAA | 11.14:1 AAA |
| 10 | `#CBD5E1` | 11.40:1 AAA | 9.80:1 AAA |

### 2.6 What each colour means (and nothing else)

| Colour | Means | Does not mean |
|---|---|---|
| Green `primary` | The one thing to do next; Active; a win | Selected, secondary |
| Marigold `secondaryContainer` | Results, leader, Pending, Pool, a caution note | A generic secondary button |
| Blue `tertiaryContainer` | Information: Admin, Registered, Points, Rummy | Selection |
| Red `error` | Loss, destructive, invalid | Emphasis |
| Grey `surfaceSunken` / neutral chip | Inactive, Closed, Unregistered, View only, Player | |
| Selection (cells, chips, rows) | `primaryContainer` fill + 2 px `primary` ring + check icon | Yellow |

## 3. Typography

Typeface: **Nunito** (SIL OFL, bundled via `@expo-google-fonts/nunito` or `assets/fonts`). Rounded terminals give the Duolingo warmth without being childish, and it has true tabular figures. Weights used: 400, 600, 700, 800 (no 900).

| Style | Size / line | Weight | Replaces | Use |
|---|---|---|---|---|
| `display` | 40 / 44 | 800 | — | Winner's score on Results, Balance in landscape |
| `headline` | 28 / 34 | 800 | headlineMedium | Page titles ("Hi Sree", "Results", auth title) |
| `title` | 22 / 28 | 800 | titleLarge, headlineSmall | Section headers, screen header |
| `subtitle` | 18 / 24 | 700 | titleMedium | Card titles, game date on list rows, dialog titles |
| `body` | **16 / 24** | 400 / 600 | bodyLarge, **bodyMedium** | Default body, list rows, dialog copy, hints |
| `label` | 14 / 20 | 700 | labelLarge, bodySmall, titleSmall | Buttons (secondary), chips, meta, tab labels |
| `caption` | 13 / 18 | 600 | labelMedium, labelSmall | Only where space forces it: table dealer initials, "RND", grid times. **Nothing below 13.** |
| `score-xl` | 32 / 36 | 800 tabular | — | Add round cell value, Balance |
| `score-lg` | 24 / 28 | 800 tabular | — | Results totals, Complete standings, keypad digits (32) |
| `score` | 18 / 22 | 800 (win) / 700 (loss) tabular | 13–16 | Scorecard cells and column totals (min 15 when > 8 columns) |
| `button` | 18 / 24 | 800 | 14–24 | All primary and secondary button labels |

Scale is a 1.25 ratio from 13 with the two score sizes snapped to even numbers. Dynamic type: respect the OS font scale up to 1.3× on text, cap score styles at 1.15× so tables keep fitting; above that the scorecard already scrolls sideways.

## 4. Spacing, radius, elevation

Spacing (unchanged): `2 / 4 / 8 / 12 / 16 / 24 / 32`. Page gutter 16, card padding 16, list row vertical padding 12, chip gap 8.

Radius (collapse to four + pill):

| Token | px | Use |
|---|---|---|
| `r-sm` | 8 | Chips' inner elements, Player ID pill, table pills, keys' inner highlight |
| `r-md` | 12 | Inputs, keypad keys, preset keys, small tiles, dialogs' inner cards |
| `r-lg` | 16 | Cards, list rows, score cells, action tiles, bottom-bar buttons |
| `r-xl` | 24 | Dialogs, auth card, bottom sheet, auth band corners |
| `pill` | 999 | Buttons, chips, avatars, filter chips |

Set Paper `roundness: 3` so MD3-derived shapes (inputs 12, buttons 15→pill override, dialogs 21→24 override) land near the tokens without per-dialog overrides.

Elevation: flat cards with a 1.5 px `outlineVariant` border on both modes; a soft shadow (`0 2 8 rgba(0,0,0,0.06)`) only on the auth card, dialogs, menus and the sticky bottom bar. Filled buttons get a **4 px solid bottom edge** (`primaryEdge` / `secondaryEdge`) instead of a shadow; on press the button translates down 2 px and the edge shrinks to 2 px. This is the one Duolingo signature worth borrowing: it reads as tactile at any size and costs no animation budget.

## 5. Components

### 5.1 Buttons

All buttons: 18 px / 800 label, 52 px tall (48 min), pill, icon 22 px leading when present, 16 px horizontal padding, minimum width 96. Three-up bottom bars (scorecard) drop to 16 px labels so all three fit on a 360 dp screen without wrapping.

| Variant | Rest | Pressed | Disabled | Focus | Where |
|---|---|---|---|---|---|
| **Primary** | `primary` fill, `onPrimary` text, 4 px `primaryEdge` bottom edge | translate 2 px down, edge 2 px, fill `primaryHover` | `surfaceSunken` fill, `onSurfaceVariant` 60% text, no edge | 3 px `focus` ring outside | New game, Sign in, Save round, Show results, Save result, Complete game (bottom bar), Start game, Add new players (Players/Admins), dialog confirm |
| **Secondary (tonal)** | `primaryContainer` fill, `onPrimaryContainer` text, no edge | fill darkens 6% | `surfaceSunken` | ring | Add round*, Share, Edit name, From database, Add players, Look up, Go to Results |
| **Outlined** | transparent, 2 px `outline` border, `primary` text | fill `primaryContainer` 40% | border `outlineVariant`, text 38% | ring | Undo, Not yet, Back to scorecard, Cancel, Create account, Change passcode, Add admin |
| **Destructive** | transparent, 2 px `error` border, `error` text (default); filled `error` only inside a confirm dialog | fill `errorContainer` | | ring | Log out, Remove, Turn off link, Unlink |
| **Text** | `primary` text, 48 px hit area | fill `primaryContainer` 40% | 38% | ring | Forgot passcode, Retry, Show more, OK |
| **Results (accent)** | `secondaryContainer` fill, `onSecondaryContainer` text, 4 px `secondaryEdge` edge, podium icon | same press as primary | | ring | Home → Results only. The only marigold button in the app. |

\*Scorecard bottom bar: **Add round becomes Primary** (filled green, widest), Complete becomes Secondary tonal, Undo stays Outlined. This matches "the everyday tap is the primary".

Stacked (icon over label) buttons keep the same fills as above at 56 px with 14 px / 700 labels; they exist only in bottom bars and the My players action row. `ActionTile` and `StackedAction` collapse into one `TileButton` with `variant` = primary | secondary | outlined.

### 5.2 Chips and badges

All chips: 32 px tall (36 in lists where they are the only tappable thing), pill, 14 px / 700 label, 16 px icon, 10 px horizontal padding. The `small` variant is removed; two-line wrapping stays for long labels.

| Chip | Fill / text | Icon | Notes |
|---|---|---|---|
| **Live** (Active) | `primaryContainer` / `onPrimaryContainer` | `circle-medium` pulsing dot (one 1.2 s fade, no loop in reduced-motion) | Replaces the word "Active" with "Live" on Home and Results to match the section title. |
| **Completed** | `tertiaryContainer` / `onTertiaryContainer` | `flag-checkered` | Was `primary`; moves to blue so green is reserved for Live/win. |
| **Closed** | `surfaceSunken` / `onSurfaceVariant` | `lock-outline` | |
| **Registered** | `primaryContainer` green | `check-circle-outline` | **One map everywhere** (My players, New game, Players/Admins, Register dialog). |
| **Pending** | `secondaryContainer` marigold | `clock-outline` | Label "Pending" (was "Pending registration"); full phrase in accessibility label. |
| **Unregistered** | `surfaceSunken` grey | `account-question-outline` | |
| **Points** | `tertiaryContainer` blue | `numeric` | G-number badge uses the same tint. |
| **Pool** | `secondaryContainer` marigold | `trophy-outline` | |
| **Creator / Admin / Player / View only** | Creator `leaderContainer` + crown; Admin `tertiaryContainer` + shield; Player / View only grey | | Same map on Home, Results, Players/Admins. |
| **You** | `primary` fill, `onPrimary` text | | The only solid chip, so "you" pops in any list. |
| **Round N · AR deals** (scorecard) | `surface` with 2 px `primary` border, `primary` text | `cards-outline` | Styled as a status strip, not a chip, so it does not read as a game status. |
| **Count badge** | `error` fill, `onError` 13 px / 800, 20 px min | | Unregistered count on tile. |
| **Player ID** | `surfaceSunken`, `onSurface` 14 px / 700, monospace-tabular "#7" | `pound` | One shape everywhere; Profile shows it at 22 px in the identity card. |

### 5.3 Cards and lists

- **Card**: `surface`, 1.5 px `outlineVariant`, `r-lg`, 16 px padding, 12 px internal gap. Title `subtitle` 18/700 with a 36 px `primaryContainer` icon disc. No card inside a card: list rows inside a `SectionCard` are separated by 1 px `hairline` dividers, not their own frames (fixes the double-frame look on Home and My players).
- **Game row**: 72 px min; 48 px G-badge (`tertiaryContainer`, 18/800); date `subtitle`; chips row; `chevron-right` 24 px `onSurfaceVariant`. Selected: `primaryContainer` fill + 2 px `primary` ring + `checkbox-marked` in `primary`.
- **Player row**: 64 px min; 40 px seat avatar; name `body` 600 with bold initials; one chips row.
- **Player grid card** (My players): keep 2-up grid, `r-lg`, name `body` 700 two lines, Player ID + status chips, 112 px tall.
- **Section header** outside a card (Playing · 5): `label` 14/700 uppercase tracking 0.5, `onSurfaceVariant`.

### 5.4 Avatars

`SeatAvatar` sizes 28 / 36 / 44 / 56; pill; seat fill with white initials 40 % of size, 700; 2 px `surface` ring when sitting on a coloured surface. "Me" is always `primary`. Spectator: `surfaceSunken` fill, `onSurfaceVariant` initials, `eye-outline` 50 %. Leader: 18 px `leader` crown disc at top-right (both modes). Winner (Results): 64 px with a 3 px `leader` ring.

### 5.5 Scores and numbers

- Always tabular Nunito 800 (win) or 700 (loss/zero), always signed (`+40`, `-10`, `0`).
- Win: `win` text on surface, or `onWinContainer` on `winContainer` pill. Loss: `loss` text; big loss (≥ half Full count) adds the `lossContainer` pill. Zero: `onSurfaceVariant`.
- Scorecard cells 18 px (15 px above 8 columns), totals 20 px / 800, round number 16 px, dealer initials 13 px (`caption`, the only sub-14 text in the app).
- Standings and Results totals 24 px / 800; winner total 40 px / 800.
- Balance pill: 32 px value, `winContainer` when 0, `lossContainer` otherwise, label "Balance" 14 px / 700.

### 5.6 Inputs

Outlined, 56 px, `r-md`, 2 px `outline` border → 2 px `primary` on focus, 16 px text, label 14 px. Search field: same outline style (replaces Paper's grey pill `Searchbar`) with a 22 px magnifier. Passcode cells 56 × 56, 28 px / 800, same border rules.

### 5.7 Navigation chrome

- Header: `background`, title `title` 22/800 left-aligned on every screen (tabs and stack), back arrow 24 px, right-side `IconButton`s 24 px icons in 48 px targets. Drop the version string from the Home header (keep it in Profile).
- Tab bar: `surface`, 1 px `outlineVariant` top, 64 px + inset, Material Community Icons (`home` / `home-outline`, `account-group` / `-outline`) to match the rest; active `primary` icon + 14 px / 700 label; profile tab keeps the avatar.
- Bottom bar: `surface`, 1 px `outlineVariant` top, 12 px padding, buttons 52 px, gap 12.

### 5.8 Dialogs, sheets, feedback

Dialog `r-xl`, `surface`, 24 px padding, title `subtitle` 18/700, body `body` 16, actions right-aligned: text Cancel + primary confirm (destructive confirm filled `error`). Snackbar `inverseSurface` with `body` text. Skeleton rows `surfaceSunken` everywhere (replace the three `ActivityIndicator` screens for consistency).

### 5.9 The confetti moment

Where: the first time a result is shown on `results/view` and when a saved result opens on `results/[id]` from the "Result saved" dialog. Also on `games/complete` after Complete game succeeds, scaled down (fewer pieces).

What: a **winner card** at the top of the results page: 64 px winner avatar with `leader` ring and crown, name in `title`, total in `display`, "1st" chip in `leaderContainer`; 2nd and 3rd as compact rows underneath. Confetti: ~60 pieces in `primary`, `secondaryContainer`, `tertiary`, `error` and white, falling from the top edge for 1.8 s with slight rotation, then gone. No sound. Honour `AccessibilityInfo.isReduceMotionEnabled` → show the card without confetti. Implemented with `react-native-reanimated` (already a transitive dependency of expo-router) or the small `react-native-confetti-cannon`; see the plan.

## 6. Iconography

Material Community Icons only (drop the two Ionicons). Sizes 16 (chips), 22 (buttons, inputs), 24 (headers, rows, tabs), 32 (empty states). Always paired with a label except the universally understood help `?`, back arrow, overflow `⋮`, close `×` and chevron.

## 7. Motion

Keep what exists (cell fill 220 ms, preset flash, chip pop-in, balance pulse). Add: button press translate (80 ms), confetti (1.8 s, once). Nothing loops. All motion respects reduce-motion.

## 8. Token file sketch

Not an implementation, just the shape the plan assumes. `constants/theme.ts` keeps its exports (`spacing`, `radius`, `seatColor`, `useAppTheme`, `lightTheme`, `darkTheme`, `brand`, `tabularNums`) and adds:

```ts
// additions, names only
colors.surfaceSunken; colors.win; colors.winContainer; colors.onWinContainer;
colors.loss; colors.lossContainer; colors.onLossContainer;
colors.primaryEdge; colors.secondaryEdge; colors.focus;
seatColor(index, { onDark?: boolean });           // returns dark text variant when asked
type: { display, headline, title, subtitle, body, label, caption, score, scoreLg, scoreXl, button };
fonts: Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold;
```

`positive` / `negative` remain as aliases of `win` / `loss` during migration so nothing breaks before it is touched.
