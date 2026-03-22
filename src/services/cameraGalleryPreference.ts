import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'summit_save_camera_photos_to_gallery';

export async function getSaveCameraPhotosToGallery(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function setSaveCameraPhotosToGallery(value: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, value ? 'true' : 'false');
}
