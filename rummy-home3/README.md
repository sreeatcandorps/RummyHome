# Rummy Home

Rummy Home is an Expo Router / React Native score keeper for live Rummy games.

## App Root

Run app commands from this directory:

```sh
cd rummy-home3
```

The parent workspace contains legacy files; this folder is the source of truth for the mobile app.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `npm install`.
4. Run `npm run validate:env`.
5. Run `npm run typecheck`.
6. Start the app with `npm start`.

## Guardrails

- `npm run typecheck` checks TypeScript without emitting files.
- `npm run doctor` runs Expo project diagnostics.
- `npm run validate:env` verifies required Supabase environment variables.

Check out the [Expo Router documentation](https://docs.expo.dev/routing/introduction/) for more information.


## My players and Register players (Round 3)
- New game: you are always first; pick from My players (10 at a time, last 2 weeks first, then most games). Selected players show as chips with initials and player ID.
- Add new player (1 to 5 at a time) with just initials; each row saves on its own and gets a player ID.
- Find player in database searches registered players only.
- Register players (game ⋮ menu or My players) sends each unregistered player an invite by email.
- Game settings (⋮) and User settings (Me) hold Drop and Middle drop. Points only for now.
- Details, statuses and Supabase setup: [docs/players-and-identity.md](docs/players-and-identity.md).
