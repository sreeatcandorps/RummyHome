# Themes: every token, four ways

<!-- Written by `node docs/themes/build.mjs`. Change palettes.mjs or lib/, not this file. -->

The 79 colour tokens `constants/theme.ts` has today, each with its value in the two new sets and in today's two.
A token missing from a new set, or one no group below mentions, fails `node docs/themes/build.mjs --check`.
The 20 seat colours of each new set are in [contrast.md](contrast.md#seats).

## Page and cards

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `background` | The page behind everything | `#F6EEDD` | `#140D09` | `#F5F2E8` | `#0C120E` |
| `onBackground` | Titles on the page: "Hi Ravi" | `#231A12` | `#F4E9D4` | `#1A1F1B` | `#ECEBE4` |
| `surface` | Cards, the table, the bottom bar | `#FFFCF5` | `#20160F` | `#FFFFFF` | `#141B16` |
| `onSurface` | Text and scores | `#231A12` | `#F4E9D4` | `#1A1F1B` | `#ECEBE4` |
| `surfaceVariant` | The Recent card, a Closed tag, an out column | `#EDE2CC` | `#2E2118` | `#ECE7DA` | `#1B231D` |
| `onSurfaceVariant` | Grey notes: "Pool", OPENS, player count | `#5C4D3D` | `#C9B79C` | `#5A615B` | `#B6BDB4` |
| `surfaceSunken` | The unlit tab | `#EDE2CC` | `#1A110B` | `#ECE7DA` | `#101712` |
| `outline` | Outlined buttons, input borders | `#8E7D67` | `#93806A` | `#8E928A` | `#848C84` |
| `outlineVariant` | Card edges | `#E3D6BC` | `#3A2C20` | `#E6E1D3` | `#2A322C` |
| `hairline` | Lines between rows and cells | `#E3D6BC` | `#3A2C20` | `#E6E1D3` | `#2A322C` |
| `surfaceDisabled` | A button that cannot be pressed | `rgba(35,26,18,0.12)` | `rgba(244,233,212,0.12)` | `rgba(23,32,27,0.12)` | `rgba(234,237,233,0.12)` |
| `onSurfaceDisabled` | Its label | `rgba(35,26,18,0.38)` | `rgba(244,233,212,0.38)` | `rgba(23,32,27,0.38)` | `rgba(234,237,233,0.38)` |
| `backdrop` | The dim behind a dialog | `rgba(35,26,18,0.45)` | `rgba(0,0,0,0.6)` | `rgba(23,32,27,0.45)` | `rgba(0,0,0,0.6)` |
| `elevation.level0` | Flat (no lift) | `transparent` | `transparent` | `transparent` | `transparent` |
| `elevation.level1` | Menus | `#FBF6EA` | `#251A12` | `#FAF8F2` | `#1B211E` |
| `elevation.level2` | Menus, pickers | `#F8F1E2` | `#2A1E15` | `#F5F2E8` | `#1F2622` |
| `elevation.level3` | Dialogs | `#F4ECDA` | `#2F2218` | `#F0ECE0` | `#232A26` |
| `elevation.level4` | Raised sheets | `#F2E9D5` | `#32251A` | `#EEE9DC` | `#252C28` |
| `elevation.level5` | The highest sheet | `#EFE5CF` | `#36281D` | `#EAE5D6` | `#283029` |
| `shadow` | Shadows | `#000000` | `#000000` | `#000000` | `#000000` |
| `scrim` | The dim behind a sheet | `#000000` | `#000000` | `#000000` | `#000000` |

## The main action

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `primary` | New game, Add round, the lit tab, links | `#0B5E5B` | `#E7B549` | `#0E4D2A` | `#7FD39F` |
| `onPrimary` | Their labels | `#FFFFFF` | `#2B1A00` | `#FFFFFF` | `#063019` |
| `primaryEdge` | The pressable edge under a filled button | `#063F3D` | `#A97C1C` | `#083820` | `#3FAF6E` |
| `primaryContainer` | Active, Round 6, section icons, the dealer column | `#CFE9E1` | `#123F2E` | `#D8ECDD` | `#1A3F29` |
| `onPrimaryContainer` | Their text | `#063F3D` | `#C2ECD6` | `#0B3B1F` | `#CDEFD8` |
| `focus` | The ring around a focused field | `#3949A6` | `#B4BEFF` | `#2B5FBF` | `#9DBCFF` |

## Gold: a game or a selection

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `secondaryContainer` | Game badge, Results, My players, a picked option | `#F2CE74` | `#4A3611` | `#F0DFAE` | `#4A3A10` |
| `onSecondaryContainer` | Their text | `#3A2800` | `#F7E2A8` | `#3E2E07` | `#F5E3B0` |
| `secondary` | The rule and label of a picked game | `#825B00` | `#EBC870` | `#8A6A1E` | `#E3BE63` |
| `onSecondary` | Text on solid gold | `#FFFFFF` | `#3A2800` | `#FFFFFF` | `#3E2E07` |
| `secondaryEdge` | The edge under a gold button | `#CDA035` | `#33250A` | `#CDB56F` | `#3E2E07` |
| `gameTypes.stake.container` | A Points game's badge | `#F2CE74` | `#4A3611` | `#F0DFAE` | `#4A3A10` |
| `gameTypes.stake.on` | Its number: S1 | `#3A2800` | `#F7E2A8` | `#3E2E07` | `#F5E3B0` |
| `gameTypes.stake.accent` | A Points game's line in a result | `#825B00` | `#EBC870` | `#8A6A1E` | `#E3BE63` |
| `gameTypes.pool.container` | A Pool game's badge and tag | `#F2CE74` | `#4A3611` | `#F0DFAE` | `#4A3A10` |
| `gameTypes.pool.on` | Its number: P1 | `#3A2800` | `#F7E2A8` | `#3E2E07` | `#F5E3B0` |
| `gameTypes.pool.accent` | A Pool game's line in a result | `#825B00` | `#EBC870` | `#8A6A1E` | `#E3BE63` |
| `brand.gold` | The brand's gold, by name (no screen reads it today) | `#F2CE74` | `#E7B549` | `#F0DFAE` | `#F0DFAE` |

## Scores

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `winContainer` | The winning 0 | `#CDEEDD` | `#124A33` | `#D6F5DF` | `#1A4A2E` |
| `onWinContainer` | The 0 itself | `#231A12` | `#F4E9D4` | `#17201B` | `#EAEDE9` |
| `win` | Winner text and ticks | `#0A6B4E` | `#6EDDA9` | `#0C6331` | `#73DF9D` |
| `positiveContainer` | A positive tag (Awarded) | `#CDEEDD` | `#124A33` | `#D6F5DF` | `#1A4A2E` |
| `onPositiveContainer` | Its text | `#231A12` | `#F4E9D4` | `#17201B` | `#EAEDE9` |
| `positive` | A plus number (plain, as today) | `#231A12` | `#F4E9D4` | `#17201B` | `#EAEDE9` |
| `loss` | Minus numbers, a Full count, OUT R4 | `#A8321A` | `#FF9A93` | `#A8201A` | `#FFA19A` |
| `negative` | Minus totals | `#A8321A` | `#FF9A93` | `#A8201A` | `#FFA19A` |
| `lossContainer` | A loss note | `#FBDDD0` | `#7A1622` | `#FFE1DD` | `#7A1F1A` |
| `onLossContainer` | Its text | `#571605` | `#FFDADB` | `#5C0F0A` | `#FFDAD6` |
| `leader` | The crown | `#A14E00` | `#FFB65C` | `#9A6700` | `#FFD45E` |
| `leaderContainer` | Creator, the leading row, the My players count | `#FCE2BE` | `#55330B` | `#FFF0BF` | `#4D3900` |
| `onLeaderContainer` | Their text | `#4A2500` | `#FFDFB5` | `#3F2D00` | `#FFE8AE` |
| `reentry` | A re-entered player: ↺71, initials, total | `#3949A6` | `#B4BEFF` | `#2B5FBF` | `#9DBCFF` |
| `reentryContainer` | A re-entered row in Standings | `#DFE3FA` | `#2B3068` | `#DCE8FF` | `#22406E` |

## Notices and errors

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `tertiary` | One notice per screen | `#3949A6` | `#B4BEFF` | `#2B5FBF` | `#9DBCFF` |
| `onTertiary` | Text on a solid notice | `#FFFFFF` | `#141C5C` | `#FFFFFF` | `#0F2B63` |
| `tertiaryContainer` | Completed and Admin tags | `#DFE3FA` | `#2B3068` | `#DCE8FF` | `#22406E` |
| `onTertiaryContainer` | Their text | `#18225E` | `#E0E3FF` | `#0F2B63` | `#DCE8FF` |
| `error` | Error text, Delete | `#A8321A` | `#FF9A93` | `#B4231B` | `#FF978E` |
| `onError` | The Delete label | `#FFFFFF` | `#4A0A12` | `#FFFFFF` | `#4A0B07` |
| `errorContainer` | A warning box | `#FBDDD0` | `#7A1622` | `#FFE1DD` | `#7A1F1A` |
| `onErrorContainer` | Its text | `#571605` | `#FFDADB` | `#5C0F0A` | `#FFDAD6` |

## Scorecard table and results

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `tableHeader` | The header row and the round column | `#F3EAD8` | `#2A1E15` | `#F1F1EA` | `#1F2622` |
| `tableStripe` | Every second round | `#FBF6EA` | `#251A12` | `#F9F9F5` | `#1B211E` |
| `tableLatest` | The newest round | `#E2F3EA` | `#17352A` | `#EAF7EE` | `#1B3326` |
| `cellNeutral` | An empty score key | `#F5EEDF` | `#261B13` | `#F3F3ED` | `#1C2320` |
| `band` | A result's rows | `#F4ECDB` | `#241910` | `#F1F1EB` | `#1B211D` |
| `bandAlt` | Every second game in a result | `#ECE2CC` | `#2D2117` | `#E9EAE2` | `#232A25` |
| `bandHead` | A result's column heads | `#D6ECE5` | `#143A2B` | `#DDEFE2` | `#1A3A26` |
| `bandHeadAlt` | Column heads, every second game | `#C8E5DB` | `#1A4A36` | `#D2E9DA` | `#214A30` |

## Toast and the Sign-in band

| Token | Used for | Haveli (new light) | Mehfil (new dark) | Today, light | Today, dark |
| --- | --- | --- | --- | --- | --- |
| `inverseSurface` | The toast | `#33271B` | `#F4E9D4` | `#2C332F` | `#ECEBE4` |
| `inverseOnSurface` | Its words | `#F8EFDD` | `#33271B` | `#F1F2EE` | `#2C332F` |
| `inversePrimary` | Its action: UNDO | `#F0C55B` | `#0B5E5B` | `#7FD39F` | `#0E4D2A` |
| `felt` | The Sign-in band | `#6E2C12` | `#4A0E11` | `#0B3B1F` | `#0B3B1F` |
| `onFelt` | Its title | `#FFFFFF` | `#F4E9D4` | `#FFFFFF` | `#EAEDE9` |
| `onFeltMuted` | Its second line | `rgba(255,255,255,0.78)` | `rgba(244,233,212,0.78)` | `rgba(255,255,255,0.72)` | `rgba(234,237,233,0.72)` |
| `brand.felt` | The loading and crash screens: title, spinner, button | `#6E2C12` | `#4A0E11` | `#0B3B1F` | `#0B3B1F` |
| `brand.feltLight` | The band's lighter tone, by name (no screen reads it today) | `#0B5E5B` | `#123F2E` | `#0E4D2A` | `#0E4D2A` |
| `brand.cream` | The loading and crash screens: the page, the button's label | `#F6EEDD` | `#F4E9D4` | `#F6F6F1` | `#F6F6F1` |
