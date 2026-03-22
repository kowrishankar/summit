import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppText from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../contexts/AuthContext';
import { isStripePublishableKeyConfigured } from '../config/stripeEnv';
import { STRIPE_TRIAL_DAYS } from '../config/trial';
import {
  prepareSubscriptionPayment,
  confirmSubscription,
  createSetupIntent,
  createTrialSubscription,
} from '../services/stripeApi';
import { createSubscriptionFromStripe, hasActiveAccess } from '../services/subscription';

const TRIAL_PREF_KEY = 'summit_subscribe_with_trial';

function mapStripeStatusForDb(s: string | undefined): 'active' | 'trialing' {
  return s === 'trialing' ? 'trialing' : 'active';
}

function useLogoutToLogin() {
  const { logout } = useAuth();
  return () => {
    Alert.alert('Log out', 'Sign out and return to the login screen?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  };
}

/** Shown on EAS builds when EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY was not set at build time. */
function SubscribeScreenStripeNotConfigured() {
  const insets = useSafeAreaInsets();
  const confirmLogout = useLogoutToLogin();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(24, insets.top),
          paddingBottom: Math.max(48, insets.bottom),
        },
      ]}
    >
      <AppText style={styles.title}>Payment not configured</AppText>
      <AppText style={styles.tagline}>
        This build was created without a Stripe publishable key. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (and your other EXPO_PUBLIC_* vars) in the Expo dashboard under Environment variables for this project, then create a new build.
      </AppText>
      <AppText style={styles.cancelNote}>
        Supabase keys must also be set the same way or login and data will not work.
      </AppText>
      <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout}>
        <AppText style={styles.logoutButtonText}>Log out</AppText>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function SubscribeScreen() {
  if (!isStripePublishableKeyConfigured()) {
    return <SubscribeScreenStripeNotConfigured />;
  }
  return <SubscribeScreenWithStripe />;
}

