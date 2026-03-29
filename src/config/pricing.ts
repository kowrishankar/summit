import type { AccountKind } from '../types';

/** Max expense documents (invoices) across all businesses you own (Personal plan). */
export const PERSONAL_MAX_INVOICES = 50;
/** Max income documents (sales) across all businesses you own (Personal plan). */
export const PERSONAL_MAX_SALES = 50;

export const PLAN_AMOUNT_PENCE: Record<AccountKind, number> = {
  individual: 499,
  business: 999,
  practice: 1499,
};

export function getPlanForAccountKind(kind: AccountKind | undefined): {
  label: string;
  amountPence: number;
  priceDisplay: string;
  limitNote?: string;
} {
  const k: AccountKind = kind ?? 'individual';
  const amountPence = PLAN_AMOUNT_PENCE[k];
  const priceDisplay = `£${(amountPence / 100).toFixed(2)}`;
  if (k === 'business') {
    return { label: 'Business', amountPence, priceDisplay };
  }
  if (k === 'practice') {
    return {
      label: 'Practice',
      amountPence,
      priceDisplay,
      limitNote:
        'First client workspace is included with your subscription. Each additional workspace is billed separately.',
    };
  }
  return {
    label: 'Personal',
    amountPence,
    priceDisplay,
    limitNote: `Up to ${PERSONAL_MAX_INVOICES} invoices and ${PERSONAL_MAX_SALES} income entries across your businesses.`,
  };
}
