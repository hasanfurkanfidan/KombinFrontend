import { request } from '../client';
import type { DailyOutfit, HowToWear, Outfit, OutfitFeedbackRequest, OutfitPage } from '../models';

const BASE = '/api/v1/me/outfits';

export interface DailyOutfitQuery {
  /** `today` (default), `tomorrow` or `yyyy-MM-dd` up to a week ahead. */
  date?: string;
  /** `office`, `weekend`, `evening`, `sport` or `event`; the persona's own band when left out. */
  occasion?: string;
  /** "Another one" is the next seed; 0 is the plain ranking. */
  seed: number;
}

/** The backend picks the active persona itself, so no `personaId` is sent. */
export function getDailyOutfit(
  query: DailyOutfitQuery,
  signal?: AbortSignal,
): Promise<DailyOutfit> {
  return request<DailyOutfit>(`${BASE}/daily`, {
    query: { Date: query.date, Occasion: query.occasion, Seed: query.seed },
    auth: true,
    signal,
  });
}

export interface HowToWearQuery {
  productId?: string;
  wardrobeItemId?: string;
  count: number;
  seed?: number;
  occasion?: string;
}

export function getHowToWear(query: HowToWearQuery, signal?: AbortSignal): Promise<HowToWear> {
  return request<HowToWear>(`${BASE}/how-to-wear`, {
    query: {
      ProductId: query.productId,
      WardrobeItemId: query.wardrobeItemId,
      Count: query.count,
      Seed: query.seed,
      Occasion: query.occasion,
    },
    auth: true,
    signal,
  });
}

export function getOutfit(id: string, signal?: AbortSignal): Promise<Outfit> {
  return request<Outfit>(`${BASE}/${encodeURIComponent(id)}`, { auth: true, signal });
}

export function listSavedOutfits(
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<OutfitPage> {
  return request<OutfitPage>(`${BASE}/saved`, {
    query: { Page: page, PageSize: pageSize },
    auth: true,
    signal,
  });
}

export function saveOutfit(id: string): Promise<Outfit> {
  return request<Outfit>(`${BASE}/${encodeURIComponent(id)}/save`, { method: 'POST', auth: true });
}

export function wearOutfit(id: string): Promise<Outfit> {
  return request<Outfit>(`${BASE}/${encodeURIComponent(id)}/worn`, { method: 'POST', auth: true });
}

/** Marks the outfit dismissed; the backend never suggests the same pieces again for 30 days. */
export function dismissOutfit(id: string, reason: string): Promise<void> {
  return request<void>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    query: { Reason: reason },
    auth: true,
  });
}

/** Only `Shuffle` ("another one") goes through here; Save, Worn and Dismiss use their own routes. */
export function recordOutfitFeedback(id: string, body: OutfitFeedbackRequest): Promise<Outfit> {
  return request<Outfit>(`${BASE}/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    body,
    auth: true,
  });
}
