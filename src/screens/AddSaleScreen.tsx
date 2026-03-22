import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Image,
  useWindowDimensions,
} from 'react-native';
import AppText from '../components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ImageView from 'react-native-image-viewing';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { extractFromText, extractFromImageBase64, extractFromMultipleImagesBase64, extractFromPdfBase64 } from '../services/invoiceExtraction';
import { uploadAttachments } from '../services/attachmentStorage';
import { renderPdfFirstPageToImageBase64 } from '../services/pdfText';
import { formatAmount } from '../utils/currency';
import { maybeSaveCameraImageToGallery } from '../utils/saveCameraImageToGallery';
import type { ExtractedInvoiceData } from '../types';
import {
  BORDER,
  CARD_BG,
  GREEN,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '../theme/design';

export default function AddSaleScreen({
  navigation,
}: {
  navigation: { navigate: (s: string) => void; getParent?: () => { navigate: (s: string) => void } | undefined };
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { addSale, updateSale, addCategory, categories, sales, currentBusiness } = useApp();
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
    void maybeSaveCameraImageToGallery(asset.uri);
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
    void maybeSaveCameraImageToGallery(asset.uri);
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
      const urisToUpload = fileUrisToSave?.length
        ? fileUrisToSave
        : fileUriToSave
          ? [fileUriToSave]
          : [];

      const newSale = await addSale({
        businessId: '',
        categoryId: resolvedCategoryId,
        source: fileName ? 'upload' : 'manual',
        fileName: fileName || undefined,
        fileUri: undefined,
        fileUris: undefined,
        extracted,
      });

      if (urisToUpload.length > 0 && user?.id) {
        const isPdf = fileName?.toLowerCase().endsWith('.pdf');
        const urls = await uploadAttachments(
          user.id,
          'sales',
          newSale.id,
          urisToUpload,
          isPdf
        );
        await updateSale(newSale.id, {
          fileUri: urls[0],
          fileUris: urls.length > 1 ? urls : undefined,
        });
      }

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
      const tabNav = navigation.getParent?.() as { navigate: (a: string, b?: { screen: string }) => void } | undefined;
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
          <AppText style={styles.title}>Add sale</AppText>
          <AppText style={styles.subtitle}>
            Take or upload a picture, or upload a PDF of your sale/income. The app will extract
            merchant, amount, date, and details.
          </AppText>
          <TouchableOpacity style={styles.option} onPress={takePhoto}>
            <AppText style={styles.optionText}>Take photo</AppText>
            <AppText style={styles.optionSub}>Capture the sale document; add more sections if needed</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={pickImage}>
            <AppText style={styles.optionText}>Upload image</AppText>
            <AppText style={styles.optionSub}>Choose a photo or scan from your device</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={pickDocument}>
            <AppText style={styles.optionText}>Upload file</AppText>
            <AppText style={styles.optionSub}>PDF document</AppText>
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
        <AppText style={styles.title}>Confirm your file</AppText>
        <AppText style={styles.previewSubtitle}>
          {previewSections.length > 1
            ? 'Scroll down to see all parts of the receipt, then confirm or add another section.'
            : 'Review the image or document below, then confirm or choose another.'}
        </AppText>
        {!isPdf && sectionCount > 1 && (
          <AppText style={styles.sectionCountLabel}>{sectionCount} sections — scroll down to see next part</AppText>
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
                  <AppText style={styles.previewSectionLabel}>Part {index + 1} of {previewSections.length}</AppText>
                )}
                <Image source={{ uri: section.uri }} style={styles.previewSectionImage} resizeMode="contain" />
              </TouchableOpacity>
            ))}
            <AppText style={styles.previewZoomHintInline}>Tap any part to zoom and view</AppText>
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
            <AppText style={styles.pdfFileNamePreview}>{fileName}</AppText>
          </View>
        ) : isPdf ? (
          <View style={styles.previewBox}>
            <View style={styles.pdfPlaceholder}>
              <AppText style={styles.pdfPlaceholderText}>PDF document</AppText>
              <AppText style={styles.pdfFileName}>{fileName}</AppText>
            </View>
          </View>
        ) : null}
        {!isPdf && (
          <TouchableOpacity style={styles.addSectionBtn} onPress={addAnotherSection}>
            <AppText style={styles.addSectionBtnText}>+ Add another section</AppText>
            <AppText style={styles.addSectionBtnSub}>For long receipts, capture the next part in order</AppText>
          </TouchableOpacity>
        )}
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndExtract}>
            <AppText style={styles.confirmBtnText}>Confirm & extract</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectAnotherBtn} onPress={selectAnother}>
            <AppText style={styles.selectAnotherBtnText}>Select another</AppText>
          </TouchableOpacity>
        </View>
        {previewImageSource.length > 0 && (
          <ImageView
            images={previewImageSource}
            imageIndex={previewZoomIndex}
            visible={previewZoomVisible}
            onRequestClose={() => setPreviewZoomVisible(false)}
            doubleTapToZoomEnabled
            backgroundColor={CARD_BG}
          />
        )}
      </ScrollView>
    );
  }

  if (step === 'extracting') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <AppText style={styles.extractingText}>Analysing document…</AppText>
      </View>
    );
  }

  if (step === 'review' && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
        <AppText style={styles.title}>Review extracted data</AppText>
        <AppText style={styles.reviewSubtitle}>View the uploaded document and extracted details</AppText>
        {documentUri && (
          <View style={styles.docPreview}>
            {isPdf ? (
              <View style={styles.pdfPlaceholder}>
                <AppText style={styles.pdfPlaceholderText}>PDF document</AppText>
                <AppText style={styles.pdfFileName}>{fileName}</AppText>
              </View>
            ) : (
              <Image source={{ uri: documentUri }} style={styles.docImage} resizeMode="contain" />
            )}
          </View>
        )}
        <View style={styles.reviewSummary}>
          <AppText style={styles.reviewMerchant}>{extracted.merchantName ?? '—'}</AppText>
          <AppText style={styles.reviewAmount}>{formatAmount(extracted.amount ?? 0, extracted.currency)}</AppText>
          <AppText style={styles.reviewMeta}>
            {extracted.date ? new Date(extracted.date).toLocaleDateString() : '—'} · {extracted.category ?? 'Uncategorised'}
          </AppText>
        </View>
        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.acceptBtn} onPress={acceptAndSave}>
            <AppText style={styles.acceptBtnText}>Accept & save</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modifyBtn} onPress={() => setStep('edit')}>
            <AppText style={styles.modifyBtnText}>Modify</AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if ((step === 'edit' || step === 'saving') && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.editContent}>
        <AppText style={styles.title}>Modify & save</AppText>
        {documentUri && !isPdf && (
          <View style={styles.docPreviewSmall}>
            <Image source={{ uri: documentUri }} style={styles.docImageSmall} resizeMode="contain" />
          </View>
        )}
        {documentUri && isPdf && (
          <AppText style={styles.docLabel}>Document: {fileName}</AppText>
        )}
        <TextInput
          style={styles.input}
          placeholder="Merchant name"
          value={extracted.merchantName ?? ''}
          onChangeText={(t) => updateField('merchantName', t || undefined)}
          placeholderTextColor={TEXT_MUTED}
        />
        <TextInput
          style={styles.input}
          placeholder={`Amount (${extracted.currency ?? 'GBP'})`}
          value={String(extracted.amount ?? '')}
          onChangeText={(t) => updateField('amount', parseFloat(t) || 0)}
          keyboardType="decimal-pad"
          placeholderTextColor={TEXT_MUTED}
        />
        <TextInput
          style={styles.input}
          placeholder="Currency (e.g. USD, EUR)"
          value={extracted.currency ?? ''}
          onChangeText={(t) => updateField('currency', t || undefined)}
          placeholderTextColor={TEXT_MUTED}
        />
        <TextInput
          style={styles.input}
          placeholder="Date (YYYY-MM-DD)"
          value={extracted.date ?? ''}
          onChangeText={(t) => updateField('date', t)}
          placeholderTextColor={TEXT_MUTED}
        />
        <AppText style={styles.label}>Category</AppText>
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
        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={step === 'saving'}>
          {step === 'saving' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText style={styles.saveBtnText}>Save sale</AppText>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  centered: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: TEXT, margin: 20 },
  subtitle: { fontSize: 14, color: TEXT_SECONDARY, marginHorizontal: 20, marginBottom: 20 },
  chooseScroll: { flex: 1 },
  chooseContent: { paddingBottom: 24 },
  option: {
    backgroundColor: MUTED_CARD,
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  optionText: { fontSize: 16, fontWeight: '600', color: TEXT },
  optionSub: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  previewContent: { padding: 20, paddingBottom: 40 },
  previewSubtitle: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 16 },
  sectionCountLabel: { fontSize: 14, color: PRIMARY, fontWeight: '600', marginBottom: 12 },
  previewSectionsContainer: { marginBottom: 16 },
  previewSectionWrap: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: MUTED_CARD,
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: MUTED_CARD,
  },
  previewSectionImage: { width: '100%', height: 260 },
  previewZoomHintInline: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', marginBottom: 8 },
  addSectionBtn: {
    backgroundColor: MUTED_CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
  },
  addSectionBtnText: { fontSize: 16, fontWeight: '600', color: TEXT },
  addSectionBtnSub: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  previewBox: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: MUTED_CARD,
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
  previewZoomHintText: { fontSize: 12, color: TEXT, textAlign: 'center' },
  previewActions: { gap: 12 },
  confirmBtn: { backgroundColor: GREEN, borderRadius: 12, padding: 16, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  selectAnotherBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  selectAnotherBtnText: { color: TEXT_SECONDARY, fontSize: 16, fontWeight: '600' },
  extractingText: { marginTop: 16, color: TEXT_SECONDARY },
  reviewContent: { padding: 20, paddingBottom: 40 },
  reviewSubtitle: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 16 },
  docPreview: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: MUTED_CARD, minHeight: 200 },
  docImage: { width: '100%', height: 280 },
  docPreviewSmall: { marginBottom: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: MUTED_CARD, alignSelf: 'center' },
  docImageSmall: { width: 200, height: 140 },
  docLabel: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 12 },
  pdfPreviewContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: MUTED_CARD,
  },
  pdfPreviewWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: MUTED_CARD,
  },
  pdfFileNamePreview: { fontSize: 12, color: TEXT_MUTED, marginTop: 8, textAlign: 'center' },
  pdfPlaceholder: { padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  pdfPlaceholderText: { color: TEXT_SECONDARY, fontSize: 14 },
  pdfFileName: { color: TEXT_MUTED, fontSize: 12, marginTop: 4 },
  reviewSummary: { marginBottom: 24, padding: 16, backgroundColor: MUTED_CARD, borderRadius: 12 },
  reviewMerchant: { fontSize: 18, fontWeight: '600', color: TEXT },
  reviewAmount: { fontSize: 22, fontWeight: '700', color: GREEN, marginTop: 8 },
  reviewMeta: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  reviewActions: { gap: 12 },
  acceptBtn: { backgroundColor: GREEN, borderRadius: 12, padding: 16, alignItems: 'center' },
  acceptBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modifyBtn: { backgroundColor: MUTED_CARD, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  modifyBtnText: { color: TEXT, fontSize: 16, fontWeight: '600' },
  editContent: { padding: 20, paddingBottom: 40 },
  input: {
    backgroundColor: MUTED_CARD,
    borderRadius: 12,
    padding: 14,
    color: TEXT,
    fontSize: 16,
    marginBottom: 12,
  },
  label: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: MUTED_CARD,
  },
  chipActive: { backgroundColor: PRIMARY },
  chipText: { color: TEXT_SECONDARY, fontSize: 14 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
