import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import AppText from '../components/AppText';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  getSubscriptionForUser,
  cancelSubscriptionAtPeriodEnd,
  formatPrice,
} from '../services/subscription';
import { createPortalSession } from '../services/stripeApi';
import type { Subscription } from '../types';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { currentBusiness, updateBusiness } = useApp();
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const loadSubscription = useCallback(async () => {
    if (!user?.id) return;
    setSubLoading(true);
    try {
      const sub = await getSubscriptionForUser(user.id);
      setSubscription(sub);
    } finally {
      setSubLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  useEffect(() => {
    if (currentBusiness) {
      setBusinessName(currentBusiness.name);
      setBusinessAddress(currentBusiness.address ?? '');
    }
  }, [currentBusiness?.id, currentBusiness?.name, currentBusiness?.address]);

  const handleSaveBusiness = async () => {
    if (!currentBusiness) return;
    setSaving(true);
    try {
      await updateBusiness(currentBusiness.id, {
        name: businessName.trim(),
        address: businessAddress.trim(),
      });
      Alert.alert('Saved', 'Business details updated.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel subscription',
      'You will keep access until the end of your current billing period. After that, you will not be charged again.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setCancelling(true);
            try {
              const updated = await cancelSubscriptionAtPeriodEnd(user.id);
              setSubscription(updated ?? null);
              Alert.alert(
                'Subscription cancelled',
                `You can continue using the app until ${updated ? new Date(updated.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'the end of your billing period'}.`
              );
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not cancel.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const canCancel =
    subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    !subscription.cancelAtPeriodEnd;

  const handleManageBilling = async () => {
    if (!subscription?.stripeCustomerId) return;
    setPortalLoading(true);
    try {
      const returnUrl = process.env.EXPO_PUBLIC_PORTAL_RETURN_URL || process.env.EXPO_PUBLIC_STRIPE_API_URL || 'https://example.com';
      const { url } = await createPortalSession(subscription.stripeCustomerId, returnUrl);
      await Linking.openURL(url);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Could not open billing portal.';
      Alert.alert(
        'Cannot open billing',
        message +
          (message.includes('billing server')
            ? ''
            : '\n\nIf you see a network error, start the server (server folder) and use your computer’s IP in .env for EXPO_PUBLIC_STRIPE_API_URL when on a physical device.')
      );
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <AppText style={styles.label}>Account</AppText>
          <AppText style={styles.value}>{user?.email ?? '—'}</AppText>
        </View>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Subscription</AppText>
          <AppText style={styles.hint}>Your monthly plan and billing.</AppText>
          {subLoading ? (
            <ActivityIndicator color="#94a3b8" style={styles.subLoader} />
          ) : subscription ? (
            <>
              <View style={styles.subRow}>
                <AppText style={styles.subLabel}>Plan</AppText>
                <AppText style={styles.subValue}>{formatPrice(subscription)}/month</AppText>
              </View>
              <View style={styles.subRow}>
                <AppText style={styles.subLabel}>Status</AppText>
                <AppText style={styles.subValue}>
                  {subscription.status === 'active'
                    ? 'Active'
                    : subscription.status === 'trialing'
                      ? 'Free trial'
                      : subscription.status === 'cancel_at_period_end'
                        ? 'Cancelling at period end'
                        : 'Ended'}
                </AppText>
              </View>
              <View style={styles.subRow}>
                <AppText style={styles.subLabel}>
                  {subscription.cancelAtPeriodEnd
                    ? 'Access until'
                    : subscription.status === 'trialing'
                      ? 'First payment on'
                      : 'Next billing date'}
                </AppText>
                <AppText style={styles.subValue}>
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                    dateStyle: 'long',
                  })}
                </AppText>
              </View>
              {subscription.stripeCustomerId && (
                <TouchableOpacity
                  style={styles.manageBillingButton}
                  onPress={handleManageBilling}
                  disabled={portalLoading}
                >
                  <AppText style={styles.manageBillingButtonText}>
                    {portalLoading ? 'Opening…' : 'Manage billing'}
                  </AppText>
                </TouchableOpacity>
              )}
              {canCancel && (
                <TouchableOpacity
                  style={styles.cancelSubButton}
                  onPress={handleCancelSubscription}
                  disabled={cancelling}
                >
                  <AppText style={styles.cancelSubButtonText}>
                    {cancelling ? 'Cancelling…' : 'Cancel subscription'}
                  </AppText>
                </TouchableOpacity>
              )}
              {subscription.cancelAtPeriodEnd && (
                <AppText style={styles.cancelNote}>
                  You cancelled your subscription. You can keep using the app until the date above.
                </AppText>
              )}
            </>
          ) : (
            <AppText style={styles.muted}>No subscription found.</AppText>
          )}
        </View>

        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Business details</AppText>
          <AppText style={styles.hint}>Edit your current business name and address.</AppText>
          {currentBusiness ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholderTextColor="#64748b"
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Business address"
                value={businessAddress}
                onChangeText={setBusinessAddress}
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={2}
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveBusiness}
                disabled={saving}
              >
                <AppText style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save business details'}</AppText>
              </TouchableOpacity>
            </>
          ) : (
            <AppText style={styles.muted}>Add a business from Home → Switch business.</AppText>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <AppText style={styles.logoutButtonText}>Log out</AppText>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 28 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  value: { fontSize: 16, color: '#0f172a' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 4 },
  hint: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    color: '#0f172a',
    fontSize: 16,
    marginBottom: 12,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { fontSize: 14, color: '#64748b' },
  subLoader: { marginVertical: 12 },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subLabel: { fontSize: 14, color: '#94a3b8' },
  subValue: { fontSize: 15, color: '#0f172a', fontWeight: '500' },
  manageBillingButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  manageBillingButtonText: { color: '#334155', fontSize: 15, fontWeight: '600' },
  cancelSubButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelSubButtonText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  cancelNote: { fontSize: 13, color: '#94a3b8', marginTop: 12, fontStyle: 'italic' },
  logoutButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
});
