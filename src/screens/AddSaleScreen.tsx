import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ImageView from 'react-native-image-viewing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useApp } from '../contexts/AppContext';
import { extractFromText, extractFromImageBase64, extractFromMultipleImagesBase64, extractFromPdfBase64 } from '../services/invoiceExtraction';
import { renderPdfFirstPageToImageBase64 } from '../services/pdfText';
import { formatAmount } from '../utils/currency';
import type { ExtractedInvoiceData } from '../types';

export default function AddSaleScreen({
  navigation,
}: {
  navigation: { navigate: (s: string) => void; getParent?: () => { navigate: (s: string) => void } | undefined };
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const { addSale, addCategory, categories, sales, currentBusiness } = useApp();
  const [step, setStep] = useState<'choose' | 'preview' | 'extracting' | 'review' | 'edit' | 'saving'>('choose');
  const [extracted, setExtracted] = useState<ExtractedInvoiceData | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  // For image preview/confirm: single asset (legacy) or multiple for long receipts
  const [pendingImageAsset, setPendingImageAsset] = useState<{ uri: string; base64?: string; mimeType?: string } | null>(null);
  const [pendingImageAssets, setPendingImageAssets] = useState<Array<{ uri: string; base64?: string; mimeType?: string }>>([]);
  const pendingImageAssetsRef = useRef<Array<{ uri: string; base64?: string; mimeType?: string }>>([]);
  const [previewZoomVisible, setPreviewZoomVisible] = useState(false);
  const [previewZoomIndex, setPreviewZoomIndex] = useState(0);

  // OpenAI vision supports JPEG, PNG, GIF, WebP. Convert HEIC/HEIF (iPhone) and other formats to JPEG.
  const getImageBase64ForApi = async (
    uri: string,
    existingBase64: string | undefined,
    mimeType: string | undefined
  ): Promise<{ base64: string; mimeType: string }> => {
    const type = (mimeType ?? '').toLowerCase();
    const isSupported = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(type);
    if (existingBase64 && isSupported) {
      return { base64: existingBase64, mimeType: type || 'image/jpeg' };
    }
    const result = await manipulateAsync(uri, [], {
      format: SaveFormat.JPEG,
      base64: true,
      compress: 0.9,
    });
    const base64 = result.base64 ?? '';
    if (!base64) throw new Error('Could not convert image to JPEG.');
    return { base64, mimeType: 'image/jpeg' };
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo of the document.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const item = asset.uri ? { uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: asset.mimeType ?? undefined } : null;
    setFileName(asset.fileName ?? 'photo.jpg');
    setDocumentUri(asset.uri ?? null);
    setIsPdf(false);
    setPendingImageAsset(item);
    const initial = item ? [item] : [];
    pendingImageAssetsRef.current = initial;
    setPendingImageAssets(initial);
    setStep('preview');
  };

  const addAnotherSection = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to add another section.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const item = asset.uri ? { uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: asset.mimeType ?? undefined } : null;
    if (item) {
      const next = [...pendingImageAssetsRef.current, item];
      pendingImageAssetsRef.current = next;
      setPendingImageAssets(next);
      setPendingImageAsset(item);
      // Keep documentUri as first section so preview keeps showing the start of the receipt
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to upload a document.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const item = asset.uri ? { uri: asset.uri, base64: asset.base64 ?? undefined, mimeType: asset.mimeType ?? undefined } : null;
    setFileName(asset.fileName ?? 'image.jpg');
    setDocumentUri(asset.uri ?? null);
    setIsPdf(false);
    setPendingImageAsset(item);
    const initial = item ? [item] : [];
    pendingImageAssetsRef.current = initial;
    setPendingImageAssets(initial);
    setStep('preview');
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    setFileName(file.name ?? 'document.pdf');
    setDocumentUri(file.uri ?? null);
    setIsPdf(true);
    setPendingImageAsset(null);
    pendingImageAssetsRef.current = [];
    setPendingImageAssets([]);
    setStep('preview');
  };

  const selectAnother = () => {
    setStep('choose');
    setDocumentUri(null);
    setFileName('');
    setPendingImageAsset(null);
    pendingImageAssetsRef.current = [];
    setPendingImageAssets([]);
    setPreviewZoomIndex(0);
  };

  const confirmAndExtract = async () => {
    const hasImages = pendingImageAssets.length > 0 || pendingImageAsset?.uri || documentUri;
    if (!hasImages && !documentUri) return;
    setStep('extracting');
    try {
      if (isPdf) {
        const uri = documentUri!;
        // Prefer sending PDF directly to GPT-4 (supported by API); fallback to web-only image render
        try {
          const pdfBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (pdfBase64) {
            const data = await extractFromPdfBase64(pdfBase64, fileName ?? 'sale.pdf');
            setExtracted(data);
            setStep('review');
            return;
          }
        } catch {
          // fallback below
        }
        const imageResult = await renderPdfFirstPageToImageBase64(uri);
        if (imageResult) {
          const data = await extractFromImageBase64(imageResult.base64, imageResult.mimeType);
          setExtracted(data);
          setStep('review');
          return;
        }
        Alert.alert(
          'PDF not supported',
          'Could not process this PDF. Try the web app or take a photo of the document instead.'
        );
        setStep('preview');
      } else {
        const assets =
          pendingImageAssetsRef.current.length > 0
            ? pendingImageAssetsRef.current
            : pendingImageAssets.length > 0
              ? pendingImageAssets
              : pendingImageAsset
                ? [pendingImageAsset]
                : [];
        if (assets.length === 0 && documentUri) {
          const { base64, mimeType } = await getImageBase64ForApi(documentUri, undefined, undefined);
          const data = await extractFromImageBase64(base64, mimeType);
          setExtracted(data);
          setStep('review');
          return;
        }
        if (assets.length > 1) {
          const imagePayloads: Array<{ base64: string; mimeType: string }> = [];
          for (const a of assets) {
            const payload = await getImageBase64ForApi(a.uri, a.base64, a.mimeType);
            imagePayloads.push(payload);
          }
          const data = await extractFromMultipleImagesBase64(imagePayloads);
          setExtracted(data);
          setStep('review');
        } else if (assets.length === 1) {
          const { base64, mimeType } = await getImageBase64ForApi(assets[0].uri, assets[0].base64, assets[0].mimeType);
          const data = await extractFromImageBase64(base64, mimeType);
          setExtracted(data);
          setStep('review');
        } else {
          setExtracted(await extractFromText('No image. Please enter details manually.'));
          setStep('review');
        }
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Extraction failed.');
      setStep('preview');
    }
  };

  const save = async () => {
    if (!extracted) return;
    const ref = extracted.documentReference?.trim();
    if (ref && currentBusiness) {
      const normalizedRef = ref.toLowerCase();
      const isDuplicate = sales.some(
        (s) =>
          s.businessId === currentBusiness.id &&
          s.extracted.documentReference?.trim().toLowerCase() === normalizedRef
      );
      if (isDuplicate) {
        Alert.alert('Duplicate sale', 'A sale with this reference has already been added.');
        return;
      }
    }
    setStep('saving');
    const extractedCategoryName = extracted.category?.trim();
    let resolvedCategoryId: string | null = categoryId;
    if (resolvedCategoryId == null && extractedCategoryName) {
      const matched = categories.find(
        (c) => c.name.toLowerCase() === extractedCategoryName.toLowerCase()
      );
      if (matched) {
        resolvedCategoryId = matched.id;
      } else {
        try {
          const newCat = await addCategory(extractedCategoryName);
          resolvedCategoryId = newCat.id;
        } catch {
          resolvedCategoryId = null;
        }
      }
    }
    try {
      const assetsForSave =
        pendingImageAssetsRef.current.length > 0 ? pendingImageAssetsRef.current : pendingImageAssets;
      const fileUriToSave = assetsForSave.length > 0 ? assetsForSave[0].uri : documentUri;
      const fileUrisToSave =
        assetsForSave.length > 1 ? assetsForSave.map((a) => a.uri) : undefined;
      await addSale({
        businessId: '',
        categoryId: resolvedCategoryId,
        source: fileName ? 'upload' : 'manual',
        fileName: fileName || undefined,
        fileUri: fileUriToSave || undefined,
        fileUris: fileUrisToSave,
        extracted,
      });
      // Reset state so next time user opens Add they see the choose step, not previous sale
      setStep('choose');
      setExtracted(null);
      setCategoryId(null);
      setFileName('');
      setDocumentUri(null);
      setPendingImageAsset(null);
      pendingImageAssetsRef.current = [];
      setPendingImageAssets([]);
      setPreviewZoomVisible(false);
      setPreviewZoomIndex(0);
      const tabNav = navigation.getParent?.();
      if (tabNav) tabNav.navigate('Records', { screen: 'SalesList' });
      else navigation.navigate('SalesList');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed.');
      setStep('edit');
    }
  };

  const acceptAndSave = () => {
    save();
  };

  const updateField = <K extends keyof ExtractedInvoiceData>(key: K, value: ExtractedInvoiceData[K]) => {
    setExtracted((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  if (step === 'choose') {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView style={styles.chooseScroll} contentContainerStyle={[styles.chooseContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Add sale</Text>
          <Text style={styles.subtitle}>
            Take or upload a picture, or upload a PDF of your sale/income. The app will extract
            merchant, amount, date, and details.
          </Text>
          <TouchableOpacity style={styles.option} onPress={takePhoto}>
            <Text style={styles.optionText}>Take photo</Text>
            <Text style={styles.optionSub}>Capture the sale document; add more sections if needed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={pickImage}>
            <Text style={styles.optionText}>Upload image</Text>
            <Text style={styles.optionSub}>Choose a photo or scan from your device</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={pickDocument}>
            <Text style={styles.optionText}>Upload file</Text>
            <Text style={styles.optionSub}>PDF document</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (step === 'preview') {
    const sections = pendingImageAssetsRef.current.length > 0 ? pendingImageAssetsRef.current : pendingImageAssets;
    const sectionCount = sections.length || (pendingImageAsset ? 1 : 0);
    const previewSections =
      !isPdf && sections.length > 0
        ? sections
        : documentUri && pendingImageAsset && !isPdf
          ? [pendingImageAsset]
          : documentUri && !isPdf
            ? [{ uri: documentUri }]
            : [];
    const previewImageSource = previewSections.map((a) => ({ uri: a.uri }));
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.previewContent}>
        <Text style={styles.title}>Confirm your file</Text>
        <Text style={styles.previewSubtitle}>
          {previewSections.length > 1
            ? 'Scroll down to see all parts of the receipt, then confirm or add another section.'
            : 'Review the image or document below, then confirm or choose another.'}
        </Text>
        {!isPdf && sectionCount > 1 && (
          <Text style={styles.sectionCountLabel}>{sectionCount} sections — scroll down to see next part</Text>
        )}
        {!isPdf && previewSections.length > 0 ? (
          <View style={styles.previewSectionsContainer}>
            {previewSections.map((section, index) => (
              <TouchableOpacity
                key={`${section.uri}-${index}`}
                style={styles.previewSectionWrap}
                onPress={() => {
                  setPreviewZoomVisible(true);
                  setPreviewZoomIndex(index);
                }}
                activeOpacity={1}
              >
                {previewSections.length > 1 && (
                  <Text style={styles.previewSectionLabel}>Part {index + 1} of {previewSections.length}</Text>
                )}
                <Image source={{ uri: section.uri }} style={styles.previewSectionImage} resizeMode="contain" />
              </TouchableOpacity>
            ))}
            <Text style={styles.previewZoomHintInline}>Tap any part to zoom and view</Text>
          </View>
        ) : isPdf && documentUri ? (
          <View style={styles.previewBox}>
            <View style={[styles.pdfPreviewContainer, { height: Math.min(420, winHeight * 0.5) }]}>
              <WebView
                source={{ uri: documentUri }}
                originWhitelist={['*']}
                allowFileAccess={true}
                style={styles.pdfPreviewWebView}
                scrollEnabled={true}
              />
            </View>
            <Text style={styles.pdfFileNamePreview}>{fileName}</Text>
          </View>
        ) : isPdf ? (
          <View style={styles.previewBox}>
            <View style={styles.pdfPlaceholder}>
              <Text style={styles.pdfPlaceholderText}>PDF document</Text>
              <Text style={styles.pdfFileName}>{fileName}</Text>
            </View>
          </View>
        ) : null}
        {!isPdf && (
          <TouchableOpacity style={styles.addSectionBtn} onPress={addAnotherSection}>
            <Text style={styles.addSectionBtnText}>+ Add another section</Text>
            <Text style={styles.addSectionBtnSub}>For long receipts, capture the next part in order</Text>
          </TouchableOpacity>
        )}
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndExtract}>
            <Text style={styles.confirmBtnText}>Confirm & extract</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectAnotherBtn} onPress={selectAnother}>
            <Text style={styles.selectAnotherBtnText}>Select another</Text>
          </TouchableOpacity>
        </View>
        {previewImageSource.length > 0 && (
          <ImageView
            images={previewImageSource}
            imageIndex={previewZoomIndex}
            visible={previewZoomVisible}
            onRequestClose={() => setPreviewZoomVisible(false)}
            doubleTapToZoomEnabled
            backgroundColor="#0f172a"
          />
        )}
      </ScrollView>
    );
  }

  if (step === 'extracting') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.extractingText}>Analysing document…</Text>
      </View>
    );
  }

  if (step === 'review' && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
        <Text style={styles.title}>Review extracted data</Text>
        <Text style={styles.reviewSubtitle}>View the uploaded document and extracted details</Text>
        {documentUri && (
          <View style={styles.docPreview}>
            {isPdf ? (
              <View style={styles.pdfPlaceholder}>
                <Text style={styles.pdfPlaceholderText}>PDF document</Text>
                <Text style={styles.pdfFileName}>{fileName}</Text>
              </View>
            ) : (
              <Image source={{ uri: documentUri }} style={styles.docImage} resizeMode="contain" />
            )}
          </View>
        )}
        <View style={styles.reviewSummary}>
          <Text style={styles.reviewMerchant}>{extracted.merchantName ?? '—'}</Text>
          <Text style={styles.reviewAmount}>{formatAmount(extracted.amount ?? 0, extracted.currency)}</Text>
          <Text style={styles.reviewMeta}>
            {extracted.date ? new Date(extracted.date).toLocaleDateString() : '—'} · {extracted.category ?? 'Uncategorised'}
          </Text>
        </View>
        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.acceptBtn} onPress={acceptAndSave}>
            <Text style={styles.acceptBtnText}>Accept & save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modifyBtn} onPress={() => setStep('edit')}>
            <Text style={styles.modifyBtnText}>Modify</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if ((step === 'edit' || step === 'saving') && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.editContent}>
        <Text style={styles.title}>Modify & save</Text>
        {documentUri && !isPdf && (
          <View style={styles.docPreviewSmall}>
            <Image source={{ uri: documentUri }} style={styles.docImageSmall} resizeMode="contain" />
          </View>
        )}
        {documentUri && isPdf && (
          <Text style={styles.docLabel}>Document: {fileName}</Text>
        )}
        <TextInput
          style={styles.input}
          placeholder="Merchant name"
          value={extracted.merchantName ?? ''}
          onChangeText={(t) => updateField('merchantName', t || undefined)}
          placeholderTextColor="#64748b"
        />
        <TextInput
          style={styles.input}
          placeholder={`Amount (${extracted.currency ?? 'GBP'})`}
          value={String(extracted.amount ?? '')}
          onChangeText={(t) => updateField('amount', parseFloat(t) || 0)}
          keyboardType="decimal-pad"
          placeholderTextColor="#64748b"
        />
        <TextInput
          style={styles.input}
          placeholder="Currency (e.g. USD, EUR)"
          value={extracted.currency ?? ''}
          onChangeText={(t) => updateField('currency', t || undefined)}
          placeholderTextColor="#64748b"
        />
        <TextInput
          style={styles.input}
          placeholder="Date (YYYY-MM-DD)"
          value={extracted.date ?? ''}
          onChangeText={(t) => updateField('date', t)}
          placeholderTextColor="#64748b"
        />
        <Text style={styles.label}>Category</Text>
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
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={step === 'saving'}>
          {step === 'saving' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save sale</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', margin: 20 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginHorizontal: 20, marginBottom: 20 },
  chooseScroll: { flex: 1 },
  chooseContent: { paddingBottom: 24 },
  option: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  optionText: { fontSize: 16, fontWeight: '600', color: '#f8fafc' },
  optionSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  previewContent: { padding: 20, paddingBottom: 40 },
  previewSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  sectionCountLabel: { fontSize: 14, color: '#818cf8', fontWeight: '600', marginBottom: 12 },
  previewSectionsContainer: { marginBottom: 16 },
  previewSectionWrap: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
  },
  previewSectionImage: { width: '100%', height: 260 },
  previewZoomHintInline: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 8 },
  addSectionBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  addSectionBtnText: { fontSize: 16, fontWeight: '600', color: '#e2e8f0' },
  addSectionBtnSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  previewBox: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    minHeight: 220,
  },
  previewImageTouchable: { width: '100%' },
  previewImage: { width: '100%', height: 280 },
  previewZoomHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  previewZoomHintText: { fontSize: 12, color: '#e2e8f0', textAlign: 'center' },
  previewActions: { gap: 12 },
  confirmBtn: { backgroundColor: '#22c55e', borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  selectAnotherBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectAnotherBtnText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  extractingText: { marginTop: 16, color: '#94a3b8' },
  reviewContent: { padding: 20, paddingBottom: 40 },
  reviewSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 16 },
  docPreview: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1e293b', minHeight: 200 },
  docImage: { width: '100%', height: 280 },
  docPreviewSmall: { marginBottom: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1e293b', alignSelf: 'center' },
  docImageSmall: { width: 200, height: 140 },
  docLabel: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  pdfPreviewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  pdfPreviewWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b',
  },
  pdfFileNamePreview: { fontSize: 12, color: '#64748b', marginTop: 8, textAlign: 'center' },
  pdfPlaceholder: { padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  pdfPlaceholderText: { color: '#94a3b8', fontSize: 14 },
  pdfFileName: { color: '#64748b', fontSize: 12, marginTop: 4 },
  reviewSummary: { marginBottom: 24, padding: 16, backgroundColor: '#1e293b', borderRadius: 12 },
  reviewMerchant: { fontSize: 18, fontWeight: '600', color: '#f8fafc' },
  reviewAmount: { fontSize: 22, fontWeight: '700', color: '#22c55e', marginTop: 8 },
  reviewMeta: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  reviewActions: { gap: 12 },
  acceptBtn: { backgroundColor: '#22c55e', borderRadius: 12, padding: 16, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modifyBtn: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modifyBtnText: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  editContent: { padding: 20, paddingBottom: 40 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 12,
  },
  label: { fontSize: 14, color: '#94a3b8', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
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
});
