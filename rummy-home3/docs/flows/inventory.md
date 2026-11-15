# Screen, pop-up and warning inventory (from code)

Screens **32** (+ 8 redirect-only routes) · Pop-ups **60** · Warnings **40** · Emails **7**. "Tests" = number of test files whose text contains one of the item's signals (see `data/inventory.mjs`).

## Screens

| ID | Screen | File | Route | Flows | Tests |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign in | `app/(auth)/login.tsx` | `/(auth)/login` | F01 F14 | 12 |
| S02 | Create account | `app/(auth)/register.tsx` | `/(auth)/register` | F01 | 4 |
| S03 | Forgot passcode (OTP → new passcode) | `app/(auth)/forgot-password.tsx` | `/(auth)/forgot-password` | F01 | 1 |
| S04 | Home (Live · Recent · bottom bar) | `app/(tabs)/index.tsx` | `/(tabs)` | F01 F02 F03 F12 F13 F14 F16 F17 | 69 |
| S05 | My players | `app/(tabs)/players.tsx` | `/(tabs)/players` | F04 | 38 |
| S06 | Me (profile) | `app/(tabs)/me.tsx` | `/(tabs)/me` | F01 F02 F15 | 26 |
| S07 | User settings (game defaults) | `app/(screens)/settings.tsx` | `/settings` | F02 | 27 |
| S08 | Hidden & deleted | `app/(screens)/hidden-deleted.tsx` | `/hidden-deleted` | F13 | 22 |
| S09 | New game · Game type (Points / Pool, rules, multiplier) | `app/(screens)/games/new.tsx + components/game/GameTypeStep.tsx` | `/games/new (step 2)` | F03 | 27 |
| S10 | New game · Players picker / Add players to this game | `app/(screens)/games/new.tsx` | `/games/new, /games/new?gameId=` | F03 F04 | 38 |
| S11 | Fix initials (before Start) | `components/players/FixInitialsScreen.tsx` | `/games/new (fix step)` | F03 | 16 |
| S12 | Add by initials | `app/(screens)/players/add.tsx` | `/players/add` | F04 | 36 |
| S13 | Find in database | `app/(screens)/players/new.tsx` | `/players/new` | F04 | 24 |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | `/games/[id]` | F03 F05 F06 F07 F08 F09 F10 F11 F12 F13 F14 F16 | 86 |
| S15 | Enter Scores (Add round / Edit round) | `app/(screens)/score-entry.tsx` | `/score-entry` | F06 F07 F09 F14 F16 | 57 |
| S16 | Players · Admins | `app/(screens)/games/players.tsx` | `/games/players` | F12 F16 | 50 |
| S17 | Log (game log) | `app/(screens)/games/log.tsx` | `/games/log` | F05 F07 F08 F13 | 23 |
| S18 | Complete (game / pool) | `app/(screens)/games/complete.tsx` | `/games/complete` | F09 F10 | 23 |
| S19 | Awards (pool) | `app/(screens)/games/award.tsx` | `/games/award` | F10 F16 | 19 |
| S20 | Final scores (single game share) | `app/(screens)/games/final-scores.tsx` | `/games/final-scores` | F08 F10 F11 | 9 |
| S21 | Results · pick games + Past results | `app/(screens)/results/index.tsx` | `/results` | F10 F16 F17 | 37 |
| S22 | Results · view (unsaved) | `app/(screens)/results/view.tsx` | `/results/view` | F17 | 24 |
| S23 | Results · saved result | `app/(screens)/results/[id].tsx` | `/results/[id]` | F08 F11 F17 | 33 |
| S24 | Claim link landing (remembers token → sign up / Home) | `app/claim.tsx` | `/claim?t=` | F04 | 1 |
| S25 | Web · live scorecard page | `public/scorecard.html` | `/scorecard.html?c=CODE` | F06 F11 F15 | 20 |
| S26 | Web · result page | `public/r/index.html` | `/r/<result id>` | F11 F15 | 14 |
| S27 | Web · link request Yes / No | `public/link.html` | `/link.html?t=` | F04 F15 | 5 |
| S28 | Web · unsubscribe | `public/unsubscribe.html` | `/unsubscribe.html?t=` | F15 | 4 |
| S29 | Web · privacy policy | `public/privacy/index.html` | `/privacy` | F11 | 1 |
| S30 | Web · delete account page | `public/delete-account/index.html` | `/delete-account` | F02 | 1 |
| S31 | Web · get the app | `public/get/index.html` | `/get` | F11 | 1 |
| S32 | Web · 404 | `public/404.html` | `*` | F11 | 1 |

