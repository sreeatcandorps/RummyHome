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
  NON_PLAYING_ADMIN_ROW,
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

test('7.2 labels: Add by initials / Find in database (A21), the long spoken sentence, the one SearchField with #ID (A07)', () => {
  assert.equal(ADD_NEW_PLAYERS, 'Add by initials');
  assert.equal(FROM_DATABASE_ACCESSIBILITY, 'Find in database: add players to this game from the EZ Score database');
  assert.equal(SEARCH_PLACEHOLDER, 'Search name, initials or #ID');
  const picker = read('app/(screens)/games/new.tsx');
  assert.match(picker, /accessibilityLabel=\{ADD_NEW_PLAYERS\}>\s*\{ADD_NEW_PLAYERS\}/);
  assert.match(picker, /accessibilityLabel=\{FROM_DATABASE_ACCESSIBILITY\}>\s*\{FIND_IN_DATABASE\}/);
  assert.match(picker, /<SearchField value=\{query\} onChangeText=\{setQuery\}[^\n]*testID="picker-search"/, 'the one SearchField (A07)');
  assert.doesNotMatch(picker, /accessibilityLabel="Add players"/);
  const find = read('app/(screens)/players/new.tsx');
  assert.match(find, /<PlayerIdBox[\s\S]*?onSearch=\{search\}/, 'Find in database is the Player ID box (D113), not a name search');
  assert.doesNotMatch(find, /leaderContainer/, 'no pale-yellow search box any more (A07)');
  assert.doesNotMatch(find, /Registered players only\./, 'the registered-only note lives in help');
  const theme = read('constants/theme.ts');
  assert.equal((theme.match(/leaderContainer: '#/g) ?? []).length, 2, 'light and dark palettes both define leaderContainer');
});

test('7.3 Players · Admins: "Add non-playing admin" is a row of its group; the full note behind the ⓘ (§10.5)', () => {
  assert.equal(NON_PLAYING_ADMIN_BUTTON, 'Add non-playing admin');
  assert.equal(NON_PLAYING_ADMIN_NOTE, 'Someone who keeps score but does not play. Enter their Player ID (#NN). They can add and edit rounds; they get no column.');
  assert.equal(NON_PLAYING_ADMIN_ROW, 'Keeps score, does not play. By Player ID.');
  const players = read('app/(screens)/games/players.tsx');
  assert.match(players, /title=\{NON_PLAYING_ADMIN_BUTTON\}\s*description=\{NON_PLAYING_ADMIN_ROW\}[\s\S]*?accessibilityLabel="Add admin by Player ID"\s*testID="add-admin"/, 'the flows keep tapping "Add admin by Player ID"');
  assert.match(players, /tip=\{canScore \? \{ text: NON_PLAYING_ADMIN_NOTE, topic: 'players-admins', testID: 'players-admins-tip' \}/, 'the note word for word behind the ⓘ');
  assert.match(players, /note=\{canScore && addAdminBlocked \? addAdminBlocked : undefined\}/, 'a Closed game says why under the heading');
  assert.match(players, /\{canScore && !addAdminBlocked \? \(\s*<ListRow/, 'the row that cannot work is not shown');
  assert.doesNotMatch(players, /adminAddButton|<Button[^>]*mode="outlined"/, 'no second pill-shaped button');
  assert.match(players, /<Dialog\.Title>\{NON_PLAYING_ADMIN_BUTTON\}<\/Dialog\.Title>/);
});

test('7.4 D7.2: no "You" tag on New game or Players · Admins (you stay first); PR 10b puts one "You" tag on your own My players row', () => {
  for (const file of ['components/players/PlayerPickerRow.tsx', 'app/(screens)/games/players.tsx']) {
    assert.doesNotMatch(read(file), /label="You"/, `${file} draws no You tag`);
  }
  assert.match(read('app/(tabs)/players.tsx'), /isMe \? <Tag label="You" tone="neutral" \/> : null/, 'My players marks your own row (Q10.6)');
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
    ['constants/helpTopics.ts', /whether they are Registered/],
  ];
  for (const [file, pattern] of textSites) assert.doesNotMatch(read(file), pattern, `${file} prints no Registered text`);
  const help = read('constants/helpTopics.ts');
  assert.match(help, /Only players who have not finished signing up get a word there too \(Unregistered, Pending registration, Link pending\)/);
});
