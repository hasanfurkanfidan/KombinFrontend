import type {
  Alert,
  Me,
  BudgetOutfit,
  BudgetOutfits,
  BudgetPiece,
  Trip,
  TripDay,
  TripGap,
  TripPackItem,
  TripPlan,
  TripSummary,
  Consent,
  CostPerWearItem,
  SizePrompt,
  UnwornItem,
  WardrobeOverview,
  WardrobeValue,
  LensRegion,
  LensResult,
  LensSearchResult,
  Post,
  PostAuthor,
  PostProposal,
  PostTag,
  TryResult,
  UserProfile,
  DailyOutfit,
  HowToWear,
  Outfit,
  OutfitPiece,
  PairingCompanion,
  PairingUnlock,
  WardrobeGaps,
  WardrobeItem,
  WardrobeItemSummary,
  WardrobePairings,
  WardrobeStats,
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
    city: null,
    activePersona: { id: 'pe1', name: 'Ofis', icon: 'office' },
    personaCount: 1,
    onboardingCompleted: true,
    onboardingCompletedAt: '2026-11-01T10:00:00Z',
    sizePromptsEnabled: true,
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

export function wardrobeSummary(overrides: Partial<WardrobeItemSummary> = {}): WardrobeItemSummary {
  return {
    id: 'w1',
    status: 'Ready',
    name: 'Koyu yeşil blazer',
    categorySlug: 'ust-giyim/blazer',
    needsCategory: false,
    primaryColor: 'Green',
    thumbUrl: 'http://img.test/w1-thumb.webp',
    wearCount: 12,
    lastWornAt: new Date().toISOString().slice(0, 10),
    isArchived: false,
    createdAt: new Date().toISOString(),
    companionCount: 5,
    ...overrides,
  };
}

export function wardrobeItem(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  return {
    id: 'w1',
    status: 'Ready',
    name: null,
    category: { id: 'c-blazer', slug: 'ust-giyim/blazer', name: 'Blazer' },
    needsCategory: false,
    primaryColor: 'Green',
    secondaryColor: null,
    pattern: 'Solid',
    fit: 'Regular',
    formality: 4,
    seasons: ['Autumn', 'Winter'],
    brand: null,
    productId: null,
    fromCatalog: false,
    size: null,
    purchasePrice: null,
    purchasedAt: null,
    thumbUrl: 'http://img.test/w1-thumb.webp',
    cutoutUrl: 'http://img.test/w1-cutout.png',
    originalUrl: null,
    warnings: [],
    failureReason: null,
    analysis: {
      category: { slug: 'ust-giyim/blazer', confidence: 0.82 },
      categoryCandidates: [
        { slug: 'ust-giyim/blazer', confidence: 0.82 },
        { slug: 'ust-giyim/gomlek', confidence: 0.09 },
        { slug: 'dis-giyim/ceket', confidence: 0.05 },
      ],
      primaryColor: { name: 'Green', confidence: 0.9, hex: '#2A3A2E' },
      secondaryColor: null,
      pattern: { name: 'Solid', confidence: 0.9 },
      quality: { isGarment: true, confidence: 0.9, warnings: [] },
      embeddingModel: 'clip',
      analyzedAt: '2026-11-02T10:00:00Z',
    },
    wearCount: 0,
    lastWornAt: null,
    isArchived: false,
    confirmedAt: null,
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-02T10:00:00Z',
    ...overrides,
  };
}

export function wardrobeStats(overrides: Partial<WardrobeStats> = {}): WardrobeStats {
  return {
    itemCount: 48,
    byCategory: [],
    byColor: [],
    unwornFor180Days: 8,
    mostWorn: [],
    leastWorn: [],
    possibleOutfits: 212,
    unmatchedCount: 0,
    ...overrides,
  };
}

export function wardrobeGaps(overrides: Partial<WardrobeGaps> = {}): WardrobeGaps {
  return {
    personaId: 'pe1',
    gaps: [
      {
        kind: 'MissingColor',
        message: 'Eksik parça: bej tonlarda üst',
        categorySlug: 'ust-giyim',
        color: 'Beige',
        formality: 3,
        band: 'Smart',
        unlocksEstimate: 15,
      },
    ],
    suggestedProducts: [listItem({ id: 'gp1', name: 'Bej boğazlı triko', primaryColor: 'Beige' })],
    ...overrides,
  };
}

export function outfitPiece(overrides: Partial<OutfitPiece> = {}): OutfitPiece {
  return {
    slot: 'Top',
    role: 'Wardrobe',
    source: 'Wardrobe',
    wardrobeItemId: 'w1',
    productId: null,
    name: 'Koyu yeşil blazer',
    categorySlug: 'ust-giyim/blazer',
    color: 'Green',
    imageUrl: 'http://img.test/w1-thumb.webp',
    offer: null,
    ...overrides,
  };
}

const wardrobePieces: OutfitPiece[] = [
  outfitPiece(),
  outfitPiece({
    slot: 'Bottom',
    wardrobeItemId: 'w2',
    name: 'Siyah kumaş pantolon',
    categorySlug: 'alt-giyim/pantolon',
    color: 'Black',
  }),
  outfitPiece({
    slot: 'Shoes',
    wardrobeItemId: 'w3',
    name: 'Kahverengi bot',
    categorySlug: 'ayakkabi/bot',
    color: 'Brown',
  }),
];

export const gapPiece = outfitPiece({
  slot: 'Top',
  role: 'Gap',
  source: 'Catalog',
  wardrobeItemId: null,
  productId: 'gp1',
  name: 'Bej boğazlı triko',
  categorySlug: 'ust-giyim/triko',
  color: 'Beige',
  offer: {
    offerId: 'o-koton',
    seller: { name: 'Koton', slug: 'koton' },
    price: 649,
    goPath: '/api/v1/go/o-koton',
  },
});

let outfitCounter = 0;

export function outfit(overrides: Partial<Outfit> = {}): Outfit {
  outfitCounter += 1;
  return {
    id: `of${outfitCounter}`,
    kind: 'Daily',
    status: 'Suggested',
    completeness: 'Complete',
    occasion: 'Office',
    date: '2026-11-02',
    seed: 0,
    score: 82,
    rule: 'office',
    personaId: 'pe1',
    weather: null,
    pieces: wardrobePieces,
    completionPrice: null,
    anchorPrice: null,
    totalPrice: null,
    narration: { text: 'Koyu yeşil blazer yağmurlu havada şık durur.', provider: 'Template' },
    createdAt: '2026-11-02T08:00:00Z',
    savedAt: null,
    wornAt: null,
    ...overrides,
  };
}

/** A daily outfit that still needs one piece from a store. */
export function needsOneOutfit(overrides: Partial<Outfit> = {}): Outfit {
  return outfit({
    completeness: 'NeedsOne',
    pieces: [gapPiece, ...wardrobePieces.slice(1)],
    completionPrice: 649,
    ...overrides,
  });
}

export function dailyOutfit(overrides: Partial<DailyOutfit> = {}): DailyOutfit {
  return {
    outfit: outfit(),
    alternatives: [outfit(), outfit()],
    weather: {
      city: 'İstanbul',
      date: '2026-11-02',
      tempMinC: 7,
      tempMaxC: 11,
      temperatureC: 9,
      band: 'Cool',
      rain: true,
      precipitationProbability: 80,
    },
    wardrobeEmpty: false,
    message: null,
    ...overrides,
  };
}

export function howToWear(outfits: Outfit[], overrides: Partial<HowToWear> = {}): HowToWear {
  return { productId: 'p1', wardrobeItemId: null, outfits, message: null, ...overrides };
}

export function pairingCompanion(
  id: string,
  reason: PairingCompanion['reason'] = 'neutral',
  score = 80,
): PairingCompanion {
  return { item: wardrobeSummary({ id, name: `Parça ${id}` }), score, reason };
}

/** A pairing answer: two bottoms and a shoe pair with the item; tops, outerwear and accessories have none. */
export function pairings(overrides: Partial<WardrobePairings> = {}): WardrobePairings {
  return {
    itemId: 'w1',
    personaId: 'pe1',
    companions: [
      { slot: 'Top', total: 0, items: [] },
      {
        slot: 'Bottom',
        total: 2,
        items: [pairingCompanion('b1', 'neutral'), pairingCompanion('b2', 'complementary')],
      },
      { slot: 'Outerwear', total: 0, items: [] },
      { slot: 'Shoes', total: 1, items: [pairingCompanion('s1', 'statement')] },
      { slot: 'Accessory', total: 0, items: [] },
    ],
    outfitCount: 6,
    unlock: null,
    ...overrides,
  };
}

export function pairingUnlock(overrides: Partial<PairingUnlock> = {}): PairingUnlock {
  return {
    slot: 'Shoes',
    productId: 'p77',
    name: 'Beyaz sneaker',
    categorySlug: 'ayakkabi/sneaker',
    color: 'White',
    imageUrl: 'http://img.test/p77.webp',
    lowestPrice: 1299,
    cheapestSeller: { name: 'Trendyol', slug: 'trendyol' },
    goPath: '/go/o77',
    unlocksEstimate: 8,
    ...overrides,
  };
}

export function postAuthor(overrides: Partial<PostAuthor> = {}): PostAuthor {
  return { id: 'u-elif', displayName: 'Elif Yıldız', handle: null, isCreator: false, ...overrides };
}

export function postTag(overrides: Partial<PostTag> = {}): PostTag {
  return {
    id: 't1',
    kind: 'Product',
    x: 0.1,
    y: 0.1,
    w: 0.4,
    h: 0.3,
    name: 'Yün karışımlı blazer',
    categorySlug: 'ust-giyim/blazer',
    color: 'Green',
    imageUrl: 'http://img.test/t1.webp',
    productId: 'p1',
    wardrobeItemId: null,
    offer: {
      offerId: 'o-trendyol',
      seller: { name: 'Trendyol', slug: 'trendyol' },
      price: 2149,
      goPath: '/api/v1/go/o-trendyol?src=feed&post=post1',
    },
    inWardrobe: null,
    ...overrides,
  };
}

let postCounter = 0;

/** A live photo post with two tagged products; ids auto-number unless one is given. */
export function post(overrides: Partial<Post> = {}): Post {
  postCounter += 1;
  return {
    id: `post${postCounter}`,
    kind: 'Photo',
    status: 'Live',
    visibility: 'Public',
    author: postAuthor(),
    caption: 'Pazartesi toplantı kombini',
    image: { url: 'http://img.test/post.jpg?sig=1', previewUrl: null, aspect: 0.8 },
    tags: [
      postTag(),
      postTag({
        id: 't2',
        name: 'Siyah kumaş pantolon',
        productId: 'p2',
        x: 0.3,
        y: 0.6,
        offer: {
          offerId: 'o-koton',
          seller: { name: 'Koton', slug: 'koton' },
          price: 2680,
          goPath: '/api/v1/go/o-koton?src=feed&post=post1',
        },
      }),
    ],
    summary: { totalPrice: 4829, pieceCount: 2, ownedCount: 1 },
    likeCount: 12,
    likedByMe: false,
    followingAuthor: false,
    matchScore: null,
    disclosure: null,
    statusMessage: null,
    proposals: null,
    reason: 'ForYou',
    createdAt: '2026-11-05T09:00:00Z',
    publishedAt: '2026-11-05T09:10:00Z',
    ...overrides,
  };
}

export function proposal(overrides: Partial<PostProposal> = {}): PostProposal {
  return {
    id: 'pr1',
    source: 'Detected',
    x: 0.2,
    y: 0.1,
    w: 0.5,
    h: 0.3,
    categorySlug: 'ust-giyim/blazer',
    color: 'Green',
    confidence: 0.8,
    wardrobeItemId: null,
    productId: null,
    ...overrides,
  };
}

export function consent(overrides: Partial<Consent> = {}): Consent {
  return {
    version: '2026-11-v1',
    text: 'Fotoğraftaki herkesin paylaşıma izin verdiğini onaylıyorum.',
    acceptedAt: null,
    ...overrides,
  };
}

export function userProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'u-elif',
    displayName: 'Elif Yıldız',
    handle: null,
    isCreator: false,
    bio: null,
    link: null,
    followerCount: 10,
    followingCount: 4,
    postCount: 3,
    isFollowing: false,
    followsYou: false,
    ...overrides,
  };
}

