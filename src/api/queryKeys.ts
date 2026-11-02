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

  /** Prefix of everything about the wardrobe (items, stats, gaps). */
  wardrobeAll: ['wardrobe'] as const,
  wardrobeItems: (filters: { category?: string; color?: string }) =>
    ['wardrobe', 'items', filters] as const,
  /** Prefix of every cached item list, whatever filters it was fetched with. */
  wardrobeItemsAll: ['wardrobe', 'items'] as const,
  wardrobeItem: (id: string) => ['wardrobe', 'item', id] as const,
  wardrobeStats: ['wardrobe', 'stats'] as const,
  wardrobeGaps: ['wardrobe', 'gaps'] as const,

  /** Prefix of everything about outfits (daily, how-to-wear, single, saved). */
  outfitsAll: ['outfits'] as const,
  dailyOutfit: (query: { date: string; occasion: string | null; seed: number }) =>
    ['outfits', 'daily', query] as const,
  dailyOutfitsAll: ['outfits', 'daily'] as const,
  howToWear: (query: { productId: string | null; wardrobeItemId: string | null }) =>
    ['outfits', 'how-to-wear', query] as const,
  outfit: (id: string) => ['outfits', 'one', id] as const,
  savedOutfits: ['outfits', 'saved'] as const,
};
