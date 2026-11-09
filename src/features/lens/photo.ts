import * as ImageManipulator from 'expo-image-manipulator';

import type { LensBox } from '@/api/models';
import type { PickedPhoto } from '@/features/wardrobe/addStore';
import { JPEG_QUALITY, resizeActions } from '@/features/wardrobe/addItem';
import { toNumber } from '@/utils/money';

/** The photo on the phone as it was sent: the re-encoded JPEG and its real pixel size (boxes are fractions of it). */
export interface LensPhoto {
  uri: string;
  width: number;
  height: number;
}

/** A crop in pixels, as `expo-image-manipulator` takes it. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Detection boxes hug the garment; a little room on each side (a share of the box's own size) keeps sleeves and hems
 * for the wardrobe's background removal.
 */
export const CROP_MARGIN = 0.05;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Fractions times pixels land a hair off whole numbers (0.62 × 1200 = 744.0000000000001); that hair is not a pixel. */
const EPSILON = 1e-6;
const floorPx = (fraction: number, size: number) => Math.floor(fraction * size + EPSILON);
const ceilPx = (fraction: number, size: number) => Math.ceil(fraction * size - EPSILON);

/**
 * Turns a region's normalized box (fractions of the photo: left, top, width, height) into whole pixels inside the
 * image, with `margin` added on every side. Never empty and never outside the photo, whatever the box says.
 */
export function cropRect(
  box: LensBox,
  imageWidth: number,
  imageHeight: number,
  margin = CROP_MARGIN,
): CropRect {
  const x = toNumber(box.x);
  const y = toNumber(box.y);
  const w = Math.max(0, toNumber(box.w));
  const h = Math.max(0, toNumber(box.h));

  const left = clamp01(x - w * margin);
  const top = clamp01(y - h * margin);
  const right = clamp01(x + w + w * margin);
  const bottom = clamp01(y + h + h * margin);

  const originX = Math.min(floorPx(left, imageWidth), imageWidth - 1);
  const originY = Math.min(floorPx(top, imageHeight), imageHeight - 1);
  return {
    originX,
    originY,
    width: Math.max(1, Math.min(ceilPx(right, imageWidth), imageWidth) - originX),
    height: Math.max(1, Math.min(ceilPx(bottom, imageHeight), imageHeight) - originY),
  };
}

/** Longer edge to 1600 px, always re-encoded as JPEG (HEIC becomes JPEG); the size is read back from the result. */
export async function prepareLensPhoto(photo: PickedPhoto): Promise<LensPhoto> {
  const result = await ImageManipulator.manipulateAsync(
    photo.uri,
    resizeActions(photo.width, photo.height),
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

/**
 * Cuts one region out of the photo that was searched, for "Dolabıma ekle". The wardrobe flow re-encodes it once more,
 * so it is saved at full quality here.
 */
export async function cropRegion(photo: LensPhoto, box: LensBox): Promise<PickedPhoto> {
  const crop = cropRect(box, photo.width, photo.height);
  const result = await ImageManipulator.manipulateAsync(photo.uri, [{ crop }], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}