export function tryResult(overrides: Partial<TryResult> = {}): TryResult {
  return { postId: 'post1', groups: [], ...overrides };
}

export function lensResult(overrides: Partial<LensResult> = {}): LensResult {
  const product = overrides.product ?? listItem();
  return {
    product,
    similarity: 0.75,
    level: 'close',
    inStock: true,
    offer: {
      offerId: `o-${product.id}`,
      seller: { name: 'Trendyol', slug: 'trendyol' },
      price: 1899,
      goPath: `/api/v1/go/o-${product.id}?src=lens`,
    },
    ...overrides,
  };
}

export function lensRegion(overrides: Partial<LensRegion> = {}): LensRegion {
  return {
    index: 0,
    box: { x: 0.1, y: 0.2, w: 0.4, h: 0.5 },
    slot: 'Outerwear',
    family: 'Outerwear',
    category: { slug: 'dis-giyim/blazer', confidence: 0.8 },
    color: 'Brown',
    familyRestricted: true,
    results: [lensResult()],
    wardrobeMatches: null,
    ...overrides,
  };
}

export function lensSearch(overrides: Partial<LensSearchResult> = {}): LensSearchResult {
  return { regions: [lensRegion()], audience: null, wholePhoto: false, ...overrides };
}

// Budget outfits

