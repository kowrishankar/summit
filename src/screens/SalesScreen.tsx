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
import type { Sale } from '../types';
import {
  BORDER,
  CARD_BG,
  GREEN,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  RED,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

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
          <AppText style={styles.merchant} numberOfLines={1}>
            {item.extracted.merchantName ?? item.extracted.ownedBy ?? 'Unknown'}
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
              Alert.alert('Delete sale', 'Remove this sale?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteSale(item.id) },
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
        placeholderTextColor={TEXT_MUTED}
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
        style={styles.listContainer}
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
            {sales.length === 0 ? 'No sales yet. Add one from the Add tab.' : 'No matches.'}
          </AppText>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => (navigation as { navigate: (a: string, b?: { screen: string }) => void }).navigate('Add', { screen: 'AddSaleRoot' })}
      >
        <AppText style={styles.fabText}>+ Add sale</AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  search: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    margin: 16,
    color: TEXT,
    fontSize: 16,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MUTED_CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: TEXT_SECONDARY, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  listContainer: { flex: 1 },
  list: { padding: 16, paddingBottom: 80 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  rowLeft: { flex: 1 },
  merchant: { fontSize: 16, fontWeight: '600', color: TEXT },
  meta: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  rowRight: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '600', color: GREEN },
  deleteBtn: { fontSize: 12, color: RED, marginTop: 4 },
  empty: { color: TEXT_MUTED, textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: GREEN,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
