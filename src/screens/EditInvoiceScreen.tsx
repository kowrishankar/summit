import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AppText from '../components/AppText';
import { useApp } from '../contexts/AppContext';
import type { ExtractedInvoiceData } from '../types';
import {
  BORDER,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '../theme/design';

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
  const [merchantName, setMerchantName] = useState(invoice?.extracted.merchantName ?? '');
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
  const [ownedBy, setOwnedBy] = useState(invoice?.extracted.ownedBy ?? '');
  const [documentReference, setDocumentReference] = useState(invoice?.extracted.documentReference ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(invoice?.categoryId ?? null);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <AppText style={styles.empty}>Invoice not found.</AppText>
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
        merchantName: merchantName.trim() || undefined,
        amount: numAmount,
        currency: (currency.trim() || 'GBP').toUpperCase(),
        date: trimmedDate || invoice.extracted.date,
        vatAmount: vatAmount === '' ? undefined : parseFloat(vatAmount) || 0,
        merchantAddress: merchantAddress.trim() || undefined,
        merchantPhone: merchantPhone.trim() || undefined,
        merchantEmail: merchantEmail.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        paymentType: paymentType.trim() || undefined,
        ownedBy: ownedBy.trim() || undefined,
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

  const inputStyle = styles.input;
  const labelStyle = styles.label;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AppText style={styles.sectionTitle}>Receipt / Invoice details</AppText>

      <AppText style={labelStyle}>Date</AppText>
      <TextInput
        style={inputStyle}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Merchant name</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Merchant or vendor name"
        value={merchantName}
        onChangeText={setMerchantName}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Supplier name (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Supplier name if different"
        value={supplierName}
        onChangeText={setSupplierName}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Document reference (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Invoice number / reference"
        value={documentReference}
        onChangeText={setDocumentReference}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Amount</AppText>
      <TextInput
        style={inputStyle}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Currency</AppText>
      <TextInput
        style={inputStyle}
        placeholder="USD, EUR, GBP..."
        value={currency}
        onChangeText={setCurrency}
        placeholderTextColor={TEXT_MUTED}
        autoCapitalize="characters"
      />

      <AppText style={labelStyle}>VAT / Tax amount (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="0.00"
        value={vatAmount}
        onChangeText={setVatAmount}
        keyboardType="decimal-pad"
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Merchant address (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Address"
        value={merchantAddress}
        onChangeText={setMerchantAddress}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Merchant phone (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Phone"
        value={merchantPhone}
        onChangeText={setMerchantPhone}
        placeholderTextColor={TEXT_MUTED}
        keyboardType="phone-pad"
      />

      <AppText style={labelStyle}>Merchant email (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Email"
        value={merchantEmail}
        onChangeText={setMerchantEmail}
        placeholderTextColor={TEXT_MUTED}
        keyboardType="email-address"
      />

      <AppText style={labelStyle}>Payment type (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="e.g. Card, Bank transfer, Cash"
        value={paymentType}
        onChangeText={setPaymentType}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Owned by / Customer (optional)</AppText>
      <TextInput
        style={inputStyle}
        placeholder="Customer or billed to"
        value={ownedBy}
        onChangeText={setOwnedBy}
        placeholderTextColor={TEXT_MUTED}
      />

      <AppText style={labelStyle}>Category</AppText>
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, !categoryId && styles.chipActive]}
          onPress={() => setCategoryId(null)}
        >
          <AppText style={[styles.chipText, !categoryId && styles.chipTextActive]}>None</AppText>
        </TouchableOpacity>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipActive]}
            onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
          >
            <AppText style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</AppText>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <AppText style={styles.saveBtnText}>Save changes</AppText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 16 },
  label: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 6 },
  input: {
    backgroundColor: MUTED_CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    color: TEXT,
    fontSize: 16,
    marginBottom: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MUTED_CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { color: TEXT_SECONDARY, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  empty: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40 },
});
