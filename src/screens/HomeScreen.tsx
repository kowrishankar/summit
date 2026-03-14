import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { formatAmount } from '../utils/currency';
import { startOfWeek, startOfMonth, startOfYear, endOfMonth } from 'date-fns';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HomeScreen({
  navigation,
}: {
  navigation: { navigate: (s: string) => void; getParent?: () => { navigate: (s: string) => void } | undefined };
}) {
  const { spendSummary, invoices, sales, currentBusiness, categories } = useApp();
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const availableYears = useMemo(() => {
    let minYear = currentYear;
    [...invoices, ...sales].forEach((item) => {
      const y = item.extracted.date?.slice(0, 4);
      if (y) {
        const n = parseInt(y, 10);
        if (n < minYear) minYear = n;
      }
    });
    const list: number[] = [];
    for (let y = currentYear; y >= minYear; y--) list.push(y);
    return list;
  }, [invoices, sales, currentYear]);

  const invoicesForYear = useMemo(
    () =>
      invoices.filter((inv) => {
        const d = inv.extracted.date;
        return d && d.slice(0, 4) === String(selectedYear);
      }),
    [invoices, selectedYear]
  );

  const salesForYear = useMemo(
    () =>
      sales.filter((s) => {
        const d = s.extracted.date;
        return d && d.slice(0, 4) === String(selectedYear);
      }),
    [sales, selectedYear]
  );

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

  const isCurrentYear = selectedYear === currentYear;

  const yearSummary = useMemo(() => {
    let spend = 0;
    let tax = 0;
    invoicesForYear.forEach((inv) => {
      spend += inv.extracted.amount ?? 0;
      tax += inv.extracted.vatAmount ?? 0;
    });
    return { spend, tax, count: invoicesForYear.length };
  }, [invoicesForYear]);

  const incomeSummary = useMemo(() => {
    const weekStartStr = startOfWeek(new Date()).toISOString().slice(0, 10);
    const monthStartStr = startOfMonth(new Date()).toISOString().slice(0, 10);
    const yearStartStr = startOfYear(new Date()).toISOString().slice(0, 10);
    let week = 0;
    let month = 0;
    let year = 0;
    sales.forEach((s) => {
      const d = s.extracted.date;
      const amt = s.extracted.amount ?? 0;
      if (d >= weekStartStr) week += amt;
      if (d >= monthStartStr) month += amt;
      if (d >= yearStartStr) year += amt;
    });
    return { week, month, year };
  }, [sales]);

  const yearIncomeSummary = useMemo(() => {
    let income = 0;
    salesForYear.forEach((s) => {
      income += s.extracted.amount ?? 0;
    });
    return { income, count: salesForYear.length };
  }, [salesForYear]);

  const monthStart = startOfMonth(new Date(selectedYear, isCurrentYear ? new Date().getMonth() : 0, 1));
  const monthEnd = endOfMonth(monthStart);
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const monthEndStr = monthEnd.toISOString().slice(0, 10);

  const weeklySpend = useMemo(() => {
    if (!isCurrentYear) return null;
    const weeks: { label: string; total: number }[] = [
      { label: 'W1', total: 0 },
      { label: 'W2', total: 0 },
      { label: 'W3', total: 0 },
      { label: 'W4', total: 0 },
      { label: 'W5', total: 0 },
    ];
    invoicesForYear.forEach((inv) => {
      const d = inv.extracted.date;
      if (d < monthStartStr || d > monthEndStr) return;
      const day = parseInt(d.slice(8, 10), 10);
      const weekIndex = Math.min(Math.floor((day - 1) / 7), 4);
      weeks[weekIndex].total += inv.extracted.amount ?? 0;
    });
    return weeks;
  }, [invoicesForYear, monthStartStr, monthEndStr, isCurrentYear]);

  const monthlySpend = useMemo(() => {
    const months = MONTH_LABELS.map((label, i) => ({ label, total: 0, month: i + 1 }));
    const yearStr = String(selectedYear);
    invoicesForYear.forEach((inv) => {
      const d = inv.extracted.date;
      if (!d || d.slice(0, 4) !== yearStr) return;
      const monthNum = parseInt(d.slice(5, 7), 10);
      if (monthNum >= 1 && monthNum <= 12) months[monthNum - 1].total += inv.extracted.amount ?? 0;
    });
    return months;
  }, [invoicesForYear, selectedYear]);

  const maxMonthSpend = useMemo(
    () => Math.max(1, ...monthlySpend.map((m) => m.total)),
    [monthlySpend]
  );

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number; color?: string }>();
    map.set('__uncategorized__', { name: 'Uncategorised', total: 0 });
    categories.forEach((c) => map.set(c.id, { name: c.name, total: 0, color: c.color }));
    invoicesForYear.forEach((inv) => {
      const amt = inv.extracted.amount ?? 0;
      const key = inv.categoryId ?? '__uncategorized__';
      const entry = map.get(key);
      if (entry) entry.total += amt;
      else map.set(key, { name: 'Uncategorised', total: amt });
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [invoicesForYear, categories]);

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number; color?: string }>();
    map.set('__uncategorized__', { name: 'Uncategorised', total: 0 });
    categories.forEach((c) => map.set(c.id, { name: c.name, total: 0, color: c.color }));
    salesForYear.forEach((s) => {
      const amt = s.extracted.amount ?? 0;
      const key = s.categoryId ?? '__uncategorized__';
      const entry = map.get(key);
      if (entry) entry.total += amt;
      else map.set(key, { name: 'Uncategorised', total: amt });
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [salesForYear, categories]);

  const totalForCategories = useMemo(
    () => spendingByCategory.reduce((s, c) => s + c.total, 0),
    [spendingByCategory]
  );

  const totalForIncomeCategories = useMemo(
    () => incomeByCategory.reduce((s, c) => s + c.total, 0),
    [incomeByCategory]
  );

  const netCurrent = useMemo(() => {
    if (!isCurrentYear) return null;
    return {
      week: incomeSummary.week - spendSummary.week,
      month: incomeSummary.month - spendSummary.month,
      year: incomeSummary.year - spendSummary.year,
    };
  }, [isCurrentYear, incomeSummary, spendSummary]);

  const netYear = useMemo(() => {
    return yearIncomeSummary.income - yearSummary.spend;
  }, [yearIncomeSummary, yearSummary]);

  const maxWeekSpend = useMemo(
    () => (weeklySpend ? Math.max(1, ...weeklySpend.map((w) => w.total)) : 1),
    [weeklySpend]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.email?.split('@')[0] ?? 'User'}</Text>
          <Text style={styles.business}>{currentBusiness?.name ?? 'No business'}</Text>
        </View>
        <TouchableOpacity style={styles.switchBtn} onPress={() => navigation.navigate('BusinessSwitch')}>
          <Text style={styles.switchBtnText}>Switch</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Year</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.yearRow}
        style={styles.yearScroll}
      >
        {availableYears.map((y) => (
          <TouchableOpacity
            key={y}
            style={[styles.yearPill, selectedYear === y && styles.yearPillActive]}
            onPress={() => setSelectedYear(y)}
          >
            <Text style={[styles.yearPillText, selectedYear === y && styles.yearPillTextActive]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Expenses</Text>
      <View style={styles.cards}>
        {isCurrentYear ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>This week</Text>
              <Text style={styles.cardValue}>{formatCurrency(spendSummary.week)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>This month</Text>
              <Text style={styles.cardValue}>{formatCurrency(spendSummary.month)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>This year</Text>
              <Text style={styles.cardValue}>{formatCurrency(spendSummary.year)}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{selectedYear} expenses</Text>
              <Text style={styles.cardValue}>{formatCurrency(yearSummary.spend)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Tax {selectedYear}</Text>
              <Text style={styles.cardValue}>{formatCurrency(yearSummary.tax)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Invoices</Text>
              <Text style={styles.cardValue}>{yearSummary.count}</Text>
            </View>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Income</Text>
      <View style={styles.cards}>
        {isCurrentYear ? (
          <>
            <View style={styles.cardIncome}>
              <Text style={styles.cardLabel}>This week</Text>
              <Text style={styles.cardValueIncome}>{formatCurrency(incomeSummary.week)}</Text>
            </View>
            <View style={styles.cardIncome}>
              <Text style={styles.cardLabel}>This month</Text>
              <Text style={styles.cardValueIncome}>{formatCurrency(incomeSummary.month)}</Text>
            </View>
            <View style={styles.cardIncome}>
              <Text style={styles.cardLabel}>This year</Text>
              <Text style={styles.cardValueIncome}>{formatCurrency(incomeSummary.year)}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.cardIncome}>
              <Text style={styles.cardLabel}>{selectedYear} income</Text>
              <Text style={styles.cardValueIncome}>{formatCurrency(yearIncomeSummary.income)}</Text>
            </View>
            <View style={styles.cardIncome}>
              <Text style={styles.cardLabel}>Sales</Text>
              <Text style={styles.cardValueIncome}>{yearIncomeSummary.count}</Text>
            </View>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Net</Text>
      <View style={styles.netCard}>
        {isCurrentYear && netCurrent ? (
          <>
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>This week</Text>
              <Text style={[styles.netValue, netCurrent.week >= 0 ? styles.netPositive : styles.netNegative]}>
                {formatCurrency(netCurrent.week)}
              </Text>
            </View>
            <View style={styles.netDivider} />
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>This month</Text>
              <Text style={[styles.netValue, netCurrent.month >= 0 ? styles.netPositive : styles.netNegative]}>
                {formatCurrency(netCurrent.month)}
              </Text>
            </View>
            <View style={styles.netDivider} />
            <View style={styles.netRow}>
              <Text style={styles.netLabel}>This year</Text>
              <Text style={[styles.netValue, netCurrent.year >= 0 ? styles.netPositive : styles.netNegative]}>
                {formatCurrency(netCurrent.year)}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>{selectedYear} net</Text>
            <Text style={[styles.netValue, netYear >= 0 ? styles.netPositive : styles.netNegative]}>
              {formatCurrency(netYear)}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Tax paid</Text>
      <View style={styles.taxRow}>
        {isCurrentYear ? (
          <>
            <View style={styles.taxItem}>
              <Text style={styles.taxLabel}>Week</Text>
              <Text style={styles.taxValue}>{formatCurrency(spendSummary.taxWeek)}</Text>
            </View>
            <View style={styles.taxDivider} />
            <View style={styles.taxItem}>
              <Text style={styles.taxLabel}>Month</Text>
              <Text style={styles.taxValue}>{formatCurrency(spendSummary.taxMonth)}</Text>
            </View>
            <View style={styles.taxDivider} />
            <View style={styles.taxItem}>
              <Text style={styles.taxLabel}>Year</Text>
              <Text style={styles.taxValue}>{formatCurrency(spendSummary.taxYear)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.taxItem}>
            <Text style={styles.taxLabel}>{selectedYear} tax</Text>
            <Text style={styles.taxValue}>{formatCurrency(yearSummary.tax)}</Text>
          </View>
        )}
      </View>

      {isCurrentYear && weeklySpend ? (
        <>
          <Text style={styles.sectionTitle}>Spending this month</Text>
          <View style={styles.chart}>
            {weeklySpend.map((w, i) => {
              const barHeightPct = maxWeekSpend > 0 ? w.total / maxWeekSpend : 0;
              const barHeight = Math.max(4, Math.round(barHeightPct * 100));
              return (
                <View key={i} style={styles.chartBarWrap}>
                  <View style={styles.chartBarOuter}>
                    <View style={[styles.chartBar, { height: `${barHeight}%` }]} />
                  </View>
                  <Text style={styles.chartBarLabel} numberOfLines={1}>{formatCurrency(w.total)}</Text>
                  <Text style={styles.chartBarWeek}>{w.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.chartHint}>Week 1–7 · 8–14 · 15–21 · 22–28 · 29–31</Text>
        </>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Spending by month · {selectedYear}</Text>
          <View style={styles.chart}>
            {monthlySpend.map((m, i) => {
              const barHeightPct = maxMonthSpend > 0 ? m.total / maxMonthSpend : 0;
              const barHeight = Math.max(4, Math.round(barHeightPct * 100));
              return (
                <View key={i} style={styles.chartBarWrap}>
                  <View style={styles.chartBarOuter}>
                    <View style={[styles.chartBar, { height: `${barHeight}%` }]} />
                  </View>
                  <Text style={styles.chartBarLabel} numberOfLines={1}>{formatCurrency(m.total)}</Text>
                  <Text style={styles.chartBarWeek}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>Expenses by category {!isCurrentYear && `· ${selectedYear}`}</Text>
      {spendingByCategory.length === 0 ? (
        <Text style={styles.empty}>No expenses in {selectedYear}.</Text>
      ) : (
        <View style={styles.categoryList}>
          {spendingByCategory.map((cat) => {
            const pct = totalForCategories > 0 ? (cat.total / totalForCategories) * 100 : 0;
            return (
              <View key={`exp-${cat.id}`} style={styles.categoryRow}>
                <View style={styles.categoryRowTop}>
                  <View style={[styles.categoryDot, cat.color ? { backgroundColor: cat.color } : null]} />
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.categoryAmount}>{formatCurrency(cat.total)}</Text>
                </View>
                <View style={styles.categoryBarBg}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      { width: `${pct}%` },
                      cat.color ? { backgroundColor: cat.color } : null,
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Income by category {!isCurrentYear && `· ${selectedYear}`}</Text>
      {incomeByCategory.length === 0 ? (
        <Text style={styles.empty}>No income in {selectedYear}.</Text>
      ) : (
        <View style={styles.categoryList}>
          {incomeByCategory.map((cat) => {
            const pct = totalForIncomeCategories > 0 ? (cat.total / totalForIncomeCategories) * 100 : 0;
            return (
              <View key={`inc-${cat.id}`} style={styles.categoryRow}>
                <View style={styles.categoryRowTop}>
                  <View style={[styles.categoryDotIncome, cat.color ? { backgroundColor: cat.color } : null]} />
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.categoryAmountIncome}>{formatCurrency(cat.total)}</Text>
                </View>
                <View style={styles.categoryBarBg}>
                  <View
                    style={[
                      styles.categoryBarFillIncome,
                      { width: `${pct}%` },
                      cat.color ? { backgroundColor: cat.color } : null,
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick access</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.getParent?.()?.navigate('Records', { screen: 'InvoicesList' })}>
          <Text style={styles.quickNumber}>{invoices.length}</Text>
          <Text style={styles.quickLabel}>Invoices</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.getParent?.()?.navigate('Records', { screen: 'SalesList' })}>
          <Text style={styles.quickNumberIncome}>{sales.length}</Text>
          <Text style={styles.quickLabel}>Sales</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.getParent?.()?.navigate('Reports')}>
          <Text style={styles.quickLabel}>Reports</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  business: { fontSize: 14, color: '#94a3b8' },
  switchBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  switchBtnText: { color: '#818cf8', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#334155', marginBottom: 12 },
  yearScroll: { marginBottom: 16, maxHeight: 44 },
  yearRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  yearPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  yearPillActive: { backgroundColor: '#6366f1' },
  yearPillText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  yearPillTextActive: { color: '#fff' },
  cards: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  cardLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4 },
  cardValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardIncome: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  cardValueIncome: { fontSize: 16, fontWeight: '700', color: '#22c55e' },
  netCard: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  netRow: { flex: 1, alignItems: 'center' },
  netLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  netValue: { fontSize: 15, fontWeight: '700' },
  netPositive: { color: '#22c55e' },
  netNegative: { color: '#ef4444' },
  netDivider: { width: 1, height: 32, backgroundColor: '#334155' },
  taxRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  taxItem: { flex: 1, alignItems: 'center' },
  taxLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  taxValue: { fontSize: 14, fontWeight: '700', color: '#f59e0b' },
  taxDivider: { width: 1, height: 28, backgroundColor: '#334155' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    marginBottom: 4,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  chartBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 2 },
  chartBarOuter: {
    height: 88,
    width: '85%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBar: {
    width: '100%',
    minHeight: 4,
    backgroundColor: '#6366f1',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  chartBarLabel: { fontSize: 9, color: '#94a3b8', marginTop: 4 },
  chartBarWeek: { fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 2 },
  chartHint: { fontSize: 11, color: '#475569', marginBottom: 24, textAlign: 'center' },
  categoryList: { marginBottom: 24 },
  categoryRow: { marginBottom: 14 },
  categoryRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366f1', marginRight: 8 },
  categoryDotIncome: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', marginRight: 8 },
  categoryName: { flex: 1, fontSize: 14, color: '#334155' },
  categoryAmount: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  categoryAmountIncome: { fontSize: 14, fontWeight: '600', color: '#22c55e' },
  categoryBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, overflow: 'hidden' },
  categoryBarFill: { height: '100%', backgroundColor: '#6366f1', borderRadius: 3 },
  categoryBarFillIncome: { height: '100%', backgroundColor: '#22c55e', borderRadius: 3 },
  empty: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: {
    width: '30%',
    minWidth: 100,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 20,
  },
  quickNumber: { fontSize: 24, fontWeight: '700', color: '#6366f1' },
  quickNumberIncome: { fontSize: 24, fontWeight: '700', color: '#22c55e' },
  quickLabel: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
});
