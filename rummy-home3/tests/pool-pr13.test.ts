import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Game } from '../types/game';
import {
  afterRound,
  DEFAULT_POOL_LIMIT,
  REENTRY_BLOCK_TEXT,
  reentryLimitLabel,
  reentryLimitOf,
  dropsLeft,
  eligibleForReentry,
  GIVE_AWARDS_FIRST,
  lastPlayerStanding,
  limitHint,
  overFullCount,
  parsePoolLimit,
  playersIn,
  POOL_CUSTOM_MAX,
  POOL_CUSTOM_MIN,
  POOL_LIMITS,
  poolNeedsAwards,
  poolStandings,
  poolStatusLabel,
  poolTotal,
  reentryBlock,
  reentryScore,
  resultScoresOf,
  validatePoolRound,
} from '../utils/pool';
import { AWARD_PRESETS, awardsPayload, buildAwardSheet, getsFromAwards, givenOutText, NOT_VIABLE_TEXT, presetGets, presetViability, saveAnywayText, viablePresets, winnerGetsMost, winnersOf } from '../utils/poolAwards';
import {
  allRulesFromProfileDefaults,
  DEFAULT_POOL_RULES,
  parseRuleInput,
  rulesFromGame,
  rulesFromProfileDefaults,
  rulesToProfileDefaults,
  validateRules,
} from '../utils/gameSettings';
import { draftFromRules, rulesFromDraft } from '../utils/rulesDraft';
import {
  applyPreset,
  applyRummy,
  canSaveRound,
  initialPoolEntryState,
  initialRoundEntryState,
  pressDigit,
  rummyShares,
  saveScore,
  setNegative,
  tapPlayer,
  toRoundScores,
} from '../utils/roundEntry';
import { entryFromRound } from '../utils/editRound';
import { poolScoreTone } from '../utils/scoreTone';
import { poolCompletionCheck } from '../utils/completeGame';
import { defaultResultSelection } from '../utils/results';
import { resultWarningLines, saveBlockedReason } from '../utils/resultsSave';
import { kindLabel, dotTone } from '../utils/eventLog';
import { pointsGameLabel } from '../constants/features';
import { HELP } from '../constants/help';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---------- The P12 table: six players, limit 101, 25 / 50 / 130 ----------

const A = 'a', B = 'b', C = 'c', D = 'd', E = 'e', F = 'f';
const settings = { expense: false, expenseAmount: 0, dropAmount: 25, mdAmount: 50, maxCount: 130, poolLimit: 101, reentry: true };

/** A pool mid-game: D is out at round 3, E re-entered at round 5 (counts twice), F is out at round 6. */
const game = (): Game => ({
  id: 'g1',
  gameType: 'pool',
  date: '2026-11-14T10:00:00Z',
  players: [A, B, C, D, E, F],
  scores: {
    [A]: [0, 25, 10, 0, 12, 20],
    [B]: [30, 0, 25, 40, 0, 0],
    [C]: [25, 20, 0, 25, 25, 5],
    [D]: [50, 50, 10, 0, 0, 0],
    [E]: [40, 25, 40, 0, 0, 10],
    [F]: [50, 40, 0, 20, 10, 10],
  },
  settings,
  isComplete: false,
  poolSeats: {
    [D]: { outRound: 3, reenteredRound: null, reentryScore: null, entries: 1 },
    [E]: { outRound: null, reenteredRound: 5, reentryScore: 95, entries: 2 },
    [F]: { outRound: 6, reenteredRound: null, reentryScore: null, entries: 1 },
  },
} as unknown as Game);

test('13.1 pool totals: plain sums, a re-entry restarts at the re-entry score, out stays out', () => {
  const g = game();
  assert.equal(poolTotal(g.scores[A]), 67);
  assert.equal(poolTotal(g.scores[B]), 95);
  assert.equal(poolTotal(g.scores[D], g.poolSeats![D]), 110, 'D is out at 110 (rounds after the out are 0s)');
  assert.equal(poolTotal(g.scores[E], g.poolSeats![E]), 105, 'E restarted at 95 and added rounds 5 and 6');
  assert.equal(poolTotal(g.scores[F], g.poolSeats![F]), 130);
  assert.deepEqual(playersIn(g), [A, B, C, E]);
  assert.equal(dropsLeft(67, 101, 25), 2, '34 left = 2 drops (ceil)');
  assert.equal(dropsLeft(95, 101, 25), 1);
  assert.equal(dropsLeft(101, 101, 25), 0);
  assert.equal(limitHint(101), '100 is in, 101 is out.');
});

test('13.2 standings: players in lowest first, then outs in the order they went out; points and drops left', () => {
  const rows = poolStandings(game());
  assert.deepEqual(rows.map((r) => r.playerId), [A, B, C, E, D, F]);
  assert.deepEqual(rows.map((r) => r.total), [67, 95, 100, 105, 110, 130]);
  assert.deepEqual(rows.slice(0, 4).map((r) => r.left), [34, 6, 1, 0], 'E at 105 is still in: out is a server fact per seat, not a total');
  assert.ok(rows[3].reentered && rows[3].entries === 2);
  assert.ok(rows[4].out && rows[4].outRound === 3);
});

