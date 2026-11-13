# 04 · Palette alternatives

Three directions were tried on the same type scale, shapes and components (see [02-design-system.md](02-design-system.md)). Only the hues change, so any of them can be swapped in later by editing the token file. Sample screens are the Home tab, light and dark, rendered from `mocks/mock.html?screen=home&palette=…`.

| | A · Clubhouse (recommended) | B · Indigo & Marigold | C · Teal & Coral |
|---|---|---|---|
| Primary | Kelly green `#15803D` / dark `#5FD68E` | Indigo `#4338CA` / dark `#A5B4FC` | Teal `#0F766E` / dark `#5EEAD4` |
| Accent (Results, leader, Pool) | Marigold `#FFE38A` | Marigold `#FFE38A` | Coral `#FFD9D0` (text `#4A1309`) |
| Info (Points, Admin, Registered) | Blue `#DCE8FF` | Cyan `#CFF4FA` | Blue `#DCE8FF` |
| Page / card | `#F6F6F1` / white | `#F6F6FA` / white | `#F3F8F7` / white |
| Dark surface | `#181E1B` (green-black) | `#181824` (blue-black) | `#171F1F` (teal-black) |
| Feel | Card-table green made bright and friendly; keeps the brand's "felt" memory | Modern app-store look, furthest from the current app | Calm, spa-like; coral warms it up |
| Sample | `mockups/after/home-light.png`, `home-dark.png` | `mockups/alternatives/B-home-light.png`, `B-home-dark.png` | `mockups/alternatives/C-home-light.png`, `C-home-dark.png` |

## A · Clubhouse (recommended)

Why: Sree's players already know the app as "the green one"; the icon and the share images are green. Moving from the dark, grey-ish `#1F5C46` on cream to a saturated kelly green on near-white is enough to make it look new without a rebrand. Green also keeps a clean semantic split: green = go/win, marigold = highlight/leader, blue = information, red = loss. Full tokens and contrast tables are in 02.

Trade-off: a filled green primary button is AA (5.02:1) in light mode rather than AAA; labels are 18 px bold so it passes AAA-large. Scores never sit on the green.

## B · Indigo & Marigold

Why consider it: the biggest visual jump. Indigo reads as "modern app", pairs beautifully with marigold (near complementary) and gives the strongest light-mode primary contrast of the three (7.90:1 AAA on white). Win/loss stay green/red so nothing semantic changes.

Trade-offs: breaks the card-table association and the app icon would need recolouring; indigo and the blue info tint compete, so Points/Admin chips moved to cyan; in dark mode the periwinkle primary is less distinct from the cyan info chips than green is from blue in A.

Light tokens that differ from A: `background #F6F6FA`, `surfaceSunken #ECECF3`, `onSurface #17182B`, `onSurfaceVariant #4F5168`, `primary #4338CA`, `primaryEdge #2E2894`, `primaryContainer #E0E0FF` / on `#1E1B5C`, `tertiary #0E7490`, `tertiaryContainer #CFF4FA` / on `#0A3A45`, `tableLatest #EBEBFF`. Dark: `background #0F0F16`, `surface #181824`, `primary #A5B4FC` / on `#1E1B5C`, `primaryContainer #312E81` / on `#E0E0FF`, `tertiary #67E8F9`, `tertiaryContainer #164E63` / on `#CFF4FA`.

### Contrast (B light)

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text on background | `#17201B` on `#F6F6FA` | 15.48:1 | AAA |
| Primary button label | `#FFFFFF` on `#4338CA` | 7.90:1 | AAA |
| Primary as text/icon on surface | `#4338CA` on `#FFFFFF` | 7.90:1 | AAA |
| Tonal label | `#1E1B5C` on `#E0E0FF` | 11.91:1 | AAA |
| Marigold chip label | `#3F2D00` on `#FFE38A` | 10.47:1 | AAA |
| Info chip label | `#0A3A45` on `#CFF4FA` | 10.55:1 | AAA |
| Win / loss score on surface | `#0C6331` / `#A8201A` on `#FFFFFF` | 7.38:1 / 7.28:1 | AAA |

