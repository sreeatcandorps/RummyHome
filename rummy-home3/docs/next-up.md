# Next up — the one list

The ordered list of what is being built next, kept by the agent at the end of **every** turn (rule:
`.cursor/rules/next-up.mdc`). Sree reads this, not the board, to know what is in flight and what comes
after. Rule of the list: **the agent never stops** — when an item lands, the top item below it starts
(mockup first for anything with a screen; "show, then build"), and the turn's last line says which one.

How it relates to the rest:

- **Board** ([projects/1](https://github.com/users/sreeatcandorps/projects/1)) — *state*: Spec · Waiting on Sree · Building · Ready to test · Done. Fills itself from PRs and issues (`ci/board/`). It does not say *order*; this file does.
- **`decisions.md`** — *what was decided and why* (D-numbers), and the open questions (Q-numbers). This file points at them; it does not repeat them.
- **Build Bot** — merges, live migrations, EAS builds, Play uploads: each on Sree's explicit yes. Items below marked **Sree** wait on that yes; everything else the agent does on its own.

Last updated: 2026-11-21 02:20 UTC (agent), after #107 / #108 merged (`afa9c83`), APK v17 built, AAB 15 in Play review.

## In flight

| # | Item | Where | Waiting on |
| --- | --- | --- | --- |
| 1 | **New game halo made the screen never idle** — every CI tap on New game took 60–100 s; nightly Pixel 7 Pro / 4a / tablet timeouts (#88 #103 #106). Three breaths, native thread, out of the a11y tree. | PR #109 | CI, then **Sree**: merge |
| 2 | **Google Play review** of AAB 15 (internal testing). | Play Console | Google; **Sree**: Q7 trader status |
| 2a | **Design review 2** — B01–B20 inconsistencies (settings pills, six input styles, yellow meaning five things…), S / M / L sizes, recommend S now. Document only, as asked. | PR #111 | **Sree**: read, pick a size (Q11), send the competitor screens |
| 2b | **iPhone plan** — eight steps, who does each, the timeline is Apple's three waits; `app.json` iOS block. | PR #112 | **Sree**: enrol in the Apple Developer Program (the long pole) |
| 2c | **Volume + test environment plan** — what is already load-tested, the two gaps, a free-tier staging project and eight tests V1–V8. Plan only. | PR #110 (`docs/test-environment-plan.md`) | **Sree**: create `ezscore-staging` (2 min), four yes/no in §6 |

## Next, in order

| # | Item | Why this order | Size | Needs from Sree |
| --- | --- | --- | --- | --- |
| 3 | **Republish the live scorecard page** so shared links show Pool and Standings (Q6). The repo has it; live still serves the old page — every shared link today is wrong for a pool game. | A live-user bug, zero code. | tiny | yes to Build Bot |
| 3a | **Volume V1 on 052** — dispatch the pre-release tier once; add ladder cases for pool + awards bundle, `set_round_dealer`, `reorder_seats`, `add_seated_player`; make `volume` nightly. Needs nothing hosted. | The ladder has not run since Nov 12 and six migrations of new RPCs have never been under load. | small | — |
| 3b | **Staging seed generator** (`ci/volume/seed-staging.mjs`) run against the local database in CI, so V6 (phone memory / frames) and V7 (break it with data) can start before any hosted project exists. | The data set is the same one staging will get; writing it first costs Sree nothing. | medium | — |
| 4 | **Nightly red → green** after #109: re-run the Pixel 7 Pro / 4a / tablet smoke; whatever still fails is a real device bug and gets its own PR. | Keeps the test suite trusted; the three issues close themselves. | small | — |
| 5 | **Points "left the table"** (Q9, the Points half of D58): admins mark a seat LEFT / BACK in Players · Admins; the column stays, Add round asks no score, the deal and the open card skip the seat (052's rotation already does). Mockup first. | The only place Pool has a state Points lacks; comes up in every long Points night. | medium (migration) | yes to the spec (Q9) |
| 6 | **Unsaved-players dialog button** (Q3): B "Done · keep the 1 saved". | Tiny, already answered in the question. | tiny | confirm B |
| 7 | **Find in database** help section with its own picture (Q5). | Help gap from the v12 review. | tiny | confirm "one Add players topic" |
| 8 | **Board hygiene**: close the 10 issues that are finished (#26 #27 #28 #30 #31 #42 → merged PRs 10a/10/11/14/15/16; #8 → PR #7; #29 English half → D61 / #108; #34 → in review), and add a `Priority` field so the board can be sorted the same way as this file. | Sree: "I don't see the board being updated" — the Spec column holds finished work. | tiny | Build Bot closes (agent token is read-only) |
| 9 | **Other step-by-step tutorials** (Q10): Pool out / re-entry first, then the Dealer sheet, Add round signs, Results chain, multiplier change. `StepsSheet` is built; each is copy + a loop script. | Sree's "hardest spots" ask; the first one is the one people get wrong at the table. | small each | pick which, or "all, in that order" |
| 10 | **Play listing**: 7" / 10" tablet screenshots from the tablet smoke job; a short promo video is optional. | Optional for a phone-first listing; cheap once the tablet job is green. | tiny | — |
| 11 | **Telugu** (#29's second half): UI strings through an i18n table, Telugu first, English fallback. | Sree's audience; a real reach item, but every screen is touched. | large | yes, and who proofreads Telugu |
| 12 | **WhatsApp / phone OTP for India** (#36): Supabase phone auth (Twilio / MSG91) beside e-mail. | Sign-up friction in India; costs per SMS. | medium | yes + an SMS provider account |
| 13 | **Research docs while Play reviews**: Google Play scorekeeper sweep (#40), Indian Rummy variants (#37), monetization (#41), learning section (#38). Each a one-page doc in `docs/`, no app change. | They shape the listing text and the next quarter; they cost nothing but agent time. | small each | — |
| 14 | **iPhone** (#35): steps 2–8 of `docs/ios/README.md` once Sree is enrolled — link EAS, first build, TestFlight on his iPad, the iOS fix pass + nightly simulator job, submit. | Waits on Apple; the agent's part is not on the critical path. | medium | Apple Developer Program enrolment (step 1) |
| 15 | **Design review 2, size S** (Q11) once Sree picks: pills only on actions, one container per screen, yellow = Pool only, two-button bottom bars, one input style. | Sree: "settings screen … oval shapes for no reason." | medium | pick S / M / L |

## Done recently (last five)

| When | What | PR |
| --- | --- | --- |
| Nov 21 | Order of players tutorial (D61): four steps, forced first time, Show me, Help › Watch how, last-tap toast | #108 |
| Nov 21 | Play listing: ten players sideways + regenerated assets | #107 |
| Nov 20 | Dealer sheet (D60), join at dealer + 1 (D57), the deal skips out seats (D58); 052 live | #105 |
| Nov 20 | Order of players counts down (D56); listing frames seed | #102 |
| Nov 20 | Play listing pack (D55) | #101 |
