export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  taxAmount?: number;
  taxType?: string;
}

export interface ExtractedInvoiceData {
  merchantName?: string;
  merchantAddress?: string;
  merchantPhone?: string;
  merchantEmail?: string;
  merchantWebsite?: string;
  /** Supplier/vendor name (may equal merchant or be more formal) */
  supplierName?: string;
  vatAmount?: number;
  category?: string;
  currency?: string; // ISO code e.g. USD, EUR, GBP
  amount: number;
  date: string;
  /** Payment type e.g. Card, Bank transfer, Cash, Invoice */
  paymentType?: string;
  /** Customer / billed to / owned by */
  ownedBy?: string;
  /** Document reference / invoice number */
  documentReference?: string;
  lineItems: LineItem[];
}

export interface Invoice {
  id: string;
  businessId: string;
  categoryId: string | null;
  source: 'upload' | 'manual';
  fileUri?: string; // for uploads: local URI or base64 (first image when multi)
  fileUris?: string[]; // long receipt: multiple images in order
  fileName?: string;
  extracted: ExtractedInvoiceData;
  createdAt: string;
  updatedAt: string;
}

/** Sale (income) – same shape as Invoice but for sales/income. */
export interface Sale {
  id: string;
  businessId: string;
  categoryId: string | null;
  source: 'upload' | 'manual';
  fileUri?: string;
  fileUris?: string[];
  fileName?: string;
  extracted: ExtractedInvoiceData;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAccount {
  id: string;
  name: string;
  address?: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

/** Subscription status: trialing (free trial, card on file), active, cancelling, or cancelled (no access). */
export type SubscriptionStatus = 'active' | 'trialing' | 'cancel_at_period_end' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  status: SubscriptionStatus;
  /** Price in pence (e.g. 1499 = £14.99) */
  amountPence: number;
  currency: string;
  interval: 'month';
  currentPeriodStart: string; // ISO date
  currentPeriodEnd: string;   // ISO date – access until this date even after cancel
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;       // ISO date when user requested cancel
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuthUser = User & { passwordHash?: string };

export interface InvoiceFilters {
  categoryId?: string | null;
  merchantName?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface SpendSummary {
  week: number;
  month: number;
  year: number;
  taxWeek: number;
  taxMonth: number;
  taxYear: number;
}
