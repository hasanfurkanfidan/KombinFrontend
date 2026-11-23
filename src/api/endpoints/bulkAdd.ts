import { ApiError, request } from '../client';
import type {
  BulkBatch,
  BulkConfirmRequest,
  BulkProcess,
  BulkUploadUrl,
  UploadUrlRequest,
} from '../models';

/**
 * Bulk add ("Toplu ekle", backend `docs/design/bulk-add.md`). Every route answers 404 `Wardrobe.BulkDisabled` while the
 * server's switch is off.
 */
const BASE = '/api/v1/me/wardrobe/bulk';

export const BULK_DISABLED = 'Wardrobe.BulkDisabled';
export const BULK_NOT_FOUND = 'Wardrobe.BulkNotFound';

/** No batch has this id: the availability probe asks for it and reads which 404 comes back. */
const NIL_ID = '00000000-0000-0000-0000-000000000000';

export function isBulkDisabled(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.errorCode === BULK_DISABLED;
}

/** The single add's request (same content types, same 8 MB rule): the backend reuses its validator. */
export function createBulkUploadUrl(body: UploadUrlRequest): Promise<BulkUploadUrl> {
  return request<BulkUploadUrl>(`${BASE}/upload-url`, { method: 'POST', body, auth: true });
}

export function processBulkBatch(id: string): Promise<BulkProcess> {
  return request<BulkProcess>(`${BASE}/${encodeURIComponent(id)}/process`, {
    method: 'POST',
    auth: true,
  });
}

export function getBulkBatch(id: string, signal?: AbortSignal): Promise<BulkBatch> {
  return request<BulkBatch>(`${BASE}/${encodeURIComponent(id)}`, { auth: true, signal });
}

/**
 * Confirm: the ticked pieces with their edits become wardrobe items; the answer is the batch, `Confirmed`, with `items`.
 * A repeated confirm answers the stored result. 409 `BulkNotReady`/`BulkExpired`, 503 `StorageUnavailable`.
 */
export function confirmBulkBatch(id: string, body: BulkConfirmRequest): Promise<BulkBatch> {
  return request<BulkBatch>(`${BASE}/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body,
    auth: true,
  });
}

/** Cancel: 204, also for an already cancelled or expired batch; 409 once it was confirmed. */
export function cancelBulkBatch(id: string): Promise<void> {
  return request<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true });
}

/**
 * Whether bulk add exists on this server, without a route of its own: a batch that cannot exist answers 404
 * `Wardrobe.BulkNotFound` when the feature is on and 404 `Wardrobe.BulkDisabled` when it is off. Anything else (an
 * older server, a 5xx, no network) counts as "not available": the entry stays hidden, never an error.
 */
export async function probeBulkAvailable(signal?: AbortSignal): Promise<boolean> {
  try {
    await getBulkBatch(NIL_ID, signal);
    return false;
  } catch (error) {
    return error instanceof ApiError && error.status === 404 && error.errorCode === BULK_NOT_FOUND;
  }
}
