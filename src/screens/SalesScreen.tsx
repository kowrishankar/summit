import React, { useMemo, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  TextInput,
  Alert,
  Text,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBarScrollToTop } from '../hooks/useTabBarScrollToTop';
import { useApp } from '../contexts/AppContext';
import { useAddPreferred } from '../contexts/AddPreferredContext';
import { formatAmount } from '../utils/currency';
import { format } from 'date-fns';
import { groupByReceiptDate } from '../utils/groupByReceiptDate';
import type { Sale, ReviewStatus } from '../types';
import {
  AMBER,
  BORDER,
  CARD_BG,
  GREEN,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  PURPLE_DEEP,
  RED,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

const SALE_TILE = '#ECFDF5';
const SALE_ICON = '#059669';

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

  const listRef = useRef<SectionList<Sale>>(null);
  useTabBarScrollToTop(listRef);

  const filtered = searchSales(query, filterCategoryId ? { categoryId: filterCategoryId } : undefined);
  const sections = useMemo(
    () => groupByReceiptDate(filtered, (s) => s.extracted.date),
    [filtered]
  );

  const reviewStatus = (s: Sale): ReviewStatus => s.reviewStatus ?? 'complete';

  const renderItem = ({ item }: { item: Sale }) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    const rs = reviewStatus(item);
    const openRow = () => {
      if (rs !== 'complete') {
        const navLike = navigation as {
          getParent?: () => { getParent?: () => { navigate: (a: string, b?: object) => void }; navigate: (a: string, b?: object) => void } | undefined;
        };
        const stackOrTab = navLike.getParent?.();
        const tabNav = stackOrTab?.getParent?.() ?? stackOrTab;
        tabNav?.navigate('Add', {
          screen: 'AddSaleRoot',
          params: { recordId: item.id },
        });
        return;
      }
      navigation.navigate('SaleDetail', { saleId: item.id });
    };
    return (
      <TouchableOpacity style={styles.row} onPress={openRow} activeOpacity={0.88}>
        <View style={[styles.rowIcon, { backgroundColor: SALE_TILE }]}>
          <Ionicons name="trending-up-outline" size={22} color={SALE_ICON} />
        </View>
        <View style={styles.rowMain}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.merchant} numberOfLines={1}>
              {item.extracted.merchantName ?? item.extracted.ownedBy ?? 'Unknown'}
            </Text>
            {rs === 'failed' ? (
              <View style={styles.statusPillFailed}>
                <Text style={styles.statusPillFailedText}>Failed</Text>
              </View>
            ) : null}
            {item.extracted.isDuplicate ? (
              <View style={styles.dupPill}>
                <Text style={styles.dupPillText}>Duplicate</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {item.extracted.date ? format(new Date(item.extracted.date), 'EEE, d MMM yyyy') : '—'} ·{' '}
            {cat?.name ?? item.extracted.category ?? 'Uncategorised'}
          </Text>
        </View>
        <View style={styles.rowAside}>
          {rs === 'processing' || rs === 'pending_review' ? (
            <Ionicons name="alert-circle" size={22} color={AMBER} style={styles.rowReviewIcon} />
          ) : rs === 'complete' ? (
            <Ionicons name="checkmark-circle" size={22} color={GREEN} style={styles.rowReviewIcon} />
          ) : null}
          <Text style={styles.amount}>{formatAmount(item.extracted.amount ?? 0, item.extracted.currency)}</Text>
          <TouchableOpacity
            style={styles.trashWrap}
            onPress={() => {
              Alert.alert('Delete sale', 'Remove this sale? This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteSale(item.id) },
              ]);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="trash-outline" size={20} color={RED} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchCard}>
        <Ionicons name="search-outline" size={22} color={TEXT_MUTED} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchant, category…"
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={TEXT_MUTED}
        />
      </View>
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
        ref={listRef}
        style={styles.listContainer}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeader}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: SALE_TILE }]}>
              <Ionicons name="trending-up-outline" size={36} color={SALE_ICON} />
            </View>
            <Text style={styles.emptyTitle}>{sales.length === 0 ? 'No sales yet' : 'No matches'}</Text>
            <Text style={styles.emptySub}>
              {sales.length === 0
                ? 'Record income from the Add tab to build your sales list.'
                : 'Try another search or category filter.'}
            </Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fabOuter}
        activeOpacity={0.92}
        onPress={() =>
          (navigation as { navigate: (a: string, b?: { screen: string }) => void }).navigate('Add', {
            screen: 'AddSaleRoot',
          })
        }
      >
        <LinearGradient
          colors={[PRIMARY, PURPLE_DEEP]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fab}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Add sale</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  listContainer: { flex: 1 },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    ...shadowCardLight,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: TEXT },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MUTED_CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500', textTransform: 'none' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionHeaderWrap: { marginTop: 20, marginBottom: 10 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  merchant: { fontSize: 16, fontWeight: '700', color: TEXT, textTransform: 'none', flexShrink: 1 },
  dupPill: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dupPillText: { fontSize: 10, fontWeight: '800', color: '#C2410C', textTransform: 'uppercase' },
  rowReviewIcon: { marginBottom: 4 },
  statusPillFailed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillFailedText: { fontSize: 10, fontWeight: '800', color: '#B91C1C', textTransform: 'uppercase' },
  meta: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, textTransform: 'none' },
  rowAside: { alignItems: 'flex-end', marginLeft: 8 },
  amount: { fontSize: 16, fontWeight: '800', color: SALE_ICON, letterSpacing: -0.3, textTransform: 'none' },
  trashWrap: { marginTop: 8, padding: 4 },
  emptyWrap: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 32 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 8, textTransform: 'none' },
  emptySub: { fontSize: 15, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 22, textTransform: 'none' },
  fabOuter: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 999,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: PURPLE_DEEP,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700', textTransform: 'none' },
});
