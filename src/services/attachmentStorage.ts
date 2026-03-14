import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';

const BUCKET = 'attachments';

/** Decode base64 to Uint8Array for Supabase upload. */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getExtensionFromUri(uri: string, isPdf?: boolean): string {
  if (isPdf) return 'pdf';
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'png';
  if (lower.includes('.gif')) return 'gif';
  if (lower.includes('.webp')) return 'webp';
  return 'jpg';
}

function getContentType(ext: string): string {
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Upload a single file from a local URI to Supabase Storage.
 * Path: {userId}/{type}/{recordId}/{filename}
 * Returns the public URL for the stored file (bucket must be public).
 */
export async function uploadAttachment(
  userId: string,
  type: 'invoices' | 'sales',
  recordId: string,
  localUri: string,
  index: number,
  isPdf?: boolean
): Promise<string> {
  const ext = getExtensionFromUri(localUri, isPdf);
  const filename = `${index}.${ext}`;
  const path = `${userId}/${type}/${recordId}/${filename}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const data = base64ToUint8Array(base64);
  const contentType = getContentType(ext);

  const { error } = await supabase.storage.from(BUCKET).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return urlData.publicUrl;
}

/**
 * Upload multiple local URIs (images or a single PDF) and return their public URLs in order.
 */
export async function uploadAttachments(
  userId: string,
  type: 'invoices' | 'sales',
  recordId: string,
  localUris: string[],
  isPdf?: boolean
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < localUris.length; i++) {
    const url = await uploadAttachment(userId, type, recordId, localUris[i], i, i === 0 ? isPdf : false);
    urls.push(url);
  }
  return urls;
}
