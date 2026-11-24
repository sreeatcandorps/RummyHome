import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  HELP_GROUP_ORDER,
  HELP_INDEX_TITLE,
  HELP_TOPIC_KEYS,
  HELP_TOPICS,
  HELP_WHY,
  type HelpTopicKey,
  helpIndex,
  helpTopicText,
  ROUTE_TOPIC,
  searchHelp,
} from '../constants/helpTopics';
import { HELP_CHIPS, plainHelpText, splitHelpLine } from '../utils/helpMarkup';
import { PLAYERS_NOTE, SETTINGS_PRIORITY } from '../constants/help';
import { SEAT_MENU_LABEL } from '../utils/gamePlayers';
import { PLAYERS_ADMINS_TITLE } from '../utils/gameAdmins';
import { SEATING_MENU_ITEM } from '../utils/seating';
import { DEALER_MENU_ITEM } from '../utils/dealerSheet';
import { GIVE_AWARDS_FIRST } from '../utils/pool';

const root = path.resolve(__dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Every route file under app/ that is a screen (not a layout), as the key ROUTE_TOPIC uses. */
function routeKeys(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry.name) && !/^_layout|^\+/.test(entry.name)) out.push(path.relative(path.join(root, 'app'), full).replace(/\.tsx$/, ''));
    }
  };
  walk(path.join(root, 'app'));
  return out;
}

test('HL11-1 every route has a help topic; every topic has a purpose, 3–5 Need to know lines, a Tricky case and Also see', () => {
  const routes = routeKeys().filter((r) => !r.startsWith('(screens)/help/') && r !== 'index' && !r.startsWith('(screens)/settle') && !r.startsWith('(screens)/sessions/'));
  for (const route of routes) {
    const topic = ROUTE_TOPIC[route] ?? ROUTE_TOPIC[route.replace(/\/index$/, '')];
    assert.ok(topic, `${route} has no help topic`);
    assert.ok(HELP_TOPICS[topic], `${route} points at the unknown topic ${topic}`);
  }
  for (const key of HELP_TOPIC_KEYS) {
    const t = HELP_TOPICS[key];
    assert.equal(t.key, key);
    assert.ok(t.title.length > 0 && t.purpose.length > 10, `${key}: hero`);
    assert.ok(t.needToKnow.length >= 3 && t.needToKnow.length <= 5, `${key}: ${t.needToKnow.length} Need to know lines`);
    assert.ok(t.tricky.length >= 1, `${key}: a Tricky case`);
    assert.ok(t.alsoSee.length >= 1, `${key}: Also see`);
    for (const other of t.alsoSee) assert.ok(HELP_TOPICS[other] && other !== key, `${key} also-sees ${other}`);
    for (const x of t.tricky) assert.ok(/[?.!”]$/.test(x.q.trim()), `${key}/${x.id}: the Tricky case reads as the user's question or statement: "${x.q}"`);
    const ids = t.tricky.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${key}: tricky ids unique`);
    if (t.screenshot) {
      assert.ok(t.screenshot.legend.length >= 3, `${key}: a legend of 3+ items`);
      assert.ok(fs.existsSync(path.join(root, 'assets/help', `${t.screenshot.file}.png`)), `${key}: assets/help/${t.screenshot.file}.png exists`);
      assert.match(src('assets/help/index.ts'), new RegExp(`'${t.screenshot.file}': require\\('./${t.screenshot.file}.png'\\)`), `${key}: in HELP_SCREENSHOTS`);
    }
  }
  // The five Why? links resolve to a real Tricky case or section.
  for (const [name, why] of Object.entries(HELP_WHY)) {
    const t = HELP_TOPICS[why.topic];
    const anchors = [...t.tricky.map((x) => x.id), ...t.sections.map((s) => slug(s.title))];
    assert.ok(anchors.includes(why.anchor), `HELP_WHY.${name} → ${why.topic}#${why.anchor}`);
  }
  // The anchors screens deep-link to exist.
  const layout = src('app/(screens)/_layout.tsx') + src('app/(screens)/games/new.tsx') + src('app/(screens)/players/new.tsx') + src('components/results/ResultsShare.tsx') + src('components/game/GameSettingsDialog.tsx') + src('app/(auth)/register.tsx') + src('app/(screens)/score-entry.tsx');
  const links = [...layout.matchAll(/topic="([a-z-]+)" anchor="([a-z-]+)"|help="([a-z-]+)" helpAnchor="([a-z-]+)"|helpTopic="([a-z-]+)" helpAnchor="([a-z-]+)"|openHelp\('([a-z-]+)', pool \? '([a-z-]+)' : '([a-z-]+)'\)/g)];
  assert.ok(links.length >= 6, 'anchored links found');
  for (const m of links) {
    const topic = (m[1] ?? m[3] ?? m[5] ?? m[7]) as keyof typeof HELP_TOPICS;
    const anchors = [m[2] ?? m[4] ?? m[6], m[8], m[9]].filter(Boolean) as string[];
    const t = HELP_TOPICS[topic];
    const known = [...t.tricky.map((x) => x.id), ...t.sections.map((s) => slug(s.title)), 'menu', 'tricky'];
    for (const a of anchors) assert.ok(known.includes(a), `${topic}#${a} exists`);
  }
});

