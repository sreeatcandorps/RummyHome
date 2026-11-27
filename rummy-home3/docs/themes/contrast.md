# Themes: the contrast numbers

<!-- Written by `node docs/themes/build.mjs`. Change palettes.mjs or lib/, not this file. -->

WCAG 2.2 contrast, foreground on background. Floors: **4.5 : 1** for body text and numbers, **3 : 1** for large
numbers, icons and outlines. Seat distances are CIEDE2000 (about 2 is just visible; 10 and up reads as another
colour). The two new themes pass every row. Today's values are beside them for comparison; **✗** marks a value under its floor.

## Summary

| | Haveli | Mehfil | Today · light | Today · dark |
| --- | --- | --- | --- | --- |
| Pairs under their floor (of 57) | 0 | 0 | 1 | 0 |
| Text and numbers, the weakest of 52 pairs (floor 4.5) | 5.20 (loss on bandAlt) | 5.52 (loss on leaderContainer) | 4.87 (leader on surface) | 5.34 (loss on reentryContainer) |
| Large numbers, icons and outlines, the weakest of 5 (floor 3) | 3.45 (outline on background) | 4.68 (outline on surface) | 2.83 (outline on background) | 5.06 (outline on surface) |
| Seat colours | 20 | 20 | 10 | 10 |
| Initials on the avatar, lowest (floor 4.5) | 5.90 | 7.28 | 5.18 | **1.31 ✗** |
| Seat lettering on the header, lowest (floor 4.5) | 4.61 | 4.66 | **4.18 ✗** | 5.19 |
| Two closest seats (floor 10) | 11.2 (seats 5 and 10) | 10.8 (seats 11 and 14) | 10.1 (seats 2 and 7) | 11.0 (seats 4 and 5) |
| Closest neighbours at the table (floor 20) | 28.5 | 25.3 | **11.6 ✗** | **11.0 ✗** |
| Two closest seats as red-green colour-blind eyes see them (no floor) | 2.92 | 2.20 | 0.41 | 0.40 |

Today's dark avatar figure is white initials on the pale seat tints: the avatar in the bottom bar (seat 1, 1.86 : 1)
and the seating guide (all ten). The other avatars on dark use the light theme's seat colours, which pass.

