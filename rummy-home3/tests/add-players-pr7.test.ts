import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { registrationLabel as myPlayersRegistration, REGISTRATION_TONE, visibleRegistration } from '../utils/myPlayersList';
import { registrationLabel as seatRegistration } from '../utils/gamePlayers';
import {
  ADD_NEW_PLAYERS,
  ADD_PLAYERS_TITLE,
  addedNowLine,
  FROM_DATABASE_ACCESSIBILITY,
  NON_PLAYING_ADMIN_BUTTON,
  NON_PLAYING_ADMIN_NOTE,
  returnButtonLabel,
  SEARCH_PLACEHOLDER,
  totalLabel,
} from '../utils/addPlayers';

const read = (relative: string) => readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('7.1 Total counts seated players only; Added now reads 0 and 3; the button never counts', () => {
  assert.deepEqual(totalLabel(8), { number: '8', caption: 'TOTAL', spoken: 'Total, 8 players' });
  assert.deepEqual(totalLabel(1), { number: '1', caption: 'TOTAL', spoken: 'Total, 1 player' });
  assert.equal(addedNowLine(0), 'Added now: 0 · tap a player below to add them');
  assert.equal(addedNowLine(3), 'Added now: 3 (yellow ring)');
  assert.equal(returnButtonLabel(), 'Return to game');
  const picker = read('app/(screens)/games/new.tsx');
  assert.match(picker, /<TotalCircle total=\{seatedCount\} added=\{newCount\} \/>/, 'Total = saved seated + staged (spectators and non-playing admins are filtered out of `saved`)');
  assert.match(picker, /seat\.seatRole !== 'spectator' && seat\.seated !== false/, 'only seated players reach the strip and the Total');
  assert.doesNotMatch(picker, /Return to game · add/, 'the "· add 4" suffix is gone');
  assert.match(picker, /\{addMode \? returnButton : null\}\s*\{addMode \? tiles : null\}/, 'Return to game and the two tiles sit right under the strip in add mode');
  assert.match(picker, /title: addMode \? ADD_PLAYERS_TITLE : 'New game'/);
  assert.equal(ADD_PLAYERS_TITLE, 'Add players to this game');
});

