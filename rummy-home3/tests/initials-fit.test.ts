import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cellFontSize,
  columnLayout,
  effectiveFontScale,
  estimateTextWidth,
  fitInitialsFontSize,
  headerType,
  INITIALS_LETTER_SPACING,
  INITIALS_MIN_FONT,
  initialsWidthIn,
  MIN_COLUMN_WIDTH,
  TABLE_MAX_FONT_SCALE,
} from '../utils/scorecardLayout';

// F13.22 (Sree, Nov 14): initials are never cut off — in the scorecard header, the avatars on
// Standings / Awards, anywhere. The header and SeatAvatar size their label with
// fitInitialsFontSize; these tests pin the width math for the widest labels a player can have.

const WIDEST = ['WWW', 'MMM', 'WMW', 'MWM', 'WWM', 'MMW', 'W88', 'M00', 'WW9'];
const fits = (label: string, available: number, size: number, scale: number) =>
  estimateTextWidth(label, size * scale, INITIALS_LETTER_SPACING) <= available;

test('13.22 every three-letter label fits every column width the table can produce, at every font scale', () => {
  for (let columnWidth = MIN_COLUMN_WIDTH; columnWidth <= 140; columnWidth += 1) {
    const base = headerType(columnWidth).initials.fontSize;
    for (const fontScale of [1, 1.1, 1.2, 1.5, 2]) {
      const scale = effectiveFontScale(fontScale);
      for (const label of WIDEST) {
        const size = fitInitialsFontSize(label, initialsWidthIn(columnWidth), base, scale);
        assert.ok(size >= INITIALS_MIN_FONT, `${label} at ${columnWidth} dp ×${scale}: font ${size} under the floor`);
        assert.ok(size <= base, 'the fit never grows the font');
        assert.ok(fits(label, initialsWidthIn(columnWidth), size, scale), `${label} at ${columnWidth} dp ×${scale} would clip at ${size} pt`);
      }
    }
  }
});

test('13.22 the narrowest column (20 players on a phone) still reads WWW at 9 pt or better', () => {
  const { columnWidth } = columnLayout(412, 20, false);
  assert.equal(columnWidth, MIN_COLUMN_WIDTH, '20 columns on a 412 dp phone hit the minimum and scroll sideways');
  const base = headerType(columnWidth).initials.fontSize;
  const atMax = fitInitialsFontSize('WWW', initialsWidthIn(columnWidth), base, TABLE_MAX_FONT_SCALE);
  assert.ok(atMax >= 9, `WWW on a 38 dp column at the largest table font scale: ${atMax} pt`);
  // Two ordinary letters still get the full header size: the fit only steps down when it must.
  assert.equal(fitInitialsFontSize('TA', initialsWidthIn(columnWidth), base, 1), base);
  assert.equal(fitInitialsFontSize('SK', initialsWidthIn(80), headerType(80).initials.fontSize, TABLE_MAX_FONT_SCALE), headerType(80).initials.fontSize);
});

test('13.22 avatars: WWW fits the chord of every avatar size the app draws (26, 30, 32, 40)', () => {
  for (const size of [26, 30, 32, 40]) {
    const base = Math.round(size * 0.34);
    const font = fitInitialsFontSize('WWW', size * 0.9, base);
    assert.ok(font >= INITIALS_MIN_FONT, `avatar ${size}: font ${font}`);
    assert.ok(fits('WWW', size * 0.9, font, 1), `avatar ${size}: WWW would clip at ${font} pt`);
  }
});

test('13.22 the estimate is wide-glyph aware and monotone in font size', () => {
  assert.ok(estimateTextWidth('WWW', 12) > estimateTextWidth('TAB', 12), 'W is wider than ordinary capitals');
  assert.ok(estimateTextWidth('III', 12) < estimateTextWidth('TAB', 12), 'I is narrower');
  assert.ok(estimateTextWidth('WWW', 13) > estimateTextWidth('WWW', 12));
  assert.equal(estimateTextWidth('', 12), 0);
  assert.equal(estimateTextWidth('AB', 10, 1), estimateTextWidth('AB', 10) + 1, 'letter spacing goes between glyphs only');
  assert.equal(cellFontSize(MIN_COLUMN_WIDTH), 13);
});
