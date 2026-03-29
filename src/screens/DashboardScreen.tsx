import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isAfter,
} from 'date-fns';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import {
  CARD_BG,
  LAVENDER_SOFT,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY as PURPLE,
  TEXT as TEXT_DARK,
  TEXT_MUTED as LABEL_GREY,
} from '../theme/design';

const TRACK_BG = LAVENDER_SOFT;

const MAX_CHART_BAR_HEIGHT = 112;

type Nav = {
  goBack: () => void;
  getParent?: () => { navigate: (n: string, p?: object) => void } | undefined;
};

export default function DashboardScreen({ navigation }: { navigation: Nav }) {
  const insets = useSafeAreaInsets();
  const { invoices, sales, categories } = useApp();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);

  const monthStartStr = format(viewMonth, 'yyyy-MM-dd');
  const monthEndStr = format(endOfMonth(viewMonth), 'yyyy-MM-dd');

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

  const weeklySpend = useMemo(() => {
    const weeks: { label: string; total: number }[] = [
      { label: 'W1', total: 0 },
      { label: 'W2', total: 0 },
      { label: 'W3', total: 0 },
      { label: 'W4', total: 0 },
    ];
    invoices.forEach((inv) => {
      if ((inv.reviewStatus ?? 'complete') !== 'complete') return;
      const d = inv.extracted.date;
      if (!d || d < monthStartStr || d > monthEndStr) return;
      const day = parseInt(d.slice(8, 10), 10);
      if (Number.isNaN(day)) return;
      const weekIndex = Math.min(Math.floor((day - 1) / 7), 3);
      weeks[weekIndex].total += inv.extracted.amount ?? 0;
    });
    return weeks;
  }, [invoices, monthStartStr, monthEndStr]);

  const expenseCategories = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    invoices.forEach((inv) => {
      if ((inv.reviewStatus ?? 'complete') !== 'complete') return;
      const d = inv.extracted.date;
      if (!d || d < monthStartStr || d > monthEndStr) return;
      const amt = inv.extracted.amount ?? 0;
      const label = categoryName(inv.categoryId, inv.extracted.category);
      map.set(label, (map.get(label) ?? 0) + amt);
      total += amt;
    });
    const rows = [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { rows: rows.slice(0, 8), total };
  }, [invoices, monthStartStr, monthEndStr, categories]);

  const incomeTotals = useMemo(() => {
    let salesTotal = 0;
    sales.forEach((s) => {
      if ((s.reviewStatus ?? 'complete') !== 'complete') return;
      const d = s.extracted.date;
      if (!d || d < monthStartStr || d > monthEndStr) return;
      salesTotal += s.extracted.amount ?? 0;
    });
    return { sales: salesTotal, other: 0 };
  }, [sales, monthStartStr, monthEndStr]);

  const maxWeek = Math.max(...weeklySpend.map((w) => w.total), 0.01);

  /** Don’t advance past the current calendar month. */
  const canGoNext = !isAfter(
    startOfMonth(addMonths(viewMonth, 1)),
    startOfMonth(new Date())
  );

  const monthPickerChoices = useMemo(() => {
    const list: Date[] = [];
    const cursor = startOfMonth(new Date());
    for (let i = 0; i < 36; i++) {
      list.push(subMonths(cursor, i));
    }
    return list;
  }, []);

  const parentNav = () => navigation.getParent?.();

  const goRecordsInvoices = () =>
    parentNav()?.navigate('Records', { screen: 'InvoicesList' });
  const goRecordsSales = () =>
    parentNav()?.navigate('Records', { screen: 'SalesList' });

  const invoiceCount = invoices.length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={TEXT_DARK} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Dashboard</AppText>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={styles.headerIconBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="calendar-outline" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthRow}>
        <TouchableOpacity
          style={styles.monthChevron}
          onPress={() => setViewMonth((m) => subMonths(m, 1))}
        >
          <Ionicons name="chevron-back" size={18} color={LABEL_GREY} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.monthCenter}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.7}
        >
          <AppText style={styles.monthLabel}>{format(viewMonth, 'MMMM yyyy')}</AppText>
          <Ionicons name="chevron-down" size={16} color={LABEL_GREY} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.monthChevron, !canGoNext && styles.monthChevronDisabled]}
          onPress={() => canGoNext && setViewMonth((m) => addMonths(m, 1))}
          disabled={!canGoNext}
        >
          <Ionicons name="chevron-forward" size={18} color={canGoNext ? LABEL_GREY : '#cbd5e1'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.sectionTitle}>Spending Breakdown</AppText>
        <View style={styles.chartCard}>
          <View style={styles.barsRow}>
            {weeklySpend.map((w) => {
              const h = (w.total / maxWeek) * MAX_CHART_BAR_HEIGHT;
              return (
                <View key={w.label} style={styles.barCol}>
                  <AppText style={styles.barAmount}>{formatCurrency(w.total)}</AppText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: Math.max(h, 4) }]} />
                  </View>
                  <AppText style={styles.barWeek}>{w.label}</AppText>
                </View>
              );
            })}
          </View>
          <AppText style={styles.chartHint}>Week 1–7 · 8–14 · 15–21 · 22–30</AppText>
        </View>

        <AppText style={[styles.sectionTitle, styles.sectionSpaced]}>Expenses</AppText>
        {expenseCategories.rows.length === 0 ? (
          <AppText style={styles.emptyHint}>No expenses this month.</AppText>
        ) : (
          expenseCategories.rows.map((row) => {
            const pct =
              expenseCategories.total > 0
                ? Math.min(100, Math.round((row.value / expenseCategories.total) * 100))
                : 0;
            return (
              <View key={row.name} style={styles.expenseRow}>
                <View style={styles.expenseTop}>
                  <View style={styles.expenseLeft}>
                    <View style={styles.dot} />
                    <AppText style={styles.expenseName}>{row.name}</AppText>
                  </View>
                  <AppText style={styles.expenseValue}>{formatCurrency(row.value)}</AppText>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })
        )}

        <AppText style={[styles.sectionTitle, styles.sectionSpaced]}>Income</AppText>
        <View style={styles.incomeRow}>
          <View style={styles.incomeCard}>
            <AppText style={styles.incomeLabel}>Sales</AppText>
            <AppText style={styles.incomeAmount}>{formatCurrency(incomeTotals.sales)}</AppText>
          </View>
          <View style={styles.incomeCard}>
            <AppText style={styles.incomeLabel}>Other</AppText>
            <AppText style={styles.incomeAmount}>{formatCurrency(incomeTotals.other)}</AppText>
          </View>
        </View>

        <View style={styles.quickHeader}>
          <AppText style={styles.sectionTitle}>Quick Links</AppText>
          <TouchableOpacity onPress={goRecordsInvoices} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <AppText style={styles.viewAll}>View All</AppText>
          </TouchableOpacity>
        </View>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} onPress={goRecordsInvoices} activeOpacity={0.85}>
            <View style={styles.invoiceBadge}>
              <AppText style={styles.invoiceBadgeText}>
                {invoiceCount > 99 ? '99+' : String(invoiceCount)}
              </AppText>
            </View>
            <AppText style={styles.quickLabel}>Invoices</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={goRecordsSales} activeOpacity={0.85}>
            <View style={styles.folderWrap}>
              <Ionicons name="folder" size={28} color="#3b82f6" />
            </View>
            <AppText style={styles.quickLabel}>Records</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <AppText style={styles.modalTitle}>Select month</AppText>
            <FlatList
              data={monthPickerChoices}
              keyExtractor={(item) => format(item, 'yyyy-MM')}
              renderItem={({ item }) => {
                const active = format(item, 'yyyy-MM') === format(viewMonth, 'yyyy-MM');
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => {
                      setViewMonth(startOfMonth(item));
                      setPickerOpen(false);
                    }}
                  >
                    <AppText style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>
                      {format(item, 'MMMM yyyy')}
                    </AppText>
                    {active ? <Ionicons name="checkmark" size={20} color={PURPLE} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  monthChevron: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MUTED_CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthChevronDisabled: {
    opacity: 0.5,
  },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  sectionSpaced: {
    marginTop: 24,
  },
  chartCard: {
    marginTop: 12,
    backgroundColor: MUTED_CARD,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: MAX_CHART_BAR_HEIGHT + 36,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  barAmount: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_DARK,
    marginBottom: 6,
  },
  barTrack: {
    width: '100%',
    maxWidth: 48,
    height: MAX_CHART_BAR_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '72%',
    minHeight: 4,
    backgroundColor: PURPLE,
    borderRadius: 8,
  },
  barWeek: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: LABEL_GREY,
  },
  chartHint: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 11,
    color: LABEL_GREY,
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 14,
    color: LABEL_GREY,
  },
  expenseRow: {
    marginTop: 16,
  },
  expenseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PURPLE,
    marginRight: 10,
  },
  expenseName: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_DARK,
  },
  expenseValue: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: TRACK_BG,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: PURPLE,
  },
  incomeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  incomeCard: {
    flex: 1,
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incomeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: LABEL_GREY,
  },
  incomeAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: PURPLE,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  invoiceBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invoiceBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  folderWrap: {
    width: 36,
    height: 36,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '55%',
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_DARK,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  pickerRowActive: {
    backgroundColor: '#f8fafc',
  },
  pickerRowText: {
    fontSize: 16,
    color: TEXT_DARK,
  },
  pickerRowTextActive: {
    fontWeight: '600',
    color: PURPLE,
  },
});
