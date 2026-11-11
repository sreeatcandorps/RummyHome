# Mock tooling

Nothing here is imported by the app. These scripts regenerate the PNGs in `../mockups/`.

| File | What it does |
|---|---|
| `mock.html` | Static HTML/CSS mock of five screens with all three palettes as CSS variables. Open in a browser: `mock.html?screen=home&mode=dark&palette=A`. Screens: `home`, `scorecard`, `add-round`, `results`, `players`, `confetti`. Palettes: `A` (Clubhouse), `B` (Indigo & Marigold), `C` (Teal & Coral). Needs network for Nunito and the MDI webfont. |
| `render.js` | Screenshots `mock.html` into `../mockups/after`, `confetti`, `alternatives`, and builds the side-by-side `compare` sheets from `before` + `after`. |
| `capture-current.js` | Screenshots the real app running in Expo web (local prototype mode) into `../mockups/before`. |
| `contrast.js` | WCAG 2.x contrast calculator with the token sets for the current theme and directions A/B/C. `node contrast.js all` prints the markdown tables used in the docs. |

```bash
cd rummy-home3/docs/design/mocks
npm i --no-save playwright-core          # uses the system Chrome; set CHROME=/path/to/chrome if needed
node render.js all                       # after + confetti + alternatives + compare
node contrast.js A                       # or B, C, current, seats, all
```
