import type { ExtractedInvoiceData } from '../types';

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

/** Placeholder while extraction runs in the background (persisted row). */
export function placeholderProcessingExtracted(): ExtractedInvoiceData {
  return {
    merchantName: 'Processing receipt…',
    amount: 0,
    date: todayIsoDate(),
    lineItems: [],
  };
}

/** Persisted row when extraction fails; user can edit manually or delete. */
export function placeholderFailedExtracted(): ExtractedInvoiceData {
  return {
    merchantName: 'Could not read receipt',
    amount: 0,
    date: todayIsoDate(),
    lineItems: [],
  };
}
