import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checksState, isSpecPr, issueStatus, noteFor, prStatus, STATUS } from './rules.mjs';

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

test('prStatus: build PRs', () => {
  const build = { title: 'PR 22: No permanent delete — migration 046' };
  assert.equal(prStatus({ ...build, checks: 'none' }), STATUS.BUILDING, 'opened, nothing ran yet');
  assert.equal(prStatus({ ...build, checks: 'pending' }), STATUS.BUILDING);
  assert.equal(prStatus({ ...build, checks: 'failure' }), STATUS.BUILDING, 'red → back to Building');
  assert.equal(prStatus({ ...build, checks: 'success' }), STATUS.READY, 'green → Ready to test');
  assert.equal(prStatus({ ...build, checks: 'success', isDraft: true }), STATUS.BUILDING, 'a draft is never ready');
  assert.equal(prStatus({ ...build, checks: 'success', labels: ['waiting-on-sree'] }), STATUS.WAITING, 'the label wins over green');
  assert.equal(prStatus({ ...build, checks: 'failure', labels: [{ name: 'Waiting-On-Sree' }] }), STATUS.WAITING, 'label is case-insensitive');
  assert.equal(prStatus({ ...build, checks: 'success', state: 'MERGED', merged: true }), STATUS.DONE);
  assert.equal(prStatus({ ...build, checks: 'success', state: 'CLOSED' }), STATUS.DONE, 'closed unmerged is Done too (noted)');
  assert.equal(prStatus({ ...build, state: 'CLOSED', labels: ['waiting-on-sree'] }), STATUS.DONE, 'closed beats the label');
});

test('prStatus: spec / docs-only PRs', () => {
  const spec = { title: 'PR 11 spec: Help redesign — docs only' };
  assert.equal(prStatus({ ...spec, checks: 'none' }), STATUS.SPEC);
  assert.equal(prStatus({ ...spec, checks: 'pending' }), STATUS.SPEC);
  assert.equal(prStatus({ ...spec, checks: 'failure' }), STATUS.SPEC);
  assert.equal(prStatus({ ...spec, checks: 'success' }), STATUS.WAITING, 'green docs → Sree reads it');
  assert.equal(prStatus({ ...spec, checks: 'success', isDraft: true }), STATUS.SPEC);
  assert.equal(prStatus({ ...spec, checks: 'success', state: 'MERGED', merged: true }), STATUS.DONE);
  assert.equal(prStatus({ title: 'PR 23: User flows (docs only)', checks: 'success' }), STATUS.WAITING);
});

test('issueStatus', () => {
  assert.equal(issueStatus({ state: 'OPEN', labels: [] }), STATUS.SPEC, 'an idea nobody approved is Spec, not waiting');
  assert.equal(issueStatus({ state: 'OPEN', labels: ['found-by-tests', 'bug'] }), STATUS.BUILDING);
  assert.equal(issueStatus({ state: 'OPEN', labels: [{ name: 'bug' }] }), STATUS.BUILDING);
  assert.equal(issueStatus({ state: 'OPEN', labels: ['waiting-on-sree'] }), STATUS.WAITING);
  assert.equal(issueStatus({ state: 'OPEN', labels: ['waiting-on-sree', 'bug'] }), STATUS.WAITING, 'the label wins');
  assert.equal(issueStatus({ state: 'CLOSED', labels: ['waiting-on-sree'] }), STATUS.DONE);
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
