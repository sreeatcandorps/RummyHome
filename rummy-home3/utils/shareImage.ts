import { Platform, Share, View } from 'react-native';
import { ShareCard, ShareLine } from '@/utils/shareCard';
import { placeLine, ScorecardSheet } from '@/utils/scorecardSheet';
import { CELLS_PER_ROW, FINAL_SCORES_FILE, FinalScoresSheet } from '@/utils/finalScoresSheet';

export const IMAGE_READY = 'Image ready.';

const CARD_W = 720;
const CARD_PAD = 24;
const INNER_PAD = 28;
const FRAME = '#15803D';
const ON_FRAME = '#FFFFFF';
const INK = '#17201B';
const MUTED = '#4E5752';
const LINE = '#DCDDD5';
const NEG = '#A8201A';
const NOTE_BG = '#FFE38A';
const ON_NOTE = '#3F2D00';
const MEDAL: Record<1 | 2 | 3, { bg: string; fg: string }> = {
  1: { bg: '#F6C84C', fg: '#3F2D00' },
  2: { bg: '#D9DCE0', fg: '#2B3036' },
  3: { bg: '#D99A66', fg: '#3B1D08' },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/…$/, '')}…`;
    return kept;
  }
  return lines;
}

/** Height of one scores line: two name lines at most, plus the sub line. */
function lineHeight(ctx: CanvasRenderingContext2D, line: ShareLine, nameWidth: number): number {
  ctx.font = '700 22px sans-serif';
  const names = wrapText(ctx, line.name, nameWidth, 2).length;
  return 12 + names * 26 + (line.sub ? 18 : 0);
}

/**
 * Web twin of ShareCardView: green frame, white card, the scores in two columns with
 * drawn medals, the games line, who generated it, and the link in the frame's foot.
 */
export function drawShareCard(card: ShareCard): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('Could not make the image.');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not make the image.');
  canvas.width = CARD_W;

  const cardX = CARD_PAD;
  const cardW = CARD_W - CARD_PAD * 2;
  const colGap = 20;
  const colW = (cardW - INNER_PAD * 2 - colGap) / 2;
  const nameWidth = colW - 96;

  // Measure first so the canvas is exactly as tall as the content.
  ctx.font = '600 14px sans-serif';
  const noteLines = (card.notes ?? []).map((note) => wrapText(ctx, note, cardW - INNER_PAD * 2 - 20, 3));
  const notesH = noteLines.reduce((sum, lines) => sum + lines.length * 18 + 16, 0);
  const colH = (lines: ShareLine[]) => (lines.length === 0 ? 34 : lines.reduce((sum, line) => sum + lineHeight(ctx, line, nameWidth), 0));
  const columnsH = Math.max(colH(card.positive), colH(card.negative));
  ctx.font = '600 16px sans-serif';
  const gamesLines = card.gamesLine ? wrapText(ctx, card.gamesLine, cardW - INNER_PAD * 2, 3) : [];
  const tailH = (card.evenLine ? 24 : 0) + (card.moreLine ? 24 : 0) + (gamesLines.length ? gamesLines.length * 22 + 10 : 0) + (card.generatedBy ? 22 : 0);
  const headH = 56;
  const cardTop = headH;
  const cardH = INNER_PAD + 40 + (card.summary ? 30 : 0) + notesH + 12 + columnsH + 12 + tailH + INNER_PAD;
  const footH = card.footer || card.link ? 44 : 20;
  canvas.height = Math.max(360, cardTop + cardH + footH + CARD_PAD);

  const paint = (text: string, x: number, y: number, color: string, font: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
  };
  const roundRect = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  // Frame and header.
  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  paint(card.brand, CARD_PAD + 6, 36, ON_FRAME, '800 24px sans-serif');
  ctx.font = '600 16px sans-serif';
  const dateText = ctx.measureText(card.date).width > cardW / 2 ? wrapText(ctx, card.date, cardW / 2, 1)[0] : card.date;
  paint(dateText, CARD_W - CARD_PAD - 6, 36, 'rgba(255,255,255,0.85)', '600 16px sans-serif', 'right');

  // Card.
  roundRect(cardX, cardTop, cardW, cardH, 18, '#FFFFFF');
  let y = cardTop + INNER_PAD + 30;
  const left = cardX + INNER_PAD;
  const right = cardX + cardW - INNER_PAD;
  paint(card.title, left, y, INK, '800 34px sans-serif');
  if (card.code) paint(card.code, right, y, MUTED, '600 18px sans-serif', 'right');
  y += 10;
  if (card.summary) {
    y += 26;
    paint(card.summary, left, y, INK, '700 20px sans-serif');
    y += 4;
  }
  noteLines.forEach((lines) => {
    y += 8;
    const h = lines.length * 18 + 8;
    roundRect(left, y, cardW - INNER_PAD * 2, h, 8, NOTE_BG);
    lines.forEach((line, index) => paint(line, left + 10, y + 18 + index * 18, ON_NOTE, '600 14px sans-serif'));
    y += h;
  });
  y += 12;

  const drawColumn = (lines: ShareLine[], x: number) => {
    let cy = y;
    if (lines.length === 0) {
      paint('None', x, cy + 22, MUTED, '600 16px sans-serif');
      return;
    }
    lines.forEach((line) => {
      const h = lineHeight(ctx, line, nameWidth);
      ctx.font = '700 22px sans-serif';
      const names = wrapText(ctx, line.name, nameWidth, 2);
      let nameX = x;
      let textY = cy + 26;
      if (line.medal) {
        const medal = MEDAL[line.medal];
        ctx.fillStyle = medal.bg;
        ctx.beginPath();
        ctx.arc(x + 12, textY - 8, 12, 0, Math.PI * 2);
        ctx.fill();
        paint(String(line.medal), x + 12, textY - 3, medal.fg, '800 14px sans-serif', 'center');
        nameX = x + 30;
      }
      names.forEach((name, index) => paint(name, nameX, textY + index * 26, INK, '700 22px sans-serif'));
      const middle = cy + h / 2 + 9;
      paint(line.points, x + colW, middle, line.points.startsWith('-') ? NEG : INK, '800 26px sans-serif', 'right');
      if (line.sub) paint(line.sub, x, textY + (names.length - 1) * 26 + 18, MUTED, '600 14px sans-serif');
      cy += h;
      ctx.fillStyle = LINE;
      ctx.fillRect(x, cy - 1, colW, 1);
    });
  };
  drawColumn(card.positive, left);
  drawColumn(card.negative, left + colW + colGap);
  y += columnsH + 12;

  const centre = cardX + cardW / 2;
  if (card.evenLine) { y += 18; paint(card.evenLine, left, y, MUTED, '600 15px sans-serif'); y += 6; }
  if (card.moreLine) { y += 18; paint(card.moreLine, centre, y, MUTED, '600 15px sans-serif', 'center'); y += 6; }
  if (gamesLines.length) {
    y += 10;
    gamesLines.forEach((line) => { y += 20; paint(line, centre, y, MUTED, '600 16px sans-serif', 'center'); });
    y += 2;
  }
  if (card.generatedBy) { y += 20; paint(card.generatedBy, centre, y, MUTED, '600 15px sans-serif', 'center'); }

  const foot = [card.footer, card.link ? `Full details · ${card.link}` : null].filter(Boolean).join('   ');
  if (foot) paint(foot, centre, cardTop + cardH + 30, ON_FRAME, '700 16px sans-serif', 'center');
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
