/**
 * Removes com.apple.developer.in-app-payments from iOS entitlements so EAS / Apple
 * stop syncing stale Merchant IDs (e.g. merchant.com.summit) when Apple Pay is unused.
 * Runs after @stripe/stripe-react-native — list this plugin after Stripe in app.json.
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

function withRemoveInAppPaymentsEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['com.apple.developer.in-app-payments'];
    return c;
  });
}

module.exports = withRemoveInAppPaymentsEntitlement;
