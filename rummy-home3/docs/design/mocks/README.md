# Mock tooling

Nothing here is imported by the app. These scripts regenerate the PNGs in `../mockups/`.

| File | What it does |
|---|---|
| `mock.html` | Static HTML/CSS mock with all three palettes as CSS variables. Open in a browser: `mock.html?screen=home&mode=dark&palette=A`. Screens: `home`, `scorecard`, `scorecard-big`, `add-round`, `results`, `players`, `game-players`, `game-players-player-view`, `confetti`, `initials-conflicts`, `player-refresh`. Palettes: `A` (Clubhouse), `B` (Indigo & Marigold), `C` (Teal & Coral). Needs network for Nunito and the MDI webfont. |
| `render.js` | Screenshots `mock.html` into `../mockups/after`, `confetti`, `initials`, `alternatives`, and builds the side-by-side `compare` sheets from `current` + `after`. |
| `capture-current.js` | Drives the real app in Expo web (local prototype mode) through every screen, light and dark, into `../mockups/current` (numbered files). Patches one line of the Metro bundle in flight to trigger the stale-scorecard dialog. |
| `contrast.js` | WCAG 2.x contrast calculator with the token sets for the current theme and directions A/B/C. `node contrast.js all` prints the markdown tables used in the docs. |

```bash
cd rummy-home3/docs/design/mocks
npm i --no-save playwright-core          # uses the system Chrome; set CHROME=/path/to/chrome if needed
node render.js all                       # after + confetti + initials + alternatives + compare
CI=1 npx expo start --web --port 8085    # in rummy-home3, then:
node capture-current.js                  # ~6 minutes, writes ../mockups/current
node contrast.js A                       # or B, C, current, seats, all
```