test('13.3 round validation: plus points, at least one 0 (more than one is fine), every player still in, nobody out', () => {
  const names = (id: string) => id.toUpperCase();
  const inIds = [A, B, C];
  assert.equal(validatePoolRound([{ playerId: A, value: 0 }, { playerId: B, value: 25 }, { playerId: C, value: 10 }], inIds, names), null);
  assert.equal(validatePoolRound([{ playerId: A, value: 0 }, { playerId: B, value: 0 }, { playerId: C, value: 10 }], inIds, names), null, 'two zeros are allowed (D6)');
  assert.match(validatePoolRound([{ playerId: A, value: -5 }, { playerId: B, value: 0 }, { playerId: C, value: 10 }], inIds, names)!, /plus points/);
  assert.match(validatePoolRound([{ playerId: A, value: 5 }, { playerId: B, value: 25 }, { playerId: C, value: 10 }], inIds, names)!, /winner at 0/);
  assert.match(validatePoolRound([{ playerId: A, value: 0 }, { playerId: B, value: 25 }], inIds, names)!, /still in needs a score: C/);
  assert.match(validatePoolRound([{ playerId: A, value: 0 }, { playerId: B, value: 25 }, { playerId: C, value: 10 }, { playerId: D, value: 10 }], inIds, names)!, /D is out of the pool/);
  assert.match(validatePoolRound([{ playerId: A, value: 0 }, { playerId: B, value: 0 }, { playerId: C, value: 0 }], inIds, names)!, /Nobody lost/);
  assert.equal(overFullCount(131, 130), true, 'past the Full count asks once');
  assert.equal(overFullCount(130, 130), false);
  assert.equal(overFullCount(200, null), false, 'no Full count, no confirm');
});

test('13.4 re-entry: within the Re-entries limit (042: Unlimited by default), only while out, at the highest score still in', () => {
  const g = game();
  assert.equal(reentryBlock(g, D), null, 'D may re-enter');
  assert.equal(reentryBlock(g, F), null);
  assert.equal(reentryBlock(g, A), 'in');
  assert.equal(reentryBlock({ ...g, settings: { ...settings, reentry: false } }, D), 'off', '041 reentry:false reads as none');
  assert.equal(reentryBlock({ ...g, settings: { ...settings, reentryLimit: 0 } }, D), 'off', 'Limited 0 = none');
  assert.equal(reentryBlock({ ...g, isComplete: true }, D), 'completed');
  const eUsed = { ...g, poolSeats: { ...g.poolSeats, [E]: { outRound: 7, reenteredRound: 5, reentryScore: 95, entries: 2 } } } as Game;
  assert.equal(reentryBlock(eUsed, E), null, 'Unlimited: a second re-entry is fine');
  assert.equal(reentryBlock({ ...eUsed, settings: { ...settings, reentryLimit: 1 } }, E), 'used', 'Limited 1: once per player');
  assert.equal(reentryBlock({ ...eUsed, settings: { ...settings, reentryLimit: 2 } }, E), null, 'Limited 2: one left');
  assert.equal(reentryBlock({ ...eUsed, settings: { ...settings, reentry: true } }, E), null, '041 reentry:true reads as Unlimited');
  assert.equal(reentryLimitOf(settings), null);
  assert.equal(reentryLimitOf({ ...settings, reentryLimit: -4 }), 0, 'a negative reads as none');
  assert.equal(reentryLimitOf({ ...settings, reentryLimit: 2.7 }), 2);
  assert.equal(reentryLimitLabel(null), 'Unlimited');
  assert.equal(reentryLimitLabel(0), 'None');
  assert.equal(reentryLimitLabel(1), '1 re-entry');
  assert.equal(reentryLimitLabel(3), '3 re-entries');
  assert.equal(REENTRY_BLOCK_TEXT.used, 'Used every re-entry this pool allows.');
  assert.deepEqual(eligibleForReentry(g), [D, F]);
  assert.equal(reentryScore(g), 105, 'the highest total among players still in');
  assert.equal(lastPlayerStanding(g), false);
});

test('13.4b after a round: who went out, who may re-enter, last player standing', () => {
  const before = game();
  const after = { ...before, poolSeats: { ...before.poolSeats, [C]: { outRound: 7, reenteredRound: null, reentryScore: null, entries: 1 } }, scores: { ...before.scores, [C]: [...before.scores[C], 5] } } as Game;
  const summary = afterRound(before, after);
  assert.deepEqual(summary.newlyOut, [{ playerId: C, total: 105 }]);
  assert.deepEqual(summary.eligible, [C, D, F]);
  assert.equal(summary.reentryAt, 105);
  assert.equal(summary.lastStanding, false);
  const two = { ...after, poolSeats: { ...after.poolSeats, [A]: { outRound: 7, reenteredRound: null, reentryScore: null, entries: 1 }, [B]: { outRound: 7, reenteredRound: null, reentryScore: null, entries: 1 } } } as Game;
  assert.equal(afterRound(before, two).lastStanding, true, 'only E is left');
});