test('HL11-2 the ⋮ tables in help list the Menu.Item titles the code renders, in on-screen order', () => {
  const scorecard = HELP_TOPICS.scorecard.menu!;
  // PR 24 (#82) renames the ⋮ item to "Order of players"; the help text already says so, so the
  // table is checked against the renamed label until #82 lands and SEATING_MENU_ITEM catches up.
  const PR24_MENU_LABEL: Record<string, string> = { 'Seating order': 'Order of players' };
  assert.deepEqual(scorecard.rows.map((r) => r.item), ['Game settings', PLAYERS_ADMINS_TITLE, PR24_MENU_LABEL[SEATING_MENU_ITEM] ?? SEATING_MENU_ITEM, DEALER_MENU_ITEM, 'Edit round', 'Reopen game', 'Log', 'Hide game', 'Delete game']);
  const code = src('app/(screens)/games/[id].tsx');
  for (const item of ['Edit round', 'Reopen game', 'Log', 'Hide game', 'Delete game']) assert.match(code, new RegExp(`title="${item}"`), `scorecard ⋮ renders ${item}`);
  assert.match(code, /title=\{gameSettingsMenuTitle\(pool, maxRounds\)\}/);
  assert.match(code, /title=\{PLAYERS_ADMINS_TITLE\}/);
  assert.match(code, /title=\{SEATING_MENU_ITEM\}/);
  assert.match(code, /title=\{DEALER_MENU_ITEM\}/, '052: the Dealer item');

  const sheet = HELP_TOPICS['add-round'].menu!;
  assert.deepEqual(sheet.rows.map((r) => r.item), ['Clear this round', 'Game settings', 'Share live scorecard', 'Help']);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /'Clear this round'/);
  assert.match(entry, /title="Share live scorecard"/);
  assert.match(entry, /title="Help"/);

  const seat = HELP_TOPICS['players-admins'].menu!;
  for (const row of seat.rows) assert.ok(Object.values(SEAT_MENU_LABEL).includes(row.item), `Players · Admins row ${row.item} is a real seat menu label`);
  const mine = HELP_TOPICS['my-players'].menu!;
  for (const row of mine.rows) assert.ok(Object.values(SEAT_MENU_LABEL).includes(row.item), `My players row ${row.item} is a real row menu label`);

  const saved = HELP_TOPICS.results.menu!;
  assert.deepEqual(saved.rows.map((r) => r.item), ['Copy link', 'History', 'Delete result']);
  const resultScreen = src('app/(screens)/results/[id].tsx');
  assert.match(resultScreen, /title="Copy link"/);
  assert.match(resultScreen, /title=\{RESULT_HISTORY_TITLE\}/);
  assert.match(resultScreen, /title="Delete result"/);
});

