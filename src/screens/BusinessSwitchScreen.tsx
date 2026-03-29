import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  SectionList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import * as practiceHandoff from '../services/practiceHandoff';
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
  const [modalVisible, setModalVisible] = useState(false);
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
        Alert.alert(
          'Send claim code to client',
          `Email or message ${em} with this code. They must create an account or sign in with that exact email, then use Settings → Claim a business from your accountant.\n\n${invite.token}`
        );
      } else {
        await addBusiness(newName.trim());
        setNewName('');
        setModalVisible(false);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add business');
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
          ? 'Switch between client workspaces. Workspaces awaiting claim still belong to your login until the owner accepts the code you sent. Client businesses you’ve been invited to appear under Shared with you.'
          : 'Tap a business to switch workspace. Use the card on Home anytime. “Shared with you” means you were invited—those businesses belong to another login.'}
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
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => void handleAdd()}>
                <AppText style={styles.modalBtnTextPrimary}>{isPractice ? 'Create & get code' : 'Add'}</AppText>
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
    marginTop: 4,
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
