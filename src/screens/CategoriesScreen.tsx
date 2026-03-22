import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import type { Category } from '../types';
import {
  BORDER,
  CARD_BG,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  RED,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

export default function CategoriesScreen() {
  const { categories, addCategory, updateCategory, deleteCategory } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await addCategory(name.trim());
      setName('');
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add category');
    }
  };

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editName.trim()) return;
    try {
      await updateCategory(editingCategory.id, { name: editName.trim() });
      setEditModalVisible(false);
      setEditingCategory(null);
      setEditName('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    }
  };

  const handleDelete = (cat: Category) => {
    Alert.alert('Delete category', `Remove "${cat.name}"? Invoices in this category will become uncategorised.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(cat.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.colorDot, { backgroundColor: item.color ?? PRIMARY }]} />
            <AppText style={styles.name}>{item.name}</AppText>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => handleEdit(item)}>
                <AppText style={styles.actionText}>Edit</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <AppText style={[styles.actionText, styles.deleteText]}>Delete</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<AppText style={styles.empty}>No categories. Create one below.</AppText>}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <AppText style={styles.fabText}>+ New category</AppText>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <AppText style={styles.modalTitle}>New category</AppText>
            <TextInput
              style={styles.input}
              placeholder="Category name"
              value={name}
              onChangeText={setName}
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

      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <AppText style={styles.modalTitle}>Edit category</AppText>
            <TextInput
              style={styles.input}
              placeholder="Category name"
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={TEXT_MUTED}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setEditModalVisible(false)}>
                <AppText style={styles.modalBtnText}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveEdit}>
                <AppText style={styles.modalBtnTextPrimary}>Save</AppText>
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
  list: { padding: 16, paddingBottom: 80 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: TEXT },
  actions: { flexDirection: 'row', gap: 16 },
  actionText: { color: PRIMARY, fontSize: 14, fontWeight: '600' },
  deleteText: { color: RED },
  empty: { color: TEXT_MUTED, textAlign: 'center', marginTop: 40 },
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
