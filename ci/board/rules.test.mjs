import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asksSree, BOARD_OPTIONS, checksState, isApproved, isParked, isSpecPr, issueStatus, noteFor, planOptions, prStatus, STATUS } from './rules.mjs';

const run = (name, status, conclusion) => ({ __typename: 'CheckRun', name, status, conclusion });
const ctx = (context, state) => ({ __typename: 'StatusContext', context, state });

test('spec PRs: label, "Spec …", "PR 14 spec …", "… docs only"; build PRs are not', () => {
  assert.ok(isSpecPr({ title: 'PR 14 spec: Multiplier for Points games' }));
  assert.ok(isSpecPr({ title: 'PR 11 spec: Help redesign — docs only' }));
  assert.ok(isSpecPr({ title: 'Spec for seating' }));
  assert.ok(isSpecPr({ title: 'PR 23: User flows & scenarios (docs only)' }));
  assert.ok(isSpecPr({ title: 'PR 20 spec: Going rogue — docs + mockups only' }));
  assert.ok(isSpecPr({ title: 'Anything', labels: ['spec'] }));
  assert.ok(isSpecPr({ title: 'Anything', labels: [{ name: 'Docs' }] }));
  assert.ok(!isSpecPr({ title: 'PR 14 build: Multiplier' }));
  assert.ok(!isSpecPr({ title: 'PR 22: No permanent delete — migration 046' }));
  assert.ok(!isSpecPr({ title: 'Specific fix for the spectator chip' }), '"Spec" must be a whole word');
});

test('checksState: success only when every non-board-sync check completed ok', () => {
  assert.equal(checksState([]), 'none');
  assert.equal(checksState([run('board-sync', 'IN_PROGRESS', null)]), 'none', 'our own run never counts');
  assert.equal(checksState([run('unit', 'COMPLETED', 'SUCCESS'), run('db', 'COMPLETED', 'SKIPPED'), run('ui (smoke)', 'COMPLETED', 'NEUTRAL')]), 'success');
  assert.equal(checksState([run('unit', 'COMPLETED', 'SUCCESS'), run('ui (smoke)', 'IN_PROGRESS', null)]), 'pending');
  assert.equal(checksState([run('unit', 'COMPLETED', 'SUCCESS'), run('ui (smoke)', 'QUEUED', null)]), 'pending');
  assert.equal(checksState([run('unit', 'COMPLETED', 'FAILURE'), run('ui (smoke)', 'IN_PROGRESS', null)]), 'failure', 'one red check is red even while others run');
  assert.equal(checksState([run('unit', 'COMPLETED', 'CANCELLED')]), 'failure');
  assert.equal(checksState([run('unit', 'COMPLETED', 'TIMED_OUT')]), 'failure');
  assert.equal(checksState([run('unit', 'COMPLETED', 'SUCCESS'), run('Board sync / sync', 'IN_PROGRESS', null)]), 'success');
  assert.equal(checksState([ctx('eas/build', 'SUCCESS')]), 'success');
  assert.equal(checksState([ctx('eas/build', 'PENDING')]), 'pending');
  assert.equal(checksState([ctx('eas/build', 'ERROR')]), 'failure');
  assert.equal(checksState([ctx('eas/build', 'FAILURE'), run('unit', 'COMPLETED', 'SUCCESS')]), 'failure');
});

const forSree = (decide) => `## For Sree\n\n- **Decide:** ${decide}\n- **A user will notice:** nothing\n`;

test('asksSree reads the Decide line of the For Sree block', () => {
  assert.equal(asksSree(forSree('nothing, merge is pre-approved (D80)')), false);
  assert.equal(asksSree(forSree('**nothing** — docs only')), false);
  assert.equal(asksSree(forSree('Nothing new: D73 is built here')), false);
  assert.equal(asksSree(forSree('**merge #120?** It recolours public/')), true);
  assert.equal(asksSree(forSree('merge this? Default: it waits.')), true);
  assert.equal(asksSree('no For Sree block'), null);
  assert.equal(asksSree(''), null);
});

test('isParked: label or a "Parked:" title', () => {
  assert.ok(isParked({ title: 'Parked: WhatsApp sign-in: design spec and mockups (no build)' }));
  assert.ok(isParked({ title: 'iPhone plan', labels: ['parked'] }));
  assert.ok(!isParked({ title: 'Park the car button' }), '"Park" is not "Parked"');
});

