import {
  alertStatus,
  averageDiscountPercent,
  hasRecentTrigger,
  isBelowTarget,
  totalSavings,
  watchSummary,
} from '@/features/tracking/stats';

import { alert, trigger } from '../../fixtures';

describe('tracking stats', () => {
  it('sums price-before minus price-after over price-drop triggers', () => {
    const triggers = [
      trigger({ id: 1, priceBefore: 2999, priceAfter: 2149 }),
      trigger({ id: 2, priceBefore: 1000, priceAfter: 900 }),
      // Not a price drop: ignored.
      trigger({ id: 3, kind: 'AnyChange', priceBefore: 500, priceAfter: 100 }),
      // An increase is not a saving.
      trigger({ id: 4, priceBefore: 100, priceAfter: 150 }),
      trigger({ id: 5, priceBefore: null, priceAfter: 100 }),
    ];

    expect(totalSavings(triggers)).toBe(950);
  });

  it('averages the percent saved per drop and is null without any', () => {
    expect(averageDiscountPercent([])).toBeNull();
    expect(
      averageDiscountPercent([trigger({ kind: 'BackInStock', priceBefore: null })]),
    ).toBeNull();

    const average = averageDiscountPercent([
      trigger({ id: 1, priceBefore: 1000, priceAfter: 800 }),
      trigger({ id: 2, priceBefore: 200, priceAfter: 100 }),
    ]);
    expect(average).toBeCloseTo(35);
  });

  it('accepts the string form of decimals', () => {
    expect(totalSavings([trigger({ priceBefore: '1000.50', priceAfter: '900.25' })])).toBeCloseTo(
      100.25,
    );
  });

  it('counts watched products and those at or below their target', () => {
    const alerts = [
      alert({ id: 'a1', targetPrice: 2300 }),
      alert({
        id: 'a2',
        targetPrice: 1000,
        product: { ...alert().product, id: 'p2', lowestPrice: 1290 },
      }),
      alert({ id: 'a3', isActive: false, product: { ...alert().product, id: 'p3' } }),
      alert({
        id: 'a4',
        kind: 'BackInStock',
        targetPrice: null,
        product: { ...alert().product, id: 'p4' },
      }),
    ];

    expect(watchSummary(alerts)).toEqual({ watched: 3, belowTarget: 1 });
    expect(isBelowTarget(alerts[0]!)).toBe(true);
    expect(isBelowTarget(alerts[1]!)).toBe(false);
    expect(isBelowTarget(alerts[3]!)).toBe(false);
  });

  it('flags alerts that fired within the last 7 days', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    expect(hasRecentTrigger(alert({ lastTriggeredAt: '2026-10-30T12:00:00Z' }), now)).toBe(true);
    expect(hasRecentTrigger(alert({ lastTriggeredAt: '2026-10-20T12:00:00Z' }), now)).toBe(false);
    expect(hasRecentTrigger(alert({ lastTriggeredAt: null }), now)).toBe(false);
  });

  describe('status line', () => {
    const above = alert({ targetPrice: 1000 });

    it('is "below target" whenever the current price is at or under the target', () => {
      expect(alertStatus(alert({ targetPrice: 2300 }), [])).toEqual({ kind: 'belowTarget' });
    });

    it('reports an increase from the latest trigger, newest first', () => {
      const status = alertStatus(above, [
        trigger({
          id: 1,
          kind: 'AnyChange',
          priceBefore: 2000,
          priceAfter: 1800,
          triggeredAt: '2026-10-01T00:00:00Z',
        }),
        trigger({
          id: 2,
          kind: 'AnyChange',
          priceBefore: 2199,
          priceAfter: 2499,
          triggeredAt: '2026-10-29T00:00:00Z',
        }),
      ]);
      expect(status).toEqual({ kind: 'increase', amount: 300 });
    });

    it('reports a drop that did not reach the target', () => {
      expect(alertStatus(above, [trigger({ priceBefore: 2999, priceAfter: 2149 })])).toEqual({
        kind: 'drop',
        amount: 850,
      });
    });

    it('reports stock coming back', () => {
      expect(
        alertStatus(above, [trigger({ kind: 'BackInStock', priceBefore: null, priceAfter: null })]),
      ).toEqual({ kind: 'backInStock' });
    });

    it('is "unchanged" without triggers, or with those of another alert', () => {
      expect(alertStatus(above, [])).toEqual({ kind: 'unchanged' });
      expect(alertStatus(above, [trigger({ alertId: 'other' })])).toEqual({ kind: 'unchanged' });
    });
  });
});
