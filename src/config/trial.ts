/**
 * Shown in signup/subscribe copy. Keep in sync with server `STRIPE_TRIAL_PERIOD_DAYS`.
 * Optional: set EXPO_PUBLIC_STRIPE_TRIAL_DAYS=14 in .env so UI matches production server.
 */
export const STRIPE_TRIAL_DAYS = Math.min(
  365,
  Math.max(1, parseInt(process.env.EXPO_PUBLIC_STRIPE_TRIAL_DAYS || '14', 10) || 14)
);
