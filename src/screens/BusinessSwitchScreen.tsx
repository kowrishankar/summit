import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  SectionList,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripe } from '@stripe/stripe-react-native';
import AppText from '../components/AppText';
import { PLAN_AMOUNT_PENCE } from '../config/pricing';
import { isStripePublishableKeyConfigured } from '../config/stripeEnv';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import * as practiceHandoff from '../services/practiceHandoff';
import * as supabaseData from '../services/supabaseData';
import { prepareSubscriptionPayment, confirmSubscription } from '../services/stripeApi';
import type { BusinessAccount } from '../types';
import {
  BORDER,
  CARD_BG,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

export default function BusinessSwitchScreen({
  navigation,
}: {
  navigation: { goBack: () => void };
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { businesses, currentBusiness, switchBusiness, addBusiness, reloadBusinessData } = useApp();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [modalVisible, setModalVisible] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [pendingHandoffs, setPendingHandoffs] = useState<Awaited<
    ReturnType<typeof practiceHandoff.listHandoffsForPractice>
  >>([]);

  const isPractice = user?.accountKind === 'practice';

  const loadHandoffs = useCallback(async () => {
    if (!isPractice || !user?.id) {
      setPendingHandoffs([]);
      return;
    }
    const list = await practiceHandoff.listHandoffsForPractice(user.id);
    setPendingHandoffs(list);
  }, [isPractice, user?.id]);

  useEffect(() => {
    void loadHandoffs();
  }, [loadHandoffs]);

  const handoffByBusinessId = useMemo(() => {
    const m = new Map<string, (typeof pendingHandoffs)[0]>();
    pendingHandoffs.forEach((h) => m.set(h.businessId, h));
    return m;
  }, [pendingHandoffs]);

  const sections = useMemo(() => {
    const uid = user?.id;
    const owned = uid ? businesses.filter((b) => b.userId === uid) : businesses;
    const shared = uid ? businesses.filter((b) => b.userId !== uid) : [];
    const out: { title: string; data: BusinessAccount[] }[] = [];
    if (owned.length > 0) {
      out.push({
        title: isPractice ? 'Your practice workspaces' : 'Your businesses',
        data: owned,
      });
    }
    if (shared.length > 0) {
      out.push({
        title: 'Shared with you',
        data: shared,
      });
    }
    if (out.length === 0 && businesses.length > 0) {
      out.push({ title: 'Businesses', data: businesses });
    }
    return out;
  }, [businesses, user?.id, isPractice]);

  const handleSwitch = async (b: BusinessAccount) => {
    await switchBusiness(b.id);
    navigation.goBack();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      if (isPractice) {
        const em = clientEmail.trim().toLowerCase();
        if (!em) {
          Alert.alert('Error', 'Enter the business owner’s email so they can claim this workspace.');
          return;
        }
        if (!user?.id) return;

        const owned = businesses.filter((b) => b.userId === user.id);
        const needsAdditionalSubscription = owned.length >= 1;

        if (needsAdditionalSubscription) {
          if (Platform.OS === 'web') {
            Alert.alert(
              'Use the app',
              'Adding another client workspace requires payment. Open Summit on iOS or Android.'
            );
            return;
          }
          if (!isStripePublishableKeyConfigured()) {
            Alert.alert('Payment not configured', 'This build does not include Stripe keys.');
            return;
          }
          if (!user.email) {
            Alert.alert('Error', 'Your account email is required for billing.');
            return;
          }
          setPayLoading(true);
          const returnURL = 'summit://stripe-redirect';
          const subResponse = await prepareSubscriptionPayment(user.email, {
            accountKind: 'practice',
            additionalPracticeSlot: true,
          });
          if (subResponse.status === 'requires_payment' && subResponse.clientSecret) {
            const { error: initError } = await initPaymentSheet({
              paymentIntentClientSecret: subResponse.clientSecret,
              merchantDisplayName: 'Summit',
              returnURL,
            });
            if (initError) {
              Alert.alert('Error', initError.message ?? 'Could not initialize payment.');
              return;
            }
            const { error: presentError } = await presentPaymentSheet();
            if (presentError) {
              if (presentError.code !== 'Canceled') {
                Alert.alert('Payment failed', presentError.message ?? 'Payment failed.');
              }
              return;
            }
            await new Promise((r) => setTimeout(r, 800));
          }
          const confirmed = await confirmSubscription(subResponse.subscriptionId);
          const currentPeriodEnd =
            confirmed.currentPeriodEnd ??
            subResponse.currentPeriodEnd ??
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const { business, invite } = await practiceHandoff.createClientBusinessWithHandoff(
            user.id,
            newName.trim(),
            em,
            clientAddress.trim() || undefined
          );
          try {
            await supabaseData.insertPracticeSubscriptionAddon({
              userId: user.id,
              businessId: business.id,
              stripeSubscriptionId: subResponse.subscriptionId,
              amountPence: PLAN_AMOUNT_PENCE.practice,
              status: confirmed.status,
              currentPeriodEnd,
            });
          } catch (addonErr) {
            console.warn('[BusinessSwitch] practice_subscription_addons', addonErr);
            Alert.alert(
              'Subscription note',
              'Payment succeeded, but we could not save the add-on record. Check docs/SUPABASE-SETUP.md for the practice_subscription_addons table, or contact support.'
            );
          }

          setNewName('');
          setClientEmail('');
          setClientAddress('');
          setModalVisible(false);
          await reloadBusinessData();
          await loadHandoffs();
          const token = invite.token;
          const body = `Email or message ${em} with this code. They sign up with that email and choose “Invited by Practice, or use Settings → Claim a business—no separate Summit payment.\n\n${token}`;
          Alert.alert('Send claim code to client', body, [
            {
              text: 'Copy code',
              onPress: async () => {
                try {
                  await Clipboard.setStringAsync(token);
                  Alert.alert('Copied', 'Claim code copied to clipboard.');
                } catch {
                  Alert.alert('Copy failed', 'Copy the code from the message above.');
                }
              },
            },
            { text: 'OK', style: 'cancel' },
          ]);
          return;
        }

        const { invite } = await practiceHandoff.createClientBusinessWithHandoff(
          user.id,
          newName.trim(),
          em,
          clientAddress.trim() || undefined
        );
        setNewName('');
        setClientEmail('');
        setClientAddress('');
        setModalVisible(false);
        await reloadBusinessData();
        await loadHandoffs();
        const token = invite.token;
        const body = `Email or message ${em} with this code. They sign up with that email and choose “Invited by Practice, or use Settings → Claim a business—no separate Summit payment.\n\n${token}`;
        Alert.alert('Send claim code to client', body, [
          {
            text: 'Copy code',
            onPress: async () => {
              try {
                await Clipboard.setStringAsync(token);
                Alert.alert('Copied', 'Claim code copied to clipboard.');
              } catch {
                Alert.alert('Copy failed', 'Copy the code from the message above.');
              }
            },
          },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        await addBusiness(newName.trim());
        setNewName('');
        setModalVisible(false);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add business');
    } finally {
      setPayLoading(false);
    }
  };

  const renderItem = ({ item }: { item: BusinessAccount }) => {
    const isShared = Boolean(user && item.userId !== user.id);
    const awaitingClaim =
      isPractice && user && item.userId === user.id && handoffByBusinessId.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.row, currentBusiness?.id === item.id && styles.rowActive]}
        onPress={() => handleSwitch(item)}
      >
        <View style={styles.rowMain}>
          <AppText style={styles.name}>{item.name}</AppText>
          <View style={styles.rowMeta}>
            {awaitingClaim && (
              <View style={styles.pendingBadge}>
                <AppText style={styles.pendingBadgeText}>Awaiting client claim</AppText>
              </View>
            )}
            {isShared && (
              <View style={styles.sharedBadge}>
                <AppText style={styles.sharedBadgeText}>Another account</AppText>
              </View>
            )}
            {currentBusiness?.id === item.id && <AppText style={styles.badge}>Current</AppText>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <AppText style={styles.subtitle}>
        {isPractice
          ? 'Switch between client workspaces and edit each one’s details in Settings. Workspaces awaiting claim stay on your login until the client uses your code. After they claim, the business stays in your list with shared access.'
          : 'Tap a business to switch workspace. Use the card on Home anytime. “Another account” means that workspace is linked from someone else (e.g. your accountant) while you use it.'}
      </AppText>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <AppText style={styles.sectionTitle}>{title}</AppText>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <AppText style={styles.empty}>
            {isPractice ? 'No workspaces yet. Add a client business below.' : 'No businesses yet. Add one below.'}
          </AppText>
        }
        stickySectionHeadersEnabled={false}
      />

      <TouchableOpacity style={[styles.fab, { bottom: 24 + insets.bottom }]} onPress={() => setModalVisible(true)}>
        <AppText style={styles.fabText}>{isPractice ? '+ Add client business' : '+ Add business'}</AppText>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <AppText style={styles.modalTitle}>{isPractice ? 'New client business' : 'New business'}</AppText>
            {isPractice && (
              <AppText style={styles.modalHint}>
                The client’s email must match the account they use to claim. You’ll get a code to send them.
                {user?.id &&
                businesses.filter((b) => b.userId === user.id).length >= 1 &&
                Platform.OS !== 'web'
                  ? ` Each additional workspace after your first is £${(PLAN_AMOUNT_PENCE.practice / 100).toFixed(2)}/month.`
                  : ''}
              </AppText>
            )}
            <TextInput
              style={styles.input}
              placeholder={isPractice ? 'Client business name' : 'Business name'}
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor={TEXT_MUTED}
            />
            {isPractice && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Business owner email *"
                  value={clientEmail}
                  onChangeText={setClientEmail}
                  placeholderTextColor={TEXT_MUTED}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Business address (optional)"
                  value={clientAddress}
                  onChangeText={setClientAddress}
                  placeholderTextColor={TEXT_MUTED}
                />
              </>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                <AppText style={styles.modalBtnText}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => void handleAdd()}
                disabled={payLoading}
              >
                {payLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <AppText style={styles.modalBtnTextPrimary}>{isPractice ? 'Create & get code' : 'Add'}</AppText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_MUTED,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  empty: { fontSize: 15, color: TEXT_MUTED, textAlign: 'center', marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  rowActive: { borderWidth: 2, borderColor: PRIMARY },
  rowMain: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: TEXT },
  rowMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6, gap: 8 },
  sharedBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sharedBadgeText: { fontSize: 11, fontWeight: '700', color: '#C2410C' },
  pendingBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#3730A3' },
  badge: { fontSize: 12, color: PRIMARY, fontWeight: '700' },
  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: PRIMARY,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: { backgroundColor: CARD_BG, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 8 },
  modalHint: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
    marginBottom: 12,
  },
  input: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    color: TEXT,
    fontSize: 16,
    marginBottom: 12,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnText: { color: TEXT_SECONDARY, fontWeight: '600' },
  modalBtnPrimary: { backgroundColor: PRIMARY, borderRadius: 12 },
  modalBtnTextPrimary: { color: '#fff', fontWeight: '700' },
});