test('HL11-3 no money words anywhere in help; chips are the real tags; bold labels are on-screen strings', () => {
  const all = HELP_TOPIC_KEYS.map((k) => helpTopicText(k)).join('\n');
  assert.doesNotMatch(all, /\b(money|expense|expenses|rupee|dollar|cash|stake|prize|bet|wager|settle|settlement|house share)s?\b/i);
  assert.doesNotMatch(all, /\bv\d+\.\d+|\bAPK\b|\bbuild \d+/i, 'no version or build fluff');
  // Chips in help text are only the tags the app shows.
  for (const m of all.replace(/\[\[[^\]]+\]\]/g, '').matchAll(/\[([A-Z][^\]\[]*)\]/g)) assert.ok((HELP_CHIPS as readonly string[]).includes(m[1]), `[${m[1]}] is a real tag`);
  // A few bold labels must read exactly like the screen.
  assert.match(all, /\*\*Give awards\*\*/);
  assert.match(all, /\*\*Add round\*\*/);
  assert.match(all, /\*\*Save result\*\*/);
  assert.match(all, /\*\*Hidden & deleted\*\*/);
  assert.match(all, new RegExp(GIVE_AWARDS_FIRST));
  // Legacy lines people were tested on still read the same way.
  assert.match(all, /Tap yourself if you are playing/);
  assert.match(all, /Yellow: selected now\. Green: score saved/);
  assert.match(all, /hidden for good — nothing is ever erased|hidden for good — nothing is erased/);
  assert.match(all, /support@ezscore\.app/);
  assert.match(plainHelpText(all), /Share works before or after saving/);
  assert.match(helpTopicText('my-players'), new RegExp(PLAINish(PLAYERS_NOTE)));
  assert.deepEqual(SETTINGS_PRIORITY.map((s) => s.title), ['Game settings', 'Settings', 'Game defaults'], 'Q11.16: "User settings" is now "Settings"');
  assert.doesNotMatch(all, /User settings/);
  assert.doesNotMatch(src('app/(tabs)/me.tsx') + src('app/(screens)/settings.tsx') + src('components/ui/SettingsPriority.tsx'), /User settings/);
  // Markup round-trips: plain text drops the tokens, split keeps them.
  assert.equal(plainHelpText('Tap **Give awards** on a [Completed] pool, then [[Save awards]].'), 'Tap Give awards on a Completed pool, then Save awards.');
  assert.deepEqual(splitHelpLine('[OUT] then <<101>>').map((p) => p.kind), ['chip', 'text', 'cell']);
});

test('HL11-4 the index lists every topic once in Home order; search finds by alias and by body; families map to theme tokens', () => {
  const index = helpIndex();
  assert.deepEqual(index.map((g) => g.group), HELP_GROUP_ORDER.filter((g) => index.some((x) => x.group === g)));
  const listed = index.flatMap((g) => g.topics.map((t) => t.key));
  assert.deepEqual([...listed].sort(), [...HELP_TOPIC_KEYS].sort());
  assert.equal(new Set(listed).size, HELP_TOPIC_KEYS.length);
  assert.equal(index[0].group, 'Playing');
  assert.equal(index[0].topics[0].key, 'home');
  assert.equal(HELP_INDEX_TITLE, 'Help & guide');

  assert.ok(searchHelp('awards').some((t) => t.key === 'awards'));
  assert.ok(searchHelp('give awards first').some((t) => t.key === 'results'));
  assert.ok(searchHelp('passcode').some((t) => t.key === 'sign-in'));
  assert.ok(searchHelp('re-entry').some((t) => t.key === 'game-type' || t.key === 'scoring-rules'));
  assert.deepEqual(searchHelp(''), []);
  assert.deepEqual(searchHelp('zzzz-nothing-here'), []);

  const page = src('components/help/HelpPage.tsx');
  assert.match(page, /games: .*gameTypes\.stake|gameTypes\.stake/, 'games family = the yellow game tint');
  assert.match(page, /primaryContainer/, 'results family = green');
  assert.match(page, /surfaceVariant/, 'people family = grey');
  assert.match(page, /tertiaryContainer/, 'rules family = blue');
  for (const key of HELP_TOPIC_KEYS) assert.ok(['games', 'results', 'people', 'rules'].includes(HELP_TOPICS[key].family), `${key} family`);
  // The index is one tap from Me (Q11.7) and from every help page's header.
  assert.match(src('app/(tabs)/me.tsx'), /testID="me-help-index"/);
  assert.match(src('app/(screens)/help/[topic].tsx'), /testID="help-index-link"/);
});

