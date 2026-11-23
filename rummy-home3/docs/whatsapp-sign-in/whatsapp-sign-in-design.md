# WhatsApp sign-in — design spec (not built)

**Sree, Nov 23 2026**: *"Also, can we start a PR to make it work for WhatsApp? We give a choice of using email or
WhatsApp. A lot of people in India will use WhatsApp. I need a design spec for this before we start."*

Mockups (this folder): `wa-sign-in.png` · `wa-sign-up.png` · `wa-profile.png` · `wa-backup.png`. Generator: `make-whatsapp-mockups.py`.
Decisions Sree needs to make are at the end (Q20–Q27 in `../decisions.md`).

## 0. The short version

- **Yes, and it is cheap to do well**: Supabase Auth already does phone OTP over WhatsApp when the SMS provider is
  Twilio Verify; the app change is one segmented control on Sign in / Create account plus the OTP box we already have.
- **The real work is not code**: a WhatsApp Business account for the company, a display-name review, business
  verification, and Twilio Verify wired to it. About a week of waiting on Meta, some of it Sree's paperwork.
- **The design question that matters is identity**: a person must stay *one account* whether they come in by email or
  by WhatsApp, and existing email accounts must lose nothing. This spec does that with Supabase's own model (one auth
  user can carry both an email and a phone) and the "Is this you?" claim step we already have, keyed on phone.
- **The risk that matters is recovery**: an account with one contact that loses it has no way back except support.
  Indian numbers are recycled after ~90 days of disuse. **Decided (Sree, Nov 23 — D75)**: every account is asked for
  a *backup contact* at sign-up (email → backup WhatsApp number; WhatsApp → backup email) with **Skip for now**, and
  reminded once after the first saved game. This is Google's recovery-phone / recovery-email pattern, and WhatsApp's own
  recovery-email step (both: ask at setup, Skip, add later in Settings); Apple treats every extra email and phone as a
  sign-in key, which is what the backup is here.
- **Where I question the idea**: (a) it should be *WhatsApp*, not "phone" — SMS to India costs 25× more and OTP SMS
  is the #1 fraud target; SMS is at most a fallback button. (b) WhatsApp accounts **do** set the same 6-digit passcode — Sree's point that "you can still use the old number and a
  password" makes the number a username like email, sign-ins free, one model for both (§5a; D76). (c) Not before Google
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

## 2. What costs money, and how much (Sree, Nov 23: "Sign-up, sign-in, all confusion")

**Sree**: *"Every time a message is sent, am I getting charged? 200 sign-ins is too little. What if this guy keeps logging
out and logging in a lot? … Do they also charge in cents in India too? When you say sign-in or sign-up?"*

### 2.1 The words

| Word | What it means here | Sends a WhatsApp message? |
| --- | --- | --- |
| **Sign-up** | first time: Create account → we must prove the number is theirs | **yes, one code** |
| **Sign-in** | an existing account on a phone that does not hold a session: new phone, reinstall, after *Log out* | **no** — number + passcode (D76) |
| **Staying signed in** | the normal case: the app keeps a session for a year or more; opening the app, playing, closing it | no |
| **Forgot passcode / recover** | they cannot get in the normal way | yes, one code |
| **Change number / add backup** | Profile › Sign-in methods | yes, one code to the *new* contact |
| **Email sign-up / recovery code** | the email path (Q16) | no WhatsApp; email is free up to 3,000 a month on Resend |

Nothing else sends a message. Scorecards, results and "game started" stay on email (Q27 is the question of ever using
WhatsApp for them; not now).

### 2.2 Who charges what (one code, delivered and typed correctly)

