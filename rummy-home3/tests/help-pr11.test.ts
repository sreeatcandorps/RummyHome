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
  assert.deepEqual(scorecard.rows.map((r) => r.item), ['Game settings', PLAYERS_ADMINS_TITLE, SEATING_MENU_ITEM, 'Edit round', 'Reopen game', 'Log', 'Hide game', 'Delete game']);
  const code = src('app/(screens)/games/[id].tsx');
  for (const item of ['Edit round', 'Reopen game', 'Log', 'Hide game', 'Delete game']) assert.match(code, new RegExp(`title="${item}"`), `scorecard ⋮ renders ${item}`);
  assert.match(code, /title=\{gameSettingsMenuTitle\(pool, maxRounds\)\}/);
  assert.match(code, /title=\{PLAYERS_ADMINS_TITLE\}/);
  assert.match(code, /title=\{SEATING_MENU_ITEM\}/);

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
  assert.match(step, /testID="game-type-tip"/);
  assert.match(step, /testID="kind-settings-tip"/);
  assert.doesNotMatch(step, /supportingText="For this game only/, 'the card subtitle moved into the ⓘ');
  assert.doesNotMatch(step, /The admin gives awards once the pool is completed\.'\s*:/, 'the kind paragraph moved into the ⓘ');
  assert.match(step, /SETTINGS_LINK/, 'the Settings link stays — it is an action, not an explanation');
  const form = src('components/game/RulesForm.tsx');
  for (const id of ['tip-limit', 'tip-values', 'tip-multiplier', 'tip-reentries']) assert.match(form, new RegExp(`\\$\\{testIDPrefix\\}-${id}`), `RulesForm ⓘ ${id}`);
  assert.doesNotMatch(form, /How many times per player\?/, 'the Re-entries question moved into its ⓘ');
  assert.match(form, /limitNumber \? limitHint\(limitNumber\)/, 'the live "100 is in, 101 is out" line stays');
  assert.match(form, /lockValues \? \[POOL_LIMIT_TIP, POOL_LOCK_NOTE\] : POOL_LIMIT_TIP/, 'the lock note joins the limit ⓘ when the limit is locked');
  assert.match(form, /LOCKED_TAG/, 'and a Locked tag shows beside the title');
  const settings = src('components/game/GameSettingsDialog.tsx');
  assert.match(settings, /helpTopic="scorecard" helpAnchor="game-settings"/, 'Game settings ⓘ Full guide → scorecard help, Game settings part');
});

test('HL11-6 Why? links: the five puzzling dialogs link to their Tricky case', () => {
  assert.deepEqual(Object.keys(HELP_WHY).sort(), ['countedAgain', 'giveAwardsFirst', 'saveAwardsAnyway', 'scorecardChanged', 'settingsLocked'].sort());
  assert.match(src('app/(screens)/results/index.tsx'), /<WhyLink why="giveAwardsFirst"/);
  assert.match(src('app/(screens)/games/award.tsx'), /<WhyLink why="saveAwardsAnyway"/);
  assert.match(src('app/(screens)/score-entry.tsx'), /why: 'scorecardChanged'/);
  assert.match(src('components/results/ResultWarnings.tsx'), /<WhyLink why="countedAgain"/);
  assert.match(src('components/game/GameSettingsDialog.tsx'), /lockValues \? <WhyLink why="settingsLocked"/);
  assert.match(src('components/help/WhyLink.tsx'), /WHY_LABEL = 'Why\?'/);
});

/** PLAYERS_NOTE has no markup; escape it for a RegExp. */
function PLAINish(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
