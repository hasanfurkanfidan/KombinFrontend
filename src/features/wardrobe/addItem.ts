import type { QueryClient } from '@tanstack/react-query';
import * as ImageManipulator from 'expo-image-manipulator';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import {
  addItemFromProduct,
  createUploadUrl,
  getWardrobeItem,
  processWardrobeItem,
  putPhoto,
} from '@/api/endpoints/wardrobe';
import type { WardrobeItem, WardrobeItemSummary } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';

import { useAddStore, type AddSource, type PickedPhoto } from './addStore';
import {
  invalidateWardrobe,
  patchItem,
  prependItem,
  removeItem,
  replaceItem,
  toSummary,
} from './cache';

/** The backend refuses more than 8 MB; a 1600 px JPEG at 0.85 is a few hundred KB. */
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.85;
export const MAX_PHOTOS = 10;
export const POLL_INTERVAL_MS = 1500;
export const POLL_TIMEOUT_MS = 40_000;

export interface AddOutcome {
  /** The server id; null when the item was never created. */
  id: string | null;
  status: 'Ready' | 'Failed' | 'Timeout';
  durationMs: number;
}

export interface PreparedImage {
  uri: string;
  blob: Blob;
  contentType: 'image/jpeg';
  sizeBytes: number;
}

/** Shrinks the longer edge to `MAX_EDGE`; smaller photos are only re-encoded (which also turns HEIC into JPEG). */
export function resizeActions(width?: number, height?: number): ImageManipulator.Action[] {
  if (!width || !height || Math.max(width, height) <= MAX_EDGE) {
    return [];
  }
  return [{ resize: width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE } }];
}

export async function prepareImage(photo: PickedPhoto): Promise<PreparedImage> {
  const result = await ImageManipulator.manipulateAsync(
    photo.uri,
    resizeActions(photo.width, photo.height),
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  const blob = await (await fetch(result.uri)).blob();
  return { uri: result.uri, blob, contentType: 'image/jpeg', sizeBytes: blob.size };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let localCounter = 0;

/** The card the grid shows the moment a photo is picked: the local photo under a shimmer. */
function processingCard(id: string, status: WardrobeItemSummary['status']): WardrobeItemSummary {
  return {
    id,
    status,
    name: null,
    categorySlug: null,
    needsCategory: false,
    primaryColor: 'Other',
    thumbUrl: null,
    wearCount: 0,
    lastWornAt: null,
    isArchived: false,
    createdAt: new Date().toISOString(),
  };
}

function finish(startedAt: number, id: string | null, status: AddOutcome['status']): AddOutcome {
  const durationMs = Date.now() - startedAt;
  track('wardrobe_add_done', { status, durationMs });
  return { id, status, durationMs };
}

/** Shows an item that is final (ready or failed) in the grid, in the detail cache, and refreshes what derives from it. */
function commit(queryClient: QueryClient, item: WardrobeItem): void {
  queryClient.setQueryData(queryKeys.wardrobeItem(item.id), item);
  replaceItem(queryClient, item.id, toSummary(item));
  void invalidateWardrobe(queryClient);
  if (item.status === 'Ready' && useAddStore.getState().onWardrobeScreen) {
    useAddStore.getState().enqueueConfirm(item.id);
  }
}

/**
 * Poll the item every `POLL_INTERVAL_MS` until the backend says `Ready` or `Failed`, for at most `POLL_TIMEOUT_MS`.
 * A poll that fails (offline) is simply tried again; running out of time marks the card failed so it can be retried.
 */
export async function watchItem(
  queryClient: QueryClient,
  id: string,
  startedAt: number,
): Promise<AddOutcome> {
  const pollStart = Date.now();
  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const item = await getWardrobeItem(id);
      if (item.status !== 'Processing') {
        commit(queryClient, item);
        return finish(startedAt, id, item.status === 'Ready' ? 'Ready' : 'Failed');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        patchItem(queryClient, id, { status: 'Failed' });
        return finish(startedAt, id, 'Failed');
      }
    }
    if (Date.now() - pollStart >= POLL_TIMEOUT_MS) {
      patchItem(queryClient, id, { status: 'Failed' });
      return finish(startedAt, id, 'Timeout');
    }
  }
}

