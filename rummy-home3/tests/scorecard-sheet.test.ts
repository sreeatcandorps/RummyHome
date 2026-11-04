import assert from 'node:assert/strict';
import test from 'node:test';
import { scorecardUrl } from '../utils/shareLink';
import { buildScorecardSheet, canShareResults, placeLine } from '../utils/scorecardSheet';

test('the public link keeps the token and can carry the game number', () => {
  const token = 'ab'.repeat(24);
  assert.match(scorecardUrl(token), /scorecard\.html\?t=abab/);
  assert.match(scorecardUrl(token, 12), /[?&]g=12$/);
  assert.doesNotMatch(scorecardUrl(token), /[?&]g=/);
});

test('a results image is the full scorecard and names the places without scores', () => {
  const sheet = buildScorecardSheet({
    gameNumber: 4,
    gameLabel: 'ABCD',
    when: 'Fri, Oct 30 · 8:47 PM',
    isComplete: true,
    players: [
      { id: 'sk', name: 'Sree Koneru' },
      { id: 'p1', name: 'Player 1' },
      { id: 'hg', name: 'Harish Gadupudi' },
    ],
    scores: {
      sk: [90, 30],
      p1: [-40, -10],
      hg: [-50, -20],
    },
  });

  assert.equal(sheet.brand, 'EZ Score: Rummy');
  assert.equal(sheet.heading, 'G4');
  assert.equal(sheet.when, 'Fri, Oct 30 · 8:47 PM');
  assert.equal(sheet.status, 'Completed');
  assert.deepEqual(sheet.columns.map((column) => column.label), ['SK', 'P1', 'HG']);
  assert.equal(sheet.rounds.length, 2);
  assert.deepEqual(sheet.rounds[0].cells.map((cell) => cell.text), ['+90', '-40', '-50']);
  assert.deepEqual(sheet.rounds[1].cells.map((cell) => cell.text), ['+30', '-10', '-20']);
  assert.equal(sheet.totalSum, 0);
  assert.deepEqual(sheet.columns.map((column) => column.total), [120, -50, -70]);
  assert.deepEqual(sheet.places.map(placeLine), ['1st  Sree Koneru', '2nd  Player 1', '3rd  Harish Gadupudi']);
  sheet.places.forEach((place) => {
    assert.equal('points' in place, false);
    assert.doesNotMatch(placeLine(place), /\+\d|-\d/);
  });
  assert.equal(canShareResults(true), true);
  assert.equal(canShareResults(false), false);
});
