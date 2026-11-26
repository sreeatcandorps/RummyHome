# WhatsApp sign-in — design spec (refreshed Nov 25, not built)

**Refreshed Nov 25 (D116).** Sree, Nov 25, 9:40 PM PT: *"What about the WhatsApp integration? I think I kind of want
that done too. There's no reason to wait for that! Because once the app is live, I want people in India to be able to
use it immediately. If the WhatsApp integration is done, I think I will have an app that works completely, and I think
at that point we should freeze the code."*

My reading: WhatsApp sign-in is built **before** the code freeze, not after Play goes live (that was D84). Show, then
build: these pictures come first, and code starts on Sree's yes to them. **The one thing to decide: are the
pictures in §8 right?** If there is no answer, nothing is built; the build waits for that yes.

Pictures (open on a phone, no login):
[Create account](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/whatsapp-spec-refresh-253d/rummy-home3/docs/whatsapp-sign-in/wa-create-account.png) ·
[Code step](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/whatsapp-spec-refresh-253d/rummy-home3/docs/whatsapp-sign-in/wa-code-step.png) ·
[Sign in](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/whatsapp-spec-refresh-253d/rummy-home3/docs/whatsapp-sign-in/wa-sign-in.png) ·
[Profile](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/whatsapp-spec-refresh-253d/rummy-home3/docs/whatsapp-sign-in/wa-profile.png) ·
[Backup (D75)](https://raw.githubusercontent.com/sreeatcandorps/RummyHome/cursor/whatsapp-spec-refresh-253d/rummy-home3/docs/whatsapp-sign-in/wa-backup.png).
Flows: [`flows.md`](flows.md) (`flows-1.png` … `flows-9.png`).

## Sree's paperwork checklist

In this order. **[staging]** means the WhatsApp staging APK cannot get a real WhatsApp code until the step is done.
**[live]** means only going live waits for it. **None of the steps holds up writing the code**: the tests use
Supabase test numbers with fixed codes, so the build starts the day Sree says yes to the pictures.

1. **[staging]** Create the Meta Business Portfolio at business.facebook.com (or use Candor PS's, if one exists): legal business name *Candor PS LLC*, business name *MindWeave* (D118), website ezscore.mindweavetech.com, Sree as admin. Free.
2. **[live]** File the California DBA *MindWeave* for Candor PS LLC (D121): a Fictitious Business Name statement at the county clerk, then the newspaper notice for four weeks. Build Bot fills the forms; Sree signs and pays. It links the business name Meta shows (MindWeave) to the legal name on the EIN letter, so it is done before step 6. The website says only *MindWeave* (D123: "CandorPS shouldn't even show up unless it's mandatory").
3. **[staging]** Upgrade the Twilio account to paid (a card and a $20 first top-up) and buy a new US local number, about $1.15 a month, used only for the codes (D120, Sree: "Q47: use a new Twilio number").
4. **[staging]** In the Twilio Console, run WhatsApp *Self Sign-up* with that number: it creates the WhatsApp Business Account inside the step 1 portfolio and links it to Twilio (about an hour); the display name is *EZ Score* (D119).
5. **[live]** Wait for Meta's display-name review of *EZ Score* (usually a day or two); if Meta rejects it, fix what the email says and resubmit.
6. **[live]** Start business verification in Meta's Security Centre with the EIN letter (CP 575 or 147C) for Candor PS LLC, the address exactly as on the letter; it is free and can take one to two weeks or more, so start it the same day as step 4.
7. **[staging]** In Twilio, create a Messaging Service holding the WhatsApp sender, then a Verify service named *EZ Score* with 6-digit codes, pick that Messaging Service on its WhatsApp tab, set a usage alert at $20 a month (Q26), and allow only India, US, Canada, UK, UAE and Australia.
8. **[staging]** Put the Twilio Account SID, Auth Token and Verify Service SID into the **staging** Supabase project only (Authentication › Sign In / Providers › Phone › Twilio Verify, WhatsApp on), or add them as Cloud Agent secrets and Build Bot does it; live gets them only after Sree has tried the staging APK and says yes.

**Costs.** The Twilio number is about $1.15 a month. Each code that is typed correctly costs about $0.05 to Twilio,
plus Meta's fee for each delivered WhatsApp message: ₹0.115 (about $0.0014) to an Indian number. A code that is never
typed costs only Meta's ₹0.115. **Signing in with a passcode sends nothing and is free** (D76). The portfolio,
the display name and business verification are free. For 1,000 WhatsApp accounts in a year: about $76 in total
(§2.3).

## 0. The short version

- **What it is.** Create account and Sign in get a *WhatsApp · Email* switch at the top. A WhatsApp account is a
  number and the same 6-digit passcode email accounts use (D76). Signing in is number + passcode and sends nothing.
  One WhatsApp code is sent only to prove a number: at sign-up, for Forgot passcode, and when adding or changing a
  number.
- **One code screen.** The WhatsApp code step is the email code step from the sign-up code PR (D101): the same
  screen and component, with "Check WhatsApp" for "Check your email" (`wa-code-step.png`).
- **WhatsApp is a way to sign in, not a way to be found** (D113). Nobody is matched or linked by phone number;
  linking stays by Player ID only. Nobody ever sees another person's number. The Nov 23 "Is this you?" claim step
  keyed on phone is gone, and so is the claim migration it needed.
- **One person, one account, up to two ways in.** Supabase lets one user hold both an email and a phone number, each
  confirmed by a code. Profile gets a *Sign-in methods* group to add or change either. Existing email accounts lose
  nothing (§4).
- **Backup contact (D75)** is asked once right after sign-up with *Skip for now*, and reminded once after the first
  saved game. A confirmed backup is a second way in.
- **The real work is paperwork** (the checklist above): Meta portfolio, WhatsApp account through Twilio, display name,
  business verification. Verification can take weeks, so it starts now; it holds up going live, not the build.
- **Cheap.** About $0.05 per sign-up; sign-ins free; no SMS at launch (Q25).
- **When.** Before the code freeze (D116), and in the next staging APK: the APK waits for WhatsApp (D117, Sree: "Q46: yes, the staging APK should wait for WhatsApp").

## 1. How it works (Supabase + Twilio Verify + Meta)

```
Create account ─► supabase.auth.signUp({ phone, password, options: { channel: 'whatsapp' } })
                        │
                        ▼
                  Supabase Auth ─► Twilio Verify ─► Messaging Service (our WhatsApp sender) ─► WhatsApp
                                       (Meta's authentication template: "482913 is your verification code …")
                        │
Code step  ─► supabase.auth.verifyOtp({ phone, token, type: 'sms' }) ─► session (signed in)

Sign in    ─► supabase.auth.signInWithPassword({ phone, password })   no message, no cost
```

- Supabase: *"At this time, WhatsApp is only supported as a channel for the Twilio and Twilio Verify Providers"*
  (Phone sign-in docs, checked Nov 26). `verifyOtp` uses `type: 'sms'` for both channels; a number change uses
  `type: 'phone_change'`.
- **Twilio Verify, not Programmable Messaging.** Verify makes the code, checks it, expires it after 10 minutes and
  uses Meta's pre-approved *authentication* template with a Copy code button. Supabase's Twilio Verify provider needs
  three values: Account SID, Auth Token, Verify Service SID.
- **Our own WhatsApp sender.** Since March 1, 2024 Twilio Verify sends WhatsApp codes only from the customer's own
  sender: a WhatsApp Business Account (WABA) in the company's Meta portfolio, with a number not on WhatsApp already.
  The sender sits in a Twilio *Messaging Service*; the Verify service points at it on its WhatsApp tab. A US Twilio
  number works for Indian players: Meta prices by the **player's** country code.
- **Three Supabase gotchas found while re-checking** (read in Supabase Auth's source, Nov 26):
  1. **Send a new code must not use `auth.resend`.** For phone numbers it always sends an **SMS**, whatever the first
     channel was. The app asks again the same way it asked first (`signUp`, `signInWithOtp` or `updateUser` with
     `channel: 'whatsapp'`), so WhatsApp stays WhatsApp.
  2. **`updateUser` has no `channel` in its TypeScript type**, but passes it through to the server. Adding or
     changing a number sends `{ phone, channel: 'whatsapp' }`; a unit test pins it.
  3. **Test numbers work with no Twilio at all.** Supabase checks `[auth.sms.test_otp]` before it calls any provider,
     so CI, Maestro and the Apple reviewer sign in with a fixed code and nothing is sent. The WhatsApp channel still
     needs the provider set to Twilio Verify in config (dummy keys locally).
- **Meta Cloud API directly** (no Twilio) stays the later option: Supabase's *Send SMS hook* hands an edge function
  `{ phone, otp }`, and we call Meta with our own authentication template. It saves Twilio's $0.05 per code but we own
  the template, retries and limits. Not before about 1,000 codes a month (§2.3).

## 2. What costs money, and how much

Re-checked Nov 26: Twilio Verify pricing page (current as of Oct 2026), Twilio's WhatsApp price list, Meta's rate
card effective Oct 1, 2026.

**Sree, Nov 23**: *"Every time a message is sent, am I getting charged? 200 sign-ins is too little. What if this guy
keeps logging out and logging in a lot? … Do they also charge in cents in India too? When you say sign-in or
sign-up?"*

### 2.1 The words

| Word | What it means here | Sends a WhatsApp message? |
| --- | --- | --- |
| **Sign-up** | first time: Create account; we must prove the number is theirs | **yes, one code** |
| **Sign-in** | an existing account on a phone with no session: new phone, reinstall, after *Log out* | **no**: number + passcode (D76) |
| **Staying signed in** | the normal case: the app keeps a session for a year or more | no |
| **Forgot passcode** | they cannot get in the normal way | yes, one code |
| **Add or change a number, add a backup** | Profile › Sign-in methods, or the backup step | yes, one code to the **new** number (an email backup gets an email code, free) |
| **Email sign-up code** | the email path (D101) | no WhatsApp; email is free up to 3,000 a month on Resend |

Nothing else sends a WhatsApp message. Scorecards, results and "game started" stay on email (Q27, after v1).

### 2.2 Who charges what (one code)

| | India | US / Canada | UK | UAE | Australia | Charged when |
| --- | --- | --- | --- | --- | --- | --- |
| Meta, the WhatsApp message (through Twilio) | **₹0.115 ($0.0014)** | $0.0034 | $0.022 | $0.0157 | $0.0113 | only when **delivered**; a dead number costs nothing |
| Twilio Verify, the verification | **$0.05 (≈ ₹4.25)** | $0.05 | $0.05 | $0.05 | $0.05 | only when the code is **typed correctly**; wrong, expired or abandoned codes are free |
| **One successful code** | **≈ $0.051 (≈ ₹4.4)** | ≈ $0.053 | ≈ $0.072 | ≈ $0.066 | ≈ $0.061 | |
| The same code through Meta directly (later) | ₹0.115 | $0.0034 | $0.022 | $0.0157 | $0.0113 | |
| SMS instead (Q25: not at launch) | ≈ $0.13 per attempt, delivered or not | | | | | why SMS is off |

Rupees at about ₹85 to the dollar. Twilio bills the company in dollars whatever the player's country. "Cents in India"
is right: Meta's India rate is the lowest of the six, but Twilio's $0.05 is the same everywhere and is 97 % of an
Indian code. Meta has a higher "authentication-international" rate for India ($0.0304), but it applies only to
businesses sending more than 750,000 such messages a month; it does not apply to us.

### 2.3 Numbers that mean something

Sessions last, so the cost follows **accounts and new phones, not play**.

| Year 1, 1,000 WhatsApp accounts | Codes | Through Twilio Verify | Through Meta directly |
| --- | --- | --- | --- |
| Sign-ups | 1,000 | ≈ $51 (₹4,370) | ₹115 |
| Forgot passcode (~5 %) | 50 | ≈ $2.60 | ₹6 |
| Numbers changed, WhatsApp backups added (~15 %) | 150 | ≈ $7.70 | ₹17 |
| Sign-ins with number + passcode (D76) | 0 | **free** | free |
| The Twilio number, 12 months | | $13.80 | (a number is still needed) |
| **Total** | **1,200** | **≈ $76 a year (≈ $6.30 a month)** | ≈ ₹140 + the number |

The "logs out and in a lot" person costs nothing: passcode, no message. The worst one number can cost is capped by
Supabase (one code a minute) and Twilio Verify (five sends in ten minutes), and the $20 alert (Q26) fires long
before anything adds up. Email accounts cost nothing.

## 3. Meta and Twilio paperwork (the detail behind the checklist)

Who: Sree, as the portfolio owner. **Which entity, decided (D77).** Sree: *"I think it should be Mindweave because
that's the company I'm going to use DBA as for CandorPS. But anywhere we need legal names, it would be CandorPS."* and
*"they don't even have to see Mindweave. They can just see EZ Score Rummy as of now, and then the next layer is
Mindweave, and then the next layer is CandorPS if they ever need it."*

| Layer | Name | Where it appears |
| --- | --- | --- |
| What players see | **EZ Score** (WhatsApp, D119) · **EZ Score: Rummy** (store listing, email sender) | WhatsApp display name; the app's own name |
| Brand | **MindWeave** (D118; no "Tech") | Business Portfolio name, ezscore.mindweavetech.com, support address, privacy policy |
| Legal | **Candor PS LLC** | the portfolio's legal business name, the verification document (EIN letter), Apple (D62) |

Meta checks that the display name, the website and the document **agree**. The legal name on the EIN letter is
Candor PS LLC; the portfolio shows MindWeave and the website says only MindWeave (D123). The California DBA (D121)
is the paper that ties MindWeave to Candor PS LLC, and Meta may ask for it when the two names differ, so it is filed
before business verification (checklist step 2). Sree on the names: *"Let's just call it MindWeave, simple, like
Google"*, *"just say EZ Score … all of the scoring apps will be called EZ Score"*, and *"CandorPS shouldn't even
show up unless it's mandatory."*

What was re-checked on Nov 26 (Twilio and Meta docs), and what changed from the Nov 23 text:

- **Twilio account.** Self Sign-up needs an upgraded (paid) Twilio account; the first top-up is at least $20. With an
  Indian card Twilio cannot auto-recharge (RBI rule); a US card can.
- **The number.** A Twilio number or our own, but never registered on WhatsApp or WhatsApp Business before. A Twilio
  US local number is $1.15 a month. It only receives Meta's one registration code; it sends no SMS, so no US SMS
  registration (10DLC) is needed.
- **Self Sign-up** (Twilio Console › Messaging › Senders › WhatsApp senders) opens Meta's pop-up, creates the WABA
  inside our portfolio and links it to Twilio; about an hour. Twilio keeps one WABA per Twilio account. **New since
  Nov 23:** the sender must be put in a **Messaging Service**, and the Verify service's WhatsApp tab points at it.
- **Display name.** Meta reviews *EZ Score* after registration. If rejected, the sender is held at 250
  messages a day and can be cut off, so it blocks going live. The store listing and the website are the evidence
  that the name is ours.
- **Business verification** (Meta Security Centre): legal name, address, phone, website, and one document; for a US
  LLC the EIN letter (CP 575 or 147C) or the Articles of Organization, the address matching the portfolio. Free;
  "can take several weeks" (Twilio). It is **not** "Meta Verified" (a paid blue badge; we do not need it). Until it is
  done, the whole portfolio can reach **250 different numbers a day**: plenty for staging, too few for a launch in
  India, so it blocks going live.
- **Template.** Twilio Verify uses Meta's authentication template; nothing to write or submit. The wording is Meta's:
  *"482913 is your verification code. For your security, do not share this code."* with a Copy code button.
- **Twilio Verify service.** Code length 6; WhatsApp channel on, pointing at the Messaging Service; the usage alert
  at $20 a month and the six countries (Q26).
- **Keys to Supabase, staging first.** Account SID, Auth Token, Verify Service SID go into `ezscore-staging` only.
  Live gets them after Sree tries the staging APK and says yes to that step (§9).

Risks: a mismatch between the legal name, the website and the display name is the usual rejection; a number already
on WhatsApp cannot be used; the WABA must be in the company portfolio, not Sree's personal Facebook, or it dies with
that account.

## 4. One person, two keys (identity)

Sree's rule since D113: people are **found and linked only by Player ID**. So a WhatsApp number is a way to **sign
in**, like an email address. It is never searched, never matched to a player, never saved on a player, and never
shown to anyone else.

Supabase: one `auth.users` row can hold **both** `email` and `phone`, each confirmed by its own code. That is the
whole model: no new tables, no linking screen, no matching.

| Case | What happens |
| --- | --- |
| New person signs up by WhatsApp | `signUp({ phone, password: passcode, options: { channel: 'whatsapp', data: { first_name, last_name } } })` → one code → the code step → `verifyOtp(type 'sms')` → signed in. A Player ID is given, as for email. Then the backup step (D75). **No "Is this you?" step.** |
| The number already has an account | "That number already has an account." with **Sign in** and **Forgot passcode?**, the same as an email that is taken today. No duplicate account. |
| Existing email account adds WhatsApp | Profile › Sign-in methods › WhatsApp › Add → `updateUser({ phone, channel: 'whatsapp' })` → code to that number → `verifyOtp(type 'phone_change')`. Same account, Player ID, passcode and games. |
| WhatsApp account adds a backup email | the backup step or Profile › Email › Add a backup → `updateUser({ email })` → code by email → `verifyOtp(type 'email_change')`. |
| A creator added this person by initials before they had the app | Unchanged by WhatsApp: the creator links the seat to their Player ID and they tap Yes (D113). Their number plays no part. |
| Changing a number or email | the same as adding: one code to the **new** one; the old one stops working at once. |
| Removing a method | **not offered** (D50): change it instead. Nobody can remove their last way in, and no dialog is needed to explain why not. |
| The passcode | one 6-digit passcode for the account, whichever way they sign in (D76). |
| The optional phone on the email form | stays what it is today: a private contact detail, never texted, never searched (D113). It is not the WhatsApp sign-in number and is not copied into it. (The new question in §10 asks whether to drop it.) |
| Delete account (D72) | the 30-day grace covers both ways in. The number is released at the end of the grace, not before, so a recycled number cannot walk into the old account during it. |

**Where WhatsApp numbers live:** only in Supabase Auth (`auth.users.phone`), which no other user can read. Not in
`profiles`, `players`, game data, result images or share pages. A confirmed email, by contrast, is copied to the
profile as today, so result emails reach a backup email too (§9.1).

## 5. Recovery when someone loses their number (or email)

**Sree, Nov 23**: *"I'm concerned about even the email and WhatsApp. I think we should have a second way to connect
with anyone so that if something goes wrong with that email or with WhatsApp, we still have a phone number, right? …
look at what other people already do to keep it simple, so we're not reinventing the wheel."* His pick (D75): *"Ask
for a backup contact at signup with a skip option and a later reminder."*

What others do: Google asks for a recovery phone and email at sign-up, both skippable, and nudges later; WhatsApp's own
two-step setup asks for a recovery email with Skip. We copy that shape (`wa-backup.png`):

- **Right after the code at sign-up**: *Add a backup*, the other kind of contact, confirmed with a code, **Skip for
  now** always there. A confirmed backup is a full second way in.
- **One reminder** after the first saved game for anyone who skipped (a card on Home: *Add email* / *Not now*). Not now
  hides it for good. Profile keeps *Add a backup*.
- Existing email accounts see the same one reminder once after this ships.
- **No backup and the only contact is gone** (Q23, adopted by D116): support at support@mindweavetech.com. The person
  gives their Player ID and two game codes they played in; the creator of one of those games confirms; we set the new
  number or email. Rare, by hand, logged.

### 5a. When the phone number changes (Sree, Nov 23)

**Sree**: *"What if their phone number changes? … Be careful with that, because email is easy. Even if emails change,
you can still log in with the email ID and password. When WhatsApp changes, also, I think it's possible you can still
use the old number and a password, even though you have a new number. Once you go in, somewhere you have to make that
change."*

D76 makes that work: with a passcode, **the number is just a username**, like an email.

| Case | What happens | What they do |
| --- | --- | --- |
| **1. New number, still signed in** (most people: SIM swap, WhatsApp's own Change number) | Nothing breaks; the session does not depend on the number. | Profile › WhatsApp › **Change number** → code to the new number → done. |
| **2. New number, signed out or new phone, old number dead** | Sign in with the **old number + passcode**. No message is sent, so the dead number does not matter. | Then Change number as in case 1. This is Sree's "use the old number and a password". |
| **3. As 2, and the passcode is forgotten** | Forgot passcode by **Email** sends the code to the backup email (D75). | Code → new passcode → Change number. |
| **4. As 3, no backup** | Nothing self-serve can prove it is them. | Support (Q23), as above. |
| **5. Old number recycled to a stranger** (India: about 90 days unused) | The stranger has WhatsApp on that number but **not the passcode**, so they cannot sign in. If they tap Forgot passcode, the code reaches them; the *Set a new passcode* screen then says *"This is the account of Priya K · #57. Not you?"* | *Not you?* moves the number to a fresh account for the stranger; the old account keeps its backup email, if any. One line on a screen they already see; no extra dialog. |
| **6. WhatsApp is down, or the person has no WhatsApp today** | Sign-in needs no message. Only sign-up and Forgot passcode wait. | Try later, or use email. (No SMS at launch, Q25.) |
| **7. Moved abroad, new country code** | Same as case 1 or 2. | Change number; the country picker is on the field. |
| **8. Email changed** | Same shape the other way: email + passcode still works; change it in Profile with a code to the new address; a backup WhatsApp number covers a lost mailbox. | Profile › Email › Change. |

What we cannot do: notice a SIM change ourselves (Android gives no reliable signal, iPhone none). Instead, when
Twilio reports a code as not delivered, the code step says: *"That number is not on WhatsApp any more. Sign in with
your passcode, then change it in Profile."*

Dropped from the Nov 23 text (D50): the "Is this you?" name check before every WhatsApp recovery, the rule that a
backup email must also confirm a WhatsApp recovery, and the "signed in on a new phone" email. One line on the
passcode screen covers the recycled-number case.

## 6. Abuse and limits

- **SMS fraud** (pumping codes to premium-rate numbers) is an SMS problem. WhatsApp does not have it, and there is no
  SMS at launch (Q25).
- **Supabase**: one code a minute per number; 30 codes an hour for the whole project (its default; raised if a busy
  evening ever hits it).
- **Twilio Verify**: codes last 10 minutes; at most 5 sends to one number in 10 minutes; 5 wrong tries close a code
  (the app then says "That code is wrong or has expired … tap Send a new code", D101's words). These are Twilio's own
  rules; we add nothing.
- **Q26 (adopted by D116)**: a Twilio usage alert at $20 a month, and numbers from six countries only: India, US,
  Canada, UK, UAE, Australia. The app's country picker offers only those six for WhatsApp, and the Verify service's
  country settings list the same six.
- **No CAPTCHA at launch** (changed from Nov 23, D50). It was there against SMS fraud. Without SMS, a script can only
  send WhatsApp codes it cannot read: within the 30-an-hour limit, about ₹83 ($1) a day to Indian numbers and nothing
  to Twilio. If the alert ever fires, Cloudflare Turnstile is the next step; Supabase supports it.

## 7. Google Play and Apple

- **Play Data safety**: "phone number" is already declared (the optional field). It becomes "used for account
  management" as well: a form edit sent with the WhatsApp build.
- **Play permissions**: none new. We never read SMS; the code is typed or pasted (WhatsApp's Copy code button).
- **Account deletion** (Play policy, D72): the same flow works for WhatsApp accounts.
- **Apple 4.8 (Sign in with Apple)**: applies only to third-party or social logins. A phone or email code is the
  app's own sign-in, so no obligation. The App Privacy label adds "Phone number · linked to you · account".
- **Reviewers** (Google and Apple): a Supabase test number with a fixed code, so no WhatsApp phone is needed. It goes
  in the review notes beside the email test account.
- **Meta policy**: authentication messages only. Anything else on WhatsApp ("game started", results) needs a separate
  template and the player's opt-in (Q27, after v1).

## 8. Screens (the pictures)

Every picture is a 360-dp phone (Sree's phone width), light mode.

- **(a) Create account** (`wa-create-account.png`). A *WhatsApp · Email* switch at the top of the card. WhatsApp:
  first and last name, *WhatsApp number* with the country picker (+91 first when the phone is set to India; the six
  countries only), the hint *"We send a 6-digit code to this number on WhatsApp to confirm it."*, the 6-digit passcode
  with *"Numbers only. You sign in with your number and this passcode."*, **Create account**, *Clear form*. Email:
  today's form from the sign-up code PR, unchanged under the switch. No Player ID box on either (D105). The switch
  starts on WhatsApp when the phone is set to India, on Email elsewhere.
- **(b) The code step** (`wa-code-step.png`). The **same screen and component** as the email step (D101): one
  `OtpField`, **Confirm and sign in**, *Send a new code* with a 60-second countdown, *Wrong number? Go back*. The
  WhatsApp words: title *Check WhatsApp*, *"We sent a 6-digit code to WhatsApp +91 98xxx xx210"* (the middle of the
  number hidden), label *Code from WhatsApp*, the WhatsApp icon. The error words are D101's. The invite note under
  the email step ("Opened an invite …? … Home asks 'Is this you?'") is not shown for WhatsApp, and goes from the email
  step too once D113 is built, since nobody is matched by contact any more.
- **(c) Sign in** (`wa-sign-in.png`). The Joker card (D69) and the same switch, remembering the way last used on this
  phone. WhatsApp: number + passcode, **Sign in**, *Forgot passcode?*. A wrong pair: *"That number and passcode do not
  match."* Forgot passcode has the same switch: *Send code* → the code step → *Set a new passcode* → Home.
- **(d) Profile** (`wa-profile.png`). A new group **Sign-in methods** under the name: *Email*, *WhatsApp*,
  *Passcode*. A missing one reads *Add a backup*. Tap → a sheet with the new number or address → *Send code* → the
  code step → back to Profile. *Change passcode* moves here from *Account*. No Remove. Only the owner sees these rows.
- **Backup (D75)** (`wa-backup.png`): the step after sign-up with *Skip for now*, and the one Home reminder.
- **Help** (`help-design.md`): the sign-in page gains "Sign in with WhatsApp", "I changed my number" and "Add a
  backup". The Account topic's "Can I change my email? Not yet." becomes "Profile › Sign-in methods › Email".
- **Words**: "code", never "OTP"; "WhatsApp number", never "mobile"; numbers shown with the country code.

## 9. Build plan (before the code freeze, D116)

1. **Now, Sree**: the paperwork checklist. Steps 1, 3, 4, 7, 8 are needed for a real WhatsApp code on the staging
   APK; steps 2, 5, 6 only for going live. Verification is the long wait, so it starts first.
2. **On Sree's yes to the pictures**: one app PR, built and tested entirely on Supabase test numbers (no Twilio, no
   Meta). The Maestro flows run on CI with fixed codes.
3. **One staging APK with everything, WhatsApp included** (D117). It is built on Sree's yes once the other pending
   items have landed and checklist step 8 is done; Sree signs up with his own number and gets a real code.
4. **Live**, each step on its own yes: the Twilio keys in live Supabase, the Play Data safety edit, the store build.
   Live waits for the display name (step 5) and business verification (step 6).
5. **Then the freeze** (D116): "If the WhatsApp integration is done, I think I will have an app that works
   completely, and I think at that point we should freeze the code."

### 9.1 What the app change is

So the build PR is fast after Sree's yes. The build touches: **`components/ui/AuthShell.tsx`** (the *WhatsApp ·
Email* switch, shared by Sign in, Create account and Forgot passcode); **`services/auth.ts`** (`signUpWithWhatsApp`,
`signInWithPhone`, `sendPhoneCode`, `verifyPhoneCode`, `addOrChangePhone`, `addOrChangeEmail`; "send a new code"
repeats the first call with `channel: 'whatsapp'`, never `auth.resend`); **`utils/signUpCode.ts`** (the D101 words
by channel: the WhatsApp title, subtitle, label, "Wrong number?" and the masked number); a new shared
**`components/ui/CodeStep.tsx`** (the D101 code step lifted out of `register.tsx`, used by Create account, Forgot
passcode, Profile and the backup step); **`app/(auth)/register.tsx`** (the switch, the WhatsApp fields, the backup step);
**`app/(auth)/login.tsx`** (number + passcode); **`app/(auth)/forgot-password.tsx`** (WhatsApp code, *Set a new
passcode*, the *Not you?* line); **`app/(tabs)/me.tsx`** (Sign-in methods group, Change passcode moved into it, the
add/change sheet); **Home** (`app/(tabs)/index.tsx`, the one backup reminder card); **`constants/helpTopics.ts`**
(the sign-in and account answers); **`utils/countries.ts`** (the six WhatsApp countries); and
**`supabase/config.toml`** (`[auth.sms]` with `enable_signup` and `enable_confirmations` on,
`[auth.sms.twilio_verify]` on with dummy keys from env, and `[auth.sms.test_otp]` with test numbers and fixed codes
for CI, Maestro and the reviewers). **One small migration**: today only sign-up copies the email from Supabase Auth
to the profile, so a backup email added later (or a changed email) would never reach the profile or the result
emails; a trigger on a confirmed email change copies it across. It touches no phone column. The WhatsApp sign-up
sends the name but **not** the number in its sign-up data, because the new-user trigger copies a `phone` there into
`profiles.phone`; the trigger already copes with no email (the name comes from the form, "Rummy Player" as the last
fallback). The migration goes to staging under D79 and to live only on Sree's yes to it. New **Maestro flows** in
`e2e/full/`, all on test numbers: create an account by WhatsApp (code step, backup Skip, Home); sign in with number +
passcode; wrong passcode; Forgot passcode by WhatsApp; an email account adds a WhatsApp number in Profile; change
number; the backup reminder appears once after the first saved game; and the code step at 360 dp with font scale 1.3.
Plus unit tests for the auth service (the `channel` is always sent, resend never falls back to SMS) and for the code
step's words for both channels.

## 10. Decisions for Sree

- ~~**Q20**~~ **answered Nov 25 (D116)**: go, and before the freeze. Sree: "There's no reason to wait for that!"
- ~~**Q21**~~ answered Nov 23 (D77), revised Nov 25: players see EZ Score (WhatsApp, D119) and EZ Score: Rummy (the
  app); brand MindWeave (D118); legal name Candor PS LLC, kept off player-facing pages (D123); the California DBA ties
  them together (D121).
- ~~**Q22**~~ answered Nov 23 (D75): a backup contact is asked at sign-up with Skip and reminded once; it is a second
  way in.
- ~~**Q23**~~ **decided by default (D116)**: an account with no backup that lost its only contact gets support with
  its Player ID, two game codes and the creator's confirmation.
- ~~**Q24**~~ answered Nov 23 (D76): the same 6-digit passcode; sign-in is number + passcode, no message.
- ~~**Q25**~~ **decided by default (D116)**: no SMS at launch. Revisit only if someone at a table cannot get WhatsApp.
- ~~**Q26**~~ **decided by default (D116)**: Twilio usage alert at $20 a month; India, US, Canada, UK, UAE and
  Australia only.
- **Q27** (after v1, D84): WhatsApp for "game started" and results instead of email. Not now.
- **New question** (the Main agent gives it its Q-number): the email form keeps its optional "phone and ZIP"
  contact fields, which we never text. Once a WhatsApp number can be a way in, two kinds of phone number may confuse
  people. **Default: keep them as they are in this build** and look again after launch; nothing is lost either way.
- **Changed from Nov 23, named so nothing slips through** (design-review checklist item 6): the phone-keyed "Is this
  you?" claim step and its migration are gone (D113); there is no Remove for a sign-in method (D50); there is no
  CAPTCHA at launch (§6); the code step is the D101 screen, not a separate WhatsApp screen.
