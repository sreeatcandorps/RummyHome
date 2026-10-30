# My players, new players and Register players (Round 3)

## Words used in the app
- **My players**: your own list (the people you play with). Shown on the My players tab and the New game picker.
- **Find player in database**: search registered players only (name, player ID, or a full email).
- **Registered player**: has an account with a confirmed email. Anyone in the database is registered.
- **Unregistered player**: added by you with a name or just initials. Lives in your My players.

## Player statuses
| Status | Meaning |
| --- | --- |
| Unregistered | Created by a game creator; has a player ID, no account. |
| Pending | A claim link was shared, or someone asked to claim this player with its player ID. |
| Registered | Has an account. |
| Deleted before registering | Soft delete by the creator. Past scores stay. |
| Deleted after registering | Account removed. Past scores stay. |
| merged (internal) | The unregistered record was claimed; its seats and scores moved to the account. |

Transitions live in `utils/playerIdentity.ts` (`TRANSITIONS`) and are mirrored by the SQL in
`supabase/migrations/011_player_identity.sql`. To add a status, add it to `PLAYER_STATUSES`,
the label map, the transition table, and the SQL check constraint.

## Player IDs
- Every player (registered or not) has `public_player_no`, shown as **#42**.
- A plain number from a sequence, assigned when the player is first saved. Unique, never changed, never reused.
- Existing players were numbered oldest first (by `created_at`) in migration 012.
- The uuid stays the primary key; games and scores point at it.
- **Player IDs are never used to sign in.** Email + 6-digit passcode is the only sign-in.

## Email
- Lowercased and trimmed everywhere (`normalizeEmail`, `lower(btrim())` in SQL). Unique per account. Changing it is not allowed for now.
- Sign-up requires email and Supabase email confirmation. Phone and zip are optional and never used to text.
- No OTP, no phone check. US only for now; a WhatsApp link would be another claim `kind`.

## Claims (`player_links`)
Two ways to claim an unregistered player. Both need a confirmed email. Both set the player to **Pending**.

1. **Claim link** (`kind = link`). In Register players (game ⋮ menu or My players) the creator taps **Share**.
   The server makes a random 256-bit token, stores only its sha-256, and returns it once inside the message:
   "Join me on EZ Score: Rummy! Download the app and sign up using this link to see your scores. Your player ID is #42." + link.
   The native share sheet sends it (WhatsApp, SMS, anything). The link is single use, expires in 14 days,
   can be turned off (revoked), and **Share again** makes a new token and revokes the old one.
   Opening it saves the token on the phone (`/claim?t=` in the app; the web `get` page offers "Open in app").
   After sign-up and email confirmation the app asks "Is this you? You played in G3 with Sree" with Yes / Not me.
   Yes links the scores. Not me leaves the player unregistered and tells the creator.
2. **Player ID at sign-up** (`kind = id_request`). Sign-up has "Enter your player ID if you have one."
   With no link, it creates a request the creator sees on Home and My players: "#42 wants to claim R K. Approve?".
   Only Approve links. Decline keeps the player unregistered. Limited to 5 requests per account per 24 hours.

- Yes / Approve moves seats and scores only for games the account is not already seated in, and records
  `moved_game_ids`. **Unlink player** moves exactly those back to the original unregistered record. Scores are never deleted.
- Two creators holding records for the same person: each record is claimed through its own link or request into
  the same account, so the person ends up as one player.
- Any pending claim older than 14 days expires; the player goes back to Unregistered and the creator gets a note.

## Settings
- **User settings** (Me > User settings): game type (Points only for now; Pool later), Drop and Middle drop. Every new game copies these.
- **Game settings** (⋮ on New game and on the scorecard): Drop and Middle drop for that game, changeable any time.

## Supabase dashboard steps
1. Run `supabase/migrations/011_player_identity.sql`, then `012_player_numbers_and_claim_links.sql`, in the SQL editor (after 010).
2. Authentication > Providers > Email: turn on **Confirm email**.
3. Authentication > URL configuration: make sure the app's redirect URL (see `utils/authRedirect.ts`) is in the allow list.
4. Database > Extensions: pgcrypto must be on (it is by default on Supabase).
5. Android app links: claim links open `https://sreeatcandorps.github.io/Games/get?claim=…`, which offers "Open in app"
   (`rummy-home3://claim?t=…`). Verified Android App Links for that domain are not set up yet.
