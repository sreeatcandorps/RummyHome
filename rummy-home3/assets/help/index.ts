import { ImageSourcePropType } from 'react-native';

/**
 * Annotated screenshots for the help pages, keyed by HelpTopic.screenshot.file. Built by
 * `node scripts/help-screenshots.mjs <smoke-artifact-dir>` from the CI smoke run (light theme).
 * A topic whose file is missing here simply shows its legend without a picture.
 */
export const HELP_SCREENSHOTS: Partial<Record<string, ImageSourcePropType>> = {};
