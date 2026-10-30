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
| Pending | Invited with an email that already belongs to a registered player. Waiting for that person's Yes. |
| Registered | Has an account. |
| Deleted before registering | Soft delete by the creator. Past scores stay. |
| Deleted after registering | Account removed. Past scores stay. |
| merged (internal) | The unregistered record was claimed; its seats and scores moved to the account. |

Transitions live in `utils/playerIdentity.ts` (`TRANSITIONS`) and are mirrored by the SQL in
`supabase/migrations/011_player_identity.sql`. To add a status, add it to `PLAYER_STATUSES`,
the label map, the transition table, and the SQL check constraint.

## Email is the identity key
- Lowercased and trimmed everywhere (`normalizeEmail`, and `lower(btrim())` in SQL).
- Unique across accounts. Changing your email is not allowed for now.
- No phone verification, no OTP. Phone and zip are optional at sign-up and never used to text.
- US only for now. A WhatsApp link can be added later as another link `kind` without changing the model.

## Pending records (`player_links`)
One row per creator + unregistered player + email.
- `kind = signup`: the email had no account. When someone signs up and confirms that email,
  the first login shows "Is this you? You played in G3 with Sree". Yes merges; Not me leaves it with the creator.
- `kind = existing`: the email already belongs to a registered player. **Never linked instantly.**
  The creator sees "This email belongs to a registered player. We'll send them a request to join your game."
  The player shows Pending. The registered person sees "<creator> added you to G<n>. Is this you?" with Yes / Not me.
  - Yes: seats and scores move to the account; status Registered.
  - Not me, or no answer in 14 days: back to Unregistered, email cleared, the creator gets a note. Scores stay with the creator.
  - While pending the creator can Change email or Resend (restarts the 14 days).
- The same email under two creators: each creator has their own pending record; all of them merge into the one account.
- **Unlink player**: if a link was wrong, the creator unlinks. The seats in exactly the games that moved go back
  to the original unregistered record (same initials, no email). Scores are never deleted, only re-linked.

## Invites
Register players asks only for an email and has a Share button. The message is:
"Please download the app and register with your email ID and then mention that exact email ID there."
If the `send-email` edge function is deployed with a Resend key, the invite is emailed (kind `player_invite`).
Otherwise the phone's share sheet opens with the same text.

## Settings
- **User settings** (Me > User settings): game type (Points only for now; Pool later), Drop and Middle drop. Every new game copies these.
- **Game settings** (⋮ on New game and on the scorecard): Drop and Middle drop for that game, changeable any time.

## Supabase dashboard steps
1. Run `supabase/migrations/011_player_identity.sql` in the SQL editor (after 010).
2. Authentication > Providers > Email: turn on **Confirm email**.
3. Authentication > URL configuration: make sure the app's redirect URL (see `utils/authRedirect.ts`) is in the allow list.
4. Optional: Authentication > Email templates > Confirm signup: mention "Use this same email your friend added you with".
5. Optional (emailed invites): `supabase secrets set RESEND_API_KEY=... RESEND_FROM="EZ Score <scores@mindweavetech.com>"` and `supabase functions deploy send-email`.
