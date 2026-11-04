import { Platform, Share, View } from 'react-native';
import { ShareCard } from '@/utils/shareCard';
import { placeLine, ScorecardSheet } from '@/utils/scorecardSheet';

export const IMAGE_READY = 'Image ready.';

function drawShareCard(card: ShareCard): string {
  if (typeof document === 'undefined') throw new Error('Could not make the image.');
  const width = 720;
  const podiumExtra = card.podiumFirst ? card.places.length * 44 + (card.lines.length > 0 ? 36 : 0) : card.places.length * 36;
  const height = 240 + card.lines.length * 42 + (card.moreCount > 0 ? 36 : 0) + podiumExtra;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(height, 360);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not make the image.');

  ctx.fillStyle = '#17402F';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#E3B341';
  ctx.fillRect(36, 88, canvas.width - 72, 3);

  ctx.fillStyle = '#E3B341';
  ctx.font = '700 22px sans-serif';
  ctx.fillText('RUMMY HOME', 36, 64);

  ctx.fillStyle = '#FBF1E1';
  ctx.font = '800 36px sans-serif';
  ctx.fillText(card.title.slice(0, 32), 36, 140);
  ctx.font = '600 22px sans-serif';
  ctx.fillText(card.date.slice(0, 40), 36, 176);

  let y = 230;
  const drawLine = (line: { name: string; points: string }) => {
    ctx.fillStyle = '#FBF1E1';
    ctx.font = '600 24px sans-serif';
    ctx.fillText(line.name.slice(0, 24), 36, y);
    ctx.fillStyle = line.points.startsWith('-') ? '#F2B8B5' : '#B7E4C7';
    ctx.font = '800 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(line.points, canvas.width - 36, y);
    ctx.textAlign = 'left';
    y += 42;
  };
  if (card.podiumFirst) {
    card.places.forEach((place) => {
      ctx.fillStyle = '#FBF1E1';
      ctx.font = '800 28px sans-serif';
      ctx.fillText(`${place.label}  ${place.names}  ${place.points}`.slice(0, 42), 36, y);
      y += 44;
    });
    if (card.lines.length > 0) {
      ctx.fillStyle = '#E3B341';
      ctx.font = '700 22px sans-serif';
      ctx.fillText('Totals', 36, y);
      y += 36;
    }
  }
  card.lines.forEach(drawLine);
  if (card.moreCount > 0) {
    ctx.fillStyle = '#E3B341';
    ctx.font = '700 22px sans-serif';
    ctx.fillText(`and ${card.moreCount} more`, 36, y);
    y += 36;
  }
  if (!card.podiumFirst) {
    card.places.forEach((place) => {
      ctx.fillStyle = '#FBF1E1';
      ctx.font = '700 22px sans-serif';
      ctx.fillText(`${place.label}  ${place.names}  ${place.points}`.slice(0, 48), 36, y);
      y += 36;
    });
  }

  return canvas.toDataURL('image/png');
}

async function shareWeb(card: ShareCard): Promise<string> {
  const url = drawShareCard(card);
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'rummy-home.png', { type: 'image/png' });
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
  link.download = 'rummy-home.png';
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
