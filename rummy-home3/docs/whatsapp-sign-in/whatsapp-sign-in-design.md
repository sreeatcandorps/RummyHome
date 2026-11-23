# WhatsApp sign-in — design spec (not built)

**Sree, Nov 23 2026**: *"Also, can we start a PR to make it work for WhatsApp? We give a choice of using email or
WhatsApp. A lot of people in India will use WhatsApp. I need a design spec for this before we start."*

Mockups (this folder): `wa-sign-in.png` · `wa-sign-up.png` · `wa-profile.png`. Generator: `make-whatsapp-mockups.py`.
Decisions Sree needs to make are at the end (Q20–Q27 in `../decisions.md`).

## 0. The short version

- **Yes, and it is cheap to do well**: Supabase Auth already does phone OTP over WhatsApp when the SMS provider is
  Twilio Verify; the app change is one segmented control on Sign in / Create account plus the OTP box we already have.
- **The real work is not code**: a WhatsApp Business account for the company, a display-name review, business
  verification, and Twilio Verify wired to it. About a week of waiting on Meta, some of it Sree's paperwork.
- **The design question that matters is identity**: a person must stay *one account* whether they come in by email or
  by WhatsApp, and existing email accounts must lose nothing. This spec does that with Supabase's own model (one auth
  user can carry both an email and a phone) and the "Is this you?" claim step we already have, keyed on phone.
- **The risk that matters is recovery**: a WhatsApp-only account that loses its number has no way back except support.
  Indian numbers are recycled after ~90 days of disuse. We nudge for a backup email after the first game.
- **Where I question the idea**: (a) it should be *WhatsApp*, not "phone" — SMS to India costs 25× more and OTP SMS
  is the #1 fraud target; SMS is at most a fallback button. (b) Do not make WhatsApp accounts set a passcode; the code
  *is* the sign-in, sessions persist, and a second secret is the complexity D50 warns about. (c) Not before Google
  approves the current review; it changes the Data safety form.

## 1. How it works (Supabase + Twilio Verify + Meta)

```
Sign in / Create account ──► supabase.auth.signInWithOtp({ phone, options: { channel: 'whatsapp' } })
        │                                     │
        │                    Supabase Auth ──► Twilio Verify (Channel=whatsapp) ──► Meta Cloud API ──► WhatsApp
        │                                                   (authentication template: "482 913 is your … code")
        ▼
  "Check WhatsApp" OTP box ──► supabase.auth.verifyOtp({ phone, token, type: 'sms' }) ──► session
```

- Supabase: "WhatsApp is only supported as a channel for the Twilio and Twilio Verify providers" (Phone sign-in docs).
  `verifyOtp` uses `type: 'sms'` for both channels; the code is the same six digits either way.
- **Twilio Verify, not Programmable Messaging**: Verify supplies Meta's pre-approved *authentication* template, handles
  the code lifecycle, retries, and Fraud Guard. Programmable Messaging would need our own template and our own code
  store. Supabase's Twilio Verify provider needs: Account SID, Auth Token, Verify Service SID.
- **Our WhatsApp Sender**: since March 2024 Twilio requires "bring your own" — a WhatsApp Business Account (WABA) owned
  by the company's Meta Business Portfolio, with a phone number that is **not** on personal WhatsApp. A Twilio US
  number works for Indian recipients (Meta prices by the *recipient's* country code).
- **Meta Cloud API directly** (no Twilio): possible through Supabase's *Send SMS hook* (an edge function receives
  `{ phone, otp }` and calls Meta's `/messages` with our own authentication template). Saves Twilio's $0.05 per
  verification but we own template approval, retries, delivery receipts and fraud limits. **Recommendation**: Twilio
  Verify now; the hook when codes exceed ~1,000 a month (break-even ≈ $50/mo).
- Test numbers: Supabase lets us register phone numbers with fixed codes — Maestro flows and the Apple reviewer sign
  in without a real WhatsApp. CI needs nothing from Twilio.

## 2. Cost per code (list prices, Nov 2026)

| Channel | India | US | Notes |
| --- | --- | --- | --- |
| WhatsApp authentication message (Meta) | **$0.0014** | **$0.0034** | charged only when delivered; "authentication-international" rate for India is $0.0304 when the sending business is outside India and Meta applies it — Twilio's rate card lists it; confirm on the first bill |
| + Twilio Verify fee | $0.05 per *successful* verification | same | not charged for expired / wrong / abandoned codes |
| **WhatsApp total** | **≈ $0.051** (or ≈ $0.080 at the international rate) | **≈ $0.053** | |
| SMS via Twilio Verify (fallback) | $0.0832 per segment + $0.05 = **$0.133** | $0.0083 + $0.05 = **$0.058** | India SMS is charged per attempt, delivered or not; no DLT needed on the international route |
| Meta Cloud API via Send SMS hook | $0.0014 | $0.0034 | no Twilio fee; our edge function |

Scale: 200 sign-ins a month ≈ **$10–16/mo** on Twilio Verify, ≈ **$0.50/mo** on the hook. Sign-ins are rare once a
session exists (sessions persist for a year), so the real driver is *new accounts*, not play.

## 3. Meta Business verification and the sender (the paperwork)

Who: Sree (Business Portfolio owner). Which entity: see Q21 — Candor PS LLC (Apple, D62) or MindWeave Tech (the
domain, the support address, the privacy policy). Meta checks that the display name, the website and the legal
document **agree**.

1. **Meta Business Portfolio** (business.facebook.com) for the entity; Sree as admin.
2. **WhatsApp Business Account** inside it — created through Twilio's *WhatsApp self sign-up* (Meta embedded sign-up,
   15 minutes), which also links the WABA to our Twilio account.
