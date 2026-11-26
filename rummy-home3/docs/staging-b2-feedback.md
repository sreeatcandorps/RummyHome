# Staging APK build 2 (#120 `e0e4850`) — Sree's feedback, Nov 23: what happened, why we missed it, how we prevent it

> Nothing here is built. Sree: *"Before you start anything, I want feedback on what happened and why we are missing all
> these things … from now on, if you find any bugs, I want to know how we would have prevented this in the first place."*
> Mockups: `design-review-2/mockups/b2-*.png`. Questions for Sree are Q16–Q19 in `decisions.md`.

## The pattern across the eight

Three causes, not eight:

1. **Staging was built from the repo, but live was also built by hand in the Supabase dashboard.** Auth sender, Site URL,
   redirect allow-list, e-mail templates, Confirm-email switch live only in the dashboard, so the staging project got
   Supabase's defaults (bugs 1, 2). *Prevention:* every dashboard setting is written down in `supabase/config.toml` and
   `supabase/templates/`, with a "staging = live" checklist in the run-book, and the Management API applies them.
2. **Sree's words were filed as suggestions when they were instructions.** The Order-of-players arrows (bug 7) were
   specified by him on Nov 21; I put them in §8.4 as a "recommendation with one refinement" and made the build wait for
   his yes to *my* refinement. *Prevention:* when his words are a complete spec, build them as said; a refinement is a
   sentence in the PR, never a gate.
3. **The device tests check what the builder thought of, on one phone.** Pixel 6 at font scale 1.0, no flow that types
   into Create account, no flow that opens Delete account, no comparison of the CI frame against the approved mockup
   (bugs 3–6, 8). *Prevention:* (a) the smoke set runs once more at **360 dp × font 1.3** (the harness already supports
   both); (b) a flow per form that focuses each input and asserts it is still visible; (c) the matrix step compares each
   frame to its mockup side by side before "done"; (d) a db test calls every admin RPC on a fresh database.

## Bug by bug

