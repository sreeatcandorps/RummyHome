# Play Store listing copy & assets

Use these in Google Play Console while the account verification finishes.

## App identity

- **App name:** Rummy Home
- **Package:** `com.rummyhome.app`
- **Category:** Tools (or Cards / Casual — pick what Play offers closest to scorekeeping; avoid Gambling)

## Short description (≤ 80 characters)

```
Scorekeeping for home rummy nights. Stake & pool games, shared live totals.
```

(74 characters)

## Full description

```
Rummy Home is a simple scorekeeper for friendly home rummy games.

Track stake or pool games with friends, enter rounds quickly, and keep everyone on the same totals — without paper, spreadsheets, or real-money wagering inside the app.

What you can do
• Create stake or pool games with your group
• Enter drops, middle drops, counts, rummy wins, and expenses
• See running totals and dealer rotation as you play
• Invite players by email, phone, or Player ID
• Complete games and revisit history later

Rummy Home does not process payments, bets, or casino-style gambling. It only tracks scores for games you play in person.

Sign in with email and a short passcode. Your games sync for everyone invited to that table.
```

## Assets ready in this repo

| Asset | Path | Notes |
| --- | --- | --- |
| High-res icon (512+) | `docs/store-assets/app-icon-1024.png` | Also copied to `rummy-home3/assets/icon.png` |
| Feature graphic | `docs/store-assets/feature-graphic-1024x500.png` | Exact **1024×500** for Play Console |
| Feature graphic (source) | `docs/store-assets/feature-graphic.png` | Wider source; use the 1024×500 file for upload |
| Privacy policy | `docs/privacy-policy.html` | Host via GitHub Pages `/docs` |

## Screenshots (you still need these)

Take from a real phone build (Expo Go or the upcoming Play internal build):

1. Home / recent games  
2. Game table (landscape if possible)  
3. Score entry  
4. Find players / invite  
5. Profile with Player ID  

Phone screenshots: at least **2**, ideally **4–8**.

## Privacy policy URL (after GitHub Pages)

Enable Pages for `sreeatcandorps/RummyHome`:

1. Repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / folder: `/docs`
4. Save

Then use:

`https://sreeatcandorps.github.io/RummyHome/privacy-policy.html`

## Expo / EAS (you must run — needs your login)

From `rummy-home3/`:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli update:configure
npm run eas:env
```

Not logged in yet on this machine, so those four commands still need you.
