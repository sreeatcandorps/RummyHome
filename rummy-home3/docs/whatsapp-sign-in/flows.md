# WhatsApp sign-in — architecture and every flow

Companion to `whatsapp-sign-in-design.md` (the reasoning, costs, paperwork, decisions). This file is the picture:
how the pieces connect and what happens on each screen, step by step. GitHub renders the diagrams inline; the same
source is rendered to `flows-*.png` by `make-flow-images.py` for the PR body.

Decisions these flows implement: D75 (backup contact at sign-up with Skip, reminded once), D76 (same 6-digit passcode
for both methods), Q16 (email sign-up by code, not link). Open: Q20, Q21, Q23, Q25, Q26, Q27.

## 1. Architecture — what talks to what

```mermaid
flowchart LR
  subgraph phone["Phone · EZ Score app"]
    UI["Sign in / Create account / Profile › Sign-in methods"]
    SESS[("Session, kept for a year+")]
  end
  subgraph supa["Supabase project · live / staging"]
    AUTH["Auth<br/>one auth.users row = one person<br/>email + phone + passcode"]
    HOOK["Send-SMS hook<br/>edge function — later, optional"]
    DB[("profiles · game_players<br/>claim by email or phone")]
  end
  subgraph tw["Twilio"]
    VER["Verify service<br/>makes the code, checks it,<br/>Fraud Guard, geo list"]
  end
  subgraph meta["Meta"]
    WABA["WhatsApp Business account<br/>owned by Candor PS LLC as MindWeave Tech — D77<br/>display name «EZ Score: Rummy»"]
    CLOUD["Cloud API"]
  end
  RES["Resend SMTP<br/>email codes, results"]
  WA(("WhatsApp<br/>on the player's phone"))
  MAIL(("Mailbox"))

  UI -- "signUp / signInWithPassword / verifyOtp" --> AUTH
  AUTH -- "session" --> SESS
  AUTH -- "phone code" --> VER
  VER -- "Channel=whatsapp" --> CLOUD
  CLOUD -- "authentication template" --> WA
  WABA -. "sender" .-> CLOUD
  AUTH -- "email code" --> RES --> MAIL
  AUTH -. "later: Send-SMS hook" .-> HOOK -. "our own template" .-> CLOUD
  AUTH --- DB
```

Who pays whom: Meta ₹0.115 per delivered WhatsApp message (India) through Twilio; Twilio $0.05 per code typed
correctly; Resend free to 3,000 emails a month. A sign-in sends nothing (D76).

## 2. Create account — WhatsApp

```mermaid
flowchart TD
  A["Create account<br/>Email · WhatsApp → WhatsApp"] --> B["Name · WhatsApp number<br/>+91 from the SIM"]
  B --> C["Send code on WhatsApp<br/>signInWithOtp phone, channel whatsapp"]
  C --> D{"Code arrives?"}
  D -- "no, 60 s" --> C2["Send again<br/>SMS instead if Q25 on"] --> D
  D -- "yes" --> E["Check WhatsApp<br/>6 boxes, auto-submit<br/>verifyOtp type sms"]
  E -- "wrong ×5" --> E2["Locked 15 min"] --> E
  E -- "correct" --> F["Set your 6-digit passcode<br/>D76 · same screen as email"]
  F --> G["Add a backup · step 2 of 2<br/>backup email · Skip for now<br/>D75"]
  G -- "email given" --> G2["Code to the email<br/>verifyOtp type email_change"] --> H
  G -- "skip" --> H{"Number on a seat<br/>someone typed?"}
  H -- "yes" --> I["Is this you, Priya K?<br/>Played FRI4 · SAT6 with Sree"]
  I -- "Yes, that's me" --> J["claim: seat → this account<br/>same Player ID, history"]
  I -- "Not me" --> K["Fresh account"]
  H -- "no" --> K
  J --> L["Home · signed in"]
  K --> L
```

## 3. Create account — Email (Q16, code not link)

```mermaid
flowchart TD
  A["Create account<br/>Email · WhatsApp → Email"] --> B["Name · Email · 6-digit passcode<br/>keyboard scrolls to the field"]
  B --> C["Send code<br/>signUp → email template with Token"]
  C --> D["Check your email<br/>6 boxes · Send again"]
  D -- "correct" --> E["Signed in at once<br/>verifyOtp type signup"]
  E --> F["Add a backup · step 2 of 2<br/>backup WhatsApp number · Skip for now<br/>D75"]
  F -- "number given" --> F2["Code on WhatsApp<br/>verifyOtp type phone_change"] --> G
  F -- "skip" --> G{"Seat with this email?"}
  G -- "yes" --> H["Is this you?"] --> I["Home"]
  G -- "no" --> I
```

## 4. Sign in — both methods, no message sent (D76)

```mermaid
flowchart TD
  A["Sign in<br/>Email · WhatsApp · last used is preselected"] --> B{"Method"}
  B -- "Email" --> C["Email + passcode<br/>signInWithPassword email"]
  B -- "WhatsApp" --> D["Number + passcode<br/>signInWithPassword phone"]
  C --> E{"Correct?"}
  D --> E
  E -- "yes" --> F["Home · session kept"]
  E -- "no" --> G["Try again · Forgot passcode?"]
  G --> H["→ flow 5"]
```

