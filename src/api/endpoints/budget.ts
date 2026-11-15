import { request } from '../client';
import type {
  AnonymousBudgetOutfitsRequest,
  BudgetOutfits,
  BudgetOutfitsRequest,
} from '../models';

/** Signed in: the wardrobe, the size map and the city's weather count. */
export function suggestBudgetOutfits(
  body: BudgetOutfitsRequest,
  signal?: AbortSignal,
): Promise<BudgetOutfits> {
  return request<BudgetOutfits>('/api/v1/me/outfits/budget', {
    method: 'POST',
    body,
    auth: true,
    signal,
  });
}

/** A visitor: no token, `audience` is required; nothing is stored. */
export function suggestBudgetOutfitsAnonymous(
  body: AnonymousBudgetOutfitsRequest,
  signal?: AbortSignal,
): Promise<BudgetOutfits> {
  return request<BudgetOutfits>('/api/v1/outfits/budget', { method: 'POST', body, signal });
}
