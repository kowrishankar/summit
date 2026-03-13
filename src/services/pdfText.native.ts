// Native (iOS/Android): pdfjs-dist uses import.meta and is not compatible with Hermes.
// No PDF text extraction or PDF→image on native; use web app or take a photo for PDFs.

export async function extractTextFromPdf(_uri: string): Promise<string> {
  return ' ';
}

export async function extractTextFromPdfBase64(_base64: string): Promise<string> {
  return ' ';
}

/** Not available on native; returns null. Web uses pdfText.ts for PDF→image. */
export async function renderPdfFirstPageToImageBase64(
  _uri: string
): Promise<{ base64: string; mimeType: string } | null> {
  return null;
}
