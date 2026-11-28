# WhatsApp sign-in — architecture and every flow

**Refreshed Nov 25 (D116).** Companion to `whatsapp-sign-in-design.md` (the reasons, costs, paperwork and decisions).
This file is the picture: what talks to what, and what happens on each screen. GitHub draws the diagrams; the same
source is rendered to `flows-1.png` … `flows-9.png` by `make-flow-images.py`.

What changed since Nov 23: the "Is this you?" step that matched a person by phone number is gone (D113: people are
found and linked only by Player ID). WhatsApp is a way to **sign in**, never a way to be **found**. Every code, email
or WhatsApp, goes through **one code step** (flow 3), the screen the email sign-up already uses (D101).

Decisions these flows follow: D75 (backup at sign-up with Skip, one reminder), D76 (one 6-digit passcode; sign-in sends
no message), D77, D118, D119 (EZ Score / MindWeave / Candor PS LLC), D101 (code typed in the app), D105 (no Player ID
box), D113 (Player ID only; nobody's number shown to anyone else), D116 (build it before the freeze).

## 1. Architecture — what talks to what

```mermaid
flowchart LR
  subgraph phone["Phone · EZ Score app"]
    UI["Create account · Sign in · Forgot passcode<br/>Profile › Sign-in methods"]
    STEP["One code step<br/>(email or WhatsApp)"]
    SESS[("Session, kept for a year+")]
  end
  subgraph supa["Supabase project · staging first, then live"]
    AUTH["Auth: one user = one person<br/>email and/or WhatsApp number + one passcode<br/>the number is kept only here"]
  end
  subgraph tw["Twilio"]
    VER["Verify service<br/>makes and checks the code"]
    MG["Messaging Service<br/>holds the WhatsApp sender"]
  end
  subgraph meta["Meta"]
    WABA["WhatsApp Business account<br/>Portfolio: MindWeave · legal: Candor PS LLC<br/>display name «EZ Score»"]
  end
  RES["Resend SMTP<br/>email codes"]
  WA(("WhatsApp<br/>on the player's phone"))
  MAIL(("Mailbox"))

  UI --> STEP
  UI -- "signUp · signInWithPassword · signInWithOtp" --> AUTH
  STEP -- "verifyOtp" --> AUTH
  AUTH -- "session" --> SESS
  AUTH -- "phone code" --> VER --> MG -- "authentication template" --> WA
  WABA -. "sender" .-> MG
  AUTH -- "email code" --> RES --> MAIL
```

Profiles, players and games are unchanged: no phone number is stored there or used to find anyone (D113).

Who is paid: Twilio $0.05 for each code typed correctly; Meta ₹0.115 ($0.0014) for each WhatsApp code delivered to
India, passed through Twilio; Resend free up to 3,000 emails a month. Signing in with a passcode sends nothing (D76).

## 2. Create account — WhatsApp

```mermaid
flowchart TD
  A["Create account<br/>WhatsApp · Email → WhatsApp"] --> B["First and last name<br/>WhatsApp number (+91 …)<br/>6-digit passcode"]
  B -- "Create account" --> C{"Number already<br/>has an account?"}
  C -- "yes" --> C2["«That number already has an account.»<br/>Sign in · Forgot passcode?"]
  C -- "no" --> D["One WhatsApp code sent<br/>signUp phone + passcode, channel whatsapp"]
  D --> E["Code step · flow 3<br/>«Check WhatsApp»"]
  E -- "Go back" --> B
  E -- "correct" --> F["Signed in · Player ID given"]
  F --> G["Add a backup · D75<br/>backup email · Skip for now"]
  G -- "email typed" --> G2["Code step · «Check your email»"] --> H["Home"]
  G -- "Skip for now" --> H
```

No matching after the code: a creator who added this person by initials links them later by Player ID (D113).

## 3. The one code step — email and WhatsApp alike (D101)

```mermaid
flowchart TD
  IN["Arrives from: Create account · Forgot passcode<br/>Add or change a number or email · Add a backup"] --> A["Check WhatsApp / Check your email<br/>«We sent a 6-digit code to WhatsApp +91 98xxx xx210»"]
  A --> B["Six boxes · paste or type<br/>Confirm and sign in"]
  B -- "correct" --> OK["Done: signed in, or contact confirmed<br/>back to where it came from"]
  B -- "wrong or expired" --> E["«That code is wrong or has expired.<br/>Check the newest message, or tap Send a new code.»"] --> B
  A -- "Send a new code<br/>(after 60 s)" --> R["New code by the SAME way<br/>WhatsApp stays WhatsApp"] --> A
  A -- "Wrong number? / Wrong address?<br/>Go back" --> BACK["The form, fields kept"]
```

One screen and one component in the app: only the icon, title, field label and "Wrong number?" differ. Five wrong
tries close a code (Twilio's own rule); the message says to send a new one.

## 4. Sign in — both ways, no message sent (D76)

```mermaid
flowchart TD
  A["Sign in<br/>WhatsApp · Email · the last way used on this phone"] --> B{"Which way"}
  B -- "WhatsApp" --> C["Number + passcode<br/>signInWithPassword phone"]
  B -- "Email" --> D["Email + passcode<br/>signInWithPassword email"]
  C --> E{"Match?"}
  D --> E
  E -- "yes" --> F["Home · session kept"]
  E -- "no" --> G["«That number and passcode do not match.»<br/>Forgot passcode?"] --> H["→ flow 5"]
```

The number is a username: a dead or changed number still signs in (design §5a, case 2).

## 5. Forgot passcode

```mermaid
flowchart TD
  A["Forgot passcode<br/>WhatsApp · Email"] --> B{"Which way"}
  B -- "WhatsApp number" --> C["One WhatsApp code<br/>signInWithOtp phone, no new account"]
  B -- "Email" --> D["One email code<br/>(today's reset)"]
  C --> E["Code step · flow 3"]
  D --> E
  E -- "correct" --> F["Set a new passcode<br/>«This is the account of Priya K · #57. Not you?»"]
  F -- "Save" --> G["Home"]
  F -- "Not you?" --> N["«This number belonged to someone before you.»<br/>Start a new account with this number"]
  N --> N2["Number moved to a new account<br/>the old account keeps its email, if any"] --> G
  E -. "number gone, no backup" .-> S["Support · Player ID + two game codes<br/>+ that game's creator confirms · Q23"]
```

"Not you?" is the only guard for a recycled number (India recycles numbers after about 90 days unused). It is one
line on a screen the person already sees, not an extra dialog (D50).

## 6. Profile › Sign-in methods — add or change

```mermaid
flowchart TD
  A["Profile › Sign-in methods<br/>WhatsApp · Email · Passcode"] --> B{"Row tapped"}
  B -- "WhatsApp: Add or Change number" --> C["Type the new number"] --> C2["Code on WhatsApp to the NEW number<br/>updateUser phone, channel whatsapp"] --> C3["Code step · flow 3"] --> Z["Back to Profile<br/>the row shows the new one"]
  B -- "Email: Add a backup or Change" --> D["Type the address"] --> D2["Code to the NEW address<br/>updateUser email"] --> D3["Code step · flow 3"] --> Z
  B -- "Passcode: Change" --> P["Today's Change passcode"] --> Z2["Back to Profile"]
```

There is no Remove: nobody can take away their last way in, and there is no dialog to explain why not (D50).

## 7. Backup reminder — once (D75)

```mermaid
flowchart TD
  A["First game saved"] --> B{"Only one way in<br/>and skipped the backup?"}
  B -- "no" --> Z["Nothing"]
  B -- "yes" --> C["Home card · Add a backup way in<br/>Add email / Add WhatsApp · Not now"]
  C -- "Add" --> D["→ flow 6"] --> E["Card gone"]
  C -- "Not now" --> E2["Card gone for good<br/>Profile keeps «Add a backup»"]
```

## 8. Number changed — what the person does

```mermaid
flowchart TD
  A["Phone number changes"] --> B{"Still signed in<br/>on this phone?"}
  B -- "yes (most people)" --> C["Nothing breaks<br/>Profile › WhatsApp › Change number<br/>code to the NEW number"] --> Z["Done"]
  B -- "no: new phone, or logged out" --> D["Sign in · OLD number + passcode<br/>no message needed · D76"]
  D -- "knows the passcode" --> C
  D -- "forgot it" --> E{"Backup email?"}
  E -- "yes" --> F["Forgot passcode by email · flow 5"] --> C
  E -- "no" --> G["Support · Player ID + two game codes<br/>+ a creator confirms · Q23"] --> C
```

## 9. Limits under every flow

```mermaid
flowchart LR
  A["Any «Send code»"] --> B["Supabase: 1 code a minute per number<br/>30 codes an hour for the whole project"]
  B --> C["Twilio Verify: 5 sends per number<br/>in 10 minutes · 5 tries per code<br/>codes last 10 minutes"]
  C --> D["Numbers from six countries only<br/>IN · US · CA · UK · AE · AU · Q26"]
  D --> E["Twilio spend alert at $20 a month · Q26"]
```

No SMS at launch (Q25), so there is no SMS-fraud risk to guard against. The worst a script can do is send the
30-an-hour project limit of WhatsApp codes it cannot read: about ₹83 ($1) a day if they go to Indian numbers, about
$16 a day if they all go to UK numbers (the dearest of the six), and nothing to Twilio, which charges only for codes
typed correctly. The $20 alert fires within the first bad day.
