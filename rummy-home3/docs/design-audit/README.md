# Design audit mockups (PR 15)

Left panel = crop of a real emulator screenshot (CI smoke run, Nov 14). Right panel = proposed. Spec: [`../design-audit.md`](../design-audit.md).

| File | Finding |
| --- | --- |
| `A00-tokens.png` | radii, colour roles, tag vs chip, button weights, dismiss words (section 3) |
| `A01-results-colours.png` | Results page: selected games green / "Results" tag yellow → inverted fix |
| `A02-screen-titles.png` | four title patterns → "Screen · S1", centred, header icon order |
| `A03-player-id-format.png` | "Player ID 1" / "#1" / "#ID" → "#1" |
| `A05-dismiss-wording.png` | Not yet / Not now / Close / OK → Cancel rule |
| `A06-date-formats.png` | three date formats → `formatWhen` |
| `A07-search-fields.png` | three search fields → `SearchField` |
| `A08-bottom-bars.png` | My players tiles under the tab bar; three bar shapes → `ActionBar` |
| `A10-section-headings.png` | UPPERCASE headings on the saved result page → sentence case |
| `A11-game-label-colour.png` | blue game square on Home → yellow everywhere |