### Contrast (B dark)

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text | `#EAEDE9` on `#181824` | 14.89:1 | AAA |
| Primary button label | `#1E1B5C` on `#A5B4FC` | 7.71:1 | AAA |
| Primary as text/icon on surface | `#A5B4FC` on `#181824` | 8.82:1 | AAA |
| Tonal label | `#E0E0FF` on `#312E81` | 8.85:1 | AAA |
| Info chip label | `#CFF4FA` on `#164E63` | 7.80:1 | AAA |
| Win / loss score on surface | `#73DF9D` / `#FFA19A` on `#181824` | 10.69:1 / 9.05:1 | AAA |

## C · Teal & Coral

Why consider it: still in the green family, so the icon survives, but cooler and calmer; coral replaces marigold as the accent for a warmer, more "evening" feel. Highest dark-mode primary contrast of the three (9.70:1 on the button).

Trade-offs: teal and the blue info tint are close cousins, so Points/Registered chips are less distinct from the primary than in A; coral and the red loss colour are also neighbours, which weakens the "red = loss" rule on Results and the Add-round balance pill; the leader crown keeps marigold, so the app ends up with four accent hues instead of three.

Light tokens that differ from A: `background #F3F8F7`, `surfaceSunken #E6EFED`, `onSurface #132421`, `primary #0F766E`, `primaryEdge #0A544E`, `primaryContainer #CCF1EC` / on `#073B37`, `secondary #B23A2B`, `secondaryContainer #FFD9D0` / on `#4A1309`, `secondaryEdge #E8A090`, `tableLatest #DFF4F1`. Dark: `background #0E1515`, `surface #171F1F`, `primary #5EEAD4` / on `#03302C`, `primaryContainer #134E4A` / on `#CCF1EC`, `secondary #FFB4A2`, `secondaryContainer #6B2415` / on `#FFD9D0`.

### Contrast (C light)

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text on background | `#17201B` on `#F3F8F7` | 15.55:1 | AAA |
| Primary button label | `#FFFFFF` on `#0F766E` | 5.47:1 | AA |
| Primary as text/icon on surface | `#0F766E` on `#FFFFFF` | 5.47:1 | AA |
| Tonal label | `#073B37` on `#CCF1EC` | 10.27:1 | AAA |
| Coral chip label | `#4A1309` on `#FFD9D0` | 11.59:1 | AAA |
| Info chip label | `#0F2B63` on `#DCE8FF` | 11.02:1 | AAA |
| Win / loss score on surface | `#0C6331` / `#A8201A` on `#FFFFFF` | 7.38:1 / 7.28:1 | AAA |

### Contrast (C dark)

| Use | Pair | Ratio | WCAG |
|---|---|---|---|
| Body text | `#EAEDE9` on `#171F1F` | 14.21:1 | AAA |
| Primary button label | `#03302C` on `#5EEAD4` | 9.70:1 | AAA |
| Primary as text/icon on surface | `#5EEAD4` on `#171F1F` | 11.34:1 | AAA |
| Tonal label | `#CCF1EC` on `#134E4A` | 7.83:1 | AAA |
| Coral chip label | `#FFD9D0` on `#6B2415` | 8.52:1 | AAA |
| Win / loss score on surface | `#73DF9D` / `#FFA19A` on `#171F1F` | 10.20:1 / 8.64:1 | AAA |

Full tables for all three directions: `node mocks/contrast.js all`.

## Recommendation

Ship **A**. If Sree wants a bigger break from the current look, **B** is the one to pick: it is the only direction where every light-mode primary pairing is AAA and it looks the most "new". **C** is the fallback if green must stay but the marigold feels too loud; it costs some semantic clarity.
