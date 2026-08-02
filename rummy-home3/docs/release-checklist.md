# Release Checklist

## Before Build

- `npm install`
- `npm run validate:env`
- `npm run typecheck`
- `npm test`
- Apply Supabase migrations in `supabase/migrations`.
- Verify RLS with a non-admin player account.
- Confirm EAS env vars exist (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) for the target environment. See `docs/play-store-setup.md`.
- Confirm `app.json` has an EAS `projectId` (run `npx eas-cli update:configure` once after login).

## Smoke Tests

- Register a user with email and 6-digit passcode.
- Sign in and sign out.
- Create a stake game with at least two players.
- Add a balanced round and confirm totals update.
- Reject an unbalanced round.
- Undo the last round as game admin.
- Complete a game and verify history marks it completed.
- Add a token adjustment and verify the ledger-derived balance changes.

## Build

- Preview Android: `npx eas-cli build --profile preview --platform android`
- Preview iOS: `npx eas-cli build --profile preview --platform ios`
- Production Android: `npx eas-cli build --profile production --platform android`
- Production iOS: `npx eas-cli build --profile production --platform ios`

## Store / OTA

- Privacy policy URL points at the hosted `docs/privacy-policy.html`.
- After the first production build is installed, JS-only fixes can ship with:
  `npx eas-cli update --channel production --message "..." --environment production`

## Release Notes

- Mention any database migration required.
- Mention any auth changes.
- Mention any known offline limitations.