| # | What Sree saw | What happened | Why we missed it | Prevention (added to the rules below) | Proposed fix |
| --- | --- | --- | --- | --- | --- |
| 1 | "Confirm your email address" from Supabase Auth, default body | Staging has no custom SMTP or templates; live has Resend SMTP + sender set by hand in the dashboard | Dashboard-only config, no record in the repo, not in the staging run-book | Cause 1 | Resend SMTP on staging (same key as live, sender `EZ Score: Rummy <scores@mindweavetech.com>`); **and** replace the link with a **6-digit code typed in the app** (Q16, `b2-signup-code.png`) |
| 2 | Link → `localhost:3000`, "otp_expired" | The app asks Supabase to redirect to `sreeatcandorps.github.io/Games/`; staging's allow-list is empty so Supabase fell back to its default Site URL `http://localhost:3000`. `otp_expired` on the first tap means the token was already consumed (a mail-client link preview) or the tap repeated — the account is very likely confirmed anyway | Same as 1 | Cause 1 | Short term: Site URL + redirect allow-list on staging = live. Real fix: the code flow (Q16) needs no redirect at all |
| 3 | "Demo data failed. In a pool the round winner scores 0." | `Load demo data` (Nov 6, migration 005) generates a pool game with points-style scores; migration 041 (Nov 18) added the rule "pool winner scores 0" as a trigger; the generator was never updated | No test calls `apply_demo_seed` end to end; it is an admin-only button nobody pressed after Nov 18 | Cause 3 (d) | **Remove Load / Clear demo data** (Q17). The staging population generator (#117) does this job properly; D50 says fewer states |
| 4 | Delete dialog: buttons over the text | Paper `Dialog` with `maxHeight: 90%`; the scroll area has no `flexShrink`, so on a phone shorter than the content the actions overlay it | No flow opens the dialog (destructive); on the Pixel 6 the content fits | Cause 3 (a, b) | One style (`flexShrink: 1` on the scroll area) → `b2-delete-dialog.png`. D72 replaces the dialog later |
| 5 | "Initials on scoreca…" / "SS · from your na…" cut off; "from your name" useless; share on Player ID | Row title and value share one line; on a 360-dp phone both truncate. The approved mockup had **white rows on the paper background**; the build shipped flat rows with hairlines — the surface tone was in the mockup's CSS but not in §10.1's text | Spec omitted the token; matrix checked "Palette B present", not "matches the mockup"; Pixel 6 is 411 dp | Cause 3 (a, c) | `b2-profile-groups.png`: inset grouped white cards (iOS Settings / Pixel Settings pattern), value "SS" only, value column capped at 46 %, Player ID **copy** icon, no share (Q18) |
| 6 | PDF: no final scores; centred headers over right-aligned numbers | PR 10b put each total in the round-table header to save a page and dropped the standings list; header alignment was never specified | Reviewed as a picture, not against a table convention | Cause 3 (c) | `b2-game-pdf.png`: Final scores table first (place, name · initials, total, winner tinted, "Totals add to 0" as the last row), every numeric header right-aligned with its column (Excel / Sheets / APA) (Q19) |
| 7 | Arrows on every row; "Show me" pops up by default | §8.4 recorded his words and was gated on a mockup yes for my "faint arrows" refinement. The tutorial opens forced on first visit by **D61** (his Nov 19 "force them to see it the first time"); he has now changed that | Cause 2 | — | Build §8.4 **as he said it** (all arrows at rest, only the selected row's when selected, none on the last row's down, both places, tutorial 4 → 3 steps). **D61 superseded**: no auto-open; "Show me" stays as a link; no card pictures ("some places even Joker is highest") |
| 8 | Create account: passcode under the keyboard | `AuthShell`'s `KeyboardAvoidingView` only has `behavior` on iOS. On Expo SDK 54 Android is edge-to-edge, where the window no longer resizes for the keyboard, so nothing moves | Flow 07c tests a *dialog* with the keyboard; no flow types into Create account; Sign in's field sits higher | Cause 3 (b) | `behavior="padding"` on Android too, plus scroll-to-focused-input; a keyboard flow for every form |

## Rules added (`design-review-checklist.md` item 4 and the PR template, in the next docs PR)

- **Two phones, two font sizes**: every smoke frame also at 360 dp × 1.3 font scale; a frame that truncates fails.
- **Every form, keyboard open**: a flow step per input — tap, assert the input is visible.
- **Every dialog, on the short phone**: dialogs taller than half the screen get a scroll area with `flexShrink`.
- **Frame vs mockup**: the matrix row says "matches mockup" or lists the difference; "Palette present" is not enough.
- **Fresh-database check**: a db test calls every RPC the Profile can trigger on a database at the latest migration.
- **Dashboard = repo**: no Supabase setting exists only in the dashboard; `config.toml`, `templates/`, run-book.
- **His words are the spec**: a refinement of Sree's instruction is a sentence in the PR body, never a gate.

## Staging Auth config (for Build Bot — not changed yet)

Dashboard › Authentication, project `erurahfybkxemgtkfzkn` (or Management API `PATCH /v1/projects/erurahfybkxemgtkfzkn/config/auth`):

| Setting | Value | API field |
| --- | --- | --- |
| URL Configuration › Site URL | `https://sreeatcandorps.github.io/Games/` (= live; what `utils/authRedirect.ts` sends) | `site_url` |
| URL Configuration › Redirect URLs | `https://sreeatcandorps.github.io/Games/`, `https://sreeatcandorps.github.io/Games/**`, `ezscore://auth/callback` | `uri_allow_list` (comma-separated) |
| SMTP Settings › Enable custom SMTP | on; host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key (same as live's `RESEND_API_KEY`), sender `scores@mindweavetech.com`, sender name `EZ Score: Rummy` | `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_admin_email`, `smtp_sender_name` |
| Email Templates › Reset password | `supabase/templates/recovery-passcode.html`, subject "Your EZ Score: Rummy OTP" (= live) | `mailer_templates_recovery_content`, `mailer_subjects_recovery` |
| Email Templates › Confirm signup | D101 (Q16 answered): `supabase/templates/confirm-code.html` (`{{ .Token }}`, no link), subject "Your EZ Score: Rummy code is {{ .Token }}". Exact text to paste: [`signup-code-template.md`](signup-code-template.md) | `mailer_templates_confirmation_content`, `mailer_subjects_confirmation` |

D101's app side is built on `cursor/signup-code-no-player-id-7d0d` (a code step on Create account; Sign in offers
**Enter the code** for an unconfirmed address). After it merges, Build Bot sets the code template on staging first,
checks one sign-up, then live. Until then both projects keep their link e-mail, which the app still handles.
