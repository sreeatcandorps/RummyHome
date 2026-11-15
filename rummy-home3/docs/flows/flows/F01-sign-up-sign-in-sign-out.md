# F01 — Sign up, sign in, sign out

Requirements: R01, R02, R03 · Screens / pop-ups / warnings in this flow: 12 · untested (red): 1 — P17

![F01](../png/F01-sign-up-sign-in-sign-out.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  open("Open app"):::step
  signed{"Session on phone?"}:::decision
  s01["S01 Sign in"]:::screen
  s02["S02 Create account"]:::screen
  s03["S03 Forgot passcode (OTP → new passcode)"]:::screen
  w01[/"W01 Sign-in error (wrong passcode · cannot reach server · locked)"/]:::warning
  w02[/"W02 An account with this email already exists"/]:::warning
  w03[/"W03 OTP / passcode validation (6 digits, mismatch)"/]:::warning
  p16(["P16 Account created"]):::popup
  p17(["P17 Country picker (phone code)"]):::gap
  e01[["E01 Welcome"]]:::email
  e02[["E02 OTP / passcode reset"]]:::email
  s04["S04 Home (Live · Recent · bottom bar)"]:::screen
  s06["S06 Me (profile)"]:::screen
  out("Log out"):::step
  dead("Session revoked / expired"):::step
  open --> signed
  signed -->|"yes"| s04
  signed -->|"no"| s01
  s01 -->|"email + passcode ok"| s04
  s01 -->|"wrong / offline"| w01
  w01 --> s01
  s01 -->|"Create account"| s02
  s02 -->|"country"| p17
  p17 --> s02
  s02 -->|"ok"| p16
  p16 --> e01
  p16 --> s04
  s02 -->|"email known"| w02
  w02 -->|"Sign in"| s01
  s01 -->|"Forgot passcode"| s03
  s03 -->|"send OTP"| e02
  e02 -->|"type OTP + new passcode"| s03
  s03 -->|"bad OTP"| w03
  s03 -->|"done"| s01
  s04 --> s06
  s06 --> out
  out --> s01
  dead -->|"F1 fix: back to Sign in"| s01
  classDef screen fill:#e3f2fd,stroke:#1565c0,color:#0d2c54
  classDef popup fill:#fff8e1,stroke:#f9a825,color:#4e3a00
  classDef warning fill:#f3e5f5,stroke:#6a1b9a,color:#2e0b40
  classDef email fill:#e8f5e9,stroke:#2e7d32,color:#0b3d12
  classDef step fill:#ffffff,stroke:#616161,color:#212121
  classDef decision fill:#fafafa,stroke:#616161,color:#212121
  classDef stop fill:#eeeeee,stroke:#424242,color:#212121
  classDef flow fill:#e3f2fd,stroke:#1565c0,color:#0d2c54
  classDef gap fill:#fde2e2,stroke:#c62828,color:#7f0000,stroke-width:2px
```

## Scenarios

| # | Kind | Scenario | Tests |
| --- | --- | --- | --- |
| F01-1 | happy | Sign in with email + 6-digit passcode → Home | [`smoke/01-home.yaml`](../../../e2e/smoke/01-home.yaml) · [`lib/sign-in.yaml`](../../../e2e/lib/sign-in.yaml) · [`passcode.test.ts`](../../../tests/passcode.test.ts) |
| F01-2 | happy | Create account → Account created → welcome email → Home | [`auth-errors.test.ts`](../../../tests/auth-errors.test.ts) · [`emails-024.test.ts`](../../../tests/emails-024.test.ts) · [`pgTAP/11_email_uniqueness_021.sql`](../../../supabase/tests/11_email_uniqueness_021.sql) |
| F01-3 | edge | Sign up with an email that already has an account → "already exists", no welcome email | [`email-uniqueness-021.test.ts`](../../../tests/email-uniqueness-021.test.ts) · [`pgTAP/11_email_uniqueness_021.sql`](../../../supabase/tests/11_email_uniqueness_021.sql) |
| F01-4 | happy | Forgot passcode → OTP email → new passcode → sign in | [`passcode.test.ts`](../../../tests/passcode.test.ts) |
| F01-5 | misuse | Wrong passcode → error, stays on Sign in | [`full/10-sign-out-bad-passcode.yaml`](../../../e2e/full/10-sign-out-bad-passcode.yaml) · [`auth-errors.test.ts`](../../../tests/auth-errors.test.ts) |
| F01-6 | happy | Log out from Me → Sign in | [`full/10-sign-out-bad-passcode.yaml`](../../../e2e/full/10-sign-out-bad-passcode.yaml) · [`test-findings-pr19.test.ts`](../../../tests/test-findings-pr19.test.ts) |
| F01-7 | edge | Dead / revoked session → back to Sign in, not a spinner (F1) | [`chaos/c12-logout-dead-session--revoke-session.yaml`](../../../e2e/chaos/c12-logout-dead-session--revoke-session.yaml) · [`test-findings-pr19.test.ts`](../../../tests/test-findings-pr19.test.ts) |
| F01-8 | edge | Launch offline → cached Home, not a sign-out (F2) | [`chaos/c11-launch-offline--net-off.yaml`](../../../e2e/chaos/c11-launch-offline--net-off.yaml) · [`test-findings-pr19.test.ts`](../../../tests/test-findings-pr19.test.ts) |
| F01-9 | edge | Create account on the device (register screen end to end) | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S01 | Sign in | `app/(auth)/login.tsx` | 12 |
| S02 | Create account | `app/(auth)/register.tsx` | 4 |
| S03 | Forgot passcode (OTP → new passcode) | `app/(auth)/forgot-password.tsx` | 1 |
| W01 | Sign-in error (wrong passcode · cannot reach server · locked) | `utils/authErrors.ts` | 3 |
| W02 | An account with this email already exists | `utils/signUpOutcome.ts` | 2 |
| W03 | OTP / passcode validation (6 digits, mismatch) | `utils/passcode.ts, utils/passcodeFlow.ts` | 1 |
| P16 | Account created | `app/(auth)/register.tsx` | 1 |
| P17 | Country picker (phone code) | `app/(auth)/register.tsx` | <span style="color:#c62828">**GAP**</span> |
| E01 | Welcome | `supabase/functions/send-email/index.ts (kind welcome)` | 1 |
| E02 | OTP / passcode reset | `supabase/templates/recovery-passcode.html` | 1 |
| S04 | Home (Live · Recent · bottom bar) | `app/(tabs)/index.tsx` | 71 |
| S06 | Me (profile) | `app/(tabs)/me.tsx` | 27 |
