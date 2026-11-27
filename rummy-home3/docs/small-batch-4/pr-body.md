# Small batch 4: Find in database help with its own picture (D98), Player ID row number only (D103), sign-in fixes at 360 dp × 1.3 (12i a–c)

## For Sree

- **Decide:** Can this merge once the next staging APK is cut? The sign-in fixes were scheduled for after that APK (D126). Default: Build Bot merges under D80 after the APK, as soon as the phone checks are green and the pictures are filled in.
- **A user will notice:** Profile's Player ID row is just the number. The Add players help shows a picture of Find in database. On a small phone with large text, the code box hint fits on one line, the "Enter the 6-digit code" error goes away once a code is typed, and "Wrong address? Go back" is no longer hidden by the keyboard's suggestion bar.
- **Try it:** the new help picture: https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/assets/help/find-in-database.png · the bugs as they look today: https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/small-27b-error-stays.png
- **Risk:** On Android, the code screen now scrolls about one finger-width higher while the keypad is up. If a phone has no suggestion bar, there is a slightly bigger gap above the keypad. The code box's hint is now normal-size text instead of big spaced letters.
- **After merge:** nothing else waits on Sree. No migration, no build. The help pictures ship with the next APK.

## Status

- Based on: `main` @ `d45e1d95`
- Migration: none
- Unit + tsc: pass, 752 / 752 unit tests, `tsc --noEmit` clean (run locally on this branch); push CI run 46014622297 green (unit + tsc + database)
- Device flows touched: `e2e/smoke/07-profile.yaml` (Player ID row asserted, tap opens no share sheet), `e2e/smoke/27-create-account-code.yaml` (error gone before 27b), `e2e/smoke/31-player-id-search.yaml` (new step: the `?` opens the Find in database section with its picture, frame 31e). No new flow, so no shard change.
- Bug fix proof: `tests/signup-code.test.ts` "12i (a)", "12i (b)", "12i (c)" and `tests/help-pr11.test.ts` "HL11-9 D98" fail on `d45e1d95` and pass here (checked by running them against the parent's source). On a phone: frame 27b of run 45929916883 (main) shows the leftover error; frame 27 of run 45844832254 shows Go back under the "Suggest contact names?" banner (links below). Flow 27 now asserts the error is gone after 27b.
- Decisions touched: D98 and D103 → built. Uses D113 / 053 (help text) and D126 (when the sign-in fixes ship).

## What Sree asked for → what changed

| Sree said (verbatim or as relayed, with date) | Built as | Where |
| --- | --- | --- |
| D98 / Q5, Nov 25: "the final data[base] itself, yes, that's right." (Q5: the *Find in database* section of the Add players topic, scrolled to, with its own picture, rather than a new topic) | The Add players help's *Find in database* section gets its own annotated picture, built by the existing help-picture script from smoke frame 31c ("#5 · Otto O."), cropped to the part of the screen it explains, with a 4-line legend. The text now says what D113 / 053 do: an exact Player ID on the number keypad, then Search; the result is first name + last initial; names, initials and emails are never searched. The `?` on Find in database already opens this section. | `constants/helpTopics.ts`, `components/help/HelpPage.tsx` (`SectionShot`), `assets/help/find-in-database.png`, `scripts/help-callouts.json`, `scripts/help-screenshots.mjs` (`crop`) |
| D103 / Q18, Nov 25: "I don't even think we need a copy button for the player ID. That's usually going to be a small number that can easily be sent across." (Nov 23: "remove the share") | The Player ID row shows "#1" and nothing else. The share icon is gone, tapping does nothing, and there is no copy button. The share code nobody calls any more is deleted. The Me help legend and picture now show today's grouped Profile; the old picture still had a "Share your Player ID" button. | `app/(tabs)/me.tsx`, `utils/invite.ts`, `utils/inviteLink.ts`, `assets/help/me.png`, `constants/helpTopics.ts` |
| next-up 12i (a)–(c), found in the #151 / #153 matrices; D126, Nov 26 puts them after the APK. Sree, Nov 23: keyboard-covering bugs on small phones are what CI has to catch | (a) While the code box is empty, its hint is drawn at 18 instead of 26 bold with letter spacing, so "6-digit code" fits at 360 dp × 1.3; typed digits look the same as before. (b) Typing or pasting a code clears the error. (c) On Android, the card keeps 48 dp of room above the keyboard's reported top, never scrolling the card's top off screen. | `components/ui/OtpField.tsx` (2 lines), `app/(auth)/register.tsx`, `components/ui/AuthShell.tsx` (a constant and one call), `utils/cardScroll.ts` |

## Design review (mandatory for any UI change — `rummy-home3/docs/design-review-checklist.md`)

- [x] 1. Read first: `decisions.md` (D98, D103, D113, D101, D105, D126, D50), `help-design.md`, the 053 migration and flow 31 for the help text
- [x] 2. Both game types traced: none of these screens differs between Points and Pool (Profile, Add players help, Create account code step)
- [x] 3. Navigation: the help section opens from Find in database's `?` and Back returns to the search (flow 31 checks it); the Player ID row now opens nothing, with no chevron, the same as any read-only row
- [x] 4. Edge cases: rounds, players, non-admin, reopened, offline and Result don't apply to these screens. Checked at 360 dp × 1.3 and on the Pixel 6, and in landscape for the code step: when the card is taller than the space above the keypad, its bottom stays in view as before, and the extra room never scrolls its top off screen (unit test)
- [x] 5. Questioned: the brief for (c) said "re-run keepCardInView when the keyboard frame changes". On Android 11+, React Native 0.81 sends `keyboardDidShow` once, when the keypad opens, and no event when it grows (`ReactRootView.checkForKeyboardEvents` fires only when visibility changes). So there is nothing to re-run on. Built instead: room for the strip on Android. iOS already sends `keyboardWillShow` on every height change, so it gets no extra room. For (a), I picked a smaller hint over a shorter one: it still reads "6-digit code" and keeps fitting at larger text sizes than 1.3
- [x] 6. Conflicts: none overturned. #153 edits `OtpField` and `AuthShell` too; the edits here are a few lines each so #153 can rebase. 12i (d) is left to #153
- [x] 7. Show, then build: D98 and D103 were approved Nov 25 (Q5, Q18 pictures). The section picture and the before frames are linked below; the after frames come from this PR's device run

### Screenshot matrix (every UI PR, before it is called done)

None of the three screens changes with rounds or player count, so the 0 / 1 / 5 rounds × 4 / 13 players grid is n/a. The table below shows each screen on the two phones (D45: 360 dp × 1.3 is the `small` emulator).

| | 4 players · portrait | 4 players · landscape | 13 players · portrait | 13 players · landscape |
| --- | --- | --- | --- | --- |
| 0 rounds | n/a: Profile, help and sign-in have no rounds or players | n/a | n/a | n/a |
| 1 round | n/a | n/a | n/a | n/a |
| 5 rounds | n/a | n/a | n/a | n/a |

Base for the links below: `https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/`

| Screen | 360 dp × 1.3, before (main) | Pixel 6, before (main) | After (this PR's device run) |
| --- | --- | --- | --- |
| Profile, Player ID row (frame 07-profile) | [small-07-profile-share-icon.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/small-07-profile-share-icon.png) | [pixel6-07-profile-share-icon.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/pixel6-07-profile-share-icon.png) | waiting for the first PR device run: frames `07-profile` from `small-smoke-a` / `pixel6-smoke-a` |
| Code step, empty hint (27a) | [small-27a-code-hint-wraps.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/small-27a-code-hint-wraps.png) | [pixel6-27a-code-hint.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/pixel6-27a-code-hint.png) | frames `27a` from `small-smoke-b` / `pixel6-smoke-b` |
| Code step, pasted after an empty tap (27b) | [small-27b-error-stays.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/small-27b-error-stays.png) | — | frames `27b` |
| Code step, first keypad (27) | [small-27-go-back-under-banner.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/docs/small-batch-4/before/small-27-go-back-under-banner.png) (run 45844832254) | — | frames `27` |
| Add players help › Find in database (31e, new) | no picture before (text only) | — | frames `31e-help-find-in-database`; the picture itself: [find-in-database.png](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/small-batch-4-eef2/rummy-home3/assets/help/find-in-database.png) |

## Defaults used where Sree did not answer

- Hint fix (12i a): a smaller hint font whenever the box is empty, on every phone, rather than only at large text sizes. One rule is simpler (D50), and the Pixel 6 hint becomes ordinary Material-size text.
- Me help picture: rebuilt with three badges from today's Profile (the old one showed the pre-Size-S Profile with a Share button). The Account line joins legend item 3 because Account sits below the frame.

## Not in this PR

- 12i (d), Set a new passcode by WhatsApp: it belongs to #153.
- The Me help picture is built from main's frame 07-profile, so it still shows the share icon on the Player ID row. After this PR's first device run, rebuild it from the PR's own frame: `gh run download <run> -n ui-cursor-small-batch-4-eef2-pixel6-smoke-a -D /tmp/a && node scripts/help-screenshots.mjs /tmp/a/smoke/screens --only me`.
- The side-by-side before / after pictures (`scripts/compare-frames.py`) also wait for that run.