// ---------- Awards (13.5) ----------

test('13.5 award presets: winner takes all / by points left / 50-50 / entry per drop left / custom; remainders to the winner', () => {
  const standings = poolStandings(game());
  const inputs = { standings, entry: 100, limit: 101, drop: 25 };
  assert.deepEqual(winnersOf(standings), [A]);
  // 7 entries (E counts twice) × 100 = 700.
  const winner = buildAwardSheet('winner', inputs, presetGets('winner', inputs));
  assert.equal(winner.poolTotal, 700);
  assert.equal(winner.givenOut, 700);
  assert.equal(winner.rows.find((r) => r.playerId === A)!.award, 600);
  assert.equal(winner.rows.find((r) => r.playerId === E)!.award, -200, 'a re-entry put in twice');
  assert.equal(winner.rows.reduce((s, r) => s + r.award, 0), 0, 'a full pool handed out adds to 0');

  const left = presetGets('left', inputs);
  // Points left among players in: A 34, B 6, C 1, E 0 → 41.
  assert.equal(left[B], Math.floor((700 * 6) / 41));
  assert.equal(left[C], Math.floor((700 * 1) / 41));
  assert.equal(left[A], 700 - left[B] - left[C], 'the rounding remainder goes to the winner');
  assert.equal(left[E], 0);
  assert.equal(Object.values(left).reduce((s, v) => s + v, 0), 700);

  const split = presetGets('split', inputs);
  assert.equal(split[A], 350);
  assert.equal(split[B], 350, 'the two lowest still in');
  assert.equal(split[C], 0);

  const drops = presetGets('drops', inputs);
  assert.equal(drops[B], 100, '6 left = 1 drop = 1 entry');
  assert.equal(drops[C], 100, '1 left = 1 drop');
  assert.equal(drops[E], 0, '0 left = no drops');
  assert.equal(drops[A], 500, 'the winner gets the rest');
  assert.equal(drops[D], 0);

  const custom = presetGets('custom', inputs, { [A]: 400, [B]: 200 });
  assert.equal(custom[A], 400);
  assert.equal(custom[C], 0, 'untyped players get nothing');
  const sheet = buildAwardSheet('custom', inputs, custom);
  assert.equal(givenOutText(sheet).tone, 'under');
  assert.equal(givenOutText(sheet).text, 'Pool 700 · 600 given out · 100 not given out');
  assert.equal(saveAnywayText(sheet), "100 points weren't given out. Save awards anyway?");
  assert.equal(saveAnywayText(winner), null);
  const over = buildAwardSheet('custom', inputs, { [A]: 800 });
  assert.equal(saveAnywayText(over), '100 points more than the pool were given out. Save awards anyway?');

  const payload = awardsPayload(sheet);
  assert.deepEqual(payload.awards, { [A]: 300, [B]: 100, [E]: -200, [C]: -100, [D]: -100, [F]: -100 });
  assert.deepEqual(payload.note, { preset: 'custom', presetLabel: 'Custom', entry: 100, poolTotal: 700, givenOut: 600 });
  assert.deepEqual(getsFromAwards(payload.awards, standings, 100), { [A]: 400, [B]: 200, [E]: 0, [C]: 0, [D]: 0, [F]: 0 }, 'reopening the screen rebuilds Gets');
  assert.deepEqual(AWARD_PRESETS.map((p) => p.label), ['Winner takes all', 'By points left', '50 / 50', 'Entry per drop left', 'Custom']);
});