test('prStatus: build PRs', () => {
  const build = { title: 'PR 22: No permanent delete — migration 046' };
  assert.equal(prStatus({ ...build, checks: 'none' }), STATUS.IN_PROGRESS, 'opened, nothing ran yet');
  assert.equal(prStatus({ ...build, checks: 'pending' }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...build, checks: 'failure' }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...build, checks: 'success' }), STATUS.IN_PROGRESS, 'green with no question → Build Bot merges it (D80)');
  assert.equal(prStatus({ ...build, checks: 'success', body: forSree('nothing, merge is pre-approved (D80)') }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...build, checks: 'success', body: forSree('merge #120? It recolours public/') }), STATUS.WAITING, 'green and a question → Waiting on Sree');
  assert.equal(prStatus({ ...build, checks: 'failure', body: forSree('merge #120?') }), STATUS.IN_PROGRESS, 'not his turn while it is red');
  assert.equal(prStatus({ ...build, checks: 'success', isDraft: true, body: forSree('merge?') }), STATUS.IN_PROGRESS, 'a draft is never waiting');
  assert.equal(prStatus({ ...build, checks: 'success', labels: ['waiting-on-sree'] }), STATUS.WAITING, 'the label wins');
  assert.equal(prStatus({ ...build, checks: 'failure', labels: [{ name: 'Waiting-On-Sree' }] }), STATUS.WAITING, 'label is case-insensitive');
  assert.equal(prStatus({ ...build, checks: 'success', state: 'MERGED', merged: true }), STATUS.DONE);
  assert.equal(prStatus({ ...build, state: 'MERGED', merged: true, labels: ['live'] }), STATUS.LIVE, 'label live → Live');
  assert.equal(prStatus({ ...build, checks: 'success', state: 'CLOSED' }), STATUS.DONE, 'closed unmerged is Done too (noted)');
  assert.equal(prStatus({ ...build, state: 'CLOSED', labels: ['waiting-on-sree'] }), STATUS.DONE, 'closed beats the label');
});

test('prStatus: brainstorm and parked PRs', () => {
  assert.equal(prStatus({ title: 'Parked: iPhone plan', checks: 'success', body: forSree('nothing') }), STATUS.PARKED);
  assert.equal(prStatus({ title: 'Owner support menu', labels: ['brainstorm'], checks: 'success' }), STATUS.BRAINSTORM);
  assert.equal(prStatus({ title: 'Parked: iPhone plan', labels: ['waiting-on-sree'] }), STATUS.PARKED, 'parked beats waiting');
  assert.equal(prStatus({ title: 'Parked: iPhone plan', state: 'CLOSED' }), STATUS.DONE);
});

test('prStatus: spec / docs-only PRs', () => {
  const spec = { title: 'PR 11 spec: Help redesign — docs only' };
  assert.equal(prStatus({ ...spec, checks: 'none' }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...spec, checks: 'pending' }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...spec, checks: 'failure' }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...spec, checks: 'success' }), STATUS.WAITING, 'green docs without a Decide line → Sree reads it');
  assert.equal(prStatus({ ...spec, checks: 'success', body: forSree('nothing, docs only (D80)') }), STATUS.IN_PROGRESS, 'the Decide line wins');
  assert.equal(prStatus({ ...spec, checks: 'success', isDraft: true }), STATUS.IN_PROGRESS);
  assert.equal(prStatus({ ...spec, checks: 'success', state: 'MERGED', merged: true }), STATUS.DONE);
  assert.equal(prStatus({ title: 'PR 23: User flows (docs only)', checks: 'success' }), STATUS.WAITING);
});

test('approved spec PRs (built elsewhere) are Done, not Waiting on Sree', () => {
  const spec = { title: 'PR 14 spec: Multiplier — docs only', checks: 'success' };
  assert.ok(isApproved({ labels: ['approved'] }));
  assert.ok(isApproved({ labels: [{ name: 'Approved' }] }));
  assert.ok(isApproved({ body: '## Status\n| | |\n| --- | --- |\n| Approved | yes — built in #49 |\n' }));
  assert.ok(isApproved({ body: '| Approved | **yes** (Nov 15) |' }));
  assert.ok(!isApproved({ body: '| Approved | no — Q11 open |' }));
  assert.ok(!isApproved({ body: 'Approved: yes' }), 'only the Status-block row counts');
  assert.ok(!isApproved({}));
  assert.equal(prStatus({ ...spec, labels: ['approved'] }), STATUS.DONE);
  assert.equal(prStatus({ ...spec, body: '| Approved | yes — built in #49 |' }), STATUS.DONE);
  assert.equal(prStatus({ ...spec, body: '| Approved | yes |', checks: 'pending' }), STATUS.DONE, 'approval does not wait for checks');
  assert.equal(prStatus({ ...spec, body: '| Approved | yes |', labels: ['waiting-on-sree'] }), STATUS.WAITING, 'an explicit waiting label still wins');
  assert.equal(prStatus({ ...spec, body: '| Approved | no |' }), STATUS.WAITING, 'not approved, green → Waiting on Sree');
  assert.equal(prStatus({ title: 'PR 22: build', checks: 'success', labels: ['approved'] }), STATUS.IN_PROGRESS, 'approved means nothing for a build PR');
});

