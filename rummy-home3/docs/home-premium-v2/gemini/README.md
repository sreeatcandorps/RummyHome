# EZ Score: Rummy — Home Screen Luxury Directions (v2 · Gemini)

Two original Indian luxury directions for Home, keeping D136's exact layout order and D137's two-button bottom bar. Every screen is rendered from real HTML/CSS/SVG with the app's MaterialCommunityIcons and checked for zero clipped text and ≥ 4.5:1 text contrast (actual minimum: 6.19:1 across all five renders).

## Direction 1 · Royal Darbar (Velvet Crimson, 22K Gold & Udaipur Ivory)

- **Light (`royal-darbar-light.png`) & Dark (`royal-darbar-dark.png`)**: Inspired by royal Indian palace card rooms and classic Bollywood grandeur — deep Banarasi zari crimson velvet warmed by chandelier light, paired with satin-brushed 22K champagne-gold foil and warm Udaipur silk-ivory cards.
- **Look & feel**: High-contrast Playfair Display and Cinzel typography with hairline antique-gold borders, double-framed game medallions (`P2`, `S3`), harmonized jewel-toned status micro-chips, and a quiet one-line table score glimpse (optional under D136).
- **Dark mode**: Shifts into candlelit obsidian-garnet velvet where the brushed-gold `+ New game` bar and live game plaques glow like a private club table.

## Direction 2 · Mayur Palace (Royal Peacock Teal, Temple Brass & Sunlit Silk)

- **Light (`mayur-palace-light.png`) & Dark (`mayur-palace-dark.png`)**: Inspired by Jaipur City Palace, Kanjeevaram silk, and modern Indian couture — sunlit Udaipur ivory cotton silk with delicate corner filigree, anchored by lacquered peacock-teal jewel accents and temple brass.
- **Look & feel**: Airier and calmer in daylight with Cormorant Garamond and Cinzel type, a lacquered peacock-silk `+ New game` bar framed in brushed brass, and restrained jade, sapphire, and brass badges.
- **Dark mode**: Deep midnight peacock silk crowned by softly lit golden Mughal jaali, matching EZ Score's existing emerald-and-gold Joker emblem naturally so the rest of the app needs the fewest changes.

## Recommendation: **Royal Darbar**

I recommend **Royal Darbar** (`royal-darbar-small.png` shows it on the 360 dp small phone at 1.3× text scale). It delivers the strongest immediate "wow, this feels premium and unmistakably Indian" reaction that Sree asked for — combining rich Bollywood crimson velvet and true brushed 22K gold with calm, ultra-readable ivory game cards at the table. Choose **Mayur Palace** instead if you want a brighter, lighter-touch daylight Home that blends seamlessly with the current green Joker icon and share pages without re-theming them first.

## Re-rendering

```bash
node rummy-home3/docs/home-premium-v2/gemini/make.mjs
```