test('13.5c F13.23 the lowest score gets the most: Entry per drop left is refused when the drop entries leave the winner level or behind', () => {
  // The P12 pool: B and C have one drop left each (100 + 100 of 700), A keeps 500 → viable.
  const inputs = { standings: poolStandings(game()), entry: 100, limit: 101, drop: 25 };
  assert.equal(presetViability('drops', inputs).viable, true);
  assert.deepEqual(viablePresets(inputs), { winner: true, left: true, split: true, drops: true, custom: true });

  // Four players in, nobody out, early in the pool: 4 + 3 + 3 drops left eat 1000 of a 400 pool → the winner gets 0.
  const early = {
    ...game(),
    players: [A, B, C, D],
    scores: { [A]: [0, 10], [B]: [20, 0], [C]: [15, 20], [D]: [30, 10] },
    poolSeats: {},
  } as unknown as Game;
  const earlyInputs = { standings: poolStandings(early), entry: 100, limit: 101, drop: 25 };
  const drops = presetGets('drops', earlyInputs);
  assert.equal(drops[A], 0, 'nothing left for the winner');
  const check = presetViability('drops', earlyInputs);
  assert.equal(check.viable, false);
  assert.equal(check.winnerGets, 0);
  assert.ok(check.rival && drops[check.rival] >= 300, 'the rival named is the one who gets the most');
  assert.deepEqual(viablePresets(earlyInputs), { winner: true, left: true, split: true, drops: false, custom: true },
    'the other presets stay: Winner takes all and By points left always put the winner first; 50 / 50 levels second place by design');

  // Level is not enough: three in, one drop left each → 100 + 100 of 300 leaves the winner 100 = the others.
  const level = {
    ...game(),
    players: [A, B, C],
    scores: { [A]: [0, 20], [B]: [90, 0], [C]: [0, 95] },
    poolSeats: {},
  } as unknown as Game;
  const levelInputs = { standings: poolStandings(level), entry: 100, limit: 101, drop: 25 };
  assert.deepEqual(presetGets('drops', levelInputs), { [A]: 100, [B]: 100, [C]: 100 });
  assert.equal(presetViability('drops', levelInputs).viable, false, 'the winner must get strictly more');

  // Outs make it viable again: two out players put in 200 that nobody still in claims.
  const withOuts = {
    ...level,
    players: [A, B, C, D, E],
    scores: { ...level.scores, [D]: [101, 0], [E]: [0, 101] },
    poolSeats: { [D]: { outRound: 1, reenteredRound: null, reentryScore: null, entries: 1 }, [E]: { outRound: 2, reenteredRound: null, reentryScore: null, entries: 1 } },
  } as unknown as Game;
  const outsInputs = { standings: poolStandings(withOuts), entry: 100, limit: 101, drop: 25 };
  assert.equal(presetGets('drops', outsInputs)[A], 300);
  assert.equal(presetViability('drops', outsInputs).viable, true);

  // 50 / 50 and ties: the second place is level by design (≥ allowed); anyone else ahead of the winner is not.
  assert.equal(presetViability('split', earlyInputs).viable, true);
  const tied = { ...early, scores: { [A]: [0, 10], [B]: [10, 0], [C]: [15, 20], [D]: [30, 10] } } as unknown as Game;
  const tiedInputs = { standings: poolStandings(tied), entry: 100, limit: 101, drop: 25 };
  assert.deepEqual(winnersOf(tiedInputs.standings), [A, B], 'co-winners');
  assert.equal(presetViability('winner', tiedInputs).viable, true, 'co-winners share and are compared as a group');
  assert.equal(presetViability('left', tiedInputs).viable, true);

  // Custom is never blocked; the screen warns from the same check.
  assert.equal(presetViability('custom', earlyInputs).viable, true);
  const bad = winnerGetsMost({ [A]: 100, [B]: 200, [C]: 0, [D]: 0 }, earlyInputs.standings);
  assert.equal(bad.ok, false);
  assert.equal(bad.rival, B);
  assert.equal(bad.rivalGets, 200);
  const negative = winnerGetsMost({ [A]: -50, [B]: 0, [C]: 0, [D]: 0 }, earlyInputs.standings);
  assert.equal(negative.ok, false, 'a negative winner share is never right');
  assert.equal(winnerGetsMost({ [A]: 400, [B]: 0, [C]: 0, [D]: 0 }, earlyInputs.standings).ok, true);

  assert.equal(NOT_VIABLE_TEXT, 'This is not ideal for this situation because the winner gets less than the others. Please pick another option.');
  const screen = src('app/(screens)/games/award.tsx');
  assert.ok(screen.includes('NOT_VIABLE_TEXT') && screen.includes('viablePresets(inputs)'), 'the Awards screen greys and refuses a non-viable preset');
  assert.ok(screen.includes('award-not-viable-ok'), 'the pop-up has a button the flow can tap');
  assert.ok(screen.includes("preset === 'custom' ? winnerGetsMost(gets, standings)"), 'Custom warns instead of blocking');
});

test('13.5b award wording never mentions money, expenses, stake or prize', () => {
  const code = (rel: string) => src(rel).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const texts = [...AWARD_PRESETS.flatMap((p) => [p.label, p.hint]), code('app/(screens)/games/award.tsx'), code('components/game/PoolAwardsCard.tsx'), code('utils/poolAwards.ts')];
  for (const t of texts) {
    assert.doesNotMatch(t, /\b(money|expense|expenses|rupee|dollar|cash|stake|prize)s?\b/i);
  }
});

// ---------- Settings, limits, two-screen New game (13.6, 13.7) ----------

