import { Platform, Share, View } from 'react-native';
import { ShareCard } from '@/utils/shareCard';
import { legendLines, ShareBreakdown } from '@/utils/resultsLayout';
import { placeLabel } from '@/utils/results';
import { placeLine, ScorecardSheet } from '@/utils/scorecardSheet';
import { CELLS_PER_ROW, FINAL_SCORES_FILE, FinalScoresSheet } from '@/utils/finalScoresSheet';

export const IMAGE_READY = 'Image ready.';

const CARD_W = 720;
const CARD_PAD = 36;
const CARD_FELT = '#17402F';
const CARD_GOLD = '#E3B341';
const CARD_CREAM = '#FBF1E1';
const CARD_POS = '#B7E4C7';
const CARD_NEG = '#F2B8B5';

function pointsColor(text: string): string {
  if (text === '—') return 'rgba(251,241,225,0.5)';
  return text.startsWith('-') ? CARD_NEG : CARD_POS;
}

/** Row height and type size of the by-game grid. Bands hold at most six columns (five games + Total). */
function gridMetrics(grid: ShareBreakdown) {
  const colCount = Math.max(1, ...grid.bands.map((band) => band.columns.length));
  const headW = 90;
  const avail = CARD_W - CARD_PAD * 2 - headW;
  const colW = Math.max(30, Math.min(96, Math.floor(avail / colCount)));
  const font = grid.dense || colW < 44 ? 15 : 18;
  const rowH = font + 10;
  const rows = grid.bands.reduce((sum, band) => sum + band.rows.length + 1, 0);
  return { headW, colW, font, rowH, rows, bandGap: 14, legend: legendLines(grid.legend) };
}

/**
 * Web twin of ShareCardView: brand, title, date, summary, totals with crowns,
 * the by-game grid (every game), the legend, and the footer with the result id.
 */
export function drawShareCard(card: ShareCard): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('Could not make the image.');
  const grid = card.breakdown ?? null;
  const metrics = grid ? gridMetrics(grid) : null;
  const headerH = 200 + (card.summary ? 30 : 0);
  const podiumH = card.podiumFirst ? card.places.length * 44 + (card.lines.length > 0 ? 36 : 0) : 0;
  const hasSub = card.lines.some((line) => line.sub);
  const lineH = hasSub ? 52 : 40;
  const linesH = card.lines.length * lineH + (card.moreCount > 0 ? 36 : 0);
  const gridH = grid && metrics ? 52 + metrics.rows * metrics.rowH + (grid.bands.length - 1) * metrics.bandGap + metrics.legend.length * 20 + 24 : 0;
  const noteH = card.breakdownNote ? 30 : 0;
  const placesH = !card.podiumFirst ? card.places.length * 36 : 0;
  const footerH = card.footer ? 56 : 24;
  const height = headerH + podiumH + linesH + gridH + noteH + placesH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = Math.max(height, 360);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not make the image.');
  const paint = (text: string, x: number, y: number, color: string, font: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  };
  const rule = (y: number) => {
    ctx.fillStyle = 'rgba(227,179,65,0.7)';
    ctx.fillRect(CARD_PAD, y, CARD_W - CARD_PAD * 2, 2);
  };
  const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

  ctx.fillStyle = CARD_FELT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paint(card.brand, CARD_PAD, 60, CARD_GOLD, '800 22px sans-serif');
  paint(clip(card.title, 32), CARD_PAD, 108, CARD_CREAM, '800 36px sans-serif');
  paint(clip(card.date, 40), CARD_PAD, 144, CARD_CREAM, '600 22px sans-serif');
  let y = 160;
  if (card.summary) {
    paint(clip(card.summary, 40), CARD_PAD, 174, CARD_CREAM, '600 22px sans-serif');
    y += 30;
  }
  rule(y);
  y += 40;

  const drawLine = (line: { name: string; points: string; place?: number; sub?: string }) => {
    const hasBadges = card.lines.some((item) => item.place != null);
    let x = CARD_PAD;
    if (hasBadges) {
      if (line.place != null) paint(`♛ ${placeLabel(line.place)}`, x, y, CARD_GOLD, '800 18px sans-serif');
      x += 84;
    }
    paint(clip(line.name, 26), x, y, CARD_CREAM, '600 24px sans-serif');
    paint(line.points, CARD_W - CARD_PAD, y, pointsColor(line.points), '800 24px sans-serif', 'right');
    if (line.sub) paint(clip(line.sub, 30), x, y + 18, 'rgba(251,241,225,0.75)', '600 14px sans-serif');
    y += lineH;
  };
  if (card.podiumFirst) {
    card.places.forEach((place) => {
      paint(clip(`${place.label}  ${place.names}  ${place.points}`, 42), CARD_PAD, y, CARD_CREAM, '800 28px sans-serif');
      y += 44;
    });
    if (card.lines.length > 0) {
      paint('Totals', CARD_PAD, y, CARD_GOLD, '700 22px sans-serif');
      y += 36;
    }
  }
  card.lines.forEach(drawLine);
  if (card.moreCount > 0) {
    paint(`and ${card.moreCount} more`, CARD_PAD, y, CARD_GOLD, '700 22px sans-serif');
    y += 36;
  }

  if (grid && metrics) {
    rule(y - 20);
    paint('By game', CARD_PAD, y + 6, CARD_GOLD, '700 18px sans-serif');
    y += 30;
    const { headW, colW, font, rowH, bandGap } = metrics;
    const cellX = (index: number) => CARD_PAD + headW + colW * (index + 1);
    grid.bands.forEach((band, bandIndex) => {
      if (bandIndex > 0) {
        ctx.fillStyle = 'rgba(227,179,65,0.7)';
        ctx.fillRect(CARD_PAD, y - rowH + 10, CARD_W - CARD_PAD * 2, 1);
        y += bandGap;
      }
      paint('Player', CARD_PAD, y, 'rgba(251,241,225,0.8)', `700 ${font - 2}px sans-serif`);
      band.columns.forEach((column, index) => {
        paint(column, cellX(index), y, 'rgba(251,241,225,0.8)', `700 ${font - 2}px sans-serif`, 'right');
      });
      y += rowH;
      band.rows.forEach((row) => {
        paint(row.head, CARD_PAD, y, CARD_CREAM, `600 ${font}px sans-serif`);
        row.cells.forEach((cell, index) => {
          const isTotal = band.hasTotal && index === row.cells.length - 1;
          paint(cell, cellX(index), y, pointsColor(cell), `${isTotal ? '800' : '600'} ${font}px sans-serif`, 'right');
        });
        y += rowH;
      });
    });
    metrics.legend.forEach((line) => {
      paint(line, CARD_PAD, y, 'rgba(251,241,225,0.75)', '600 13px sans-serif');
      y += 20;
    });
    y += 10;
  }
  if (card.breakdownNote) {
    paint(card.breakdownNote, CARD_PAD, y, CARD_GOLD, '700 16px sans-serif');
    y += 30;
  }
  if (!card.podiumFirst) {
    card.places.forEach((place) => {
      paint(clip(`${place.label}  ${place.names}  ${place.points}`, 48), CARD_PAD, y, CARD_CREAM, '700 22px sans-serif');
      y += 36;
    });
  }
  if (card.footer) {
    rule(y - 12);
    paint(card.footer, CARD_PAD, y + 22, CARD_GOLD, '700 16px sans-serif');
  }
  return canvas;
}

