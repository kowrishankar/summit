// Web only: PDF.js for text extraction. On native, pdfText.native.ts is used (no pdfjs-dist).
import * as pdfjsLib from 'pdfjs-dist';

let workerInitialized = false;

export async function extractTextFromPdf(uri: string): Promise<string> {
  try {
    if (typeof window !== 'undefined' && !workerInitialized) {
      try {
        (pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
          `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as unknown as { version: string }).version || '3.11.174'}/pdf.worker.min.js`;
      } catch {
        // ignore
      }
      workerInitialized = true;
    }
    const doc = await pdfjsLib.getDocument(uri).promise;
    const numPages = doc.numPages;
    const parts: string[] = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      parts.push(text);
    }
    return parts.join('\n\n').trim() || ' ';
  } catch (e) {
    console.warn('PDF text extraction failed:', e);
    return ' ';
  }
}

export async function extractTextFromPdfBase64(base64: string): Promise<string> {
  const dataUri = `data:application/pdf;base64,${base64}`;
  return extractTextFromPdf(dataUri);
}

/** Renders the first page of the PDF to a JPEG image (web only). Returns base64 + mimeType for GPT-4o vision. */
export async function renderPdfFirstPageToImageBase64(
  uri: string
): Promise<{ base64: string; mimeType: string } | null> {
  if (typeof document === 'undefined' || !document.createElement) return null;
  try {
    if (typeof window !== 'undefined' && !workerInitialized) {
      try {
        (pdfjsLib as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
          `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as unknown as { version: string }).version || '3.11.174'}/pdf.worker.min.js`;
      } catch {
        // ignore
      }
      workerInitialized = true;
    }
    const doc = await pdfjsLib.getDocument(uri).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    return { base64, mimeType: 'image/jpeg' };
  } catch (e) {
    console.warn('PDF render to image failed:', e);
    return null;
  }
}
