import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  changedNoteLine,
  CHANGED_AFTER_SHARING,
  defaultLogFilter,
  dotTone,
  editChanges,
  formatLogDay,
  groupByDay,
  historyRows,
  kindLabel,
  LogEntry,
  parseLogEntry,
  scoreText,
  summarySpans,
} from '../utils/eventLog';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const migration = src('supabase/migrations/036_event_log.sql');
const rollback = src('supabase/rollback/rollback_036_event_log.sql');

const entry = (over: Partial<LogEntry>): LogEntry => ({
  id: 1, at: '2026-11-13T22:31:00.000Z', kind: 'round_added', level: 'important', actorId: 'u1', actorName: 'Sree Test',
  summary: 'Round 3 added · Dealer RK · Zed Zero +30', details: {}, gameId: 'g1', resultId: null, ...over,
});

test('036 (a): event_log is append-only, written only by server code, readable by game members', () => {
  assert.match(migration, /create table if not exists public\.event_log/);
  assert.match(migration, /constraint event_log_kind check \(kind in \(/);
  assert.match(migration, /create or replace function public\.event_log_refuse\(\)/, 'update/delete refused');
  assert.match(migration, /revoke all on function public\.log_event\(/);
  assert.match(migration, /create policy event_log_read on public\.event_log/);
  assert.match(migration, /revoke insert, delete on public\.rounds from authenticated;/, 'D4: scores only via save_round');
  assert.match(migration, /revoke insert, delete on public\.scores from authenticated;/);
  assert.doesNotMatch(migration, /revoke update on public\.rounds/, 'UPDATE stays so a shipped APK can still undo');
  assert.match(migration, /alter publication supabase_realtime add table public\.event_log/, 'D8: live rows');
});

test('036 (b): every writer logs inside its own transaction: create_game, add_seated_player, save_round, triggers', () => {
  for (const name of ['create_game', 'add_seated_player', 'save_round', 'list_game_log', 'list_result_history', 'public_result_note', 'public_scorecard_changes']) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}\\(`), name);
  }
  for (const trigger of ['event_log_games', 'event_log_game_players', 'event_log_rounds', 'event_log_profiles', 'event_log_game_results', 'event_log_result_games', 'event_log_mirror']) {
    assert.match(migration, new RegExp(`create trigger ${trigger}\\b`), trigger);
  }
  assert.match(migration, /set_config\('ezscore\.in_create_game', '1', true\)/, 'create_game writes one row, not one per seat');
  assert.match(migration, /'round_added'/);
  assert.match(migration, /'round_edited'/);
  assert.match(migration, /'result_changed'/);
});

test('036 (c): readers page newest first and the result history carries versions and the note', () => {
  assert.match(migration, /p_before bigint default null, p_limit integer default 50/);
  assert.match(migration, /jsonb_build_object\('rows', v_rows, 'hasMore', v_more\)/);
  assert.match(migration, /'versions', \(select coalesce\(jsonb_agg\(jsonb_build_object\('version', v\.version, 'note', v\.note, 'savedAt', v\.saved_at\)/);
  assert.match(migration, /'changedNote', public\.result_changed_note\(p_result_id\)/);
  assert.match(migration, /e\.kind like 'result_%'/, 'History shows result_* rows only');
});

test('036 (d): rollback drops the log and restores direct writes and the 035 save_round', () => {
  assert.match(rollback, /drop table if exists public\.event_log/);
  assert.match(rollback, /grant insert, delete on public\.rounds to authenticated;/);
  assert.match(rollback, /grant insert, delete on public\.scores to authenticated;/);
  assert.match(rollback, /create or replace function public\.save_round\(/);
});

test('log line: names from details.names come out bold, everything else plain', () => {
  const spans = summarySpans('Round 3 edited · Harish Test -10→-40, Zed Zero +30→+60 · 2 others unchanged', ['Harish Test', 'Zed Zero']);
  assert.deepEqual(spans.filter((s) => s.bold).map((s) => s.text), ['Harish Test', 'Zed Zero']);
  assert.equal(spans.map((s) => s.text).join(''), 'Round 3 edited · Harish Test -10→-40, Zed Zero +30→+60 · 2 others unchanged');
  assert.deepEqual(summarySpans('Closed — saved in result R1', undefined), [{ text: 'Closed — saved in result R1', bold: false }]);
  assert.deepEqual(summarySpans('R.K. (R K) +10', ['R.K. (R K)']).filter((s) => s.bold).length, 1, 'regex characters in names are escaped');
});

test('log line: an edited round expands to was→now rows; other kinds have none', () => {
  const edited = entry({
    kind: 'round_edited',
    details: { changes: [{ name: 'Harish Test', ini: 'HT', old: -10, new: -40 }, { name: 'Zed Zero', ini: 'ZZ', old: 30, new: 60 }] },
  });
  assert.deepEqual(editChanges(edited), [
    { name: 'Harish Test', ini: 'HT', old: -10, next: -40 },
    { name: 'Zed Zero', ini: 'ZZ', old: 30, next: 60 },
  ]);
  assert.deepEqual(editChanges(entry({ kind: 'round_added', details: { changes: [] } })), []);
  assert.equal(scoreText(60), '+60');
  assert.equal(scoreText(-40), '-40');
  assert.equal(scoreText(0), '0');
  assert.equal(scoreText(null), '—');
});

test('log line: day grouping keeps arrival order and names Today / Yesterday', () => {
  const now = new Date('2026-11-13T23:00:00');
  const rows = [
    entry({ id: 5, at: '2026-11-13T22:31:00' }),
    entry({ id: 4, at: '2026-11-13T20:00:00' }),
    entry({ id: 3, at: '2026-11-12T23:30:00' }),
    entry({ id: 2, at: '2026-11-01T10:00:00' }),
  ];
  const groups = groupByDay(rows, now);
  assert.deepEqual(groups.map((g) => [g.day, g.entries.length]), [['Today', 2], ['Yesterday', 1], ['Sun, Nov 1', 1]]);
  assert.equal(formatLogDay('not a date', now), '');
});

test('log line: dot colours follow the key (taken away red, edited amber, people blue, routine grey)', () => {
  assert.equal(dotTone(entry({ kind: 'round_undone' })), 'red');
  assert.equal(dotTone(entry({ kind: 'result_deleted' })), 'red');
  assert.equal(dotTone(entry({ kind: 'round_edited' })), 'amber');
  assert.equal(dotTone(entry({ kind: 'settings_changed' })), 'amber');
  assert.equal(dotTone(entry({ kind: 'player_added' })), 'blue');
  assert.equal(dotTone(entry({ kind: 'round_added' })), 'green');
  assert.equal(dotTone(entry({ kind: 'completed' })), 'green');
  assert.equal(dotTone(entry({ kind: 'initials_changed', level: 'routine' })), 'grey');
  assert.equal(kindLabel('result_changed'), 'Changed');
  assert.equal(kindLabel('something_new'), 'something new');
});

test('filter default: All while active, Important once completed or closed', () => {
  assert.equal(defaultLogFilter({ isComplete: false, closedAt: null }), 'all');
  assert.equal(defaultLogFilter({ isComplete: true, closedAt: null }), 'important');
  assert.equal(defaultLogFilter({ isComplete: false, closedAt: '2026-11-13T00:00:00Z' }), 'important');
  assert.equal(defaultLogFilter(null), 'all');
});

test('changed note: one line, same words on the page, the picture, the PDF and the web page', () => {
  assert.equal(changedNoteLine(null), null);
  assert.equal(changedNoteLine({ summary: '', actorName: 'Sree Test', at: '2026-11-13T22:31:00' }), null);
  const line = changedNoteLine({ summary: 'Round 3 of S1 edited · Totals changed', actorName: 'Sree Test', at: '2026-11-13T22:31:00', count: 1 });
  assert.ok(line?.startsWith(`${CHANGED_AFTER_SHARING}: Round 3 of S1 edited · Totals changed · Sree Test · Nov 13, `), line ?? undefined);
  assert.doesNotMatch(line ?? '', /earlier/);
  const many = changedNoteLine({ summary: 'Round 4 of S1 undone · Totals changed', actorName: 'Sree Test', at: '2026-11-13T22:31:00', count: 3 });
  assert.match(many ?? '', /\(\+2 earlier\)$/);
});

test('history keeps result_* rows only; parse tolerates missing fields', () => {
  const rows = [entry({ kind: 'result_saved', resultId: 'r1' }), entry({ kind: 'closed' }), entry({ kind: 'result_changed', resultId: 'r1' })];
  assert.deepEqual(historyRows(rows).map((r) => r.kind), ['result_saved', 'result_changed']);
  const parsed = parseLogEntry({ id: '7', at: '2026-11-13T22:31:00Z', kind: 'completed', level: 'nonsense', summary: 'Completed the game after round 2' });
  assert.equal(parsed.id, 7);
  assert.equal(parsed.level, 'important');
  assert.equal(parsed.actorName, 'System');
  assert.deepEqual(parsed.details, {});
});
