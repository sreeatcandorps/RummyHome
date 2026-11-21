import { OrderDraft, startOrder, tapPlayer, stepNumbered } from '@/utils/seating';

/**
 * Short step-by-step tutorials (D61, Sree Nov 19–20: "show each step clearly, maybe a small video …
 * force them to see it the first time … a 3-step, 4-step, and they click Next, Next, Next"). One
 * sheet, N steps, each step a looping demo of the real rows plus one line of text. The first one is
 * the Order of players; the strings and the demo script live here so the sheet and the tests agree.
 */

export type TutorialKey = 'seating';

export type TutorialStep = {
  title: string;
  /** The one line under the demo. */
  line: string;
};

export const TUTORIAL_NEXT = 'Next';
export const TUTORIAL_BACK = 'Back';
export const TUTORIAL_DONE = 'Got it';
export const stepCounter = (index: number, total: number) => `${index + 1} of ${total}`;

/** Order of players: the one-line how-to on the screen itself, and the button that opens the steps. */
export const ORDER_ONE_LINE = 'Tap players from the highest card to the lowest.';
export const SHOW_ME = 'Show me';
/** Help › Order of players: the button under the section. */
export const WATCH_HOW = 'Watch how (20 s)';

export const SEATING_TUTORIAL_TITLE = 'How to seat the table';

export const SEATING_STEPS: readonly TutorialStep[] = [
  { title: 'Everyone draws a card', line: 'One card each. The highest card gets the first open card; the lowest card deals.' },
  { title: 'Tap the highest card first', line: 'Tap the highest card first, then the next one down… all the way to the lowest.' },
  { title: 'The last tap deals', line: 'The lowest card is the last tap: that player deals round 1. Everyone numbered → Next.' },
  { title: 'Wrong tap? Fix it', line: 'Tap the latest player again to take it back. Once everyone is numbered, the arrows move a player one seat.' },
];

/** The toast on the real last tap (once per person): the dealer by name, or "you" when it is the signed-in player. */
export const lowestCardToast = (name: string, isYou: boolean) => (isYou ? 'Lowest card — you deal round 1' : `Lowest card — ${name} deals round 1`);

/** The demo's cast: four fixed players with the card each drew, so the loop reads the same for everyone. */
export type DemoPlayer = { id: string; name: string; label: string; card: string; red: boolean };
export const DEMO_PLAYERS: readonly DemoPlayer[] = [
  { id: 'anu', name: 'Anu', label: 'AN', card: 'K♠', red: false },
  { id: 'dev', name: 'Dev', label: 'DE', card: '2♦', red: true },
  { id: 'bala', name: 'Bala', label: 'BA', card: '7♣', red: false },
  { id: 'chitra', name: 'Chitra', label: 'CH', card: '4♥', red: true },
];
const DEMO_IDS = DEMO_PLAYERS.map((player) => player.id);
/** Highest card to lowest: K♠ Anu, 7♣ Bala, 4♥ Chitra, 2♦ Dev. */
export const DEMO_TAP_ORDER = ['anu', 'bala', 'chitra', 'dev'] as const;

export type DemoFrame = {
  draft: OrderDraft;
  /** The row the finger is on (a player id), if any. */
  finger?: string;
  /** Show the drawn cards on the rows. */
  cards: boolean;
};

/** Every frame shows for about this long; a step's frames then loop. */
export const DEMO_FRAME_MS = 900;

const empty = () => startOrder(DEMO_IDS);
function tapped(count: number): OrderDraft {
  let draft = empty();
  for (const id of DEMO_TAP_ORDER.slice(0, count)) draft = tapPlayer(draft, id);
  return draft;
}

/** The frames for one step of the Order of players tutorial. */
export function seatingDemoFrames(step: number): DemoFrame[] {
  switch (step) {
    case 0:
      // The cards turn up one at a time.
      return [
        { draft: empty(), cards: false },
        { draft: empty(), cards: true },
        { draft: empty(), cards: true },
      ];
    case 1:
      // Highest card first: K, then 7, then 4; each tap moves the player up under the last.
      return [
        { draft: empty(), cards: true },
        { draft: tapped(1), finger: 'anu', cards: true },
        { draft: tapped(1), cards: true },
        { draft: tapped(2), finger: 'bala', cards: true },
        { draft: tapped(2), cards: true },
        { draft: tapped(3), finger: 'chitra', cards: true },
        { draft: tapped(3), cards: true },
      ];
    case 2:
      // The lowest card is the last tap, lands at the bottom and deals.
      return [
        { draft: tapped(3), cards: true },
        { draft: tapped(4), finger: 'dev', cards: true },
        { draft: tapped(4), cards: true },
        { draft: tapped(4), cards: true },
      ];
    default: {
      // Take the latest tap back, then move a player with an arrow.
      const full = tapped(4);
      return [
        { draft: full, cards: false },
        { draft: tapPlayer(full, 'dev'), finger: 'dev', cards: false },
        { draft: tapped(3), cards: false },
        { draft: full, cards: false },
        { draft: stepNumbered(full, 'chitra', 1), finger: 'chitra', cards: false },
        { draft: stepNumbered(full, 'chitra', 1), cards: false },
      ];
    }
  }
}
