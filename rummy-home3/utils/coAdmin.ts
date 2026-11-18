export const CO_ADMIN_NUDGE_TITLE = 'Add a co-admin?';
export const CO_ADMIN_NUDGE_BODY = 'Add a co-admin so someone else can keep scoring if your phone dies.';

/**
 * Who the Start game nudge offers as a co-admin: seated players other than the organiser
 * whose account is registered (only registered players can be admins). Unknown status
 * (a pick that is not in My players yet) is left out rather than guessed.
 */
export function coAdminCandidates<T extends { id: string; status?: string | null }>(selected: T[], meId: string | null | undefined): T[] {
  return selected.filter((p) => p.id !== meId && p.status === 'registered');
}
