import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import AppText from '../components/AppText';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import { startOfWeek, startOfMonth, startOfYear, subMonths } from 'date-fns';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
const PIE_SIZE = 160;
const PIE_R = PIE_SIZE / 2;

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

  // Normalize date to YYYY-MM-DD for range comparison (handles ISO strings or date-only)
  const toDateStr = (dateVal: string | undefined): string => {
    if (!dateVal) return '';
    const s = String(dateVal).trim();
    return s.slice(0, 10);
  };

  // Spend by month (last 6 months) – expenses from invoices
  const byMonth: { label: string; total: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = subMonths(new Date(), i);
    const start = startOfMonth(d);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = start.getMonth() === 11
      ? `${start.getFullYear() + 1}-01-01`
      : `${start.getFullYear()}-${String(start.getMonth() + 2).padStart(2, '0')}-01`;
    const total = invoices
      .filter((inv) => {
        const dateStr = toDateStr(inv.extracted.date);
        return dateStr >= startStr && dateStr < endStr;
      })
      .reduce((s, inv) => s + (inv.extracted.amount ?? 0), 0);
    byMonth.push({
      label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total,
    });
  }

  // Income by month (last 6 months) – sales
  const incomeByMonth: { label: string; total: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = subMonths(new Date(), i);
    const start = startOfMonth(d);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = start.getMonth() === 11
      ? `${start.getFullYear() + 1}-01-01`
      : `${start.getFullYear()}-${String(start.getMonth() + 2).padStart(2, '0')}-01`;
    const total = sales
      .filter((s) => {
        const dateStr = toDateStr(s.extracted.date);
        return dateStr >= startStr && dateStr < endStr;
      })
      .reduce((sum, s) => sum + (s.extracted.amount ?? 0), 0);
    incomeByMonth.push({
      label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      total,
    });
  }

  // Income vs expenses per month (last 6 months) for bar chart
  const monthlyComparison = useMemo(() => {
    return byMonth.map((exp, i) => ({
      label: exp.label,
      expenses: exp.total,
      income: incomeByMonth[i]?.total ?? 0,
    }));
  }, [byMonth, incomeByMonth]);

  const chartMax = useMemo(() => {
    let m = 0;
    monthlyComparison.forEach((row) => {
      if (row.expenses > m) m = row.expenses;
      if (row.income > m) m = row.income;
    });
    return Math.max(1, m);
  }, [monthlyComparison]);

  const currentYear = new Date().getFullYear();
  const yearStartStr = startOfYear(new Date()).toISOString().slice(0, 10);
  const yearEndStr = `${currentYear + 1}-01-01`;

  const spendingByMerchantYear = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((inv) => {
        const dateStr = toDateStr(inv.extracted.date);
        return dateStr >= yearStartStr && dateStr < yearEndStr;
      })
      .forEach((inv) => {
        const name = (inv.extracted.merchantName ?? '').trim() || 'Unknown';
        map.set(name, (map.get(name) ?? 0) + (inv.extracted.amount ?? 0));
      });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [invoices, yearStartStr, yearEndStr]);

  const spendingByMerchantTotal = useMemo(
    () => spendingByMerchantYear.reduce((s, m) => s + m.total, 0),
    [spendingByMerchantYear]
  );

  const pieSegments = useMemo(() => {
    if (spendingByMerchantTotal <= 0) return [];
    return spendingByMerchantYear.map((m, i) => ({
      ...m,
      color: PIE_COLORS[i % PIE_COLORS.length],
      pct: (m.total / spendingByMerchantTotal) * 100,
    }));
  }, [spendingByMerchantYear, spendingByMerchantTotal]);

  const incomeByMerchantYear = useMemo(() => {
    const map = new Map<string, number>();
    sales
      .filter((s) => {
        const dateStr = toDateStr(s.extracted.date);
        return dateStr >= yearStartStr && dateStr < yearEndStr;
      })
      .forEach((s) => {
        const name = (s.extracted.merchantName ?? '').trim() || 'Unknown';
        map.set(name, (map.get(name) ?? 0) + (s.extracted.amount ?? 0));
      });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [sales, yearStartStr, yearEndStr]);

  const incomeByMerchantTotal = useMemo(
    () => incomeByMerchantYear.reduce((s, m) => s + m.total, 0),
    [incomeByMerchantYear]
  );

  const incomePieSegments = useMemo(() => {
    if (incomeByMerchantTotal <= 0) return [];
    return incomeByMerchantYear.map((m, i) => ({
      ...m,
      color: PIE_COLORS[i % PIE_COLORS.length],
      pct: (m.total / incomeByMerchantTotal) * 100,
    }));
  }, [incomeByMerchantYear, incomeByMerchantTotal]);

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
      <AppText style={styles.title}>REPORTS</AppText>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>INCOME VS EXPENSES · LAST 6 MONTHS</AppText>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendExpenses]} />
            <AppText style={styles.legendText}>Expenses</AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendIncome]} />
            <AppText style={styles.legendText}>Sales</AppText>
          </View>
        </View>
        <View style={styles.verticalChart}>
          <View style={styles.verticalChartBars}>
            {[...monthlyComparison].reverse().map((row) => {
              const expPct = chartMax > 0 ? (row.expenses / chartMax) * 100 : 0;
              const incPct = chartMax > 0 ? (row.income / chartMax) * 100 : 0;
              const minPct = 12;
              const expensesHeightPct = row.expenses > 0 ? Math.max(minPct, expPct) : 0;
              const incomeHeightPct = row.income > 0 ? Math.max(minPct, incPct) : 0;
              return (
              <View key={row.label} style={styles.verticalChartGroup}>
                <View style={styles.verticalBarPair}>
                  <View
                    style={[
                      styles.verticalBarExpenses,
                      { height: `${expensesHeightPct}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.verticalBarIncome,
                      { height: `${incomeHeightPct}%` },
                    ]}
                  />
                </View>
                <AppText style={styles.verticalChartLabel} numberOfLines={1}>{row.label}</AppText>
                <AppText style={styles.verticalChartValueExpenses} numberOfLines={1}>{formatCurrency(row.expenses)}</AppText>
                <AppText style={styles.verticalChartValueIncome} numberOfLines={1}>{formatCurrency(row.income)}</AppText>
              </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Expenses summary</AppText>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This week</AppText>
          <AppText style={styles.summaryValue}>{formatCurrency(spendSummary.week)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This month</AppText>
          <AppText style={styles.summaryValue}>{formatCurrency(spendSummary.month)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This year</AppText>
          <AppText style={styles.summaryValue}>{formatCurrency(spendSummary.year)}</AppText>
        </View>
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Income summary</AppText>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This week</AppText>
          <AppText style={styles.summaryValueIncome}>{formatCurrency(incomeSummary.week)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This month</AppText>
          <AppText style={styles.summaryValueIncome}>{formatCurrency(incomeSummary.month)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This year</AppText>
          <AppText style={styles.summaryValueIncome}>{formatCurrency(incomeSummary.year)}</AppText>
        </View>
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Net (income − expenses)</AppText>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This week</AppText>
          <AppText style={[styles.summaryValue, netSummary.week >= 0 ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(netSummary.week)}
          </AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This month</AppText>
          <AppText style={[styles.summaryValue, netSummary.month >= 0 ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(netSummary.month)}
          </AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>This year</AppText>
          <AppText style={[styles.summaryValue, netSummary.year >= 0 ? styles.netPositive : styles.netNegative]}>
            {formatCurrency(netSummary.year)}
          </AppText>
        </View>
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Spending by merchant · {currentYear}</AppText>
        {pieSegments.length === 0 ? (
          <AppText style={styles.pieEmpty}>No spending data for {currentYear}.</AppText>
        ) : (
          <>
            <View style={styles.pieWrap}>
              <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
                {(() => {
                  const cx = PIE_R;
                  const cy = PIE_R;
                  const r = PIE_R - 2;
                  let startAngle = 0;
                  return pieSegments.map((seg, i) => {
                    const sweep = (seg.total / spendingByMerchantTotal) * 360;
                    const endAngle = startAngle + sweep;
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    const x1 = cx + r * Math.cos(startRad);
                    const y1 = cy + r * Math.sin(startRad);
                    const x2 = cx + r * Math.cos(endRad);
                    const y2 = cy + r * Math.sin(endRad);
                    const largeArc = sweep > 180 ? 1 : 0;
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    startAngle = endAngle;
                    return <Path key={seg.name} d={d} fill={seg.color} stroke="#fff" strokeWidth={1} />;
                  });
                })()}
              </Svg>
            </View>
            <View style={styles.pieLegend}>
              {pieSegments.map((seg) => (
                <View key={seg.name} style={styles.pieLegendRow}>
                  <View style={[styles.pieLegendDot, { backgroundColor: seg.color }]} />
                  <AppText style={styles.pieLegendName} numberOfLines={1}>{seg.name}</AppText>
                  <AppText style={styles.pieLegendPct}>{seg.pct.toFixed(0)}%</AppText>
                  <AppText style={styles.pieLegendValue}>{formatCurrency(seg.total)}</AppText>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Income/Sales by merchant · {currentYear}</AppText>
        {incomePieSegments.length === 0 ? (
          <AppText style={styles.pieEmpty}>No income/sales data for {currentYear}.</AppText>
        ) : (
          <>
            <View style={styles.pieWrap}>
              <Svg width={PIE_SIZE} height={PIE_SIZE} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
                {(() => {
                  const cx = PIE_R;
                  const cy = PIE_R;
                  const r = PIE_R - 2;
                  let startAngle = 0;
                  return incomePieSegments.map((seg) => {
                    const sweep = (seg.total / incomeByMerchantTotal) * 360;
                    const endAngle = startAngle + sweep;
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;
                    const x1 = cx + r * Math.cos(startRad);
                    const y1 = cy + r * Math.sin(startRad);
                    const x2 = cx + r * Math.cos(endRad);
                    const y2 = cy + r * Math.sin(endRad);
                    const largeArc = sweep > 180 ? 1 : 0;
                    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                    startAngle = endAngle;
                    return <Path key={seg.name} d={d} fill={seg.color} stroke="#fff" strokeWidth={1} />;
                  });
                })()}
              </Svg>
            </View>
            <View style={styles.pieLegend}>
              {incomePieSegments.map((seg) => (
                <View key={seg.name} style={styles.pieLegendRow}>
                  <View style={[styles.pieLegendDot, { backgroundColor: seg.color }]} />
                  <AppText style={styles.pieLegendName} numberOfLines={1}>{seg.name}</AppText>
                  <AppText style={styles.pieLegendPct}>{seg.pct.toFixed(0)}%</AppText>
                  <AppText style={styles.pieLegendValue}>{formatCurrency(seg.total)}</AppText>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Expenses · last 6 months</AppText>
        {byMonth.map((m) => (
          <View key={`exp-${m.label}`} style={styles.summaryRow}>
            <AppText style={styles.summaryLabel}>{m.label}</AppText>
            <AppText style={styles.summaryValue}>{formatCurrency(m.total)}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Income · last 6 months</AppText>
        {incomeByMonth.map((m) => (
          <View key={`inc-${m.label}`} style={styles.summaryRow}>
            <AppText style={styles.summaryLabel}>{m.label}</AppText>
            <AppText style={styles.summaryValueIncome}>{formatCurrency(m.total)}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <AppText style={styles.cardTitle}>Counts</AppText>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>Invoices</AppText>
          <AppText style={styles.summaryValue}>{invoices.length}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText style={styles.summaryLabel}>Sales</AppText>
          <AppText style={styles.summaryValueIncome}>{sales.length}</AppText>
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
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendExpenses: { backgroundColor: '#6366f1' },
  legendIncome: { backgroundColor: '#22c55e' },
  legendText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  verticalChart: { marginTop: 4 },
  verticalChartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    paddingHorizontal: 4,
  },
  verticalChartGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  verticalBarPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 100,
    width: '100%',
    gap: 6,
    marginBottom: 6,
  },
  verticalBarExpenses: {
    width: 14,
    minHeight: 4,
    backgroundColor: '#6366f1',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  verticalBarIncome: {
    width: 14,
    minHeight: 4,
    backgroundColor: '#22c55e',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  verticalChartLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 2,
    textAlign: 'center',
  },
  verticalChartValueExpenses: { fontSize: 9, color: '#64748b', textAlign: 'center' },
  verticalChartValueIncome: { fontSize: 9, color: '#64748b', textAlign: 'center' },
  pieEmpty: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingVertical: 12 },
  pieWrap: { alignItems: 'center', marginVertical: 12 },
  pieLegend: { marginTop: 8, gap: 6 },
  pieLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  pieLegendDot: { width: 12, height: 12, borderRadius: 6 },
  pieLegendName: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '500' },
  pieLegendPct: { fontSize: 12, color: '#64748b', minWidth: 36, textAlign: 'right' },
  pieLegendValue: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
});