type Uploaded = { ok: true; id: string; startedAt: number } | { ok: false; outcome: AddOutcome };

/**
 * One photo up to the point where the server analyses it: the card appears first, then resize, upload-url, PUT and
 * `process`. A failure anywhere leaves a failed card that a tap retries with the same photo.
 */
async function uploadOne(
  queryClient: QueryClient,
  photo: PickedPhoto,
  source: AddSource,
): Promise<Uploaded> {
  const startedAt = Date.now();
  const store = useAddStore.getState();
  track('wardrobe_add_start', { source });

  let id = `local-${++localCounter}`;
  store.setLocalUri(id, photo.uri);
  prependItem(queryClient, processingCard(id, 'Processing'));
  try {
    const prepared = await prepareImage(photo);
    const upload = await createUploadUrl({
      contentType: prepared.contentType,
      sizeBytes: prepared.sizeBytes,
    });
    const localId = id;
    id = upload.itemId;
    useAddStore.getState().renameLocal(localId, id);
    replaceItem(queryClient, localId, processingCard(id, 'Processing'));
    await putPhoto(upload, prepared.blob);
    await processWardrobeItem(id);
    return { ok: true, id, startedAt };
  } catch {
    useAddStore.getState().setRetry(id, { photo, source });
    patchItem(queryClient, id, { status: 'Failed' });
    return { ok: false, outcome: finish(startedAt, id, 'Failed') };
  }
}

/**
 * The add flow for up to `MAX_PHOTOS` photos. Uploads go one after another (each card shows as it starts); the
 * analyses run in parallel. Resolves when every item has settled; the screen does not wait for it.
 */
export async function addPhotos(
  queryClient: QueryClient,
  photos: readonly PickedPhoto[],
  source: AddSource,
): Promise<AddOutcome[]> {
  const batch = photos.slice(0, MAX_PHOTOS);
  const watchers: Promise<AddOutcome>[] = [];
  try {
    for (const [index, photo] of batch.entries()) {
      useAddStore.getState().setUploading({ current: index + 1, total: batch.length });
      const uploaded = await uploadOne(queryClient, photo, source);
      watchers.push(
        uploaded.ok
          ? watchItem(queryClient, uploaded.id, uploaded.startedAt)
          : Promise.resolve(uploaded.outcome),
      );
    }
  } finally {
    useAddStore.getState().setUploading(null);
  }
  return Promise.all(watchers);
}

/** A tap on a failed card: send the photo again, or ask the server to analyse the item once more. */
export async function retryItem(queryClient: QueryClient, id: string): Promise<AddOutcome> {
  const entry = useAddStore.getState().retryPhotos[id];
  if (entry) {
    useAddStore.getState().clearRetry(id);
    removeItem(queryClient, id);
    const [outcome] = await addPhotos(queryClient, [entry.photo], entry.source);
    return outcome as AddOutcome;
  }
  const startedAt = Date.now();
  patchItem(queryClient, id, { status: 'Processing' });
  try {
    await processWardrobeItem(id);
  } catch {
    patchItem(queryClient, id, { status: 'Failed' });
    return finish(startedAt, id, 'Failed');
  }
  return watchItem(queryClient, id, startedAt);
}

/** A catalog product becomes a ready, confirmed item at once (no photo, no analysis). */
export async function addFromCatalog(
  queryClient: QueryClient,
  productId: string,
): Promise<WardrobeItem> {
  const startedAt = Date.now();
  track('wardrobe_add_start', { source: 'catalog' });
  try {
    const item = await addItemFromProduct({ productId, size: null });
    queryClient.setQueryData(queryKeys.wardrobeItem(item.id), item);
    prependItem(queryClient, toSummary(item));
    void invalidateWardrobe(queryClient);
    finish(startedAt, item.id, 'Ready');
    return item;
  } catch (error) {
    finish(startedAt, null, 'Failed');
    throw error;
  }
}
