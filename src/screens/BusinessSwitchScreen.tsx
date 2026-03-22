import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
} from 'react-native';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
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
  const { businesses, currentBusiness, switchBusiness, addBusiness } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSwitch = async (b: BusinessAccount) => {
    await switchBusiness(b.id);
    navigation.goBack();
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addBusiness(newName.trim());
      setNewName('');
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add business');
    }
  };

  return (
    <View style={styles.container}>
      <AppText style={styles.title}>Business accounts</AppText>
      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, currentBusiness?.id === item.id && styles.rowActive]}
            onPress={() => handleSwitch(item)}
          >
            <AppText style={styles.name}>{item.name}</AppText>
            {currentBusiness?.id === item.id && <AppText style={styles.badge}>Current</AppText>}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <AppText style={styles.fabText}>+ Add business</AppText>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <AppText style={styles.modalTitle}>New business</AppText>
            <TextInput
              style={styles.input}
              placeholder="Business name"
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor={TEXT_MUTED}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                <AppText style={styles.modalBtnText}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleAdd}>
                <AppText style={styles.modalBtnTextPrimary}>Add</AppText>
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
  title: { fontSize: 20, fontWeight: '700', color: TEXT, padding: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 80 },
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
  name: { fontSize: 16, fontWeight: '600', color: TEXT },
  badge: { fontSize: 12, color: PRIMARY, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 16 },
  input: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    color: TEXT,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnText: { color: TEXT_SECONDARY, fontWeight: '600' },
  modalBtnPrimary: { backgroundColor: PRIMARY, borderRadius: 12 },
  modalBtnTextPrimary: { color: '#fff', fontWeight: '700' },
});
