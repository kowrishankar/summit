import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import { startOfWeek, startOfMonth, startOfYear, subMonths } from 'date-fns';

export default function ReportsScreen() {
  const { invoices, sales, spendSummary } = useApp();

  const primaryCurrency = useMemo(() => {
    const counts: Record<string, number> = {};
    [...invoices, ...sales].forEach((item) => {
      const c = (item.extracted.currency ?? 'GBP').toUpperCase();
      counts[c] = (counts[c] || 0) + 1;
    });
    if (Object.keys(counts).length === 0) return 'GBP';
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GBP';
  }, [invoices, sales]);

  const formatCurrency = (n: number) => formatAmount(n, primaryCurrency);

  const incomeSummary = useMemo(() => {
    const weekStart = startOfWeek(new Date()).toISOString().slice(0, 10);
    const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
    const yearStart = startOfYear(new Date()).toISOString().slice(0, 10);
    let week = 0;
    let month = 0;
    let year = 0;
    sales.forEach((s) => {
      const d = s.extracted.date;
      const amt = s.extracted.amount ?? 0;
      if (d >= weekStart) week += amt;
      if (d >= monthStart) month += amt;
      if (d >= yearStart) year += amt;
    });
    return { week, month, year };
  }, [sales]);

  // Spend by month (last 6 months)
  const byMonth: { label: string; total: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = subMonths(new Date(), i);
    const start = startOfMonth(d);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = start.getMonth() === 11
      ? `${start.getFullYear() + 1}-01-01`
      : `${start.getFullYear()}-${String(start.getMonth() + 2).padStart(2, '0')}-01`;
    const total = invoices
      .filter((inv) => inv.extracted.date >= startStr && inv.extracted.date < endStr)
      .reduce((s, inv) => s + (inv.extracted.amount ?? 0), 0);
    byMonth.push({
      label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total,
    });
  }

  // Income by month (last 6 months)
  const incomeByMonth: { label: string; total: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = subMonths(new Date(), i);
    const start = startOfMonth(d);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = start.getMonth() === 11
      ? `${start.getFullYear() + 1}-01-01`
      : `${start.getFullYear()}-${String(start.getMonth() + 2).padStart(2, '0')}-01`;
    const total = sales
      .filter((s) => s.extracted.date >= startStr && s.extracted.date < endStr)
      .reduce((sum, s) => sum + (s.extracted.amount ?? 0), 0);
    incomeByMonth.push({
      label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total,
    });
  }

  const netSummary = useMemo(
    () => ({
      week: incomeSummary.week - spendSummary.week,
      month: incomeSummary.month - spendSummary.month,
      year: incomeSummary.year - spendSummary.year,
    }),
    [incomeSummary, spendSummary]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Reports</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spend summary (expenses)</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This week</Text>
          <Text style={styles.summaryValue}>{formatCurrency(spendSummary.week)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This month</Text>
          <Text style={styles.summaryValue}>{formatCurrency(spendSummary.month)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This year</Text>
          <Text style={styles.summaryValue}>{formatCurrency(spendSummary.year)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Income summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This week</Text>
          <Text style={styles.summaryValueIncome}>{formatCurrency(incomeSummary.week)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This month</Text>
          <Text style={styles.summaryValueIncome}>{formatCurrency(incomeSummary.month)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This year</Text>
          <Text style={styles.summaryValueIncome}>{formatCurrency(incomeSummary.year)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Net (income − expenses)</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This week</Text>
          <Text style={[styles.summaryValue, netSummary.week >= 0 ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(netSummary.week)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This month</Text>
          <Text style={[styles.summaryValue, netSummary.month >= 0 ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(netSummary.month)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>This year</Text>
          <Text style={[styles.summaryValue, netSummary.year >= 0 ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(netSummary.year)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Expenses · last 6 months</Text>
        {byMonth.map((m) => (
          <View key={`exp-${m.label}`} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{m.label}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(m.total)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Income · last 6 months</Text>
        {incomeByMonth.map((m) => (
          <View key={`inc-${m.label}`} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{m.label}</Text>
            <Text style={styles.summaryValueIncome}>{formatCurrency(m.total)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Counts</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Invoices</Text>
          <Text style={styles.summaryValue}>{invoices.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sales</Text>
          <Text style={styles.summaryValueIncome}>{sales.length}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  card: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryLabel: { color: '#94a3b8' },
  summaryValue: { color: '#0f172a', fontWeight: '600' },
  summaryValueIncome: { color: '#22c55e', fontWeight: '600' },
  netPositive: { color: '#22c55e', fontWeight: '600' },
  netNegative: { color: '#ef4444', fontWeight: '600' },
  bigNumber: { fontSize: 32, fontWeight: '700', color: '#6366f1' },
  muted: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
});
