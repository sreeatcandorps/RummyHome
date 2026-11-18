/**
 * Help — one topic per screen (PR 11, docs/help-design.md §3–§4). Every page has the same anatomy:
 * hero line · Need to know (3–5 bullets, only what the screen cannot say) · annotated screenshot
 * legend · Full guide sections · the ⋮ menu as a table in on-screen order · Tricky cases written as
 * the user's question · Also see.
 *
 * Markup inside a line (utils/helpMarkup.ts): **bold** for a label exactly as it reads on screen,
 * [Active] [Completed] [Closed] [Results] [View only] [Unregistered] [Pending registration]
 * [Awards pending] [OUT] [Re-entered] for the real tags, [[Save round]] for a button specimen,
 * <<-80>> for a score cell. English only for now; Telugu / Hindi would be a second file.
 */

export type HelpFamily = 'games' | 'results' | 'people' | 'rules';
export type HelpGroup = 'Playing' | 'Results' | 'People' | 'You' | 'Rules';

export type HelpMenuRow = { item: string; does: string; who: string; hidden?: string };
export type HelpSection = { title: string; bullets: string[] };
export type HelpTricky = { id: string; q: string; a: string };

export type HelpTopic = {
  key: HelpTopicKey;
  title: string;
  group: HelpGroup;
  family: HelpFamily;
  icon: string;
  purpose: string;
  needToKnow: string[];
  /** Annotated screenshot (assets/help/<screenshot>.png, built by scripts/help-screenshots.mjs) and its legend. */
  screenshot?: { file: string; legend: string[] };
  sections: HelpSection[];
  /** The screen's ⋮ menu (or row menu), in on-screen order. */
  menu?: { title: string; rows: HelpMenuRow[] };
  tricky: HelpTricky[];
  alsoSee: HelpTopicKey[];
  /** Words a search should also hit (old names, synonyms). */
  aliases?: string[];
};

/** The index page's title; also the row on Me that opens it. */
export const HELP_INDEX_TITLE = 'Help & guide';

export const HELP_TOPIC_KEYS = [
  'home',
  'new-game',
  'game-type',
  'scorecard',
  'add-round',
  'final-scores',
  'complete',
  'awards',
  'game-log',
  'players-admins',
  'results',
  'my-players',
  'add-players',
  'me',
  'settings',
  'hidden-deleted',
  'sign-in',
  'scoring-rules',
  'after-last-round',
] as const;
export type HelpTopicKey = (typeof HELP_TOPIC_KEYS)[number];

export const HELP_GROUP_ORDER: HelpGroup[] = ['Playing', 'Results', 'People', 'You', 'Rules'];

