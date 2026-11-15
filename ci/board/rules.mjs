// Board sync — the rules, pure and unit-tested (ci/board/rules.test.mjs). sync.mjs applies them.
//
// Status options on the board (matched by name at run time, never by id):
//   Spec · Waiting on Sree · Building · Ready to test · Done

export const STATUS = Object.freeze({
  SPEC: 'Spec',
  WAITING: 'Waiting on Sree',
  BUILDING: 'Building',
  READY: 'Ready to test',
  DONE: 'Done',
});

export const WAITING_LABEL = 'waiting-on-sree';

const lower = (labels) => (labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name ?? '').toLowerCase());

/** A spec / docs-only PR: label `spec` or `docs`, or a title like "Spec …", "PR 14 spec …", "… docs only". */
export function isSpecPr({ title = '', labels = [] } = {}) {
  const l = lower(labels);
  if (l.includes('spec') || l.includes('docs')) return true;
  const t = title.trim();
  return /^spec\b/i.test(t) || /^PR\s*\d+[a-z]?\s*spec\b/i.test(t) || /\bdocs(\s*\+\s*mockups)?\s*only\b/i.test(t);
}

/**
 * The verdict of every check on a commit, from the GraphQL statusCheckRollup contexts
 * (CheckRun {name,status,conclusion} and StatusContext {context,state}). Our own board-sync run is
 * ignored so it never holds a PR at "pending" while it decides.
 * Returns 'success' | 'failure' | 'pending' | 'none'.
 */
export function checksState(contexts, { ignore = /board[- ]sync/i } = {}) {
  const rows = (contexts ?? [])
    .map((c) => {
      if (!c) return null;
      if (c.__typename === 'StatusContext' || 'context' in c) {
        const s = String(c.state ?? '').toUpperCase();
        return { name: c.context ?? '', done: s !== 'PENDING' && s !== 'EXPECTED' && s !== '', ok: s === 'SUCCESS' };
      }
      const status = String(c.status ?? '').toUpperCase();
      const conclusion = String(c.conclusion ?? '').toUpperCase();
      return {
        name: c.name ?? '',
        done: status === 'COMPLETED',
        ok: ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(conclusion),
      };
    })
    .filter((r) => r && !ignore.test(r.name));
  if (rows.length === 0) return 'none';
  if (rows.some((r) => r.done && !r.ok)) return 'failure';
  if (rows.some((r) => !r.done)) return 'pending';
  return 'success';
}

/**
 * Where a pull request belongs.
 *   merged or closed            → Done
 *   label waiting-on-sree       → Waiting on Sree
 *   draft                       → Building (spec PR: Spec)
 *   checks green                → Ready to test (spec PR: Waiting on Sree)
 *   checks red / pending / none → Building (spec PR: Spec)
 */
export function prStatus({ state = 'OPEN', merged = false, isDraft = false, labels = [], title = '', checks = 'none' } = {}) {
  const s = String(state).toUpperCase();
  if (merged || s === 'MERGED' || s === 'CLOSED') return STATUS.DONE;
  if (lower(labels).includes(WAITING_LABEL)) return STATUS.WAITING;
  const spec = isSpecPr({ title, labels });
  if (isDraft) return spec ? STATUS.SPEC : STATUS.BUILDING;
  if (checks === 'success') return spec ? STATUS.WAITING : STATUS.READY;
  return spec ? STATUS.SPEC : STATUS.BUILDING;
}

/**
 * Where an issue belongs.
 *   closed                      → Done
 *   label waiting-on-sree       → Waiting on Sree
 *   label found-by-tests / bug  → Building
 *   anything else               → Spec (not started, not approved)
 */
export function issueStatus({ state = 'OPEN', labels = [] } = {}) {
  if (String(state).toUpperCase() === 'CLOSED') return STATUS.DONE;
  const l = lower(labels);
  if (l.includes(WAITING_LABEL)) return STATUS.WAITING;
  if (l.includes('found-by-tests') || l.includes('bug')) return STATUS.BUILDING;
  return STATUS.SPEC;
}

/**
 * The optional "Note" text: "Not in APK v11" / "In APK v11" read from the PR body's Status block row
 * `| In [APK vN](…) … | yes / no … |`; "Closed without merge" for a PR closed unmerged. null = leave alone.
 */
export function noteFor({ state = 'OPEN', merged = false, body = '' } = {}) {
  if (!merged && String(state).toUpperCase() === 'CLOSED') return 'Closed without merge';
  const m = String(body ?? '').match(/\|\s*In \[APK v(\d+)\][^|]*\|\s*([^|\n]*)\|/i);
  if (!m) return null;
  const v = m[2].replace(/\*/g, '').trim().toLowerCase();
  if (v.startsWith('yes')) return `In APK v${m[1]}`;
  if (v.startsWith('no')) return `Not in APK v${m[1]}`;
  return null;
}
