# 03 · Implementation plan

Nothing in this plan has been implemented. It is the order of work for applying [02-design-system.md](02-design-system.md) with the Clubhouse palette, scoped so each phase ships on its own and the app is never half-restyled for long.

Effort is given as *size* (S ≈ one focused session touching one or two files; M ≈ several files, mechanical; L ≈ many files or a behaviour-adjacent change needing device testing). No calendar estimates.

## Phase 0 · Foundations (S–M, no visible change yet)

| Change | Files | Size |
|---|---|---|
| Add new tokens (`surfaceSunken`, `win*`, `loss*`, `primaryEdge`, `secondaryEdge`, `focus`, `tableStripe`), keep `positive`/`negative` as aliases; swap hex values for both modes; `roundness: 3` | `constants/theme.ts` | S |
| Add `type` scale object and `seatColor(index, { onDark })`; add dark seat text variants | `constants/theme.ts` | S |
| Bundle Nunito 400/600/700/800 and register it as Paper's font (`configureFonts`) so every Paper `Text variant` picks it up without touching call sites | `app/_layout.tsx`, `package.json` (`@expo-google-fonts/nunito` or `assets/fonts/*.ttf`), `constants/theme.ts` | S |
| Bump MD3 variant sizes: `bodyMedium` 14→16, `bodySmall` 12→14, `labelMedium` 12→13, `labelSmall` 11→13, `titleLarge` 22/800, `headlineMedium` 28/800 | `constants/theme.ts` (`fonts` override) | S |
| Follow the phone's appearance: `app.json` `userInterfaceStyle: "automatic"`; `useColorScheme()` picks the theme; remove the manual toggle and the `darkMode` preference (or keep it as a three-way "System / Light / Dark" if Sree prefers) | `app.json`, `app/_layout.tsx`, `contexts/PreferencesContext.tsx`, `app/(screens)/settings.tsx`, `utils/storage.ts` | S |

Risk: Paper's `configureFonts` needs the `fontFamily` per weight on RN (no synthetic bold), so each variant must map to the right Nunito face. Web falls back cleanly. Test on one Android device before continuing; the whole app re-flows when body goes to 16 px, and the scorecard with 8+ columns is the screen to check.

## Phase 1 · Shared components (M)

| Change | Files | Size |
|---|---|---|
| One `AppButton` wrapper: variants primary / tonal / outlined / destructive / text / accent; 52 px, pill, 18/800 label, 4 px edge + press translate for primary and accent; disabled and focus states | new `components/ui/AppButton.tsx` | M |
| Merge `ActionTile` + `StackedAction` → `TileButton` using the same variants; `Count` badge style from 02 | `components/ui/ActionTile.tsx`, `components/ui/StackedAction.tsx` (replace), callers: `app/(tabs)/players.tsx`, `app/(screens)/games/[id].tsx` | M |
| `Tag`: fixed 32 px pill, 14/700, 16 px icon, drop the `small` variant; add tones `live`, `completed`, `closed`, `registered`, `pending`, `unregistered`, `points`, `pool`, `you`, `creator`, `admin`; keep the old tone names as aliases while callers migrate | `components/ui/Tag.tsx`, `utils/chipLook.ts` | S |
| Single status→tone map used by every screen (fixes the three different Registered colours) | `utils/myPlayersList.ts` (`REGISTRATION_TONE`), `app/(screens)/games/players.tsx`, `components/players/RegisterPlayersDialog.tsx`, `components/players/PlayerPickerRow.tsx`, `utils/gameAccess.ts` (`ACCESS_TONE`), `utils/gameStatus.ts` (`GAME_STATUS_TONE`) | S |
| `SectionCard`: flat card, 1.5 px `outlineVariant`, `r-lg`, header disc; list children separated by hairlines instead of nested frames | `components/ui/SectionCard.tsx`, `components/ui/GameListItem.tsx`, `components/ui/ListRow.tsx` | S |
| `SeatAvatar`: sizes 28/36/44/56/64, `surface` ring, crown disc, spectator look; use `seatColor(…, { onDark })` for text usages | `components/ui/SeatAvatar.tsx`, `components/PlayerAvatar.tsx` | S |
| `BottomBar`: `surface` + top border, 52 px buttons; three-up bars use 16 px labels | `components/ui/BottomBar.tsx` | S |
| Icons: replace the two Ionicons in the tab bar with MDI equivalents; audit `IconButton` sizes to 24 in 48 | `app/(tabs)/_layout.tsx`, `components/SharedHeader.tsx`, `components/ui/HelpButton.tsx` | S |
| Header: left-aligned 22/800 title on tabs and stack; drop version string from Home header (keep in Profile) | `app/(tabs)/_layout.tsx`, `app/(screens)/_layout.tsx`, `app/(tabs)/index.tsx` | S |

