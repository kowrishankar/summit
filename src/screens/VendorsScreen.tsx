import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import {
  BORDER,
  CARD_BG,
  PAGE_BG,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

export default function VendorsScreen() {
  const { invoices } = useApp();
  const vendorMap = new Map<string, { name: string; count: number; total: number }>();
  invoices.forEach((inv) => {
    if ((inv.reviewStatus ?? 'complete') !== 'complete') return;
    const name = inv.extracted.merchantName ?? 'Unknown';
    const existing = vendorMap.get(name);
    const amt = inv.extracted.amount ?? 0;
    if (existing) {
      existing.count += 1;
      existing.total += amt;
    } else {
      vendorMap.set(name, { name, count: 1, total: amt });
    }
  });
  const vendors = Array.from(vendorMap.values()).sort((a, b) => b.total - a.total);

  return (
    <View style={styles.container}>
      <FlatList
        data={vendors}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <AppText style={styles.name} numberOfLines={1}>
              {item.name}
            </AppText>
            <AppText style={styles.meta}>
              {item.count} invoice{item.count !== 1 ? 's' : ''} · {formatAmount(item.total, 'GBP')}
            </AppText>
          </View>
        )}
        ListEmptyComponent={<AppText style={styles.empty}>No vendors yet. Add invoices first.</AppText>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  list: { padding: 16 },
  row: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  name: { fontSize: 16, fontWeight: '600', color: TEXT },
  meta: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  empty: { color: TEXT_MUTED, textAlign: 'center', marginTop: 40 },
});
