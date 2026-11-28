import { deselect, OrderDraft, startOrder, stepNumbered, tapRing } from '@/utils/seating';

/**
 * Short step-by-step tutorials (D61, Sree Nov 19–20: "show each step clearly, maybe a small video …
 * a 3-step, 4-step, and they click Next, Next, Next"). One sheet, N steps, each step a looping demo of
 * the real circle (D138) plus one line of text. The first one is the Order of players; the strings and the demo
 * script live here so the sheet and the tests agree. D74 (Nov 23): three steps, never opens by itself,
 * no card pictures ("in some places even Joker is highest").
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
  { title: 'Tap the highest card first', line: 'Tap the highest card first, then the next one down… the last tap is the lowest card and deals round 1.' },
  { title: 'Wrong tap? Fix it', line: 'Tap the latest player again to take it back. Once everyone is numbered, tap a player and use ▲ ▼ to move them.' },
];

/** The toast on the real last tap (once per person): the dealer by name, or "you" when it is the signed-in player. */
export const lowestCardToast = (name: string, isYou: boolean) => (isYou ? 'Lowest card — you deal round 1' : `Lowest card — ${name} deals round 1`);

/** The demo's cast: four fixed players; `card` is what each drew — it orders the script, it is never drawn (D74). */
export type DemoPlayer = { id: string; name: string; label: string; card: string };
export const DEMO_PLAYERS: readonly DemoPlayer[] = [
  { id: 'anu', name: 'Anu', label: 'AN', card: 'K♠' },
  { id: 'dev', name: 'Dev', label: 'DE', card: '2♦' },
  { id: 'bala', name: 'Bala', label: 'BA', card: '7♣' },
  { id: 'chitra', name: 'Chitra', label: 'CH', card: '4♥' },
];
const DEMO_IDS = DEMO_PLAYERS.map((player) => player.id);
/** Highest card to lowest: K♠ Anu, 7♣ Bala, 4♥ Chitra, 2♦ Dev. */
export const DEMO_TAP_ORDER = ['anu', 'bala', 'chitra', 'dev'] as const;

export type DemoFrame = {
  draft: OrderDraft;
  /** Where the finger is: a player's disc (his id), or his ▲ in the middle (`'up'`). */
  finger?: string;
  /** The player the middle names after a tap, as on the screen (two seconds there, one frame here). */
  flash?: string;
};

/** Every frame shows for about this long; a step's frames then loop. */
export const DEMO_FRAME_MS = 900;

const empty = () => startOrder(DEMO_IDS);
function tapped(count: number): OrderDraft {
  let draft = empty();
  for (const id of DEMO_TAP_ORDER.slice(0, count)) draft = tapRing(draft, id);
  return draft;
}

/** The frames for one step of the Order of players tutorial, on the circle's own tap rules (`tapRing`). */
export function seatingDemoFrames(step: number): DemoFrame[] {
  switch (step) {
    case 0:
      // Four players round the table, nobody numbered yet.
      return [{ draft: empty() }, { draft: empty() }, { draft: empty() }];
    case 1: {
      // Highest card first: K, then 7, then 4, then the 2. Each disc goes to its seat — the K at the top, the
      // rest anticlockwise — and the last tap, one step right of the top, deals.
      const frames: DemoFrame[] = [{ draft: empty() }];
      DEMO_TAP_ORDER.forEach((id, i) => {
        frames.push({ draft: tapped(i), finger: id }, { draft: tapped(i + 1), flash: id });
      });
      frames.push({ draft: tapped(4) });
      return frames;
    }
    default: {
      // Take the latest tap back; then, everyone numbered, select a player, move them with ▲, let go.
      const full = tapped(4);
      const selected = tapRing(full, 'chitra');
      const moved = stepNumbered(selected, 'chitra', 1);
      return [
        { draft: tapped(3) },
        { draft: tapped(3), finger: 'chitra' },
        { draft: tapped(2), flash: 'chitra' },
        { draft: full },
        { draft: full, finger: 'chitra' },
        { draft: selected, finger: 'up' },
        { draft: moved },
        { draft: moved, finger: 'chitra' },
        { draft: deselect(moved) },
      ];
    }
  }
}