The last row is why colour is never the only sign: with twenty colours (or with today's ten) some pairs look alike
to red-green colour-blind eyes, so every seat always shows its initials too.

## Every pair

| Text / mark | On | Used for | Floor | Haveli | Mehfil | Today · light | Today · dark |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `onBackground` | `background` | Screen titles, "Hi Ravi" | 4.5 | 14.8 | 16.0 | 14.9 | 15.9 |
| `onSurface` | `surface` | Card text, scores | 4.5 | 16.7 | 14.8 | 16.7 | 14.7 |
| `onSurface` | `tableStripe` | Scores on a striped row | 4.5 | 15.9 | 14.1 | 15.8 | 13.7 |
| `onSurface` | `tableLatest` | Scores on the newest round | 4.5 | 14.9 | 11.1 | 15.2 | 11.3 |
| `onSurface` | `tableHeader` | Round numbers, totals | 4.5 | 14.3 | 13.5 | 14.7 | 12.9 |
| `onSurface` | `surfaceVariant` | Text on the Recent card | 4.5 | 13.3 | 13.0 | 13.5 | 13.5 |
| `onSurface` | `leaderContainer` | The leading row in Standings | 4.5 | 13.6 | 9.36 | 14.7 | 9.24 |
| `onSurface` | `reentryContainer` | A re-entered row in Standings | 4.5 | 13.4 | 10.1 | 13.6 | 8.67 |
| `onSurface` | `band` | Result rows | 4.5 | 14.6 | 14.3 | 14.7 | 13.7 |
| `onSurface` | `bandAlt` | Result rows, every second game | 4.5 | 13.3 | 13.0 | 13.8 | 12.3 |
| `onSurface` | `bandHead` | Result column heads | 4.5 | 13.8 | 10.5 | 14.0 | 10.5 |
| `onSurface` | `bandHeadAlt` | Result column heads, every second game | 4.5 | 12.8 | 8.40 | 13.1 | 8.42 |
| `onSurface` | `elevation.level3` | Dialogs | 4.5 | 14.5 | 12.8 | 14.2 | 12.3 |
| `onSurfaceVariant` | `surface` | Grey notes, "Pool", player count | 4.5 | 7.93 | 9.08 | 6.37 | 9.12 |
| `onSurfaceVariant` | `background` | Grey notes on the page | 4.5 | 7.04 | 9.84 | 5.69 | 9.86 |
| `onSurfaceVariant` | `surfaceVariant` | Closed tag, struck-out totals | 4.5 | 6.33 | 7.97 | 5.16 | 8.37 |
| `onSurfaceVariant` | `tableHeader` | RND, dealer initials, OPENS | 4.5 | 6.80 | 8.29 | 5.62 | 8.04 |
| `onSurfaceVariant` | `tableLatest` | Dealer initials on the newest round | 4.5 | 7.06 | 6.80 | 5.78 | 7.06 |
| `primary` | `surface` | Undo, Complete, Re-enter, links | 4.5 | 7.41 | 9.39 | 9.94 | 9.78 |
| `primary` | `background` | Links on the page | 4.5 | 6.58 | 10.2 | 8.87 | 10.6 |
| `onPrimary` | `primary` | New game, Add round, the lit tab | 4.5 | 7.59 | 8.88 | 9.94 | 8.11 |
| `onPrimaryContainer` | `primaryContainer` | Active, Round 6, the dealer column | 4.5 | 9.18 | 9.16 | 10.2 | 9.48 |
| `onSecondaryContainer` | `secondaryContainer` | Game badge, Results, My players, Pool | 4.5 | 9.34 | 8.98 | 9.93 | 8.66 |
| `secondary` | `surface` | A picked game's rule and label | 4.5 | 5.95 | 11.0 | 5.05 | 9.86 |
| `tertiary` | `surface` | Notices | 4.5 | 7.65 | 9.93 | 6.01 | 9.24 |
| `onTertiaryContainer` | `tertiaryContainer` | Completed, Admin tags | 4.5 | 11.5 | 9.62 | 11.0 | 8.40 |
| `error` | `surface` | Error text | 4.5 | 6.54 | 8.70 | 6.57 | 8.40 |
| `error` | `background` | Error text on the page | 4.5 | 5.80 | 9.43 | 5.86 | 9.08 |
| `onError` | `error` | Delete button | 4.5 | 6.70 | 7.66 | 6.57 | 7.50 |
| `onErrorContainer` | `errorContainer` | Warnings | 4.5 | 10.7 | 8.30 | 11.2 | 7.97 |
| `loss` | `surface` | Minus numbers, OUT R4 in Standings | 4.5 | 6.54 | 8.70 | 7.28 | 9.03 |
| `loss` | `tableStripe` | Big hands on a striped row | 4.5 | 6.21 | 8.34 | 6.89 | 8.43 |
| `loss` | `tableLatest` | Big hands on the newest round | 4.5 | 5.82 | 6.52 | 6.60 | 6.99 |
| `loss` | `surfaceVariant` | OUT R4 on a struck-out column | 4.5 | 5.21 | 7.64 | 5.89 | 8.29 |
| `loss` | `leaderContainer` | Low "left / drops" on the leading row | 4.5 | 5.34 | 5.52 | 6.40 | 5.69 |
| `loss` | `reentryContainer` | Low "left / drops" on a re-entered row | 4.5 | 5.26 | 5.97 | 5.90 | 5.34 |
| `loss` | `band` | Minus numbers in a result | 4.5 | 5.70 | 8.43 | 6.42 | 8.44 |
| `loss` | `bandAlt` | Minus numbers in a result, every second game | 4.5 | 5.20 | 7.67 | 6.00 | 7.57 |
| `onLossContainer` | `lossContainer` | Loss notes | 4.5 | 10.7 | 8.30 | 11.2 | 7.97 |
| `win` | `surface` | Winner text, ticks | 4.5 | 6.35 | 10.6 | 7.38 | 10.7 |
| `onWinContainer` | `winContainer` | The winning 0 | 4.5 | 13.7 | 8.50 | 14.3 | 8.62 |
| `onPositiveContainer` | `positiveContainer` | Positive tags | 4.5 | 13.7 | 8.50 | 14.3 | 8.62 |
| `leader` | `surface` | Leader notes | 4.5 | 5.68 | 10.2 | 4.87 | 12.4 |
| `onLeaderContainer` | `leaderContainer` | Creator tag, My players count | 4.5 | 10.8 | 8.84 | 11.6 | 9.16 |
| `reentry` | `surface` | The re-entry score in a cell | 4.5 | 7.65 | 9.93 | 6.01 | 9.24 |
| `reentry` | `tableStripe` | The re-entry score on a striped row | 4.5 | 7.27 | 9.51 | 5.70 | 8.63 |
| `reentry` | `tableHeader` | A re-entered player's initials and total | 4.5 | 6.56 | 9.07 | 5.30 | 8.15 |
| `reentry` | `reentryContainer` | A re-entered row's initials and score | 4.5 | 6.16 | 6.81 | 4.88 | 5.46 |
| `onFelt` | `felt` | Sign-in band title | 4.5 | 10.3 | 12.8 | 12.7 | 10.7 |
| `onFeltMuted` | `felt` | Sign-in band subtitle | 4.5 | 6.95 | 8.20 | 7.31 | 6.32 |
| `inverseOnSurface` | `inverseSurface` | Toast text | 4.5 | 12.7 | 12.1 | 11.5 | 10.8 |
| `inversePrimary` | `inverseSurface` | Toast Undo | 4.5 | 8.88 | 6.31 | 7.23 | 8.31 |
| `leader` | `tableHeader` | Crown under a column | 3 | 4.87 | 9.34 | 4.29 | 10.9 |
| `leader` | `leaderContainer` | Crown on the leading row | 3 | 4.65 | 6.49 | 4.28 | 7.80 |
| `outline` | `surface` | Outlined button edge | 3 | 3.88 | 4.68 | 3.17 | 5.06 |
| `outline` | `background` | Field edge on the page | 3 | 3.45 | 5.07 | **2.83 ✗** | 5.47 |
| `primary` | `background` | A filled button against the page | 3 | 6.58 | 10.2 | 8.87 | 10.6 |

## Seats

Initials = the seat's initials on its avatar. Lettering = the seat colour as initials on the table header, a card
and the dealer's column (the lowest of the three).

| Seat | Haveli | initials | lettering | Mehfil | initials | lettering |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `#A5195D` | 7.25 | 5.66 | `#F983C3` | 7.96 | 5.10 |
| 2 | `#1468A3` | 5.93 | 4.63 | `#82C6F9` | 10.0 | 6.42 |
| 3 | `#895618` | 6.16 | 4.81 | `#F99532` | 8.24 | 5.28 |
| 4 | `#6D3093` | 8.42 | 6.57 | `#CE9FFE` | 8.80 | 5.64 |
| 5 | `#2F6F0F` | 6.17 | 4.82 | `#A8DF68` | 11.8 | 7.56 |
| 6 | `#5A3A1F` | 10.2 | 7.96 | `#D4AF90` | 9.08 | 5.82 |
| 7 | `#386B7B` | 5.90 | 4.61 | `#6ED9D2` | 11.0 | 7.05 |
| 8 | `#7B242E` | 9.84 | 7.68 | `#F7E785` | 14.7 | 9.42 |
| 9 | `#4F3DE6` | 6.68 | 5.22 | `#9DA1CA` | 7.37 | 4.72 |
| 10 | `#5F6932` | 5.91 | 4.61 | `#A9F2C0` | 14.2 | 9.09 |
| 11 | `#5B004B` | 13.6 | 10.6 | `#78C5D7` | 9.46 | 6.06 |
| 12 | `#5B1A03` | 13.2 | 10.3 | `#5EB567` | 7.28 | 4.66 |
| 13 | `#5B4F80` | 7.30 | 5.70 | `#E0D0A5` | 12.1 | 7.73 |
| 14 | `#384833` | 9.80 | 7.65 | `#8CAABA` | 7.53 | 4.83 |
| 15 | `#422A36` | 13.0 | 10.1 | `#B6B857` | 8.77 | 5.62 |
| 16 | `#574603` | 9.20 | 7.18 | `#CAEEE3` | 14.8 | 9.49 |
| 17 | `#675061` | 7.25 | 5.66 | `#D3B4C1` | 9.73 | 6.23 |
| 18 | `#0002A0` | 13.8 | 10.8 | `#BEC9AD` | 10.7 | 6.84 |
| 19 | `#7C5149` | 6.71 | 5.24 | `#E2E1FF` | 14.5 | 9.26 |
| 20 | `#023869` | 11.8 | 9.25 | `#8EAD9F` | 7.58 | 4.86 |