test('7.2 labels: Add new players, From database spoken as the long sentence, yellow search box with #ID', () => {
  assert.equal(ADD_NEW_PLAYERS, 'Add new players');
  assert.equal(FROM_DATABASE_ACCESSIBILITY, 'Add players to this game from the EZ Score database');
  assert.equal(SEARCH_PLACEHOLDER, 'Search name, initials or #ID');
  const picker = read('app/(screens)/games/new.tsx');
  assert.match(picker, /accessibilityLabel=\{ADD_NEW_PLAYERS\}>\s*\{ADD_NEW_PLAYERS\}/);
  assert.match(picker, /accessibilityLabel=\{FROM_DATABASE_ACCESSIBILITY\}>\s*From database/);
  assert.match(picker, /placeholder=\{SEARCH_PLACEHOLDER\}[^\n]*backgroundColor: colors\.leaderContainer/, 'pale yellow search box');
  assert.doesNotMatch(picker, /accessibilityLabel="Add players"/);
  const find = read('app/(screens)/players/new.tsx');
  assert.match(find, /backgroundColor: colors\.leaderContainer/, 'the Find player search box is yellow too');
  assert.doesNotMatch(find, /Registered players only\./, 'the registered-only note lives in help');
  const theme = read('constants/theme.ts');
  assert.equal((theme.match(/leaderContainer: '#/g) ?? []).length, 2, 'light and dark palettes both define leaderContainer');
});

test('7.3 Players · Admins: a big outlined "Add non-playing admin" button with one explanatory line', () => {
  assert.equal(NON_PLAYING_ADMIN_BUTTON, 'Add non-playing admin');
  assert.equal(NON_PLAYING_ADMIN_NOTE, 'Someone who keeps score but does not play. Enter their Player ID (#NN). They can add and edit rounds; they get no column.');
  const players = read('app/(screens)/games/players.tsx');
  assert.match(players, /accessibilityLabel="Add admin by Player ID"[\s\S]*?\{NON_PLAYING_ADMIN_BUTTON\}/, 'the flows keep tapping "Add admin by Player ID"');
  assert.match(players, /\{addAdminBlocked \?\? NON_PLAYING_ADMIN_NOTE\}/);
  assert.match(players, /adminAddButton: \{ borderWidth: 2, borderRadius: radius\.full \}/);
  assert.match(players, /<Dialog\.Title>\{NON_PLAYING_ADMIN_BUTTON\}<\/Dialog\.Title>/);
});

test('7.4 D7.2: no "You" tag on New game, Players · Admins or My players (you stay first)', () => {
  for (const file of ['components/players/PlayerPickerRow.tsx', 'app/(screens)/games/players.tsx', 'app/(tabs)/players.tsx']) {
    assert.doesNotMatch(read(file), /label="You"/, `${file} draws no You tag`);
  }
  const picker = read('app/(screens)/games/new.tsx');
  assert.match(picker, /pinOrganiser\(grid, meWatching \? null : meCandidate, selectedIds, meMatches\)/, 'the organiser is still pinned first');
  assert.match(read('components/players/PlayerPickerRow.tsx'), /`Add \$\{candidate\.name\} \(you\)`/, 'the spoken label still tells you from a namesake');
  assert.match(read('utils/myPlayersList.ts'), /ownerId && player\.id === ownerId \? 'You'/, 'the My players section header for the pinned owner is a list section, not a tag');
});

// One table: every registration status, what the helper says and therefore what the seven sites draw.
const TABLE: { status: string | undefined; linkPending?: boolean; visible: string | null }[] = [
  { status: 'registered', visible: null },
  { status: undefined, visible: null },
  { status: 'merged', visible: null },
  { status: 'unregistered', visible: 'Unregistered' },
  { status: 'pending', visible: 'Pending registration' },
  { status: 'pending', linkPending: true, visible: 'Link pending' },
];

test('7.5 one rule for the Registered tag: hidden for Registered, drawn for Unregistered / Pending / Link pending (both label helpers)', () => {
  for (const row of TABLE) {
    assert.equal(visibleRegistration(myPlayersRegistration(row.status, row.linkPending)), row.visible, `my players: ${row.status}`);
    assert.equal(visibleRegistration(seatRegistration({ status: row.status as never }, row.linkPending)), row.visible, `seat: ${row.status}`);
    if (row.visible) assert.ok(REGISTRATION_TONE[row.visible as keyof typeof REGISTRATION_TONE], 'a visible label has a tone');
  }
});

test('7.6 the three tag sites go through visibleRegistration and the four text sites no longer print "Registered"', () => {
  const tagSites = ['components/players/PlayerPickerRow.tsx', 'app/(screens)/games/players.tsx', 'app/(tabs)/players.tsx'];
  for (const file of tagSites) {
    const source = read(file);
    assert.match(source, /visibleRegistration\(/, `${file} uses the one rule`);
    assert.doesNotMatch(source, /<Tag[^>]*label=\{status\}[^>]*\/>\s*$/m, `${file} never draws the status unconditionally`);
  }
  const textSites: [string, RegExp][] = [
    ['app/(screens)/games/players.tsx', /· Registered/],
    ['components/players/LinkPlayerDialog.tsx', /Registered</],
    ['app/(screens)/players/new.tsx', /Registered players only/],
    ['constants/help.ts', /whether they are Registered/],
  ];
  for (const [file, pattern] of textSites) assert.doesNotMatch(read(file), pattern, `${file} prints no Registered text`);
  const help = read('constants/help.ts');
  assert.match(help, /Only players who have not finished signing up carry a tag \(Unregistered, Pending registration\)/);
});
