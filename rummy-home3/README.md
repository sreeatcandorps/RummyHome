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
