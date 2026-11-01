import { request } from '../client';
import type { CategoryNode, ListProductsQuery, OfferSeries, Product, ProductPage } from '../models';

export function listCategories(signal?: AbortSignal): Promise<CategoryNode[]> {
  return request<CategoryNode[]>('/api/v1/catalog/categories', { signal });
}

export function listProducts(query: ListProductsQuery, signal?: AbortSignal): Promise<ProductPage> {
  return request<ProductPage>('/api/v1/catalog/products', { query, signal });
}

export function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  return request<Product>(`/api/v1/catalog/products/${encodeURIComponent(id)}`, { signal });
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
