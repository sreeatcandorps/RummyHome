# Play Store launch (first listing) — what it takes

Research Nov 19 2026 (Play Console Help, checked that day). `play-store-setup.md` has the EAS commands; this
is the path from "APK on a phone" to "on Google Play", split by who can do each step.

## The one thing that sets the timeline

| Account type | Needs | Gate before Production |
| --- | --- | --- |
| **Personal** (a person's Google account) | US$25 once, government ID, a phone with the Play Console app for device verification | **Closed test with 12 testers opted in for 14 continuous days**, then "Apply for production" (review ≤ ~7 days). Rule for personal accounts created after Nov 13 2023. |
| **Organization** (Mindweave Tech) | US$25 once, **D-U-N-S number** (free from Dun & Bradstreet, can take up to 30 days), government ID, an official organization document | None — Production is open at once. |

Either way the first public day is roughly three weeks out. The difference: with a personal account the
friends test on Play from day one (internal / closed tracks need no approval); with an organization
account nothing moves until D-U-N-S arrives. **Recommendation: personal account now; the closed test
is the "last 14 days with friends" anyway.** If Mindweave Tech already has a D-U-N-S number, the
organization route is the faster one.

Already on Google Play, a personal account's name shows as the developer; it can be changed.

## Only Sree can do

1. Create the Play Console developer account (choose the email; "three at ganderbs dot com" is unconfirmed), pay US$25, verify identity, verify a device in the Play Console app.
2. Create the app (name **EZ Score: Rummy**, default language English (US), app, free), accept the declarations.
3. Upload the first AAB by hand (Play requires the first upload in the Console; EAS Submit works from the second on) — Build Bot cuts it, Sree uploads, or Sree gives Build Bot Console access.
4. Add testers' emails (or a Google Group) to the closed test and send them the opt-in link; keep 12+ opted in for 14 days.
5. Answer the "Apply for production" questions after the 14 days (what the testers said, what changed, audience, expected installs).
6. Press Publish.

## Build Bot / agent can prepare (in the repo, PR, needs Sree's yes to merge)

- **Production AAB**: `eas build --platform android --profile production` (profile exists; `autoIncrement` gives the versionCode, Play App Signing holds the key; EAS keeps the upload key). Expo SDK 54 targets API 36 — meets the Aug 31 2026 Android 16 rule.
- **Store listing text**: title (≤ 30), short description (≤ 80), full description (≤ 4000) — drafts below.
- **Graphics**: icon 512 × 512 (from `assets/icon.png`), feature graphic 1024 × 500 (to draw), 4–8 phone screenshots 9:16 from the CI device gallery (Home, scorecard, Add round, Awards, Results, Final scores), optional 7" / 10" tablet frames from the tablet smoke job.
- **App content answers**: privacy policy URL `https://ezscore.mindweavetech.com/privacy` (page exists); account deletion URL `https://ezscore.mindweavetech.com/delete-account` (page exists; in-app Delete account exists); **App access**: the app needs a sign-in, so Play reviewers get a test account (email + passcode) — to create on live for them; ads: none; content rating (IARC questionnaire): a scorekeeper, no gambling, no user-to-user content except names and scores among players who know each other; target audience 18+ (not designed for children); **Data safety**: collects email, name, phone (optional), user IDs, app activity (scores) — stored by Supabase, encrypted in transit, deletable by the user, not shared, not sold; news / government / financial / health: no.
- **Release notes** for 1.1.0 (what's new).
- **A check that the name and listing avoid "gambling" words**: the app keeps points, no money (D25 "no stake anywhere the user reads"); the listing says so plainly ("a scorekeeper for your rummy table").

## Draft listing (for Sree to edit)

- **Title**: EZ Score: Rummy
- **Short**: Keep rummy scores with friends: points, pool, awards, shared results.
- **Full** (draft): EZ Score keeps the score at your rummy table so nobody needs paper. Start a game, seat the players, tap each round's points, and everyone at the table can follow along on their own phone or on a shared live page. Points games total up round by round; pool games track who is in, who is out, and re-entries, and hand out the awards at the end. Save a result across one or more games and share it as a picture or a full PDF. Admins run the game; everyone else sees it read-only. Free, no ads, no money changes hands in the app.

## Order of work once Sree says go

1. Sree: account + app created (day 0). 2. Build Bot: production AAB; Sree uploads to Internal testing, installs from Play the same day. 3. Agent PR: listing pack (text, graphics, screenshots, answers) — Sree pastes it in. 4. Closed test with 12+ friends for 14 days (the v13 fixes from `v12-feedback.md` ride as updates on that track). 5. Apply for production; publish.
