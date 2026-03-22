import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import AppText from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { useAddPreferred } from '../contexts/AddPreferredContext';
import { formatAmount } from '../utils/currency';
import { format } from 'date-fns';
import { groupByReceiptDate } from '../utils/groupByReceiptDate';
import type { Invoice } from '../types';

export default function InvoicesScreen({
  navigation,
}: {
  navigation: { navigate: (s: string, p?: { invoiceId: string }) => void };
}) {
  const { invoices, searchInvoices, deleteInvoice, categories } = useApp();
  const { setPreferredAddType } = useAddPreferred();
  const [query, setQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      setPreferredAddType('invoice');
      return () => {};
    }, [setPreferredAddType])
  );

  const filtered = searchInvoices(query, filterCategoryId ? { categoryId: filterCategoryId } : undefined);
  const sections = useMemo(
    () => groupByReceiptDate(filtered, (inv) => inv.extracted.date),
    [filtered]
  );

  const renderItem = ({ item }: { item: Invoice }) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
      >
        <View style={styles.rowLeft}>
          <AppText style={styles.merchant} numberOfLines={1}>
            {item.extracted.merchantName ?? 'Unknown'}
          </AppText>
          <AppText style={styles.meta}>
            {item.extracted.date ? format(new Date(item.extracted.date), 'MMM d, yyyy') : '—'} ·{' '}
            {cat?.name ?? item.extracted.category ?? 'Uncategorised'}
          </AppText>
        </View>
        <View style={styles.rowRight}>
          <AppText style={styles.amount}>{formatAmount(item.extracted.amount ?? 0, item.extracted.currency)}</AppText>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Delete invoice', 'Remove this invoice?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteInvoice(item.id) },
              ])
            }
          >
            <AppText style={styles.deleteBtn}>Delete</AppText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by merchant or category..."
        value={query}
        onChangeText={setQuery}
        placeholderTextColor="#64748b"
      />
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.chip, !filterCategoryId && styles.chipActive]}
          onPress={() => setFilterCategoryId(null)}
        >
          <AppText style={[styles.chipText, !filterCategoryId && styles.chipTextActive]}>All</AppText>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, filterCategoryId === c.id && styles.chipActive]}
            onPress={() => setFilterCategoryId(filterCategoryId === c.id ? null : c.id)}
          >
            <AppText style={[styles.chipText, filterCategoryId === c.id && styles.chipTextActive]}>{c.name}</AppText>
          </TouchableOpacity>
        ))}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <AppText style={styles.sectionHeader}>{title}</AppText>
        )}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <AppText style={styles.empty}>
            {invoices.length === 0 ? 'No invoices yet. Add one from Home.' : 'No matches.'}
          </AppText>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as { navigate: (a: string, b?: { screen: string }) => void }).navigate('Add', { screen: 'AddInvoiceRoot' })}
      >
        <AppText style={styles.fabText}>+ Add invoice</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  search: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    margin: 16,
    color: '#0f172a',
    fontSize: 16,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { color: '#94a3b8', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, paddingBottom: 80 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  rowLeft: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  rowRight: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '600', color: '#22c55e' },
  deleteBtn: { fontSize: 12, color: '#ef4444', marginTop: 4 },
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
});
