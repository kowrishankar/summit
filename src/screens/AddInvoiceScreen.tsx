import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { usePendingExtraction } from '../contexts/PendingExtractionContext';
import { runReceiptExtraction } from '../services/receiptExtractionRunner';
import { uploadAttachments } from '../services/attachmentStorage';
import { formatAmount } from '../utils/currency';
import { maybeSaveCameraImageToGallery } from '../utils/saveCameraImageToGallery';
import { placeholderProcessingExtracted, placeholderFailedExtracted } from '../utils/placeholderReceipt';
import type { ExtractedInvoiceData } from '../types';
import { displayIssuedBy, displayIssuedTo } from '../utils/extractedParties';
import { findDuplicateInvoiceForSave } from '../utils/receiptDuplicate';
import { resolveCategoryIdForSave } from '../services/categoryResolution';
import { pdfFirstPageAsImageAsset } from '../utils/appendPdfFirstPageAsImageSection';
import {
  BORDER,
  CARD_BG,
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

const OPTION_TILE_BG = '#F5F3FF';
const OPTION_ICON = '#4338CA';

export default function AddInvoiceScreen({
  navigation,
}: {
  navigation: { navigate: (s: string) => void; getParent?: () => { navigate: (s: string) => void } | undefined; setParams: (p: object) => void };
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const route = useRoute();
  const nav = useNavigation();
  const { user } = useAuth();
  const {
    addInvoice,
    updateInvoice,
    deleteInvoice,
    addCategory,
    categories,
    invoices,
    currentBusiness,
    loadInvoices,
  } = useApp();
  const { addPendingExtracting, updatePending, removePending, items: pendingItems } = usePendingExtraction();
  const [step, setStep] = useState<
    'choose' | 'preview' | 'submitting' | 'extracting' | 'review' | 'edit' | 'saving' | 'done'
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

  const pendingSessionIdRef = useRef<string | null>(null);
  /** DB row id for background / draft invoice (same as pending context id when persisted). */
  const draftInvoiceIdRef = useRef<string | null>(null);
  const backgroundDbRecordIdRef = useRef<string | null>(null);

  const goToDashboardHome = useCallback(() => {
    const tabNav = nav.getParent?.();
    (tabNav as { navigate: (n: string, p?: object) => void } | undefined)?.navigate('Dashboard', {
      screen: 'HomeMain',
    });
  }, [nav]);

  const routeRecordId =
    (route.params as { pendingId?: string; recordId?: string } | undefined)?.pendingId ??
    (route.params as { recordId?: string } | undefined)?.recordId;

  useEffect(() => {
    const pid = routeRecordId;
    if (!pid) return;

    const inv = invoices.find((i) => i.id === pid);
    const rs = inv?.reviewStatus ?? 'complete';
    if (inv && rs !== 'complete') {
      draftInvoiceIdRef.current = pid;
      pendingSessionIdRef.current = pid;
      setFileName(inv.fileName ?? '');
      setDocumentUri(inv.fileUri ?? null);
      setIsPdf(Boolean(inv.fileName?.toLowerCase().endsWith('.pdf')));
      const fromPending = pendingItems.find((p) => p.id === pid && p.kind === 'invoice');
      if (fromPending?.imageAssets?.length) {
        pendingImageAssetsRef.current = [...fromPending.imageAssets];
        setPendingImageAssets([...fromPending.imageAssets]);
        setPendingImageAsset(fromPending.imageAssets[0] ?? null);
      } else if (inv.fileUris?.length) {
        const assets = inv.fileUris.map((uri) => ({ uri }));
        pendingImageAssetsRef.current = assets;
        setPendingImageAssets(assets);
        setPendingImageAsset(assets[0] ?? null);
      } else if (inv.fileUri) {
        const one = { uri: inv.fileUri };
        pendingImageAssetsRef.current = [one];
        setPendingImageAssets([one]);
        setPendingImageAsset(one);
      } else {
        pendingImageAssetsRef.current = [];
        setPendingImageAssets([]);
        setPendingImageAsset(null);
      }
      setExtracted(inv.extracted);
      setCategoryId(inv.categoryId);
      if (rs === 'processing') setStep('extracting');
      else if (rs === 'pending_review') setStep('review');
      else if (rs === 'failed') {
        Alert.alert(
          'Could not read receipt',
          'You can edit the details manually and save, or delete this draft from your invoices list.'
        );
        setStep('review');
      }
      nav.setParams({ pendingId: undefined, recordId: undefined } as never);
      return;
    }

    const item = pendingItems.find((i) => i.id === pid);
    if (!item || item.kind !== 'invoice') return;
    if (item.status === 'ready' && item.extracted) {
      pendingSessionIdRef.current = item.id;
      draftInvoiceIdRef.current = item.id;
      setFileName(item.fileName);
      setDocumentUri(item.documentUri);
      setIsPdf(item.isPdf);
      pendingImageAssetsRef.current = [...item.imageAssets];
      setPendingImageAssets([...item.imageAssets]);
      setPendingImageAsset(item.imageAssets[0] ?? null);
      setExtracted(item.extracted);
      setCategoryId(null);
      setStep('review');
      nav.setParams({ pendingId: undefined, recordId: undefined } as never);
    } else if (item.status === 'error') {
      Alert.alert('Could not read receipt', item.errorMessage ?? 'Extraction failed.');
      removePending(pid);
      nav.setParams({ pendingId: undefined, recordId: undefined } as never);
    }
  }, [routeRecordId, route.params, pendingItems, invoices, nav, removePending]);

  useFocusEffect(
    useCallback(() => {
      const id = draftInvoiceIdRef.current;
      if (!id) return undefined;
      const inv = invoices.find((i) => i.id === id);
      if ((inv?.reviewStatus ?? 'complete') !== 'processing') return undefined;
      const tick = setInterval(() => void loadInvoices(), 3000);
      return () => clearInterval(tick);
    }, [invoices, loadInvoices])
  );

  useEffect(() => {
    if (step !== 'extracting') return;
    const id = draftInvoiceIdRef.current;
    if (!id) return;
    const inv = invoices.find((i) => i.id === id);
    const rs = inv?.reviewStatus ?? 'complete';
    if (!inv) return;
    if (rs === 'pending_review') {
      setExtracted(inv.extracted);
      setStep('review');
    } else if (rs === 'failed') {
      setExtracted(inv.extracted);
      setStep('review');
      Alert.alert(
        'Could not read receipt',
        'You can edit the details manually and save, or delete this draft from your invoices list.'
      );
    }
  }, [invoices, step]);

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
      Alert.alert('Permission needed', 'Allow camera access to take a photo of the invoice.');
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

  const appendSectionAsset = (item: { uri: string; base64?: string; mimeType?: string }) => {
    const next = [...pendingImageAssetsRef.current, item];
    pendingImageAssetsRef.current = next;
    setPendingImageAssets(next);
    setPendingImageAsset(item);
  };

  const addAnotherSectionFromCamera = async () => {
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
    if (item) appendSectionAsset(item);
  };

  const addAnotherSectionFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to add another section.');
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
    if (item) appendSectionAsset(item);
  };

  const addAnotherSectionFromPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const pdfUri = result.assets[0].uri;
    const item = await pdfFirstPageAsImageAsset(pdfUri);
    if (item) {
      appendSectionAsset(item);
      return;
    }
    Alert.alert(
      'PDF as another section',
      Platform.OS === 'web'
        ? 'Could not read that PDF. Try a different file or use a photo instead.'
        : 'On mobile, add each extra page with Take photo or Photo library (e.g. export or screenshot a page). To upload a full PDF on its own, go back and choose Upload PDF from the start.'
    );
  };

  const promptAddAnotherSection = () => {
    const msg =
      Platform.OS === 'web'
        ? 'Add the next part in order: camera, library image, or the first page of a PDF (converted to an image).'
        : 'Add the next part with the camera or from your library. For a PDF page, save or screenshot it to Photos first, then choose it from the library.';
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo', onPress: () => void addAnotherSectionFromCamera() },
      { text: 'Photo library', onPress: () => void addAnotherSectionFromLibrary() },
    ];
    if (Platform.OS === 'web') {
      buttons.push({ text: 'PDF (first page)', onPress: () => void addAnotherSectionFromPdf() });
    }
    Alert.alert('Add another section', msg, buttons);
  };

  const removePendingSectionAt = (index: number) => {
    const current =
      pendingImageAssetsRef.current.length > 0
        ? [...pendingImageAssetsRef.current]
        : pendingImageAssets.length > 0
          ? [...pendingImageAssets]
          : [];
    if (index < 0 || index >= current.length || current.length < 2) return;

    const next = current.filter((_, i) => i !== index);
    pendingImageAssetsRef.current = next;
    setPendingImageAssets(next);
    setDocumentUri(next[0]?.uri ?? null);
    setPendingImageAsset(next[Math.min(index, next.length - 1)] ?? null);

    setPreviewZoomIndex((zi) => {
      if (next.length === 0) return 0;
      if (index < zi) return zi - 1;
      if (index === zi) return Math.min(zi, next.length - 1);
      if (zi >= next.length) return next.length - 1;
      return zi;
    });
  };

  const confirmRemovePreviewSection = (index: number) => {
    Alert.alert(
      'Remove this part?',
      'This section will be removed from the receipt. You can add another section again if you need to.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePendingSectionAt(index) },
      ]
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to photos to upload an invoice image.');
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
    draftInvoiceIdRef.current = null;
    pendingSessionIdRef.current = null;
    backgroundDbRecordIdRef.current = null;
    setStep('choose');
    setDocumentUri(null);
    setFileName('');
    setIsPdf(false);
    setPendingImageAsset(null);
    pendingImageAssetsRef.current = [];
    setPendingImageAssets([]);
    setPreviewZoomVisible(false);
    setPreviewZoomIndex(0);
  };

  const confirmAndExtract = async () => {
    const hasImages = pendingImageAssets.length > 0 || pendingImageAsset?.uri || documentUri;
    if (!hasImages && !documentUri) return;

    const assets =
      pendingImageAssetsRef.current.length > 0
        ? [...pendingImageAssetsRef.current]
        : pendingImageAssets.length > 0
          ? [...pendingImageAssets]
          : pendingImageAsset
            ? [pendingImageAsset]
            : [];

    const snapshot = {
      isPdf,
      fileName: fileName || (isPdf ? 'invoice.pdf' : 'image.jpg'),
      documentUri,
      imageAssets: assets.map((a) => ({ ...a })),
    };

    const fileUrisToSave =
      snapshot.imageAssets.length > 1 ? snapshot.imageAssets.map((a) => a.uri) : undefined;
    const fileUriToSave =
      snapshot.imageAssets.length > 0 ? snapshot.imageAssets[0].uri : snapshot.documentUri;
    const urisToUpload = fileUrisToSave?.length
      ? fileUrisToSave
      : fileUriToSave
        ? [fileUriToSave]
        : [];

    backgroundDbRecordIdRef.current = null;
    draftInvoiceIdRef.current = null;

    setStep('submitting');
    try {
      const placeholder = placeholderProcessingExtracted();
      const newInvoice = await addInvoice({
        businessId: '',
        categoryId: null,
        source: 'upload',
        fileName: snapshot.fileName,
        fileUri: undefined,
        fileUris: undefined,
        extracted: placeholder,
        reviewStatus: 'processing',
      });
      const recordId = newInvoice.id;
      backgroundDbRecordIdRef.current = recordId;
      draftInvoiceIdRef.current = recordId;
      pendingSessionIdRef.current = recordId;

      addPendingExtracting({
        id: recordId,
        kind: 'invoice',
        fileName: snapshot.fileName,
        isPdf: snapshot.isPdf,
        documentUri: snapshot.documentUri,
        imageAssets: snapshot.imageAssets,
      });

      void runReceiptExtraction(snapshot, 'invoice')
        .then(async (data) => {
          await updateInvoice(recordId, {
            extracted: data,
            reviewStatus: 'pending_review',
          });
          updatePending(recordId, { status: 'ready', extracted: data });
        })
        .catch(async (e) => {
          const msg = e instanceof Error ? e.message : 'Extraction failed.';
          await updateInvoice(recordId, {
            extracted: placeholderFailedExtracted(),
            reviewStatus: 'failed',
          });
          updatePending(recordId, { status: 'error', errorMessage: msg });
        });

      if (urisToUpload.length > 0 && user?.id) {
        const uid = user.id;
        const isPdfUpload = snapshot.fileName.toLowerCase().endsWith('.pdf');
        void (async () => {
          try {
            const urls = await uploadAttachments(uid, 'invoices', recordId, urisToUpload, isPdfUpload);
            await updateInvoice(recordId, {
              fileUri: urls[0],
              fileUris: urls.length > 1 ? urls : undefined,
            });
          } catch (e) {
            if (__DEV__) console.warn('[AddInvoice] attachment upload failed', e);
          }
        })();
      }

      selectAnother();
      goToDashboardHome();
    } catch (err) {
      Alert.alert(
        'Could not save draft',
        err instanceof Error ? err.message : 'Please try again.'
      );
      setStep('preview');
    }
  };

  const executeSave = async (extractedPayload: ExtractedInvoiceData) => {
    setStep('saving');
    const resolvedCategoryId = await resolveCategoryIdForSave({
      userSelectedCategoryId: categoryId,
      extracted: extractedPayload,
      categories,
      docKind: 'invoice',
      addCategory,
    });
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

      const draftId = draftInvoiceIdRef.current;
      if (draftId) {
        await updateInvoice(draftId, {
          categoryId: resolvedCategoryId,
          extracted: extractedPayload,
          reviewStatus: 'complete',
          fileName: fileName || undefined,
        });
        const existing = invoices.find((i) => i.id === draftId);
        const hasRemote =
          Boolean(existing?.fileUri) || Boolean(existing?.fileUris?.length);
        if (!hasRemote && urisToUpload.length > 0 && user?.id) {
          const isPdfUpload = fileName?.toLowerCase().endsWith('.pdf');
          const urls = await uploadAttachments(
            user.id,
            'invoices',
            draftId,
            urisToUpload,
            isPdfUpload
          );
          await updateInvoice(draftId, {
            fileUri: urls[0],
            fileUris: urls.length > 1 ? urls : undefined,
          });
        }
      } else {
        const newInvoice = await addInvoice({
          businessId: '',
          categoryId: resolvedCategoryId,
          source: fileName ? 'upload' : 'manual',
          fileName: fileName || undefined,
          fileUri: undefined,
          fileUris: undefined,
          extracted: extractedPayload,
        });

        if (urisToUpload.length > 0 && user?.id) {
          const isPdfUpload = fileName?.toLowerCase().endsWith('.pdf');
          const urls = await uploadAttachments(
            user.id,
            'invoices',
            newInvoice.id,
            urisToUpload,
            isPdfUpload
          );
          await updateInvoice(newInvoice.id, {
            fileUri: urls[0],
            fileUris: urls.length > 1 ? urls : undefined,
          });
        }
      }

      setStep('done');
      if (pendingSessionIdRef.current) {
        removePending(pendingSessionIdRef.current);
        pendingSessionIdRef.current = null;
      }
      draftInvoiceIdRef.current = null;
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed.');
      setStep('edit');
    }
  };

  const save = async () => {
    if (!extracted || !currentBusiness) return;
    const dup = findDuplicateInvoiceForSave(
      invoices,
      currentBusiness.id,
      extracted,
      draftInvoiceIdRef.current ?? undefined
    );
    if (dup) {
      const refText = extracted.documentReference?.trim();
      const message =
        dup.kind === 'reference' && refText
          ? `A receipt with reference “${refText}” is already in this business. You can still save and it will be marked as a duplicate.`
          : `A receipt with the same date, amount, and merchant may already be saved. You can still save and it will be marked as a duplicate.`;
      Alert.alert('Possible duplicate', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              const draftId = draftInvoiceIdRef.current;
              if (draftId) {
                try {
                  await deleteInvoice(draftId);
                } catch (e) {
                  Alert.alert(
                    'Could not discard',
                    e instanceof Error ? e.message : 'Please try again.'
                  );
                  return;
                }
                if (pendingSessionIdRef.current === draftId) {
                  removePending(draftId);
                }
                pendingSessionIdRef.current = null;
                draftInvoiceIdRef.current = null;
                backgroundDbRecordIdRef.current = null;
              }
              finishAndLeave();
            })(),
        },
        {
          text: 'Save as duplicate',
          onPress: () =>
            void executeSave({
              ...extracted,
              isDuplicate: true,
              duplicateOfRecordId: dup.record.id,
            }),
        },
      ]);
      return;
    }
    await executeSave(extracted);
  };

  const acceptAndSave = () => {
    save();
  };

  const updateField = <K extends keyof ExtractedInvoiceData>(key: K, value: ExtractedInvoiceData[K]) => {
    setExtracted((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const finishAndLeave = () => {
    draftInvoiceIdRef.current = null;
    pendingSessionIdRef.current = null;
    backgroundDbRecordIdRef.current = null;
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
    const tabNav = navigation.getParent?.();
    if (tabNav) tabNav.navigate('Dashboard');
    else navigation.navigate('Dashboard');
  };

  const confirmDiscardDraftFromReview = () => {
    const id = draftInvoiceIdRef.current;
    if (!id) return;
    Alert.alert(
      'Discard draft?',
      'This receipt will be removed from your records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            void (async () => {
              try {
                await deleteInvoice(id);
              } catch (e) {
                Alert.alert('Could not discard', e instanceof Error ? e.message : 'Try again.');
                return;
              }
              if (pendingSessionIdRef.current === id) {
                removePending(id);
              }
              pendingSessionIdRef.current = null;
              draftInvoiceIdRef.current = null;
              backgroundDbRecordIdRef.current = null;
              finishAndLeave();
            })(),
        },
      ]
    );
  };

  const hasIncompleteReviewDraft = Boolean(draftInvoiceIdRef.current);

  if (step === 'choose') {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView
          style={styles.chooseScroll}
          contentContainerStyle={[styles.chooseContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heroTitle}>Add invoice</Text>
          <Text style={styles.heroSubtitle}>
            Scan or upload a receipt or PDF. We extract merchant, amount, date, and line items for you.
          </Text>
          <TouchableOpacity style={styles.optionCard} onPress={takePhoto} activeOpacity={0.88}>
            <View style={[styles.optionIconBlob, { backgroundColor: OPTION_TILE_BG }]}>
              <Ionicons name="camera-outline" size={26} color={OPTION_ICON} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Take photo</Text>
              <Text style={styles.optionDesc}>Capture the receipt; add sections for long receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionCard} onPress={pickImage} activeOpacity={0.88}>
            <View style={[styles.optionIconBlob, { backgroundColor: OPTION_TILE_BG }]}>
              <Ionicons name="images-outline" size={26} color={OPTION_ICON} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Upload image</Text>
              <Text style={styles.optionDesc}>Choose from your photo library</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={TEXT_MUTED} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionCard} onPress={pickDocument} activeOpacity={0.88}>
            <View style={[styles.optionIconBlob, { backgroundColor: OPTION_TILE_BG }]}>
              <Ionicons name="document-text-outline" size={26} color={OPTION_ICON} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Upload PDF</Text>
              <Text style={styles.optionDesc}>Import an invoice file</Text>
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
            ? 'Scroll to see every part of the receipt, then extract or add another section.'
            : 'Check the preview below, then extract details or pick a different file.'}
        </Text>
        {!isPdf && sectionCount > 1 && (
          <View style={styles.pillHint}>
            <Text style={styles.pillHintText}>{sectionCount} sections — scroll for next part</Text>
          </View>
        )}
        {!isPdf && previewSections.length > 0 ? (
          <View style={styles.previewSectionsContainer}>
            {previewSections.map((section, index) => (
              <View key={`${section.uri}-${index}`} style={styles.previewSectionWrap}>
                {previewSections.length > 1 && (
                  <View style={styles.previewSectionHeader}>
                    <Text style={styles.previewSectionLabel}>
                      Part {index + 1} of {previewSections.length}
                    </Text>
                    <TouchableOpacity
                      onPress={() => confirmRemovePreviewSection(index)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove part ${index + 1}`}
                    >
                      <Ionicons name="trash-outline" size={20} color={RED} />
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => {
                    setPreviewZoomVisible(true);
                    setPreviewZoomIndex(index);
                  }}
                >
                  <Image source={{ uri: section.uri }} style={styles.previewSectionImage} resizeMode="contain" />
                </TouchableOpacity>
              </View>
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
              <Ionicons name="document-text-outline" size={40} color={OPTION_ICON} />
              <Text style={styles.pdfPlaceholderText}>PDF document</Text>
              <Text style={styles.pdfFileName}>{fileName}</Text>
            </View>
          </View>
        ) : null}
        {!isPdf && (
          <TouchableOpacity style={styles.addSectionBtn} onPress={promptAddAnotherSection} activeOpacity={0.88}>
            <Ionicons name="add-circle-outline" size={22} color={OPTION_ICON} style={styles.addSectionIcon} />
            <View style={styles.addSectionTextCol}>
              <Text style={styles.addSectionBtnText}>Add another section</Text>
              <Text style={styles.addSectionBtnSub}>
                {Platform.OS === 'web'
                  ? 'Camera, photo library, or PDF (first page)'
                  : 'Camera or photo library — use library for PDF pages saved as images'}
              </Text>
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

  if (step === 'submitting') {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.extractingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.extractingTitle}>Processing</Text>
          <Text style={styles.extractingSub}>Saving your receipt and sending it to be read…</Text>
        </View>
      </View>
    );
  }

  if (step === 'extracting') {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.extractingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.extractingTitle}>Reading your receipt</Text>
          <Text style={styles.extractingSub}>Extracting merchant, amount, and details…</Text>
        </View>
      </View>
    );
  }

  if (step === 'review' && extracted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
        <View style={styles.reviewHeaderRow}>
          <View style={[styles.reviewBadge, { backgroundColor: OPTION_TILE_BG }]}>
            <Ionicons name="receipt-outline" size={20} color={OPTION_ICON} />
          </View>
          <View style={styles.reviewHeaderText}>
            <Text style={styles.screenTitle}>Review & save</Text>
            <Text style={styles.screenSubtitle}>Check details match your receipt before saving</Text>
          </View>
        </View>
        {documentUri && (
          <View style={styles.docPreview}>
            {isPdf ? (
              <View style={styles.pdfPlaceholder}>
                <Ionicons name="document-text-outline" size={36} color={OPTION_ICON} />
                <Text style={styles.pdfPlaceholderText}>PDF document</Text>
                <Text style={styles.pdfFileName}>{fileName}</Text>
              </View>
            ) : (
              <Image source={{ uri: documentUri }} style={styles.docImage} resizeMode="contain" />
            )}
          </View>
        )}
        <View style={styles.reviewSummary}>
          <Text style={styles.summaryLabel}>Issued by</Text>
          <Text style={styles.reviewMerchant}>{displayIssuedBy(extracted) ?? '—'}</Text>
          <Text style={styles.summaryLabel}>Issued to</Text>
          <Text style={styles.reviewMerchant}>{displayIssuedTo(extracted) ?? '—'}</Text>
          <Text style={styles.summaryLabel}>Amount</Text>
          <Text style={styles.reviewAmountExpense}>
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
          {hasIncompleteReviewDraft ? (
            <TouchableOpacity
              style={styles.discardDraftBtn}
              onPress={confirmDiscardDraftFromReview}
              activeOpacity={0.88}
            >
              <Text style={styles.discardDraftBtnText}>Discard draft</Text>
            </TouchableOpacity>
          ) : null}
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
            <Ionicons name="document-outline" size={18} color={OPTION_ICON} />
            <Text style={styles.docLabel}>{fileName}</Text>
          </View>
        )}
        <Text style={styles.fieldLabel}>Issued by</Text>
        <TextInput
          style={styles.input}
          placeholder="Seller / vendor on the receipt"
          value={displayIssuedBy(extracted) ?? ''}
          onChangeText={(t) => {
            const v = t || undefined;
            setExtracted((prev) =>
              prev ? { ...prev, issuedBy: v, merchantName: v } : null
            );
          }}
          placeholderTextColor={TEXT_MUTED}
        />
        <Text style={styles.fieldLabel}>Issued to</Text>
        <TextInput
          style={styles.input}
          placeholder="Customer / bill to (if shown)"
          value={displayIssuedTo(extracted) ?? ''}
          onChangeText={(t) => {
            const v = t || undefined;
            setExtracted((prev) =>
              prev ? { ...prev, issuedTo: v, ownedBy: v } : null
            );
          }}
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
                <Text style={styles.gradientBtnText}>Save invoice</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.gradientBtnIcon} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {hasIncompleteReviewDraft && step !== 'saving' ? (
          <TouchableOpacity
            style={styles.discardDraftBtn}
            onPress={confirmDiscardDraftFromReview}
            activeOpacity={0.88}
          >
            <Text style={styles.discardDraftBtnText}>Discard draft</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  }

  if (step === 'done' && extracted) {
    return (
      <View style={[styles.container, styles.doneRoot, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.doneCard}>
          <LinearGradient
            colors={[OPTION_TILE_BG, LAVENDER_SOFT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doneIconRing}
          >
            <View style={styles.doneIconInner}>
              <Ionicons name="checkmark" size={44} color={OPTION_ICON} />
            </View>
          </LinearGradient>
          <Text style={styles.doneTitle}>Invoice saved</Text>
          <Text style={styles.doneSubtitle}>
            {displayIssuedBy(extracted) ?? 'Expense'} · {formatAmount(extracted.amount ?? 0, extracted.currency)}
          </Text>
        </View>
        <TouchableOpacity style={styles.gradientBtnWrap} onPress={finishAndLeave} activeOpacity={0.92}>
          <LinearGradient
            colors={[PRIMARY, PURPLE_DEEP]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradientBtn}
          >
            <Text style={styles.gradientBtnText}>Go to dashboard</Text>
            <Ionicons name="home-outline" size={22} color="#fff" style={styles.gradientBtnIcon} />
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
    backgroundColor: LAVENDER_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
  },
  pillHintText: { fontSize: 13, fontWeight: '600', color: PRIMARY, textTransform: 'none' },
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
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: MUTED_CARD,
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    flex: 1,
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
  discardDraftBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  discardDraftBtnText: { color: RED, fontSize: 16, fontWeight: '600', textTransform: 'none' },
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
  reviewAmountExpense: { fontSize: 28, fontWeight: '800', color: RED, marginBottom: 14, letterSpacing: -0.5, textTransform: 'none' },
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
