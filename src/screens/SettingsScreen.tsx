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
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../components/AppText';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import {
  getSubscriptionForUser,
  cancelSubscriptionAtPeriodEnd,
  formatPrice,
} from '../services/subscription';
import { createPortalSession } from '../services/stripeApi';
import {
  getSaveCameraPhotosToGallery,
  setSaveCameraPhotosToGallery,
} from '../services/cameraGalleryPreference';
import type { Subscription } from '../types';
import {
  BORDER,
  CARD_BG,
  LAVENDER_SOFT,
  MUTED_CARD,
  PAGE_BG,
  PURPLE,
  PURPLE_DEEP,
  RED,
  TEXT,
  TEXT_MUTED,
  shadowCard,
  shadowCardLight,
} from '../theme/design';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { currentBusiness, updateBusiness } = useApp();
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [saveCameraToGallery, setSaveCameraToGallery] = useState(false);

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
    if (Platform.OS === 'web') return;
    void getSaveCameraPhotosToGallery().then(setSaveCameraToGallery);
  }, []);

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
      const returnUrl =
        process.env.EXPO_PUBLIC_PORTAL_RETURN_URL ||
        process.env.EXPO_PUBLIC_STRIPE_API_URL ||
        'https://example.com';
      const { url } = await createPortalSession(subscription.stripeCustomerId, returnUrl);
      await Linking.openURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not open billing portal.';
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <AppText style={styles.headerTitle}>Settings</AppText>
        <View style={styles.headerSide} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 28 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Account */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Account</AppText>
            <View style={styles.accountRow}>
              <View style={styles.iconTilePurple}>
                <Ionicons name="mail-outline" size={22} color="#fff" />
              </View>
              <View style={styles.accountTextCol}>
                <AppText style={styles.accountLabel}>Email</AppText>
                <AppText style={styles.accountValue}>{user?.email ?? '—'}</AppText>
              </View>
            </View>
          </View>

          {/* Business */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Business details</AppText>
            <AppText style={styles.cardHint}>Edit your current business name and address.</AppText>
            {currentBusiness ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Business name"
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholderTextColor={TEXT_MUTED}
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Business address"
                  value={businessAddress}
                  onChangeText={setBusinessAddress}
                  placeholderTextColor={TEXT_MUTED}
                  multiline
                  numberOfLines={2}
                />
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={handleSaveBusiness}
                  disabled={saving}
                  style={styles.gradientBtnTouchable}
                >
                  <LinearGradient
                    colors={[PURPLE, PURPLE_DEEP]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBtn}
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                    <AppText style={styles.gradientBtnText}>
                      {saving ? 'Saving…' : 'Save business details'}
                    </AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <AppText style={styles.muted}>Add a business from Home → Switch business.</AppText>
            )}
          </View>

          {Platform.OS !== 'web' && (
            <View style={styles.card}>
              <AppText style={styles.cardTitle}>Photos</AppText>
              <View style={styles.preferenceShell}>
                <View style={styles.iconTileBlue}>
                  <Ionicons name="images-outline" size={22} color="#2563eb" />
                </View>
                <View style={styles.preferenceTextCol}>
                  <AppText style={styles.preferenceTitle}>Save to gallery</AppText>
                  <AppText style={styles.preferenceHint}>
                    When you take a picture while adding an invoice or sale, also save a copy to your photo
                    library.
                  </AppText>
                </View>
                <Switch
                  style={styles.preferenceSwitch}
                  value={saveCameraToGallery}
                  onValueChange={(v) => {
                    setSaveCameraToGallery(v);
                    void setSaveCameraPhotosToGallery(v);
                  }}
                  trackColor={{ false: '#cbd5e1', true: LAVENDER_SOFT }}
                  thumbColor={saveCameraToGallery ? PURPLE : '#f4f4f5'}
                />
              </View>
            </View>
          )}
          
          {/* Subscription */}
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Subscription</AppText>
            <AppText style={styles.cardHint}>Your monthly plan and billing.</AppText>
            {subLoading ? (
              <ActivityIndicator color={PURPLE} style={styles.loader} />
            ) : subscription ? (
              <>
                <View style={styles.listRow}>
                  <AppText style={styles.listLabel}>Plan</AppText>
                  <AppText style={styles.listValueStrong}>{formatPrice(subscription)}/month</AppText>
                </View>
                <View style={styles.listRow}>
                  <AppText style={styles.listLabel}>Status</AppText>
                  <AppText style={styles.listValueStrong}>
                    {subscription.status === 'active'
                      ? 'Active'
                      : subscription.status === 'trialing'
                        ? 'Free trial'
                        : subscription.status === 'cancel_at_period_end'
                          ? 'Cancelling at period end'
                          : 'Ended'}
                  </AppText>
                </View>
                <View style={[styles.listRow, styles.listRowLast]}>
                  <AppText style={styles.listLabel}>
                    {subscription.cancelAtPeriodEnd
                      ? 'Access until'
                      : subscription.status === 'trialing'
                        ? 'First payment on'
                        : 'Next billing date'}
                  </AppText>
                  <AppText style={styles.listValueStrong}>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      dateStyle: 'long',
                    })}
                  </AppText>
                </View>
                {subscription.stripeCustomerId && (
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={handleManageBilling}
                    disabled={portalLoading}
                    style={styles.secondaryBtnWrap}
                  >
                    <View style={styles.secondaryBtn}>
                      <Ionicons name="card-outline" size={20} color={PURPLE} style={{ marginRight: 8 }} />
                      <AppText style={styles.secondaryBtnText}>
                        {portalLoading ? 'Opening…' : 'Manage billing'}
                      </AppText>
                    </View>
                  </TouchableOpacity>
                )}
                {canCancel && (
                  <TouchableOpacity
                    style={styles.destructiveOutline}
                    onPress={handleCancelSubscription}
                    disabled={cancelling}
                    activeOpacity={0.85}
                  >
                    <AppText style={styles.destructiveOutlineText}>
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

          <TouchableOpacity
            style={styles.logoutCard}
            onPress={handleLogout}
            activeOpacity={0.88}
          >
            <Ionicons name="log-out-outline" size={22} color={RED} style={{ marginRight: 10 }} />
            <AppText style={styles.logoutText}>Log out</AppText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: PAGE_BG,
  },
  headerSide: { width: 40 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadowCard,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
  },
  cardHint: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginBottom: 16,
    lineHeight: 18,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTilePurple: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconTileBlue: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountTextCol: { flex: 1 },
  accountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  accountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
  },
  loader: { marginVertical: 16 },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  listRowLast: {
    borderBottomWidth: 0,
    marginBottom: 4,
  },
  listLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_MUTED,
    flex: 1,
    paddingRight: 12,
  },
  listValueStrong: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'right',
    flexShrink: 1,
  },
  secondaryBtnWrap: {
    marginTop: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: MUTED_CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: {
    color: PURPLE,
    fontSize: 15,
    fontWeight: '700',
  },
  destructiveOutline: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: RED,
    backgroundColor: CARD_BG,
  },
  destructiveOutlineText: {
    color: RED,
    fontSize: 15,
    fontWeight: '700',
  },
  cancelNote: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 14,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  muted: { fontSize: 14, color: TEXT_MUTED, lineHeight: 20 },
  input: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  gradientBtnTouchable: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  gradientBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  preferenceShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MUTED_CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  preferenceTextCol: { flex: 1 },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 4,
  },
  preferenceHint: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  preferenceSwitch: { marginLeft: 8 },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  logoutText: {
    color: RED,
    fontSize: 16,
    fontWeight: '700',
  },
});
