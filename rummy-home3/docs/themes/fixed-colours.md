# Fixed colours outside the theme file

<!-- Written by `node docs/themes/build.mjs`. Change palettes.mjs or lib/, not this file. -->

Found by scanning `app/`, `components/`, `utils/`, `contexts/`, `hooks/`, `services/`, `constants/` (tests and
`constants/theme.ts` left out), the live scorecard page and `app.json`: **151 colour values on 103 lines in 14 files.**
Each needs one of three answers before a theme can be one switch.

## On screen: follows the theme

| File | Lines | Values | What it draws | Becomes |
| --- | --- | --- | --- | --- |
| `app/_layout.tsx` | 191 | `#1B1F1C` | The crash screen's message | `onSurface` (its title and button already read `brand.felt`) |
| `components/ui/SeatAvatar.tsx` | 32 | `#FFFFFF` | The initials on every avatar | new `seats[n].on`: white on the light theme's seats, near-black on the dark theme's |
| `components/ui/JokerCard.tsx` | 60 | `#000` | The joker card's shadow | `shadow` |
| `components/ui/JokerCard.tsx` | 56, 68 | `#FFFFFF` `#111111` | The joker card: a white face, black letter | new `card` / `onCard`: a playing card stays white in every theme, but is named in the theme file |
| `components/results/BandTable.tsx` | 110 | `#FFFFFF` | The line between a result's cells | `surface` (white today, so on dark it draws white lines) |
| `components/results/PlayerLine.tsx` | 62 | `rgba(0,0,0,0.15)` | The medal's edge | `outlineVariant` |
| `components/results/PlayerLine.tsx` | 9–11 | `#F6C84C` `#3F2D00` `#D9DCE0` `#2B3036` `#D99A66` `#3B1D08` | Gold, silver and bronze medals | new `medal.gold` / `medal.silver` / `medal.bronze`, each with its `on`: the same metals in every theme |
| `components/ui/AuthShell.tsx` | 313 | `#000` | The Sign-in card's shadow | `shadow` |
| `components/ui/AuthShell.tsx` | 220 | `rgba(251, 241, 225, 0.05)` | The faint club behind the Sign-in band | `onFelt` at 5% |
| `utils/eventLog.ts` | 130–134 | `#A8201A` `#B8860B` `#2F6FB2` `#1F7A4C` `#9A9D95` | The five dots of the game log | `loss`, `leader`, `tertiary`, `win`, `outline` |

## Leaves the phone: one fixed set, `share`

| File | Lines | Values | What it draws | Becomes |
| --- | --- | --- | --- | --- |
| `components/share/ShareCardView.tsx` | 28–37, 42–45 | `#0E4D2A` `#FFFFFF` `rgba(255,255,255,0.85)` `#17201B` `#4E5752` … (13) | The result picture people share | `share.*` |
| `components/share/ScorecardImageView.tsx` | 48–54, 58, 60–62, 64–65 | `#F7F1E6` `#14382A` `#E3B341` `#FBF1E1` `#fff` … (10) | The scorecard picture people share | `share.*` |
| `utils/shareImage.ts` | 13–17, 19–21, 120, 243, 245, 247, 250, 253, 263, 265, 276, 279–280, 286, 289, 292, 298, 301, 307 | `#17201B` `#4E5752` `#E6E1D3` `#A8201A` `#3F2D00` … (21) | The same two pictures, drawn for the web build | `share.*` |
| `utils/resultsDetails.ts` | 332, 354, 357–358, 373, 378, 398, 412–416 | `#17201B` `#4E5752` `#E6E1D3` `#0E4D2A` `#fff` … (29) | The result details page and its PDF | `share.*` |
| `public/scorecard.html` | 8, 10, 12, 19, 29, 32, 34, 39, 44, 48 | `#17201B` `#4E5752` `#E6E1D3` `#0E4D2A` `#083820` … (14) | The live scorecard web page | `share.*`, written into the page by the script that copies it |
| `web/scorecard.html` | 8, 10, 12, 19, 29, 32, 34, 39, 44, 48 | `#17201B` `#4E5752` `#E6E1D3` `#0E4D2A` `#083820` … (14) | Its source copy | `share.*` |

## Baked into the build

| File | Lines | Values | What it draws | Becomes |
| --- | --- | --- | --- | --- |
| `app.json` | 12, 25 | `#FBF1E1` `#0F452D` | The splash screen and the icon's background | stays: Android reads these before the app starts, so they cannot follow a switch |

## Not written as a colour, but fixed all the same

These read one fixed export of `constants/theme.ts` instead of the picked theme, so a search for colour values
does not find them. A theme switch has to move them too.

| What | Where | Becomes |
| --- | --- | --- |
| The loading screen and the crash screen read the one fixed `brand` set | `app/_layout.tsx` 181, 187, 195, 201; `app/index.tsx` 53, 65, 72 | `background`, `primary` and `onPrimary` of the picked theme |
| Avatars and initials that always take the light set of seat colours, whatever the theme | `app/(screens)/games/[id].tsx` 458; `app/(screens)/games/award.tsx` 171; `app/(screens)/games/players.tsx` 155; `app/(tabs)/players.tsx` 72; `components/game/GameTypeStep.tsx` 113; `components/game/OrderOfPlayers.tsx` 117; `components/players/PlayerPickerRow.tsx` 49; `components/players/SelectedPlayersStrip.tsx` 54 | `theme.seats[n]`: its fill, its initials colour, its lettering colour |
| Seat colours picked by a light / dark flag passed by hand | `components/game/ScoreTable.tsx` 420; `components/tutorial/SeatingTutorial.tsx` 63; `components/ui/SeatAvatar.tsx` 31; `components/ui/TabBarButtons.tsx` 87 | `theme.seats[n]`, the same call as the row above |
