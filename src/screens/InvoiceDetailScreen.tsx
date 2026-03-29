import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  Easing,
  PanResponder,
  Modal,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import ImageView from 'react-native-image-viewing';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import { displayIssuedBy, displayIssuedTo } from '../utils/extractedParties';
import { format } from 'date-fns';
import {
  BORDER,
  CARD_BG,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  RED,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

const INV_TILE = '#F5F3FF';
const INV_ICON = '#4338CA';

const HANDLE_HEIGHT = 88;       // collapsed: drag handle strip
const HEADER_RESERVED = 56;     // space for nav bar "Invoice" so sheet stays below it

export default function InvoiceDetailScreen({
  route = {},
}: {
  route?: { params?: { invoiceId?: string } };
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const { invoices, categories } = useApp();
  const invoiceId = route.params?.invoiceId;
  const invoice = invoiceId ? invoices.find((i) => i.id === invoiceId) : undefined;
  const category = invoice ? categories.find((c) => c.id === invoice.categoryId) : null;
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [pdfExpanded, setPdfExpanded] = useState(false);

  // Sheet must stop below the page title; cap at 80% of screen so drag-down is always possible
  const maxPanelH = Math.min(winHeight - insets.top - HEADER_RESERVED, winHeight * 0.8);
  const minPanelH = HANDLE_HEIGHT;

  const panelHeight = useRef(new Animated.Value(HANDLE_HEIGHT)).current;
  const panelHeightRef = useRef(HANDLE_HEIGHT);
  const maxPanelHRef = useRef(maxPanelH);
  const minPanelHRef = useRef(minPanelH);
  maxPanelHRef.current = maxPanelH;
  minPanelHRef.current = minPanelH;

  useEffect(() => {
    panelHeight.setValue(minPanelH);
    panelHeightRef.current = minPanelH;
  }, [winHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        const maxH = maxPanelHRef.current;
        const minH = minPanelHRef.current;
        panelHeightRef.current = Math.max(minH, Math.min(maxH, panelHeightRef.current));
      },
      onPanResponderMove: (_, gestureState) => {
        const maxH = maxPanelHRef.current;
        const minH = minPanelHRef.current;
        const newH = panelHeightRef.current - gestureState.dy;
        const clamped = Math.max(minH, Math.min(maxH, newH));
        panelHeight.setValue(clamped);
        panelHeightRef.current = clamped;
      },
      onPanResponderRelease: (_, gestureState) => {
        const maxH = maxPanelHRef.current;
        const minH = minPanelHRef.current;
        const current = panelHeightRef.current;
        const snapToExpanded = current > maxH * 0.55 || gestureState.vy < -0.2;
        const target = snapToExpanded ? maxH : minH;
        panelHeightRef.current = target;
        Animated.timing(panelHeight, {
          toValue: target,
          duration: 220,
          useNativeDriver: false,
          easing: Easing.out(Easing.cubic),
        }).start(() => {
          panelHeightRef.current = target;
        });
      },
    })
  ).current;

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Invoice not found.</Text>
      </View>
    );
  }

  const e = invoice.extracted;
  const pdfFullScreenUri = invoice.fileUri ?? invoice.fileUris?.[0];
  const isPdf = invoice.fileName?.toLowerCase().endsWith('.pdf') ?? invoice.fileUri?.toLowerCase().endsWith('.pdf');
  const docImageUris =
    invoice.fileUris && invoice.fileUris.length > 0
      ? invoice.fileUris
      : invoice.fileUri
        ? [invoice.fileUri]
        : [];
  const showDocImage = docImageUris.length > 0 && !isPdf;
  const imageSource = docImageUris.map((uri) => ({ uri }));

  const detailsContent = (
    <>
      <Text style={styles.pullHint}>Swipe up for full details</Text>

      {e.isDuplicate ? (
        <View style={styles.duplicateBanner}>
          <Ionicons name="copy-outline" size={20} color="#9A3412" style={styles.duplicateBannerIcon} />
          <Text style={styles.duplicateBannerText}>
            Marked as duplicate
            {e.duplicateOfRecordId ? ' — linked to an earlier receipt in this business.' : '.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={[styles.typeBadge, { backgroundColor: INV_TILE }]}>
            <Ionicons name="receipt-outline" size={22} color={INV_ICON} />
          </View>
          <View style={styles.summaryTopText}>
            <Text style={styles.typeLabel}>Expense</Text>
            <Text style={styles.summaryMerchant} numberOfLines={2}>
              {displayIssuedBy(e) ?? 'Unknown'}
            </Text>
          </View>
        </View>
        <Text style={styles.summaryAmount}>{formatAmount(e.amount ?? 0, e.currency)}</Text>
        <View style={styles.sheetMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={16} color={TEXT_MUTED} />
            <Text style={styles.metaChipText}>{e.date ? format(new Date(e.date), 'd MMM yyyy') : '—'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="pricetag-outline" size={16} color={TEXT_MUTED} />
            <Text style={styles.metaChipText} numberOfLines={1}>
              {category?.name ?? e.category ?? 'Uncategorised'}
            </Text>
          </View>
        </View>
      </View>

      {(e.documentReference || e.currency || e.paymentType || displayIssuedTo(e)) ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Transaction</Text>
          {displayIssuedTo(e) ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Issued to</Text>
              <Text style={styles.kvValue}>{displayIssuedTo(e)}</Text>
            </View>
          ) : null}
          {e.documentReference ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Reference</Text>
              <Text style={styles.kvValue}>{e.documentReference}</Text>
            </View>
          ) : null}
          {e.currency ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Currency</Text>
              <Text style={styles.kvValue}>{e.currency}</Text>
            </View>
          ) : null}
          {e.paymentType ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Payment</Text>
              <Text style={styles.kvValue}>{e.paymentType}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {e.merchantName && e.merchantName !== e.supplierName ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Also listed as</Text>
          <Text style={styles.sectionBody}>{e.merchantName}</Text>
        </View>
      ) : null}

      {(e.merchantAddress || e.merchantPhone || e.merchantEmail) ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Merchant contact</Text>
          {e.merchantAddress ? <Text style={styles.sectionBody}>{e.merchantAddress}</Text> : null}
          {e.merchantPhone ? <Text style={styles.sectionBody}>{e.merchantPhone}</Text> : null}
          {e.merchantEmail ? <Text style={styles.sectionBody}>{e.merchantEmail}</Text> : null}
        </View>
      ) : null}

      {e.vatAmount != null && e.vatAmount > 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>VAT / tax</Text>
          <Text style={styles.sectionBodyStrong}>{formatAmount(e.vatAmount, e.currency)}</Text>
        </View>
      ) : null}

      {e.lineItems && e.lineItems.length > 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Line items ({e.lineItems.length})</Text>
          {e.lineItems.map((item) => (
            <View key={item.id} style={styles.lineRow}>
              <Text style={styles.lineDesc}>{item.description}</Text>
              <Text style={styles.lineQty}>Qty {item.quantity}</Text>
              <Text style={styles.linePrice}>
                {formatAmount(item.totalPrice ?? 0, e.currency)}
                {item.taxAmount != null && item.taxAmount > 0
                  ? ` · tax ${formatAmount(item.taxAmount, e.currency)}`
                  : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Document fits to visible page (area above the bottom handle); scroll through multiple images for long receipts */}
      <View style={[styles.docContainer, { height: winHeight - HANDLE_HEIGHT }]}>
        {showDocImage ? (
          <View style={styles.imageTouchable}>
            {docImageUris.length === 1 ? (
              <Image source={{ uri: docImageUris[0] }} style={styles.docImage} resizeMode="contain" />
            ) : (
              <ScrollView
                style={styles.docScroll}
                contentContainerStyle={styles.docScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {docImageUris.map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.docSectionWrap}>
                    <Text style={styles.docSectionLabel}>
                      Part {index + 1} of {docImageUris.length}
                    </Text>
                    <Image source={{ uri }} style={styles.docSectionImage} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setImageViewerVisible(true)}
              activeOpacity={0.8}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="expand-outline" size={24} color="#f8fafc" />
            </TouchableOpacity>
          </View>
        ) : (invoice.fileUri || (invoice.fileUris && invoice.fileUris.length > 0)) && isPdf ? (
          (() => {
            const pdfUri = invoice.fileUri ?? invoice.fileUris?.[0];
            if (!pdfUri) return <View style={styles.pdfPlaceholder}><Text style={styles.pdfPlaceholderText}>No PDF</Text></View>;
            return (
              <View style={styles.pdfWebViewContainer}>
                <WebView
                  source={{ uri: pdfUri }}
                  originWhitelist={['*']}
                  allowFileAccess={true}
                  style={styles.pdfWebView}
                  scrollEnabled={true}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.warn('WebView PDF error:', nativeEvent);
                  }}
                />
                <TouchableOpacity
                  style={styles.expandPdfButton}
                  onPress={() => setPdfExpanded(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="expand-outline" size={22} color="#f8fafc" />
                  <Text style={styles.viewPdfButtonText}>Expand</Text>
                </TouchableOpacity>
              </View>
            );
          })()
        ) : (
          <View style={styles.noDocPlaceholder}>
            <Text style={styles.noDocText}>No document preview</Text>
          </View>
        )}
      </View>

      {/* Bottom sheet: pull up/down for extracted details (like reference) */}
      <Animated.View style={[styles.panel, { height: panelHeight }]}>
        <View style={styles.handleWrap} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>
        <ScrollView
          style={styles.panelScroll}
          contentContainerStyle={styles.panelContent}
          showsVerticalScrollIndicator={false}
        >
          {detailsContent}
        </ScrollView>
      </Animated.View>

      {imageSource.length > 0 && (
        <ImageView
          images={imageSource}
          imageIndex={0}
          visible={imageViewerVisible}
          onRequestClose={() => setImageViewerVisible(false)}
          doubleTapToZoomEnabled
          backgroundColor={CARD_BG}
          FooterComponent={({ imageIndex }) => (
            <TouchableOpacity
              style={styles.fullscreenCloseButton}
              onPress={() => setImageViewerVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="contract-outline" size={22} color="#f8fafc" />
              <Text style={styles.fullscreenCloseText}>Exit full screen</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {isPdf && pdfExpanded && pdfFullScreenUri ? (
        <Modal
          visible={pdfExpanded}
          animationType="slide"
          onRequestClose={() => setPdfExpanded(false)}
        >
          <View style={[styles.pdfFullScreenContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <WebView
              source={{ uri: pdfFullScreenUri }}
              originWhitelist={['*']}
              allowFileAccess={true}
              style={styles.pdfFullScreenWebView}
              scrollEnabled={true}
              scalesPageToFit={true}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.warn('WebView PDF error:', nativeEvent);
              }}
            />
            <TouchableOpacity
              style={[styles.pdfExitButton, { top: insets.top + 8 }]}
              onPress={() => setPdfExpanded(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="contract-outline" size={22} color="#f8fafc" />
              <Text style={styles.pdfExitButtonText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40 },
  docContainer: {
    width: '100%',
    backgroundColor: MUTED_CARD,
  },
  imageTouchable: { flex: 1, width: '100%' },
  docScroll: { flex: 1, width: '100%' },
  docScrollContent: { paddingBottom: 16 },
  docSectionWrap: {
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  docSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: MUTED_CARD,
    textTransform: 'none',
  },
  docSectionImage: { width: '100%', height: 280 },
  docImage: { width: '100%', height: '100%' },
  expandButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  fullscreenCloseText: { fontSize: 16, color: '#f8fafc', fontWeight: '600', textTransform: 'none' },
  pdfPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfPlaceholderText: { fontSize: 18, color: TEXT_MUTED },
  pdfFileName: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  pdfWebViewContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: MUTED_CARD,
  },
  pdfWebView: {
    flex: 1,
    width: '100%',
    backgroundColor: MUTED_CARD,
  },
  expandPdfButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },
  pdfFullScreenContainer: {
    flex: 1,
    backgroundColor: CARD_BG,
  },
  pdfFullScreenWebView: {
    flex: 1,
    width: '100%',
    backgroundColor: MUTED_CARD,
  },
  pdfExitButton: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  pdfExitButtonText: { fontSize: 16, color: '#f8fafc', fontWeight: '600', textTransform: 'none' },
  viewPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: PRIMARY,
    borderRadius: 10,
  },
  viewPdfButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  noDocPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDocText: { fontSize: 14, color: TEXT_MUTED },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  handleWrap: {
    minHeight: 44,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: BORDER,
  },
  panelScroll: { flex: 1, backgroundColor: CARD_BG },
  panelContent: { padding: 20, paddingTop: 8, paddingBottom: 56, backgroundColor: CARD_BG },
  pullHint: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'none',
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  duplicateBannerIcon: { marginRight: 10, marginTop: 1 },
  duplicateBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#9A3412',
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: MUTED_CARD,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  typeBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryTopText: { flex: 1, minWidth: 0 },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  summaryMerchant: { fontSize: 18, fontWeight: '800', color: TEXT, lineHeight: 24, textTransform: 'none' },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: RED,
    letterSpacing: -0.8,
    marginBottom: 14,
    textTransform: 'none',
  },
  sheetMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: '100%',
  },
  metaChipText: { fontSize: 13, fontWeight: '600', color: TEXT, flexShrink: 1, textTransform: 'none' },
  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  sectionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 12,
  },
  kvLabel: { fontSize: 14, color: TEXT_SECONDARY, flexShrink: 0, textTransform: 'none' },
  kvValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    flex: 1,
    textAlign: 'right',
    textTransform: 'none',
  },
  sectionBody: { fontSize: 15, color: TEXT, lineHeight: 22, marginBottom: 8, textTransform: 'none' },
  sectionBodyStrong: { fontSize: 18, fontWeight: '700', color: RED, textTransform: 'none' },
  lineRow: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  lineDesc: { fontSize: 15, fontWeight: '600', color: TEXT, textTransform: 'none' },
  lineQty: { fontSize: 13, color: TEXT_MUTED, marginTop: 6, textTransform: 'none' },
  linePrice: { fontSize: 15, fontWeight: '700', color: RED, marginTop: 6, textTransform: 'none' },
});