/** A wardrobe piece of a budget outfit: costs nothing. */
export function budgetPiece(overrides: Partial<BudgetPiece> = {}): BudgetPiece {
  return {
    slot: 'Top',
    role: 'Wardrobe',
    source: 'Wardrobe',
    wardrobeItemId: 'w1',
    productId: null,
    name: 'Koyu yeşil blazer',
    categorySlug: 'ust-giyim/blazer',
    color: 'Green',
    imageUrl: 'http://img.test/w1-thumb.webp',
    price: 0,
    offer: null,
    size: null,
    sizeUnknown: null,
    ...overrides,
  };
}

/** A catalog piece to buy, with its cheapest offer in the caller's size. */
export function boughtPiece(overrides: Partial<BudgetPiece> = {}): BudgetPiece {
  return budgetPiece({
    slot: 'Bottom',
    role: 'Gap',
    source: 'Catalog',
    wardrobeItemId: null,
    productId: 'bp1',
    name: 'Siyah kumaş pantolon',
    categorySlug: 'alt-giyim/pantolon',
    color: 'Black',
    imageUrl: 'http://img.test/bp1.webp',
    price: 899,
    offer: {
      offerId: 'o-bp1',
      seller: { name: 'Trendyol', slug: 'trendyol' },
      price: 899,
      originalPrice: null,
      goPath: '/api/v1/go/o-bp1?src=budget',
      shippingCost: 0,
    },
    size: 'M',
    ...overrides,
  });
}

