import type { Subscription } from '../types';
import * as supabaseData from './supabaseData';

const MONTHLY_PRICE_PENCE = 1499;
const CURRENCY = 'GBP';

/** Whether the user has access (active or cancelled but still within paid period). */
export function hasActiveAccess(sub: Subscription | null): boolean {
  if (!sub) return false;
  const now = new Date().getTime();
  const end = new Date(sub.currentPeriodEnd).getTime();
  if (now > end) return false;
  return (
    sub.status === 'active' ||
    sub.status === 'trialing' ||
    sub.status === 'cancel_at_period_end'
  );
}

/**
 * Resolves which Supabase user owns the subscription used for app access, and that row.
 * Prefer the signed-in user's own active subscription; otherwise use an owner's subscription
 * when this user is a team member.
 */
export async function resolveBillingAndSubscription(authUserId: string): Promise<{
  subscription: Subscription | null;
  billingUserId: string;
}> {
  const ownerIds = await supabaseData.getTeamOwnerIdsForMember(authUserId);
  const ownSub = await supabaseData.getSubscription(authUserId);
  if (hasActiveAccess(ownSub)) {
    return { subscription: ownSub, billingUserId: authUserId };
  }
  for (const oid of ownerIds) {
    const s = await supabaseData.getSubscription(oid);
    if (hasActiveAccess(s)) {
      return { subscription: s, billingUserId: oid };
    }
  }
  return { subscription: ownSub, billingUserId: authUserId };
}

/** Get the active subscription for a user (from Supabase). */
export async function getSubscriptionForUser(userId: string): Promise<Subscription | null> {
  return supabaseData.getSubscription(userId);
}

/** Save subscription from Stripe after successful payment (used by Subscribe screen). */
export async function createSubscriptionFromStripe(
  userId: string,
  params: {
    currentPeriodEnd: string;
    currentPeriodStart?: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    status?: 'active' | 'trialing';
  }
): Promise<Subscription> {
  return supabaseData.upsertSubscriptionFromStripe(userId, params);
}

/** Cancel at period end: user keeps access until currentPeriodEnd, then no renewal. */
export async function cancelSubscriptionAtPeriodEnd(userId: string): Promise<Subscription | null> {
  return supabaseData.setSubscriptionCancelAtPeriodEnd(userId);
}

/** Human-readable price e.g. "£4.99" */
export function formatPrice(sub: Subscription): string {
  const amount = (sub.amountPence / 100).toFixed(2);
  return sub.currency === 'GBP' ? `£${amount}` : `${sub.currency} ${amount}`;
}

export { MONTHLY_PRICE_PENCE, CURRENCY };
