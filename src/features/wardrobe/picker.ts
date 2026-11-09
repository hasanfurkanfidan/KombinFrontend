import * as ImagePicker from 'expo-image-picker';

import { MAX_PHOTOS } from './addItem';
import type { PickedPhoto } from './addStore';

function toPhotos(result: ImagePicker.ImagePickerResult): PickedPhoto[] {
  return result.canceled
    ? []
    : result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
}

/** `denied` when the user refused the camera; an empty list when they closed the camera without a photo. */
export async function takePhoto(): Promise<PickedPhoto[] | 'denied'> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return 'denied';
  }
  // Full quality: the add flow re-encodes once, so the photo is not compressed twice.
  return toPhotos(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
}

/** The system photo picker needs no permission; up to `MAX_PHOTOS` photos at once. */
export async function pickPhotos(): Promise<PickedPhoto[]> {
  return toPhotos(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 1,
    }),
  );
}

/** One photo from the system picker (visual search sends a single photo). */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const [photo] = toPhotos(
    await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }),
  );
  return photo ?? null;
}
