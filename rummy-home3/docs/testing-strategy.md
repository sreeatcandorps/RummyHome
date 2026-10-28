# Testing strategy

Friday’s build is a scorekeeper shared by several accounts. Tests are layered so a scoring bug and a “wrong person can see this game” bug are caught in different places.

## Unit

`npm test` runs `tests/*.test.ts` with no network.

| Area | File | What it locks |
| --- | --- | --- |
| Round math | `tests/scoring.test.ts`, `tests/rummy-distribution.test.ts` | Drops, counts, winners, round sums to 0 |
| Initials | `tests/player-initials.test.ts` | Player 1 / Player 10 stay distinct; colliding names grow a letter before a number |
| Who sees a game | `tests/friday.test.ts` | Creator, seated player, spectator, same email, outsider |
| Who can score | `tests/friday.test.ts` | Creator and game admin yes; player and spectator no |
| Share token | `tests/friday.test.ts` | 48-hex token, link is not localhost |
| Prize coins | `tests/friday.test.ts` | Stake uses points; pool prize splits to 0; entries must net to 0; session settles at all zeros |
| Auth copy | `tests/auth-errors.test.ts`, `tests/friday.test.ts` | Duplicate email tells the person to sign in; reset URL is not localhost |

## Integration (Supabase / RLS)

`npm run test:rls` (`scripts/friday-rls.mjs`).

It signs up five real throwaway accounts on the project in `.env.local`: admin, co-admin, player, viewer, outsider. Then:

- The creator, a seated player, and a view-only person can list the game. The outsider cannot.
- A normal player cannot insert a round. After they are promoted, a game admin can.
- The anon key can read the scorecard with the game’s token and cannot read it with a random token.

The script skips (exit 0) when Supabase env vars are missing. It fails with a pointer at `006_friday_game_night.sql` if that migration is not applied. It also needs email confirmation turned off, or the new users never get a session.

`npm run test:smoke`, `test:game-flow`, and `test:nightly` are the older live checks (login, create game, add a round). Run those after `test:rls` when the keys are available.

## Role matrix

| Person | Sees the game | Enters / undoes scores | Makes someone an admin | Opens the public link |
| --- | --- | --- | --- | --- |
| Creator (even if not playing) | Yes | Yes | Yes | Yes |
| Game admin | Yes | Yes | Yes | Yes |
| Player | Yes | No | No | Yes, view only |
| View-only (spectator) | Yes | No | No | Yes, view only |
| Outsider | No | No | No | Only if someone sends them the unguessable link |
| Signed out | No | No | No | The public link only |

The public link is the exception on purpose: anyone who has the token can watch. The token is 48 hex characters. It is not the 6-character game ID.

## End to end / smoke (manual)

On two phones, or one phone and a second account:

1. Create two accounts. Confirm both can sign in with the 6-digit passcode (eye toggle shows the digits).
2. Account A starts a game, turns off “I’m playing”, and adds account B.
3. Account B signs in and sees the game under Home and History without creating it.
4. Account B cannot add a round. Account A can.
5. Account A opens Players and makes B a game admin. B can then add a round.
6. Account A adds a third person as view-only. That person sees the game and cannot score.
7. Share → Copy link. Open it in a browser. Start time and game ID are visible. Add a round on the phone and refresh; the page updates within about 8 seconds.
8. Complete the game. Stake shows points as coins and lets you edit them. Pool asks for a prize.
9. History → Prize distribution. Pick the completed game. Add an entry that adds to 0. When every balance is 0, the session says Settled.

## Regression

After any scoring or schema change:

- `npm test`
- `npm run typecheck`
- One stake round and one pool round on a real account (expense on and off)
- Undo the last round and confirm the public page drops it
- Sign out and back in; the game is still listed for every person who was in it

## Friday checklist

- [ ] `006_friday_game_night.sql` has been run on `gngcrplcldfiubvhcdin`
- [ ] Site URL is `https://sreeatcandorps.github.io/Games/`, not localhost
- [ ] A fresh reset email opens that page
- [ ] `scorecard` function is deployed (open a copied link on wifi, not only in the app)
- [ ] New preview APK is the one installed (older APKs do not have Share or prize sessions)
- [ ] Two accounts: the second sees a game the first created
- [ ] Only a game admin can add a round
- [ ] Copy link works even if email is not configured
- [ ] Phones are charged, and the table has the game ID written down in case someone is late
