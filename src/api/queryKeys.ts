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
  /** What goes with one item (companions per slot, outfit count, unlock suggestion). */
  wardrobePairings: (id: string) => ['wardrobe', 'pairings', id] as const,
  /** Every ready item that pairs with nothing, across all pages (the third stat card and its filter). */
  wardrobeUnmatched: ['wardrobe', 'unmatched'] as const,
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

  /** Prefix of everything social (feed, posts, profiles, creator pages, blocks). */
  socialAll: ['social'] as const,
  consent: ['social', 'consent'] as const,
  /** Signed in or not is part of the key: `likedByMe`, `inWardrobe` and the match scores belong to the viewer. */
  feed: (mode: string, personaId: string | null, signedIn: boolean) =>
    ['social', 'feed', mode, personaId, signedIn] as const,
  feedAll: ['social', 'feed'] as const,
  post: (id: string) => ['social', 'post', id] as const,
  /** Every post list (feed, profile, creator page, mine) as one prefix, for patching a post wherever it is cached. */
  postLists: ['social', 'posts'] as const,
  userPosts: (id: string) => ['social', 'posts', 'user', id] as const,
  creator: (handle: string) => ['social', 'creator', handle] as const,
  userProfile: (id: string) => ['social', 'user', id] as const,
  myPosts: ['social', 'posts', 'mine'] as const,
  blocks: ['social', 'blocks'] as const,
  creatorStats: ['social', 'creator-stats'] as const,
};