const topics: Record<HelpTopicKey, Omit<HelpTopic, 'key'>> = {
  // ───────────────────────────── Playing ─────────────────────────────
  home: {
    title: 'Home',
    group: 'Playing',
    family: 'results',
    icon: 'home-variant-outline',
    purpose: 'Your games, your results and your people, newest first.',
    needToKnow: [
      '**Results** on Home means two things: the list of saved results, and the place a new result is made from one or more games.',
      'A game is [Active] while scores go in, [Completed] once every score is in, and [Closed] once it is part of a saved result.',
      'Tap a game card to open its scorecard. Only an admin of that game can change scores; everyone else sees it [View only].',
      '**My players** is your own list of people you play with, not everyone in the app. The number on the button is how many are in it.',
      'A game you hid, or that was deleted, is not gone: **Deleted games** on Home and **Settings › Hidden & deleted** bring it back.',
    ],
    screenshot: {
      file: 'home',
      legend: [
        '**New game** starts the two-step New game flow (players, then game type).',
        '**Results** opens the results picker and the past results.',
        '**My players**, with the count of people in your list.',
        '**Recent**: every game you are in, newest first, with its status tag.',
        'Bottom bar: Home and your initials (your profile and settings).',
      ],
    },
    sections: [
      {
        title: 'Statuses',
        bullets: [
          '[Active] An active game. Scores are still going in.',
          '[Completed] A game that is complete. Every score is in.',
          '[Closed] Once a game is part of a consolidated result, it is marked Closed.',
        ],
      },
      {
        title: 'Results',
        bullets: [
          '[Results] show the consolidated winners from one or more games. Once results are announced, the games that were part of the results move from [Completed] to [Closed].',
        ],
      },
      {
        title: 'My players',
        bullets: ['My players is a list of players you regularly play with. The number on the button is how many are in it.'],
      },
      {
        title: 'Recent',
        bullets: [
          'Every game you are in, as a player, an admin or a viewer. The yellow square carries the game number; the tag shows the status.',
          'Pool games show the limit and how many are out. Points games with a multiplier show the ×N.',
          'The **Deleted games** card appears only when a game you scored in has been deleted; from there you can ask an admin to restore it.',
        ],
      },
      {
        title: 'Bottom bar',
        bullets: ['Two buttons: Home (this page) and your initials (your profile and settings).'],
      },
    ],
    tricky: [
      { id: 'missing-game', q: 'A game I played is not on Home.', a: 'Either you hid it (**Settings › Hidden & deleted › Unhide**) or an admin deleted it (it shows under **Deleted games** for 30 days). Or you were never added as a player — ask the admin to add you from **Players · Admins**.' },
      { id: 'cannot-score', q: 'Why can I not change scores in a game?', a: 'Only admins can. The creator is always an admin and can make you one from **Players · Admins**. Until then you see the scorecard [View only].' },
      { id: 'closed', q: 'Why is a game Closed and not Completed?', a: 'It is part of a saved result. Delete that result (from its page) and the game goes back to [Completed].' },
    ],
    alsoSee: ['new-game', 'results', 'my-players', 'hidden-deleted'],
    aliases: ['recent', 'statuses', 'bottom bar'],
  },

  'new-game': {
    title: 'New game · Players',
    group: 'Playing',
    family: 'games',
    icon: 'account-multiple-plus-outline',
    purpose: 'Pick who plays, then Next to choose Points or Pool.',
    needToKnow: [
      'Tap yourself if you are playing. You can run a game without sitting in it.',
      'Recent partners come first, then everyone else by how often you play together. Up to 20 players.',
      '**Add by initials**: new people by initials, seated as you save them. **Find in database**: a registered player, seated here and added to My players at once.',
      'Scorecard columns show each player\u2019s initials from your My players. If two would match, a **Fix initials** step appears before the game starts.',
      '**Next** opens Game type: Points or Pool, with Drop, Middle drop, Full count (and for a pool the limit and Re-entries) prefilled from your Settings.',
    ],
    screenshot: {
      file: 'new-game',
      legend: [
        '**Playing**: the people picked so far, in seat order. Tap a face or its × to send someone back to the list.',
        'The list: you first, then recent partners, then everyone else. Only people who have not finished signing up carry a tag.',
        '**Add by initials** and **Find in database** add someone who is not in the list yet.',
        '**Next · N players** goes to Game type.',
      ],
    },
    sections: [
      {
        title: 'Picking players',
        bullets: [
          'Tap a row to seat a player; tap the face under **Playing** (or its ×) to send them back. The order under Playing is the seating order to start with; you can change it after Start.',
          'You are always first in the list. Only players who have not finished signing up carry a tag: [Unregistered] (added by initials) or [Pending registration] (invited, not yet signed up).',
          'Search finds anyone in your My players, even in a list of thousands.',
        ],
      },
      {
        title: 'Adding mid-game',
        bullets: [
          'From the scorecard ⋮ › **Players · Admins › Add new player** the same screen opens in add mode. **Total** is how many will be playing: the faces already in the game plus the ones ringed yellow you are adding now. Admins who do not play are not counted.',
          'Tap a player below to add them; they get 0 for every round already played. **Return to game** seats everyone you added.',
          'The × on a face removes a player only while every one of their round scores is 0. Once they have a score, edit the round first.',
        ],
      },
      {
        title: 'Initials clash',
        bullets: [
          'Two players here would get the same column letters. The one who joined your My players first keeps the short form.',
          'Tap a suggestion or **Edit…** to type any 2 or 3 letters (A to Z) for the other player.',
          '**Apply and start** saves the new letters to My players, so every game you create agrees. **Not now** uses them for this game only.',
          'Letters stay the same for a seat once the game starts; a game admin can change them from Players · Admins.',
        ],
      },
      {
        title: 'After Start',
        bullets: [
          'After you start, the app asks who sits where (Seating order). Registered players you added may be offered as a co-admin once; **Skip** starts without one.',
          'The scorecard ⋮ has **Players · Admins** to invite people to register or send sign-up links.',
        ],
      },
    ],
    tricky: [
      { id: 'not-in-list', q: 'The person I want is not in the list.', a: 'They are not in your My players yet. **Find in database** if they have an account (name or #ID), **Add by initials** if they do not. Both seat them in this game at once.' },
      { id: 'who-deals', q: 'Who deals first?', a: 'Seat 1 in the seating order the app asks for right after Start. The deal then goes round by seat; played rounds keep their dealer.' },
      { id: 'twenty', q: 'Why can I not add a 21st player?', a: 'A game holds up to 20 players. Start a second game for the rest.' },
    ],
    alsoSee: ['game-type', 'add-players', 'my-players', 'scorecard'],
    aliases: ['new game', 'players', 'start a game', 'fix initials', 'add new players', 'from database'],
  },

  'game-type': {
    title: 'New game · Game type',
    group: 'Playing',
    family: 'games',
    icon: 'cards-playing-outline',
    purpose: 'Points or Pool, and this game\u2019s numbers.',
    needToKnow: [
      '**Points**: every round adds up to 0; the winner takes what the others lost. Scores are minus by default.',
      '**Pool**: the winner scores 0, everyone else adds their hand. Reach the limit (100 in, 101 out) and you are out.',
      '**Re-entries**: a player who is out may come back at the highest score still in — Unlimited, or Limited to a number per player.',
      'The settings here are for this game only and start from your Settings defaults. A pool\u2019s limit locks once a round is saved; Drop, Middle drop, Full count and Re-entries can change any time (the Log records it).',
      '**Multiplier** (Points only, 1 to 10,000): enter the small numbers as always; the app multiplies (×100 makes a 30 worth 3,000). A mid-game change applies to the whole game.',
    ],
    screenshot: {
      file: 'game-type',
      legend: [
        '**Points / Pool** switch. Switching reloads that kind\u2019s defaults.',
        '**Pool limit**: 101 · 201 · 251 · Custom… (51–999). The line under it says what is in and what is out.',
        '**Drop · Middle drop · Full count**: plus points in a pool, minus in Points.',
        '**Re-entries**: Unlimited, or Limited to N per player.',
        '**Start pool · N players** creates the game.',
      ],
    },
    sections: [
      {
        title: 'Points',
        bullets: [
          'Drop, Middle drop and Full count are the three quick buttons on Add round. Defaults -10, -30, -80; any 1–3 digit number works.',
          'Multiplier ×1 means the points are exactly what you type. With ×10,000 you still type 30 and the sheet shows 300K.',
        ],
      },
      {
        title: 'Pool',
        bullets: [
          'The limit decides who is out: at 101, a score of 100 is still in and 101 is out. Defaults 25, 50, 130 for Drop, Middle drop, Full count.',
          'When a pool is [Completed], an admin gives awards (who gets what from the pool); the awards are what the pool adds to Results.',
        ],
      },
      {
        title: 'Where the numbers come from',
        bullets: [
          'Prefilled from your **Settings** (your defaults for new games). Change them here for this game only, or tap the Settings link to change the defaults.',
          'A multiplier of 1,000 or more asks once before Start (**Large multiplier**) so a slip of the thumb does not price a game at ×10,000.',
        ],
      },
    ],
    tricky: [
      { id: 'limit-locked', q: 'Why is the pool limit grey in Game settings?', a: 'Rounds have been saved. Changing the limit would change who is out, so it is locked for this game. Drop, Middle drop, Full count and Re-entries still change.' },
      { id: 'which-kind', q: 'Points or Pool?', a: 'Points when every round is squared up among the table (the round adds to 0). Pool when players climb towards a limit and drop out; the last ones in share the pool through awards.' },
    ],
    alsoSee: ['scoring-rules', 'new-game', 'settings', 'awards'],
    aliases: ['points', 'pool', 'pool limit', 'multiplier', 're-entries', 'drop', 'middle drop', 'full count'],
  },

  scorecard: {
    title: 'Scorecard',
    group: 'Playing',
    family: 'games',
    icon: 'table-large',
    purpose: 'Every round, every player, the totals, and the ⋮ menu for the game.',
    needToKnow: [
      '[View only] means you can watch but not change scores. Admins see **Add round**, **Undo** and **Complete**.',
      'Totals sit in the header next to each name. With a multiplier, big numbers read short (8K, 1.2M); the **×N** chip opens the exact points.',
      'Pool: the header shows player number, initials and pool score; out is struck through, re-entered is blue. **Standings** below show points and drops left.',
      '**Seating order**: after Start the app asks who sits where. Seat 1 deals first and the deal goes round by seat. Admins change the order any time from ⋮; played rounds keep their dealer.',
      '**Undo** asks before removing the last round. **Complete** shows the final totals and asks once more before locking.',
    ],
    screenshot: {
      file: 'scorecard',
      legend: [
        'Header: each player\u2019s initials and total; the dealer marker on the seat that deals next.',
        'The rounds, newest at the bottom. Tap a cell to see the exact points.',
        '**Add round** (admins) opens the round sheet; **Undo** removes the last round.',
        'Share icon: the live link, and once complete the final scores picture or PDF.',
        '⋮ menu: Game settings, Players · Admins, Seating order, Edit round, Log, Hide, Delete.',
        'Foot: the game number with its creator and admins, and the Unique game ID (tap to copy).',
      ],
    },
    sections: [
      {
        title: 'The table',
        bullets: [
          'One column per seat, one row per round. Points: minus numbers in the players\u2019 colours, the winner\u2019s plus in green. Pool: plus points; the winner\u2019s <<0>>.',
          'Landscape shows more columns; with many players the table scrolls sideways and the initials stay pinned.',
          'Tap **Add round** for the next round; the dealer shown in the header is who deals it.',
        ],
      },
      {
        title: 'Sharing',
        bullets: [
          'The share icon opens one sheet: **Live scorecard link** (anyone with the link watches rounds and totals, no app or account needed) and, once the game is complete, **Share final scores** (the picture, or the full details as a PDF).',
        ],
      },
      {
        title: 'Game settings',
        bullets: [
          '⋮ › **Game settings** changes this game\u2019s Drop, Middle drop, Full count, Multiplier (Points) or Re-entries (Pool). They override your defaults for this game only; the Log records every change.',
          'A pool\u2019s limit is locked once a round is saved; the menu item then reads **Game settings · locked**.',
          'Changing the multiplier when rounds exist asks first: **Apply to whole game** re-prices every round; **Start a new game instead** opens New game with these players.',
        ],
      },
      {
        title: 'Pool',
        bullets: [
          'The limit line under the title (**Limit 101 · 100 in, 101 out**) and the number out. A player at or past the limit is [OUT]; **Re-enter** (admins) brings them back at the highest score still in, shown [Re-entered].',
          '**Standings** list everyone by points left; drops left count down from the Full count.',
          'When the pool is complete, **Give awards** appears; the Completed scorecard shows the Awards block.',
        ],
      },
      {
        title: 'Under the table',
        bullets: [
          'The game number with its creator and admins, and the full **Unique game ID**. Tap the ID to copy it when you report a problem.',
        ],
      },
    ],
    menu: {
      title: 'The ⋮ menu, top to bottom',
      rows: [
        { item: 'Game settings', does: 'Drop, Middle drop, Full count; Multiplier (Points) or Re-entries (Pool) for this game. Reads "· locked" on a pool with rounds.', who: 'Admins', hidden: 'Completed games show it read-only' },
        { item: 'Players · Admins', does: 'Who plays, who is admin, invite, link, initials, remove.', who: 'Everyone (admins can change)', hidden: 'Deleted game' },
        { item: 'Seating order', does: 'Rearrange who sits where; the deal follows the new order from the next round.', who: 'Admins', hidden: 'Completed game' },
        { item: 'Edit round', does: 'Pick a round and change its scores; the Log keeps the old ones.', who: 'Admins', hidden: 'Completed game, or no rounds yet (grey)' },
        { item: 'Reopen game', does: 'Unlocks a Completed game so rounds can be added again.', who: 'Admins', hidden: 'Active game, or a Closed game (part of a result)' },
        { item: 'Log', does: 'Every change to this game, written by the server.', who: 'Everyone' },
        { item: 'Hide game', does: 'Takes the game off your Home only. Unhide in Settings › Hidden & deleted.', who: 'Everyone', hidden: 'Deleted game' },
        { item: 'Delete game', does: 'Removes the game for every player, for 30 days under Deleted games, then hidden for good — nothing is erased.', who: 'Creator and admins', hidden: 'Deleted game' },
      ],
    },
    tricky: [
      { id: 'view-only', q: 'Why does it say View only?', a: 'You are not an admin of this game. Ask the creator (named under the table) to make you one from **Players · Admins**.' },
      { id: 'settings-locked', q: 'Why is Game settings locked?', a: 'Only the pool limit locks, and only once a round is saved — changing it would change who is out. Everything else in Game settings still changes.' },
      { id: 'scorecard-changed', q: '"The scorecard changed" — what happened?', a: 'Another phone saved a round, undid one or edited one while you were typing. The sheet reloads; check the round number before you save again.' },
      { id: 'reopen-blocked', q: 'Why can I not reopen a Completed game?', a: 'It is [Closed]: part of a saved result. Delete that result first (its games go back to Completed), then reopen.' },
      { id: 'short-numbers', q: 'The totals say 8K — where are the exact points?', a: 'Tap the **×N** chip (or any cell) for the exact number. Big totals read short on the scorecard so twenty columns still fit.' },
    ],
    alsoSee: ['add-round', 'players-admins', 'game-log', 'complete', 'scoring-rules'],
    aliases: ['game', 'rounds', 'undo', 'share', 'live link', 'dealer', 'seating', 'game settings', 'hide', 'delete'],
  },

  'add-round': {
    title: 'Add round',
    group: 'Playing',
    family: 'games',
    icon: 'plus-box-outline',
    purpose: 'One sheet per round: tap players, type or tap a value, save when it balances.',
    needToKnow: [
      'Tap one or more players, then type a number or tap **Drop**, **Middle drop** or **Full count**. Everyone you tapped gets it.',
      'Yellow: selected now. Green: score saved for this round. Beige: nothing yet.',
      'Points: scores are minus by default. Tap **+** for a hand-entered win. **Rummy**: tap the winners first; they split what the table lost so the round adds to 0.',
      'Pool: type each hand as plus points. Tap the winner, then **Rummy**: they score 0. Every player still in needs a score; players who are out are not on the sheet.',
      '[[Save round]] unlocks when **Balance** is 0 (Points) or when everyone has a score (Pool). Moving to another player saves the number you were typing.',
    ],
    screenshot: {
      file: 'add-round',
      legend: [
        'One cell per player: tap to select (yellow), the value goes in on the next tap.',
        'Quick values: Drop, Middle drop, Full count, and Rummy for the winner.',
        'The keypad; **+** flips a Points score to plus.',
        '**Balance** must read 0 before Save round unlocks (Points).',
        '⋮: Clear this round, Game settings, Share live scorecard, Help.',
      ],
    },
    sections: [
      {
        title: 'Points',
        bullets: [
          'Every round adds up to 0. The winner gets what the table lost; with two or more winners the pot is split and the extra point goes to the player tapped first.',
          'A **+** score for a non-winner is allowed (a hand-entered win); the sheet asks once if the round would still balance.',
          'With a multiplier you type the small numbers; the cells show what they are worth (×100: 30 → 3,000). **Actual / Entered points** switches this phone\u2019s view.',
        ],
      },
      {
        title: 'Pool',
        bullets: [
          'A hand above the Full count asks \u201cAre you sure?\u201d once, then saves.',
          'Each cell shows the score after this round; [OUT] marks a player the round puts out. After Save the sheet names who is out.',
        ],
      },
      {
        title: 'Editing a round',
        bullets: [
          'Scorecard ⋮ › **Edit round** opens this sheet for an older round (\u201cEdit which round?\u201d). Save re-totals everything after it; the Log keeps the old scores.',
          '**Undo my changes** (in the ⋮ while editing) puts the round back as it was; **Clear this round** empties a new one.',
        ],
      },
    ],
    menu: {
      title: 'The ⋮ menu on the sheet',
      rows: [
        { item: 'Clear this round', does: 'Empties every cell of a new round. While editing it reads Undo my changes.', who: 'Admins' },
        { item: 'Game settings', does: 'Same dialog as on the scorecard; the pool limit is locked once rounds exist.', who: 'Admins' },
        { item: 'Share live scorecard', does: 'The live link.', who: 'Admins' },
        { item: 'Help', does: 'This page.', who: 'Everyone' },
      ],
    },
    tricky: [
      { id: 'save-grey', q: 'Why is Save round grey?', a: 'Points: the Balance is not 0 — someone\u2019s score is missing or the plus and minus do not match. Pool: a player still in has no score yet.' },
      { id: 'negative-rummy', q: 'Rummy shows a minus number for the winner.', a: 'The others had plus scores (hand-entered wins), so the table is up and the winner takes the difference. The sheet asks you to confirm; it is allowed.' },
      { id: 'twenty-cols', q: 'I cannot see all the players.', a: 'With many players the cells come in three columns and the sheet scrolls; **More** shows the rest. Landscape fits more.' },
    ],
    alsoSee: ['scorecard', 'scoring-rules', 'game-type'],
    aliases: ['enter scores', 'score entry', 'rummy', 'balance', 'drop', 'edit round', 'undo'],
  },

  'final-scores': {
    title: 'Final scores',
    group: 'Playing',
    family: 'games',
    icon: 'podium-gold',
    purpose: 'The finished game as a picture to share, plus every round.',
    needToKnow: [
      'This is the sharing page for a [Completed] game: the standings card at the top is exactly what **Share final scores** sends.',
      '**Round by round** lists every round under the card; **Share full details** sends all of it as a PDF.',
      'Nothing here changes scores. To fix a round, go back to the scorecard: ⋮ › **Reopen game**, then **Edit round**.',
      'A Points game can be picked for Results straight away; a pool first needs awards.',
    ],
    screenshot: {
      file: 'final-scores',
      legend: [
        'The final standings card — the shared picture.',
        '**Round by round**: every round, in order.',
        '**Share full details** (PDF) and **Share final scores** (picture).',
      ],
    },
    sections: [
      {
        title: 'Sharing',
        bullets: [
          'The picture carries the game number, the players, the totals and the date; the PDF adds every round. Both can be sent again any time while the game exists.',
          'The live link (scorecard share icon) keeps working after completion and shows the same totals.',
        ],
      },
      {
        title: 'What comes next',
        bullets: [
          'Points: Home › **Results**, tick this game, **Show results**, **Save result**. Pool: **Give awards** on the scorecard first.',
        ],
      },
    ],
    tricky: [
      { id: 'wrong-total', q: 'A total is wrong — can I change it here?', a: 'No. Scorecard ⋮ › **Reopen game** (unless the game is already in a saved result), then ⋮ › **Edit round**. Complete again and the picture updates.' },
    ],
    alsoSee: ['complete', 'after-last-round', 'results', 'scorecard'],
    aliases: ['share final scores', 'share full details', 'pdf', 'picture'],
  },

  complete: {
    title: 'Complete game',
    group: 'Playing',
    family: 'games',
    icon: 'flag-checkered',
    purpose: 'Lock the scores; a pool then goes on to awards.',
    needToKnow: [
      'Completing the game locks the scores. In a Points game every round must add to 0 first.',
      'A Points game can then be picked for Results. A pool goes on to **Awards**; it can be picked for Results once the awards are given.',
      'Pressed too early? **Reopen game** from the scorecard ⋮ menu until it is added to Results.',
    ],
    screenshot: {
      file: 'complete',
      legend: ['The final totals, as they will be locked.', '**Complete game** asks once more, then locks.', 'Afterwards: **Final scores**, and for a pool **Give awards**.'],
    },
    sections: [
      {
        title: 'After completing',
        bullets: [
          'The scorecard shows [Completed]; Add round and Undo disappear. **Final scores** opens the sharing page.',
          'Pool: the scorecard offers **Give awards**; until they are saved the game shows [Awards pending] in Results.',
        ],
      },
    ],
    tricky: [
      { id: 'unbalanced', q: 'Why can I not complete the game?', a: 'A Points round does not add to 0. The page names the round; ⋮ › **Edit round** fixes it.' },
      { id: 'reopen', q: 'I completed too early.', a: 'Scorecard ⋮ › **Reopen game**. It is blocked only once the game is [Closed] (in a saved result) — delete that result first.' },
    ],
    alsoSee: ['after-last-round', 'final-scores', 'awards', 'results'],
    aliases: ['complete', 'lock', 'finish game'],
  },

  awards: {
    title: 'Awards (Pool)',
    group: 'Playing',
    family: 'games',
    icon: 'trophy-outline',
    purpose: 'Who gets what from a completed pool.',
    needToKnow: [
      'The pool is worth one entry per entry made (a re-entry counts twice). Tap a preset to see who gets what; players are sorted by points left.',
      '**Winner takes all** · **By points left** · **50/50** · **Entry per drop left** · **Custom** (type each player\u2019s share).',
      '**Award** = what a player gets minus their entries. The awards are what this pool adds to Results.',
      '**Save** works even when the pool is not fully given out; the app asks \u201cSave awards anyway?\u201d first. Awards can be edited until the pool is in a saved result.',
    ],
    screenshot: {
      file: 'awards',
      legend: ['The presets; the chosen one is filled.', 'Each player: entries, what they get, the award.', '**Save awards**, then **Add to Results**.'],
    },
    sections: [
      {
        title: 'The presets',
        bullets: [
          '**Winner takes all**: the last player in gets the whole pool. **By points left**: the players still in share it in proportion to the points they have left.',
          '**50/50**: the two best share it evenly — a deliberate exception to \u201cby points\u201d. **Entry per drop left**: one entry per drop a player still had; greyed when the pool does not cover it.',
          '**Custom**: type any shares. The line under the list shows what is still not given out.',
        ],
      },
      {
        title: 'After saving',
        bullets: [
          'The scorecard shows the Awards block. Home › **Results** can now tick the pool: it counts its awards, not its scores.',
          'Edit the awards from the same screen until the pool is part of a saved result; then the result has to be deleted first.',
        ],
      },
    ],
    tricky: [
      { id: 'give-first', q: 'Results says \u201cGive awards first\u201d.', a: 'A pool adds its awards to a result, not its scores. Open the pool\u2019s scorecard and tap **Give awards**; then tick it in Results.' },
      { id: 'save-anyway', q: '\u201cSave awards anyway?\u201d — is something wrong?', a: 'Part of the pool is not given to anyone. That is allowed (a part kept back on purpose, for example); the dialog only makes sure you meant it.' },
      { id: 'not-viable', q: 'Why is Entry per drop left grey?', a: 'The players still in have more drops left than the pool has entries, so one entry per drop is not possible. Pick another preset or Custom.' },
    ],
    alsoSee: ['after-last-round', 'results', 'scorecard'],
    aliases: ['give awards', 'pool awards', 'winner takes all', 'custom'],
  },

  'game-log': {
    title: 'Game log',
    group: 'Playing',
    family: 'games',
    icon: 'history',
    purpose: 'Every change to this game, written by the server.',
    needToKnow: [
      'Nobody can edit or remove entries. The server writes them as things happen, so every phone sees the same history.',
      '**All** shows everything; **Important** hides routine changes such as initials, admin changes and view-only players. Your choice is remembered on this phone.',
      'Tap an edited round to see the old and new scores. New entries appear as they happen.',
      '**Hide game** is personal and is not listed.',
    ],
    screenshot: {
      file: 'game-log',
      legend: ['**All / Important** filter.', 'One row per change: who, when, what. Green dot = important.', 'An edited round opens to show before and after.'],
    },
    sections: [
      {
        title: 'What is logged',
        bullets: [
          'Rounds saved, undone and edited (with the old scores); game settings and multiplier changes; seating order; players added, removed, linked, renamed; admins made and removed; complete, reopen, awards; delete and restore.',
        ],
      },
    ],
    tricky: [
      { id: 'put-back', q: 'Can I put a round back from the Log?', a: 'Not from here yet — the Log shows the old scores so an admin can re-enter them with **Edit round**. Nothing is lost.' },
    ],
    alsoSee: ['scorecard', 'add-round'],
    aliases: ['log', 'history', 'audit'],
  },

  'players-admins': {
    title: 'Players · Admins',
    group: 'People',
    family: 'people',
    icon: 'account-cog-outline',
    purpose: 'Who is in this game, who may change scores, and the row actions.',
    needToKnow: [
      'Each row shows the name, Player ID and role (Creator, Admin, Player, View only). Only players who have not finished signing up carry a tag ([Unregistered], [Pending registration]).',
      'Admins can change scores. The creator is always an admin. Admins can be set after the game is over too.',
      '**Remove from game** asks first and works only while the player has no scores or every round score they have is 0. Otherwise edit the rounds and clear their scores first.',
      '**Add new player** picks from My players (0 for rounds already played). **Add non-playing admin**: someone who keeps score but does not play, by Player ID; no column.',
    ],
    sections: [
      {
        title: 'Linking an account',
        bullets: [
          '**Link to Player ID** needs the account\u2019s Player ID and its email together, and moves the player in every game they are in. It refuses if that account already plays in one of those games.',
          '**Invite to register** sends a sign-up link that is good once for 14 days; when the person signs up with it, their scores move to their account.',
        ],
      },
      {
        title: 'Initials and names',
        bullets: [
          '**Edit initials** changes this game\u2019s column letters. When you created the game, your My players entry follows so the next game agrees.',
          '**Edit name** renames an unregistered player you added; a registered player\u2019s name is theirs to change.',
        ],
      },
    ],
    menu: {
      title: 'The row ⋮, in order',
      rows: [
        { item: 'Invite to register', does: 'Sends a sign-up link (one use, 14 days).', who: 'Admins', hidden: 'Registered player' },
        { item: 'Link to Player ID', does: 'Joins this seat to an existing account by ID + email.', who: 'Admins', hidden: 'Registered player' },
        { item: 'Edit initials', does: 'This game\u2019s column letters.', who: 'Admins' },
        { item: 'Edit name', does: 'Rename an unregistered player.', who: 'Admins', hidden: 'Registered player' },
        { item: 'Make admin', does: 'Lets the player change scores. Reads Remove admin for an admin.', who: 'Admins', hidden: 'The creator (always admin)' },
        { item: 'Remove from game', does: 'Only while all their scores are 0.', who: 'Admins', hidden: 'Player with scores (grey, with the reason)' },
      ],
    },
    tricky: [
      { id: 'cannot-remove', q: 'Why can I not remove a player?', a: 'They have a score in some round. ⋮ › **Edit round** and clear their scores first, then remove.' },
      { id: 'only-organiser', q: 'The ⋮ says only the organiser can change this player.', a: 'An unregistered player belongs to whoever added them. Ask that admin, or **Link to Player ID** once the person has an account.' },
    ],
    alsoSee: ['scorecard', 'my-players', 'add-players'],
    aliases: ['admins', 'make admin', 'remove player', 'invite', 'link'],
  },

  // ───────────────────────────── Results ─────────────────────────────
  results: {
    title: 'Results',
    group: 'Results',
    family: 'results',
    icon: 'trophy-variant-outline',
    purpose: 'Make a result from one or more games, and keep the past ones.',
    needToKnow: [
      'The [Completed], [Closed] and [Active] chips choose which games are listed; any mix can be on. Completed games you run start ticked.',
      'Every game you are in is listed, but only games you create or admin can be ticked. A pool counts its awards, not its scores; without awards it is greyed: \u201cGive awards first\u201d.',
      'Pick one or more games and tap **Show results**. The highest total is the winner; 1st, 2nd and 3rd place are named. Nothing is saved by looking.',
      '**Save result** moves the games to [Closed] and lists what changed. It is off while an Active game is selected.',
      '**Share** works before or after saving: a picture of the totals (five games per row) or a PDF with every round; the result id is at the bottom of both.',
    ],
    screenshot: {
      file: 'results',
      legend: ['Status chips filter the list.', 'Tick the games for this result.', '**Show results** → the preview; **Save result** at the top of the preview.', '**Past results** below: every saved result, and Deleted.'],
    },
    sections: [
      {
        title: 'The preview',
        bullets: [
          'One column per game (yellow heads), one row per player, totals on the right. Points games add their totals; a pool adds its awards.',
          '**Save result** (top) saves it; **Share** sends the picture or PDF even unsaved (marked as a preview).',
          'If a chip would hide a ticked game, the app asks first.',
        ],
      },
      {
        title: 'A saved result',
        bullets: [
          'The same table plus **Games in this result** and **History** (deletions, restores, and changes to a game it counts).',
          'When a round is edited or undone in a game that is part of this result, the result is totalled again and the line \u201cChanged after sharing\u201d is added to the page, the picture, the PDF and the web page.',
          '**Delete this result** (at the foot, below History) sends its games back to [Completed]. Undo for 10 seconds; admins can restore it for 30 days from Settings › Hidden & deleted.',
          'A game keeps its own number. At most 50 players.',
        ],
      },
      {
        title: 'Closed games',
        bullets: [
          'A Closed game can be picked again, but the app warns you: its points were already counted once, and the saved result carries a small warning icon. Best to first delete the old result that closed it.',
        ],
      },
    ],
    menu: {
      title: 'A saved result\u2019s ⋮',
      rows: [
        { item: 'Copy link', does: 'The result\u2019s web page link.', who: 'Everyone' },
        { item: 'History', does: 'Scrolls to the History block.', who: 'Everyone' },
        { item: 'Delete result', does: 'Removes the result for everyone; its games go back to Completed.', who: 'Who saved it, or an admin of its games' },
      ],
    },
    tricky: [
      { id: 'give-awards-first', q: 'Why is a pool grey with \u201cGive awards first\u201d?', a: 'A pool adds its awards, not its scores. Open its scorecard, **Give awards**, save, then tick it here.' },
      { id: 'save-off', q: 'Why is Save result off?', a: 'An [Active] game is ticked. A result only takes finished games: go back and untick it, or complete the game first.' },
      { id: 'counted-again', q: '\u201cThis game was already counted\u201d — what does it mean?', a: 'The game is [Closed]: it is in a saved result already. Saving again counts its points twice and marks the new result with a warning. Delete the old result first if you meant to redo it.' },
      { id: 'cannot-tick', q: 'Why can I not tick a game?', a: 'You are not its creator or admin. Only an admin of a game can put it in a result.' },
    ],
    alsoSee: ['after-last-round', 'awards', 'hidden-deleted', 'home'],
    aliases: ['show results', 'save result', 'past results', 'share result', 'delete result', 'winner', 'place'],
  },

  // ───────────────────────────── People ─────────────────────────────
  'my-players': {
    title: 'My players',
    group: 'People',
    family: 'people',
    icon: 'account-group-outline',
    purpose: 'Your own list of the people you play with.',
    needToKnow: [
      'My players is your own list, not everyone in the EZ Score database. New game picks from it. Frequent first; **Alphabetical** shows A–Z sections. Search finds anyone, even in a list of thousands.',
      '**Find in database** adds people from the EZ Score database. **Add by initials** takes initials; they get a #ID at once and show as [Unregistered] until they sign up.',
      'A player must be registered in the database to see their games in the app. Anyone can watch a game live, without the app or registering, when the admin shares the live link.',
      '**Remove from My players** changes only your list: past games and results stay. Undo, or add them again, brings the history back.',
      'Initials: first and last letter. If two of your players share them, the one added first keeps the short form; the other gets three letters from their name (SUK). Or type any 2–3 letters.',
    ],
    screenshot: {
      file: 'my-players',
      legend: ['Search and the Frequent / Alphabetical switch.', 'A row: name, #ID, tag if not signed up; tap for the initials.', 'The row ⋮: Change initials, Edit name, Invite, Link, Remove.', '**Unregistered** tile: how many have not signed up; tap to filter.', '**Add by initials** and **Find in database**.'],
    },
    sections: [
      {
        title: 'Initials',
        bullets: [
          'Initials must differ only within your My players and never change by themselves. After a rename you see the new name at once, plus a \u201cName changed\u201d note if the letters no longer fit.',
          'Tap a row for the initials; **Change initials** in the ⋮ types any free 2–3 letters. Games already started keep their column letters (an admin changes them from Players · Admins).',
        ],
      },
      {
        title: 'Unregistered players',
        bullets: [
          'The **Unregistered** tile at the bottom shows how many have not signed up and filters the list to them. Each row\u2019s ⋮ has **Invite to register** (a sign-up link, good once for 14 days) and **Link to Player ID**.',
        ],
      },
    ],
    menu: {
      title: 'The row ⋮',
      rows: [
        { item: 'Change initials', does: 'Any free 2–3 letters for this player in your list.', who: 'You' },
        { item: 'Edit name', does: 'Rename a player you added by initials.', who: 'You', hidden: 'Registered player' },
        { item: 'Invite to register', does: 'A sign-up link (one use, 14 days).', who: 'You', hidden: 'Registered player' },
        { item: 'Link to Player ID', does: 'Join this entry to an existing account by ID + email.', who: 'You', hidden: 'Registered player' },
        { item: 'Remove from My players', does: 'Only your list changes; games and results stay.', who: 'You' },
      ],
    },
    tricky: [
      { id: 'three-letters', q: 'Why does a player have three letters?', a: 'Two of your players share the first-and-last-letter form; the one added first keeps it. **Change initials** to pick any 2–3 letters you like.' },
      { id: 'no-games', q: 'A player says they cannot see the game.', a: 'They are not registered, or the game sits under a different player. **Invite to register** or **Link to Player ID** moves the scores to their account.' },
    ],
    alsoSee: ['add-players', 'new-game', 'players-admins'],
    aliases: ['players', 'initials', 'unregistered', 'frequent', 'alphabetical'],
  },

  'add-players': {
    title: 'Add players · Find player',
    group: 'People',
    family: 'people',
    icon: 'account-search-outline',
    purpose: 'New people by initials, or registered players from the database.',
    needToKnow: [
      '**Add by initials**: three rows at a time. Cell 1 takes one letter and jumps on; cell 2 takes one or two letters or digits. The initials are the player\u2019s name for now.',
      'Each row saves on its own. Saved players show as [Unregistered] until they sign up. There is no delete here; remove a player from the previous screen. Tap **Done** to go back; nothing else closes this screen.',
      '**Find in database**: registered players only. Type at least two letters of a name, or a player ID such as 42.',
      '**+ My players** adds the person to your list (it does not seat them). From New game, **+ Add** seats the person in this game and adds them to My players at the same time.',
    ],
    screenshot: {
      file: 'add-players',
      legend: [
        'Add by initials: three rows, two cells each; **Save** on a row keeps it.',
        'A saved row shows the letters the app picked; tap to change them.',
        '**Done** goes back; rows you saved are already in. Find in database is the other way in: search by name or #ID.',
      ],
    },
    sections: [
      {
        title: 'Add by initials',
        bullets: [
          'When the letters are already someone\u2019s in My players, the new player gets the next free form, such as SK2. **Edit** lets you type any free 2–3 characters; the first must be a letter.',
        ],
      },
      {
        title: 'Find in database',
        bullets: [
          '\u201cIn your player list\u201d means they are already there. Not in the database? Go back and use Add by initials.',
        ],
      },
    ],
    tricky: [
      { id: 'not-found', q: 'Find in database finds nobody.', a: 'They have no account yet (or a different name). Use **Add by initials**; **Invite to register** later moves the scores to their account.' },
      { id: 'done-only', q: 'Why is Done the only way out?', a: 'Every row saves on its own as you type, so there is nothing to cancel. Done just goes back.' },
    ],
    alsoSee: ['my-players', 'new-game', 'players-admins'],
    aliases: ['add by initials', 'find in database', 'find player', 'player id'],
  },

  // ───────────────────────────── You ─────────────────────────────
  me: {
    title: 'Me',
    group: 'You',
    family: 'people',
    icon: 'account-circle-outline',
    purpose: 'Your account, your defaults, your phone\u2019s look.',
    needToKnow: [
      'Your email is how you sign in. It cannot be changed for now.',
      'Your **player ID** is what you give someone so they can find you. It is never used to sign in.',
      'Phone is optional and never texted.',
      '**Settings** are the defaults every new game starts with. Dark mode is saved on this phone only.',
      '**Delete account** (under Account) removes your sign-in, email, phone and Player ID for good. Scorecards you shared keep your name as an unregistered player.',
    ],
    screenshot: {
      file: 'me',
      legend: [
        'Your name, email and #ID; **Share your Player ID** so a friend can link you.',
        '**Change passcode**: the 6 digits you sign in with.',
        '**Appearance**: Phone, Light or Dark.',
        'Phone and Email. Scroll down for **Settings**, **Help & guide** and Log out.',
      ],
    },
    sections: [
      {
        title: 'Account',
        bullets: [
          '**Change passcode**: 6 digits, numbers only. **Sign out** keeps your data; sign in again any time.',
          'A deleted account can still be a seat in old games (shown as unregistered) but never an admin.',
        ],
      },
    ],
    tricky: [
      { id: 'change-email', q: 'Can I change my email?', a: 'Not yet. It is your sign-in. Email support@ezscore.app with your Player ID if it must change.' },
    ],
    alsoSee: ['settings', 'sign-in', 'my-players'],
    aliases: ['profile', 'account', 'passcode', 'sign out', 'delete account', 'dark mode'],
  },

  settings: {
    title: 'Settings',
    group: 'You',
    family: 'people',
    icon: 'cog-outline',
    purpose: 'Your defaults for every new game.',
    needToKnow: [
      'Which settings win, highest first: **Game settings** for one game, then **Settings** (yours), then **Game defaults**.',
      '**Game settings**: change one game from its ⋮ menu. They override everything for that game.',
      'What you set here is what every new game starts with for you — Points and Pool each keep their own numbers.',
      '**Game defaults**: Rummy\u2019s standard -10, -30, -80 (Points) and 101 / 25, 50, 130 (Pool), used when you have set nothing else.',
      '**Multiplier default** (Points): what every new Points game starts at. ×1 means the points are exactly what you enter.',
    ],
    screenshot: {
      file: 'settings',
      legend: [
        'The priority ladder: Game settings › Settings › Game defaults.',
        'Points defaults, with the Multiplier.',
        'Pool defaults: limit, values, Re-entries. **Hidden & deleted** is at the foot.',
      ],
    },
    sections: [
      {
        title: 'Hidden & deleted',
        bullets: ['The games you hid, the games and results that were deleted, and Restore. See its own page.'],
      },
    ],
    tricky: [
      { id: 'not-applied', q: 'I changed a default but the game did not change.', a: 'Defaults apply to new games. A running game has its own numbers: scorecard ⋮ › **Game settings**.' },
    ],
    alsoSee: ['game-type', 'hidden-deleted', 'me'],
    aliases: ['user settings', 'defaults', 'priority', 'game defaults'],
  },

  'hidden-deleted': {
    title: 'Hidden & deleted',
    group: 'You',
    family: 'people',
    icon: 'eye-off-outline',
    purpose: 'Bring back a hidden game, a deleted game or a deleted result.',
    needToKnow: [
      '**Hide game** (scorecard ⋮) takes a game off your Home only. It still counts in results and stats. **Unhide** it here.',
      '**Delete game** (creator or admin) removes it for every player. A game in a saved result leaves that result; the result is totalled again.',
      '**Restore** brings a deleted game back. It is not added back to results it was removed from; save a new result if it should count.',
      'A deleted game stays under **Deleted games** for 30 days, then is hidden for good — nothing is ever erased. Players who scored in it see it on Home and can ask an admin to restore it.',
      'Only the person who deleted something, or an admin of it, can restore it. No admin left? Email support@ezscore.app with the Unique game ID from the scorecard foot.',
    ],
    sections: [
      {
        title: 'Results',
        bullets: [
          '**Delete result** (result ⋮, for whoever saved it or an admin of its games) removes the result for everyone. Its games are no longer [Closed]. Undo for 10 seconds on the spot; Restore here for 30 days.',
        ],
      },
    ],
    tricky: [
      { id: 'thirty-days', q: 'What happens after 30 days?', a: 'The game leaves Deleted games and is hidden for good. Its rows stay in the database — nothing is erased — so support can still bring it back with the Unique game ID.' },
      { id: 'who-restores', q: 'Who can restore?', a: 'Whoever deleted it, or any admin of the game. Players see the game under Deleted games on Home and can **Ask an admin to restore**.' },
    ],
    alsoSee: ['home', 'results', 'scorecard'],
    aliases: ['hide', 'unhide', 'restore', 'deleted games', 'deleted results', 'support'],
  },

  'sign-in': {
    title: 'Sign in · Create account · Passcode',
    group: 'You',
    family: 'people',
    icon: 'login-variant',
    purpose: 'Email and a 6-digit passcode; a code by email if you forget it.',
    needToKnow: [
      'Your passcode is 6 digits. Numbers only.',
      '**Forgot passcode** emails you a 6-digit code (OTP) to type back here, then you choose a new passcode. The OTP works once and expires in 15 minutes; your old passcode keeps working until the new one is saved.',
      'Email is how you sign in. It cannot be changed later. Phone and zip code are optional; we never text you.',
      'Came from a friend\u2019s invite? Confirm your email, then tap **Yes** on \u201cIs this you?\u201d to move your past scores here.',
      'Have a player ID like 42 but no invite? Enter it and the friend who added you approves it. A player ID is never used to sign in.',
    ],
    sections: [
      {
        title: 'Create account',
        bullets: [
          'Name, email, 6-digit passcode. Country picker for the optional phone. We email a confirmation; confirm it before signing in.',
        ],
      },
      {
        title: 'Is this you?',
        bullets: [
          'When a friend invited you or you typed a player ID, the app shows the seat it found: name, initials, games. **Yes** moves those scores to your account; **No** starts clean.',
          'A request to join a player ID without an invite waits for the friend who added that player to approve it (they see it on My players).',
        ],
      },
    ],
    tricky: [
      { id: 'otp-refused', q: 'The OTP is refused.', a: 'It is older than 15 minutes or was already used. Tap **Send a new OTP**; type the newest one. Check the spam folder.' },
      { id: 'no-email', q: 'No confirmation email.', a: 'Check spam, then **Resend**. The address must be exactly the one you typed; a typo means a new account with the right address.' },
    ],
    alsoSee: ['me', 'my-players'],
    aliases: ['login', 'register', 'forgot passcode', 'otp', 'reset', 'claim', 'is this you'],
  },

  // ───────────────────────────── Rules ─────────────────────────────
  'scoring-rules': {
    title: 'How scoring works',
    group: 'Rules',
    family: 'rules',
    icon: 'calculator-variant-outline',
    purpose: 'Points and Pool, drops, Rummy and the multiplier — in one place.',
    needToKnow: [
      '**Points**: every round adds to 0. Losers score minus their hand; the winner gets the sum. Drop -10, Middle drop -30, Full count -80 by default.',
      '**Pool**: everyone but the winner adds their hand as plus points; the winner scores 0. At the limit (101: 100 in, 101 out) you are out; a re-entry comes back at the highest score still in.',
      '**Rummy** is the winner\u2019s button: Points — the winners split what the table lost; Pool — the winner scores 0.',
      '**Multiplier** (Points): type the small numbers, the app multiplies every score and total; a change applies to the whole game.',
    ],
    sections: [
      {
        title: 'Points in detail',
        bullets: [
          'A **Drop** is leaving before your first pick; **Middle drop** after it; **Full count** is the most a hand can cost. Any 1–3 digit number can be typed instead.',
          'Two winners split the pot; the extra point goes to the one tapped first. A plus score for a non-winner is a hand-entered win and is allowed when the round still balances.',
          'Totals are shown short above 9,999 (10K, 1.2M); the exact number is one tap away.',
        ],
      },
      {
        title: 'Pool in detail',
        bullets: [
          'The limit is per player and locks once a round is saved. Drops are plus points too (25, 50, 130 by default).',
          '**Standings** show points left to the limit and how many Full-count drops that is.',
          'When the pool is complete, awards decide who gets what; a result counts the awards.',
        ],
      },
    ],
    tricky: [
      { id: 'balance', q: 'Why must a Points round balance to 0?', a: 'Because the winner\u2019s gain is exactly what the others lost. The app computes the winner\u2019s score from the losers, so Balance 0 is the check that nothing was mistyped.' },
    ],
    alsoSee: ['game-type', 'add-round', 'after-last-round'],
    aliases: ['rules', 'points', 'pool', 'rummy', 'multiplier', 'drop', 'limit'],
  },

  'after-last-round': {
    title: 'Complete → Award → Result',
    group: 'Rules',
    family: 'rules',
    icon: 'ray-start-arrow',
    purpose: 'The steps after the last round, for a Points game and for a pool.',
    needToKnow: [
      '**Points**: Complete (locks the scores) → Home › Results, tick the game, Show results → **Save result** (the game becomes [Closed]).',
      '**Pool**: Complete → **Give awards** (who gets what from the pool) → Results, tick the pool (it counts its awards) → Save result.',
      '**Final scores** is for sharing a finished game and changes nothing. **Reopen game** undoes Complete until the game is in a saved result.',
    ],
    sections: [
      {
        title: 'Why three steps',
        bullets: [
          'Complete is per game and locks it. Awards turn a pool\u2019s scores into what each player gets. A result combines one or more finished games into one table and closes them, so they are not counted twice.',
        ],
      },
      {
        title: 'Undoing a step',
        bullets: [
          'Delete the result → its games go back to Completed. Edit the awards → allowed until the pool is in a saved result. Reopen the game → allowed until it is Closed.',
        ],
      },
    ],
    tricky: [
      { id: 'order', q: 'Can I give awards before completing?', a: 'No — the pool must be complete so the scores cannot move under the awards. Complete first; the scorecard then offers Give awards.' },
    ],
    alsoSee: ['complete', 'awards', 'results', 'final-scores'],
    aliases: ['complete', 'award', 'result', 'closed', 'steps'],
  },
};

