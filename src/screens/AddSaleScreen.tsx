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
  Platform,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  LAVENDER_SOFT,
  MUTED_CARD,
  PAGE_BG,
  PRIMARY,
  PURPLE_DEEP,
  TEXT,
  TEXT_MUTED,
  TEXT_SECONDARY,
  shadowCard,
  shadowCardLight,
} from '../theme/design';

const SALE_TILE_BG = '#ECFDF5';
const SALE_ICON = '#059669';

export default function AddSaleScreen({
  navigation,
}: {
  navigation: { navigate: (s: string) => void; getParent?: () => { navigate: (s: string) => void } | undefined };
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const { user } = useAuth();
  const { addSale, updateSale, addCategory, categories, sales, currentBusiness } = useApp();
  const [step, setStep] = useState<
    'choose' | 'preview' | 'extracting' | 'review' | 'edit' | 'saving' | 'done'
  >('choose');
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
        const isPdfUpload = fileName?.toLowerCase().endsWith('.pdf');
        const urls = await uploadAttachments(
          user.id,
          'sales',
          newSale.id,
          urisToUpload,
          isPdfUpload
        );
        await updateSale(newSale.id, {
          fileUri: urls[0],
          fileUris: urls.length > 1 ? urls : undefined,
        });
      }

      setStep('done');
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

  const finishAndLeave = () => {
    setStep('choose');
    setExtracted(null);
    setCategoryId(null);
    setFileName('');
    setDocumentUri(null);
    setIsPdf(false);
    setPendingImageAsset(null);
    pendingImageAssetsRef.current = [];
    setPendingImageAssets([]);
    setPreviewZoomVisible(false);
    setPreviewZoomIndex(0);
    const tabNav = navigation.getParent?.() as { navigate: (a: string, b?: { screen: string }) => void } | undefined;
    if (tabNav) tabNav.navigate('Records', { screen: 'SalesList' });
    else navigation.navigate('SalesList');
  };

  if (step === 'choose') {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView
          style={styles.chooseScroll}
          contentContainerStyle={[styles.chooseContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heroTitle}>Add sale</Text>
          <Text style={styles.heroSubtitle}>
            Scan or upload a sale or income document. We extract merchant, amount, date, and details for you.
          </Text>
          <TouchableOpacity style={styles.optionCard} onPress={takePhoto} activeOpacity={0.88}>
            <View style={[styles.optionIconBlob, { backgroundColor: SALE_TILE_BG }]}>
              <Ionicons name="camera-outline" size={26} color={SALE_ICON} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Take photo</Text>
              <Text style={styles.optionDesc}>Capture the document; add sections if needed</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionCard} onPress={pickImage} activeOpacity={0.88}>
            <View style={[styles.optionIconBlob, { backgroundColor: SALE_TILE_BG }]}>
              <Ionicons name="images-outline" size={26} color={SALE_ICON} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Upload image</Text>
              <Text style={styles.optionDesc}>Choose from your photo library</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionCard} onPress={pickDocument} activeOpacity={0.88}>
            <View style={[styles.optionIconBlob, { backgroundColor: SALE_TILE_BG }]}>
              <Ionicons name="document-text-outline" size={26} color={SALE_ICON} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Upload PDF</Text>
              <Text style={styles.optionDesc}>Import a PDF record</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
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
        <Text style={styles.screenTitle}>Confirm your file</Text>
        <Text style={styles.screenSubtitle}>
          {previewSections.length > 1
            ? 'Scroll to see every part, then extract or add another section.'
            : 'Check the preview below, then extract details or pick a different file.'}
        </Text>
        {!isPdf && sectionCount > 1 && (
          <View style={[styles.pillHint, { backgroundColor: SALE_TILE_BG }]}>
            <Text style={[styles.pillHintText, { color: SALE_ICON }]}>{sectionCount} sections — scroll for next part</Text>
          </View>
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
                activeOpacity={0.95}
              >
                {previewSections.length > 1 && (
                  <Text style={styles.previewSectionLabel}>
                    Part {index + 1} of {previewSections.length}
                  </Text>
                )}
                <Image source={{ uri: section.uri }} style={styles.previewSectionImage} resizeMode="contain" />
              </TouchableOpacity>
            ))}
            <Text style={styles.previewZoomHintInline}>Tap any part to zoom</Text>
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
              <Ionicons name="document-text-outline" size={40} color={SALE_ICON} />
              <Text style={styles.pdfPlaceholderText}>PDF document</Text>
              <Text style={styles.pdfFileName}>{fileName}</Text>
            </View>
          </View>
        ) : null}
        {!isPdf && (
          <TouchableOpacity style={styles.addSectionBtn} onPress={addAnotherSection} activeOpacity={0.88}>
            <Ionicons name="add-circle-outline" size={22} color={SALE_ICON} style={styles.addSectionIcon} />
            <View style={styles.addSectionTextCol}>
              <Text style={styles.addSectionBtnText}>Add another section</Text>
              <Text style={styles.addSectionBtnSub}>For long receipts, capture the next part in order</Text>
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.gradientBtnWrap} onPress={confirmAndExtract} activeOpacity={0.92}>
            <LinearGradient
              colors={[PRIMARY, PURPLE_DEEP]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.gradientBtnText}>Confirm & extract</Text>
              <Ionicons name="sparkles-outline" size={20} color="#fff" style={styles.gradientBtnIcon} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={selectAnother} activeOpacity={0.88}>
            <Text style={styles.secondaryBtnText}>Choose different file</Text>
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
        <View style={styles.extractingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.extractingTitle}>Reading your document</Text>
          <Text style={styles.extractingSub}>Extracting merchant, amount, and details…</Text>
        </View>
      </View>
    );
  }

  if (step === 'review' && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
        <View style={styles.reviewHeaderRow}>
          <View style={[styles.reviewBadge, { backgroundColor: SALE_TILE_BG }]}>
            <Ionicons name="trending-up-outline" size={20} color={SALE_ICON} />
          </View>
          <View style={styles.reviewHeaderText}>
            <Text style={styles.screenTitle}>Review & save</Text>
            <Text style={styles.screenSubtitle}>Check details match your sale before saving</Text>
          </View>
        </View>
        {documentUri && (
          <View style={styles.docPreview}>
            {isPdf ? (
              <View style={styles.pdfPlaceholder}>
                <Ionicons name="document-text-outline" size={36} color={SALE_ICON} />
                <Text style={styles.pdfPlaceholderText}>PDF document</Text>
                <Text style={styles.pdfFileName}>{fileName}</Text>
              </View>
            ) : (
              <Image source={{ uri: documentUri }} style={styles.docImage} resizeMode="contain" />
            )}
          </View>
        )}
        <View style={styles.reviewSummary}>
          <Text style={styles.summaryLabel}>Merchant</Text>
          <Text style={styles.reviewMerchant}>{extracted.merchantName ?? '—'}</Text>
          <Text style={styles.summaryLabel}>Amount</Text>
          <Text style={styles.reviewAmountIncome}>
            {formatAmount(extracted.amount ?? 0, extracted.currency)}
          </Text>
          <View style={styles.reviewMetaRow}>
            <Ionicons name="calendar-outline" size={16} color={TEXT_MUTED} />
            <Text style={styles.reviewMeta}>
              {extracted.date ? new Date(extracted.date).toLocaleDateString() : '—'}
            </Text>
            <Text style={styles.reviewMetaDot}>·</Text>
            <Text style={styles.reviewMeta}>{extracted.category ?? 'Uncategorised'}</Text>
          </View>
        </View>
        <View style={styles.reviewActions}>
          <TouchableOpacity style={styles.gradientBtnWrap} onPress={acceptAndSave} activeOpacity={0.92}>
            <LinearGradient
              colors={[PRIMARY, PURPLE_DEEP]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.gradientBtnText}>Accept & save</Text>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" style={styles.gradientBtnIcon} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('edit')} activeOpacity={0.88}>
            <Text style={styles.secondaryBtnText}>Edit details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if ((step === 'edit' || step === 'saving') && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.editContent}>
        <Text style={styles.screenTitle}>Edit details</Text>
        <Text style={styles.screenSubtitle}>Adjust any fields, then save to your records</Text>
        {documentUri && !isPdf && (
          <View style={styles.docPreviewSmall}>
            <Image source={{ uri: documentUri }} style={styles.docImageSmall} resizeMode="contain" />
          </View>
        )}
        {documentUri && isPdf && (
          <View style={styles.pdfNameRow}>
            <Ionicons name="document-outline" size={18} color={SALE_ICON} />
            <Text style={styles.docLabel}>{fileName}</Text>
          </View>
        )}
        <Text style={styles.fieldLabel}>Merchant</Text>
        <TextInput
          style={styles.input}
          placeholder="Merchant name"
          value={extracted.merchantName ?? ''}
          onChangeText={(t) => updateField('merchantName', t || undefined)}
          placeholderTextColor={TEXT_MUTED}
        />
        <Text style={styles.fieldLabel}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder={`Amount (${extracted.currency ?? 'GBP'})`}
          value={String(extracted.amount ?? '')}
          onChangeText={(t) => updateField('amount', parseFloat(t) || 0)}
          keyboardType="decimal-pad"
          placeholderTextColor={TEXT_MUTED}
        />
        <Text style={styles.fieldLabel}>Currency</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. GBP, USD, EUR"
          value={extracted.currency ?? ''}
          onChangeText={(t) => updateField('currency', t || undefined)}
          placeholderTextColor={TEXT_MUTED}
        />
        <Text style={styles.fieldLabel}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={extracted.date ?? ''}
          onChangeText={(t) => updateField('date', t)}
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
          style={[styles.gradientBtnWrap, step === 'saving' && styles.gradientBtnDisabled]}
          onPress={save}
          disabled={step === 'saving'}
          activeOpacity={0.92}
        >
          <LinearGradient
            colors={[PRIMARY, PURPLE_DEEP]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradientBtn}
          >
            {step === 'saving' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.gradientBtnText}>Save sale</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.gradientBtnIcon} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === 'done' && extracted) {
    return (
      <View style={[styles.container, styles.doneRoot, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.doneCard}>
          <LinearGradient
            colors={[SALE_TILE_BG, LAVENDER_SOFT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneIconRing}
          >
            <View style={styles.doneIconInner}>
              <Ionicons name="checkmark" size={44} color={SALE_ICON} />
            </View>
          </LinearGradient>
          <Text style={styles.doneTitle}>Sale saved</Text>
          <Text style={styles.doneSubtitle}>
            {extracted.merchantName ?? 'Sale'} · {formatAmount(extracted.amount ?? 0, extracted.currency)}
          </Text>
          <Text style={styles.doneHint}>You can find it anytime in Records → Sales</Text>
        </View>
        <TouchableOpacity style={styles.gradientBtnWrap} onPress={finishAndLeave} activeOpacity={0.92}>
          <LinearGradient
            colors={[PRIMARY, PURPLE_DEEP]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradientBtn}
          >
            <Text style={styles.gradientBtnText}>View sales</Text>
            <Ionicons name="list-outline" size={22} color="#fff" style={styles.gradientBtnIcon} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG },
  centered: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  chooseScroll: { flex: 1 },
  chooseContent: { paddingTop: 8, paddingHorizontal: 20 },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_SECONDARY,
    marginBottom: 24,
    textTransform: 'none',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  optionIconBlob: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: { flex: 1, marginLeft: 14, marginRight: 8 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: TEXT, textTransform: 'none' },
  optionDesc: { fontSize: 13, fontWeight: '500', color: TEXT_MUTED, marginTop: 3, lineHeight: 18, textTransform: 'none' },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 6,
    textTransform: 'none',
  },
  screenSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_SECONDARY,
    marginBottom: 20,
    textTransform: 'none',
  },
  pillHint: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  pillHintText: { fontSize: 13, fontWeight: '600', textTransform: 'none' },
  previewContent: { padding: 20, paddingBottom: 40 },
  previewSectionsContainer: { marginBottom: 12 },
  previewSectionWrap: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: MUTED_CARD,
    textTransform: 'none',
  },
  previewSectionImage: { width: '100%', height: 260, backgroundColor: MUTED_CARD },
  previewZoomHintInline: {
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'none',
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MUTED_CARD,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
  },
  addSectionIcon: { marginRight: 12 },
  addSectionTextCol: { flex: 1 },
  addSectionBtnText: { fontSize: 16, fontWeight: '700', color: TEXT, textTransform: 'none' },
  addSectionBtnSub: { fontSize: 13, color: TEXT_MUTED, marginTop: 4, textTransform: 'none' },
  previewBox: {
    marginBottom: 20,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    minHeight: 220,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  previewActions: { gap: 12 },
  gradientBtnWrap: {
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
  gradientBtnDisabled: { opacity: 0.75 },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  gradientBtnText: { fontSize: 17, fontWeight: '700', color: '#fff', textTransform: 'none' },
  gradientBtnIcon: { marginLeft: 8 },
  secondaryBtn: {
    backgroundColor: CARD_BG,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: { color: TEXT_MUTED, fontSize: 16, fontWeight: '600', textTransform: 'none' },
  extractingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCard,
  },
  extractingTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    textTransform: 'none',
  },
  extractingSub: {
    marginTop: 8,
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    textTransform: 'none',
  },
  reviewContent: { padding: 20, paddingBottom: 40 },
  reviewHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 14 },
  reviewBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewHeaderText: { flex: 1 },
  docPreview: {
    marginBottom: 18,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    minHeight: 200,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  docImage: { width: '100%', height: 280, backgroundColor: MUTED_CARD },
  docPreviewSmall: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  docImageSmall: { width: 200, height: 140 },
  pdfNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 12,
    backgroundColor: MUTED_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  docLabel: { fontSize: 14, color: TEXT, flex: 1, fontWeight: '500', textTransform: 'none' },
  pdfPreviewContainer: {
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: MUTED_CARD,
  },
  pdfPreviewWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: MUTED_CARD,
  },
  pdfFileNamePreview: { fontSize: 12, color: TEXT_MUTED, marginTop: 8, textAlign: 'center', textTransform: 'none' },
  pdfPlaceholder: { padding: 28, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  pdfPlaceholderText: { color: TEXT_SECONDARY, fontSize: 14, marginTop: 8, textTransform: 'none' },
  pdfFileName: { color: TEXT_MUTED, fontSize: 12, marginTop: 4, textTransform: 'none' },
  reviewSummary: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  reviewMerchant: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 16, textTransform: 'none' },
  reviewAmountIncome: {
    fontSize: 28,
    fontWeight: '800',
    color: SALE_ICON,
    marginBottom: 14,
    letterSpacing: -0.5,
    textTransform: 'none',
  },
  reviewMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  reviewMeta: { fontSize: 14, color: TEXT_SECONDARY, textTransform: 'none' },
  reviewMetaDot: { fontSize: 14, color: TEXT_SECONDARY },
  reviewActions: { gap: 12 },
  editContent: { padding: 20, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
    marginBottom: 8,
    textTransform: 'none',
  },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    color: TEXT,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    ...shadowCardLight,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
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
  doneRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  doneCard: {
    alignItems: 'center',
    marginBottom: 32,
  },
  doneIconRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneIconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowCardLight,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: TEXT, marginBottom: 8, textTransform: 'none' },
  doneSubtitle: { fontSize: 17, fontWeight: '600', color: TEXT_MUTED, textAlign: 'center', textTransform: 'none' },
  doneHint: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    textTransform: 'none',
  },
});