| | India | US | Charged when |
| --- | --- | --- | --- |
| Meta — the WhatsApp message | **₹0.115** (Meta's INR card; = $0.0014) | $0.0034 | only when **delivered**; a dead number costs nothing |
| Twilio Verify — the verification | **$0.05 ≈ ₹4.2** | $0.05 | only when the code is **typed correctly**; expired, wrong or abandoned codes are free |
| **One successful code** | **≈ ₹4.3 ($0.051)** | **≈ $0.053** | |
| Same code via Meta Cloud API directly (our edge function, no Twilio) | **₹0.115** | $0.0034 | the switch we make if codes pass ~1,000 a month |
| SMS instead of WhatsApp (Q25) | ₹11 ($0.133) per attempt, delivered or not | $0.058 | why SMS is off by default |

Twilio bills the company in USD whatever the recipient's country; Meta's fee comes through Twilio in USD too. "Cents in
India" is right: the India *rate* is lower (₹0.115 vs ₹0.29 for the US message), but the Twilio $0.05 is the same
everywhere and is 97 % of the cost. That is the whole argument for the Meta-direct switch later.

### 2.3 Numbers that mean something

Sessions persist, so the cost driver is **accounts and devices, not play**. Two models were costed; **D76 picked the first** (passcode), the second row stays for the record:

| Year 1, 1,000 WhatsApp accounts | Codes | Cost via Twilio Verify | Cost via Meta direct |
| --- | --- | --- | --- |
| Sign-ups | 1,000 | ₹4,300 ($51) | ₹115 |
| Forgot passcode / recovery (~5 %) | 50 | ₹215 | ₹6 |
| Number changes + backups added (~15 %) | 150 | ₹645 | ₹17 |
| **Number + passcode sign-in (Q24 b)** — sign-ins free | **1,200** | **≈ ₹5,200 ($61) a year** | **≈ ₹140 a year** |
| Code-only sign-in (Q24 a): + new phone / reinstall / log-out, ~1.5 per account per year | +1,500 | **≈ ₹11,600 ($137) a year** | ≈ ₹310 |

The "logs out and in a lot" person: in model (b) he costs nothing — passcode, no message. In model (a) a daily log-out /
log-in is 30 codes = ₹130 ($1.54) a month *for that one person*; Supabase's limits cap any single number at 1 code per
60 s and we set 5 an hour / 20 a day, so the worst one number can cost is ≈ ₹86 a day, and the spend alert (Q26) fires
at $20 a month. Email accounts cost nothing in either model.

"200 sign-ins a month" in the first draft was a guess at *codes sent*; the table above replaces it.

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

## 5. Recovery when someone loses their number (or email)

**Sree, Nov 23**: *"I'm concerned about even the email and WhatsApp. I think we should have a second way to connect with
anyone so that if something goes wrong with that email or with WhatsApp, we still have a phone number, right? … look at
what other people already do to keep it simple, so we're not reinventing the wheel."* His pick: **"Ask for a backup
contact at signup with a skip option and a later reminder."**

What others do: Google asks for a recovery phone and a recovery email during sign-up, both skippable, and nudges later
("Protect your account with recovery info"); WhatsApp's two-step setup asks for a recovery email with a Skip and lets
you add it under Settings › Account; Apple lets every verified extra email or phone sign you in. We copy that shape
(`wa-backup.png`):

- **Step 2 of 2 at sign-up**, right after the code: "Add a backup" — the other contact type, confirmed with a code,
  **Skip for now** always visible. A confirmed backup is a full second sign-in key (one Supabase user, both `email` and
  `phone`), so recovery is just "sign in the other way, then change the lost contact in Profile".
- **One reminder** after the first saved game for anyone who skipped (a card on Home, `Add email` / `Not now`); Not now
  dismisses it for good. Profile › Sign-in methods keeps the "Add a backup way in" row.
- Existing email accounts get the same reminder once after this ships (they have a passcode but one contact).

### 5a. When the phone number changes (Sree, Nov 23)

**Sree**: *"What if their phone number changes? … cases where a phone number changed all of a sudden and how the whole
WhatsApp thing gets affected. Be careful with that, because email is easy. Even if emails change, you can still log in
with the email ID and password. When WhatsApp changes, also, I think it's possible you can still use the old number and a
password, even though you have a new number. Once you go in, somewhere you have to make that change."*

He is right, and it points at the one design choice that matters: **if a WhatsApp account has a passcode, the number is
just a username** — exactly like email. Supabase supports it (`signInWithPassword({ phone, password })`); the code is
then only for proving a *new* number (sign-up, change number, forgot passcode). Decided (D76): **WhatsApp accounts set the same 6-digit passcode email accounts do.** One model for both methods, sign-ins cost
nothing, and his scenario works as he described it. The cases, with that model (D76) and the backup contact (D75):

| Case | What happens | What they do |
| --- | --- | --- |
| **1. New number, still signed in on the same phone** (the common case: SIM swap, WhatsApp's own *Change number*) | Nothing breaks; the session does not depend on the number. Only a *future* code would go to the old number. | Profile › Sign-in methods › WhatsApp › **Change number** → code on WhatsApp to the new number → done. Until they do, the WhatsApp row shows the old number so they can see it. |
| **2. New number, signed out / new phone / reinstall, old number dead** | Sign in with **old number + passcode** — no message is sent, so the dead number does not matter. | Then Change number as in case 1. This is Sree's "use the old number and a password" and it is the main path. |
| **3. Same as 2 and the passcode is forgotten** | Forgot passcode sends a code to the account's contacts: WhatsApp (dead) **or the backup email** (D75). | Code to the backup email → in → set a passcode → Change number. |
| **4. Same as 3, no backup, number dead** | Nothing self-serve can prove it is them. | Support (Q23): Player ID + two game codes + a creator's confirmation; we set the new number. |
| **5. Old number recycled to a stranger** (India: ~90 days unused) | The stranger has WhatsApp on that number but **not the passcode**. Forgot passcode would send a code to that number — so: if the account has a backup email, recovery by WhatsApp code alone is refused and the email must confirm; if it has none, the recovery screen shows the account's name first ("Is this you, Priya K?") and *Not me* creates a fresh account and detaches the number. | The original owner, when they return, signs in with the new number (case 1 or 2) — the account still carries their passcode and backup. |
| **6. WhatsApp down, banned, or the person has no WhatsApp today** | Sign-in needs no message in model (b). Only sign-up and recovery wait. | *Use SMS instead* (Q25) if we turn it on; otherwise try later or use the backup email. |
| **7. Moved abroad, new country code** | Same as case 1 or 2; Meta charges by the recipient's country. | Change number; the country picker is on the field. |
| **8. Email changed** (the email account mirror) | Same shape: email + passcode still works (today's behaviour); change the email in Profile with a code to the new one; backup WhatsApp number covers the lost-mailbox case. | Profile › Sign-in methods › Email › Change. |

What we cannot do: detect a SIM change by ourselves (Android gives no reliable signal, iOS none). What we do instead:
a code that Twilio reports *undelivered* makes the screen say "That number is not on WhatsApp any more — sign in with
your passcode and change it in Profile."

Cases:

- **Has a backup email** → sign in by email, Profile › WhatsApp › change number (code to the new number). Done.
- **WhatsApp-only, number gone** → nothing self-serve can prove it is them. Support (`support@mindweavetech.com`):
  Player ID + two game codes they played in; the creator of one of those games confirms; we set the new number. Rare,
  manual, logged.
- **Recycled number** (India: numbers go back to the pool after ~90 days unused; the new owner has WhatsApp on it):
  they would sign straight into the old account. Mitigations we take: the claim step shows the name on the account
  before anything else ("Is this you, Priya K?") with *Not me* → new account and the number is moved; the old account
  keeps its email key if it had one; sign-in from a new device sends the old email a note.
- **Lost the email instead** (mailbox closed, provider lock-out): same shape — sign in with the backup WhatsApp number,
  change the email in Profile. Without a backup: support, same evidence.

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
- **Create account** (`wa-sign-up.png`): same control; WhatsApp path asks name + number. After the code: **Add a backup**
  (step 2 of 2, Skip for now — `wa-backup.png`), then the existing claim step on phone. Email path gets the mirror
  step: a backup WhatsApp number.
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
- ~~**Q22**~~ answered Nov 23 (D75): a backup contact is asked at sign-up with Skip and reminded once later; it is a second sign-in key.
- **Q23** For accounts that skipped the backup and lost their only contact: support with Player ID + two game codes + the creator's confirmation, as the only path? Default: yes.
- ~~**Q24**~~ answered Nov 23 (D76): "Yes, use the same 6-digit passcode for WhatsApp and email accounts." Sign-in = number + passcode, no message; codes only prove a new number.
- **Q25** SMS fallback button ("Use SMS instead") — on, or WhatsApp only? Default: off at launch (cost 2.5×, fraud surface); add if someone at a table cannot receive WhatsApp.
- **Q26** Spend cap: Twilio alert at $20/mo and geo list India, US, Canada, UK, UAE, Australia? Default: yes.
- **Q27** Later: WhatsApp for "game started" / results (utility template, opt-in, $0.0014–0.0034 each) instead of email for WhatsApp-only accounts? Default: not now; revisit after launch.
