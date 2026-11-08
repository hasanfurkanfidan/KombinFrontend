/** Where the user came from when a product detail opens; reported as `product_view`'s `source`. */
export type ProductSource =
  'discover' | 'saved' | 'alert' | 'notification' | 'push' | 'lens' | 'direct';

const SOURCES: readonly ProductSource[] = [
  'discover',
  'saved',
  'alert',
  'notification',
  'push',
  'lens',
  'direct',
];

export function productHref(id: string, source: ProductSource): string {
  return `/product/${id}?source=${source}`;
}

/** The `source` route param, or `direct` when it is missing or not one of ours. */
export function parseProductSource(value: unknown): ProductSource {
  return SOURCES.find((source) => source === value) ?? 'direct';
}
