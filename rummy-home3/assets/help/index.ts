import { ImageSourcePropType } from 'react-native';

/**
 * Annotated screenshots for the help pages (docs/help-design.md Q11.3a). Built by
 * scripts/help-screenshots.mjs from a CI smoke run's screens; keys are HelpTopic.screenshot.file.
 * A topic whose picture is not here yet shows its legend alone.
 */
export const HELP_SCREENSHOTS: Partial<Record<string, ImageSourcePropType>> = {
  'home': require('./home.png'),
  'new-game': require('./new-game.png'),
  'game-type': require('./game-type.png'),
  'scorecard': require('./scorecard.png'),
  'add-round': require('./add-round.png'),
  'final-scores': require('./final-scores.png'),
  'complete': require('./complete.png'),
  'awards': require('./awards.png'),
  'game-log': require('./game-log.png'),
  'results': require('./results.png'),
  'my-players': require('./my-players.png'),
  'add-players': require('./add-players.png'),
  'me': require('./me.png'),
  'settings': require('./settings.png'),
};