function SubscribeScreenWithStripe() {
  const insets = useSafeAreaInsets();
  const { user, refreshSubscription } = useAuth();
  const confirmLogout = useLogoutToLogin();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [startWithTrial, setStartWithTrial] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(TRIAL_PREF_KEY).then((v) => {
      if (v === 'true') setStartWithTrial(true);
      if (v === 'false') setStartWithTrial(false);
    });
  }, []);

  const persistTrialChoice = (value: boolean) => {
    setStartWithTrial(value);
    void AsyncStorage.setItem(TRIAL_PREF_KEY, value ? 'true' : 'false');
  };

  const handleSubscribe = async () => {
    if (!user?.email || !user?.id) return;
    setLoading(true);
    try {
      const existing = await refreshSubscription(user.id);
      if (existing && hasActiveAccess(existing)) {
        setLoading(false);
        return;
      }

      const returnURL = Platform.OS === 'web' ? undefined : 'summit://stripe-redirect';

      if (startWithTrial) {
        const { clientSecret, customerId } = await createSetupIntent(user.email);
        const { error: initError } = await initPaymentSheet({
          setupIntentClientSecret: clientSecret,
          merchantDisplayName: 'Summit',
          returnURL,
        });
        if (initError) {
          const hint =
            /no such setupintent|resource_missing/i.test(initError.message ?? '')
              ? '\n\nUsually: app publishable key (pk_test_/pk_live_) must match your server secret key mode from the same Stripe account.'
              : '';
          Alert.alert('Error', (initError.message ?? 'Could not initialize payment.') + hint);
          setLoading(false);
          return;
        }
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== 'Canceled') {
            const msg = presentError.message ?? 'Could not save card.';
            Alert.alert('Payment failed', msg);
          }
          setLoading(false);
          return;
        }

        const trialRes = await createTrialSubscription(customerId);
        const currentPeriodEnd =
          trialRes.currentPeriodEnd ??
          new Date(Date.now() + STRIPE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const currentPeriodStart =
          trialRes.currentPeriodStart ?? new Date().toISOString();

        await createSubscriptionFromStripe(user.id, {
          currentPeriodEnd,
          currentPeriodStart,
          stripeSubscriptionId: trialRes.subscriptionId,
          stripeCustomerId: trialRes.customerId,
          status: mapStripeStatusForDb(trialRes.status),
        });
        await AsyncStorage.removeItem(TRIAL_PREF_KEY);
        await refreshSubscription(user.id);
        await new Promise((r) => setTimeout(r, 50));
        return;
      }

      const subResponse = await prepareSubscriptionPayment(user.email);

      if (subResponse.status === 'requires_payment' && subResponse.clientSecret) {
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: subResponse.clientSecret,
          merchantDisplayName: 'Summit',
          returnURL,
        });
        if (initError) {
          const hint =
            /no such payment_intent|resource_missing/i.test(initError.message ?? '')
              ? '\n\nUsually: app publishable key (pk_test_/pk_live_) must match your server secret key mode from the same Stripe account.'
              : '';
          Alert.alert('Error', (initError.message ?? 'Could not initialize payment.') + hint);
          setLoading(false);
          return;
        }
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== 'Canceled') {
            const msg = presentError.message ?? 'Payment failed.';
            const hint =
              /no such payment_intent|resource_missing/i.test(msg)
                ? '\n\nCheck Stripe Dashboard Test/Live toggle: use sk_test_ + pk_test_ together, or sk_live_ + pk_live_, on server and in the app env.'
                : '';
            Alert.alert('Payment failed', msg + hint);
          }
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }

      const confirmed = await confirmSubscription(subResponse.subscriptionId);
      const currentPeriodEnd =
        confirmed.currentPeriodEnd ??
        subResponse.currentPeriodEnd ??
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const stripeCustomerId = confirmed.customerId ?? subResponse.customerId;

      await createSubscriptionFromStripe(user.id, {
        currentPeriodEnd,
        currentPeriodStart: confirmed.currentPeriodStart ?? subResponse.currentPeriodStart,
        stripeSubscriptionId: subResponse.subscriptionId,
        stripeCustomerId,
        status: mapStripeStatusForDb(confirmed.status),
      });
      await AsyncStorage.removeItem(TRIAL_PREF_KEY);
      await refreshSubscription(user.id);
      await new Promise((r) => setTimeout(r, 50));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Subscription failed.');
    } finally {
      setLoading(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  const benefits = [
    { icon: 'document-text-outline' as const, text: 'Upload receipts & invoices — photo or PDF. We auto-extract amounts, dates and vendor details.' },
    { icon: 'pricetag-outline' as const, text: 'Organise by category and track spending by week, month and year for tax and budgets.' },
    { icon: 'business-outline' as const, text: 'Run multiple businesses from one account. Switch between them in one tap.' },
    { icon: 'search-outline' as const, text: 'Find any invoice by reference, merchant or date. No more digging through folders.' },
    { icon: 'shield-checkmark-outline' as const, text: 'Cancel anytime. Keep access until the end of your billing period — no surprise charges.' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: Math.max(24, insets.top),
          paddingBottom: Math.max(48, insets.bottom),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <AppText style={styles.title}>Subscribe to Summit</AppText>
      <AppText style={styles.tagline}>Less admin. Better control. One place for all your invoices.</AppText>

      <View style={styles.benefitsCard}>
        <AppText style={styles.benefitsTitle}>What you get</AppText>
        {benefits.map((item, index) => (
          <View key={index} style={styles.benefitRow}>
            <Ionicons name={item.icon} size={22} color="#6366f1" style={styles.benefitIcon} />
            <AppText style={styles.benefitText}>{item.text}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.priceBlock}>
        <AppText style={styles.price}>£14.99</AppText>
        <AppText style={styles.pricePeriod}>per month</AppText>
      </View>
      <AppText style={styles.cancelNote}>Cancel anytime in Settings. No long-term commitment.</AppText>

      {!isWeb && (
        <View style={styles.trialRow}>
          <View style={styles.trialTextCol}>
            <AppText style={styles.trialTitle}>Start with a free trial</AppText>
            <AppText style={styles.trialHint}>
              {STRIPE_TRIAL_DAYS} days free, then £14.99/month. Add a card now — you won’t be charged until the trial
              ends.
            </AppText>
          </View>
          <Switch
            style={styles.trialSwitch}
            value={startWithTrial}
            onValueChange={persistTrialChoice}
            trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
            thumbColor={startWithTrial ? '#6366f1' : '#f4f4f5'}
            disabled={loading}
          />
        </View>
      )}

      {!isWeb && !startWithTrial && (
        <AppText style={styles.twoStepNote}>
          If your bank uses 3D Secure, a short verification may open in the browser and then return to the app
          automatically.
        </AppText>
      )}

      {isWeb ? (
        <AppText style={styles.webNote}>
          Payment is supported in the iOS or Android app. Please open this app on your device to subscribe.
        </AppText>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSubscribe} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText style={styles.buttonText}>
              {startWithTrial ? `Start ${STRIPE_TRIAL_DAYS}-day free trial` : 'Subscribe now'}
            </AppText>
          )}
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={confirmLogout}
        disabled={loading}
      >
        <AppText style={styles.logoutButtonText}>Log out</AppText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  benefitIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: 'black',
    lineHeight: 20,
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#94a3b8',
    marginLeft: 6,
  },
  cancelNote: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    textAlign: 'center',
  },
  trialRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trialTextCol: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  trialHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  trialSwitch: {
    marginLeft: 8,
  },
  twoStepNote: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  webNote: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: 260,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 260,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
});