The number here is a username: a dead or changed number still signs in (§5a case 2 of the design doc).

## 5. Forgot passcode — any contact that still works

```mermaid
flowchart TD
  A["Forgot passcode?"] --> B["Which contact do you still have?<br/>email on file · WhatsApp on file<br/>only confirmed ones are offered"]
  B -- "email" --> C["Code to the email<br/>resetPasswordForEmail → Token"]
  B -- "WhatsApp" --> D{"Account also has<br/>a backup email?"}
  D -- "yes" --> D2["Code on WhatsApp<br/>AND the email must confirm<br/>recycled-number guard"]
  D -- "no" --> D3["Is this you, Priya K?"]
  D3 -- "Not me" --> X["New account · number detached<br/>old account keeps its email + passcode"]
  D3 -- "Yes" --> D4["Code on WhatsApp"]
  C --> E["6 boxes"]
  D2 --> E
  D4 --> E
  E -- "correct" --> F["Set a new passcode"] --> G["Home"]
```

## 6. Profile › Sign-in methods — add, change, remove

```mermaid
flowchart TD
  A["Profile › Sign-in methods<br/>Email · WhatsApp · Passcode"] --> B{"Row tapped"}
  B -- "Email: add or change" --> C["Type the new email"] --> C2["Code to the new email<br/>updateUser email → verifyOtp email_change"] --> Z["Row updated · toast"]
  B -- "WhatsApp: add or change number" --> D["Type the new number"] --> D2["Code on WhatsApp to the NEW number<br/>updateUser phone → verifyOtp phone_change"] --> Z
  B -- "Remove a method" --> E{"Is it the last<br/>confirmed method?"}
  E -- "yes" --> E1["Not allowed<br/>«Add another way in first»"]
  E -- "no" --> E2["Confirm · removed"] --> Z
  B -- "Passcode" --> F["Current passcode → new passcode"] --> Z
```

"Change number" is the only thing a person must do when their number changes; everything else keeps working (§5a).

## 7. Backup reminder — once (D75)

```mermaid
flowchart TD
  A["First game saved"] --> B{"Account has one<br/>confirmed contact<br/>and skipped the backup?"}
  B -- "no" --> Z["Nothing"]
  B -- "yes" --> C["Home card · Add a backup way in<br/>Add email / Add WhatsApp · Not now"]
  C -- "Add" --> D["→ flow 6, add"] --> E["Card gone"]
  C -- "Not now" --> E2["Card gone for good<br/>row stays in Profile"]
```

## 8. Number changed — what the person experiences

```mermaid
flowchart TD
  A["Phone number changes"] --> B{"Still signed in<br/>on this phone?"}
  B -- "yes" --> C["Nothing breaks<br/>Profile › WhatsApp › Change number<br/>code to the NEW number"] --> Z["Done"]
  B -- "no: new phone / logged out" --> D["Sign in · old number + passcode<br/>no message needed · D76"]
  D -- "knows passcode" --> C
  D -- "forgot passcode" --> E{"Backup email?"}
  E -- "yes" --> F["Forgot passcode by email → flow 5"] --> C
  E -- "no" --> G["Support · Player ID + two game codes<br/>+ a creator confirms · Q23"] --> C
```

## 9. Abuse limits that sit under every flow

```mermaid
flowchart LR
  A["Any «Send code»"] --> B["Turnstile CAPTCHA<br/>on Create account and Forgot"] --> C["Supabase: 1 code / 60 s per number<br/>5 an hour · 20 a day · 10-min expiry"]
  C --> D["Twilio Verify: Fraud Guard<br/>geo list IN US CA UK AE AU · Q26<br/>spend alert $20 / month"]
  D --> E["5 wrong codes → 15-min lock"]
```

## 10. What changes where (build plan, when Sree says go — after Google approves the current review)

| Layer | Change |
| --- | --- |
| Paperwork (Sree) | Meta Business Portfolio → WhatsApp Business account via Twilio embedded sign-up → display name → business verification (EIN / Articles) → Twilio Verify service with the WhatsApp sender |
| Supabase (staging first) | Phone provider = Twilio Verify (SIDs); test numbers with fixed codes; email templates with `{{ .Token }}` (Q16); rate limits; CAPTCHA |
| `services/auth.ts` | `signUpWithWhatsApp`, `verifyPhoneCode`, `signInWithPassword({ phone })`, `addContact`, `changeContact`, `forgotPasscode(contact)` |
| Screens | `login.tsx` + `register.tsx`: Email \| WhatsApp control, number field with country code, Check WhatsApp, Set passcode, Add a backup; `me.tsx`: Sign-in methods group; Home: reminder card |
| Database | migration: claim RPC keyed on phone as well as email; `profiles.phone_confirmed` view of `auth.users.phone` |
| Help | sign-in page: "Sign in with WhatsApp", "I lost my number", "Add a backup" |
| Tests | Maestro flows for 2–8 above on the staging APK with fixed-code test numbers; 360 dp × 1.3 font pass |
| Store | Play Data safety: phone number → account management; Apple privacy label: phone number · linked |
