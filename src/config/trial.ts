/**
 * Subscribe / signup trial copy. Defaults: Personal 7d, Business 14d, Practice 30d.
 * Server: STRIPE_TRIAL_DAYS_INDIVIDUAL, STRIPE_TRIAL_DAYS_BUSINESS, STRIPE_TRIAL_DAYS_PRACTICE (or legacy STRIPE_TRIAL_PERIOD_DAYS).
 */
export { getTrialDaysForAccountKind, TRIAL_DAYS_DEFAULT } from './pricing';