let budgetCounter = 0;

export function budgetOutfit(overrides: Partial<BudgetOutfit> = {}): BudgetOutfit {
  budgetCounter += 1;
  return {
    id: `bo${budgetCounter}`,
    status: 'Suggested',
    completeness: 'NeedsOne',
    score: 78,
    rule: 'office',
    pieces: [
      budgetPiece(),
      boughtPiece(),
      budgetPiece({
        slot: 'Shoes',
        wardrobeItemId: 'w3',
        name: 'Kahverengi bot',
        categorySlug: 'ayakkabi/bot',
        color: 'Brown',
      }),
    ],
    totalPrice: 899,
    remainingBudget: 2101,
    ownedCount: 2,
    withoutShoes: false,
    savings: null,
    overBudgetBy: null,
    narration: { text: 'Bordo ile koyu yeşil birbirini tamamlar.', provider: 'Template' },
    ...overrides,
  };
}

export function budgetOutfits(overrides: Partial<BudgetOutfits> = {}): BudgetOutfits {
  return {
    budget: 3000,
    date: '2026-11-15',
    occasion: null,
    audience: 'Women',
    useWardrobe: true,
    seed: 0,
    weather: null,
    overBudget: false,
    withoutShoes: false,
    message: null,
    outfits: [budgetOutfit(), budgetOutfit()],
    ...overrides,
  };
}

