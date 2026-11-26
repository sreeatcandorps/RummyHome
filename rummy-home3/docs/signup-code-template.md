# Create account code e-mail — what Build Bot sets (D101)

The app half of D101 (Create account confirms with a 6-digit code typed into the app) is built on
`cursor/signup-code-no-player-id-7d0d`. The e-mail half is one Supabase dashboard setting per project. **Build Bot sets
it after that branch merges: staging first, then live.** Until then each project keeps sending its old link e-mail,
and the app still copes: the link confirms the account, then the person signs in.

## Order

1. **Staging** (`ezscore-staging`, ref `erurahfybkxemgtkfzkn`): set the subject and body below. Sign up on a staging
   build with a fresh address; the e-mail must show a 6-digit code and no button or link; typing it signs you in.
2. **Live** (ref `gngcrplcldfiubvhcdin`): the same subject and body, only after step 1 worked.

## Dashboard › Authentication › Email Templates › Confirm signup

**Subject** (exactly):

```text
Your EZ Score: Rummy code is {{ .Token }}
```

**Body** (exactly; same as `supabase/templates/confirm-code.html` without its first comment):

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F1E8;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2A24;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFDF8;border-radius:16px;padding:28px 28px 24px;">
      <tr><td style="font-size:12px;letter-spacing:1px;color:#1B5E3F;font-weight:700;text-transform:uppercase;">EZ Score: Rummy</td></tr>
      <tr><td style="font-size:22px;font-weight:700;padding-top:6px;">Your code</td></tr>
      <tr><td style="font-size:15px;line-height:22px;padding-top:12px;">
        Hi {{ .Data.display_name }},<br><br>
        Type this code in the app to finish creating your account:
      </td></tr>
      <tr><td align="center" style="padding:20px 0 8px;">
        <span style="display:inline-block;font-size:34px;letter-spacing:10px;font-weight:800;color:#1B5E3F;background:#E6F2EB;border-radius:12px;padding:12px 18px 12px 28px;">{{ .Token }}</span>
      </td></tr>
      <tr><td style="font-size:13px;line-height:20px;color:#5B665F;padding-top:8px;">
        It works once and expires in 15 minutes. If you did not create an EZ Score account, ignore this email; nothing happens.
      </td></tr>
      <tr><td style="font-size:12px;color:#8A948E;padding-top:20px;border-top:1px solid #EDE6DA;margin-top:12px;">
        EZ Score: Rummy by MindWeave · This is an account message, not marketing.
      </td></tr>
    </table>
  </td></tr>
</table>
```

## Settings that must already be right (check, do not change if they match)

| Setting | Value | Management API field (`PATCH /v1/projects/<ref>/config/auth`) |
| --- | --- | --- |
| Confirm signup › subject | as above | `mailer_subjects_confirmation` |
| Confirm signup › body | as above | `mailer_templates_confirmation_content` |
| Providers › Email › Confirm email | on (otherwise sign-up signs in at once and no code is sent) | `mailer_autoconfirm` = `false` |
| Providers › Email › Email OTP length | 6 | `mailer_otp_length` |
| Providers › Email › Email OTP expiration | 900 s (the e-mail says 15 minutes; the same value Forgot passcode uses) | `mailer_otp_exp` |
| SMTP › sender | `EZ Score: Rummy <scores@mindweavetech.com>` via Resend (staging: see `staging-b2-feedback.md`) | `smtp_*` |

No migration, no Site URL or redirect change: the code needs neither. Leave the redirect allow-list as it is so link
e-mails already sent still land.
