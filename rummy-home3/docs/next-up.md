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
| 2 | **Google Play review** of AAB 15 (internal testing). | Play Console | Google; **Sree**: Q7 trader status |
| 2a | **Design review 2** — Sree: "Go with Small now, mockups first" (Q11). Mockups of Profile / Settings / Game type / Sign in as grouped lists, light + dark, added to the PR. | PR #111 | **Sree**: yes per screen on the mockups; competitor screens |
| 2b | **iPhone plan** — eight steps; Sree: enrol as **Candor PS** (D62). | PR #112 | **Sree**: the enrolment itself (D-U-N-S for Candor PS) |
| 2e | **Volume V1 on 052** — 20 new ladder rows, 137/137 pass, `volume` job nightly. Rebased on main after #110. | PR #114 | CI green, then Build Bot merges (Sree's yes stands) |
| 2f | **Staging** — Supabase `ezscore-staging` (ca-central-1, 001–052 applied by Build Bot). Next PR: EAS `staging` profile ("EZ Score · Staging", own package suffix) + the seed generator. | new PR | the anon key as an EAS / GitHub secret (Build Bot); **Sree**: "build" for the first staging APK |

## Next, in order

| # | Item | Why this order | Size | Needs from Sree |
| --- | --- | --- | --- | --- |
| 3 | **Republish the live scorecard page** so shared links show Pool and Standings (Q6). #113 is on main, so the page renders; live still serves the old page — every shared link today is wrong for a pool game. | A live-user bug, zero code. | tiny | yes to Build Bot |
| 3b | **Staging PR**: `ci/volume/seed-staging.mjs` (2,000 accounts / 20,000 games / the power user, SCALE for CI), the EAS `staging` profile and app variant; then seed `ezscore-staging` and V2 (the app on staging data) once Sree says build. | The project exists; this is the next thing that needs nothing more from him. | medium | the anon key (Build Bot), then "build" |
| 4 | **Nightly red → green** after #109: re-run the Pixel 7 Pro / 4a / tablet smoke; whatever still fails is a real device bug and gets its own PR. | Keeps the test suite trusted; the three issues close themselves. | small | — |
| 5 | **Points "left the table"** (Q9, the Points half of D58): admins mark a seat LEFT / BACK in Players · Admins; the column stays, Add round asks no score, the deal and the open card skip the seat (052's rotation already does). Mockup first. | The only place Pool has a state Points lacks; comes up in every long Points night. | medium (migration) | yes to the spec (Q9) |
| 6 | **Unsaved-players dialog button** (Q3): B "Done · keep the 1 saved". | Tiny, already answered in the question. | tiny | confirm B |
| 7 | **Find in database** help section with its own picture (Q5). | Help gap from the v12 review. | tiny | confirm "one Add players topic" |
| 8 | **Board hygiene** — done Nov 21: Build Bot closed #8 #26 #27 #28 #30 #31 #42. Still open on purpose: #29 (the Telugu half is not built — item 11) and #34 (in review). Left: a `Priority` field so the board sorts like this file. | The Spec column no longer holds finished work. | tiny | create the `Priority` field (optional) |
| 9 | **Other step-by-step tutorials** (Q10): Pool out / re-entry first, then the Dealer sheet, Add round signs, Results chain, multiplier change. `StepsSheet` is built; each is copy + a loop script. | Sree's "hardest spots" ask; the first one is the one people get wrong at the table. | small each | pick which, or "all, in that order" |
| 10 | **Play listing**: 7" / 10" tablet screenshots from the tablet smoke job; a short promo video is optional. | Optional for a phone-first listing; cheap once the tablet job is green. | tiny | — |
| 11 | **Telugu** (#29's second half): UI strings through an i18n table, Telugu first, English fallback. | Sree's audience; a real reach item, but every screen is touched. | large | yes, and who proofreads Telugu |
| 12 | **WhatsApp / phone OTP for India** (#36): Supabase phone auth (Twilio / MSG91) beside e-mail. | Sign-up friction in India; costs per SMS. | medium | yes + an SMS provider account |
| 13 | **Research docs while Play reviews**: Google Play scorekeeper sweep (#40), Indian Rummy variants (#37), monetization (#41), learning section (#38). Each a one-page doc in `docs/`, no app change. | They shape the listing text and the next quarter; they cost nothing but agent time. | small each | — |
| 14 | **iPhone** (#35): steps 2–8 of `docs/ios/README.md` once Sree is enrolled — link EAS, first build, TestFlight on his iPad, the iOS fix pass + nightly simulator job, submit. | Waits on Apple; the agent's part is not on the critical path. | medium | Apple Developer Program enrolment (step 1) |
| 15 | **Design review 2, size S** — build after Sree's yes on the mockups, one surface per PR with light + dark matrices: `Row` / `SettingsGroup` / `SegmentedChoice` components, then Profile, Settings, Game type, Sign in. | Sree: "Go with Small now, mockups first." | medium | yes per mockup screen |

## Done recently (last five)

| When | What | PR |
| --- | --- | --- |
| Nov 21 | Web scorecard page fixed (TDZ since PR 14) + a test that executes the page script | #113 |
| Nov 21 | New game halo: three breaths, native thread — CI taps 60–100 s → seconds | #109 |
| Nov 21 | `docs/next-up.md` + rule; volume / test-environment plan (Q12) | #110 |
| Nov 21 | Order of players tutorial (D61): four steps, forced first time, Show me, Help › Watch how, last-tap toast | #108 |
| Nov 21 | Play listing: ten players sideways + regenerated assets | #107 |