// Trips

export function packItem(overrides: Partial<TripPackItem> = {}): TripPackItem {
  return {
    wardrobeItemId: 'w1',
    name: 'Koyu yeşil blazer',
    categorySlug: 'ust-giyim/blazer',
    color: 'Green',
    imageUrl: 'http://img.test/w1-thumb.webp',
    days: 3,
    missing: false,
    ...overrides,
  };
}

export function tripDay(date: string, overrides: Partial<TripDay> = {}): TripDay {
  return {
    date,
    occasion: null,
    weather: {
      source: 'Forecast',
      tempMinC: 8,
      tempMaxC: 14,
      temperatureC: 12,
      band: 'Cool',
      rain: true,
      precipitationProbability: 70,
      season: 'Autumn',
    },
    outfit: {
      pieces: [
        {
          slot: 'Top',
          wardrobeItemId: 'w1',
          name: 'Koyu yeşil blazer',
          categorySlug: 'ust-giyim/blazer',
          color: 'Green',
          imageUrl: 'http://img.test/w1-thumb.webp',
          missing: false,
        },
        {
          slot: 'Bottom',
          wardrobeItemId: 'w2',
          name: 'Siyah kumaş pantolon',
          categorySlug: 'alt-giyim/pantolon',
          color: 'Black',
          imageUrl: 'http://img.test/w2-thumb.webp',
          missing: false,
        },
      ],
      score: 80,
      rule: 'office',
      narration: { text: 'Yağmurlu günde koyu tonlar rahat eder.', provider: 'Template' },
    },
    ...overrides,
  };
}

export function tripGap(overrides: Partial<TripGap> = {}): TripGap {
  return {
    slot: 'Shoes',
    reason: 'Missing',
    message: 'Dolabında hiç ayakkabı yok.',
    days: ['2026-11-21'],
    suggestion: {
      productId: 'tp1',
      name: 'Siyah deri bot',
      categorySlug: 'ayakkabi/bot',
      color: 'Black',
      imageUrl: 'http://img.test/tp1.webp',
      offer: {
        offerId: 'o-tp1',
        seller: { name: 'Hepsiburada', slug: 'hepsiburada' },
        price: 1899,
        goPath: '/api/v1/go/o-tp1?src=trip',
      },
    },
    ...overrides,
  };
}

export function tripPlan(overrides: Partial<TripPlan> = {}): TripPlan {
  return {
    city: 'Roma',
    startDate: '2026-11-20',
    endDate: '2026-11-22',
    pieceCount: 2,
    pieces: [
      { slot: 'Top', items: [packItem()] },
      {
        slot: 'Bottom',
        items: [
          packItem({
            wardrobeItemId: 'w2',
            name: 'Siyah kumaş pantolon',
            categorySlug: 'alt-giyim/pantolon',
            color: 'Black',
            days: 2,
          }),
        ],
      },
    ],
    days: [tripDay('2026-11-20'), tripDay('2026-11-21'), tripDay('2026-11-22', { outfit: null })],
    coverage: { covered: 2, total: 3, percent: 67 },
    gaps: [],
    message: '3 günün 2 günü için dolabından kombin çıktı; eksik parçalar aşağıda.',
    ...overrides,
  };
}