test('HL11-5 mini helps (ⓘ): the Game type screen keeps only live feedback; each InfoTip opens a short pop-up with Got it and Full guide', () => {
  const tip = src('components/ui/InfoTip.tsx');
  assert.match(tip, /accessibilityLabel=\{`About \$\{title\}`\}/, 'the ⓘ reads "About <title>" to a screen reader');
  assert.match(tip, /INFO_TIP_CLOSE = 'Got it'/);
  assert.match(tip, /INFO_TIP_MORE = 'Full guide'/);
  assert.match(tip, /onDismiss=\{\(\) => setOpen\(false\)\}/, 'a tap outside closes it');
  const step = src('components/game/GameTypeStep.tsx');
  assert.match(step, /testID: 'game-type-tip'/, 'the one ⓘ of the Game type group');
  assert.match(step, /testID: 'kind-settings-tip'/, 'the one ⓘ of the settings group');
  assert.doesNotMatch(step, /supportingText="For this game only/, 'the card subtitle moved into the ⓘ');
  assert.doesNotMatch(step, /The admin gives awards once the pool is completed\.'\s*:/, 'the kind paragraph moved into the ⓘ');
  assert.match(step, /SETTINGS_LINK/, 'the Settings link stays — it is an action, not an explanation');
  const form = src('components/game/RulesForm.tsx');
  for (const id of ['tip-limit', 'tip-values', 'tip-multiplier', 'tip-reentries']) assert.match(form, new RegExp(`\\$\\{testIDPrefix\\}-${id}`), `RulesForm ⓘ ${id}`);
  assert.doesNotMatch(form, /How many times per player\?/, 'the Re-entries question moved into its ⓘ');
  assert.match(form, /limitNumber \? limitHint\(limitNumber\)/, 'the live "100 is in, 101 is out" line stays');
  // 051 / D53 (Nov 19): the limit is no longer locked; the ⓘ explains what a change does once rounds exist.
  assert.match(form, /roundCount > 0 \? \[POOL_LIMIT_TIP, POOL_LIMIT_CHANGE_NOTE\] : POOL_LIMIT_TIP/, 'the change note joins the limit ⓘ once rounds exist');
  assert.doesNotMatch(form, /LOCKED_TAG|lockValues/, 'no Locked tag, no lock prop');
  const settings = src('components/game/GameSettingsDialog.tsx');
  assert.match(settings, /helpTopic="scorecard" helpAnchor="game-settings"/, 'Game settings ⓘ Full guide → scorecard help, Game settings part');
});

test('HL11-7 mini helps on every screen: each section keeps its title plus a ⓘ; the paragraphs moved into the pop-up; every pop-up deep-links to a real anchor', () => {
  // screen → the ⓘ testIDs it renders and the explanatory copy that must no longer sit on screen.
  const screens: { file: string; tips: string[]; gone?: RegExp[]; keep?: RegExp[] }[] = [
    { file: 'app/(tabs)/index.tsx', tips: ['home-live-tip', 'home-recent-tip'], gone: [/supportingText=\{recentSupporting\}/], keep: [/recentSupporting/] },
    { file: 'components/home/DeletedGamesCard.tsx', tips: ['home-deleted-tip'], gone: [/supportingText=\{DELETED_GAMES_SUPPORTING\}/] },
    // Size-S (D67, design-review-2 B16): one ⓘ per group; the "starts as", priority and hidden groups say it in a note or a row description.
    { file: 'app/(screens)/settings.tsx', tips: ['settings-points-tip', 'settings-pool-tip'], keep: [/SETTINGS_PRIORITY\.map/, /helpTopic="settings"/] },
    { file: 'app/(screens)/hidden-deleted.tsx', tips: ['hidden-games-tip', 'deleted-games-tip', 'deleted-results-tip'], keep: [/SUPPORT_CARD_BODY/] },
    // Size-S (D66): Profile has no ⓘ at all; the phone hint sits in its sheet, the e-mail help beside each switch.
    { file: 'app/(tabs)/me.tsx', tips: [], keep: [/EmailPrefsDialog/, /testID="me-help-index"/] },
    { file: 'app/(screens)/results/index.tsx', tips: ['results-picker-tip', 'past-results-tip', 'deleted-results-note-tip'], keep: [/DELETED_SECTION_NOTE/, /<WhyLink why="giveAwardsFirst"/] },
    { file: 'app/(screens)/games/award.tsx', tips: ['award-split-tip'], gone: [/testID="award-hint"/], keep: [/SPLIT_TIP/, /AWARD_PRESETS\.map\(\(p\) => `\*\*\$\{p\.label\}\*\*: \$\{p\.hint\}`\)/] },
    { file: 'app/(screens)/games/final-scores.tsx', tips: ['final-scores-picture-tip'] },
    { file: 'app/(screens)/games/players.tsx', tips: ['players-playing-tip'], keep: [/PLAYING_TIP/] },
    { file: 'app/(screens)/players/add.tsx', tips: ['add-players-tip'], keep: [/EDIT_NOTE/] },
    { file: 'components/players/FixInitialsScreen.tsx', tips: ['fix-initials-tip'] },
    { file: 'app/(screens)/games/new.tsx', tips: ['new-game-playing-tip', 'new-game-list-tip'], keep: [/Order of players/] },
  ];
  for (const screen of screens) {
    const code = src(screen.file);
    for (const id of screen.tips) assert.match(code, new RegExp(`testID[:=]\\s*['"]${id}['"]`), `${screen.file} renders ⓘ ${id}`);
    for (const re of screen.gone ?? []) assert.doesNotMatch(code, re, `${screen.file}: ${re} moved into the ⓘ`);
    for (const re of screen.keep ?? []) assert.match(code, re, `${screen.file}: ${re} stays (nothing removed, only moved)`);
  }
  // Every topic/anchor pair a ⓘ points at exists, in either attribute order.
  const pairs = /topic[:=]\s*['"]([a-z-]+)['"],?\s*anchor[:=]\s*['"]([a-z-]+)['"]|anchor[:=]\s*['"]([a-z-]+)['"],?\s*topic[:=]\s*['"]([a-z-]+)['"]/g;
  let checked = 0;
  for (const screen of screens) {
    for (const m of src(screen.file).matchAll(pairs)) {
      const topic = (m[1] ?? m[4]) as HelpTopicKey;
      const anchor = m[2] ?? m[3];
      const t = HELP_TOPICS[topic];
      assert.ok(t, `${screen.file}: topic ${topic} exists`);
      const known = [...t.tricky.map((x) => x.id), ...t.sections.map((s) => slug(s.title)), 'menu', 'tricky'];
      assert.ok(known.includes(anchor), `${screen.file}: ${topic}#${anchor} exists`);
      checked += 1;
    }
  }
  assert.ok(checked >= 15, `anchored ⓘ pop-ups found (${checked})`);
  // SectionCard grew a `tip` slot so a card keeps its title and gets the ⓘ beside it.
  assert.match(src('components/ui/SectionCard.tsx'), /tip\?: Omit<InfoTipProps, 'title'> & \{ title\?: string \}/);
  assert.match(src('components/ui/SectionCard.tsx'), /title\.replace\(\/ · \\d\+\$\/, ''\)/, 'the pop-up title drops the " · N" count');
});

test('HL11-8 help copy matches PR 24 (#82): four-step New game, Order of players, ↺ re-entry rows, footer inside the scorecard', () => {
  const newGame = plainHelpText(helpTopicText('new-game'));
  assert.match(newGame, /Then Order of players .* and, when a registered player was added, a co-admin\. Only the last step says Start game\./);
  assert.match(newGame, /\nOrder of players\n/);
  assert.match(newGame, /Draw a card each for the seating position\.[\s\S]*Tap players from the highest card to the lowest.*the last tap is seat 1\.[\s\S]*Seat 1 deals round 1\. The highest seat gets the first open card[\s\S]*Wrong tap\? Tap the latest player again to take the number back/);
  assert.match(newGame, /▲ ▼ arrows.*the lowest seat has no ▼[\s\S]*Clear removes every number.*Every player needs a seat before Next \(or Start game/);
  assert.match(newGame, /\nCo-admin and Start\n/);
  assert.match(newGame, /There is no pop-up after Start/);
  assert.doesNotMatch(newGame, /asks who sits where|\bSkip\b|two-step/);
  const scorecard = plainHelpText(helpTopicText('scorecard'));
  assert.match(scorecard, /re-entry score with ↺ in that round, and their cells above it turn grey/);
  assert.match(scorecard, /\(105 → ↺106\)/);
  assert.match(scorecard, /Order of players: set before Start/);
  assert.match(scorecard, /Foot, inside the card under the last round/);
  assert.match(scorecard, /inside the scorecard card right under the last round row and scrolls with the rounds/);
  assert.doesNotMatch(scorecard, /Seating order/);
  assert.equal(HELP_TOPICS.scorecard.menu!.rows.find((r) => r.does.startsWith('Rearrange'))!.item, 'Order of players');
  const gameType = plainHelpText(helpTopicText('game-type'));
  assert.match(gameType, /Unlimited \(the default\)/);
  assert.match(gameType, /Re-entry score .* and Late entry .*: Highest score still in, or Highest score \+ 1/);
  assert.doesNotMatch(gameType, /Start pool · N players/);
  assert.match(plainHelpText(helpTopicText('home')), /players, game type, order of players, then a co-admin/);
  assert.match(plainHelpText(helpTopicText('settings')), /Re-entry score and Late entry default to Highest score \+ 1/);
  assert.match(plainHelpText(helpTopicText('game-log')), /order of players/);
});

test('HL11-6 Why? links: the five puzzling dialogs link to their Tricky case', () => {
  assert.deepEqual(Object.keys(HELP_WHY).sort(), ['countedAgain', 'giveAwardsFirst', 'saveAwardsAnyway', 'scorecardChanged'].sort());
  assert.match(src('app/(screens)/results/index.tsx'), /<WhyLink why="giveAwardsFirst"/);
  assert.match(src('app/(screens)/games/award.tsx'), /<WhyLink why="saveAwardsAnyway"/);
  assert.match(src('app/(screens)/score-entry.tsx'), /why: 'scorecardChanged'/);
  assert.match(src('components/results/ResultWarnings.tsx'), /<WhyLink why="countedAgain"/);
  assert.match(src('components/help/WhyLink.tsx'), /WHY_LABEL = 'Why\?'/);
});

/** PLAYERS_NOTE has no markup; escape it for a RegExp. */
function PLAINish(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
