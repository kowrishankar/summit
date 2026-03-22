/** True when a real Stripe publishable key is available (embedded at build time from EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY). */
export function isStripePublishableKeyConfigured(): boolean {
  const k = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim();
  return k.startsWith('pk_test_') || k.startsWith('pk_live_');
}
