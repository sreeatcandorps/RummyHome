# Premium Home, redrawn (Q60, rounds 2 and 3)

Sree, Nov 27, 1:06 PM PT, on the first set (#181): "Hey, these are not good … They are very average or actually
horrible. I want to know which model did it, and maybe we'll try a different model."

The first set (A Emerald & Gold, B Maroon & Marigold, C Ivory & Indigo) was drawn by a Claude Fable 5.2 helper. It
coded each screen in HTML and CSS, and a script turned the pages into pictures, with no real texture or illustration.
Those three are no longer choices.

This round, two other models each drew two directions from scratch. They kept today's Home layout (D136). They used
generated textures (velvet, lacquer, silk, carved wood) behind the header, and real text on top. Every picture is a
single full-size screen: 1236 × 2745 (Pixel 6), and 1080 × 2340 for the small phone (360 dp, text size 1.3).

## Today's Home

![Today, light](home-premium/today-light-games.png)

## GPT-5.6 Sol

**Mahal Reserve** (the GPT helper's pick): oxblood lacquer and a carved sandalwood arch; each game is a gold-edged
playing card with its suit in the corners.

| Light | Dark | Small phone |
| --- | --- | --- |
| ![](home-premium-v2/gpt/mahal-light-games.png) | ![](home-premium-v2/gpt/mahal-dark-games.png) | ![](home-premium-v2/gpt/mahal-small-games.png) |

**Peacock Atelier**: teal silk with a peacock feather, a hammered-copper New game button, copper-edged game tiles.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gpt/peacock-light-games.png) | ![](home-premium-v2/gpt/peacock-dark-games.png) |

## Gemini 4 Neon

**Royal Darbar** (the Gemini helper's pick): crimson velvet under chandelier light, a brushed-gold New game bar,
ivory game cards with a fine gold edge; Live and Recent both in view.

| Light | Dark | Small phone |
| --- | --- | --- |
| ![](home-premium-v2/gemini/royal-darbar-light.png) | ![](home-premium-v2/gemini/royal-darbar-dark.png) | ![](home-premium-v2/gemini/royal-darbar-small.png) |

**Mayur Palace**: sunlit ivory silk by day, midnight peacock silk with a gold lattice at night; closest to the
Joker icon's green.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/mayur-palace-light.png) | ![](home-premium-v2/gemini/mayur-palace-dark.png) |

## Round 3: Gemini, six more, from Sree's pictures (D140)

Sree, Nov 27, 2:23 PM PT: "I think Gemini has been the best. Can you have Gemini do at least six more options? I don't
see the light option from that picture that I gave you … I like how everything is very clear in the Gemini themes. What
we can probably do is maybe offer these themes in the background, and everybody can choose which theme they want,
right? Two light themes and maybe two dark themes."

Drawn by the same Gemini 4 Neon helper from the four pictures in `theme-refs/`. The light one is taken to be the truck
painting. Each theme changes only colours, materials and ornament, so any of them can be one of the choices under
Appearance. Text contrast is at least 5.29 : 1 on every picture.

**Gemini's pick for the four choices:** light: **Deccan Breeze** and **Royal Darbar** (or Jaipur Sandstone); dark:
**Navaratna Gold** and **Jatara Royal** (or Seshachalam Ember, to match the green Joker icon).

**Deccan Breeze** (from the truck painting (light)): pale sky-cream, washed-denim scrollwork, porcelain cards, a rust-terracotta New game button. No dark band at the top.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/deccan-breeze-light.png) | ![](home-premium-v2/gemini/round2/deccan-breeze-dark.png) |

**Jaipur Sandstone** (from the truck painting (light)): sun-baked terracotta scrollwork over the header, a dusty slate-teal New game button, ivory cards.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/jaipur-sandstone-light.png) | ![](home-premium-v2/gemini/round2/jaipur-sandstone-dark.png) |

**Navaratna Gold** (from Pushpa 2, the hand with rings): smoked espresso-bronze, a carved temple-gold arch, a molten-gold New game button, ruby and emerald accents.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/navaratna-gold-light.png) | ![](home-premium-v2/gemini/round2/navaratna-gold-dark.png) |

**Jatara Royal** (from Pushpa 2, the jatara): midnight sapphire-indigo, golden lotus arches, temple gold, small kumkum-red and emerald touches.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/jatara-indigo-light.png) | ![](home-premium-v2/gemini/round2/jatara-indigo-dark.png) |

**Mulberry Zari** (from Pushpa 2, the hand with rings): deep mulberry silk with gold zari, a gold New game button.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/mulberry-zari-light.png) | ![](home-premium-v2/gemini/round2/mulberry-zari-dark.png) |

**Seshachalam Ember** (from the Pushpa poster): deep forest green and teal with an ember-orange New game button; closest to today's green Joker icon.

| Light | Dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/seshachalam-ember-light.png) | ![](home-premium-v2/gemini/round2/seshachalam-ember-dark.png) |

On the small phone (360 dp, text 1.3):

| Deccan Breeze, light | Navaratna Gold, dark |
| --- | --- |
| ![](home-premium-v2/gemini/round2/deccan-breeze-light-small.png) | ![](home-premium-v2/gemini/round2/navaratna-gold-dark-small.png) |

## Recommendation (round 2, before D140)

**Royal Darbar.** It is the calmest to read at the table and keeps the most of today's Home in view on the small
phone, while still looking rich. Mahal Reserve is the most dramatic of the four, if drama is what is wanted.

**Q60:** which of the four should be built as the Home look, or none (draw again)? Default if there is no answer:
nothing is built.

## Where the pictures come from

- `home-premium-v2/gpt/`: GPT-5.6 Sol helper, `render.mjs` (headless Chromium); textures in `assets/` came from
 its image generator. One review round: the game numbers now sit inside their coins and the small phone keeps
 "My players" on one line.
- `home-premium-v2/gemini/`: Gemini 4 Neon helper, `make.mjs` (headless Chromium); textures in `assets/` came
 from its image generator. Its README reports text contrast of at least 6.19 : 1 on every picture.
- Today: a real CI frame, the same one as in `home-premium.md`.
