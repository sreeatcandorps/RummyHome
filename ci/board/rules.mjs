// Board sync — the rules, pure and unit-tested (ci/board/rules.test.mjs). sync.mjs applies them.
//
// Status options on the board, in column order (matched by name at run time, never by id). Sree, Nov 24:
// "I want another category in the Kanban board that says something like 'we're still brainstorming' …
// Once it's brainstormed, then it moves to: To Do · In Progress · Waiting on Me · Live … If you postpone
// something, if you park something, then maybe that should be a different one."

export const STATUS = Object.freeze({
  BRAINSTORM: 'Brainstorming',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting on Sree',
  DONE: 'Done',
  LIVE: 'Live',
  PARKED: 'Parked',
});

/**
 * The Status options sync.mjs keeps on the board, in this order. `was` names an older option renamed in place,
 * so its id (and every card on it) survives the rename; options not listed here are removed.
 */
export const BOARD_OPTIONS = Object.freeze([
  { name: STATUS.BRAINSTORM, color: 'PINK', description: 'Still being thought through: nothing decided, nothing built.' },
  { name: STATUS.TODO, color: 'GRAY', description: 'Decided, not started yet.', was: ['Spec'] },
  { name: STATUS.IN_PROGRESS, color: 'BLUE', description: 'A builder is on it: a branch or an open PR.', was: ['Building', 'Ready to test'] },
  { name: STATUS.WAITING, color: 'YELLOW', description: "Needs Sree's answer or yes." },
  { name: STATUS.DONE, color: 'GREEN', description: 'Merged or closed. App changes reach users with the next release.' },
  { name: STATUS.LIVE, color: 'PURPLE', description: 'In users\' hands: in a Play release, or deployed (site, e-mails, server).' },
  { name: STATUS.PARKED, color: 'ORANGE', description: 'Kept for discussion; no work until Sree un-parks it.' },
]);

export const WAITING_LABEL = 'waiting-on-sree';
export const APPROVED_LABEL = 'approved';
export const BRAINSTORM_LABEL = 'brainstorm';
export const PARKED_LABEL = 'parked';
export const LIVE_LABEL = 'live';
export const IN_PROGRESS_LABEL = 'in-progress';

const lower = (labels) => (labels ?? []).map((l) => (typeof l === 'string' ? l : l?.name ?? '').toLowerCase());

/** A spec / docs-only PR: label `spec` or `docs`, or a title like "Spec …", "PR 14 spec …", "… docs only". */
export function isSpecPr({ title = '', labels = [] } = {}) {
  const l = lower(labels);
  if (l.includes('spec') || l.includes('docs')) return true;
  const t = title.trim();
  return /^spec\b/i.test(t) || /^PR\s*\d+[a-z]?\s*spec\b/i.test(t) || /\bdocs(\s*\+\s*mockups)?\s*only\b/i.test(t);
}

/**
 * Sree has approved this spec and nothing is left for him: label `approved`, or a Status-block row
 * `| Approved | yes … |` in the PR body (the agent can write the row when it cannot set labels).
 */
export function isApproved({ labels = [], body = '' } = {}) {
  if (lower(labels).includes(APPROVED_LABEL)) return true;
  return /^\|\s*Approved\s*\|\s*\*{0,2}yes\b/im.test(String(body ?? ''));
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
 * Does the PR's five-line "For Sree" block ask him something? Reads the `- **Decide:** …` line: "nothing …"
 * means no (a pre-approved merge, D80); any other text means yes. null when the PR has no Decide line.
 */
export function asksSree(body = '') {
  const m = String(body ?? '').match(/^\s*[-*]\s*\*\*Decide:?\*\*:?\s*(.*)$/im);
  if (!m) return null;
  return !/^nothing\b/i.test(m[1].replace(/[*_`]/g, '').trim());
}

/** Is this PR or issue parked: label `parked`, or a title starting "Parked:" (D81)? */
export function isParked({ title = '', labels = [] } = {}) {
  return lower(labels).includes(PARKED_LABEL) || /^parked\b/i.test(String(title).trim());
}

/**
 * Where a pull request belongs.
 *   merged or closed            → Done (label `live` → Live)
 *   label brainstorm            → Brainstorming
 *   parked (label / title)      → Parked
 *   label waiting-on-sree       → Waiting on Sree
 *   spec PR approved (label / Status row) → Done — nothing left for Sree; the build lives in its own PR
 *   draft                       → In progress
 *   checks green and the Decide line asks Sree (no Decide line: spec PRs do) → Waiting on Sree
 *   anything else               → In progress
 */
export function prStatus({ state = 'OPEN', merged = false, isDraft = false, labels = [], title = '', body = '', checks = 'none' } = {}) {
  const s = String(state).toUpperCase();
  const l = lower(labels);
  if (merged || s === 'MERGED' || s === 'CLOSED') return l.includes(LIVE_LABEL) ? STATUS.LIVE : STATUS.DONE;
  if (l.includes(BRAINSTORM_LABEL)) return STATUS.BRAINSTORM;
  if (isParked({ title, labels })) return STATUS.PARKED;
  if (l.includes(WAITING_LABEL)) return STATUS.WAITING;
  const spec = isSpecPr({ title, labels });
  if (spec && isApproved({ labels, body })) return STATUS.DONE;
  if (isDraft) return STATUS.IN_PROGRESS;
  if (checks === 'success' && (asksSree(body) ?? spec)) return STATUS.WAITING;
  return STATUS.IN_PROGRESS;
}

/**
 * Where an issue belongs.
 *   closed                      → Done (label `live` → Live)
 *   label brainstorm            → Brainstorming
 *   parked (label / title)      → Parked
 *   label waiting-on-sree       → Waiting on Sree
 *   label in-progress           → In progress (work outside a PR, e.g. the Play review)
 *   anything else               → To do (a builder picks it up by opening a PR, which is In progress)
 */
export function issueStatus({ state = 'OPEN', labels = [], title = '' } = {}) {
  const l = lower(labels);
  if (String(state).toUpperCase() === 'CLOSED') return l.includes(LIVE_LABEL) ? STATUS.LIVE : STATUS.DONE;
  if (l.includes(BRAINSTORM_LABEL)) return STATUS.BRAINSTORM;
  if (isParked({ title, labels })) return STATUS.PARKED;
  if (l.includes(WAITING_LABEL)) return STATUS.WAITING;
  if (l.includes(IN_PROGRESS_LABEL)) return STATUS.IN_PROGRESS;
  return STATUS.TODO;
}

/**
 * The Status option list to write to the board: BOARD_OPTIONS in order, each keeping the id of the existing
 * option with its name (or a `was` name), so renamed columns keep their cards. `changed` is false when the board
 * already has exactly these names, colours and descriptions in this order.
 */
export function planOptions(existing = []) {
  const byName = new Map(existing.map((o) => [String(o.name).trim().toLowerCase(), o]));
  const used = new Set();
  const options = BOARD_OPTIONS.map(({ name, color, description, was = [] }) => {
    const hit = [name, ...was].map((n) => byName.get(n.toLowerCase())).find((o) => o && !used.has(o.id));
    if (hit) used.add(hit.id);
    return { ...(hit ? { id: hit.id } : {}), name, color, description };
  });
  const same = existing.length === options.length && options.every((o, i) =>
    existing[i].name === o.name && existing[i].color === o.color && (existing[i].description ?? '') === o.description);
  return { options, changed: !same };
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