export const HELP_TOPICS: Record<HelpTopicKey, HelpTopic> = Object.fromEntries(
  (Object.keys(topics) as HelpTopicKey[]).map((key) => [key, { key, ...topics[key] }]),
) as Record<HelpTopicKey, HelpTopic>;

export const helpTopic = (key: HelpTopicKey): HelpTopic => HELP_TOPICS[key];

/** Topics grouped for the index, in Home order (Q11.19). */
export function helpIndex(): { group: HelpGroup; topics: HelpTopic[] }[] {
  return HELP_GROUP_ORDER.map((group) => ({
    group,
    topics: HELP_TOPIC_KEYS.map((k) => HELP_TOPICS[k]).filter((t) => t.group === group),
  })).filter((g) => g.topics.length > 0);
}

/** Every line of a topic, for search and for the content tests. */
export function helpTopicText(key: HelpTopicKey): string {
  const t = HELP_TOPICS[key];
  return [
    t.title,
    t.purpose,
    ...t.needToKnow,
    ...(t.screenshot?.legend ?? []),
    ...t.sections.flatMap((s) => [s.title, ...s.bullets]),
    ...(t.menu ? [t.menu.title, ...t.menu.rows.flatMap((r) => [r.item, r.does, r.who, r.hidden ?? ''])] : []),
    ...t.tricky.flatMap((x) => [x.q, x.a]),
    ...(t.aliases ?? []),
  ].join('\n');
}