3. **Phone number**: a Twilio number (buy one; ~$1.15/mo) or a company number never used on personal WhatsApp.
4. **Display name** review: "EZ Score: Rummy" — must relate to the legal name or external branding; the store listing
   and `ezscore.mindweavetech.com` are the branding evidence. Usually hours; rejections come with a reason.
5. **Business verification** (Security Centre › Business verification): legal name, address, phone, website, one
   document — for a US LLC the **EIN letter (CP 575 / 147C) or Articles of Organization**; address on the document must
   match the portfolio. Up to 14 business days; 3 attempts. Not strictly required under 250 unique recipients a day,
   but required for the green display name and higher limits — do it.
6. **Template**: Twilio Verify's authentication template is pre-approved; nothing to submit. (The hook path would need
   our own *authentication* template with a Copy-code button, submitted in Meta's template manager — approval is
   automatic within minutes for authentication category.)
7. **Twilio Verify**: create a Verify Service, add the WhatsApp sender to it, copy Service SID + Account SID + Auth
   Token into Supabase › Authentication › Providers › Phone (Twilio Verify), **staging first**.

Risks: a mismatch between entity, website and display name is the usual rejection; a number already on personal
WhatsApp cannot be used; the WABA must be in the company portfolio, not Sree's personal one, or it dies with the
account.

## 4. One person, two keys (identity model)

Supabase: one `auth.users` row can hold **both** `email` and `phone`, each confirmed separately. We use that; no new
tables, no "linking" screen.

| Case | What happens |
| --- | --- |
| Existing email account adds WhatsApp | Profile › Sign-in methods › WhatsApp › number → `updateUser({ phone })` sends a code → `verifyOtp(type: 'phone_change')`. Same account, same Player ID, same passcode, same history. |
| New person signs up by WhatsApp | `signInWithOtp({ phone, channel: 'whatsapp' })` → code → session → name step → **claim step keyed on phone** (today's "Is this you? You played in G3 with Sree", matched on the seat's phone instead of email) → Yes merges the unregistered seat into the new account (existing `claim` RPC, phone key). |
| WhatsApp number already belongs to an account | Supabase signs them into *that* account — the code proves the number; no duplicate. |
| Number typed on a seat by a creator, but the owner has an email account with a different phone | Claim offers it; Yes attaches the number to the existing account (same `phone_change` path). |
| Email given at WhatsApp sign-up (optional) | stored unconfirmed, used for result emails only until confirmed; "Add a backup way in" confirms it with a code. |
| Removing a method | allowed only if another confirmed method remains. |
| Player ID | unchanged: one per account, assigned at first sign-up whichever method. |
| Delete account (D72) | the 30-day grace covers both methods; the phone is released at the end of the grace, not before (so a recycled number cannot re-claim history). |

Passcode: **not** for WhatsApp accounts (Q24). Sign-in = number + code; a persisted session means they type a code
about once a year per phone. Email accounts keep the passcode exactly as today.

## 5. Recovery when someone loses their number

- **Has a backup email** → sign in by email, Profile › WhatsApp › change number (code to the new number). Done.
- **WhatsApp-only, number gone** → nothing self-serve can prove it is them. Support (`support@mindweavetech.com`):
  Player ID + two game codes they played in; the creator of one of those games confirms; we set the new number. Rare,
  manual, logged.
- **Recycled number** (India: numbers go back to the pool after ~90 days unused; the new owner has WhatsApp on it):
  they would sign straight into the old account. Mitigations we take: the claim step shows the name on the account
  before anything else ("Is this you, Priya K?") with *Not me* → new account and the number is moved; the old account
  keeps its email key if it had one; sign-in from a new device sends the old email a note.
- **Nudge**: after the first saved game, a WhatsApp-only account sees one banner — "If you lose this number, an email
  is the only way back in. Add one?" (`wa-profile.png`, right). Once, dismissible.

## 6. Abuse and rate limits

