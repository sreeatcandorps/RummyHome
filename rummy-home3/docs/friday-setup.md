# Friday setup (APK)

Do this before the game on Friday. The app code is not enough on its own: Supabase has to accept the new tables, and the reset email has to stop using localhost.

## 1. SQL, in this order

In the Supabase SQL editor for project `gngcrplcldfiubvhcdin`, run the whole file each time.

1. `supabase/migrations/005_demo_data.sql` — only if you still want Load demo data. It is not required for sharing or prizes. Skip it if you already applied it.
2. `supabase/migrations/006_friday_game_night.sql` — required. This is who can see a game, the public scorecard token, and prize sessions.
3. `supabase/migrations/007_redesign.sql` — required for my players, unseated admins, and editing a payment. Run it after 006. Do not skip 006.

Until `006` is applied:

- A scorekeeper who is not sitting in the game cannot save rounds.
- Share / View says to run that file.
- Prize distribution says the same.

## 2. Passcode reset (localhost:3000)

The app already asks Supabase to send people to:

`https://sreeatcandorps.github.io/Games/`

Supabase only honors that when it is allow-listed. If it is not, the email uses the Site URL, which is `http://localhost:3000` today.

In the dashboard: **Authentication → URL Configuration**

- Site URL: `https://sreeatcandorps.github.io/Games/`
- Redirect URLs: add that same URL, and `rummy-home3://**`
- Remove `http://localhost:3000` if it is the Site URL.

Save. Send yourself a new reset email and confirm the link is no longer localhost. The page at that GitHub Pages address is `public/index.html` in the Games site (set a new 6-digit passcode there).

Optional override in EAS / `.env.local`: `EXPO_PUBLIC_AUTH_REDIRECT_URL`.

## 3. Public scorecard

The copy-link URL is:

`https://sreeatcandorps.github.io/Games/scorecard.html?t=TOKEN`

Deploy it once (Supabase CLI, logged in):

```bash
supabase functions deploy scorecard --project-ref gngcrplcldfiubvhcdin
```

No extra key. The function reads the database with the project service role, which never goes in the app. The page reloads every 8 seconds and shows the start time and game ID.

Until that deploy, Copy link still copies the URL, but it will 404. A backup page is `web/scorecard.html` (host it anywhere and pass the anon key as `?k=`). You can point the app at it with `EXPO_PUBLIC_SCORECARD_URL`.

## 4. Email (optional)

Copy link works with no email account. Welcome email and “Email” on the share sheet call the `send-email` function.

```bash
supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="Rummy Home <scores@mindweavetech.com>" --project-ref gngcrplcldfiubvhcdin
supabase functions deploy send-email --project-ref gngcrplcldfiubvhcdin
```

`RESEND_FROM` must be a sender Resend has verified. `onboarding@resend.dev` only delivers to the Resend account’s own inbox, so it is not enough for the table.

Supabase’s own “Confirm signup” template is a different switch (Authentication → Providers → Email → Confirm email). Leave that off for Friday so people can sign in immediately. The welcome note above does not block sign-in.

## 5. New APK

An APK built before this commit does not contain these screens. Build a new preview APK after the SQL is applied:

```bash
npx eas-cli build -p android --profile preview
```

This machine is not logged into the Expo account, so that build needs `eas login` or `EXPO_TOKEN`.
