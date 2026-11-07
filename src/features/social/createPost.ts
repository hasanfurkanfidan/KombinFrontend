import { ApiError } from '@/api/client';
import { putPhoto } from '@/api/endpoints/wardrobe';
import { createPostUploadUrl, getPost, processPost } from '@/api/endpoints/social';
import type { Post } from '@/api/models';
import { prepareImage } from '@/features/wardrobe/addItem';
import type { PickedPhoto } from '@/features/wardrobe/addStore';

/** The check (strip, moderate, detect) takes a few seconds on the backend; two minutes is far past a normal run. */
export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 120_000;

/** The backend's error code when the posting consent was never accepted, or its text has a new version. */
export const CONSENT_REQUIRED = 'Social.ConsentRequired';

export function isConsentRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && error.errorCode === CONSENT_REQUIRED;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sends one photo for a new post and asks the backend to process it: re-encode on the phone (HEIC becomes JPEG, and
 * the re-encode drops EXIF, GPS and the rest of the metadata before anything leaves the device), `upload-url`, the
 * PUT to storage with exactly the returned headers and no bearer token, then `process`. Returns the new post's id.
 * A missing consent surfaces as the 403 `Social.ConsentRequired` ApiError (see `isConsentRequired`).
 */
export async function uploadPostPhoto(photo: PickedPhoto): Promise<string> {
  const prepared = await prepareImage(photo);
  const upload = await createPostUploadUrl({
    contentType: prepared.contentType,
    sizeBytes: prepared.sizeBytes,
  });
  await putPhoto(upload, prepared.uri);
  await processPost(upload.postId);
  return upload.postId;
}

export type WatchOutcome = { kind: 'post'; post: Post } | { kind: 'timeout' } | { kind: 'stopped' };

/**
 * Polls the post until it leaves `Processing`. A poll that fails (offline) is simply tried again; running out of time
 * is reported so the screen can point the author at "Gönderilerim". `shouldStop` lets a closed screen end the loop.
 */
export async function watchPost(
  postId: string,
  shouldStop: () => boolean = () => false,
): Promise<WatchOutcome> {
  const startedAt = Date.now();
  for (;;) {
    await sleep(POLL_INTERVAL_MS);
    if (shouldStop()) {
      return { kind: 'stopped' };
    }
    try {
      const post = await getPost(postId, true);
      if (post.status !== 'Processing') {
        return { kind: 'post', post };
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw error;
      }
    }
    if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
      return { kind: 'timeout' };
    }
  }
}
