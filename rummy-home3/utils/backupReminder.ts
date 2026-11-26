/**
 * Home's one reminder to add a backup way in (D75, flow 7): after the first saved game, for an account with only
 * one way in that has not said Not now. Not now is kept on the account (Supabase user data), so it is hidden for
 * good on every phone. Existing email accounts see it once too.
 */
export type BackupReminder = { add: 'email' | 'whatsapp'; title: string; text: string; action: string };

export const BACKUP_REMINDER_TITLE = 'Add a backup way in';

export function backupReminderFor(
  methods: { email: string | null; phone: string | null; backupReminder: 'dismissed' | null } | null,
  finishedGames: number,
): BackupReminder | null {
  if (!methods || methods.backupReminder === 'dismissed' || finishedGames < 1) return null;
  if (methods.email && methods.phone) return null;
  if (methods.phone) {
    return {
      add: 'email',
      title: BACKUP_REMINDER_TITLE,
      text: 'You sign in with WhatsApp only. If you lose that number, an email is the way back to your games.',
      action: 'Add email',
    };
  }
  if (methods.email) {
    return {
      add: 'whatsapp',
      title: BACKUP_REMINDER_TITLE,
      text: 'You sign in with email only. If you lose that mailbox, a WhatsApp number is the way back to your games.',
      action: 'Add WhatsApp',
    };
  }
  return null;
}