export function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'tr1',
    name: 'Roma gezisi',
    request: {
      city: 'Roma',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      occasions: null,
      maxPieces: 20,
      allowRepeatShoes: true,
      laundry: false,
      personaId: null,
    },
    plannedAt: '2026-11-15T09:00:00Z',
    createdAt: '2026-11-15T09:00:00Z',
    plan: tripPlan(),
    ...overrides,
  };
}

export function tripSummary(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 'tr1',
    name: 'Roma gezisi',
    city: 'Roma',
    startDate: '2026-11-20',
    endDate: '2026-11-22',
    pieceCount: 2,
    coverage: { covered: 2, total: 3, percent: 67 },
    plannedAt: '2026-11-15T09:00:00Z',
    createdAt: '2026-11-15T09:00:00Z',
    ...overrides,
  };
}

// Dolap özeti and the size questions

/** The value block of a summary: 3 own prices, 2 estimates, 1 piece without a price. */
export function wardrobeValue(overrides: Partial<WardrobeValue> = {}): WardrobeValue {
  return {
    currency: 'TRY',
    total: 7400,
    knownTotal: 6000,
    estimatedTotal: 1400,
    isEstimate: true,
    counts: { priced: 3, estimated: 2, unpriced: 1 },
    byCategory: [
      {
        slug: 'alt-giyim',
        name: 'Alt giyim',
        pieceCount: 2,
        unpricedCount: 0,
        total: 1400,
        estimatedTotal: 1400,
        isEstimate: true,
      },
      {
        slug: 'ust-giyim',
        name: 'Üst giyim',
        pieceCount: 3,
        unpricedCount: 1,
        total: 6000,
        estimatedTotal: 0,
        isEstimate: false,
      },
    ],
    note: null,
    ...overrides,
  };
}

export function costPerWearItem(overrides: Partial<CostPerWearItem> = {}): CostPerWearItem {
  return {
    item: wardrobeSummary({ id: 'cw1', name: 'Siyah bot' }),
    price: 2400,
    priceIsEstimate: false,
    wearCount: 12,
    costPerWear: 200,
    ...overrides,
  };
}

export function unwornItem(overrides: Partial<UnwornItem> = {}): UnwornItem {
  return {
    item: wardrobeSummary({ id: 'uw1', name: 'Kahverengi ceket', wearCount: 0 }),
    daysInWardrobe: 45,
    reason: null,
    reasonText: null,
    unlock: null,
    ...overrides,
  };
}

/** A full summary; `smallOverview()` is the small-wardrobe answer. */
export function wardrobeOverview(overrides: Partial<WardrobeOverview> = {}): WardrobeOverview {
  return {
    pieceCount: 6,
    message: null,
    value: wardrobeValue(),
    costPerWear: [costPerWearItem()],
    unworn: { totalCount: 1, items: [unwornItem()], message: null },
    ...overrides,
  };
}

export function smallOverview(): WardrobeOverview {
  return {
    pieceCount: 2,
    message:
      'Dolabında 2 parça var. En az 5 parça olunca dolap değerini ve giymediklerini gösterebiliriz.',
    value: null,
    costPerWear: null,
    unworn: null,
  };
}

export function sizePrompt(overrides: Partial<SizePrompt> = {}): SizePrompt {
  return {
    id: 'sp1',
    product: { id: 'p1', name: 'Slim fit gömlek', imageUrl: 'http://img.test/p1.webp' },
    brand: { id: 'b1', name: 'Mavi', slug: 'mavi' },
    seller: { name: 'Trendyol', slug: 'trendyol' },
    group: 'Tops',
    knownSize: { size: 'M', source: 'UserEntered', confidence: 0.8 },
    availableSizes: ['S', 'M', 'L'],
    clickedAt: '2026-11-10T10:00:00Z',
    expiresAt: '2026-12-10T10:00:00Z',
    ...overrides,
  };
}

/** The signed-in account (`GET /me`): the remembered worn outfit is kept per user id. */
export function me(overrides: Partial<Me> = {}): Me {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    email: 'ayse@example.com',
    displayName: 'Ayşe',
    createdAt: '2026-01-01T09:00:00Z',
    ...overrides,
  };
}