test('13.6 pool limits 101 / 201 / 251 / Custom (51–999); 100 in, 101 out; defaults 25 / 50 / 130 with Re-entry on', () => {
  assert.deepEqual([...POOL_LIMITS], [101, 201, 251]);
  assert.equal(DEFAULT_POOL_LIMIT, 101);
  assert.equal(POOL_CUSTOM_MIN, 51);
  assert.equal(POOL_CUSTOM_MAX, 999);
  assert.equal(parsePoolLimit('250'), 250, 'custom still allows 250; it is simply not a chip');
  assert.equal(parsePoolLimit('50'), null);
  assert.equal(parsePoolLimit('1000'), null);
  assert.equal(parsePoolLimit(''), null);
  assert.deepEqual(DEFAULT_POOL_RULES, { gameKind: 'pool', drop: 25, middleDrop: 50, fullCount: 130, poolLimit: 101, reentryLimit: null }, 'Re-entries default Unlimited (042)');
  assert.equal(parseRuleInput('25', 'pool'), 25, 'pool values are stored positive');
  assert.equal(parseRuleInput('25', 'points'), -25);
  assert.equal(validateRules({ gameKind: 'pool', drop: 25, middleDrop: 50, fullCount: 130, poolLimit: 101, reentryLimit: null }), null);
  assert.equal(validateRules({ gameKind: 'pool', drop: 25, middleDrop: 50, fullCount: 130, poolLimit: 101, reentryLimit: 0 }), null);
  assert.match(validateRules({ gameKind: 'pool', drop: 25, middleDrop: 50, fullCount: 130, poolLimit: 101, reentryLimit: 100 })!, /0 to 99/);
  assert.match(validateRules({ gameKind: 'pool', drop: 50, middleDrop: 25, fullCount: 130, poolLimit: 101, reentryLimit: null })!, /Middle drop/);
});

test('13.6b profile defaults hold both kinds and which one a new game starts as', () => {
  const all = allRulesFromProfileDefaults({ stakeDrop: -10, stakeMiddleDrop: -30, maxCount: -80, poolLimit: 201, poolDrop: 20, poolMiddleDrop: 40, poolFullCount: 100, poolReentryLimit: 2, gameKind: 'pool' });
  assert.equal(all.startsAs, 'pool');
  assert.deepEqual(all.points, { gameKind: 'points', drop: -10, middleDrop: -30, fullCount: -80 });
  assert.deepEqual(all.pool, { gameKind: 'pool', drop: 20, middleDrop: 40, fullCount: 100, poolLimit: 201, reentryLimit: 2 });
  assert.equal(rulesFromProfileDefaults({ poolReentry: false }, 'pool').reentryLimit, 0, 'an old saved switch off reads as none');
  assert.equal(rulesFromProfileDefaults({ poolReentry: true }, 'pool').reentryLimit, null, 'an old saved switch on reads as Unlimited');
  assert.deepEqual(rulesFromProfileDefaults(null), { gameKind: 'points', drop: -10, middleDrop: -30, fullCount: -80 }, 'no defaults: Points, as before');
  assert.deepEqual(rulesFromProfileDefaults(null, 'pool'), DEFAULT_POOL_RULES);
  assert.deepEqual(rulesToProfileDefaults(DEFAULT_POOL_RULES), { poolLimit: 101, poolDrop: 25, poolMiddleDrop: 50, poolFullCount: 130, poolReentryLimit: null });
  assert.deepEqual(rulesFromGame(settings, 'pool'), { gameKind: 'pool', drop: 25, middleDrop: 50, fullCount: 130, poolLimit: 101, reentryLimit: null });
  assert.equal(rulesFromGame({ ...settings, reentryLimit: 1 }, 'pool').reentryLimit, 1);
  assert.equal(rulesFromGame({ ...settings, dropAmount: -10, mdAmount: -30, maxCount: -80 }).gameKind, 'points');
});

