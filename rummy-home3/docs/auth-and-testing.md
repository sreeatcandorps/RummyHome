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
| player1@rummyhome.com | 123456 |
| player2@rummyhome.com | 123456 |
| player3@rummyhome.com | 123456 |

Use any of these on the login screen in Expo Go.

To make an admin account, create/sign in as a user, then in Supabase SQL Editor run:

```sql
update public.profiles
set role = 'app_admin'
where email = 'player1@rummyhome.com';
```

## Automated Coverage

```bash
cd rummy-home3
npm run test:nightly
```

Runs:

1. Env validation
2. TypeScript check
3. Unit tests (scoring + auth errors)
4. Auth smoke (`test:smoke`)
5. Game-flow smoke (`test:game-flow`) — create users, create game, add round, undo, complete, history

## Phone Checklist After Automation

1. Reload Expo Go so dashboard shows **New Game** for every signed-in user.
2. Register a second account (or sign in as `player2@rummyhome.com` / `123456` after seeding).
3. From the first account, create a stake game with both players.
4. Confirm the share code appears on the game screen.
5. Add a balanced round, undo, complete, and check Game History.

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
| Game create / round / undo / complete | Yes | `npm run test:game-flow` |
| List/seed database users | Yes | `npm run db:list-users`, `npm run db:seed-test-users` |
| Expo UI on your phone | No | Requires Expo Go on a real device/simulator |
| Full game flow on device | Partially | Manual smoke checklist below |

I cannot run Expo Go on your phone from here. The reliable overnight automation is:

```bash
cd rummy-home3
npm run test:nightly
```

That runs env validation, typecheck, unit tests, auth smoke, and game-flow smoke.

## Overnight Test Loop

To rerun automated checks every 30 minutes locally:

```powershell
while ($true) {
  npm run test:nightly --prefix rummy-home3
  Start-Sleep -Seconds 1800
}
```

Stop with `Ctrl+C`.

Device UI automation runs in CI with [Maestro](https://maestro.mobile.dev/) on an Android emulator (`rummy-home3/e2e/`, jobs `ui-smoke` and `ui-full`); see `docs/testing-strategy.md`.


## Passcode recovery (build 5): emailed code, no browser page

Both entry points are in the app:

- Signed out → **Forgot passcode** → email → Supabase sends the recovery email → the person types the **6-digit code** from that email plus a new 6-digit passcode (twice) → the app calls `verifyOtp({ type: 'recovery' })` then `updateUser({ password })`, signs out, and returns to Sign in with the email pre-filled. They prove the new passcode by signing in.
- Signed in → Profile → **Change passcode** → current passcode, new passcode twice → the app re-checks the current passcode with `signInWithPassword`, then `updateUser({ password })`. No email. If the project has **Secure password change** on, Supabase asks for a fresh check: the dialog then asks for the emailed code (`reauthenticate()` + `updateUser({ password, nonce })`).

Nothing is changed until the code is accepted *and* both new entries match; wrong length, letters, mismatch and a wrong current passcode all stop before any server write. A failed save after a verified code keeps the recovery session, so the person can retry without a new code. Flow logic is in `utils/passcodeFlow.ts` and is unit-tested against a fake client.

### Supabase dashboard settings this depends on (not changed by code)

1. **Authentication → Email Templates → Reset Password**: the body must include `{{ .Token }}`. Default templates only have `{{ .ConfirmationURL }}`, so the person never sees a code. Paste `supabase/templates/recovery-passcode.html` (app-only: OTP, no browser link). Subject: "Your EZ Score: Rummy OTP". Set Email OTP length 6 and expiry 900 s to match the app copy ("expires in 15 minutes").
2. **Authentication → Providers → Email**: minimum password length 6; **Password requirements** must be "No required characters" (letters-required settings reject a numeric passcode; the app shows "The server is set to require letters").
3. **Email OTP expiration**: default 3600 s is fine; the app copy says "expires soon".
4. **SMTP sender** (for the branded From name "EZ Score: Rummy") is a P2 item; Supabase's built-in sender is rate limited to a few emails an hour and shows "Supabase Auth".
5. **URL Configuration**: the link in the email still points at `EXPO_PUBLIC_AUTH_REDIRECT_URL` (GitHub Pages today). The app no longer needs it; moving it to `https://ezscore.mindweavetech.com/` is the P2 branding step.

### What was and was not tested

- Unit tests (`tests/passcode.test.ts`): validation, every error mapping (never says "password"), happy path, wrong/expired/reused code, mismatch, server failure after verification (passcode untouched, retry without new code), current-passcode check, reauthentication nonce path.
- Web UI run against a local fake of the GoTrue endpoints (`/auth/v1/recover`, `/verify`, `/user`, `/logout`) to exercise the real client on the real screens.
- **Not tested here**: real email delivery from the Supabase project (no project credentials on the build machine) and the native Android keyboard/autofill of the code. Do one real round trip on a test account after updating the template.