const norm = (s: string) => s.toLowerCase().replace(/[*\[\]<>]/g, '');

/** Local search over titles, bullets and aliases: topics whose text contains every word. */
export function searchHelp(query: string): HelpTopic[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return HELP_TOPIC_KEYS.map((k) => HELP_TOPICS[k]).filter((t) => {
    const text = norm(helpTopicText(t.key));
    return words.every((w) => text.includes(w));
  });
}

/**
 * The five dialogs that puzzle people get a "Why?" link to the matching Tricky case (Q11.6).
 * Each entry: topic + tricky id, resolved by the help page as an anchor.
 */
export const HELP_WHY = {
  giveAwardsFirst: { topic: 'results', anchor: 'give-awards-first' },
  scorecardChanged: { topic: 'scorecard', anchor: 'scorecard-changed' },
  saveAwardsAnyway: { topic: 'awards', anchor: 'save-anyway' },
  settingsLocked: { topic: 'scorecard', anchor: 'settings-locked' },
  countedAgain: { topic: 'results', anchor: 'counted-again' },
} as const satisfies Record<string, { topic: HelpTopicKey; anchor: string }>;

/** Route → topic, so a `?` in any header can be wired by screen name (HL11-1). */
export const ROUTE_TOPIC: Record<string, HelpTopicKey> = {
  '(tabs)/index': 'home',
  '(tabs)/players': 'my-players',
  '(tabs)/me': 'me',
  '(auth)/login': 'sign-in',
  '(auth)/register': 'sign-in',
  '(auth)/forgot-password': 'sign-in',
  claim: 'sign-in',
  '(screens)/games/new': 'new-game',
  '(screens)/games/[id]': 'scorecard',
  '(screens)/score-entry': 'add-round',
  '(screens)/games/final-scores': 'final-scores',
  '(screens)/games/complete': 'complete',
  '(screens)/games/award': 'awards',
  '(screens)/games/log': 'game-log',
  '(screens)/games/players': 'players-admins',
  '(screens)/games/history': 'home',
  '(screens)/results/index': 'results',
  '(screens)/results/view': 'results',
  '(screens)/results/[id]': 'results',
  '(screens)/players/index': 'my-players',
  '(screens)/players/[id]': 'my-players',
  '(screens)/players/[id]/edit': 'my-players',
  '(screens)/players/add': 'add-players',
  '(screens)/players/new': 'add-players',
  '(screens)/profile': 'me',
  '(screens)/settings': 'settings',
  '(screens)/hidden-deleted': 'hidden-deleted',
};
