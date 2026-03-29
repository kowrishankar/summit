import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  extractFromText,
  extractFromImageBase64,
  extractFromMultipleImagesBase64,
  extractFromPdfBase64,
} from './invoiceExtraction';
import { renderPdfFirstPageToImageBase64 } from './pdfText';
import type { ExtractedInvoiceData } from '../types';

export type ReceiptImageAsset = { uri: string; base64?: string; mimeType?: string };

export type ReceiptExtractionSnapshot = {
  isPdf: boolean;
  fileName: string;
  documentUri: string | null;
  imageAssets: ReceiptImageAsset[];
};

async function getImageBase64ForApi(
  uri: string,
  existingBase64: string | undefined,
  mimeType: string | undefined
): Promise<{ base64: string; mimeType: string }> {
  const type = (mimeType ?? '').toLowerCase();
  const isSupported = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(type);
  if (existingBase64 && isSupported) {
    return { base64: existingBase64, mimeType: type || 'image/jpeg' };
  }
  const result = await manipulateAsync(uri, [], {
    format: SaveFormat.JPEG,
    base64: true,
    compress: 0.9,
  });
  const base64 = result.base64 ?? '';
  if (!base64) throw new Error('Could not convert image to JPEG.');
  return { base64, mimeType: 'image/jpeg' };
}

/**
 * Runs the same extraction pipeline as Add invoice/sale preview → review (no React state).
 */
export async function runReceiptExtraction(
  snapshot: ReceiptExtractionSnapshot,
  docKind: 'invoice' | 'sale'
): Promise<ExtractedInvoiceData> {
  const pdfLabel = docKind === 'invoice' ? 'invoice.pdf' : 'sale.pdf';
  const noImageMsg =
    docKind === 'invoice'
      ? 'No image. Please enter details manually.'
      : 'No image. Please enter details manually.';

  if (snapshot.isPdf) {
    const uri = snapshot.documentUri;
    if (!uri) throw new Error('Missing document.');
    try {
      const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (pdfBase64) {
        return await extractFromPdfBase64(pdfBase64, snapshot.fileName ?? pdfLabel, docKind);
      }
    } catch {
      /* fallback */
    }
    const imageResult = await renderPdfFirstPageToImageBase64(uri);
    if (imageResult) {
      return await extractFromImageBase64(imageResult.base64, imageResult.mimeType, docKind);
    }
    throw new Error('Could not process this PDF. Try taking a photo instead.');
  }

  let assets = [...snapshot.imageAssets];
  if (assets.length === 0 && snapshot.documentUri) {
    assets = [{ uri: snapshot.documentUri, base64: undefined, mimeType: undefined }];
  }

  if (assets.length > 1) {
    const imagePayloads: Array<{ base64: string; mimeType: string }> = [];
    for (const a of assets) {
      const payload = await getImageBase64ForApi(a.uri, a.base64, a.mimeType);
      imagePayloads.push(payload);
    }
    return await extractFromMultipleImagesBase64(imagePayloads, docKind);
  }

  if (assets.length === 1) {
    const { base64, mimeType } = await getImageBase64ForApi(
      assets[0].uri,
      assets[0].base64,
      assets[0].mimeType
    );
    return await extractFromImageBase64(base64, mimeType, docKind);
  }

  return await extractFromText(noImageMsg, docKind);
}
