import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useApp } from '../contexts/AppContext';
import type { ExtractedInvoiceData } from '../types';

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
      <Text style={styles.sectionTitle}>Receipt / Invoice details</Text>

      <Text style={labelStyle}>Date</Text>
      <TextInput
        style={inputStyle}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Merchant name</Text>
      <TextInput
        style={inputStyle}
        placeholder="Merchant or vendor name"
        value={merchantName}
        onChangeText={setMerchantName}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Supplier name (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="Supplier name if different"
        value={supplierName}
        onChangeText={setSupplierName}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Document reference (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="Invoice number / reference"
        value={documentReference}
        onChangeText={setDocumentReference}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Amount</Text>
      <TextInput
        style={inputStyle}
        placeholder="0.00"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Currency</Text>
      <TextInput
        style={inputStyle}
        placeholder="USD, EUR, GBP..."
        value={currency}
        onChangeText={setCurrency}
        placeholderTextColor="#64748b"
        autoCapitalize="characters"
      />

      <Text style={labelStyle}>VAT / Tax amount (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="0.00"
        value={vatAmount}
        onChangeText={setVatAmount}
        keyboardType="decimal-pad"
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Merchant address (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="Address"
        value={merchantAddress}
        onChangeText={setMerchantAddress}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Merchant phone (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="Phone"
        value={merchantPhone}
        onChangeText={setMerchantPhone}
        placeholderTextColor="#64748b"
        keyboardType="phone-pad"
      />

      <Text style={labelStyle}>Merchant email (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="Email"
        value={merchantEmail}
        onChangeText={setMerchantEmail}
        placeholderTextColor="#64748b"
        keyboardType="email-address"
      />

      <Text style={labelStyle}>Payment type (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="e.g. Card, Bank transfer, Cash"
        value={paymentType}
        onChangeText={setPaymentType}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Owned by / Customer (optional)</Text>
      <TextInput
        style={inputStyle}
        placeholder="Customer or billed to"
        value={ownedBy}
        onChangeText={setOwnedBy}
        placeholderTextColor="#64748b"
      />

      <Text style={labelStyle}>Category</Text>
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

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#334155', marginBottom: 16 },
  label: { fontSize: 14, color: '#94a3b8', marginBottom: 6 },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    color: '#0f172a',
    fontSize: 16,
    marginBottom: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { color: '#94a3b8', fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
});
