import { Platform, Share } from 'react-native';
import { resultsDetailsHtml, resultsDetailsPdf, ResultsDetails } from '@/utils/resultsDetails';

export const PDF_READY = 'PDF ready.';

function downloadPdf(bytes: Uint8Array): void {
  if (typeof document === 'undefined') throw new Error('Could not make the PDF.');
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rummy-home-results.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareNative(html: string): Promise<void> {
  const Print = await import('expo-print');
  const file = await Print.printToFileAsync({ html });
  if (!file?.uri) throw new Error('Could not make the PDF.');
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
export async function shareResultsPdf(details: ResultsDetails): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      downloadPdf(resultsDetailsPdf(details));
      return PDF_READY;
    }
    await shareNative(resultsDetailsHtml(details));
    return PDF_READY;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return PDF_READY;
    throw error instanceof Error ? error : new Error('Could not make the PDF.');
  }
}
