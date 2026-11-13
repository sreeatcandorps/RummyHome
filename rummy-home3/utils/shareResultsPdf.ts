import { Platform, Share } from 'react-native';
import { resultsDetailsHtml, resultsDetailsPdf, ResultsDetails, roundsPdfHtml } from '@/utils/resultsDetails';
import { FinalScoresSheet } from '@/utils/finalScoresSheet';
import { resultsPdfFileName } from '@/utils/results';

export const PDF_READY = 'PDF ready.';

function downloadPdf(bytes: Uint8Array, fileName: string): void {
  if (typeof document === 'undefined') throw new Error('Could not make the PDF.');
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Phone-shaped PDF pages (points): the page reads like the app at 100% on a phone instead of
 * a sheet of A4 with small type. 390 × 780 keeps a 1:2 portrait page.
 */
export const PDF_PAGE = { width: 390, height: 780 } as const;

async function shareNative(html: string, fileName: string): Promise<void> {
  const Print = await import('expo-print');
  const printed = await Print.printToFileAsync({ html, width: PDF_PAGE.width, height: PDF_PAGE.height });
  if (!printed?.uri) throw new Error('Could not make the PDF.');
  // expo-print names the file with a random code; copy it to the readable name.
  let file = printed;
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const target = `${FileSystem.cacheDirectory ?? ''}${fileName}`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.copyAsync({ from: printed.uri, to: target });
    file = { ...printed, uri: target };
  } catch {
    file = printed;
  }
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'EZ Score: Rummy',
      UTI: 'com.adobe.pdf',
    });
    return;
  }
  await Share.share({ url: file.uri, title: 'EZ Score: Rummy' });
}

/** A PDF of the full results. Phones print the HTML with expo-print and open the share sheet. */
export async function shareResultsPdf(details: ResultsDetails, createdAt?: string): Promise<string> {
  const fileName = resultsPdfFileName(createdAt ?? new Date());
  try {
    if (Platform.OS === 'web') {
      downloadPdf(resultsDetailsPdf(details), fileName);
      return PDF_READY;
    }
    await shareNative(resultsDetailsHtml(details), fileName);
    return PDF_READY;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return PDF_READY;
    throw error instanceof Error ? error : new Error('Could not make the PDF.');
  }
}

export const ROUNDS_PDF_FILE = 'ez-score-rounds.pdf';

/** One game's rounds, five players to a block, as a phone-page PDF. The web build prints the page instead. */
export async function shareFinalScoresPdf(sheet: FinalScoresSheet): Promise<string> {
  const html = roundsPdfHtml({
    heading: sheet.heading,
    lines: [sheet.startedLine, sheet.completedLine, ...sheet.adminLines, sheet.generatedLine],
    table: sheet.table,
    footer: sheet.footer,
  });
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') throw new Error('Could not make the PDF.');
      const popup = window.open('', '_blank');
      if (!popup) throw new Error('Allow pop-ups to print the rounds.');
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      popup.print();
      return PDF_READY;
    }
    await shareNative(html, ROUNDS_PDF_FILE);
    return PDF_READY;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|dismiss/i.test(message)) return 'Share cancelled.';
    throw new Error(message || 'Could not make the PDF.');
  }
}
