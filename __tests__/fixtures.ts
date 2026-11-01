import type {
  CategoryNode,
  Offer,
  OfferSeries,
  Product,
  ProductListItem,
  ProductPage,
} from '@/api/models';

const brand = { id: 'b1', name: 'Mavi', slug: 'mavi' };

export const categories: CategoryNode[] = [
  { id: 'c1', slug: 'ust-giyim', name: 'Üst giyim', children: [] },
  { id: 'c2', slug: 'alt-giyim', name: 'Alt giyim', children: [] },
];

export function listItem(overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    id: 'p1',
    name: 'Yün karışımlı blazer',
    slug: 'yun-karisimli-blazer',
    brand,
    category: { id: 'c1', slug: 'ust-giyim' },
    primaryImageUrl: null,
    primaryColor: 'Green',
    lowestPrice: 2149,
    lowestOriginalPrice: 2999,
    offerCount: 3,
    discountPercent: 28,
    ...overrides,
  };
}

export function page(items: ProductListItem[], overrides: Partial<ProductPage> = {}): ProductPage {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, ...overrides };
}

function offer(overrides: Partial<Offer> & Pick<Offer, 'id' | 'seller'>): Offer {
  return {
    url: `https://shop.example/${overrides.id}`,
    currentPrice: 2149,
    originalPrice: null,
    currency: 'TRY',
    shippingCost: 0,
    freeShippingThreshold: null,
    effectivePrice: 2149,
    stockStatus: 'InStock',
    availableSizes: ['M', 'L'],
    lastSeenAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export const trendyol = offer({
  id: 'o1',
  seller: { id: 's1', name: 'Trendyol', slug: 'trendyol', kind: 'Marketplace' },
});
export const brandStore = offer({
  id: 'o2',
  seller: { id: 's2', name: 'Marka sitesi', slug: 'mavi-store', kind: 'BrandStore' },
  currentPrice: 2299,
  shippingCost: 49,
  effectivePrice: 2348,
});
export const hepsiburada = offer({
  id: 'o3',
  seller: { id: 's3', name: 'Hepsiburada', slug: 'hepsiburada', kind: 'Marketplace' },
  currentPrice: 2449,
  effectivePrice: 2449,
  stockStatus: 'OutOfStock',
});

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    name: 'Yün karışımlı blazer, koyu yeşil',
    slug: 'yun-karisimli-blazer',
    modelCode: null,
    description: null,
    brand,
    category: { id: 'c1', slug: 'ust-giyim' },
    audience: 'Women',
    primaryColor: 'Green',
    pattern: 'Solid',
    fit: 'Regular',
    formality: 3,
    seasons: ['Autumn'],
    material: null,
    isActive: true,
    primaryImageUrl: null,
    images: [],
    offers: [trendyol, brandStore, hepsiburada],
    priceSummary: {
      lowestNow: 2149,
      lowestLast90Days: 2149,
      highestLast90Days: 2999,
      isLowestOfLast90Days: true,
    },
    ...overrides,
  };
}

export const history: OfferSeries[] = [
  {
    offerId: 'o1',
    seller: trendyol.seller,
    points: [
      { date: '2026-09-01', minPrice: 2999, stockStatus: 'InStock' },
      { date: '2026-10-01', minPrice: 2549, stockStatus: 'InStock' },
      { date: '2026-10-25', minPrice: 2149, stockStatus: 'InStock' },
    ],
  },
];
