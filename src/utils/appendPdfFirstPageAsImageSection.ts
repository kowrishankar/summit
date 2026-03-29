import { Platform } from 'react-native';
import type { ReceiptImageAsset } from '../services/receiptExtractionRunner';

/**
 * Web only: first PDF page as a JPEG data-URI asset so it can join a multi-image receipt.
 * Native has no PDF→image in this app; return null.
 */
export async function pdfFirstPageAsImageAsset(pdfUri: string): Promise<ReceiptImageAsset | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const { renderPdfFirstPageToImageBase64 } = await import('../services/pdfText');
    const rendered = await renderPdfFirstPageToImageBase64(pdfUri);
    if (!rendered?.base64) return null;
    return {
      uri: `data:image/jpeg;base64,${rendered.base64}`,
      base64: rendered.base64,
      mimeType: 'image/jpeg',
    };
  } catch {
    return null;
  }
}
