import type { ExtractedInvoiceData, Invoice, Sale } from '../types';

function normRef(ref: string | undefined): string {
  return (ref ?? '').trim().toLowerCase();
}

function normDate(d: string | undefined): string {
  if (!d) return '';
  const s = d.trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normMerchant(m: string | undefined): string {
  return (m ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.005;
}

export type ReceiptDuplicateMatchKind = 'reference' | 'fingerprint';

export type ReceiptDuplicateMatch<T extends Invoice | Sale = Invoice> = {
  kind: ReceiptDuplicateMatchKind;
  record: T;
};

/** Same document / invoice number on another saved receipt in this business. */
export function findDuplicateInvoiceByReference(
  invoices: Invoice[],
  businessId: string,
  documentReference: string | undefined
): Invoice | undefined {
  const r = normRef(documentReference);
  if (!r) return undefined;
  return invoices.find(
    (inv) => inv.businessId === businessId && normRef(inv.extracted.documentReference) === r
  );
}

export function findDuplicateSaleByReference(
  sales: Sale[],
  businessId: string,
  documentReference: string | undefined
): Sale | undefined {
  const r = normRef(documentReference);
  if (!r) return undefined;
  return sales.find(
    (s) => s.businessId === businessId && normRef(s.extracted.documentReference) === r
  );
}

/** Same calendar date, amount, and merchant name (when both sides have a merchant). */
export function findDuplicateInvoiceByFingerprint(
  invoices: Invoice[],
  businessId: string,
  data: Pick<ExtractedInvoiceData, 'amount' | 'date' | 'merchantName'>
): Invoice | undefined {
  const m = normMerchant(data.merchantName);
  const d = normDate(data.date);
  if (!m || !d) return undefined;
  return invoices.find((inv) => {
    if (inv.businessId !== businessId) return false;
    if (!sameAmount(data.amount, inv.extracted.amount ?? 0)) return false;
    if (normDate(inv.extracted.date) !== d) return false;
    const im = normMerchant(inv.extracted.merchantName);
    return im === m && im.length > 0;
  });
}

export function findDuplicateSaleByFingerprint(
  sales: Sale[],
  businessId: string,
  data: Pick<ExtractedInvoiceData, 'amount' | 'date' | 'merchantName'>
): Sale | undefined {
  const m = normMerchant(data.merchantName);
  const d = normDate(data.date);
  if (!m || !d) return undefined;
  return sales.find((s) => {
    if (s.businessId !== businessId) return false;
    if (!sameAmount(data.amount, s.extracted.amount ?? 0)) return false;
    if (normDate(s.extracted.date) !== d) return false;
    const sm = normMerchant(s.extracted.merchantName);
    return sm === m && sm.length > 0;
  });
}

export function findDuplicateInvoiceForSave(
  invoices: Invoice[],
  businessId: string,
  extracted: ExtractedInvoiceData
): ReceiptDuplicateMatch<Invoice> | null {
  const byRef = findDuplicateInvoiceByReference(invoices, businessId, extracted.documentReference);
  if (byRef) return { kind: 'reference', record: byRef };
  const byFp = findDuplicateInvoiceByFingerprint(invoices, businessId, extracted);
  if (byFp) return { kind: 'fingerprint', record: byFp };
  return null;
}

export function findDuplicateSaleForSave(
  sales: Sale[],
  businessId: string,
  extracted: ExtractedInvoiceData
): ReceiptDuplicateMatch<Sale> | null {
  const byRef = findDuplicateSaleByReference(sales, businessId, extracted.documentReference);
  if (byRef) return { kind: 'reference', record: byRef };
  const byFp = findDuplicateSaleByFingerprint(sales, businessId, extracted);
  if (byFp) return { kind: 'fingerprint', record: byFp };
  return null;
}
