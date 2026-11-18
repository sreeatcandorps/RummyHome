import { isSupabaseConfigured, supabase } from '@/services/supabase';

export type MailResult = {
  sent: boolean;
  message: string;
};

const NOT_CONFIGURED =
  'Email is not set up yet. Copy the link and send it on WhatsApp. To turn email on, add a Resend API key and deploy the send-email function (docs/friday-setup.md).';

/**
 * Sends through the Supabase Edge Function `send-email`.
 * Account creation and sharing still work when this is not deployed.
 */
export async function sendAppEmail(body: Record<string, unknown>): Promise<MailResult> {
  if (!isSupabaseConfigured) {
    return { sent: false, message: NOT_CONFIGURED };
  }

  const { data, error } = await supabase.functions.invoke('send-email', { body });
  if (error) {
    return { sent: false, message: NOT_CONFIGURED };
  }

  const payload = (data ?? {}) as { sent?: boolean; message?: string };
  if (payload.sent === false) {
    return { sent: false, message: payload.message || NOT_CONFIGURED };
  }
  return { sent: true, message: payload.message || 'Email sent.' };
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await sendAppEmail({ kind: 'welcome', email, name });
}

export async function sendScorecardEmail(input: {
  gameId: string;
  emails: string[];
  url: string;
  gameLabel: string;
  startedAt: string;
}): Promise<MailResult> {
  if (input.emails.length === 0) {
    return { sent: false, message: 'Nobody with an email is selected. Copy the link instead.' };
  }
  return sendAppEmail({ kind: 'scorecard', ...input });
}