test('issueStatus', () => {
  assert.equal(issueStatus({ state: 'OPEN', labels: [] }), STATUS.TODO);
  assert.equal(issueStatus({ state: 'OPEN', labels: ['found-by-tests', 'bug'] }), STATUS.TODO, 'a bug is To do until a PR picks it up');
  assert.equal(issueStatus({ state: 'OPEN', labels: ['waiting-on-sree'] }), STATUS.WAITING);
  assert.equal(issueStatus({ state: 'OPEN', labels: ['waiting-on-sree', 'bug'] }), STATUS.WAITING, 'the label wins');
  assert.equal(issueStatus({ state: 'OPEN', labels: ['brainstorm'] }), STATUS.BRAINSTORM);
  assert.equal(issueStatus({ state: 'OPEN', labels: ['parked'] }), STATUS.PARKED);
  assert.equal(issueStatus({ state: 'OPEN', title: 'Parked: Telugu' }), STATUS.PARKED);
  assert.equal(issueStatus({ state: 'OPEN', labels: ['in-progress'] }), STATUS.IN_PROGRESS, 'work outside a PR');
  assert.equal(issueStatus({ state: 'CLOSED', labels: ['waiting-on-sree'] }), STATUS.DONE);
  assert.equal(issueStatus({ state: 'CLOSED', labels: ['live'] }), STATUS.LIVE);
});

test('planOptions: renames Spec / Building in place, adds the new columns, drops the rest', () => {
  const old = [
    { id: 's', name: 'Spec', color: 'GRAY', description: '' },
    { id: 'w', name: 'Waiting on Sree', color: 'YELLOW', description: '' },
    { id: 'b', name: 'Building', color: 'BLUE', description: '' },
    { id: 'r', name: 'Ready to test', color: 'GREEN', description: '' },
    { id: 'd', name: 'Done', color: 'PURPLE', description: '' },
  ];
  const { options, changed } = planOptions(old);
  assert.ok(changed);
  assert.deepEqual(options.map((o) => o.name), ['Brainstorming', 'To do', 'In progress', 'Waiting on Sree', 'Done', 'Live', 'Parked']);
  assert.deepEqual(options.map((o) => o.id ?? null), [null, 's', 'b', 'w', 'd', null, null], 'cards on Spec / Building / Waiting / Done keep their option');
  assert.deepEqual(Object.values(STATUS).sort(), options.map((o) => o.name).sort(), 'every status has a column');
  const again = planOptions(options.map((o, i) => ({ id: o.id ?? `n${i}`, ...o })));
  assert.equal(again.changed, false, 'a second run changes nothing');
  assert.equal(BOARD_OPTIONS.length, 7);
});

test('noteFor reads the Status block APK row; closed unmerged says so', () => {
  const row = (v) => `## Status\n| | |\n| --- | --- |\n| In [APK v11](https://expo.dev/x.apk) (versionCode 11, \`6a262d2\`) | ${v} |\n| Stack | base #67 |`;
  assert.equal(noteFor({ body: row('**no** — v11 still says gone for good') }), 'Not in APK v11');
  assert.equal(noteFor({ body: row('yes (head of the stack)') }), 'In APK v11');
  assert.equal(noteFor({ body: row('n/a (docs)') }), null);
  assert.equal(noteFor({ body: 'no status block' }), null);
  assert.equal(noteFor({ body: '' }), null);
  assert.equal(noteFor({ state: 'CLOSED', merged: false, body: row('yes') }), 'Closed without merge');
  assert.equal(noteFor({ state: 'MERGED', merged: true, body: row('yes') }), 'In APK v11');
});
