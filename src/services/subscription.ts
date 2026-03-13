import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage';
import type { Subscription, SubscriptionStatus } from '../types';

const MONTHLY_PRICE_PENCE = 1499; // £14.99
const CURRENCY = 'GBP';

function addOneMonth(isoDate: string): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Create a new monthly subscription for a user (e.g. at signup) – local only. */
export async function createSubscription(userId: string): Promise<Subscription> {
  const now = new Date().toISOString();
  const periodEnd = addOneMonth(now);
  const sub: Subscription = {
    id: uuidv4(),
    userId,
    status: 'active',
    amountPence: MONTHLY_PRICE_PENCE,
    currency: CURRENCY,
    interval: 'month',
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    createdAt: now,
    updatedAt: now,
  };
  const all = await storage.getSubscriptions();
  await storage.setSubscriptions([...all, sub]);
  return sub;
}

/** Save subscription from Stripe after successful payment (used by Subscribe screen). */
export async function createSubscriptionFromStripe(
  userId: string,
  params: { currentPeriodEnd: string; stripeSubscriptionId?: string; stripeCustomerId?: string }
): Promise<Subscription> {
  const now = new Date().toISOString();
  const periodStart = now;
  const sub: Subscription = {
    id: uuidv4(),
    userId,
    status: 'active',
    amountPence: MONTHLY_PRICE_PENCE,
    currency: CURRENCY,
    interval: 'month',
    currentPeriodStart: periodStart,
    currentPeriodEnd: params.currentPeriodEnd,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripeCustomerId: params.stripeCustomerId,
    createdAt: now,
    updatedAt: now,
  };
  const all = await storage.getSubscriptions();
  await storage.setSubscriptions([...all, sub]);
  return sub;
}

/** Get the active subscription for a user (most recent by currentPeriodEnd). */
export async function getSubscriptionForUser(userId: string): Promise<Subscription | null> {
  const all = await storage.getSubscriptions();
  const userSubs = all.filter((s) => s.userId === userId).sort(
    (a, b) => new Date(b.currentPeriodEnd).getTime() - new Date(a.currentPeriodEnd).getTime()
  );
  return userSubs[0] ?? null;
}

/** Cancel at period end: user keeps access until currentPeriodEnd, then no renewal. */
export async function cancelSubscriptionAtPeriodEnd(userId: string): Promise<Subscription | null> {
  const sub = await getSubscriptionForUser(userId);
  if (!sub || sub.status === 'cancelled' || sub.cancelAtPeriodEnd) return sub;
  const updated: Subscription = {
    ...sub,
    status: 'cancel_at_period_end',
    cancelAtPeriodEnd: true,
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const all = await storage.getSubscriptions();
  const idx = all.findIndex((s) => s.id === sub.id);
  if (idx === -1) return sub;
  all[idx] = updated;
  await storage.setSubscriptions(all);
  return updated;
}

/** Whether the user has access (active or cancelled but still within paid period). */
export function hasActiveAccess(sub: Subscription | null): boolean {
  if (!sub) return false;
  const now = new Date().getTime();
  const end = new Date(sub.currentPeriodEnd).getTime();
  if (now > end) return false;
  return sub.status === 'active' || sub.status === 'cancel_at_period_end';
}

/** Human-readable price e.g. "£14.99" */
export function formatPrice(sub: Subscription): string {
  const amount = (sub.amountPence / 100).toFixed(2);
  return sub.currency === 'GBP' ? `£${amount}` : `${sub.currency} ${amount}`;
}

export { MONTHLY_PRICE_PENCE, CURRENCY };
