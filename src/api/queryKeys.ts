import type { ListProductsQuery } from './models';

export const queryKeys = {
  me: ['me'] as const,
  categories: ['catalog', 'categories'] as const,
  products: (filters: ListProductsQuery) => ['catalog', 'products', filters] as const,
  product: (id: string) => ['catalog', 'product', id] as const,
  priceHistory: (id: string, days: number) => ['catalog', 'price-history', id, days] as const,
};
