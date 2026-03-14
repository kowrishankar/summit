import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { useAddPreferred } from '../contexts/AddPreferredContext';
import { formatAmount } from '../utils/currency';
import { format } from 'date-fns';
import { groupByReceiptDate } from '../utils/groupByReceiptDate';
import type { Sale } from '../types';

export default function SalesScreen({
  navigation,
}: {
  navigation: { navigate: (s: string, p?: { saleId: string }) => void };
}) {
  const { sales, searchSales, deleteSale, categories } = useApp();
  const { setPreferredAddType } = useAddPreferred();
  const [query, setQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      setPreferredAddType('sale');
      return () => {};
    }, [setPreferredAddType])
  );

  const filtered = searchSales(query, filterCategoryId ? { categoryId: filterCategoryId } : undefined);
  const sections = useMemo(
    () => groupByReceiptDate(filtered, (s) => s.extracted.date),
    [filtered]
  );

  const renderItem = ({ item }: { item: Sale }) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('SaleDetail', { saleId: item.id })}
      >
        <View style={styles.rowLeft}>
          <Text style={styles.merchant} numberOfLines={1}>
            {item.extracted.merchantName ?? item.extracted.ownedBy ?? 'Unknown'}
          </Text>
          <Text style={styles.meta}>
            {item.extracted.date ? format(new Date(item.extracted.date), 'MMM d, yyyy') : '—'} ·{' '}
            {cat?.name ?? item.extracted.category ?? 'Uncategorised'}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.amount}>{formatAmount(item.extracted.amount ?? 0, item.extracted.currency)}</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Delete sale', 'Remove this sale?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteSale(item.id) },
              ])
            }
          >
            <Text style={styles.deleteBtn}>Delete</Text>
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
          <Text style={[styles.chipText, !filterCategoryId && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, filterCategoryId === c.id && styles.chipActive]}
            onPress={() => setFilterCategoryId(filterCategoryId === c.id ? null : c.id)}
          >
            <Text style={[styles.chipText, filterCategoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {sales.length === 0 ? 'No sales yet. Add one from the Add tab.' : 'No matches.'}
          </Text>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as { navigate: (a: string, b?: { screen: string }) => void }).navigate('Add', { screen: 'AddSaleRoot' })}
      >
        <Text style={styles.fabText}>+ Add sale</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  search: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    margin: 16,
    color: '#f8fafc',
    fontSize: 16,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  chipActive: { backgroundColor: '#22c55e' },
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
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  rowLeft: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
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
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
