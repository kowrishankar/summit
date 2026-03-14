import { supabase } from '../lib/supabase';

const BUCKET = 'attachments';

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
 * Uses FormData with the file URI so React Native streams the file (no Blob/ArrayBuffer).
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
  const contentType = getContentType(ext);

  // React Native FormData: append file by URI; native layer reads and streams it (no Blob/ArrayBuffer).
  const formData = new FormData();
  formData.append('', {
    uri: localUri,
    type: contentType,
    name: filename,
  } as unknown as Blob);

  const { error } = await supabase.storage.from(BUCKET).upload(path, formData, {
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