### Redirect-only / flagged-off routes (not counted)

| File | Goes to |
| --- | --- |
| `app/index.tsx` | Home or Sign in (splash) |
| `app/(screens)/profile.tsx` | S06 Me |
| `app/(screens)/players/index.tsx` | S05 My players |
| `app/(screens)/players/[id].tsx` | S05 My players |
| `app/(screens)/players/[id]/edit.tsx` | S06 Me |
| `app/(screens)/games/history.tsx` | S04 Home |
| `app/(screens)/sessions/[id].tsx` | S04 Home (settleEnabled off) |
| `app/(screens)/settle/index.tsx` | S04 Home (settleEnabled off) |

## Pop-ups (dialogs, sheets, menus, toasts, modals)

| ID | Pop-up | File | Kind · host screens | Flows | Tests |
| --- | --- | --- | --- | --- | --- |
| P01 | Linked (link complete notice) | `app/(tabs)/index.tsx` | dialog · S04 | F04 | 1 |
| P02 | One quick check (join / claim requests) | `components/players/JoinRequestsDialog.tsx` | dialog · S04 | F04 | 2 |
| P03 | Home toast (Asked · Game restored) | `app/(tabs)/index.tsx` | toast · S04 | F13 | 2 |
| P04 | Me notice (Couldn’t save · Couldn’t log out · Demo data · Account deleted) | `app/(tabs)/me.tsx` | dialog · S06 | F02 | 2 |
| P05 | Initials for {name} (shared editor) | `components/players/InitialsDialog.tsx` | dialog · S05 S06 S12 S13 S16 | F02 F04 | 2 |
| P06 | Change passcode | `components/auth/ChangePasscodeDialog.tsx` | dialog · S06 | F02 | 3 |
| P07 | Delete your account? | `components/account/DeleteAccountDialog.tsx` | dialog · S06 | F02 | 1 |
| P08 | Remove {name} from My players? | `app/(tabs)/players.tsx` | dialog · S05 | F04 | 1 |
| P09 | Invite {name} to register | `components/players/InviteToRegisterDialog.tsx` | dialog · S05 S16 | F12 | 2 |
| P10 | Link {name} to Player ID | `components/players/LinkPlayerDialog.tsx` | dialog · S05 S16 | F04 F12 | 4 |
| P11 | Request sent (link request) | `components/players/LinkRequestSentDialog.tsx` | dialog · S05 S16 | F04 | 1 |
| P12 | Edit name | `components/players/EditNameDialog.tsx` | dialog · S05 S16 | F12 | 4 |
| P13 | Player detail (initials, Close / Remove) | `app/(tabs)/players.tsx` | dialog · S05 | F04 | <span style="color:#c62828">**GAP**</span> |
| P14 | Player ⋮ menu (Invite · Link · Edit initials · Edit name · Admin · Remove) | `components/players/PlayerActionMenu.tsx` | menu · S05 S16 | F12 | 5 |
| P15 | Removed · UNDO (My players) | `app/(tabs)/players.tsx` | toast · S05 | F04 | 4 |
| P16 | Account created | `app/(auth)/register.tsx` | dialog · S02 | F01 | 1 |
| P17 | Country picker (phone code) | `app/(auth)/register.tsx` | menu · S02 | F01 | <span style="color:#c62828">**GAP**</span> |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | `app/(screens)/games/[id].tsx` | menu · S14 | F05 F07 F08 F13 | 15 |
| P19 | Edit which round? | `app/(screens)/games/[id].tsx` | dialog · S14 | F07 | 5 |
| P20 | Remove the last round? (Undo) | `app/(screens)/games/[id].tsx` | dialog · S14 | F07 | 12 |
| P21 | Delete this game? | `app/(screens)/games/[id].tsx` | dialog · S14 | F13 | 4 |
| P22 | Reopen this game? | `app/(screens)/games/[id].tsx` | dialog · S14 | F10 | 1 |
| P23 | Something went wrong (scorecard action error) | `app/(screens)/games/[id].tsx` | dialog · S14 | F13 | 7 |
| P24 | Share sheet (picture · PDF · link) | `components/share/ShareSheet.tsx` | sheet · S14 S20 S23 | F11 | 3 |
| P25 | Seating order sheet | `components/game/SeatingSheet.tsx` | sheet · S14 | F03 F05 | 4 |
| P26 | Game settings (Full count, multiplier, pool rules) | `components/game/GameSettingsDialog.tsx` | dialog · S14 S15 | F08 | 8 |
| P27 | Change the multiplier? / Large multiplier | `components/game/GameSettingsDialog.tsx` | dialog · S14 S15 | F08 | 3 |
| P28 | Exact points (multiplier totals) | `components/game/MultiplierStrip.tsx` | sheet · S14 | F08 | 3 |
| P29 | Link copied (scorecard) | `app/(screens)/games/[id].tsx` | toast · S14 | F11 | <span style="color:#c62828">**GAP**</span> |
| P30 | Help | `components/ui/HelpButton.tsx` | dialog · S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S15 S16 S17 S18 S19 S21 S22 S23 | F16 | 16 |
| P31 | Over the Full count / Are you sure? (pool) | `app/(screens)/score-entry.tsx` | dialog · S15 | F06 F09 | 4 |
| P32 | Round saved (pool: out · eligible · re-enter) | `app/(screens)/score-entry.tsx` | dialog · S15 | F09 | 2 |
| P33 | Rummy share is not a win | `app/(screens)/score-entry.tsx` | dialog · S15 | F06 | 1 |
| P34 | Round notice (Round N already saved · scorecard refreshed · view only) | `app/(screens)/score-entry.tsx` | dialog · S15 | F06 F07 F14 | 8 |
| P35 | Enter Scores ⋮ menu (Game settings · Share live scorecard · Clear / Undo my changes · Help) | `app/(screens)/score-entry.tsx` | menu · S15 | F11 | 2 |
| P36 | Remove {name}? (seat) | `app/(screens)/games/players.tsx` | dialog · S16 | F12 | 7 |
| P37 | Remove from game (blocked: player has a score) | `app/(screens)/games/players.tsx` | dialog · S16 | F12 | 4 |
| P38 | Something went wrong (Players · Admins) | `app/(screens)/games/players.tsx` | dialog · S16 | F12 | 9 |
| P39 | Add non-playing admin (by Player ID) | `app/(screens)/games/players.tsx` | dialog · S16 | F12 | 4 |
| P40 | Complete this game? / Complete this pool? | `app/(screens)/games/complete.tsx` | dialog · S18 | F10 | 3 |
| P41 | Could not complete | `app/(screens)/games/complete.tsx` | dialog · S18 | F10 | 1 |
| P42 | Not all given out (save awards anyway?) | `app/(screens)/games/award.tsx` | dialog · S19 | F10 | 2 |
| P43 | Not for this pool | `app/(screens)/games/award.tsx` | dialog · S19 | F10 | 2 |
| P44 | Could not save awards | `app/(screens)/games/award.tsx` | dialog · S19 | F10 | 3 |
| P45 | Add a co-admin? | `components/game/CoAdminNudge.tsx` | dialog · S09 | F03 | 1 |
| P46 | Can’t remove this player (picker) | `app/(screens)/games/new.tsx` | dialog · S10 | F04 | <span style="color:#c62828">**GAP**</span> |
| P47 | Large multiplier (Game type) | `components/game/GameTypeStep.tsx` | dialog · S09 | F03 | 1 |
| P48 | Unsaved letters | `app/(screens)/players/add.tsx` | dialog · S12 | F04 | 1 |
| P49 | Deselect games? | `app/(screens)/results/index.tsx` | dialog · S21 | F17 | 1 |
| P50 | Give awards first | `app/(screens)/results/index.tsx` | dialog · S21 | F10 F17 | 3 |
| P51 | Not an admin (locked card) | `app/(screens)/results/index.tsx` | dialog · S21 | F17 | 5 |
| P52 | Results toast (Result deleted · UNDO / restored) | `app/(screens)/results/index.tsx` | toast · S21 | F17 | 4 |
| P53 | Result saved (status changes) | `app/(screens)/results/view.tsx` | dialog · S22 | F17 | 5 |
| P54 | Result ⋮ menu (History · Copy link · Delete result) | `app/(screens)/results/[id].tsx` | menu · S23 | F17 | 5 |
| P55 | Delete a shared result? | `app/(screens)/results/[id].tsx` | dialog · S23 | F11 F17 | 2 |
| P56 | Result deleted · UNDO (saved result) | `app/(screens)/results/[id].tsx` | toast · S23 | F17 | 4 |
| P57 | Link copied (result) | `app/(screens)/results/[id].tsx` | toast · S23 | F17 | <span style="color:#c62828">**GAP**</span> |
| P58 | Share results preview (picture) | `components/share/ShareImageDialog.tsx` | modal · S20 S23 | F11 | 2 |
| P59 | Hidden & deleted toast (restored · unhidden) | `app/(screens)/hidden-deleted.tsx` | toast · S08 | F13 | 4 |
| P60 | Initials clash sentence (stored form) | `app/(screens)/players/add.tsx` | dialog · S12 | F04 | 11 |

