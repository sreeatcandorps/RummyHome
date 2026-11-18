# Coverage: screens → flows, warnings → flows (PR 16 test plan, part 2)

Rule: every route and every warning / dialog / toast in the app appears in at least one flow of [`flows.md`](flows.md).
Gaps are listed as `—` and each has a flow assigned here, so the gap column is zero after the build. A unit test
(T16-1) will keep both tables true: it reads `app/**/*.tsx` for routes and `Dialog.Title` / `NoticeDialog` / `Alert.alert` /
`Snackbar` strings and fails when one is missing from this file.

## 1. Screens → flows

| Route (`app/`) | Screen | Flows | Automated today | Gap |
| --- | --- | --- | --- | --- |
| `(auth)/login` | Login | F01 | `smoke/01`, `full/10` | |
| `(auth)/register` | Register | F01 | U only | **N** `full/11-register.yaml` |
| `(auth)/forgot-password` | Forgot passcode | F01 | U, D (021) | **N** `full/11` |
| `claim` | Claim a player (deep link) | F02 | D (025) | **N** `full/33` |
| `index`, `(tabs)/index` | Home | F03 | `smoke/01`, `full/60` | |
| `(tabs)/players` | My players | F15 | `smoke/08` | |
| `(tabs)/me` | Me | F16 | `smoke/07` | |
| `(screens)/profile` | Profile | F16 | `smoke/07` | |
| `(screens)/settings` | User settings | F16 | `smoke/07` | |
| `(screens)/hidden-deleted` | Hidden & deleted | F18 | — | **N** `full/34` |
| `(screens)/games/new` | New game · Players and Game type | F04, F05 | `smoke/09`, `smoke/16` | |
| `(screens)/games/[id]` | Scorecard (Points, Pool) | F06, F08, F09 | `smoke/02`, `03`, `10`, `11`, `13`, `16`, `full/20`, `21` | |
| `(screens)/score-entry` | Add round | F07, F08 | `smoke/04`, `14`, `16`, `full/80` | |
| `(screens)/games/players` | Players / Admins | F10 | `full/30`, `31`, `32` | |
| `(screens)/players/add` | Add players to this game | F10 | `full/32` | |
| `(screens)/games/log` | Log | F11 | `full/70` | |
| `(screens)/games/complete` | Complete game | F12, F13 | `smoke/05`, `16` | |
| `(screens)/games/award` | Awards | F13 | `smoke/16` | |
| `(screens)/games/final-scores` | Final scores | F12 | `smoke/05` (button), U | **N** `full/41` extend: open page, both share buttons |
| `(screens)/games/history` | Game history (older scorecard list) | F06 | — | confirm route still reachable; if not, delete it (Q16.9) |
| `(screens)/results/index` | Results picker | F14 | `smoke/06`, `12`, `15` | |
| `(screens)/results/view` | Show results (unsaved) | F14 | `smoke/06` | |
| `(screens)/results/[id]` | Saved result | F14 | `smoke/12`, `15`, `full/40`, `41` | |
| `(screens)/settle/index` | Settle (behind `settleEnabled`, off) | — | — | flagged off; test only if the flag comes back (Q16.9) |
| `(screens)/sessions/[id]` | Session (behind `settleEnabled`, off) | — | — | same (Q16.9) |
| `(screens)/players/index`, `players/new` | Players list / New player (legacy) | F15 | — | same (Q16.9) |
| `(screens)/players/[id]` | Player detail | F02, F15 | — | **N** `full/33` |
| `(screens)/players/[id]/edit` | Edit player | F15 | — | **N** `full/33` |
| `web/scorecard.html`, `/r/` result page | Public pages | F19 | D, U, volume screenshots | **N** Playwright `web/*.spec.ts` |

Screens: 30 routes; 25 in a flow today, 5 legacy routes to confirm or delete (Q16.9) — they are counted as gaps until then.

## 2. Warnings, dialogs, toasts → flows

