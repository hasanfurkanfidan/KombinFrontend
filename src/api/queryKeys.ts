import type { ListProductsQuery } from './models';

export const queryKeys = {
  me: ['me'] as const,
  categories: ['catalog', 'categories'] as const,
  products: (filters: ListProductsQuery) => ['catalog', 'products', filters] as const,
  /** Prefix of every product list, for refreshing all filter sets at once. */
  productsAll: ['catalog', 'products'] as const,
  product: (id: string, personaId?: string) =>
    ['catalog', 'product', id, personaId ?? null] as const,
  /** Prefix of every cached detail of one product, whatever persona it was fetched with. */
  productAll: (id: string) => ['catalog', 'product', id] as const,
  priceHistory: (id: string, days: number) => ['catalog', 'price-history', id, days] as const,
  brands: (query: string) => ['catalog', 'brands', query] as const,

  profile: ['profile'] as const,
  personas: ['personas'] as const,
  /** Own root (not under `personas`): refreshing the persona list must not replace a deck that is on screen. */
  styleCards: (personaId: string) => ['style-cards', personaId] as const,
  sizes: ['sizes'] as const,

  savedIds: ['saved', 'ids'] as const,
  saved: ['saved', 'list'] as const,
  alerts: ['alerts', 'list'] as const,
  triggers: ['alerts', 'triggers'] as const,

  /** Prefix of everything about notifications (feed, unread count, preferences). */
  notificationsAll: ['notifications'] as const,
  notifications: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,
};
