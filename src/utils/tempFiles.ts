import { cacheDirectory, deleteAsync } from 'expo-file-system/legacy';

/**
 * The folders under the app's cache where the photo picker copies picked photos and the image manipulator writes its
 * re-encoded JPEGs and crops (both modules name them so, on Android and iOS). Nothing in them is needed beyond the
 * flow that created it: the add queue, the post flow and Lens keep their state in memory only.
 */
export const TEMP_PHOTO_FOLDERS = ['ImagePicker', 'ImageManipulator'] as const;

/** Only files the app made itself, in its own cache, are ever deleted: never a gallery or document URI. */
export function isAppTempFile(uri: string | null | undefined): uri is string {
  if (!uri || !cacheDirectory || !uri.startsWith(cacheDirectory)) {
    return false;
  }
  const rest = uri.slice(cacheDirectory.length).replace(/^\/+/, '');
  return !rest.includes('..') && TEMP_PHOTO_FOLDERS.some((folder) => rest.startsWith(`${folder}/`));
}

/** Deletes one temporary photo; best effort, never throws. */
export async function discardTempFile(uri: string | null | undefined): Promise<void> {
  if (!isAppTempFile(uri)) {
    return;
  }
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch {
    // Already gone or locked: the next purge takes it.
  }
}

/**
 * Empties both temp folders: on every cold start (nothing in them belongs to this launch yet) and when a session ends
 * (the next person on this phone must not inherit the last one's photos). Best effort, never throws.
 */
export async function purgeTempPhotos(): Promise<void> {
  if (!cacheDirectory) {
    return;
  }
  await Promise.all(
    TEMP_PHOTO_FOLDERS.map((folder) =>
      deleteAsync(`${cacheDirectory}${folder}`, { idempotent: true }).catch(() => undefined),
    ),
  );
}
