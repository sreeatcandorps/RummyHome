# Confidence checklist · Nov 9, 2026

Scope: every P1/P2 item from the Nov 4 night batch, the Nov 5 batch (builds 3 and 4) and the Nov 6 phone-test batch, plus the app items in issue #8. P3 items (audit log, unlinking, role filters, player removal, Closed-game reopen, single-game PDF) are parked and were not touched.

How the evidence was made: Expo web (`npx expo start --web`) at branch `cursor/ezscore-apk-ready`, 390×844 viewport. Game, player and roster screens ran in local fixture mode (no Supabase env, seeded demo data in the browser's storage). The reset and change-passcode flows ran against a throw-away in-memory stand-in for Supabase Auth on `localhost:9999`, so the real `supabase-js` client and the real screens executed the full flow. Nothing touched production; no production write happened.

Screenshots: `/opt/cursor/artifacts/nov9-checklist/<file>` (also mirrored to the agent store). Status words: **Done** = change is in the code and visible in the screenshot; **Partial** = in the code, but part of the acceptance can only be proven on a phone or in the dashboard; **Not done** = not in the code.

Automated checks on this branch: `npx tsc --noEmit` clean; `node --import tsx --test tests/*.test.ts` → 207 pass, 0 fail.

## Issue #8 · reset and change passcode (new today)

| # | Item | Status | Note | Screenshot |
|---|------|--------|------|------------|
| D1 | A visible place to enter the code | Done | Step 1 is one large numeric box labelled OTP, before the passcode cells; autofocused when the step opens (focused element logged as `aria=OTP inputmode=numeric autocomplete=sms-otp`). | `D_01_otp_box_visible_autofocused.png` |
| D2 | "passcode code" → "OTP" | Done | Screen copy, help popup, Send a new OTP button, error messages and the email template all say OTP; "passcode code" no longer appears anywhere. | `D_09_help_reset_otp_wording.png`, `D_13_recovery_email_template_app_only_otp.png` |
| D3 | Clear (×) button | Done | × inside the OTP box clears it; passcode cells also have ×. | `D_02_otp_six_digits_with_clear_button.png`, `D_03_otp_cleared.png` |
| D4 | Keyboard opens on first tap | Partial | Root cause fixed: the hidden opacity‑0 input is gone; the real input now sits over the cells, so the OS gets a direct tap. On web one click focuses the real input (logged). Android keyboard behaviour itself needs a phone test. | `D_05_passcode_cells_focused_on_first_tap_with_clear.png` |
| D4b | Single numeric OTP input with number pad, oneTimeCode, sms-otp, paste | Done | `keyboardType="number-pad"`, `inputMode="numeric"`, `textContentType="oneTimeCode"`, `autoComplete="sms-otp"`; a pasted "48 29 13x" becomes 482913 (logged). | `D_02_otp_six_digits_with_clear_button.png` |
| D5 | Exactly 6 digits on reset and change screens | Done | `/^\d{6}$/`: 4 digits refused with "The OTP is 6 digits." and the server is never called (fake server's code stayed unused); 7th digit is dropped; Change passcode refuses a 5-digit new passcode and a non-6-digit OTP. | `D_04_otp_four_digits_refused.png`, `D_11_change_five_digits_blocked.png` |
| D6 | Works with an app-only email (no browser link) | Done | Email → OTP → new passcode → back at Sign in → signed in with the new passcode, with no link anywhere; template has `{{ .Token }}` and zero `<a>` tags. Pasting the new template into the dashboard is Sree's step. | `D_06_wrong_otp_refused.png`, `D_07_reset_done_back_at_sign_in.png`, `D_08_signed_in_with_new_passcode.png`, `D_13_recovery_email_template_app_only_otp.png` |
| D7 | Remove github.io redirect URLs | Not done (dashboard) | Dashboard-only; the app no longer needs any redirect for recovery. Sree removes them under Authentication → URL Configuration. | — |
| D8 | Old passcode works until the new one is saved | Done (by design) | Dialog text says so; Change passcode saved → fake server passcode changed only on Save. | `D_10_change_passcode_dialog_clear_buttons.png`, `D_12_change_saved.png` |

## Nov 4 night batch (build 2 feedback)

| # | Item | Status | Note | Screenshot |
|---|------|--------|------|------------|
| A1 | Home: Results above Live, Recent shows only Completed/Closed with All / Last 10 days | Done | Results (yellow) above Live · 3, Recent below with the toggle. | `A1_home_results_live_recent.png`, `A1b_home_recent_all.png` |
| A2 | Version shown on Home and in Help | Done | `v1.1.0 (dev build)` under the title; Help repeats it. On an APK it reads `v1.1.0 (build N)`. | `A2_help_home_version.png` |
| A3 | My players: sort toggle, two-column grid, full names, numeric Player ID badge | Done | Frequent / Alphabetical, Player ID N badges, status pills. | `A3_my_players_grid_ids.png` |
| A4 | Find player in database marks people already on your list and sorts them last | Done | Search "Sr" lists database players; already-listed people are marked. | `A4_find_player_marks_on_list.png` |
| A5 | Every help popup rewritten as short prose | Done | Home and My players help shown; others spot-checked on Nov 7. | `A2_help_home_version.png`, `A5_help_my_players_short_prose.png` |
| A6 | Add round redesigned (player grid, presets, keypad, Balance + Save) | Done | Screen as in the paper sketch. | `A6_add_round_keypad_presets_balance.png` |
| A7 | Preview APKs stop reverting to old code | Partial | Config only (`app.config.js` + `eas.json`: updates off for preview). Nothing to screenshot in the app; proving it needs an APK, which was not built today. | — |

## Nov 5 batch (builds 3 and 4 feedback)

| # | Item | Status | Note | Screenshot |
|---|------|--------|------|------------|
| B1 | Add New Players by Initials is a full screen; last initial cannot be a digit | Done | Full screen with Done; "A1" refused inline. | `B1_add_new_players_full_screen.png`, `B1b_add_new_players_digit_refused.png` |
| B2 | Results: Closed games listed and selectable with a warning | Done | Closed chip shows G5/G4 as Closed; the "already counted" warning appears once one is ticked (Nov 7 shot `/opt/cursor/artifacts/b3_14_results_closed_warning.png`). | `B2_results_closed_warning_all.png` |
| B3 | Profile redesign: avatar-only tab, inline phone save, Change passcode | Done | Nov 6 later moved the settings ladder off Profile (kept on User settings) by request. | `B3_profile_phone_change_passcode.png`, `B3b_profile_bottom.png` |
| B4 | New game does not pre-seat the creator | Done | Nobody selected until tapped. | `B4_new_game_creator_not_preseated.png` |
| B5 | Home opens on Last 10 days; My players opens on Frequent with Registered / Pending / Unregistered labels | Done | | `B5_home_default_last10d.png`, `B5b_my_players_frequent_status_labels.png` |
| B6 | Edit round from the Scorecard ⋮ menu | Done | Menu entry and round picker. Only on active games (completed games show Reopen instead). | `B6_scorecard_menu_edit_round.png`, `B6b_edit_round_picker.png` |
| B7 | Results opens on Completed with every completed game ticked; warnings for active / already-counted games | Done | | `B7_results_completed_default.png`, `C-P2-10_results_completed_default.png` |
| B8 | Names with bold initials replace avatars in lists | Done | | `B8_bold_initial_names.png` |
| B9 | Score-entry palette final (beige / yellow / green / blue) | Done | Selected player yellow, typing state. | `B9_score_entry_palette.png` |

## Nov 6 batch · P1

| # | Item | Status | Note | Screenshot |
|---|------|--------|------|------------|
| C-P1-1 | Results privacy: unrelated accounts cannot open or list others' results | Done | Client guard: a result for games I'm not in shows the not-available message and is left out of Past results; my own opens. Server side is migration 013, which Sree applied on Nov 9. | `C-P1-1_results_privacy_unrelated_result_blocked.png`, `C-P1-1b_results_past_only_mine.png`, `C-P1-1c_results_own_result_opens.png` |
| C-P1-2 | Change / forgot passcode works end to end | Done | Full reset and sign-in with the new passcode, and Change passcode, all against the auth stand-in; see D-items above. Real email delivery on a phone is the remaining proof. | `D_07_reset_done_back_at_sign_in.png`, `D_08_signed_in_with_new_passcode.png`, `D_12_change_saved.png` |

## Nov 6 batch · P2

| # | Item | Status | Note | Screenshot |
|---|------|--------|------|------------|
| C-P2-1 | Signup: visible passcode by default with working eye; short Player ID copy; optional country → phone → zip | Done | | `C-P2-1_signup_visible_passcode_eye_player_id_copy.png`, `C-P2-1b_signup_country_phone_zip_order.png` |
| C-P2-2 | Profile/account navigation: no header avatar on tab pages, balanced bottom avatar; Change passcode above Dark mode; ladder removed; New game has no "You" label | Done | | `C-P2-2_profile_tab_no_header_avatar.png`, `C-P2-2b_change_passcode_above_dark_mode.png`, `C-P2-2c_new_game_no_you_label.png` |
| C-P2-3 | Roles: Home cards show Creator / Admin / View only; non-admin sees Game settings read-only | Done | G8 (created by Harish) shows View only; settings dialog is read-only with the explanation. | `C-P2-3_home_access_tags.png`, `C-P2-3b_view_only_game_nonadmin.png`, `C-P2-3c_view_only_menu.png`, `C-P2-3d_game_settings_view_only.png` |
| C-P2-4 | Scorecard ⋮ keeps working after sharing | Partial | Web: menu reopens after Share live scorecard. The Android share-sheet return path is exactly what cannot be exercised on web. | `C-P2-4_scorecard_menu_live.png`, `C-P2-4b_menu_reopens_after_share.png` |
| C-P2-5 | Players in this game: full page, tags, per-player menu (admin, edit name, invite, link ID), add mid-game with zeros, no removal | Done | | `C-P2-5_players_page_tags.png`, `C-P2-5b_player_menu_unregistered.png`, `C-P2-5c_add_player_midgame_zeros_note.png` |
| C-P2-6 | Zero and round integrity: explicit zero allowed, blank-round guard | Done | Scorecard shows 0 cells; typing 0 in score entry. Atomic round save on the server is migration 014 (applied Nov 9); it does not change Undo behaviour. | `C-P2-6_7_scorecard_zero_and_red_negatives.png`, `C-P2-6b_explicit_zero_entry.png` |
| C-P2-7 | Big negatives (≥ half of Full count) highlighted red; positives stay green | Done | −50 and −40 red with Full count −80. | `C-P2-6_7_scorecard_zero_and_red_negatives.png` |
| C-P2-8 | Complete game page + Final scores share (yellow, no podium, preview before share) | Done | Complete page, second confirmation, next steps, yellow preview. The generated image itself was produced on Nov 7 (`/opt/cursor/artifacts/p2_10_final_scores_image_actual.png`); native share needs a phone. | `C-P2-8_complete_page.png`, `C-P2-8b_completed_next_steps.png`, `C-P2-8c_final_scores_preview_yellow.png` |
| C-P2-9 | Home Recent sorted by completion time; admin can reopen a Completed game | Done | G7 (completed 20 h ago) lists after G6 (completed 2 h ago); Reopen game in the completed menu with a confirmation. | `C-P2-9_home_recent_by_completion.png`, `C-P2-9b_completed_menu_reopen.png`, `C-P2-9c_reopen_confirm.png` |
| C-P2-10 | Results consistency: multi-select Completed / Closed / Active chips, concise copy, stable game labels, result ID footer | Done | | `C-P2-10_results_completed_default.png`, `C-P2-10b_results_multiselect_chips.png`, `C-P2-10c_results_preview_labels_footer.png`, `C-P2-10d_results_preview_bottom.png` |
| C-P2-11 | Results share fits all games; actual 20-game image | Done | Today's dialog shows 3 games with the per-game breakdown; the 20-game actual image and PDF from Nov 7 are `/opt/cursor/artifacts/p2_33_results_share_image_20_games_ACTUAL.png` and `p2_34_results_full_details_20_games_ACTUAL.pdf` (same code). | `C-P2-11_results_share_dialog.png` |
| C-P2-12 | Recovery email branding: EZ Score: Rummy / MindWeave, "passcode" never "password", app-only | Done (app side) | Template rendered; sender domain and SMTP are dashboard settings Sree reported live (Resend). | `D_13_recovery_email_template_app_only_otp.png` |

## Totals

- Done: 35 of 39 rows (including D8 "by design" and C-P2-12 "app side")
- Partial: 3 (D4 keyboard on Android, A7 APK not reverting, C-P2-4 native share return)
- Not done: 1 (D7 remove github.io redirect URLs — dashboard, Sree)

## Needs a phone test (cannot be shown on Expo web)

1. Tap the passcode cells once on Android: keyboard opens on the first tap (D4).
2. OTP box autofocus and the number pad on Android; iOS/Android OTP autofill from the email (D1, D4b).
3. Real recovery email arrives from the Resend sender with a 6-digit OTP and no link; reset completes; sign in with the new passcode (D6, C-P1-2).
4. Scorecard ⋮ after returning from the Android share sheet, repeated cycles and back navigation (C-P2-4).
5. Share final scores image and Share results image / PDF through the native share sheet (C-P2-8, C-P2-11).
6. Preview APK keeps its own code across launches (A7). Needs an APK, which was deliberately not built today.
7. Dashboard: paste the new `recovery-passcode.html`, subject "Your EZ Score: Rummy OTP", remove github.io redirect URLs (D2, D6, D7).
