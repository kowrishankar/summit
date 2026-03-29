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

/** Free-trial length when using “Start with free trial” (must match server tier defaults). */
export const TRIAL_DAYS_DEFAULT: Record<AccountKind, number> = {
  individual: 7,
  business: 14,
  practice: 30,
};

function clampTrialDays(n: number): number {
  return Math.min(365, Math.max(1, n));
}

/**
 * Trial days for subscribe UI and fallbacks. Override per tier with
 * EXPO_PUBLIC_STRIPE_TRIAL_DAYS_INDIVIDUAL, _BUSINESS, _PRACTICE, or legacy EXPO_PUBLIC_STRIPE_TRIAL_DAYS for all.
 */
export function getTrialDaysForAccountKind(kind: AccountKind | undefined): number {
  const k: AccountKind = kind ?? 'individual';
  const legacy = process.env.EXPO_PUBLIC_STRIPE_TRIAL_DAYS;
  const tierEnv =
    k === 'individual'
      ? process.env.EXPO_PUBLIC_STRIPE_TRIAL_DAYS_INDIVIDUAL
      : k === 'business'
        ? process.env.EXPO_PUBLIC_STRIPE_TRIAL_DAYS_BUSINESS
        : process.env.EXPO_PUBLIC_STRIPE_TRIAL_DAYS_PRACTICE;
  const raw = tierEnv ?? legacy;
  if (raw !== undefined && String(raw).trim() !== '') {
    const parsed = parseInt(String(raw), 10);
    if (!Number.isNaN(parsed)) return clampTrialDays(parsed);
  }
  return TRIAL_DAYS_DEFAULT[k];
}

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