## Warnings, errors, banners, tags

| ID | Warning | File | Kind · host screens | Flows | Tests |
| --- | --- | --- | --- | --- | --- |
| W01 | Sign-in error (wrong passcode · cannot reach server · locked) | `utils/authErrors.ts` | error · S01 | F01 | 3 |
| W02 | An account with this email already exists | `utils/signUpOutcome.ts` | error · S02 | F01 | 2 |
| W03 | OTP / passcode validation (6 digits, mismatch) | `utils/passcode.ts, utils/passcodeFlow.ts` | error · S03 S06 | F01 F02 | 1 |
| W04 | Deleted games card (read-only, gone for good on …, Ask / Restore) | `components/home/DeletedGamesCard.tsx` | card · S04 | F13 | 4 |
| W05 | Link requests card (Yes / No) | `components/players/LinkRequestsCard.tsx` | card · S04 | F15 | 4 |
| W06 | Claim requests card | `components/players/ClaimRequestsCard.tsx` | card · S04 | F15 | 2 |
| W07 | Empty states (no live games · no players · no results) | `components/ui/EmptyState.tsx` | empty · S04 S05 S21 | F04 | 1 |
| W08 | Game status tag (Active · Completed · Closed · Deleted) | `app/(screens)/games/[id].tsx` | tag · S14 S18 | F10 | 1 |
| W09 | Deleted game banner (Deleted by …, Ask to restore / Restore) | `components/game/DeletedGameBanner.tsx` | banner · S14 | F13 | 2 |
| W10 | Pool over hint (everyone out / limit reached) | `app/(screens)/games/[id].tsx` | inline · S14 | F09 | 1 |
| W11 | Multiplier chip + entered-points banner | `components/game/MultiplierStrip.tsx` | chip · S14 | F08 | 2 |
| W12 | Count warning line (half / Full count) | `app/(screens)/score-entry.tsx` | inline · S15 | F06 | 2 |
| W13 | Balance pill (Save off until 0) | `app/(screens)/score-entry.tsx` | pill · S15 | F06 | 8 |
| W14 | New game problem line (players, Full count, multiplier range) | `components/game/GameTypeStep.tsx, components/game/RulesForm.tsx` | inline · S09 | F03 | 3 |
| W15 | Initials format line / Change the letters to save | `components/players/InitialsDialog.tsx` | inline · S05 S06 S12 S13 S16 | F02 F04 | 3 |
| W16 | Registration tags (Unregistered · Pending registration · Link pending) | `utils/myPlayersList.ts` | tag · S05 S10 S16 | F04 F12 | 15 |
| W17 | Can’t link yet (conflict names each game) | `components/players/LinkPlayerDialog.tsx` | inline · S05 S16 | F04 | 3 |
| W18 | Seating note / error (dealer, order unchanged) | `components/game/SeatingSheet.tsx` | inline · S14 | F05 | 3 |
| W19 | Game settings error / locked note | `components/game/GameSettingsDialog.tsx` | inline · S14 S15 | F08 F09 | 3 |
| W20 | Awards hints (given out · winner warning · blocked) | `app/(screens)/games/award.tsx` | inline · S19 | F10 | 1 |
| W21 | Results picker count + locked (non-admin) cards | `app/(screens)/results/index.tsx` | inline · S21 | F17 | 2 |
| W22 | Not saved yet. This result may change. | `app/(screens)/results/view.tsx` | banner · S22 | F17 | 2 |
| W23 | Result warnings (Active game · already in a previous result) | `components/results/ResultWarnings.tsx` | inline · S22 S23 | F17 | 3 |
| W24 | Changed after sharing · removed / deleted notes · History | `components/results/ResultHistory.tsx` | inline · S23 | F07 F13 F17 | 2 |
| W25 | Delete consequence line (games go back to Completed) | `app/(screens)/results/[id].tsx` | inline · S23 | F17 | 2 |
| W26 | Deleted results section (Restore, 30 days) | `app/(screens)/results/index.tsx` | inline · S21 | F17 | 4 |
| W27 | My players search-full note + 1,000 limit | `app/(tabs)/players.tsx, utils/guardrails.ts` | inline · S05 | F04 | 2 |
| W28 | Guardrail refusals (GRD01: 20 seats, 500 rounds, 10 live games, 50 games/day, 100 players/day, 20 pending links) | `utils/guardrails.ts` | error · S09 S10 S15 S16 | F03 F04 F06 | 5 |
| W29 | Offline / network copy (cannot reach server · saved on this phone) | `utils/supabaseErrors.ts` | inline · S01 S04 S14 S15 | F14 | 6 |
| W30 | Support card (Can’t find a game? support@ezscore.app) | `app/(screens)/hidden-deleted.tsx` | card · S08 | F13 | 1 |
| W31 | Settings Saved banner | `app/(screens)/settings.tsx` | banner · S07 | F02 | 10 |
| W32 | Final scores note + multiplier line | `app/(screens)/games/final-scores.tsx` | inline · S20 | F10 | 2 |
| W33 | Web result banners (deleted · edited after it was saved · older versions) | `public/r/index.html` | web · S26 | F11 | 13 |
| W34 | Web scorecard Changes card | `public/scorecard.html` | web · S25 | F11 | 13 |
| W35 | Pool standings (OUT · re-entry eligible · re-entered · limit) | `components/game/PoolStandings.tsx` | inline · S14 | F09 | 4 |
| W36 | Pool awards card (after complete) | `components/game/PoolAwardsCard.tsx` | card · S14 S18 | F10 | 4 |
| W37 | Toast errors (formatSupabaseError) on every write | `utils/supabaseErrors.ts` | inline · S04 S05 S06 S14 S15 S16 S21 S23 | F14 | 3 |
| W38 | Rummy / positive pot colours (yellow selected, green win, red penalty) | `components/game/ScoreKeypad.tsx, utils/scoreTone.ts` | inline · S15 S14 | F06 | 7 |
| W39 | Deleted game read-only (no Add round / Undo / Share) | `app/(screens)/games/[id].tsx` | inline · S14 | F13 | 2 |
| W40 | Role tags on Home cards (Creator · Admin · Player · View only) | `components/ui/GameListItem.tsx` | tag · S04 S21 | F12 | 8 |

## Emails

| ID | Email | File | Trigger | Flows | Tests |
| --- | --- | --- | --- | --- | --- |
| E01 | Welcome | `supabase/functions/send-email/index.ts (kind welcome)` | Sign-up | F01 F15 | 1 |
| E02 | OTP / passcode reset | `supabase/templates/recovery-passcode.html` | Forgot passcode | F01 F15 | 1 |
| E03 | Game started (live link) | `supabase/functions/send-email/index.ts (game_started)` | New game created | F03 F15 | 7 |
| E04 | Result saved (/r/ link) | `supabase/functions/send-email/index.ts (result_saved)` | Save result | F15 F17 | 9 |
| E05 | Link request (Yes / No) | `supabase/functions/send-email/index.ts (link_request)` | Send request in Link to Player ID | F04 F15 | 9 |
| E06 | Restore requested | `supabase/functions/send-email/index.ts (restore_requested)` | Ask to restore a deleted game | F13 F15 | 2 |
| E07 | Scorecard by email | `supabase/functions/send-email/index.ts (kind scorecard)` | Share → Email | F11 F15 | 5 |
