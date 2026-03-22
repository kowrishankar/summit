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
  Alert,
  Platform,
  Modal,
} from 'react-native';
import AppText from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import ImageView from 'react-native-image-viewing';
import { useApp } from '../contexts/AppContext';
import { formatAmount } from '../utils/currency';
import { format } from 'date-fns';

const HANDLE_HEIGHT = 88;       // collapsed: drag handle strip
const HEADER_RESERVED = 56;     // space for nav bar "Sale" so sheet stays below it

export default function SaleDetailScreen({
  route = {},
}: {
  route?: { params?: { saleId?: string } };
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const { sales, categories } = useApp();
  const saleId = route.params?.saleId;
  const sale = saleId ? sales.find((s) => s.id === saleId) : undefined;
  const category = sale ? categories.find((c) => c.id === sale.categoryId) : null;
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

  if (!sale) {
    return (
      <View style={styles.container}>
        <AppText style={styles.empty}>Sale not found.</AppText>
      </View>
    );
  }

  const e = sale.extracted;
  const isPdf = sale.fileName?.toLowerCase().endsWith('.pdf') ?? sale.fileUri?.toLowerCase().endsWith('.pdf');
  const docImageUris =
    sale.fileUris && sale.fileUris.length > 0
      ? sale.fileUris
      : sale.fileUri
        ? [sale.fileUri]
        : [];
  const showDocImage = docImageUris.length > 0 && !isPdf;
  const imageSource = docImageUris.map((uri) => ({ uri }));

  const detailsContent = (
    <>
      <AppText style={styles.panelTitle}>Sale details</AppText>
      <View style={styles.header}>
        <AppText style={styles.merchant}>{e.supplierName ?? e.merchantName ?? 'Unknown'}</AppText>
        <AppText style={styles.amount}>{formatAmount(e.amount ?? 0, e.currency)}</AppText>
      </View>
      <View style={styles.meta}>
        <AppText style={styles.metaText}>
          Date: {e.date ? format(new Date(e.date), 'MMM d, yyyy') : '—'}
        </AppText>
        <AppText style={styles.metaText}>Category: {category?.name ?? e.category ?? 'Uncategorised'}</AppText>
      </View>
      {(e.documentReference || e.currency || e.paymentType || e.ownedBy) ? (
        <View style={styles.detailsGrid}>
          {e.documentReference ? (
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Reference</AppText>
              <AppText style={styles.detailValue}>{e.documentReference}</AppText>
            </View>
          ) : null}
          {e.currency ? (
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Currency</AppText>
              <AppText style={styles.detailValue}>{e.currency}</AppText>
            </View>
          ) : null}
          {e.paymentType ? (
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Payment</AppText>
              <AppText style={styles.detailValue}>{e.paymentType}</AppText>
            </View>
          ) : null}
          {e.ownedBy ? (
            <View style={styles.detailRow}>
              <AppText style={styles.detailLabel}>Owned by</AppText>
              <AppText style={styles.detailValue}>{e.ownedBy}</AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      {e.merchantName && e.merchantName !== e.supplierName ? (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Merchant</AppText>
          <AppText style={styles.body}>{e.merchantName}</AppText>
        </View>
      ) : null}
      {(e.merchantAddress || e.merchantPhone || e.merchantEmail) && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Merchant</AppText>
          {e.merchantAddress ? <AppText style={styles.body}>{e.merchantAddress}</AppText> : null}
          {e.merchantPhone ? <AppText style={styles.body}>{e.merchantPhone}</AppText> : null}
          {e.merchantEmail ? <AppText style={styles.body}>{e.merchantEmail}</AppText> : null}
        </View>
      )}
      {e.vatAmount != null && e.vatAmount > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>VAT</AppText>
          <AppText style={styles.body}>{formatAmount(e.vatAmount, e.currency)}</AppText>
        </View>
      )}
      {e.lineItems && e.lineItems.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Line items</AppText>
          {e.lineItems.map((item) => (
            <View key={item.id} style={styles.lineRow}>
              <AppText style={styles.lineDesc}>{item.description}</AppText>
              <AppText style={styles.lineQty}>Qty: {item.quantity}</AppText>
              <AppText style={styles.linePrice}>
                {formatAmount(item.totalPrice ?? 0, e.currency)}
                {item.taxAmount != null && item.taxAmount > 0 && ` (tax: ${formatAmount(item.taxAmount, e.currency)})`}
              </AppText>
            </View>
          ))}
        </View>
      )}
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
                    <AppText style={styles.docSectionLabel}>
                      Part {index + 1} of {docImageUris.length}
                    </AppText>
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
        ) : (sale.fileUri || (sale.fileUris && sale.fileUris.length > 0)) && isPdf ? (
          (() => {
            const pdfUri = sale.fileUri ?? sale.fileUris?.[0];
            if (!pdfUri) return <View style={styles.pdfPlaceholder}><AppText style={styles.pdfPlaceholderText}>No PDF</AppText></View>;
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
                  <AppText style={styles.viewPdfButtonText}>Expand</AppText>
                </TouchableOpacity>
              </View>
            );
          })()
        ) : (
          <View style={styles.noDocPlaceholder}>
            <AppText style={styles.noDocText}>No document preview</AppText>
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
          backgroundColor="#ffffff"
          FooterComponent={({ imageIndex }) => (
            <TouchableOpacity
              style={styles.fullscreenCloseButton}
              onPress={() => setImageViewerVisible(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="contract-outline" size={22} color="#f8fafc" />
              <AppText style={styles.fullscreenCloseText}>Exit full screen</AppText>
            </TouchableOpacity>
          )}
        />
      )}

      {isPdf && pdfExpanded && (sale.fileUri ?? sale.fileUris?.[0]) ? (
        <Modal
          visible={pdfExpanded}
          animationType="slide"
          onRequestClose={() => setPdfExpanded(false)}
        >
          <View style={[styles.pdfFullScreenContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <WebView
              source={{ uri: sale.fileUri ?? sale.fileUris?.[0] }}
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
              <AppText style={styles.pdfExitButtonText}>Exit</AppText>
            </TouchableOpacity>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
  docContainer: {
    width: '100%',
    backgroundColor: '#f1f5f9',
  },
  imageTouchable: { flex: 1, width: '100%' },
  docScroll: { flex: 1, width: '100%' },
  docScrollContent: { paddingBottom: 16 },
  docSectionWrap: {
    marginBottom: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  docSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
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
  fullscreenCloseText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  pdfPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfPlaceholderText: { fontSize: 18, color: '#64748b' },
  pdfFileName: { fontSize: 13, color: '#475569', marginTop: 4 },
  pdfWebViewContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f1f5f9',
  },
  pdfWebView: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#ffffff',
  },
  pdfFullScreenWebView: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f1f5f9',
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
  pdfExitButtonText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  viewPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  viewPdfButtonText: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  noDocPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDocText: { fontSize: 14, color: '#64748b' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  handleWrap: {
    minHeight: 44,
    paddingTop: 12,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },
  panelScroll: { flex: 1, backgroundColor: '#ffffff' },
  panelContent: { padding: 20, paddingTop: 4, paddingBottom: 48, backgroundColor: '#ffffff' },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  header: { marginBottom: 16 },
  merchant: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  amount: { fontSize: 22, fontWeight: '700', color: '#16a34a', marginTop: 4 },
  meta: { marginBottom: 16 },
  metaText: { fontSize: 14, color: '#64748b' },
  detailsGrid: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailLabel: { fontSize: 13, color: '#64748b' },
  detailValue: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  body: { fontSize: 14, color: '#334155' },
  lineRow: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  lineDesc: { color: '#0f172a' },
  lineQty: { fontSize: 12, color: '#64748b', marginTop: 4 },
  linePrice: { fontSize: 14, color: '#16a34a', marginTop: 4 },
});
