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
              placeholderTextColor="#64748b"
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', padding: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 80 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  rowActive: { borderWidth: 2, borderColor: '#6366f1' },
  name: { fontSize: 16, color: '#0f172a' },
  badge: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#0f172a', marginBottom: 16 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    color: '#0f172a',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnText: { color: '#94a3b8' },
  modalBtnPrimary: { backgroundColor: '#6366f1', borderRadius: 8 },
  modalBtnTextPrimary: { color: '#fff', fontWeight: '600' },
});
