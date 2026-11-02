import { request } from '../client';
import type {
  AddFromProductRequest,
  ProcessItemResponse,
  UpdateWardrobeItemRequest,
  UploadUrl,
  UploadUrlRequest,
  WardrobeGaps,
  WardrobeItem,
  WardrobeItemPage,
  WardrobeStats,
  WearResponse,
} from '../models';

const BASE = '/api/v1/me/wardrobe';

export interface ListWardrobeItemsQuery {
  category?: string;
  color?: string;
  page: number;
  pageSize: number;
}

export function listWardrobeItems(
  query: ListWardrobeItemsQuery,
  signal?: AbortSignal,
): Promise<WardrobeItemPage> {
  return request<WardrobeItemPage>(`${BASE}/items`, {
    query: {
      Category: query.category,
      Color: query.color,
      Page: query.page,
      PageSize: query.pageSize,
    },
    auth: true,
    signal,
  });
}

export function getWardrobeItem(id: string, signal?: AbortSignal): Promise<WardrobeItem> {
  return request<WardrobeItem>(`${BASE}/items/${encodeURIComponent(id)}`, { auth: true, signal });
}

export function createUploadUrl(body: UploadUrlRequest): Promise<UploadUrl> {
  return request<UploadUrl>(`${BASE}/items/upload-url`, { method: 'POST', body, auth: true });
}

/**
 * Sends the photo straight to object storage with exactly the headers the presigned URL was made for. This is not an
 * API call: no bearer token, no JSON, and the storage's own error is not a problem document.
 */
export async function putPhoto(
  upload: Pick<UploadUrl, 'uploadUrl' | 'headers'>,
  photo: Blob,
): Promise<void> {
  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: upload.headers as Record<string, string>,
    body: photo,
  });
  if (!response.ok) {
    throw new Error(`Photo upload failed: HTTP ${response.status}`);
  }
}

export function processWardrobeItem(id: string): Promise<ProcessItemResponse> {
  return request<ProcessItemResponse>(`${BASE}/items/${encodeURIComponent(id)}/process`, {
    method: 'POST',
    auth: true,
  });
}

/** `{}` is valid: the first PATCH of a ready item is the user's confirmation. */
export function updateWardrobeItem(
  id: string,
  patch: Partial<UpdateWardrobeItemRequest>,
): Promise<WardrobeItem> {
  const body: UpdateWardrobeItemRequest = {
    name: null,
    categorySlug: null,
    primaryColor: null,
    secondaryColor: null,
    pattern: null,
    fit: null,
    formality: null,
    seasons: null,
    brandId: null,
    size: null,
    purchasePrice: null,
    purchasedAt: null,
    clear: null,
    ...patch,
  };
  return request<WardrobeItem>(`${BASE}/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    auth: true,
  });
}

export function archiveWardrobeItem(id: string): Promise<void> {
  return request<void>(`${BASE}/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
  });
}

export function addItemFromProduct(body: AddFromProductRequest): Promise<WardrobeItem> {
  return request<WardrobeItem>(`${BASE}/items/from-product`, {
    method: 'POST',
    body,
    auth: true,
  });
}

/** Wears the item today (Istanbul) unless a day is given. */
export function recordWear(id: string, wornOn?: string): Promise<WearResponse> {
  return request<WearResponse>(`${BASE}/items/${encodeURIComponent(id)}/wear`, {
    method: 'POST',
    body: wornOn ? { wornOn } : undefined,
    auth: true,
  });
}

export function undoWear(id: string, wornOn: string): Promise<WearResponse> {
  return request<WearResponse>(
    `${BASE}/items/${encodeURIComponent(id)}/wear/${encodeURIComponent(wornOn)}`,
    { method: 'DELETE', auth: true },
  );
}

export function getWardrobeStats(signal?: AbortSignal): Promise<WardrobeStats> {
  return request<WardrobeStats>(`${BASE}/stats`, { auth: true, signal });
}

export function getWardrobeGaps(signal?: AbortSignal): Promise<WardrobeGaps> {
  return request<WardrobeGaps>(`${BASE}/gaps`, { auth: true, signal });
}
