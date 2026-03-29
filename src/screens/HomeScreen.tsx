import React, { useMemo, useRef } from 'react';
import { useScrollToTop } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format, getWeek, parseISO, isValid, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAddPreferred } from '../contexts/AddPreferredContext';
import type { ReviewStatus } from '../types';
import { formatAmount } from '../utils/currency';
import {
  AMBER,
  BORDER,
  CARD_BG,
  GREEN,
  LAVENDER_SOFT,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  PURPLE_DEEP,
  RED,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCard,
  shadowCardLight,
} from '../theme/design';

/** Quick Actions — match home design (pastel tiles + accent icons) */
const QUICK_SCAN_BG = '#F5F3FF';
const QUICK_SCAN_ICON = '#4338CA';
const QUICK_EXPENSE_BG = '#FFFBEB';
const QUICK_EXPENSE_GOLD = '#F59E0B';
/** Add Sale — greener mint tile + emerald cart (aligned with reference) */
const QUICK_SALE_BG = '#ECFDF5';
const QUICK_SALE_GREEN = '#059669';

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
  isDuplicate?: boolean;
  /** Open Add flow to review instead of detail when set. */
  reviewBanner?: 'processing' | 'review' | 'failed';
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
  const { spendSummary, invoices, sales, currentBusiness, categories, deleteInvoice, deleteSale } = useApp();
  const { user } = useAuth();

  const viewingSharedBusiness = Boolean(
    currentBusiness && user && currentBusiness.userId !== user.id
  );
  const { setPreferredAddType } = useAddPreferred();
  const sortedIncompleteReceipts = useMemo(() => {
    type Row = {
      id: string;
      kind: 'invoice' | 'sale';
      fileName: string;
      status: ReviewStatus;
      sortKey: string;
    };
    const rows: Row[] = [];
    invoices.forEach((inv) => {
      const rs = inv.reviewStatus ?? 'complete';
      if (rs === 'complete') return;
      rows.push({
        id: inv.id,
        kind: 'invoice',
        fileName: inv.fileName ?? 'Receipt',
        status: rs,
        sortKey: inv.updatedAt ?? inv.createdAt,
      });
    });
    sales.forEach((s) => {
      const rs = s.reviewStatus ?? 'complete';
      if (rs === 'complete') return;
      rows.push({
        id: s.id,
        kind: 'sale',
        fileName: s.fileName ?? 'Receipt',
        status: rs,
        sortKey: s.updatedAt ?? s.createdAt,
      });
    });
    return rows.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));
  }, [invoices, sales]);

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
      if ((s.reviewStatus ?? 'complete') !== 'complete') return;
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

  const vatMonthTotal = useMemo(
    () => spendSummary.taxMonth + spendSummary.taxMonthFromSales,
    [spendSummary.taxMonth, spendSummary.taxMonthFromSales]
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
      const rs = inv.reviewStatus ?? 'complete';
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
        isDuplicate: inv.extracted.isDuplicate,
        reviewBanner:
          rs === 'processing' ? 'processing' : rs === 'pending_review' ? 'review' : rs === 'failed' ? 'failed' : undefined,
      });
    });

    sales.forEach((s) => {
      const d = s.extracted.date;
      if (!d) return;
      const rs = s.reviewStatus ?? 'complete';
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
        isDuplicate: s.extracted.isDuplicate,
        reviewBanner:
          rs === 'processing' ? 'processing' : rs === 'pending_review' ? 'review' : rs === 'failed' ? 'failed' : undefined,
      });
    });

    rows.sort((a, b) => (a.dateRaw < b.dateRaw ? 1 : a.dateRaw > b.dateRaw ? -1 : 0));
    return rows.slice(0, 5);
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
    if (row.reviewBanner) {
      if (row.kind === 'invoice') {
        parentNav()?.navigate('Add' as never, {
          screen: 'AddInvoiceRoot',
          params: { recordId: row.id },
        } as never);
      } else {
        parentNav()?.navigate('Add' as never, {
          screen: 'AddSaleRoot',
          params: { recordId: row.id },
        } as never);
      }
      return;
    }
    if (row.kind === 'invoice') {
      parentNav()?.navigate('Records', { screen: 'InvoiceDetail', params: { invoiceId: row.id } });
    } else {
      parentNav()?.navigate('Records', { screen: 'SaleDetail', params: { saleId: row.id } });
    }
  };

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: Math.max(16, insets.top - 28), paddingBottom: 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <AppText style={styles.helloName}>Hello, {formatHelloName(user?.email)}</AppText>
        </View>
        <TouchableOpacity
          style={styles.giftBtn}
          onPress={() => Alert.alert('Summit', 'Rewards and tips are coming soon.')}
          activeOpacity={0.7}
        >
          <Ionicons name="gift-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {viewingSharedBusiness && (
        <View style={styles.sharedBusinessBanner}>
          <Ionicons name="people-outline" size={22} color="#C2410C" style={styles.sharedBusinessBannerIcon} />
          <View style={styles.sharedBusinessBannerTextCol}>
            <AppText style={styles.sharedBusinessBannerTitle}>Client business</AppText>
            <AppText style={styles.sharedBusinessBannerBody}>
              You’re viewing a client’s business. Invoices and sales here belong to
              that client.
            </AppText>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.businessSwitchCard}
        onPress={() => navigation.navigate('BusinessSwitch')}
        activeOpacity={0.88}
      >
        <View style={styles.businessSwitchCardLeft}>
          <AppText style={styles.businessSwitchLabel}>Current business</AppText>
          <AppText style={styles.businessSwitchName} numberOfLines={2}>
            {currentBusiness?.name ?? 'No business selected'}
          </AppText>
          {viewingSharedBusiness && (
            <View style={styles.sharedPill}>
              <AppText style={styles.sharedPillText}>Another account</AppText>
            </View>
          )}
        </View>
        <View style={styles.businessSwitchAction}>
          <AppText style={styles.businessSwitchActionText}>Switch</AppText>
          <Ionicons name="swap-horizontal-outline" size={22} color={PRIMARY} />
        </View>
      </TouchableOpacity>

      {/* Total balance card */}
      <TouchableOpacity
        style={styles.balanceCard}
        onPress={() => navigation.navigate('Dashboard')}
        activeOpacity={0.92}
      >
        <View style={styles.balanceRow}>
          <LinearGradient colors={[LAVENDER_SOFT, '#E8E0F5']} style={styles.balanceIconCircle}>
            <Ionicons name="wallet-outline" size={28} color={PURPLE_DEEP} />
          </LinearGradient>
          <View style={styles.balanceCenter}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <Text style={[styles.balanceAmount, netMonth < 0 ? styles.balanceNegative : styles.balancePositive]}>
              {formatCurrency(netMonth)}
            </Text>
            <Text style={styles.balanceHint}>This month · net (income − expenses)</Text>
            <View style={styles.balanceVatRow}>
              <Text style={styles.balanceVatLabel}>VAT this month</Text>
              <Text style={styles.balanceVatAmount}>{formatCurrency(vatMonthTotal)}</Text>
            </View>

            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#B8AFFF', PRIMARY]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${expenseBarPct}%` }]}
              />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
        </View>
      </TouchableOpacity>


      {sortedIncompleteReceipts.length > 0 && (
        <View style={styles.pendingSection}>
          <AppText style={styles.pendingSectionTitle}>Receipts to review</AppText>
          {sortedIncompleteReceipts.map((p) => {
            const iconName = p.kind === 'invoice' ? 'document-text-outline' : 'trending-up-outline';
            const openReview = () => {
              const tabNav = navigation.getParent?.();
              if (p.kind === 'invoice') {
                tabNav?.navigate('Add' as never, {
                  screen: 'AddInvoiceRoot',
                  params: { recordId: p.id },
                } as never);
              } else {
                tabNav?.navigate('Add' as never, {
                  screen: 'AddSaleRoot',
                  params: { recordId: p.id },
                } as never);
              }
            };
            const confirmDiscardDraft = () => {
              Alert.alert(
                'Discard draft',
                'This will remove the receipt from your records. If it is still processing, extraction will stop.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: () =>
                      p.kind === 'invoice' ? void deleteInvoice(p.id) : void deleteSale(p.id),
                  },
                ]
              );
            };
            const inner = (
              <View style={styles.pendingCardInner}>
                <View style={styles.pendingIconWrap}>
                  <Ionicons name={iconName as 'document-text-outline'} size={22} color={PRIMARY} />
                </View>
                <View style={styles.pendingTextCol}>
                  <View style={styles.pendingTitleRow}>
                    <AppText style={styles.pendingFileName} numberOfLines={1}>
                      {p.fileName}
                    </AppText>
                    {p.status === 'processing' && (
                      <View style={styles.badgeProcessing}>
                        <AppText style={styles.badgeProcessingText}>Processing</AppText>
                      </View>
                    )}
                    {p.status === 'pending_review' && (
                      <View style={styles.badgeReview}>
                        <AppText style={styles.badgeReviewText}>Review</AppText>
                      </View>
                    )}
                    {p.status === 'failed' && (
                      <View style={styles.badgeFailed}>
                        <AppText style={styles.badgeFailedText}>Failed</AppText>
                      </View>
                    )}
                  </View>
                  <AppText style={styles.pendingHint}>
                    {p.status === 'processing' &&
                      'Still reading your document in the background'}
                    {p.status === 'pending_review' &&
                      'Tap to view and confirm or edit'}
                    {p.status === 'failed' && 'Tap to edit manually and save, or discard this draft.'}
                  </AppText>
                </View>
                <TouchableOpacity
                  onPress={confirmDiscardDraft}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.pendingDismiss}
                  accessibilityLabel="Discard draft"
                >
                  <Ionicons name="close-circle" size={24} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>
            );
            if (p.status === 'pending_review' || p.status === 'failed') {
              return (
                <TouchableOpacity
                  key={`${p.kind}-${p.id}`}
                  style={styles.pendingCard}
                  activeOpacity={0.88}
                  onPress={openReview}
                >
                  {inner}
                </TouchableOpacity>
              );
            }
            return (
              <View key={`${p.kind}-${p.id}`} style={[styles.pendingCard, styles.pendingCardNonInteractive]}>
                {inner}
              </View>
            );
          })}
        </View>
      )}

      {/* Quick actions — white card + pastel tiles per design */}
      <View style={styles.quickActionsCard}>
        <AppText style={styles.quickActionsTitle}>Quick Actions</AppText>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionCell} onPress={goAddInvoice} activeOpacity={0.85}>
            <View style={[styles.quickActionIconWrap, { backgroundColor: QUICK_SCAN_BG }]}>
              <Ionicons name="scan-outline" size={28} color={QUICK_SCAN_ICON} />
            </View>
            <AppText style={styles.quickActionLabel}>Scan Receipt</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCell} onPress={goAddInvoice} activeOpacity={0.85}>
            <View style={[styles.quickActionIconWrap, { backgroundColor: QUICK_EXPENSE_BG }]}>
              <View style={[styles.expenseGoldCircle, { backgroundColor: QUICK_EXPENSE_GOLD }]}>
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </View>
            </View>
            <AppText style={styles.quickActionLabel}>Add Expense</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionCell} onPress={goAddSale} activeOpacity={0.85}>
            <View style={[styles.quickActionIconWrap, { backgroundColor: QUICK_SALE_BG }]}>
              <Ionicons name="cart-outline" size={28} color={QUICK_SALE_GREEN} />
            </View>
            <AppText style={styles.quickActionLabel}>Add Sale</AppText>
          </TouchableOpacity>
        </View>
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
                {row.isDuplicate ? (
                  <View style={styles.activityDupPill}>
                    <AppText style={styles.activityDupPillText}>Dup</AppText>
                  </View>
                ) : null}
                {row.reviewBanner === 'processing' || row.reviewBanner === 'review' ? (
                  <Ionicons name="alert-circle" size={18} color={AMBER} style={styles.activityReviewIcon} />
                ) : null}
                {row.reviewBanner === 'failed' ? (
                  <View style={styles.activityFailedPill}>
                    <AppText style={styles.activityFailedPillText}>Failed</AppText>
                  </View>
                ) : null}
                {!row.reviewBanner ? (
                  <Ionicons name="checkmark-circle" size={18} color={GREEN} style={styles.verifiedCheck} />
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
    backgroundColor: PAGE_BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  helloName: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT,
  },
  sharedBusinessBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  sharedBusinessBannerIcon: { marginRight: 12, marginTop: 2 },
  sharedBusinessBannerTextCol: { flex: 1 },
  sharedBusinessBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 4,
  },
  sharedBusinessBannerBody: {
    fontSize: 13,
    fontWeight: '500',
    color: '#C2410C',
    lineHeight: 18,
  },
  businessSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  businessSwitchCardLeft: { flex: 1, paddingRight: 12 },
  businessSwitchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  businessSwitchName: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
  },
  sharedPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sharedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  businessSwitchAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  businessSwitchActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY,
  },
  pendingSection: {
    marginBottom: 20,
  },
  pendingSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 10,
  },
  pendingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  pendingCardNonInteractive: {
    opacity: 0.95,
  },
  pendingCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pendingIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: LAVENDER_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pendingTextCol: { flex: 1, minWidth: 0 },
  pendingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pendingFileName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    flexShrink: 1,
  },
  badgeProcessing: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeProcessingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3730A3',
    textTransform: 'uppercase',
  },
  badgeReview: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeReviewText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
  },
  badgeFailed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeFailedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
    textTransform: 'uppercase',
  },
  pendingHint: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
    lineHeight: 18,
  },
  pendingDismiss: { marginLeft: 4, padding: 2 },
  giftBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: MUTED_CARD,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowCardLight,
  },
  balanceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 18,
    marginBottom: 28,
    ...shadowCard,
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
    color: TEXT_SECONDARY,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  balanceNegative: {
    color: RED,
  },
  balancePositive: {
    color: GREEN,
  },
  balanceHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 10,
  },
  balanceVatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  balanceVatLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  balanceVatAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: PURPLE_DEEP,
  },
  balanceVatSub: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_MUTED,
    marginBottom: 12,
    lineHeight: 15,
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
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 14,
  },
  quickActionsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 28,
    ...shadowCardLight,
    borderWidth: 1,
    borderColor: BORDER,
  },
  quickActionsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  expenseGoldCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
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
    color: PRIMARY,
  },
  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    alignItems: 'flex-start',
    ...shadowCardLight,
  },
  activityLeft: {
    flex: 1,
    paddingRight: 12,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  activityTitle: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT,
  },
  activityDupPill: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activityDupPillText: { fontSize: 10, fontWeight: '800', color: '#C2410C' },
  activityReviewIcon: { marginTop: 1 },
  activityFailedPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activityFailedPillText: { fontSize: 10, fontWeight: '800', color: '#B91C1C' },
  verifiedCheck: {
    marginTop: 0,
  },
  activitySubtitle: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  activityDate: {
    fontSize: 12,
    color: TEXT_SECONDARY,
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
    color: TEXT,
  },
  amountSale: {
    color: GREEN,
  },
  activityCategory: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
});