test('13.7 RulesForm draft: chips for the three limits, Custom for anything else, a bad custom limit is the message', () => {
  const draft = draftFromRules(DEFAULT_POOL_RULES);
  assert.equal(draft.poolLimit, '101');
  assert.equal(draft.customLimit, false);
  assert.equal(draftFromRules({ ...DEFAULT_POOL_RULES, poolLimit: 150 }).customLimit, true);
  assert.equal(draft.reentryMode, 'unlimited');
  const ok = rulesFromDraft({ ...draft, poolLimit: '201', reentryMode: 'limited', reentryCount: '2' });
  assert.equal(ok.error, null);
  assert.equal(ok.rules!.poolLimit, 201);
  assert.equal(ok.rules!.reentryLimit, 2);
  assert.equal(rulesFromDraft({ ...draft, reentryMode: 'limited', reentryCount: '0' }).rules!.reentryLimit, 0, 'Limited 0 = none');
  assert.match(rulesFromDraft({ ...draft, reentryMode: 'limited', reentryCount: '' }).error!, /0 to 99, or Unlimited/);
  assert.equal(rulesFromDraft({ ...draft, reentryMode: 'unlimited', reentryCount: '' }).rules!.reentryLimit, null, 'Unlimited ignores the count field');
  assert.deepEqual(draftFromRules({ ...DEFAULT_POOL_RULES, reentryLimit: 3 }), { ...draft, reentryMode: 'limited', reentryCount: '3' });
  const bad = rulesFromDraft({ ...draft, poolLimit: '12' });
  assert.match(bad.error!, /51 to 999/);
  const points = rulesFromDraft({ gameKind: 'points', drop: '-10', middleDrop: '-30', fullCount: '-80', poolLimit: '101', customLimit: false, reentryMode: 'unlimited', reentryCount: '1' });
  assert.deepEqual(points.rules, { gameKind: 'points', drop: -10, middleDrop: -30, fullCount: -80 });

  const form = src('components/game/RulesForm.tsx');
  assert.match(form, /POOL_LIMITS\.map\(/, 'one chip per limit');
  assert.match(form, /testID=\{`\$\{testIDPrefix\}-limit-\$\{limit\}`\}/);
  assert.match(form, /-limit-custom/);
  assert.match(form, /-reentries-unlimited/, 'Re-entries: Unlimited radio');
  assert.match(form, /-reentries-limited/, 'Re-entries: Limited radio');
  assert.match(form, /-reentries-count/, 'the Limited count field');
  assert.match(form, /draft\.reentryMode === 'limited' \? \(/, 'the count field shows only for Limited');
  assert.match(form, /const limitDisabled = disabled \|\| lockValues;\s+const numbersDisabled = disabled;/, 'Q14.23: lockValues greys only the pool limit');
  assert.match(form, /POOL_LOCK_NOTE = 'Rounds have been saved, so the pool limit is locked/);
  const settingsScreen = src('app/(screens)/settings.tsx');
  assert.match(settingsScreen, /settings-starts-points/);
  assert.match(settingsScreen, /settings-starts-pool/);
  assert.match(settingsScreen, /testIDPrefix="settings-pool"/);
  assert.match(settingsScreen, /testIDPrefix="settings-points"/);
});

test('13.7b New game is two screens: Players (Next) then Game type (Points / Pool, prefilled, players at the bottom, Back, Start)', () => {
  const screen = src('app/(screens)/games/new.tsx');
  assert.match(screen, /useState<'players' \| 'type'>\('players'\)/, 'a step, not a second route');
  assert.match(screen, /testID="new-game-next"/);
  assert.match(screen, /userSettingsService\.getAll\(/, 'both default blocks are loaded');
  assert.match(screen, /<GameTypeStep/);
  const step = src('components/game/GameTypeStep.tsx');
  assert.match(step, /testID: 'game-type-points'/);
  assert.match(step, /testID: 'game-type-pool'/);
  assert.match(step, /SETTINGS_LINK = 'You can also set these defaults in Settings\.'/);
  assert.match(step, /testIDPrefix="new-game"/);
  assert.match(step, /testID="start-game"/);
  assert.match(step, /Back/);
});

// ---------- Add round in a pool (13.8) ----------

test('13.8 pool round entry: plus points, no sign key, Rummy is 0, Save needs every player in scored and a 0', () => {
  let s = initialPoolEntryState();
  assert.equal(s.pool, true);
  assert.equal(s.draft.negative, false, 'a pool draft is plus');
  assert.equal(setNegative(s, true), s, 'the sign cannot change in a pool');
  s = tapPlayer(s, A);
  s = pressDigit(s, '2');
  s = pressDigit(s, '5');
  s = saveScore(s);
  assert.equal(s.entries[A].value, 25);
  assert.equal(s.entries[A].scoreType, 'count', 'a typed plus is a hand, not a Rummy share');
  assert.equal(s.draft.negative, false, 'the next draft is plus again');
  s = tapPlayer(s, B);
  s = applyPreset(s, 'drop', { drop: 25, middle_drop: 50, count: 130 });
  assert.equal(s.entries[B].value, 25);
  assert.equal(canSaveRound(s, [A, B, C]), false, 'C has no score and nobody is at 0');
  s = tapPlayer(s, C);
  s = applyRummy(s);
  assert.deepEqual(rummyShares(s), { [C]: 0 }, 'the Rummy winner scores 0, nothing is split');
  assert.equal(canSaveRound(s, [A, B, C]), true);
  assert.equal(canSaveRound(s, [A, B, C, D]), false, 'every player still in must be scored');
  assert.deepEqual(toRoundScores(s).map((r) => [r.playerId, r.value]), [[A, 25], [B, 25], [C, 0]]);
  // Two zeros are fine (D6).
  let t = tapPlayer(initialPoolEntryState(), A);
  t = pressDigit(t, '0');
  t = saveScore(t);
  t = tapPlayer(t, B);
  t = applyRummy(t);
  t = tapPlayer(t, C);
  t = pressDigit(t, '9');
  t = saveScore(t);
  assert.equal(canSaveRound(t, [A, B, C]), true);
  // All zeros is not a round.
  let z = tapPlayer(initialPoolEntryState(), A);
  z = applyRummy(z);
  assert.equal(canSaveRound(z, [A]), false);
  // Points behaviour is untouched.
  const p = initialRoundEntryState();
  assert.equal(p.pool, undefined);
  assert.equal(p.draft.negative, true);
});

test('13.8b edit round in a pool reopens every hand as a count; cell colours: 0 green, at or past the Full count red', () => {
  const e = entryFromRound(game(), 2);
  assert.equal(e.pool, true);
  assert.equal(e.entries[A].scoreType, 'count');
  assert.equal(e.entries[A].value, 25);
  assert.equal(e.entries[B].value, 0);
  assert.equal(entryFromRound({ players: [A], scores: { [A]: [-10] } }, 1).pool, undefined);
  assert.equal(poolScoreTone(0, 130), 'positive');
  assert.equal(poolScoreTone(25, 130), 'negative');
  assert.equal(poolScoreTone(130, 130), 'bigNegative');
  assert.equal(poolScoreTone(140, 130), 'bigNegative');
});

test('13.8c Add round screen: the pool keeps one confirm ("Are you sure?") and drops the sign keys, Balance and the Rummy-share confirm', () => {
  const screen = src('app/(screens)/score-entry.tsx');
  assert.match(screen, /\.\.\.\(pool \? \[\] : \[\{ id: 'plus'/, 'no Plus / Minus keys in a pool');
  assert.match(screen, /\{pool \? 'Are you sure\?' : 'Over the Full count'\}/);
  assert.match(screen, /if \(!pool && !rummyConfirmed\.current && rummyShareNeedsConfirm\(shares\)\)/);
  assert.match(screen, /const pendingWarning = !pool && /, 'no half / full warnings in a pool (D7)');
  assert.match(screen, /\{pool \? 'Scored' : 'Balance'\}/);
  assert.match(screen, /const summary = afterRound\(game, saved\);/, 'after a save, who is out and who may re-enter');
  assert.match(screen, /testID=\{`after-reenter-\$\{id\}`\}/);
  assert.match(screen, /HELP\.scoreEntryPool/);
  assert.match(screen, /pool,\n\s*\}\);/, 'addRound is told it is a pool round');
});

// ---------- Scorecard (13.9) ----------

test('13.9 scorecard: header shows number / initials / score, OUT struck through, re-entered blue; Standings below; settings lock after a round', () => {
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /number\?: number \| null/);
  assert.match(table, /reentered \? colors\.reentry/);
  assert.match(table, /OUT R/);
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /number: player\.playerNo \?\? null/, 'the public player number, no new column');
  assert.match(scorecard, /<PoolStandings rows=\{poolRows\}/);
  assert.match(scorecard, /onReenter=\{game\.isComplete \? undefined : reenter\}/);
  assert.match(scorecard, /lockValues=\{pool && maxRounds > 0\}/);
  assert.match(scorecard, /\(pool \? a\.total - b\.total : b\.total - a\.total\)/, 'the leader of a pool is the lowest score still in');
  assert.match(scorecard, /<PoolAwardsCard/);
  const theme = src('constants/theme.ts');
  assert.match(theme, /reentry: '#2B5FBF'/);
  assert.match(theme, /reentryContainer:/);
});

test('13.9b colours: every game (Points and Pool) is yellow, results green', () => {
  const theme = src('constants/theme.ts');
  assert.match(theme, /stake: \{ container: '#FFE38A', on: '#3F2D00', accent: '#8A5A00' \},\n\s+pool: \{ container: '#FFE38A', on: '#3F2D00', accent: '#8A5A00' \}/, 'the same yellow for both (light)');
  assert.match(theme, /stake: \{ container: '#5C4300', on: '#FFE8AE', accent: '#FFD45E' \},\n\s+pool: \{ container: '#5C4300', on: '#FFE8AE', accent: '#FFD45E' \}/, 'the same yellow for both (dark)');
  assert.match(src('utils/resultsDetails.ts'), /--green: #15803D/i, 'results keep their green');
});

// ---------- Complete → Award → Result (13.10) ----------

test('13.10 complete / award / result: a completed pool needs awards before it can be picked; awards are what it contributes', () => {
  const done = { ...game(), isComplete: true } as Game;
  assert.equal(poolStatusLabel(done), 'Awards pending');
  assert.equal(poolNeedsAwards(done), true);
  const awarded = { ...done, awardedAt: '2026-11-14T12:00:00Z', prizeShares: { [A]: 600, [B]: -100, [C]: -100, [D]: -100, [E]: -200, [F]: -100 } } as Game;
  assert.equal(poolStatusLabel(awarded), 'Awarded');
  assert.equal(poolNeedsAwards(awarded), false);
  assert.equal(poolStatusLabel({ ...game(), gameType: 'stake' } as Game), null);
  assert.deepEqual(resultScoresOf(awarded)[A], [600], 'an awarded pool contributes its awards as one line each');
  assert.deepEqual(resultScoresOf(done)[A], [], 'an unawarded pool contributes nothing');
  assert.deepEqual(resultScoresOf({ ...game(), gameType: 'stake' } as Game)[A], game().scores[A], 'a Points game keeps its rounds');
  assert.deepEqual(defaultResultSelection([done, awarded], ['completed']), [awarded.id], 'the picker never ticks an unawarded pool');
  assert.match(saveBlockedReason([{ ...done, gameNumber: 7, createdBy: 'u' } as Game], 'u')!, /^Give awards first/);
  assert.equal(saveBlockedReason([{ ...awarded, createdBy: 'u' } as Game], 'u'), null);
  const lines = resultWarningLines([{ ...awarded, createdBy: 'u' } as Game]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, 'pool');
  assert.match(lines[0].text, /its awards count here, not the pool scores/);
  assert.equal(GIVE_AWARDS_FIRST, 'Give awards first');
  assert.equal(poolCompletionCheck(0, 6, 0).problem, null);
  assert.match(poolCompletionCheck(6, 4, 2).line, /4 players in, 2 out\. The pool usually ends when one player is left\./);
  assert.equal(poolCompletionCheck(8, 1, 5).ok, true);

  const picker = src('app/(screens)/results/index.tsx');
  assert.match(picker, /locked=\{!canPickForResults\(game, userId\) \|\| poolNeedsAwards\(game\)\}/);
  assert.match(picker, /lockedNote=\{canPickForResults\(game, userId\) && poolNeedsAwards\(game\) \? GIVE_AWARDS_FIRST : undefined\}/);
  const complete = src('app/(screens)/games/complete.tsx');
  assert.match(complete, /testID="complete-give-awards"/);
  assert.match(complete, /\{game\.awardedAt \? 'Add to Results' : GIVE_AWARDS_FIRST\}/);
  const award = src('app/(screens)/games/award.tsx');
  assert.match(award, /testID="award-save-anyway"/);
  assert.match(award, /gamesService\.setPoolAwards\(/);
  assert.match(src('app/(screens)/_layout.tsx'), /name="games\/award"/);
  assert.match(src('services/games.ts'), /rpc\('set_pool_awards'/);
  assert.match(src('services/games.ts'), /rpc\('reenter_player'/);
});

// ---------- Wording, log, help (13.11, 13.12) ----------

test('13.11 no "stake" or "prize" in any UI string; only awards, results, winners', () => {
  assert.equal(pointsGameLabel(), 'Points');
  const roots = ['app', 'components', 'constants', 'utils', 'hooks', 'services'];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|js)$/.test(name) && !/\.test\./.test(name)) files.push(full);
    }
  };
  roots.forEach((r) => walk(path.join(process.cwd(), r)));
  // JSX text or a quoted string with the word in it, as a word; identifiers and comments are not UI.
  const uiString = /(['"`>])[^'"`<>{}\n]*\b(stake|stakes|prize|prizes)\b[^'"`<>{}\n]*(['"`<])/i;
  const offenders: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      const m = line.match(uiString);
      if (!m) return;
      // Exact identifiers used as values ('stake' game type, 'prize' entry type, column names, demo ids) are not shown to anyone.
      if (/^(['"])(stake|prize)\1$/.test(m[0])) return;
      if (/^(['"])demo-game-stake-\d+\1$/.test(m[0])) return;
      offenders.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${trimmed}`);
    });
  }
  assert.deepEqual(offenders, [], 'UI strings with stake / prize');
  for (const text of Object.values(HELP)) assert.doesNotMatch(text, /\b(stake|prize)s?\b/i);
});

test('13.12 log labels for the pool kinds; help explains Complete → Award → Result and the pool screens', () => {
  assert.equal(kindLabel('player_out'), 'Out');
  assert.equal(kindLabel('player_reentered'), 'Re-entered');
  assert.equal(kindLabel('reentry_undone'), 'Re-entry undone');
  assert.equal(kindLabel('awards_set'), 'Awards given');
  assert.equal(kindLabel('awards_changed'), 'Awards changed');
  assert.equal(dotTone({ kind: 'player_out', level: 'important' }), 'red');
  assert.equal(dotTone({ kind: 'player_reentered', level: 'important' }), 'blue');
  assert.equal(dotTone({ kind: 'awards_changed', level: 'important' }), 'amber');
  assert.equal(dotTone({ kind: 'awards_set', level: 'important' }), 'green');
  assert.match(HELP.gameType, /Pool: the winner scores 0/);
  assert.match(HELP.gameType, /Re-entries: .*Unlimited, or Limited/);
  assert.match(HELP.scoreEntryPool, /0/);
  assert.match(HELP.awards, /award/i);
  assert.match(HELP.complete, /award/i);
  assert.match(HELP.results, /Give awards first/);
});
