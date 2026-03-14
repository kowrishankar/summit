import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function AddChoiceScreen({
  navigation,
}: {
  navigation: { navigate: (name: string, params?: object) => void };
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>Add</Text>
      <Text style={styles.subtitle}>Is this an invoice (expense) or a sale (income)?</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AddInvoiceRoot')}
        activeOpacity={0.8}
      >
        <View style={styles.cardIconWrap}>
          <Ionicons name="document-text-outline" size={36} color="#6366f1" />
        </View>
        <Text style={styles.cardTitle}>Invoice (expense)</Text>
        <Text style={styles.cardDesc}>Upload receipt or invoice for money spent</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AddSaleRoot')}
        activeOpacity={0.8}
      >
        <View style={[styles.cardIconWrap, styles.cardIconGreen]}>
          <Ionicons name="trending-up-outline" size={36} color="#22c55e" />
        </View>
        <Text style={styles.cardTitle}>Sale (income)</Text>
        <Text style={styles.cardDesc}>Upload document for money received</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardIconGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 14,
    color: '#94a3b8',
  },
});
