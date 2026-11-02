import type {
  Alert,
  AlertTrigger,
  CategoryNode,
  Notification,
  NotificationPage,
  NotificationPreferences,
  Offer,
  OfferSeries,
  Persona,
  Product,
  ProductListItem,
  ProductPage,
  Profile,
  SavedProduct,
  SizeEntry,
  StyleCard,
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
    cheapestSeller: null,
    matchScore: null,
    ...overrides,
  };
}

export function page(items: ProductListItem[], overrides: Partial<ProductPage> = {}): ProductPage {
  return { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, ...overrides };
}

function offer(overrides: Partial<Offer> & Pick<Offer, 'id' | 'seller'>): Offer {
  return {
    goPath: `/api/v1/go/${overrides.id}`,
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
  seller: { name: 'Trendyol', slug: 'trendyol' },
});
export const brandStore = offer({
  id: 'o2',
  seller: { name: 'Marka sitesi', slug: 'mavi-store' },
  currentPrice: 2299,
  shippingCost: 49,
  effectivePrice: 2348,
});
export const hepsiburada = offer({
  id: 'o3',
  seller: { name: 'Hepsiburada', slug: 'hepsiburada' },
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
    matchScore: null,
    sizeHint: null,
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

export function persona(overrides: Partial<Persona> = {}): Persona {
  return {
    id: 'pe1',
    name: 'Ofis',
    icon: 'office',
    sortOrder: 0,
    budgetMin: 800,
    budgetMax: 2500,
    formalityMin: 2,
    formalityMax: 4,
    preferredColors: [],
    avoidedColors: [],
    preferredFits: [],
    seasons: [],
    isActive: true,
    styleSummary: {
      confidence: 0.8,
      likeCount: 9,
      topColors: ['Green', 'Black', 'Beige', 'White'],
      formalityMean: 3.2,
      topFamilies: ['Minimal', 'Classic'],
    },
    ...overrides,
  };
}

export function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    audience: 'Women',
    birthYear: null,
    heightCm: 178,
    weightKg: 76,
    chestCm: 100,
    waistCm: 84,
    hipCm: null,
    shoeSizeEu: null,
    activePersona: { id: 'pe1', name: 'Ofis', icon: 'office' },
    personaCount: 1,
    onboardingCompleted: true,
    onboardingCompletedAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export function styleCard(id: string, overrides: Partial<StyleCard> = {}): StyleCard {
  return {
    id,
    title: `Kart ${id}`,
    imageUrl: `https://img.example/${id}.jpg`,
    audience: 'Women',
    family: 'Minimal',
    ...overrides,
  };
}

export function savedProduct(overrides: Partial<SavedProduct> = {}): SavedProduct {
  return {
    ...listItem(),
    isActive: true,
    savedAt: '2026-11-01T09:00:00Z',
    ...overrides,
  } as SavedProduct;
}

export function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'a1',
    kind: 'PriceDrop',
    targetPrice: 2300,
    sizes: [],
    isActive: true,
    triggerCount: 0,
    lastTriggeredAt: null,
    lastPriceAfter: null,
    createdAt: '2026-10-20T10:00:00Z',
    product: {
      id: 'p1',
      name: 'Yün karışımlı blazer',
      brandName: 'Mavi',
      primaryImageUrl: null,
      lowestPrice: 2149,
    },
    ...overrides,
  };
}

export function trigger(overrides: Partial<AlertTrigger> = {}): AlertTrigger {
  return {
    id: 1,
    alertId: 'a1',
    kind: 'PriceDrop',
    product: alert().product,
    offerId: 'o1',
    priceBefore: 2999,
    priceAfter: 2149,
    payload: {},
    triggeredAt: '2026-10-30T10:00:00Z',
    consumedAt: null,
    ...overrides,
  };
}

export function sizeEntry(overrides: Partial<SizeEntry> = {}): SizeEntry {
  return {
    id: 's1',
    brand: { id: 'b1', name: 'Mavi', slug: 'mavi' },
    group: 'Tops',
    size: 'L',
    source: 'UserEntered',
    confidence: 1,
    updatedAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

let notificationCounter = 0;

export function notification(overrides: Partial<Notification> = {}): Notification {
  notificationCounter += 1;
  return {
    id: notificationCounter,
    kind: 'PriceDrop',
    title: 'Takip ettiğin blazer 850 ₺ düştü',
    body: 'Mavi yün karışımlı blazer artık 2.149 ₺.',
    data: { productId: 'p1', offerId: 'o1', deepLink: 'kombin://product/p1' },
    createdAt: new Date().toISOString(),
    readAt: null,
    status: 'Sent',
    ...overrides,
  };
}

export function notificationPage(
  items: Notification[],
  overrides: Partial<NotificationPage> = {},
): NotificationPage {
  return { items, page: 1, pageSize: 30, totalCount: items.length, totalPages: 1, ...overrides };
}

export const preferences: NotificationPreferences = {
  priceAlerts: true,
  stockAlerts: true,
  recommendations: true,
  maxRecommendationsPerWeek: 3,
  quietHoursStart: null,
  quietHoursEnd: null,
  timeZone: 'Europe/Istanbul',
  updatedAt: '2026-11-02T10:00:00Z',
};
