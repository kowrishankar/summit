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
            <View style={[styles.colorDot, { backgroundColor: item.color ?? '#6366f1' }]} />
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

      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <AppText style={styles.modalTitle}>Edit category</AppText>
            <TextInput
              style={styles.input}
              placeholder="Category name"
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor="#64748b"
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  list: { padding: 16, paddingBottom: 80 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  name: { flex: 1, fontSize: 16, color: '#0f172a' },
  actions: { flexDirection: 'row', gap: 16 },
  actionText: { color: '#818cf8', fontSize: 14 },
  deleteText: { color: '#ef4444' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
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