Risk: `Tag` is used in 20+ places with the `small` prop; removing it is mechanical but touches many files. Do it with the alias approach so the old API keeps compiling until the last caller is gone.

## Phase 2 · Screens, in the order players see them (M each)

| Screen | What changes | Files |
|---|---|---|
| Home | `AppButton` primary / accent; chips to new tones ("Live" wording); hairline rows | `app/(tabs)/index.tsx`, `utils/homeGames.ts` |
| Scorecard | Header cells 16/800 + 20/800 totals, dealer column `primary`, 18 px cells (15 above 8 columns), win/loss pills, `tableLatest`; bottom bar: Add round = primary, Complete = tonal | `components/game/ScoreTable.tsx`, `components/game/ScoreCell.tsx`, `app/(screens)/games/[id].tsx` |
| Add round | Cells `cellNeutral` → selected `surface` + 2 px `primary` ring (no yellow) → confirmed `surface` + check; 32 px value; keypad keys `surfaceSunken` 64 px with 30/800 digits, sign toggle `primaryContainer`, Save score tile primary with edge; Balance pill tokens | `app/(screens)/score-entry.tsx`, `components/game/ScoreKeypad.tsx`, `utils/roundEntry.ts` (no logic change, only tone names) |
| Results | Winner card (64 px avatar, `display` total, 1st/2nd/3rd), totals 24/800, grid header `primaryContainer` instead of felt, warning notice tokens, Save result as primary in bottom bar | `components/results/ResultsPage.tsx`, `components/results/GameScoreGrid.tsx`, `components/results/ResultWarnings.tsx`, `app/(screens)/results/{index,view,[id]}.tsx`, `utils/resultsLayout.ts` |
| My players | Outlined search field (replace `Searchbar`), filter chips 36 px, player cards with avatar, Player ID chip `#7`, `TileButton` row | `app/(tabs)/players.tsx`, `components/players/*` |
| New game / Players & Admins / Complete | Same chip map and `AppButton`; selection = `primaryContainer` + ring + check | `app/(screens)/games/new.tsx`, `app/(screens)/games/players.tsx`, `app/(screens)/games/complete.tsx`, `components/game/Standings.tsx`, `components/players/SelectedPlayersStrip.tsx` |
| Auth | `felt` band = `primary`, auth card `r-xl` with shadow, inputs 56 px | `components/ui/AuthShell.tsx`, `app/(auth)/*`, `components/ui/PasscodeField.tsx`, `components/ui/OtpField.tsx` |
| Profile / Settings / dialogs | Tokens and `AppButton` only; remove dark-mode toggle (Phase 0) | `app/(tabs)/me.tsx`, `app/(screens)/profile.tsx`, `app/(screens)/settings.tsx`, `components/game/GameSettingsDialog.tsx`, `components/auth/ChangePasscodeDialog.tsx`, `components/players/JoinRequestsDialog.tsx` |

## Phase 2b · Round-2 items (Sree, 11 Nov PM)

| Change | Files | Size | Notes |
|---|---|---|---|
| Role chips: hide the viewer's own role; show Creator always; Admin chips only when the viewer is creator or admin; remove Player / View only chips | `utils/gameAccess.ts` (`ACCESS_TONE` → `visibleRoleChips(game, viewerId)`), `components/ui/GameListItem.tsx`, `app/(screens)/games/players.tsx`, `app/(screens)/results/index.tsx` | S | Pure display logic; the access rules that gate actions do not change. One unit test on the helper. |
| Button green only on tappables: dealer column → `primaryContainer`; positive scores → `onSurface` (+ `winContainer` tint for the round winner); seat colour 1 → teal; logo disc → marigold; "You" chip → blue; round strip → blue chip | `constants/theme.ts` (`SEAT_COLORS[0]`, `scoreTone` map), `components/game/ScoreTable.tsx`, `components/game/ScoreCell.tsx`, `utils/scoreTone.ts`, `components/results/GameScoreGrid.tsx`, `components/results/ResultsPage.tsx`, `app/(tabs)/_layout.tsx` (logo), `components/ui/Tag.tsx` | S–M | `scoreTone` tests change expected tones. Share images follow in Phase 3. |
| Complete as an outlined button; Undo outlined; Add round filled | `app/(screens)/games/[id].tsx` (bottom bar) | S | |
| Tabs as pill buttons | new `components/ui/TabBarButtons.tsx` passed to `<Tabs tabBar={…}>` in `app/(tabs)/_layout.tsx` | S–M | expo-router's `Tabs` is React Navigation's bottom tabs; a custom `tabBar` receives `state`, `descriptors`, `navigation` and can render three `Pressable`s. Safe-area inset and the Android back behaviour are unchanged. The only cost is losing the default ripple/haptics, which `Pressable` + `android_ripple` restores. Not hard. |
| Scorecard: `G-number` badge in the strip; Creator/Admin footer bottom-right inside the table card, card stretches to the bottom bar | `components/game/ScoreTable.tsx`, `app/(screens)/games/[id].tsx` | S | The names are already loaded for the Players/Admins screen (`game.createdBy`, `game.adminIds` + roster). Footer is a `View` after the rows with `marginTop: 'auto'` inside a `flex: 1` card, so it pins to the bottom on short games and trails the last row on long ones. |