async function shareWeb(card: ShareCard): Promise<string> {
  const url = drawShareCard(card).toDataURL('image/png');
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'ez-score-results.png', { type: 'image/png' });
      const data: ShareData = { files: [file], title: 'EZ Score: Rummy', text: card.title };
      if (!nav.canShare || nav.canShare(data)) {
        await nav.share(data);
        return IMAGE_READY;
      }
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'AbortError') return IMAGE_READY;
    }
  }
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ez-score-results.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return IMAGE_READY;
}

async function shareNative(view: View | null, card: ShareCard): Promise<string> {
  if (!view) throw new Error('Could not make the image.');
  const { captureRef } = await import('react-native-view-shot');
  const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: card.brand, UTI: 'public.png' });
    return IMAGE_READY;
  }
  await Share.share({ url: uri, title: card.brand });
  return IMAGE_READY;
}

function drawScorecard(sheet: ScorecardSheet): string {
  if (typeof document === 'undefined') throw new Error('Could not make the image.');
  const colW = 96;
  const labelW = 64;
  const pad = 28;
  const width = Math.max(680, pad * 2 + labelW + sheet.columns.length * colW);
  const headerH = 148;
  const rowH = 42;
  const height = headerH + 16 + rowH + sheet.rounds.length * rowH + 36 + sheet.places.length * 40 + 32;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 420);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not make the image.');

  ctx.fillStyle = '#F7F1E6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#14382A';
  ctx.fillRect(0, 0, canvas.width, headerH);
  ctx.fillStyle = '#E3B341';
  ctx.fillRect(pad, 78, 72, 3);

  ctx.fillStyle = '#E3B341';
  ctx.font = '700 16px sans-serif';
  ctx.fillText('EZ SCORE: RUMMY', pad, 58);
  ctx.fillStyle = '#FBF1E1';
  ctx.font = '800 40px sans-serif';
  ctx.fillText(sheet.heading.slice(0, 18), pad, 118);
  ctx.font = '600 18px sans-serif';
  ctx.fillText(`${sheet.when}  ·  ${sheet.status}`.slice(0, 48), pad + 180, 112);

  const tableX = pad;
  const tableY = headerH + 16;
  const tableW = labelW + sheet.columns.length * colW;
  const tableH = rowH + sheet.rounds.length * rowH;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(tableX, tableY, tableW, tableH);
  ctx.strokeStyle = '#E7E0D4';
  ctx.strokeRect(tableX, tableY, tableW, tableH);

  const paint = (text: string, x: number, y: number, color: string, weight: string, align: CanvasTextAlign = 'center') => {
    ctx.fillStyle = color;
    ctx.font = `${weight} 16px sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  };

  paint('Rnd', tableX + labelW / 2, tableY + 26, '#5C6560', '700');
  sheet.columns.forEach((column, index) => {
    const x = tableX + labelW + index * colW + colW / 2;
    paint(column.label, x, tableY + 18, '#14382A', '800');
    paint(column.totalText, x, tableY + 36, column.total < 0 ? '#8C2F2F' : '#0E7A43', '800');
  });

  sheet.rounds.forEach((round, rowIndex) => {
    const y = tableY + rowH + rowIndex * rowH;
    if (rowIndex % 2 === 0) {
      ctx.fillStyle = '#FBF8F2';
      ctx.fillRect(tableX + 1, y, tableW - 2, rowH);
    }
    paint(String(round.round), tableX + labelW / 2, y + 26, '#1B1F1C', '700');
    round.cells.forEach((cell, index) => {
      const x = tableX + labelW + index * colW + colW / 2;
      const color = cell.sign === 'pos' ? '#0E7A43' : cell.sign === 'neg' ? '#8C2F2F' : '#1B1F1C';
      paint(cell.text, x, y + 26, color, '700');
    });
  });

  let y = tableY + tableH + 36;
  ctx.fillStyle = '#E3B341';
  ctx.fillRect(pad, y - 18, 48, 3);
  sheet.places.forEach((place) => {
    ctx.fillStyle = '#14382A';
    ctx.font = '800 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(placeLine(place), pad, y);
    y += 40;
  });
  ctx.fillStyle = '#5C6560';
  ctx.font = '600 14px sans-serif';
  ctx.fillText(sheet.totalSum === 0 ? 'Totals add to 0' : `Totals add to ${sheet.totalSum}`, pad, y);

  return canvas.toDataURL('image/png');
}

async function shareDrawnImage(dataUrl: string, filename: string, title: string): Promise<string> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      const data: ShareData = { files: [file], title, text: title };
      if (!nav.canShare || nav.canShare(data)) {
        await nav.share(data);
        return IMAGE_READY;
      }
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'AbortError') return IMAGE_READY;
    }
  }
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return IMAGE_READY;
}

/** Opens the device share sheet with the public scorecard link. */
export async function shareLiveScorecard(url: string): Promise<'shared' | 'copied'> {
  try {
    await Share.share({ title: 'EZ Score: Rummy', message: url, url });
    return 'shared';
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return 'shared';
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
    throw error instanceof Error ? error : new Error('Could not share the link.');
  }
}

/** A picture of the whole scorecard. Web draws it. The phone captures the same layout. */
export async function shareScorecardImage(sheet: ScorecardSheet, view: View | null): Promise<string> {
  try {
    if (Platform.OS === 'web') return await shareDrawnImage(drawScorecard(sheet), 'ez-score-rummy.png', sheet.brand);
    if (!view) throw new Error('Could not make the image.');
    const { captureRef } = await import('react-native-view-shot');
    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: sheet.brand, UTI: 'public.png' });
      return IMAGE_READY;
    }
    await Share.share({ url: uri, title: sheet.brand });
    return IMAGE_READY;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return IMAGE_READY;
    throw error instanceof Error ? error : new Error('Could not make the image.');
  }
}

/** A picture for WhatsApp or a text. Web draws the card. The phone captures the same card. */
export async function shareCardImage(view: View | null, card: ShareCard): Promise<string> {
  try {
    if (Platform.OS === 'web') return await shareWeb(card);
    return await shareNative(view, card);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return IMAGE_READY;
    throw error instanceof Error ? error : new Error('Could not make the image.');
  }
}

/** Same geometry as FinalScoresView, drawn on a canvas for the web build. */
export function drawFinalScores(sheet: FinalScoresSheet): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('Could not make the image.');
  const width = 720;
  const pad = 24;
  const cell = Math.floor((width - pad * 2 - 32 - (CELLS_PER_ROW - 1) * 8) / CELLS_PER_ROW);
  const headerH = 150;
  const summaryH = 16 + 16 + 24 + sheet.summary.length * 34 + 28 + 16;
  const playerH = (player: FinalScoresSheet['players'][number]) => 16 + 16 + 34 + player.rows.length * (cell + 8) + 16;
  const height = headerH + summaryH + sheet.players.reduce((sum, player) => sum + playerH(player), 0) + 70 + sheet.adminLines.length * 20;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 420);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not make the image.');

  const paint = (text: string, x: number, y: number, color: string, font: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  };
  const roundRect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  };
  const tone = (sign: 'pos' | 'neg' | 'zero') =>
    sign === 'pos' ? { fg: '#0E7A43', bg: '#E3F4E8' } : sign === 'neg' ? { fg: '#8C2F2F', bg: '#FBE7E6' } : { fg: '#1B1F1C', bg: '#F4F1EA' };
  const totalColor = (total: number) => (total < 0 ? '#8C2F2F' : total > 0 ? '#0E7A43' : '#1B1F1C');

  ctx.fillStyle = '#FFF8E6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#F2C14E';
  ctx.fillRect(0, 0, width, headerH);
  paint('EZ SCORE: RUMMY', pad, 40, '#5A4A10', '700 15px sans-serif');
  paint(sheet.heading.slice(0, 30), pad, 84, '#2E2300', '800 34px sans-serif');
  paint(sheet.startedLine, pad, 112, '#5A4A10', '600 15px sans-serif');
  paint(sheet.completedLine, pad, 134, '#5A4A10', '600 15px sans-serif');

  let y = headerH + 16;
  const blockX = pad;
  const blockW = width - pad * 2;

  roundRect(blockX, y, blockW, summaryH - 16, 14, '#FFFFFF', '#EADFC2');
  paint('TOTALS', blockX + 16, y + 30, '#6B6455', '800 13px sans-serif');
  let rowY = y + 30 + 34;
  sheet.summary.forEach((row) => {
    paint(row.name.slice(0, 28), blockX + 16, rowY, '#1B1F1C', '700 20px sans-serif');
    paint(row.totalText, blockX + blockW - 16, rowY, totalColor(row.total), '800 22px sans-serif', 'right');
    rowY += 34;
  });
  paint(
    `${sheet.roundCount === 1 ? '1 round' : `${sheet.roundCount} rounds`} · ${sheet.totalSum === 0 ? 'Totals add to 0' : `Totals add to ${sheet.totalSum}`}`,
    blockX + 16,
    rowY + 2,
    '#6B6455',
    '600 13px sans-serif',
  );
  y += summaryH;

  sheet.players.forEach((player) => {
    const h = playerH(player) - 16;
    roundRect(blockX, y, blockW, h, 14, '#FFFFFF', '#EADFC2');
    paint(player.name.slice(0, 28), blockX + 16, y + 36, '#1B1F1C', '800 18px sans-serif');
    paint(player.totalText, blockX + blockW - 16, y + 36, totalColor(player.total), '800 20px sans-serif', 'right');
    let cellY = y + 52;
    player.rows.forEach((row) => {
      row.forEach((c, index) => {
        const x = blockX + 16 + index * (cell + 8);
        const t = tone(c.sign);
        roundRect(x, cellY, cell, cell, 10, t.bg);
        paint(`R${c.round}`, x + cell / 2, cellY + 22, '#6B6455', '700 12px sans-serif', 'center');
        paint(c.text, x + cell / 2, cellY + cell / 2 + 14, t.fg, '800 22px sans-serif', 'center');
      });
      cellY += cell + 8;
    });
    y += playerH(player);
  });

  sheet.adminLines.forEach((line) => {
    paint(line.slice(0, 90), pad, y + 24, '#6B6455', '600 13px sans-serif');
    y += 20;
  });
  paint(sheet.footer, pad, y + 24, '#6B6455', '600 13px sans-serif');
  paint(sheet.generatedLine, pad, y + 44, '#6B6455', '600 13px sans-serif');
  return canvas;
}

/** The long "Final scores" picture of one game. Web draws it; the phone captures the same layout. */
export async function shareFinalScoresImage(sheet: FinalScoresSheet, view: View | null): Promise<string> {
  try {
    if (Platform.OS === 'web') return await shareDrawnImage(drawFinalScores(sheet).toDataURL('image/png'), FINAL_SCORES_FILE, sheet.heading);
    if (!view) throw new Error('Could not make the image.');
    const { captureRef } = await import('react-native-view-shot');
    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile' });
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: sheet.heading, UTI: 'public.png' });
      return IMAGE_READY;
    }
    await Share.share({ url: uri, title: sheet.heading });
    return IMAGE_READY;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return IMAGE_READY;
    throw error instanceof Error ? error : new Error('Could not make the image.');
  }
}
