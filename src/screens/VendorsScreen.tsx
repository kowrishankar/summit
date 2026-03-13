import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';

export default function VendorsScreen() {
  const { invoices } = useApp();
  const vendorMap = new Map<string, { name: string; count: number; total: number }>();
  invoices.forEach((inv) => {
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
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {item.count} invoice{item.count !== 1 ? 's' : ''} · {formatAmount(item.total, 'GBP')}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No vendors yet. Add invoices first.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  list: { padding: 16 },
  row: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
  meta: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
});
