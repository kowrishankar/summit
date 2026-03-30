import * as FileSystem from 'expo-file-system/legacy';
import type { Invoice, Sale } from '../types';
import { placeholderFailedExtracted } from '../utils/placeholderReceipt';
import {
  runReceiptExtraction,
  type ReceiptExtractionSnapshot,
} from './receiptExtractionRunner';

function isRemoteUri(u: string): boolean {
  return /^https?:\/\//i.test(u);
}

async function downloadRemoteToCache(uri: string, destFileName: string): Promise<string> {
  if (!isRemoteUri(uri)) return uri;
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error('Cache directory not available');
  const dest = `${base}${destFileName}`;
  const { uri: localUri } = await FileSystem.downloadAsync(uri, dest);
  return localUri;
}

/**
 * Build the same snapshot shape as Add invoice/sale uses, from persisted storage fields.
 * Returns null if files were never uploaded (e.g. app killed before upload finished).
 */
export function storedRecordToExtractionSnapshot(
  fileName: string | undefined,
  fileUri: string | undefined,
  fileUris: string[] | undefined
): ReceiptExtractionSnapshot | null {
  const name = (fileName?.trim() || 'receipt').trim();
  const lower = name.toLowerCase();
  const isPdf = lower.endsWith('.pdf');

  if (fileUris && fileUris.length > 1) {
    return {
      isPdf: false,
      fileName: name,
      documentUri: null,
      imageAssets: fileUris.map((u) => ({ uri: u })),
    };
  }

  const single = fileUri ?? (fileUris && fileUris.length === 1 ? fileUris[0] : undefined);
  if (!single) return null;

  if (isPdf) {
    return { isPdf: true, fileName: name, documentUri: single, imageAssets: [] };
  }

  return {
    isPdf: false,
    fileName: name,
    documentUri: null,
    imageAssets: [{ uri: single }],
  };
}

/** Remote Supabase URLs must be copied to a local file before FileSystem / image manipulator can read them. */
export async function localizeSnapshotForExtraction(
  snapshot: ReceiptExtractionSnapshot,
  idPrefix: string
): Promise<ReceiptExtractionSnapshot> {
  const safe = idPrefix.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'doc';

  if (snapshot.isPdf && snapshot.documentUri) {
    const local = isRemoteUri(snapshot.documentUri)
      ? await downloadRemoteToCache(snapshot.documentUri, `${safe}_${Date.now()}.pdf`)
      : snapshot.documentUri;
    return { ...snapshot, documentUri: local };
  }

  const imageAssets = await Promise.all(
    snapshot.imageAssets.map(async (a, i) => ({
      ...a,
      uri: isRemoteUri(a.uri)
        ? await downloadRemoteToCache(a.uri, `${safe}_${i}_${Date.now()}.jpg`)
        : a.uri,
    }))
  );

  let documentUri = snapshot.documentUri;
  if (documentUri && isRemoteUri(documentUri)) {
    documentUri = await downloadRemoteToCache(documentUri, `${safe}_doc_${Date.now()}.jpg`);
  }

  return { ...snapshot, imageAssets, documentUri };
}

/** If processing but files never reached storage (e.g. force-quit before upload), clear stuck state after this age. */
const STALE_PROCESSING_NO_FILES_MS = 10 * 60 * 1000;

export async function resumeInvoiceProcessing(
  inv: Invoice,
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>,
  getLatest?: () => Invoice | undefined
): Promise<void> {
  const stillProcessing = () => (getLatest?.() ?? inv).reviewStatus === 'processing';
  try {
    if (!stillProcessing()) return;

    const snap = storedRecordToExtractionSnapshot(inv.fileName, inv.fileUri, inv.fileUris);
    if (!snap) {
      const age = Date.now() - new Date(inv.createdAt).getTime();
      if (age > STALE_PROCESSING_NO_FILES_MS) {
        if (stillProcessing()) {
          await updateInvoice(inv.id, {
            reviewStatus: 'failed',
            extracted: placeholderFailedExtracted(),
          });
        }
      }
      return;
    }

    if (!stillProcessing()) return;

    const localSnap = await localizeSnapshotForExtraction(snap, inv.id);
    if (!stillProcessing()) return;

    const data = await runReceiptExtraction(localSnap, 'invoice');
    if (!stillProcessing()) return;

    await updateInvoice(inv.id, {
      extracted: data,
      reviewStatus: 'pending_review',
    });
  } catch {
    if (stillProcessing()) {
      await updateInvoice(inv.id, {
        reviewStatus: 'failed',
        extracted: placeholderFailedExtracted(),
      });
    }
  }
}

export async function resumeSaleProcessing(
  sale: Sale,
  updateSale: (id: string, patch: Partial<Sale>) => Promise<void>,
  getLatest?: () => Sale | undefined
): Promise<void> {
  const stillProcessing = () => (getLatest?.() ?? sale).reviewStatus === 'processing';
  try {
    if (!stillProcessing()) return;

    const snap = storedRecordToExtractionSnapshot(sale.fileName, sale.fileUri, sale.fileUris);
    if (!snap) {
      const age = Date.now() - new Date(sale.createdAt).getTime();
      if (age > STALE_PROCESSING_NO_FILES_MS) {
        if (stillProcessing()) {
          await updateSale(sale.id, {
            reviewStatus: 'failed',
            extracted: placeholderFailedExtracted(),
          });
        }
      }
      return;
    }

    if (!stillProcessing()) return;

    const localSnap = await localizeSnapshotForExtraction(snap, sale.id);
    if (!stillProcessing()) return;

    const data = await runReceiptExtraction(localSnap, 'sale');
    if (!stillProcessing()) return;

    await updateSale(sale.id, {
      extracted: data,
      reviewStatus: 'pending_review',
    });
  } catch {
    if (stillProcessing()) {
      await updateSale(sale.id, {
        reviewStatus: 'failed',
        extracted: placeholderFailedExtracted(),
      });
    }
  }
}
