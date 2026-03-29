import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Text,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import type { ExtractedInvoiceData } from '../types';
import {
  BORDER,
  CARD_BG,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  PURPLE_DEEP,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCardLight,
} from '../theme/design';

const INVOICE_TILE = '#F5F3FF';
const INVOICE_ICON = '#4338CA';

export default function EditInvoiceScreen({
  route = {},
  navigation,
}: {
  route?: { params?: { invoiceId?: string } };
  navigation: { goBack: () => void };
}) {
  const { invoices, categories, updateInvoice } = useApp();
  const invoiceId = route.params?.invoiceId;
  const invoice = useMemo(
    () => (invoiceId ? invoices.find((i) => i.id === invoiceId) : undefined),
    [invoices, invoiceId]
  );

  const [saving, setSaving] = useState(false);
  const [issuedBy, setIssuedBy] = useState(
    invoice?.extracted.issuedBy ?? invoice?.extracted.merchantName ?? ''
  );
  const [issuedTo, setIssuedTo] = useState(
    invoice?.extracted.issuedTo ?? invoice?.extracted.ownedBy ?? ''
  );
  const [amount, setAmount] = useState(String(invoice?.extracted.amount ?? ''));
  const [currency, setCurrency] = useState(invoice?.extracted.currency ?? '');
  const [date, setDate] = useState(invoice?.extracted.date ?? '');
  const [vatAmount, setVatAmount] = useState(
    invoice?.extracted.vatAmount != null ? String(invoice.extracted.vatAmount) : ''
  );
  const [merchantAddress, setMerchantAddress] = useState(invoice?.extracted.merchantAddress ?? '');
  const [merchantPhone, setMerchantPhone] = useState(invoice?.extracted.merchantPhone ?? '');
  const [merchantEmail, setMerchantEmail] = useState(invoice?.extracted.merchantEmail ?? '');
  const [supplierName, setSupplierName] = useState(invoice?.extracted.supplierName ?? '');
  const [paymentType, setPaymentType] = useState(invoice?.extracted.paymentType ?? '');
  const [documentReference, setDocumentReference] = useState(invoice?.extracted.documentReference ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(invoice?.categoryId ?? null);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Invoice not found.</Text>
      </View>
    );
  }

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    const trimmedDate = date.trim();
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format (e.g. 2025-03-08).');
      return;
    }

    setSaving(true);
    try {
      const updatedExtracted: ExtractedInvoiceData = {
        ...invoice.extracted,
        issuedBy: issuedBy.trim() || undefined,
        issuedTo: issuedTo.trim() || undefined,
        merchantName: issuedBy.trim() || undefined,
        ownedBy: issuedTo.trim() || undefined,
        amount: numAmount,
        currency: (currency.trim() || 'GBP').toUpperCase(),
        date: trimmedDate || invoice.extracted.date,
        vatAmount: vatAmount === '' ? undefined : parseFloat(vatAmount) || 0,
        merchantAddress: merchantAddress.trim() || undefined,
        merchantPhone: merchantPhone.trim() || undefined,
        merchantEmail: merchantEmail.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        paymentType: paymentType.trim() || undefined,
        documentReference: documentReference.trim() || undefined,
      };
      await updateInvoice(invoice.id, {
        extracted: updatedExtracted,
        categoryId: categoryId,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={[styles.heroIcon, { backgroundColor: INVOICE_TILE }]}>
          <Ionicons name="receipt-outline" size={28} color={INVOICE_ICON} />
        </View>
        <Text style={styles.heroTitle}>Edit invoice</Text>
        <Text style={styles.heroSubtitle}>Update amounts, dates, and labels. Your receipt stays attached.</Text>
      </View>

      <Text style={styles.groupLabel}>Essentials</Text>
      <Text style={styles.fieldLabel}>Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.fieldLabel}>Issued by</Text>
      <TextInput
        style={styles.input}
        placeholder="Seller / vendor on the receipt"
        value={issuedBy}
        onChangeText={setIssuedBy}
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.fieldLabel}>Issued to</Text>
      <TextInput
        style={styles.input}
        placeholder="Customer / bill to (if shown)"
        value={issuedTo}
        onChangeText={setIssuedTo}
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.fieldLabel}>Supplier name (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="If different from merchant"
        value={supplierName}
        onChangeText={setSupplierName}
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.fieldLabel}>Reference (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Invoice number / reference"
        value={documentReference}
        onChangeText={setDocumentReference}
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.fieldLabel}>Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.fieldLabel}>Currency</Text>
      <TextInput
        style={styles.input}
        placeholder="GBP, USD, EUR…"
        value={currency}
        onChangeText={setCurrency}
        placeholderTextColor={TEXT_MUTED}
        autoCapitalize="characters"
      />

      <Text style={styles.fieldLabel}>VAT / tax (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        value={vatAmount}
        onChangeText={setVatAmount}
        keyboardType="decimal-pad"
        placeholderTextColor={TEXT_MUTED}
      />

      <Text style={styles.groupLabel}>Contact (optional)</Text>
      <Text style={styles.fieldLabel}>Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Address"
        value={merchantAddress}
        onChangeText={setMerchantAddress}
        placeholderTextColor={TEXT_MUTED}
      />
      <Text style={styles.fieldLabel}>Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="Phone"
        value={merchantPhone}
        onChangeText={setMerchantPhone}
        placeholderTextColor={TEXT_MUTED}
        keyboardType="phone-pad"
      />
      <Text style={styles.fieldLabel}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={merchantEmail}
        onChangeText={setMerchantEmail}
        placeholderTextColor={TEXT_MUTED}
        keyboardType="email-address"
      />

      <Text style={styles.groupLabel}>Payment</Text>
      <Text style={styles.fieldLabel}>Payment type</Text>
      <TextInput
        style={styles.input}
        placeholder="Card, transfer, cash…"
        value={paymentType}
        onChangeText={setPaymentType}
        placeholderTextColor={TEXT_MUTED}
      />
      <Text style={styles.fieldLabel}>Category</Text>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, !categoryId && styles.chipActive]}
          onPress={() => setCategoryId(null)}
        >
          <Text style={[styles.chipText, !categoryId && styles.chipTextActive]}>None</Text>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipActive]}
            onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
          >
            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.gradientWrap, saving && { opacity: 0.75 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.92}
      >
        <LinearGradient
          colors={[PRIMARY, PURPLE_DEEP]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientBtn}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.gradientBtnText}>Save changes</Text>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: 20, paddingBottom: 48 },
  hero: { marginBottom: 24 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: TEXT, letterSpacing: -0.3, marginBottom: 6, textTransform: 'none' },
  heroSubtitle: { fontSize: 15, lineHeight: 22, color: TEXT_SECONDARY, textTransform: 'none' },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
    marginTop: 8,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: TEXT_MUTED, marginBottom: 8, textTransform: 'none' },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    color: TEXT,
    fontSize: 16,
    marginBottom: 16,
    ...shadowCardLight,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: MUTED_CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '500', textTransform: 'none' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  gradientWrap: {
    borderRadius: 999,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: PURPLE_DEEP,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  gradientBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', textTransform: 'none' },
  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40, textTransform: 'none' },
});
