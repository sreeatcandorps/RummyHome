# Google Play listing pack — EZ Score: Rummy

Everything to paste into the Play Console for the draft app **Rummy Home** (package `com.mindweavetech.rummyhome`,
developer account **MindWeave Tech / CANDOR PS LLC**, owner `sree@candorps.com`). Written Nov 19 2026 against
app version 1.1.0. Facts about what the app stores come from `public/privacy/index.html`, which is the policy
Play will read. Who does what: **Sree** pastes and submits in the Console (only the account owner can); the agent
keeps this file and the images current. Nothing here is a decision Sree has not made except where marked **Sree decides**.

Images are in `assets/` (made by `make-assets.py` from the CI device gallery; re-run it after a UI change):

| File | Size | Where in the Console |
| --- | --- | --- |
| `assets/icon-512.png` | 512 × 512 PNG | Store listing → App icon |
| `assets/feature-graphic-1024x500.png` | 1024 × 500 PNG | Store listing → Feature graphic |
| `assets/screenshot-1-01.png` … `screenshot-7-19d.png` | 1080 × 1920 (9:16) | Store listing → Phone screenshots (Play wants 2–8 at 16:9 or 9:16; raw Pixel 6 frames are 9:20 and are refused, so each sits on a captioned 9:16 card) |
| `assets/screenshot-8-landscape-20p.png` | 1920 × 1080 (16:9) | Phone screenshots, last (landscape scorecard) |

No 7" / 10" tablet screenshots yet: optional for a phone-first listing; add from the tablet smoke job later.

---

## Store listing

**App name** (≤ 30): `EZ Score: Rummy`

**Short description** (≤ 80):
`Keep rummy scores with friends: points, pool, awards, shared results.`

**Full description** (≤ 4000):

```
EZ Score keeps the score at your rummy table so nobody needs paper.

Start a game, seat the players, tap each round's points, and everyone at the table follows along on their own phone or on a shared live page.

POINTS GAMES
• Every round adds to zero: the winner's plus is everyone else's minus
• Drop, middle drop, full count and rummy on the keypad
• A multiplier for tables that score in tens or hundreds

POOL GAMES
• A limit (101, 201, 251 or your own) and a running total per player
• Who is in, who is out, points left, re-entries
• Awards at the end: winner takes all, by points left, or your own split

RESULTS AND SHARING
• Save one game or a whole evening as a result
• Share a picture of the standings, or a full round-by-round PDF
• A live link so people away from the table can watch the scores

FOR THE TABLE
• Admins run the game; everyone else sees it read-only
• Seat the table and the deal goes round by seat
• The log records every round, undo and change

Free, no ads. EZ Score keeps points only: no money changes hands in the app.
```

**App category**: Apps → **Tools** (not Games: the app does not play rummy, it keeps the score; a Games category would
bring the gaming content rules). **Tags** (optional, up to 5): Score keeper, Card games, Rummy, Scoreboard.

**Contact details** (shown publicly on the listing):
- Email: `support@mindweavetech.com` (the address the privacy policy already names) — **Sree decides** if a Candor PS address should appear instead
- Phone: leave blank (optional)
- Website: `https://ezscore.mindweavetech.com`

**Store listing contact** is separate from the Play Console account owner (`sree@candorps.com`), which stays as is.

---

## The 11 setup tasks (Policy → App content)

### 1. Privacy policy
URL: `https://ezscore.mindweavetech.com/privacy`
(The page exists in the repo at `public/privacy/index.html` and is live; Build Bot republishes `public/` if the
live copy is older than the repo — same action as Q6, the live scorecard page.)

### 2. App access
**All or some functionality is restricted** → add one instruction set:

- Name: `Reviewer sign-in`
- Username / email: *(a test account Build Bot creates on live for the reviewers — e.g. `play-review@mindweavetech.com`; Build Bot fills this in)*
- Password: *(its passcode; Build Bot fills this in — never in this repo)*
- Any other information:
  ```
  Open the app, tap Sign in, enter the email and passcode above. The account is a game admin of a sample
  Points game and a sample Pool game, so every screen is reachable: Home → the game card → scorecard →
  Add round; ⋮ menu → Game settings, Players · Admins, Log; Complete → Awards (pool) → Final scores → Share;
  Results tab → Save result. No payment, no verification code, no second factor. Sign-up for a new account
  needs only an email and a passcode (no SMS).
  ```

### 3. Ads
**No, my app does not contain ads.** (No ad SDK; the privacy policy says so.)

