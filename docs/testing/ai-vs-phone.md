# AI testing vs phone testing

What a cloud agent can prove on the Expo **web** preview (and with a local database) versus what only a real Android phone can prove. This is the line that decides what goes on Sree's checklist.

## How the agent tests today

- Expo web build, 390×844 viewport, Puppeteer taps, PNG per step.
- Data from fixture mode (no Supabase env → demo games in browser storage) or a GoTrue fake for auth.
- Unit tests and `tsc`.
- A scratch Postgres for migrations when one was written.

With the plan in [`automation-plan.md`](automation-plan.md) the agent also gets a local Supabase, pgTAP, an Android **emulator**, and committed Playwright screenshots. The table has one column for each.

## Verification matrix

✅ proves it · ◐ partial (same code path, different platform behaviour) · ✗ cannot

| Behaviour | Web preview (today) | Web + local Supabase | Android emulator (Maestro) | Real phone |
|---|---|---|---|---|
| Scoring maths, round balance, Rummy split, results totals, places | ✅ (unit) | ✅ | ✅ | ✅ |
| Screen copy, labels, help text, colours, layout at phone width | ✅ | ✅ | ✅ | ✅ |
| Navigation between screens, dialogs, chips, pickers (mouse) | ✅ | ✅ | ✅ (touch) | ✅ |
| Role rules as the **client** applies them | ✅ | ✅ | ✅ | ✅ |
| Role rules as the **server** applies them (RLS, RPC grants) | ✗ | ✅ | ✅ | ◐ (only the cases you happen to try) |
| Migrations apply from empty; rollbacks restore | ✗ | ✅ | — | ✗ |
| Two users at once, realtime arrival | ✗ | ✅ (two clients) | ◐ (one emulator + a script client) | ✅ |
| Concurrency: same round saved twice, double declare | ✗ | ✅ | ◐ | ◐ (hard to time by hand) |
| Sign-up with email confirmation | ◐ (fake) | ✅ (local mail catcher) | ✅ (local mail catcher) | ✅ (real Resend email) |
| Forgot passcode OTP flow logic | ✅ (fake) | ✅ | ✅ | ✅ |
| The real recovery email: Resend sender, dashboard template, subject, OTP length, expiry | ✗ | ✗ | ✗ | ✅ **phone only** |
| OTP autofill from the email/notification | ✗ | ✗ | ✗ | ✅ **phone only** |
| Keyboard opens on first tap; number pad vs full keyboard; autofocus timing | ✗ (browser focus ≠ Android IME) | ✗ | ✅ (stock Gboard) | ✅ (OEM keyboard too) |
| Hardware back button on every screen | ✗ | ✗ | ✅ | ✅ |
| `LayoutAnimation` / `Animated` in the picker | ✗ (web no-ops) | ✗ | ✅ | ✅ |
| Share sheet opens; app survives the return; ⋮ menu afterwards | ✗ (web `navigator.share` differs) | ✗ | ✅ (Android chooser) | ✅ (WhatsApp actually receives it) |
| Final scores / Results **image** produced by `react-native-view-shot` | ◐ (web draws a canvas twin) | ◐ | ✅ (file exists, pixel size) | ✅ (looks right in WhatsApp) |
| Results **PDF** via `expo-print` | ◐ (web downloads HTML→PDF differently) | ◐ | ✅ (file exists, page count) | ✅ (opens in a PDF viewer) |
| Deep link `rummy-home3://claim?t=…` into a cold app | ✗ | ✗ | ✅ (`adb shell am start`) | ✅ (from WhatsApp) |
| Public `scorecard.html` live page refresh | ◐ (page itself) | ✅ | — | ✅ |
| Rotation of the scorecard | ◐ (viewport resize) | ◐ | ✅ | ✅ |
| Cold start, no network → Retry | ◐ (offline mode in DevTools) | ◐ | ✅ (airplane mode via `adb`) | ✅ |
| APK installs over the previous build; session and draft survive; JS is the embedded one | ✗ | ✗ | ✅ (install two APKs) | ✅ |
| Performance on the owner's actual phone (Home load, 20-game image) | ✗ | ◐ (timings in a workflow) | ◐ (emulator timing) | ✅ |
| OEM-specific behaviour (Samsung keyboard, MIUI battery killing realtime) | ✗ | ✗ | ✗ | ✅ **phone only** |
| Google Play / Play Protect install warnings for a sideloaded APK | ✗ | ✗ | ✗ | ✅ **phone only** |

## What this means

**Agents can own, today**: every rule that is a pure function; every screen's copy and layout; the flows as mouse-driven sequences; the migration SQL text. They cannot prove a single thing about Android, the hosted Supabase configuration, or two humans acting at once.

**Agents can own, after the plan**: server-side permissions and concurrency (local Supabase); native keyboard, back, animation, share sheet, image/PDF file creation, deep links, upgrade-install (emulator); realtime between two clients.

**Stays with a phone**, even after everything is built:

1. The real recovery and confirmation emails (Resend, dashboard template) and OTP autofill.
2. What WhatsApp actually receives: the image, the PDF, the invite text with the link.
3. OEM keyboards and OEM power management on the phones people actually bring.
4. "It feels slow" on a real device.
5. Anything that depends on dashboard state the repo cannot see: Realtime publication, SMTP, URL allow-list, rate limits.

That list is the backbone of [`phone-checklist.md`](phone-checklist.md).

## Reading agent evidence

When a PR says "verified", check which column it came from:

- "231 tests pass, tsc clean" → pure logic and source regexes only.
- "screenshots on Expo web, fixture mode" → copy, layout, client rules; **no server, no Android**.
- "exercised against a local GoTrue fake" → the client code path; **not** the real email or dashboard settings.
- "scratch-verified on Postgres 16" → the SQL ran once on a throwaway DB; scripts are not in the repo.
- "needs a phone pass" → nothing above covered it.
