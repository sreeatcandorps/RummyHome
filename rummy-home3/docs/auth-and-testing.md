# Auth, Test Accounts, And Testing Strategy

## How Login Works

Rummy Home uses **email + 6-digit passcode** through Supabase Auth.

- The passcode is your **password** in Supabase. There is no separate user ID to enter at login.
- At registration you choose any 6-digit number, for example `123456`.
- At login, enter the same email and the same 6-digit passcode.

## Fix Supabase Before Testing On Your Phone

In [Supabase Dashboard](https://supabase.com/dashboard) for your project:

1. **Authentication -> Providers -> Email**
   - Turn **off** `Confirm email` for development.
   - Otherwise signup succeeds but login fails until you confirm from email.

2. **Project Settings -> General**
   - Make sure the project is **not paused**.

3. **SQL Editor**
   - Run `supabase/migrations/001_core_schema.sql` if you have not already.

4. **Authentication -> URL Configuration**
   - Add your Expo dev URL if needed for password reset.

## See Who Is Already In The Database

Add your secret service role key to `rummy-home3/.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get it from **Supabase Dashboard -> Project Settings -> API -> service_role**.

Then run:

```bash
cd rummy-home3
npm run db:list-users
```

This prints every auth user and every `profiles` row.

## Create Test Accounts

```bash
cd rummy-home3
npm run db:seed-test-users
```

Default test users:

| Email | Passcode |
| --- | ---: |
| player1@rummyhome.test | 123456 |
| player2@rummyhome.test | 123456 |
| player3@rummyhome.test | 123456 |

Use any of these on the login screen in Expo Go.

To make an admin account, create/sign in as a user, then in Supabase SQL Editor run:

```sql
update public.profiles
set role = 'app_admin'
where email = 'player1@rummyhome.test';
```

## If You See "Network Error"

That usually means the phone could not reach Supabase. Check:

1. Phone has internet access.
2. Supabase project is not paused.
3. Restart Expo after changing `.env.local`:
   ```bash
   cd rummy-home3
   npm start
   ```
4. Reload the app in Expo Go after Metro restarts.

The app now loads URL polyfills and stores the Supabase session in AsyncStorage, which fixes common React Native auth issues.

## What I Can Automate Vs What Needs Your Phone

| Layer | Automated here? | How |
| --- | --- | --- |
| Scoring rules | Yes | `npm test` |
| TypeScript | Yes | `npm run typecheck` |
| Supabase signup/login API | Yes | `npm run test:smoke` |
| List/seed database users | Yes | `npm run db:list-users`, `npm run db:seed-test-users` |
| Expo UI on your phone | No | Requires Expo Go on a real device/simulator |
| Full game flow on device | Partially | Manual smoke checklist in `docs/release-checklist.md` |

I cannot run Expo Go on your phone from here. The reliable overnight automation is:

```bash
cd rummy-home3
npm run test:nightly
```

That runs env validation, typecheck, unit tests, and Supabase auth smoke tests.

## Manual Phone Smoke Checklist

After automated tests pass:

1. Register a new account with a fresh email and passcode `123456`.
2. Sign out and sign back in with the same credentials.
3. Create a stake game with at least two players.
4. Add a balanced round.
5. Undo the round.
6. Complete the game and verify history.

## Overnight Test Loop

To rerun automated checks every 30 minutes locally:

```powershell
while ($true) {
  npm run test:nightly --prefix rummy-home3
  Start-Sleep -Seconds 1800
}
```

Stop with `Ctrl+C`.

For full device UI automation later, consider [Maestro](https://maestro.mobile.dev/) or Detox. That is a separate setup step and is not wired up yet.