### 4. Content rating (IARC questionnaire)
- Email: `support@mindweavetech.com`
- Category: **Utility, Productivity, Communication, or Other**
- Violence: No. Sexuality: No. Language: No. Controlled substances: No.
- **Gambling**: No — the app does not offer real-money gambling, does not simulate gambling, and has no casino-style content. It records points for a card game played in person; "awards" are a split of points, not money.
- User interaction: **Yes**, users can interact — players share names, initials and scores inside a game they are all in; **no** unrestricted chat, **no** user-generated content shared with strangers (share links are opt-in by the admin).
- Shares location: No. Digital purchases: No. Personal info shared: No (names/initials are shown only to players of the same game).
- Expected result: **Everyone / PEGI 3 / ESRB E**.

### 5. Target audience and content
- Target age group: **18 and over** only (adults keep the score; the app is not designed for or aimed at children — ticking a child age group would bring the Families policy).
- Appeal to children: **No** — no cartoon mascots aimed at children, no child-directed content. (The joker icon is a card-deck joker.)

### 6. Data safety
Answers come straight from the privacy policy. **Does your app collect or share any of the required user data types?** Yes.
- Encrypted in transit: **Yes** (HTTPS to Supabase).
- Way to request deletion: **Yes** — in-app Profile → Account → Delete account, and `https://ezscore.mindweavetech.com/delete-account`.

| Data type | Collected | Shared | Required / optional | Purposes |
| --- | --- | --- | --- | --- |
| Personal info → **Email address** | Yes | No | Required | App functionality, Account management (sign-in; optional game emails) |
| Personal info → **Name** | Yes | No | Required | App functionality (shown on the scorecards of the user's games) |
| Personal info → **Phone number** | Yes | No | Optional (user types it) | Account management (profile; never shown to other players) |
| Personal info → **Address** (postal code only) | Yes | No | Optional | Account management |
| Personal info → **User IDs** (Player ID number) | Yes | No | Required | App functionality (friends add you to a game by it) |
| App activity → **Other user-generated content** (games, rounds, scores, results, settings) | Yes | No | Required | App functionality |
| App info and performance (crash logs, diagnostics) | **No** | — | — | no crash/analytics SDK |
| Device or other IDs | **No** | — | — | the policy says none |
| Location, Contacts, Photos, Files, Messages, Audio, Health, Financial, Web browsing, Calendar, App installs | **No** | — | — | — |

- Is the data processed ephemerally? No.
- Third parties: **Supabase** (hosting, ca-central-1) and **Resend** (email delivery) act as processors, not as parties the data is "shared" with under Play's definition (service providers processing on our behalf). Data is **not sold**.
- Data collection is **not** for advertising, analytics, fraud prevention or personalisation.

### 7. Government apps
**No**, not developed by or on behalf of a government.

### 8. Financial features
**My app doesn't provide any financial features.** (No payments, loans, banking, crypto, money transfer. The app keeps points only.)

### 9. Health
**My app does not have any health features.**

### 10. News apps
**No**, the app is not a news app.

### 11. App category and contact details / Store listing
See **Store listing** above (category Tools; contact email, website; no phone).

### Also pending in the Console
- **Trader status declaration** (EU consumer law): **Sree decides**. Guidance: the app is free, has no purchases and earns nothing, so "I am not a trader" is defensible; choosing "trader" requires publishing a business address and phone to EU users. Recommendation: **not a trader**, revisit if the app ever charges.
- **Advertising ID** declaration (Android 13+ target): **No**, the app does not use the advertising ID (no ad or analytics SDK).

---

## Release

**Track**: Internal testing first (up to 100 testers, no review), then Production. An organization account has no
12-tester / 14-day wait, but a new app's first production review can take up to 7 days.

**Bundle**: Play accepts only an Android App Bundle. Build Bot: `eas build --platform android --profile production`
from merged `main` (profile in `eas.json`: `autoIncrement` versionCode, production channel; Play App Signing holds
the app key and EAS the upload key). The `preview` profile makes the sideload APK (v12) and is not for Play.
The **first** upload must be by hand in the Console (Sree, or a Console service account for Build Bot); `eas submit`
works from the second bundle on.

**Release name**: `1.1.0 (first Play release)`

**Release notes** (en-US, ≤ 500):
```
First release on Google Play.
• Points and pool rummy scorekeeping, round by round
• Live scorecard link for the table
• Awards for pool games; results across games as a picture or PDF
• Order of players, game log, undo
```

**Countries**: all (free app). **Sree decides** if it should be US + India only to start.

---

## Order of work (Sree ↔ us)

1. Sree: paste Store listing (text + the 10 images) and the 11 task answers above; submit the content rating; answer Trader status. 
2. Sree: "merge 100" → Build Bot applies 051 on his yes → Sree: "build" → Build Bot cuts the production **AAB** from `main`.
3. Sree uploads the AAB to **Internal testing**, adds himself as a tester, installs from Play.
4. Build Bot creates the reviewer account on live and fills in App access.
5. Sree promotes to **Production** → review (up to 7 days) → Publish.
