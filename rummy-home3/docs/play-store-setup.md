# Play Store / EAS setup

This covers the Expo-side work that must happen before the first Android store build.

For the “why Expo vs Play / EAS” explanation and project timeline, see `docs/architecture-and-timeline.md`.

## One-time Expo login

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli update:configure
```

`update:configure` writes the EAS `projectId` and updates URL into `app.json`.
Those values are required for OTA updates.

## Push Supabase keys into EAS

Local `.env.local` is gitignored and is **not** available on EAS builders.
Copy the public Supabase values into every EAS environment:

```bash
node scripts/push-eas-env.mjs
```

Or manually:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://....supabase.co" --environment production --visibility plaintext --force
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --environment production --visibility plaintext --force
```

Repeat for `preview` and `development`. The anon key is embedded in the client by design; RLS protects the data.

## Build + submit

```bash
npm run validate:env
npm run typecheck
npm test
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform android
```

## Push a JS fix during testing (no new store build)

```bash
npx eas-cli update --channel production --message "Describe the fix" --environment production
```

## Privacy policy URL

Host `docs/privacy-policy.html` from the repo root (GitHub Pages on `/docs` works).

1. GitHub → repo **Settings** → **Pages**
2. Source: Deploy from a branch → `main` / `/docs`
3. Use: `https://sreeatcandorps.github.io/RummyHome/privacy-policy.html`

Paste that URL into Play Console → App content → Privacy policy.

Store listing text and graphics: see `docs/store-listing.md` at the repo root.
