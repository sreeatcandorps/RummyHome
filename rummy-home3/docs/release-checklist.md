# Release Checklist

## Before Build

- `npm install`
- `npm run validate:env`
- `npm run typecheck`
- `npm test`
- Apply Supabase migrations in `supabase/migrations`.
- Verify RLS with a non-admin player account.

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

- Preview Android: `eas build --profile preview --platform android`
- Preview iOS: `eas build --profile preview --platform ios`
- Production Android: `eas build --profile production --platform android`
- Production iOS: `eas build --profile production --platform ios`

## Release Notes

- Mention any database migration required.
- Mention any auth changes.
- Mention any known offline limitations.
