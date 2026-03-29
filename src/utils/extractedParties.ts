import type { ExtractedInvoiceData } from '../types';

/** Seller / issuer on the document (vendor for expenses; seller for sales). */
export function displayIssuedBy(
  e: Pick<ExtractedInvoiceData, 'issuedBy' | 'merchantName' | 'supplierName'>
): string | undefined {
  const v = e.issuedBy?.trim() || e.merchantName?.trim() || e.supplierName?.trim();
  return v || undefined;
}

/** Customer / buyer the document is issued to (bill-to, client). */
export function displayIssuedTo(e: Pick<ExtractedInvoiceData, 'issuedTo' | 'ownedBy'>): string | undefined {
  const v = e.issuedTo?.trim() || e.ownedBy?.trim();
  return v || undefined;
}
