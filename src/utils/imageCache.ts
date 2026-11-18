import { Image } from 'expo-image';

/**
 * Empties both image caches (memory and disk) of `expo-image`. Run when a session ends, so the next person who signs in
 * on this phone never sees a picture of the previous user's wardrobe, try-on or posts. Best effort: a failure leaves
 * the cache as it was and must not stop the rest of the sign-out. On web the call is a no-op (the browser's HTTP cache
 * is not ours to clear; the backend marks private pictures `no-store` there).
 */
export async function clearImageCache(): Promise<void> {
  try {
    await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
  } catch (error) {
    if (__DEV__) {
      console.warn('Could not clear the image cache', error);
    }
  }
}
