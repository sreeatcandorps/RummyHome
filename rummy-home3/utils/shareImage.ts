import { Platform, Share, View } from 'react-native';
import { ShareCard } from '@/utils/shareCard';

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
      const data: ShareData = { files: [file], title: 'Rummy Home', text: card.title };
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
