import { SITE_BASE_URL } from './siteUrls';

/**
 * Account deletion (Google Play requirement). One copy of the words used in the
 * Profile dialog, on the public /delete-account page and in the privacy policy, so
 * what the app promises and what the server does (migration 026) stay the same.
 */

export const SUPPORT_EMAIL = 'support@mindweavetech.com';
export const PRIVACY_PAGE_URL = `${SITE_BASE_URL}/privacy`;
export const DELETE_ACCOUNT_PAGE_URL = `${SITE_BASE_URL}/delete-account`;

export const DELETE_ACCOUNT_TITLE = 'Delete your account?';
export const DELETE_ACCOUNT_CONFIRM_LABEL = 'I understand. This cannot be undone.';
export const DELETE_ACCOUNT_BUTTON = 'Delete my account';
export const DELETE_ACCOUNT_DONE_TITLE = 'Account deleted';
export const DELETE_ACCOUNT_DONE_BODY = 'Your sign-in, email, phone and Player ID are gone. Scorecards you shared with other people still show your name.';

/** What goes, right away, in the order the server does it (026 tombstone_profile). */
export const DELETED_ITEMS: readonly string[] = [
  'Your sign-in: email, passcode and every signed-in device.',
  'Your phone number, Player ID, email settings and game defaults.',
  'Your My players list, hidden-games list, queued emails and open invites.',
  'Games you created that nobody else with an account was in.',
];

/** What stays, and why. */
export const KEPT_ITEMS: readonly string[] = [
  'Scorecards and results of games you played with other people keep your name and scores, like an unregistered player: no email, no phone, no Player ID.',
  'Games you created that other players with accounts were in stay with them. If you were the only admin, the first other registered player becomes admin.',
];

export const DELETE_ACCOUNT_SUPPORT_LINE = `Prefer to ask by email? Write to ${SUPPORT_EMAIL} from the address you signed up with.`;

/** Summary returned by delete_my_account(). */
export type DeleteAccountSummary = {
  seatsKept: number;
  gamesDeleted: number;
  gamesKept: number;
  adminsPromoted: number;
};
