import { request } from '../client';
import type {
  BrandPage,
  CategoryNode,
  ListProductsQuery,
  OfferSeries,
  Product,
  ProductPage,
} from '../models';

export function listCategories(signal?: AbortSignal): Promise<CategoryNode[]> {
  return request<CategoryNode[]>('/api/v1/catalog/categories', { signal });
}

/** Public, but a `PersonaId` (match scores, `sort=match`) belongs to the caller, so the token is sent only then. */
export function listProducts(query: ListProductsQuery, signal?: AbortSignal): Promise<ProductPage> {
  return request<ProductPage>('/api/v1/catalog/products', {
    query,
    auth: Boolean(query.PersonaId),
    signal,
  });
}

/**
 * Public, but `matchScore` (needs `personaId`) and `sizeHint` are personal, so a signed-in caller passes
 * `auth: true` and a logged-out one sends no token.
 */
export function getProduct(
  id: string,
  options: { personaId?: string; auth?: boolean } = {},
  signal?: AbortSignal,
): Promise<Product> {
  return request<Product>(`/api/v1/catalog/products/${encodeURIComponent(id)}`, {
    query: { personaId: options.personaId },
    auth: options.auth ?? Boolean(options.personaId),
    signal,
  });
}

export function getPriceHistory(
  id: string,
  days: number,
  signal?: AbortSignal,
): Promise<OfferSeries[]> {
  return request<OfferSeries[]>(
    `/api/v1/catalog/products/${encodeURIComponent(id)}/price-history`,
    {
      query: { days },
      signal,
    },
  );
}

export function searchBrands(query: string, signal?: AbortSignal): Promise<BrandPage> {
  return request<BrandPage>('/api/v1/catalog/brands', {
    query: { Query: query, PageSize: 20 },
    signal,
  });
}
