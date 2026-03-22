import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { getSaveCameraPhotosToGallery } from '../services/cameraGalleryPreference';

/**
 * If the user enabled “Save to gallery” in Settings, copies a camera capture to the device Photos library.
 * Fails silently (no alert) so adding an invoice/sale is never blocked.
 */
export async function maybeSaveCameraImageToGallery(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  const enabled = await getSaveCameraPhotosToGallery();
  if (!enabled) return;
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') return;
    await MediaLibrary.saveToLibraryAsync(uri);
  } catch {
    // Ignore: permission denied, unsupported URI, etc.
  }
}