## Phase 3 · Share images and PDFs (M)

The share renderers hard-code the old palette and will look like a different product once the app changes.

| Change | Files |
|---|---|
| Read colours from `lightTheme` (share images are always light) instead of literals; Nunito in the image views | `components/share/FinalScoresView.tsx`, `components/share/ScorecardImageView.tsx`, `components/share/ShareCardView.tsx`, `utils/shareImage.ts`, `utils/resultsDetails.ts`, `utils/shareResultsPdf.ts`, `utils/scorecardSheet.ts`, `utils/finalScoresSheet.ts` |

Risk: PDF/HTML sheets embed CSS strings; fonts must be embedded as base64 or they fall back to system sans. Acceptable to leave system sans in PDFs.

## Phase 4 · The confetti moment (S–M)

| Change | Files | Size |
|---|---|---|
| Winner card component with podium rows | new `components/results/WinnerCard.tsx`, used by `ResultsPage.tsx` | S |
| Confetti burst (1.8 s, once per result view, `reduceMotion` aware). Option 1: `react-native-confetti-cannon` (small, no native code, works on web). Option 2: 60 `Animated.View`s with `react-native-reanimated` (already a dependency of expo-router). Prefer option 1 for size | `components/results/Confetti.tsx`, `package.json` | S |
| Trigger: first mount of `results/view` with a computed result, `results/[id]` when arriving from the save dialog, `games/complete` after Complete succeeds (reduced count) | `app/(screens)/results/view.tsx`, `app/(screens)/results/[id].tsx`, `app/(screens)/games/complete.tsx` | S |

## Phase 5 · Clean-up (S)

Remove `positive`/`negative` aliases, the old `Tag` tone names, `ActionTile`/`StackedAction`, the `small` chip variant, `brand.cream`, and the dark-mode preference key migration shim. Update the tests that assert tone names: `tests/scoring-nov6.test.ts`, `tests/build3.test.ts`, `tests/build4.test.ts`, `tests/home-and-players.test.ts`, `tests/nov10-owner.test.ts`, `tests/nov10-midgame.test.ts` reference `scoreTone`, `chipLook` or `myPlayersList`.

## Totals

- Files touched: ~55 of the 120 source files (theme 1, components ~30, screens ~22, utils ~8, config 2).
- Pure token/style edits: most of it. Behaviour-adjacent: dark-mode-follows-phone (removes a setting), Add round = primary (bottom bar order unchanged, emphasis swapped), confetti (new dependency).
- New dependencies: Nunito font files (or `@expo-google-fonts/nunito`), optionally `react-native-confetti-cannon`.
- No data model, navigation, Supabase or scoring logic changes.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| 16 px body makes the scorecard overflow with 8–10 players | Score cell size steps down to 15 px above 8 columns (already a pattern in `ScoreTable`); horizontal scroll exists. Test with a 10-player local game. |
| Nunito increases bundle/APK size (~400 KB for 4 weights) | Acceptable; subset to Latin if needed. |
| Removing the dark-mode switch surprises users who turned it on manually | Migrate: if `rummy_settings.darkMode === true` on first launch, show a one-time snackbar "Dark mode now follows your phone setting". |
| Paper `roundness` change alters shapes of components not restyled yet | Phase 0 ships with explicit `style` overrides on dialogs/inputs so nothing moves before Phase 1. |
| Colour-only meaning regressions during migration | Every chip already has an icon; keep the rule in code review: new `Tag` requires `icon`. |
| Share image colours drift from the app for one release | Phase 3 immediately after Phase 2; or ship Phases 2 and 3 together. |
| Android `elevation` vs the 4 px "edge" | The edge is a plain `View`/border-bottom, not a shadow, so it renders identically on Android, iOS and web. |
| Dynamic type at 1.3× breaks the keypad grid | Cap `maxFontSizeMultiplier` at 1.15 on score and keypad text (RN `Text` prop). |

## Verification checklist (for the implementing PRs)

1. Run `mocks/capture-current.js` against the restyled app and compare with `mockups/after/` by eye.
2. `node mocks/contrast.js A` values match the hex in `constants/theme.ts`.
3. Every tappable element ≥ 48 dp (`MIN_TOUCH_TARGET` already exists; grep for smaller `height:` on `Pressable`).
4. Toggle phone appearance; app follows without restart.
5. Reduce motion on → no confetti, winner card still shows.
6. `npm test`, `npm run lint`, `npx tsc --noEmit`.
