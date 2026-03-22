import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, getWeek, parseISO, isValid, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAddPreferred } from '../contexts/AddPreferredContext';
import { formatAmount } from '../utils/currency';

function formatHelloName(email: string | undefined): string {
  if (!email) return 'there';
  const local = email.split('@')[0] ?? 'User';
  return local
    .split('.')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('.');
}

type ActivityKind = 'invoice' | 'sale';

interface ActivityRow {
  kind: ActivityKind;
  id: string;
  dateRaw: string;
  title: string;
  subtitle: string;
  dateLine: string;
  amount: number;
  currency?: string;
  categoryLabel: string;
  verified: boolean;
}

export default function HomeScreen({
  navigation,
}: {
  navigation: {
    navigate: (s: string, p?: object) => void;
    getParent?: () => { navigate: (s: string, p?: object) => void } | undefined;
  };
}) {
  const insets = useSafeAreaInsets();
  const { spendSummary, invoices, sales, currentBusiness, categories } = useApp();
  const { user } = useAuth();
  const { setPreferredAddType } = useAddPreferred();

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
    const weekStartStr = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);
    const monthStartStr = startOfMonth(new Date()).toISOString().slice(0, 10);
    const yearStartStr = startOfYear(new Date()).toISOString().slice(0, 10);
    let week = 0;
    let month = 0;
    let year = 0;
    sales.forEach((s) => {
      const d = s.extracted.date;
      const amt = s.extracted.amount ?? 0;
      if (d && d >= weekStartStr) week += amt;
      if (d && d >= monthStartStr) month += amt;
      if (d && d >= yearStartStr) year += amt;
    });
    return { week, month, year };
  }, [sales]);

  const netMonth = useMemo(
    () => incomeSummary.month - spendSummary.month,
    [incomeSummary.month, spendSummary.month]
  );

  /** Expense share of money movement this month (for progress bar). */
  const expenseBarPct = useMemo(() => {
    const spend = spendSummary.month;
    const income = incomeSummary.month;
    const t = spend + income;
    if (t <= 0) return spend > 0 ? 100 : 0;
    return Math.min(100, Math.round((spend / t) * 100));
  }, [spendSummary.month, incomeSummary.month]);

  const categoryName = (categoryId: string | null, fallback?: string) => {
    if (!categoryId) return fallback?.trim() || 'Uncategorised';
    const c = categories.find((x) => x.id === categoryId);
    return c?.name ?? fallback?.trim() ?? 'Uncategorised';
  };

  const recentActivity = useMemo((): ActivityRow[] => {
    const rows: ActivityRow[] = [];

    invoices.forEach((inv) => {
      const d = inv.extracted.date;
      if (!d) return;
      const cat = categoryName(inv.categoryId, inv.extracted.category);
      const merchant = inv.extracted.merchantName?.trim() ?? '';
      const pay = inv.extracted.paymentType?.trim();
      const title =
        cat !== 'Uncategorised'
          ? pay
            ? `${cat} (${pay})`
            : cat
          : `${merchant || 'Expense'} (Uncategorised)`;
      const subtitle = merchant ? `${merchant} · ${currentBusiness?.name ?? ''}`.replace(/ · $/, '') : currentBusiness?.name || '—';
      let dateLine = d;
      try {
        const parsed = parseISO(d.length >= 10 ? d.slice(0, 10) : d);
        if (isValid(parsed)) {
          const w = getWeek(parsed, { weekStartsOn: 1 });
          dateLine = `${format(parsed, 'd MMMM yyyy')}, W${w}`;
        }
      } catch {
        /* keep raw */
      }
      rows.push({
        kind: 'invoice',
        id: inv.id,
        dateRaw: d,
        title,
        subtitle,
        dateLine,
        amount: inv.extracted.amount ?? 0,
        currency: inv.extracted.currency,
        categoryLabel: cat,
        verified: Boolean(merchant),
      });
    });

    sales.forEach((s) => {
      const d = s.extracted.date;
      if (!d) return;
      const cat = categoryName(s.categoryId, s.extracted.category);
      const merchant = s.extracted.merchantName?.trim() ?? s.extracted.ownedBy?.trim() ?? '';
      const pay = s.extracted.paymentType?.trim();
      const title =
        cat !== 'Uncategorised'
          ? pay
            ? `${cat} (${pay})`
            : cat
          : `${merchant || 'Sale'} (Uncategorised)`;
      const subtitle = merchant ? `${merchant} · ${currentBusiness?.name ?? ''}`.replace(/ · $/, '') : currentBusiness?.name || '—';
      let dateLine = d;
      try {
        const parsed = parseISO(d.length >= 10 ? d.slice(0, 10) : d);
        if (isValid(parsed)) {
          const w = getWeek(parsed, { weekStartsOn: 1 });
          dateLine = `${format(parsed, 'd MMMM yyyy')}, W${w}`;
        }
      } catch {
        /* keep raw */
      }
      rows.push({
        kind: 'sale',
        id: s.id,
        dateRaw: d,
        title,
        subtitle,
        dateLine,
        amount: s.extracted.amount ?? 0,
        currency: s.extracted.currency,
        categoryLabel: cat,
        verified: Boolean(merchant),
      });
    });

    rows.sort((a, b) => (a.dateRaw < b.dateRaw ? 1 : a.dateRaw > b.dateRaw ? -1 : 0));
    return rows.slice(0, 8);
  }, [invoices, sales, categories, currentBusiness?.name]);

  const parentNav = () => navigation.getParent?.();

  const goAddInvoice = () => {
    setPreferredAddType('invoice');
    parentNav()?.navigate('Add', { screen: 'AddInvoiceRoot' });
  };

  const goAddSale = () => {
    setPreferredAddType('sale');
    parentNav()?.navigate('Add', { screen: 'AddSaleRoot' });
  };

  const goRecords = () => parentNav()?.navigate('Records', { screen: 'InvoicesList' });

  const onActivityPress = (row: ActivityRow) => {
    if (row.kind === 'invoice') {
      parentNav()?.navigate('Records', { screen: 'InvoiceDetail', params: { invoiceId: row.id } });
    } else {
      parentNav()?.navigate('Records', { screen: 'SaleDetail', params: { saleId: row.id } });
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: Math.max(16, insets.top + 8), paddingBottom: 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerTextWrap}
          onPress={() => navigation.navigate('BusinessSwitch')}
          activeOpacity={0.7}
        >
          <AppText style={styles.helloName}>Hello, {formatHelloName(user?.email)}</AppText>
          <AppText style={styles.businessSub}>{currentBusiness?.name ?? 'No business'}</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.giftBtn}
          onPress={() => Alert.alert('Summit', 'Rewards and tips are coming soon.')}
          activeOpacity={0.7}
        >
          <Ionicons name="gift-outline" size={22} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Total balance card */}
      <TouchableOpacity
        style={styles.balanceCard}
        onPress={() => navigation.navigate('Dashboard')}
        activeOpacity={0.92}
      >
        <View style={styles.balanceRow}>
          <LinearGradient colors={['#EDE7F6', '#E8E0F5']} style={styles.balanceIconCircle}>
            <Ionicons name="wallet-outline" size={28} color="#5B4FC9" />
          </LinearGradient>
          <View style={styles.balanceCenter}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <Text style={[styles.balanceAmount, netMonth < 0 ? styles.balanceNegative : styles.balancePositive]}>
              {formatCurrency(netMonth)}
            </Text>
            <Text style={styles.balanceHint}>This month · net (income − expenses)</Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#F5C6CB', '#CE93D8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${expenseBarPct}%` }]}
              />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#B2BEC3" />
        </View>
      </TouchableOpacity>

      {/* Quick actions */}
      <AppText style={styles.sectionHeading}>Quick Actions</AppText>
      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.quickActionCell} onPress={goAddInvoice} activeOpacity={0.85}>
          <View style={[styles.quickActionIconWrap, styles.quickScan]}>
            <Ionicons name="scan-outline" size={28} color="#3949AB" />
          </View>
          <AppText style={styles.quickActionLabel}>Scan Receipt</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionCell} onPress={goAddInvoice} activeOpacity={0.85}>
          <View style={[styles.quickActionIconWrap, styles.quickExpense]}>
            <View style={styles.orangeCircle}>
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </View>
          </View>
          <AppText style={styles.quickActionLabel}>Add Expense</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionCell} onPress={goAddSale} activeOpacity={0.85}>
          <View style={[styles.quickActionIconWrap, styles.quickSale]}>
            <View style={styles.tealCircle}>
              <Ionicons name="cart-outline" size={24} color="#FFFFFF" />
            </View>
          </View>
          <AppText style={styles.quickActionLabel}>Add Sale</AppText>
        </TouchableOpacity>
      </View>

      {/* Recent activity */}
      <View style={styles.activityHeaderRow}>
        <AppText style={styles.sectionHeading}>Recent Activity</AppText>
        <TouchableOpacity onPress={goRecords} hitSlop={12}>
          <AppText style={styles.viewAll}>View All</AppText>
        </TouchableOpacity>
      </View>

      {recentActivity.length === 0 ? (
        <View style={styles.emptyCard}>
          <AppText style={styles.emptyText}>No activity yet. Add an invoice or sale to get started.</AppText>
        </View>
      ) : (
        recentActivity.map((row) => (
          <TouchableOpacity
            key={`${row.kind}-${row.id}`}
            style={styles.activityCard}
            onPress={() => onActivityPress(row)}
            activeOpacity={0.9}
          >
            <View style={styles.activityLeft}>
              <View style={styles.activityTitleRow}>
                <AppText style={styles.activityTitle} numberOfLines={2}>
                  {row.title}
                </AppText>
                {row.verified ? (
                  <Ionicons name="checkmark-circle" size={18} color="#22c55e" style={styles.verifiedCheck} />
                ) : null}
              </View>
              <AppText style={styles.activitySubtitle} numberOfLines={1}>
                {row.subtitle}
              </AppText>
              <AppText style={styles.activityDate}>{row.dateLine}</AppText>
            </View>
            <View style={styles.activityRight}>
              <AppText style={[styles.activityAmount, row.kind === 'sale' ? styles.amountSale : styles.amountExpense]}>
                {row.kind === 'sale' ? '+' : ''}
                {formatAmount(row.amount, row.currency ?? primaryCurrency)}
              </AppText>
              <AppText style={styles.activityCategory}>{row.categoryLabel}</AppText>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  helloName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 4,
  },
  businessSub: {
    fontSize: 15,
    color: '#636E72',
  },
  giftBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8EAF6',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  balanceCenter: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceNegative: {
    color: '#B03A2E',
  },
  balancePositive: {
    color: '#2E7D32',
  },
  balanceHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ECEFF1',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2D3436',
    marginBottom: 14,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  quickActionCell: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quickActionIconWrap: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 108,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickScan: {
    backgroundColor: '#EDE7F6',
  },
  quickExpense: {
    backgroundColor: '#FFF3E0',
  },
  quickSale: {
    backgroundColor: '#E0F7FA',
  },
  orangeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tealCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#26A69A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3436',
    textAlign: 'center',
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAll: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C6FDB',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  activityLeft: {
    flex: 1,
    paddingRight: 12,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3436',
  },
  verifiedCheck: {
    marginLeft: 6,
    marginTop: 1,
  },
  activitySubtitle: {
    fontSize: 13,
    color: '#636E72',
    marginTop: 4,
  },
  activityDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  amountExpense: {
    color: '#2D3436',
  },
  amountSale: {
    color: '#2E7D32',
  },
  activityCategory: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
});