| Code | Kind | Text (title) | Where | Flows | Automated today |
| --- | --- | --- | --- | --- | --- |
| W01 | dialog | Help | every `?` | F17 | `full/50` |
| W02 | dialog | Add a co-admin? (`CO_ADMIN_NUDGE_TITLE`) | Game type → Start | F05 | — → `smoke/09` extend |
| W03 | dialog / inline | Initials for {name}; Fix initials; Unsaved letters | Register, Add new players | F01, F04 | `smoke/09` |
| W04 | dialog | Complete this game? / Complete this pool? | Complete | F12, F13 | `smoke/05`, `16` |
| W05 | dialog | Could not complete | Complete | F12 | U (message) → chaos C16-4 |
| W06 | dialog | Result saved | Show results | F14 | `full/40` |
| W07 | dialog | Not all given out | Awards | F13 | `smoke/16` |
| W08 | dialog | Could not save awards | Awards | F13 | chaos C16-4 |
| W09 | dialog | Remove {seat}? / Remove from game / Something went wrong | Players/Admins | F10 | `full/30` |
| W10 | dialog | Can't remove this player | Players/Admins | F10 | `full/30` |
| W11 | dialog | Edit which round? | Scorecard ⋮ | F09 | — → `full/35-edit-round.yaml` |
| W12 | dialog | Remove the last round? | Scorecard Undo | F09 | `smoke/13` |
| W13 | dialog | Delete game (`DELETE_GAME_TITLE`) | Scorecard ⋮ | F18 | — → `full/34` |
| W14 | dialog | Reopen this game? | Completed scorecard | F18 | — → `full/34` |
| W15 | dialog | Something went wrong | Scorecard | F06 | chaos C16-4 |
| W16 | dialog | Over the Full count / Are you sure? (pool) | Add round | F07, F08 | `full/80`, `smoke/16` |
| W17 | sheet | Round saved (pool: who is out) | Add round pool | F08 | `smoke/16` |
| W18 | dialog | Rummy share is not a win | Add round | F07 | `smoke/14` |
| W19 | notice | Round already saved / Could not save round | Add round | F07 | D, C → device C16-3 |
| W20 | dialog | Not an admin | Results picker | F14 | `smoke/06` |
| W21 | dialog | Give awards first (`GIVE_AWARDS_FIRST`) | Results picker | F13, F14 | `smoke/16` |
| W22 | dialog | Deselect games? | Results picker chips | F14 | — → `smoke/06` extend |
| W23 | dialog | Delete shared result confirm (`SHARED_CONFIRM_TITLE`) | Saved result | F14 | `smoke/15` |
| W24 | dialog | Non-playing admin by Player ID (`NON_PLAYING_ADMIN_BUTTON`) | Add players | F10 | `full/32` |
| W25 | dialog | Link to Player ID; Link request sent; Invite to register; Edit name; Change passcode; Delete account; Join requests; One quick check | Player detail, Profile, claim | F02, F10, F15, F16 | U, D → `full/33`, `smoke/07` (passcode) |
| W26 | toast / alert | Link copied; Could not share; Removed + Undo; Result deleted + Undo; Restored; Couldn't save; Couldn't log out; Demo data loaded / cleared / failed | Scorecard, Results, My players, Me | F12, F14, F15, F16 | `smoke/08`, `12`, `15` partly; alerts → replace per PR 15 A09 |
| W27 | notice | No game selected; Game not found; View only; Could not load game; Could not re-enter | Scorecard, Add round | F06, F08 | D (RLS) → device role runs R16 |
| W28 | inline | half / Full count line; over-max once per cell; Balance pill red; red non-zero total | Add round | F07 | `full/80`, U |
| W29 | notice | GRD01 guardrails: 20 seats, 100 new players/day, 500 rounds, 10 live games, 50 games/day, 1,000 roster, 20 pending links, 30 games per result | many | F02, F04, F05, F07, F14, F15 | D (029), volume 16 → device V16-5 |
| W30 | inline | wrong passcode; locked; no network; duplicate email | Login, Register | F01 | `full/10`, U |
| W31 | banner | cached scorecard / list; save failed, retry | Home, Scorecard, Add round | F03, F06, F07 | U (degrade) → `full/62-offline` |
| W32 | inline | game already in a result (closed reuse) | Results picker | F14 | `full/40` |
| W33 | dialog | Round n was just saved by {name}; The scorecard changed, refreshed | Add round, Undo | F07, F09 | D, C → device C16-3 |
| W34 | inline | Game settings · locked (PT423) | Game type, Scorecard strip | F05, F06, F08 | D (041) → `smoke/16` extend |
| W35 | sheet / inline | OUT; Re-entry eligible; blue re-entered | Pool scorecard | F06, F08 | `smoke/16` |
| W36 | inline | Deleted · Restore (30 days) | Past results, Hidden & deleted | F14, F18 | `smoke/15`, `full/40` |
| W37 | inline | Save disabled: a player has no score / total not 0 | Add round | F07, F08 | U, `smoke/04` |
| W38 | web | edited notice; older versions | `/r/` result | F11, F14, F19 | D (034) → Playwright |

38 warning codes; 38 mapped to a flow; 11 have no device-level automation today and each names the flow file or chaos /
role run that will cover it.
