import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DELETE_RESULT_BUTTON,
  DELETED_RETENTION_DAYS,
  DELETED_SECTION_NOTE,
  deleteConsequence,
  deletedToast,
  deleteRowLabel,
  gameLabelsOf,
  listedDeleted,
  RESTORED_TOAST,
  SHARED_CONFIRM_BODY,
  SHARED_CONFIRM_TITLE,
  UNDO_DELETE_MS,
  withinRetention,
} from '../utils/resultsDelete';
import { addShared, SHARED_RESULTS_CAP } from '../utils/sharedResults';

const read = (relative: string) => readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('9.1 the consequence line names what reopens for 0, 1 and 2 games and how long Restore lasts', () => {
  assert.equal(DELETED_RETENTION_DAYS, 30);
  assert.equal(deleteConsequence([]), 'Everyone loses this result; you can restore it for 30 days.');
  assert.equal(deleteConsequence(['S14']), 'S14 goes back to Completed and can go into a new result. Everyone loses this result; you can restore it for 30 days.');
  assert.equal(deleteConsequence(['S14', 'S15']), 'S14 and S15 go back to Completed and can go into a new result. Everyone loses this result; you can restore it for 30 days.');
  assert.equal(deleteConsequence(['S1', 'S2', 'P1']), 'S1, S2 and P1 go back to Completed and can go into a new result. Everyone loses this result; you can restore it for 30 days.');
  assert.deepEqual(gameLabelsOf([{ label: 'S14', name: 'ABCDEF' }, { name: '7F3A2C' }, { label: null, name: 'XY' }]), ['S14', '7F3A2C', 'XY'], 'the game number wins, the short code stands in');
});

test('9.2 the Undo toast stays 10 seconds and says which games are Completed again; the shared confirm has its own words', () => {
  assert.equal(UNDO_DELETE_MS, 10000);
  assert.equal(deletedToast(['S14', 'S15']), 'Result deleted · S14, S15 are Completed again');
  assert.equal(deletedToast(['S14']), 'Result deleted · S14 is Completed again');
  assert.equal(deletedToast([]), 'Result deleted · its games are Completed again');
  assert.equal(RESTORED_TOAST, 'Result restored · its games are Closed again');
  assert.equal(SHARED_CONFIRM_TITLE, 'Delete a shared result?');
  assert.match(SHARED_CONFIRM_BODY, /shared from this phone/);
  assert.match(SHARED_CONFIRM_BODY, /restore it for 30 days/);
  assert.equal(DELETE_RESULT_BUTTON, 'Delete this result');
  assert.equal(deleteRowLabel('Thu, Nov 12 · 10:14 PM'), 'Delete the result from Thu, Nov 12 · 10:14 PM');
});

