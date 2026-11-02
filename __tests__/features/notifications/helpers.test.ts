import { FILTERS, filterNotifications, groupByDay } from '@/features/notifications/grouping';
import { deepLinkOf, parseDeepLink } from '@/features/notifications/navigation';
import { formatTimeAgo } from '@/utils/dates';

import { notification } from '../../fixtures';

// Monday 2 November 2026, 14:30 local time.
const NOW = new Date(2026, 10, 2, 14, 30);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString();

describe('parseDeepLink', () => {
  it('reads the three shapes the backend sends', () => {
    expect(parseDeepLink('kombin://product/6f1c2a8e-1b2c-4d3e-8f90-123456789abc')).toEqual({
      type: 'product',
      id: '6f1c2a8e-1b2c-4d3e-8f90-123456789abc',
    });
    expect(parseDeepLink('kombin://matches/pe-1')).toEqual({ type: 'matches', personaId: 'pe-1' });
    expect(parseDeepLink('kombin://notifications')).toEqual({ type: 'notifications' });
  });

  it('ignores anything else', () => {
    expect(parseDeepLink(null)).toBeNull();
    expect(parseDeepLink('')).toBeNull();
    expect(parseDeepLink('https://example.com/product/p1')).toBeNull();
    expect(parseDeepLink('kombin://product/')).toBeNull();
    expect(parseDeepLink('kombin://product/p1/../../admin')).toBeNull();
    expect(parseDeepLink('kombin://wardrobe')).toBeNull();
  });
});

describe('deepLinkOf', () => {
  it('reads data.deepLink from untyped JSON', () => {
    expect(deepLinkOf({ deepLink: 'kombin://notifications' })).toBe('kombin://notifications');
    expect(deepLinkOf({ deepLink: 5 })).toBeNull();
    expect(deepLinkOf(null)).toBeNull();
    expect(deepLinkOf('kombin://notifications')).toBeNull();
  });
});

describe('groupByDay', () => {
  it('splits a newest-first feed into Bugün, Dün and Daha önce and drops empty sections', () => {
    const items = [
      notification({ id: 1, createdAt: at(2, 14, 10) }),
      notification({ id: 2, createdAt: at(2, 0, 5) }),
      notification({ id: 3, createdAt: at(1, 23, 59) }),
      notification({ id: 4, createdAt: at(1, 8) }),
      notification({ id: 5, createdAt: at(-5, 12) }),
    ];

    const sections = groupByDay(items, NOW);

    expect(sections.map((section) => [section.title, section.data.map((item) => item.id)])).toEqual(
      [
        ['Bugün', [1, 2]],
        ['Dün', [3, 4]],
        ['Daha önce', [5]],
      ],
    );
    expect(groupByDay([items[4]!], NOW).map((section) => section.title)).toEqual(['Daha önce']);
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe('filterNotifications', () => {
  const items = [
    notification({ id: 1, kind: 'PriceDrop' }),
    notification({ id: 2, kind: 'AnyChange' }),
    notification({ id: 3, kind: 'BackInStock' }),
    notification({ id: 4, kind: 'NewMatches' }),
    notification({ id: 5, kind: 'System' }),
  ];
  const ids = (filter: Parameters<typeof filterNotifications>[1]) =>
    filterNotifications(items, filter).map((item) => item.id);

  it('maps each chip to its kinds; only Tümü shows system messages', () => {
    expect(FILTERS.map((filter) => filter.label)).toEqual(['Tümü', 'Fiyat', 'Stok', 'Öneri']);
    expect(ids('all')).toEqual([1, 2, 3, 4, 5]);
    expect(ids('price')).toEqual([1, 2]);
    expect(ids('stock')).toEqual([3]);
    expect(ids('recommendation')).toEqual([4]);
  });
});

describe('formatTimeAgo', () => {
  it('speaks in minutes, hours, "Dün" and then a short date', () => {
    expect(formatTimeAgo(at(2, 14, 30), NOW)).toBe('Az önce');
    expect(formatTimeAgo(at(2, 14, 16), NOW)).toBe('14 dk önce');
    expect(formatTimeAgo(at(2, 9, 30), NOW)).toBe('5 sa önce');
    expect(formatTimeAgo(at(1, 20), NOW)).toBe('Dün');
    expect(formatTimeAgo(at(1, 8), NOW)).toBe('Dün');
    expect(formatTimeAgo(at(25 - 30, 12), NOW)).toBe('26 Eki');
  });
});