- **OTP pumping / toll fraud** is an SMS problem (premium-rate numbers); WhatsApp has none — Twilio: "isn't exposed to
  telecom-network fraud, such as toll fraud". Another reason the fallback SMS button is off by default (Q25).
- Supabase defaults we keep: one code per number per 60 s; codes expire (set 10 min, not the 1 h default); project-wide
  SMS rate limit (set 30/hour, matches our size); **CAPTCHA (Cloudflare Turnstile)** on Create account and the WhatsApp
  sign-in button — Supabase supports it natively and the production checklist asks for it.
- Twilio: Verify **Fraud Guard** on (free), a **spend alert at $20/mo** and a hard **geo-permission** list: India, US,
  Canada, UK, UAE, Australia only — nobody at our tables is elsewhere; widen on request.
- The app: after 5 wrong codes the box locks for 15 minutes (Supabase counts attempts; we show the time).

## 7. Google Play and Apple

- **Play Data safety**: phone number is already declared (optional field today); it becomes "used for account
  management" as well — a form edit, resubmitted with the next build. **Not before the current review clears** (Sree's
  rule for D72 applies here too).
- **Play permissions**: none new. We never read SMS; the WhatsApp code is typed or pasted (the template's Copy button).
- **Account deletion** (Play policy, D72): must work for WhatsApp accounts too — it does, same flow.
- **Apple 4.8 Sign in with Apple**: applies only when a *third-party or social* login is offered. Phone / email OTP is
  first-party; no obligation. App Privacy label adds "Phone number · linked to you · account".
- **Apple review**: give the reviewer a Supabase test number with a fixed code so no WhatsApp device is needed.
- **Meta policy**: authentication templates only — no "game started" messages on WhatsApp without a separate *utility*
  template and the user's opt-in (Q27, later).

## 8. Screens (see the mockups)

- **Sign in** (`wa-sign-in.png`): Email | WhatsApp segmented control under the Joker card; the last method used on this
  phone is pre-selected. WhatsApp: country code from the SIM, number field, one green button *Send code on WhatsApp*
  (WhatsApp's green, the one place Palette B bends), small *Use SMS instead* link (Q25). Code step = the Forgot-passcode
  OTP box; auto-submit on the sixth digit; *Send again* with a 60-s countdown.
- **Create account** (`wa-sign-up.png`): same control; WhatsApp path asks name + number, email optional ("for results
  — you can add it later"). After the code: the existing claim step on phone.
- **Profile** (`wa-profile.png`): new group **Sign-in methods** — Email · WhatsApp · Passcode (email only); add / change
  either with a code; last method cannot be removed. Notifications gains a *WhatsApp* row, off, "codes only" until Q27.
- **Help** (`help-design.md`): sign-in page gains "Sign in with WhatsApp" and "I lost my number".
- Copy rules: "code", never "OTP"; "WhatsApp number", never "mobile"; the number shown as the user typed it, with
  country code.

## 9. Build plan (when Sree says go — after Google approves the current review)

1. Paperwork (Sree, §3): portfolio, WABA via Twilio, display name, verification. Start now; it is the long pole.
2. Staging: Twilio Verify + test numbers in `ezscore-staging`; nothing on live until the staging APK is tried.
3. App PR: `AuthShell` method control, `services/auth.ts` (`signInWithWhatsApp`, `verifyPhoneCode`, `addPhone`),
   claim RPC phone key (migration), Profile group, Help copy, flows + 360-dp frames. One PR, mockups → yes → build.
4. Live: Twilio keys into live Supabase, Data safety form, store build.

## 10. Decisions for Sree

- **Q20** Go ahead with WhatsApp sign-in on this spec (Twilio Verify, Supabase phone OTP), paperwork starting now, code after Google approves the current review? Default: yes.
- **Q21** Which entity owns the WhatsApp Business account — Candor PS LLC (Apple, D62) or MindWeave Tech (domain, support address, privacy policy)? Default: the one whose name the website and privacy policy show, MindWeave Tech; otherwise the site needs a "Candor PS" line.
- **Q22** Email optional for WhatsApp accounts (results email + backup only)? Default: optional, with the one-time backup nudge.
- **Q23** Lost-number recovery by support with Player ID + two game codes + the creator's confirmation — acceptable as the only path for WhatsApp-only accounts? Default: yes.
- **Q24** No passcode for WhatsApp accounts (code is the sign-in; sessions persist)? Default: no passcode.
- **Q25** SMS fallback button ("Use SMS instead") — on, or WhatsApp only? Default: off at launch (cost 2.5×, fraud surface); add if someone at a table cannot receive WhatsApp.
- **Q26** Spend cap: Twilio alert at $20/mo and geo list India, US, Canada, UK, UAE, Australia? Default: yes.
- **Q27** Later: WhatsApp for "game started" / results (utility template, opt-in, $0.0014–0.0034 each) instead of email for WhatsApp-only accounts? Default: not now; revisit after launch.
