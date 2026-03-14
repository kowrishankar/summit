import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import { useAuth } from '../contexts/AuthContext';
import { createSetupIntent, createSubscription, confirmSubscription } from '../services/stripeApi';
import { createSubscriptionFromStripe, hasActiveAccess } from '../services/subscription';

export default function SubscribeScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshSubscription } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user?.email || !user?.id) return;
    setLoading(true);
    try {
      const existing = await refreshSubscription(user.id);
      if (existing && hasActiveAccess(existing)) {
        setLoading(false);
        return;
      }
      const { clientSecret, customerId } = await createSetupIntent(user.email);
      const returnURL = Platform.OS === 'web' ? undefined : 'summit://stripe-redirect';
      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: clientSecret,
        merchantDisplayName: 'Summit',
        returnURL,
      });
      if (initError) {
        Alert.alert('Error', initError.message ?? 'Could not initialize payment.');
        setLoading(false);
        return;
      }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment failed', presentError.message ?? 'Could not add card.');
        }
        setLoading(false);
        return;
      }

      const subResponse = await createSubscription(customerId);

      if (subResponse.status === 'requires_payment' && subResponse.clientSecret) {
        const returnURLPay = Platform.OS === 'web' ? undefined : 'summit://stripe-redirect';
        const { error: initPayError } = await initPaymentSheet({
          paymentIntentClientSecret: subResponse.clientSecret,
          merchantDisplayName: 'Summit',
          returnURL: returnURLPay,
        });
        if (initPayError) {
          Alert.alert('Error', initPayError.message ?? 'Could not complete payment.');
          setLoading(false);
          return;
        }
        const { error: presentPayError } = await presentPaymentSheet();
        if (presentPayError) {
          if (presentPayError.code !== 'Canceled') {
            Alert.alert('Payment failed', presentPayError.message ?? 'Could not complete payment.');
          }
          setLoading(false);
          return;
        }
        // Give Stripe a moment to update subscription after payment before we confirm
        await new Promise((r) => setTimeout(r, 800));
      }

      let currentPeriodEnd: string;
      let stripeCustomerId: string | undefined = subResponse.customerId;
      if (subResponse.currentPeriodEnd) {
        currentPeriodEnd = subResponse.currentPeriodEnd;
      } else {
        const confirmed = await confirmSubscription(subResponse.subscriptionId);
        currentPeriodEnd = confirmed.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        if (confirmed.customerId) stripeCustomerId = confirmed.customerId;
      }

      await createSubscriptionFromStripe(user.id, {
        currentPeriodEnd,
        stripeSubscriptionId: subResponse.subscriptionId,
        stripeCustomerId,
      });
      await refreshSubscription(user.id);
      // Let React process subscription state update before clearing loading so navigator can switch to home
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
      <Text style={styles.title}>Subscribe to Summit</Text>
      <Text style={styles.tagline}>Less admin. Better control. One place for all your invoices.</Text>

      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>What you get</Text>
        {benefits.map((item, index) => (
          <View key={index} style={styles.benefitRow}>
            <Ionicons name={item.icon} size={22} color="#6366f1" style={styles.benefitIcon} />
            <Text style={styles.benefitText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.priceBlock}>
        <Text style={styles.price}>£14.99</Text>
        <Text style={styles.pricePeriod}>per month</Text>
      </View>
      <Text style={styles.cancelNote}>Cancel anytime in Settings. No long-term commitment.</Text>

      {!isWeb && (
        <Text style={styles.twoStepNote}>
          You may see two steps: first add your card, then confirm your first payment (e.g. 3D Secure). Both are required to start your subscription.
        </Text>
      )}

      {isWeb ? (
        <Text style={styles.webNote}>
          Payment is supported in the iOS or Android app. Please open this app on your device to subscribe.
        </Text>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleSubscribe} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Add payment method & subscribe</Text>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    color: '#f8fafc',
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
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
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
    color: '#cbd5e1',
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
    color: '#f8fafc',
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
});
