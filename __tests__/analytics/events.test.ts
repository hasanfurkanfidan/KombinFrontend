import { EVENT_KEYS, findEventProblems, isForbiddenKey, type EventName } from '@/analytics/events';
import { screenName } from '@/analytics/screenName';

/** The backend README's allow-list table, copied by hand: the client's guard must mirror it exactly. */
const BACKEND_TABLE: Record<string, { required: string[]; optional: string[] }> = {
  app_open: { required: [], optional: [] },
  app_background: { required: [], optional: [] },
  screen_view: { required: ['screen'], optional: [] },
  product_view: { required: ['productId', 'source'], optional: ['personaId'] },
  product_list_view: { required: ['sort', 'filters'], optional: [] },
  swipe: { required: ['personaId', 'decision'], optional: [] },
  onboarding_step: { required: ['step', 'action'], optional: [] },
  alert_created: { required: ['kind'], optional: [] },
  buy_click: { required: ['offerId', 'source'], optional: [] },
  search: { required: ['queryLength'], optional: [] },
  notification_open: { required: ['notificationId', 'kind'], optional: [] },
  // Wardrobe and outfits (Task 13): the backend allow-list gets the same six in its own follow-up.
  wardrobe_add_start: { required: ['source'], optional: [] },
  wardrobe_add_done: { required: ['status', 'durationMs'], optional: [] },
  outfit_view: { required: ['kind', 'status'], optional: ['occasion'] },
  outfit_shuffle: { required: [], optional: [] },
  outfit_feedback: { required: ['action'], optional: ['reason'] },
  outfit_gap_click: { required: [], optional: [] },
  // Task 13c: NOT in the backend allow-list yet (Part A merged without them), so the backend rejects both one by one
  // until it lists them; the client table already has them.
  wardrobe_pairings_view: { required: ['companionTotal', 'hasUnlock'], optional: [] },
  wardrobe_unlock_click: { required: [], optional: [] },
  // Task 14 (social): in the backend allow-list (`AnalyticsEventCatalog`); ids and enums only, never captions or handles.
  post_view: { required: ['postId', 'source'], optional: ['position'] },
  post_tag_tap: { required: ['postId', 'tagKind', 'hasOffer'], optional: [] },
  post_like: { required: ['postId', 'liked'], optional: [] },
  post_create_start: { required: ['kind', 'source'], optional: [] },
  post_create_done: {
    required: ['kind', 'status', 'tagCount', 'durationMs'],
    optional: ['visibility'],
  },
  post_report: { required: ['postId', 'reason'], optional: [] },
  creator_profile_view: { required: ['creatorId'], optional: [] },
  try_with_wardrobe: { required: ['postId', 'anchorCount', 'outfitCount'], optional: [] },
  // Task 16a: NOT in the backend allow-list yet (a tiny backend task follows); the client table has it, nothing emits it.
  auth_external: { required: ['provider', 'isNewUser'], optional: [] },
};

describe('event allow-list', () => {
  it('mirrors the backend table exactly: same events, same property keys', () => {
    expect(Object.keys(EVENT_KEYS).sort()).toEqual(Object.keys(BACKEND_TABLE).sort());
    for (const [name, spec] of Object.entries(BACKEND_TABLE)) {
      const mine = EVENT_KEYS[name as EventName];
      expect([...mine.required].sort()).toEqual([...spec.required].sort());
      expect([...mine.optional].sort()).toEqual([...spec.optional].sort());
    }
  });

  it('accepts a well-formed event of every kind', () => {
    expect(findEventProblems('app_open', {})).toEqual([]);
    expect(findEventProblems('screen_view', { screen: 'product/:id' })).toEqual([]);
    expect(findEventProblems('product_view', { productId: 'p1', source: 'discover' })).toEqual([]);
    expect(
      findEventProblems('product_view', { productId: 'p1', personaId: 'pe1', source: 'push' }),
    ).toEqual([]);
    expect(findEventProblems('search', { queryLength: 7 })).toEqual([]);
    expect(
      findEventProblems('notification_open', { notificationId: 5, kind: 'PriceDrop' }),
    ).toEqual([]);
  });
});

describe('PII and shape guard', () => {
  it.each(['email', 'name', 'phone', 'address', 'token', 'Email', 'E-Mail', 'NAME'])(
    'refuses a property named %s on any event',
    (key) => {
      expect(isForbiddenKey(key)).toBe(true);
      const problems = findEventProblems('screen_view', { screen: 'home', [key]: 'x' });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/personal data/);
    },
  );

  it('refuses the search text itself: search carries only the query length', () => {
    const problems = findEventProblems('search', { queryLength: 5, query: 'blazer' });
    expect(problems).toEqual(["'query' is not a property of 'search'"]);
  });

  it('refuses a property that is not listed for the event', () => {
    expect(findEventProblems('swipe', { personaId: 'p', decision: 'Like', extra: 1 })).toEqual([
      "'extra' is not a property of 'swipe'",
    ]);
  });

  it('refuses a missing required property', () => {
    expect(findEventProblems('buy_click', { offerId: 'o1' })).toEqual([
      "'source' is required for 'buy_click'",
    ]);
  });

  it('refuses nested values and an unknown event', () => {
    expect(findEventProblems('screen_view', { screen: { deep: true } })).toEqual([
      "'screen' must be a flat value",
    ]);
    expect(findEventProblems('wardrobe_open', {})).toEqual([
      "'wardrobe_open' is not an allowed analytics event",
    ]);
  });

  it('refuses properties over 2 KB', () => {
    const problems = findEventProblems('screen_view', { screen: 'x'.repeat(3000) });
    expect(problems.join(' ')).toMatch(/over 2048 bytes/);
  });
});

describe('screenName', () => {
  it('maps route paths to one stable value per screen', () => {
    expect(screenName('/')).toBe('home');
    expect(screenName('/tracking')).toBe('tracking');
    expect(screenName('/notifications')).toBe('notifications');
    expect(screenName('/product/6f1c2a8e-1b2c-4d3e-8f90-123456789abc')).toBe('product/:id');
    expect(screenName('/profile/sizes')).toBe('profile/sizes');
  });
});
