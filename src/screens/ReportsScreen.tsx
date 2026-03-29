import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import {
  format,
  startOfMonth,
  addMonths,
  subMonths,
  startOfYear,
} from 'date-fns';
import {
  BORDER,
  CARD_BG,
  GREEN,
  GREEN_MUTED,
  LAVENDER,
  LAVENDER_SOFT,
  MUTED_CARD,
  PAGE_BG,
  PURPLE,
  PURPLE_DEEP,
  TEXT,
  TEXT_MUTED,
  shadowCard,
} from '../theme/design';

const DONUT_SIZE = 200;
const DONUT_R = DONUT_SIZE / 2;
const DONUT_HOLE_R = 58; // inner “donut” cutout (white circle on top)

const SEGMENT_COLORS = [PURPLE, LAVENDER, '#9B8AFF', '#B8AFFF', '#7C6AE8', '#A59CFB'];

const BAR_AREA_HEIGHT = 120;
const BAR_WIDTH = 16;
const BAR_GAP = 5;

function toDateStr(dateVal: string | undefined): string {
  if (!dateVal) return '';
  return String(dateVal).trim().slice(0, 10);
}

function monthWindow(monthsAgo: number) {
  const d = subMonths(new Date(), monthsAgo);
  const start = startOfMonth(d);
  const startStr = format(start, 'yyyy-MM-dd');
  const nextStart = addMonths(start, 1);
  const endExclusive = format(nextStart, 'yyyy-MM-dd');
  const label = format(start, 'MMM yyyy');
  return { startStr, endExclusive, label, sortKey: start.getTime() };
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{ navigate: (n: string, p?: object) => void }>();
  const { invoices, sales, categories } = useApp();

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

  const categoryName = (categoryId: string | null, fallback?: string) => {
    if (!categoryId) return fallback?.trim() || 'Uncategorised';
    const c = categories.find((x) => x.id === categoryId);
    return c?.name ?? fallback?.trim() ?? 'Uncategorised';
  };

  /** Last 6 calendar months: index 0 = current month (newest first for lists). */
  const monthBuckets = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => monthWindow(i));
  }, []);

  const expensesByMonthDesc = useMemo(() => {
    return monthBuckets.map(({ startStr, endExclusive, label }) => {
      const total = invoices
        .filter((inv) => (inv.reviewStatus ?? 'complete') === 'complete')
        .filter((inv) => {
          const dateStr = toDateStr(inv.extracted.date);
          return dateStr >= startStr && dateStr < endExclusive;
        })
        .reduce((s, inv) => s + (inv.extracted.amount ?? 0), 0);
      return { label, total };
    });
  }, [invoices, monthBuckets]);

  const incomeByMonthDesc = useMemo(() => {
    return monthBuckets.map(({ startStr, endExclusive, label }) => {
      const total = sales
        .filter((s) => (s.reviewStatus ?? 'complete') === 'complete')
        .filter((s) => {
          const dateStr = toDateStr(s.extracted.date);
          return dateStr >= startStr && dateStr < endExclusive;
        })
        .reduce((sum, s) => sum + (s.extracted.amount ?? 0), 0);
      return { label, total };
    });
  }, [sales, monthBuckets]);

  /** Oldest → newest for the grouped bar chart (left to right). */
  const monthlyComparisonAsc = useMemo(() => {
    const asc = [...monthBuckets].reverse();
    return asc.map((bucket, idx) => {
      const revIdx = monthBuckets.length - 1 - idx;
      return {
        label: bucket.label,
        expenses: expensesByMonthDesc[revIdx]?.total ?? 0,
        income: incomeByMonthDesc[revIdx]?.total ?? 0,
      };
    });
  }, [monthBuckets, expensesByMonthDesc, incomeByMonthDesc]);

  const chartMax = useMemo(() => {
    let m = 0;
    monthlyComparisonAsc.forEach((row) => {
      m = Math.max(m, row.expenses, row.income);
    });
    return Math.max(1, m);
  }, [monthlyComparisonAsc]);

  const currentYear = new Date().getFullYear();
  const yearStartStr = format(startOfYear(new Date()), 'yyyy-MM-dd');
  const yearEndExclusive = `${currentYear + 1}-01-01`;

  const spendingByMerchantYear = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((inv) => (inv.reviewStatus ?? 'complete') === 'complete')
      .filter((inv) => {
        const dateStr = toDateStr(inv.extracted.date);
        return dateStr >= yearStartStr && dateStr < yearEndExclusive;
      })
      .forEach((inv) => {
        const name = (inv.extracted.merchantName ?? '').trim() || 'Unknown';
        map.set(name, (map.get(name) ?? 0) + (inv.extracted.amount ?? 0));
      });
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [invoices, yearStartStr, yearEndExclusive]);

  /** Prefer category-based breakdown when merchants are sparse; else merchant. */
  const spendingBreakdownDonut = useMemo(() => {
    const byMerchant = spendingByMerchantYear;
    const hasNamedMerchants = byMerchant.some((m) => m.name !== 'Unknown' && m.total > 0);

    if (hasNamedMerchants && byMerchant.length > 0) {
      const TOP_N = 5;
      const top = byMerchant.slice(0, TOP_N);
      const otherSum = byMerchant.slice(TOP_N).reduce((s, x) => s + x.total, 0);
      const rows =
        otherSum > 0 ? [...top, { name: 'Other', total: otherSum }] : top;
      const total = rows.reduce((s, r) => s + r.total, 0);
      return { title: 'Spending by merchant', rows, total };
    }

    const map = new Map<string, number>();
    invoices
      .filter((inv) => (inv.reviewStatus ?? 'complete') === 'complete')
      .filter((inv) => {
        const dateStr = toDateStr(inv.extracted.date);
        return dateStr >= yearStartStr && dateStr < yearEndExclusive;
      })
      .forEach((inv) => {
        const label = categoryName(inv.categoryId, inv.extracted.category);
        map.set(label, (map.get(label) ?? 0) + (inv.extracted.amount ?? 0));
      });
    const sorted = [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    const TOP_N = 5;
    const top = sorted.slice(0, TOP_N);
    const otherSum = sorted.slice(TOP_N).reduce((s, x) => s + x.total, 0);
    const rows = otherSum > 0 ? [...top, { name: 'Other', total: otherSum }] : top;
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { title: 'Spending by category', rows, total };
  }, [
    spendingByMerchantYear,
    invoices,
    yearStartStr,
    yearEndExclusive,
    categories,
  ]);

  const donutSegments = useMemo(() => {
    const { rows, total } = spendingBreakdownDonut;
    if (total <= 0) return [];
    return rows.map((m, i) => ({
      ...m,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      pct: (m.total / total) * 100,
    }));
  }, [spendingBreakdownDonut]);

  const goRecords = () => navigation.navigate('Records', { screen: 'InvoicesList' });

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <AppText style={styles.headerTitle}>Reports</AppText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Spending donut */}
        <View style={styles.cardElevated}>
          <AppText style={styles.cardTitle}>{spendingBreakdownDonut.title}</AppText>
          {donutSegments.length === 0 ? (
            <AppText style={styles.emptyText}>No expense data for {currentYear} yet.</AppText>
          ) : (
            <>
              <View style={styles.donutWrap}>
                <Svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
                  {(() => {
                    const cx = DONUT_R;
                    const cy = DONUT_R;
                    const r = DONUT_R - 4;
                    let startAngle = -90;
                    const { total } = spendingBreakdownDonut;
                    return donutSegments.map((seg) => {
                      const sweep = (seg.total / total) * 360;
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
                      return (
                        <Path key={seg.name} d={d} fill={seg.color} stroke={CARD_BG} strokeWidth={2} />
                      );
                    });
                  })()}
                  <Circle cx={DONUT_R} cy={DONUT_R} r={DONUT_HOLE_R} fill={CARD_BG} />
                </Svg>
                <View style={styles.donutCenter} pointerEvents="none">
                  <AppText style={styles.donutCenterLabel}>Total</AppText>
                  <AppText style={styles.donutCenterAmount} numberOfLines={1}>
                    {formatCurrency(spendingBreakdownDonut.total)}
                  </AppText>
                </View>
              </View>

              <View style={styles.divider} />

              {donutSegments.map((seg) => (
                <View key={seg.name} style={styles.legendBlock}>
                  <View style={styles.legendRow}>
                    <View style={[styles.legendSwatch, { backgroundColor: seg.color }]} />
                    <AppText style={styles.legendName} numberOfLines={1}>
                      {seg.name}
                    </AppText>
                    <AppText style={styles.legendPct}>{Math.round(seg.pct)}%</AppText>
                    <AppText style={styles.legendMoney}>{formatCurrency(seg.total)}</AppText>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, seg.pct)}%` }]} />
                  </View>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Income vs Expenses chart */}
        <View style={styles.cardElevated}>
          <AppText style={styles.cardTitle}>Income vs Expenses · Last 6 months</AppText>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PURPLE }]} />
              <AppText style={styles.legendCaption}>Expenses</AppText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
              <AppText style={styles.legendCaption}>Sales (income)</AppText>
            </View>
          </View>

          <View style={styles.barChartArea}>
            <View style={[styles.barChartInner, { height: BAR_AREA_HEIGHT }]}>
              {monthlyComparisonAsc.map((row) => {
                const expH = (row.expenses / chartMax) * BAR_AREA_HEIGHT;
                const incH = (row.income / chartMax) * BAR_AREA_HEIGHT;
                const minH = 6;
                const eh = row.expenses > 0 ? Math.max(minH, expH) : 0;
                const ih = row.income > 0 ? Math.max(minH, incH) : 0;
                return (
                  <View key={row.label} style={styles.barGroup}>
                    <View style={styles.barPair}>
                      <View
                        style={[
                          styles.barExpenses,
                          { height: eh, width: BAR_WIDTH },
                        ]}
                      />
                      <View
                        style={[
                          styles.barIncome,
                          { height: ih, width: BAR_WIDTH },
                        ]}
                      />
                    </View>
                    <AppText style={styles.barMonthLabel} numberOfLines={1}>
                      {row.label}
                    </AppText>
                    <AppText style={styles.barValuePurple} numberOfLines={1}>
                      {formatCurrency(row.expenses)}
                    </AppText>
                    <AppText style={styles.barValueGreen} numberOfLines={1}>
                      {formatCurrency(row.income)}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Expenses by month */}
        <View style={styles.cardElevated}>
          <AppText style={styles.cardTitle}>Expenses by month</AppText>
          {expensesByMonthDesc.map((row, i) => (
            <View
              key={`exp-${row.label}`}
              style={[styles.listRow, i === expensesByMonthDesc.length - 1 && styles.listRowLast]}
            >
              <AppText style={styles.listLabel}>{row.label}</AppText>
              <AppText style={styles.listValue}>{formatCurrency(row.total)}</AppText>
            </View>
          ))}
        </View>

        {/* Income by month */}
        <View style={styles.cardElevated}>
          <AppText style={styles.cardTitle}>Income by month</AppText>
          {incomeByMonthDesc.map((row, i) => (
            <View
              key={`inc-${row.label}`}
              style={[styles.listRow, i === incomeByMonthDesc.length - 1 && styles.listRowLast]}
            >
              <AppText style={styles.listLabel}>{row.label}</AppText>
              <AppText style={[styles.listValue, styles.listValueIncome]}>
                {formatCurrency(row.total)}
              </AppText>
            </View>
          ))}
        </View>

        {/* Counts */}
        <AppText style={styles.sectionHeading}>Counts</AppText>
        <View style={styles.dividerFull} />
        <View style={styles.countsRow}>
          <View style={styles.countCard}>
            <View style={styles.countIconPurple}>
              <Ionicons name="document-text" size={22} color="#fff" />
            </View>
            <View style={styles.countCardMid}>
              <AppText style={styles.countCardLabel}>Invoices</AppText>
            </View>
            <AppText style={styles.countCardNumber}>{invoices.length}</AppText>
          </View>
          <View style={styles.countCard}>
            <View style={styles.countIconBlue}>
              <Ionicons name="wallet" size={22} color="#2563eb" />
            </View>
            <View style={styles.countCardMid}>
              <AppText style={styles.countCardLabel}>Sales</AppText>
            </View>
            <AppText style={[styles.countCardNumber, styles.countCardNumberGreen]}>
              {sales.length}
            </AppText>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.92} onPress={goRecords} style={styles.ctaTouchable}>
          <LinearGradient
            colors={[PURPLE, PURPLE_DEEP]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Ionicons name="folder-open" size={22} color="#fff" style={{ marginRight: 10 }} />
            <AppText style={styles.ctaText}>View records</AppText>
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: PAGE_BG,
  },
  headerSide: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  cardElevated: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...shadowCard,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    paddingVertical: 24,
  },
  donutWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    height: DONUT_SIZE,
    width: DONUT_SIZE,
    position: 'relative',
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '600',
  },
  donutCenterAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT,
    marginTop: 2,
    maxWidth: DONUT_HOLE_R * 2 - 8,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
  },
  dividerFull: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 14,
    marginTop: 4,
  },
  legendBlock: {
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 10,
  },
  legendName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  legendPct: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginRight: 10,
    minWidth: 36,
    textAlign: 'right',
  },
  legendMoney: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: LAVENDER_SOFT,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: PURPLE,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 11,
    height: 11,
    borderRadius: 3,
  },
  legendCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  barChartArea: {
    marginTop: 4,
  },
  barChartInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 56,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: BAR_GAP,
    marginBottom: 8,
    height: 120,
  },
  barExpenses: {
    backgroundColor: PURPLE,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 0,
  },
  barIncome: {
    backgroundColor: GREEN,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 0,
  },
  barMonthLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 2,
  },
  barValuePurple: {
    fontSize: 9,
    fontWeight: '600',
    color: PURPLE,
    textAlign: 'center',
  },
  barValueGreen: {
    fontSize: 9,
    fontWeight: '600',
    color: GREEN,
    textAlign: 'center',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
  listValue: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
  },
  listValueIncome: {
    color: GREEN,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginTop: 8,
    marginBottom: 0,
  },
  countsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  countCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MUTED_CARD,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  countIconPurple: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  countIconBlue: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  countCardMid: {
    flex: 1,
  },
  countCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  countCardNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
  },
  countCardNumberGreen: {
    color: GREEN_MUTED,
  },
  ctaTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
