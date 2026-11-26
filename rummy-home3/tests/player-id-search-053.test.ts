import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { listInitials, noOneHasLine, parsePlayerIdQuery, playerIdResultLine, shortPlayerName } from '../utils/playerSearch';
import { inviteMessage, INVITE_URL } from '../utils/inviteLink';
import { SEAT_MENU_LABEL } from '../utils/gamePlayers';
import {
  ADD_TO_GAME,
  HOW_TO_ADD_LINES,
  PLAYER_ID_CHECK,
  PLAYER_ID_HINT,
  PLAYER_ID_PLACEHOLDER,
  PLAYER_ID_SEARCH,
} from '../utils/addPlayers';

const read = (relative: string) => readFileSync(path.join(__dirname, '..', relative), 'utf8');

// D113 (Sree, Nov 25): "just a number and name is good … 'No one has number 58' is also good … It should
// be a server change. Name should not be searchable. Within my players, it's okay to search."

test('D113: a Player ID is 57, #57 or " 57 "; letters, names, emails and 0 are not', () => {
  assert.equal(parsePlayerIdQuery('57'), 57);
  assert.equal(parsePlayerIdQuery('#57'), 57);
  assert.equal(parsePlayerIdQuery(' 57 '), 57);
  assert.equal(parsePlayerIdQuery(' # 57'), 57);
  assert.equal(parsePlayerIdQuery('57a'), null);
  assert.equal(parsePlayerIdQuery('a57'), null);
  assert.equal(parsePlayerIdQuery('Ravi'), null);
  assert.equal(parsePlayerIdQuery('RK'), null);
  assert.equal(parsePlayerIdQuery('ravi@example.com'), null);
  assert.equal(parsePlayerIdQuery('5 7'), null);
  assert.equal(parsePlayerIdQuery('0'), null);
  assert.equal(parsePlayerIdQuery(''), null);
  assert.equal(parsePlayerIdQuery('#'), null);
});

test('D113: the name is first name + last initial; one word stays; the same rule as 053 short_player_name', () => {
  assert.equal(shortPlayerName('Ravi Kumar'), 'Ravi K.');
  assert.equal(shortPlayerName('  ravi   kumar reddy '), 'ravi R.');
  assert.equal(shortPlayerName('Ravi'), 'Ravi');
  assert.equal(shortPlayerName('Ravi K.'), 'Ravi K.', 'shortening twice changes nothing (old servers send the full name)');
  assert.equal(shortPlayerName(''), 'Rummy Player');
  assert.equal(shortPlayerName(null), 'Rummy Player');
  assert.equal(listInitials('Ravi K.'), 'RK', 'the card avatar');
  const sql = read('supabase/migrations/053_player_id_search_only.sql');
  assert.match(sql, /w\[1\] \|\| ' ' \|\| upper\(left\(w\[cardinality\(w\)\], 1\)\) \|\| '\.'/, 'the server rule is the same');
  assert.match(sql, /if q !~ '\^#\?\[0-9\]\{1,12\}\$' then return; end if;/, 'anything but an exact number returns nothing');
  assert.doesNotMatch(sql.split('-- ---------- B.')[1], /ilike|p\.email/, 'no name or email match left');
});

test('D113: one result line "#57 · Ravi K.", or "No one has #58."', () => {
  assert.equal(playerIdResultLine(57, 'Ravi Kumar'), '#57 · Ravi K.');
  assert.equal(playerIdResultLine(57, 'Ravi K.'), '#57 · Ravi K.');
  assert.equal(noOneHasLine(58), 'No one has #58.');
  assert.equal(PLAYER_ID_PLACEHOLDER, 'Player ID, e.g. 57');
  assert.equal(PLAYER_ID_HINT, 'Ask them for their Player ID. It is on their Profile.');
  assert.equal(PLAYER_ID_SEARCH, 'Search');
  assert.equal(ADD_TO_GAME, 'Add to game');
  assert.match(PLAYER_ID_CHECK, /check the number with them/);
});

test('D113: Find in database is a number keypad and a Search button; nothing is looked up while typing', () => {
  const box = read('components/players/PlayerIdSearch.tsx');
  assert.match(box, /keyboardType="number-pad"/);
  assert.match(box, /returnKeyType="search"/);
  assert.match(box, /onSubmitEditing=\{onSearch\}/, 'the keypad action key searches');
  assert.match(box, /onPress=\{onSearch\}/, 'the Search button searches');
  const screen = read('app/(screens)/players/new.tsx');
  assert.doesNotMatch(screen, /setTimeout/, 'no search-as-you-type');
  assert.match(screen, /const changeQuery = useCallback\(\(text: string\) => \{\s*setQuery\(text\);\s*setResult\(null\);\s*setSearchedNo\(null\);/, 'typing clears the result');
  assert.match(screen, /noOneHasLine\(searchedNo\)/);
  assert.match(screen, /\{fromNewGame \? ADD_TO_GAME : ADD_TO_MY_PLAYERS\}/);
  const service = read('services/players.ts');
  assert.match(service, /const playerNo = parsePlayerIdQuery\(query\);\s*if \(playerNo === null\) return \[\];/, 'the service never sends a name');
  assert.doesNotMatch(service, /display_name\.ilike/, 'the old direct name query is gone');
  assert.match(service, /return player\.playerNo === playerNo \|\| player\.playerCode === `#\$\{playerNo\}`;/, 'offline: Player ID only');
});

test('D113: My players search stays (search_my_players and the local filter)', () => {
  const service = read('services/players.ts');
  assert.match(service, /supabase\.rpc\('search_my_players'/);
  assert.match(read('app/(tabs)/players.tsx'), /<SearchField value=\{query\} onChangeText=\{setQuery\}[^\n]*testID="my-players-search"/);
  assert.match(read('app/(screens)/games/new.tsx'), /<SearchField value=\{query\} onChangeText=\{setQuery\}[^\n]*testID="picker-search"/);
});

test('D106: Invite to EZ Score is a plain get-the-app message; the sign-up link dialog is gone', () => {
  assert.equal(
    inviteMessage(),
    `I keep our rummy scores in EZ Score. Get it here: ${INVITE_URL} then send me your Player ID (it is on your Profile).`,
  );
  assert.equal(SEAT_MENU_LABEL.invite, 'Invite to EZ Score');
  for (const file of ['app/(tabs)/players.tsx', 'app/(screens)/games/players.tsx']) {
    const text = read(file);
    assert.doesNotMatch(text, /InviteToRegisterDialog|shareClaimLink/, `${file}: no sign-up link`);
    assert.match(text, /item === 'invite'\) shareInvite\(\)/, `${file}: Invite shares the plain message`);
  }
});

test('D108: the dismissible how-to-add card at the top of My players', () => {
  assert.deepEqual([...HOW_TO_ADD_LINES], [
    'Has the app? Ask for their Player ID and search it.',
    'No app? Add their initials; link them later with their Player ID.',
  ]);
  assert.match(read('app/(tabs)/players.tsx'), /<Screen>\s*<HowToAddCard \/>/);
  assert.match(read('components/players/HowToAddCard.tsx'), /AsyncStorage\.setItem\(HOW_TO_ADD_DISMISSED_KEY, '1'\)/);
});