test('9.3 the Deleted list keeps 30 days, newest deletion first', () => {
  const now = Date.UTC(2026, 10, 13, 12, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  assert.equal(withinRetention(new Date(now - 29 * day).toISOString(), now), true);
  assert.equal(withinRetention(new Date(now - 30 * day).toISOString(), now), true, 'the 30th day is still listed');
  assert.equal(withinRetention(new Date(now - 31 * day).toISOString(), now), false);
  assert.equal(withinRetention('not a date', now), false);
  const rows = [
    { id: 'old', deletedAt: new Date(now - 40 * day).toISOString() },
    { id: 'a', deletedAt: new Date(now - 2 * day).toISOString() },
    { id: 'b', deletedAt: new Date(now - 1 * day).toISOString() },
  ];
  assert.deepEqual(listedDeleted(rows, now).map((row) => row.id), ['b', 'a']);
  assert.match(DELETED_SECTION_NOTE, /30 days under "Deleted" for the people who could delete them/);
});

test('9.4 the shared marker moves an id to the front and never grows past the cap', () => {
  assert.deepEqual(addShared([], 'r1'), ['r1']);
  assert.deepEqual(addShared(['r1', 'r2'], 'r2'), ['r2', 'r1']);
  assert.equal(SHARED_RESULTS_CAP, 200);
  const full = Array.from({ length: 200 }, (_, index) => `r${index}`);
  const next = addShared(full, 'new');
  assert.equal(next.length, 200);
  assert.equal(next[0], 'new');
  assert.ok(!next.includes('r199'), 'the oldest id fell off');
});

test('9.5 the result page: visible Delete this result for managers, consequence line, Undo toast, confirm only when shared, back when the toast closes', () => {
  const page = read('app/(screens)/results/[id].tsx');
  assert.match(page, /\{result\?\.canManage \? \(\s*<View style=\{styles\.deleteBlock\}>/, 'the button block is for managers only');
  assert.match(page, /testID="result-delete"/);
  assert.match(page, /\{deleteConsequence\(gameLabels\)\}/);
  assert.match(
    page,
    /const shared = wasShared \|\| \(result \? await sharedResults\.was\(result\.id\)\.catch\(\(\) => false\) : false\);\s*if \(shared\) \{\s*setWasShared\(true\);\s*setDeleteOpen\(true\);\s*\} else \{\s*await confirmDelete\(\);/,
    'D9.2: ask only when shared, re-reading the marker so a share on this visit counts',
  );
  assert.match(page, /sharedResults\.was\(loaded\.id\)\.then\(setWasShared\)/);
  assert.match(page, /setUndoToast\(deletedToast\(gameLabels\)\)/);
  assert.match(page, /duration=\{UNDO_DELETE_MS\}[\s\S]*?action=\{\{ label: 'Undo', onPress: undoDelete/);
  assert.match(page, /if \(!undone\.current\) router\.back\(\);/, 'leaving the toast alone goes back to the list');
  assert.match(page, /<Dialog\.Title>\{SHARED_CONFIRM_TITLE\}<\/Dialog\.Title>/);
  assert.match(page, /title="Delete result" titleStyle=\{\{ color: colors\.error \}\} onPress=\{startDelete\}/, 'the ⋮ item does the same');
  assert.match(page, /<ResultsShare card=\{card\} details=\{details\} createdAt=\{result\?\.declaredAt\} resultId=\{result\?\.id\} \/>/, 'shares from the saved page are marked');
  const share = read('components/results/ResultsShare.tsx');
  assert.match(share, /if \(resultId\) sharedResults\.mark\(resultId\)/);
  assert.equal((share.match(/sharedResults\.mark\(resultId\)/g) ?? []).length, 2, 'picture and PDF both mark');
});

test('9.6 Past results: Delete chip per manageable row, a Deleted section with Restore inside 30 days, Undo toast, confirm when shared', () => {
  const list = read('app/(screens)/results/index.tsx');
  assert.match(list, /archiveService\.manageableResults\(first\.map\(\(row\) => row\.id\), id\)\.then\(setManageable\)/);
  assert.match(list, /canDelete=\{manageable\.has\(item\.id\) && rowBusy !== item\.id\} onDelete=\{\(\) => askDelete\(item\)\}/);
  assert.match(list, /testID=\{`past-result-delete-\$\{item\.id\}`\}/);
  assert.match(list, /setDeletedRows\(listedDeleted\(lists\.deletedResults\)\)/, 'the 30-day window is applied on the phone');
  assert.match(list, /testID="deleted-results"/);
  assert.match(list, /testID=\{`deleted-result-restore-\$\{row\.id\}`\}/);
  assert.match(list, /<Tag label=\{DELETED_TAG\} tone="neutral" \/>/);
  assert.match(list, /if \(await sharedResults\.was\(item\.id\)\.catch\(\(\) => false\)\) setSharedConfirm\(item\);\s*else deleteRow\(item\);/);
  assert.match(list, /duration=\{UNDO_DELETE_MS\}[\s\S]*?action=\{\{ label: 'Undo', onPress: undoDelete/);
  assert.match(list, /\{DELETED_SECTION_NOTE\}/);
  const archive = read('services/archive.ts');
  assert.match(archive, /supabase\.rpc\('can_manage_result', \{ p_result_id: id \}\)/, 'the 023 function already granted to authenticated');
});

test('9.7 docs and help: results-delete.md exists with the decisions; the Results help names the button, Undo and the 30 days', () => {
  const doc = read('docs/results-delete.md');
  for (const needle of ['D9.1', 'D9.2', 'D9.3', 'sync_closed_at', 'can_manage_result', '30 days', 'sharedResults', '/r/']) assert.match(doc, new RegExp(needle.replace(/[/.]/g, '\\$&')), needle);
  const help = read('constants/help.ts');
  assert.match(help, /Delete this result \(at the foot of a result, or Delete on its Past results row\) reopens its games to Completed\. Undo for 10 seconds; its admins see it under Deleted with Restore for 30 days\./);
});
